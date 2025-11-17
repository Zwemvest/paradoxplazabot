/**
 * Unit tests for removal system
 * Features: 5001-5009
 */

import { checkRemoval, removePost } from '../../src/services/removalSystem';
import { isPostWarned, markPostRemoved, getWarningCommentId } from '../../src/storage/postState';
import type { Post, Comment } from '@devvit/public-api';
import type { BotSettings } from '../../src/types';

// Mock the dependencies
jest.mock('../../src/storage/postState');
jest.mock('../../src/services/postValidation');
jest.mock('../../src/services/commentValidation');

const mockIsPostWarned = isPostWarned as jest.MockedFunction<typeof isPostWarned>;
const mockMarkPostRemoved = markPostRemoved as jest.MockedFunction<typeof markPostRemoved>;
const mockGetWarningCommentId = getWarningCommentId as jest.MockedFunction<typeof getWarningCommentId>;

// Create mock context
const createMockContext = (settingsOverride: Partial<BotSettings> = {}) => {
  const defaultSettings: BotSettings = {
    enforcedposttypes: ['image', 'gallery', 'text_image', 'link_image'],
    allowlistedusers: '',
    maxpostage: 0,
    skipupvotethreshold: 0,
    textpostexclusionstartswith: '',
    textpostexclusioncontainsone: '',
    linkdomainexclusions: '',
    respectmodapprovals: true,
    skipmodremoved: true,
    skipifmodcomment: false,
    modcommentskipkeywords: '',
    imagedomains: 'imgur.com\ni.redd.it',
    videodomains: 'youtube.com\nv.redd.it',
    linkenforcementdomains: '',
    enforcementkeywords: '',
    skipkeywords: '',
    modmailkeywords: '',
    enforcedflairs: '',
    excludedflairs: 'comic,art',
    mincommentlength: 50,
    reportcommentlength: 75,
    r5containsone: '',
    r5containsall: '',
    r5startswith: '',
    r5endswith: '',
    r5commentlocation: 'both',
    graceperiod: 5,
    warningperiod: 10,
    removalperiod: 15,
    enforcementaction: 'remove',
    commentonwarning: true,
    commentonremoval: true,
    commentonreinstatement: false,
    enablemodmail: true,
    autoreinstate: true,
    autoarchivemodmail: true,
    cleanupwarnings: true,
    enableslack: false,
    slackwebhook: '',
    enablediscord: false,
    discordwebhook: '',
    notificationevents: [],
    warningtemplate: '',
    removaltemplate: 'Your post "{{postTitle}}" has been removed.',
    reportreasontooshort: '',
    reportreasonnor5: '',
    notificationtemplate: '',
  };

  return {
    settings: {
      getAll: jest.fn(async () => ({ ...defaultSettings, ...settingsOverride })),
    },
    reddit: {
      getPostById: jest.fn(async (id: string) => createMockPost({ id })),
      getCommentById: jest.fn(async (id: string) => createMockComment({ id })),
    },
  } as any;
};

const createMockPost = (overrides: Partial<Post> = {}): Post => {
  const mockComment = {
    id: 'removalcomment123',
    distinguish: jest.fn(async () => {}),
  };

  return {
    id: 'post123',
    authorName: 'testuser',
    title: 'Test Post Title',
    permalink: '/r/test/comments/post123',
    createdAt: new Date(),
    score: 1,
    approved: false,
    removed: false,
    isSelf: false,
    isGallery: false,
    isVideo: false,
    postHint: 'image',
    selfText: '',
    url: '',
    linkFlairText: '',
    remove: jest.fn(async () => {}),
    addComment: jest.fn(async (options: { text: string }) => mockComment),
    ...overrides,
  } as any;
};

const createMockComment = (overrides: Partial<Comment> = {}): Comment => {
  return {
    id: 'comment123',
    authorName: 'testuser',
    body: 'Test comment',
    createdAt: new Date(),
    parentId: 'post123',
    delete: jest.fn(async () => {}),
    ...overrides,
  } as any;
};

describe('Removal System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature 5002: Schedule Removal Check', () => {
    it('should check removal and remove post if no R5', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(true);

      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: true, reason: 'Image post' });

      const { hasValidR5Comment } = require('../../src/services/commentValidation');
      hasValidR5Comment.mockResolvedValue({ hasValidR5: false, reason: 'No R5' });

      await checkRemoval(postId, context);

      expect(context.reddit.getPostById).toHaveBeenCalledWith(postId);
      expect(mockIsPostWarned).toHaveBeenCalledWith(postId, context);
    });

    it('should skip if post not found', async () => {
      const context = createMockContext();
      context.reddit.getPostById = jest.fn().mockResolvedValue(null);

      await checkRemoval('post123', context);

      expect(mockIsPostWarned).not.toHaveBeenCalled();
    });

    it('should not throw on errors', async () => {
      const context = createMockContext();
      context.reddit.getPostById = jest.fn().mockRejectedValue(new Error('Reddit API error'));

      await expect(checkRemoval('post123', context)).resolves.not.toThrow();
    });
  });

  describe('Feature 5003: Verify Warning Exists Before Removal', () => {
    it('should skip removal if post was never warned', async () => {
      const context = createMockContext();
      const postId = 'post123';
      const post = createMockPost({ id: postId });

      mockIsPostWarned.mockResolvedValue(false);

      await checkRemoval(postId, context);

      expect(post.remove).not.toHaveBeenCalled();
    });

    it('should proceed with removal if post was warned', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(true);

      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: true, reason: 'Image post' });

      const { hasValidR5Comment } = require('../../src/services/commentValidation');
      hasValidR5Comment.mockResolvedValue({ hasValidR5: false });

      await checkRemoval(postId, context);

      expect(mockIsPostWarned).toHaveBeenCalledWith(postId, context);
    });
  });

  describe('Feature 5004: Generate Removal Message', () => {
    it('should generate removal message from template', async () => {
      const context = createMockContext({
        removaltemplate: 'Hello {{author}}, your post "{{postTitle}}" was removed.',
      });
      const post = createMockPost({
        authorName: 'testuser',
        title: 'My Test Post',
      });

      mockIsPostWarned.mockResolvedValue(true);

      await removePost(post, context);

      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.stringContaining('Hello testuser'),
      });
      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.stringContaining('My Test Post'),
      });
    });

    it('should substitute all template variables', async () => {
      const context = createMockContext({
        removaltemplate: '{{author}} - {{postTitle}} - {{warningMinutes}} - {{postUrl}}',
        warningperiod: 15,
      });
      const post = createMockPost({
        authorName: 'user123',
        title: 'Title Here',
        permalink: '/r/test/comments/abc',
      });

      mockIsPostWarned.mockResolvedValue(true);

      await removePost(post, context);

      expect(post.addComment).toHaveBeenCalledWith({
        text: 'user123 - Title Here - 15 - https://reddit.com/r/test/comments/abc',
      });
    });

    it('should use default template if none provided', async () => {
      const context = createMockContext({
        removaltemplate: '',
      });
      const post = createMockPost();

      mockIsPostWarned.mockResolvedValue(true);

      await removePost(post, context);

      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.stringContaining('removed'),
      });
    });
  });

  describe('Feature 5005: Remove Post from Subreddit', () => {
    it('should remove post', async () => {
      const context = createMockContext();
      const post = createMockPost();

      await removePost(post, context);

      expect(post.remove).toHaveBeenCalledTimes(1);
    });

    it('should handle removal errors gracefully', async () => {
      const context = createMockContext();
      const post = createMockPost();
      post.remove = jest.fn().mockRejectedValue(new Error('Removal API error'));

      await expect(removePost(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 5006: Post Removal Comment', () => {
    it('should post removal comment', async () => {
      const context = createMockContext();
      const post = createMockPost();

      await removePost(post, context);

      expect(post.addComment).toHaveBeenCalledTimes(1);
      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.any(String),
      });
    });

    it('should not post comment if commentonremoval is false', async () => {
      const context = createMockContext({
        commentonremoval: false,
      });
      const post = createMockPost();

      await removePost(post, context);

      expect(post.addComment).not.toHaveBeenCalled();
      // But should still remove and track state
      expect(post.remove).toHaveBeenCalled();
      expect(mockMarkPostRemoved).toHaveBeenCalled();
    });

    it('should handle comment posting errors gracefully', async () => {
      const context = createMockContext();
      const post = createMockPost();
      post.addComment = jest.fn().mockRejectedValue(new Error('Comment API error'));

      await expect(removePost(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 5007: Distinguish Removal Comment', () => {
    it('should distinguish removal comment', async () => {
      const context = createMockContext();
      const post = createMockPost();
      const mockComment = {
        id: 'removalcomment123',
        distinguish: jest.fn(async () => {}),
      };
      post.addComment = jest.fn().mockResolvedValue(mockComment);

      await removePost(post, context);

      expect(mockComment.distinguish).toHaveBeenCalledWith(true);
    });

    it('should handle distinguish errors gracefully', async () => {
      const context = createMockContext();
      const post = createMockPost();
      const mockComment = {
        id: 'removalcomment123',
        distinguish: jest.fn().mockRejectedValue(new Error('Distinguish error')),
      };
      post.addComment = jest.fn().mockResolvedValue(mockComment);

      await expect(removePost(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 5008: Clean Up Warning Comments', () => {
    it('should delete warning comment when enabled', async () => {
      const context = createMockContext({
        cleanupwarnings: true,
      });
      const post = createMockPost({ id: 'post123' });
      const warningComment = createMockComment({ id: 'warning123' });

      mockGetWarningCommentId.mockResolvedValue('warning123');
      context.reddit.getCommentById = jest.fn().mockResolvedValue(warningComment);

      await removePost(post, context);

      expect(mockGetWarningCommentId).toHaveBeenCalledWith('post123', context);
      expect(context.reddit.getCommentById).toHaveBeenCalledWith('warning123');
      expect(warningComment.delete).toHaveBeenCalled();
    });

    it('should not delete warning comment when disabled', async () => {
      const context = createMockContext({
        cleanupwarnings: false,
      });
      const post = createMockPost({ id: 'post123' });

      await removePost(post, context);

      expect(mockGetWarningCommentId).not.toHaveBeenCalled();
    });

    it('should handle no warning comment gracefully', async () => {
      const context = createMockContext({
        cleanupwarnings: true,
      });
      const post = createMockPost({ id: 'post123' });

      mockGetWarningCommentId.mockResolvedValue(null);

      await expect(removePost(post, context)).resolves.not.toThrow();
    });

    it('should handle comment deletion errors gracefully', async () => {
      const context = createMockContext({
        cleanupwarnings: true,
      });
      const post = createMockPost({ id: 'post123' });
      const warningComment = createMockComment({ id: 'warning123' });
      warningComment.delete = jest.fn().mockRejectedValue(new Error('Delete error'));

      mockGetWarningCommentId.mockResolvedValue('warning123');
      context.reddit.getCommentById = jest.fn().mockResolvedValue(warningComment);

      await expect(removePost(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 5009: Track Removal State', () => {
    it('should mark post as removed with comment ID', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });
      const mockComment = {
        id: 'removalcomment123',
        distinguish: jest.fn(async () => {}),
      };
      post.addComment = jest.fn().mockResolvedValue(mockComment);

      await removePost(post, context);

      // Should be called twice: once without comment ID, once with
      expect(mockMarkPostRemoved).toHaveBeenCalledWith('post123', context);
      expect(mockMarkPostRemoved).toHaveBeenCalledWith('post123', context, 'removalcomment123');
    });

    it('should mark as removed even if comment posting disabled', async () => {
      const context = createMockContext({
        commentonremoval: false,
      });
      const post = createMockPost({ id: 'post123' });

      await removePost(post, context);

      expect(mockMarkPostRemoved).toHaveBeenCalledWith('post123', context);
    });

    it('should track removal before posting comment', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });
      const callOrder: string[] = [];

      mockMarkPostRemoved.mockImplementation(async () => {
        callOrder.push('markRemoved');
      });
      post.addComment = jest.fn(async () => {
        callOrder.push('addComment');
        return { id: 'comment123', distinguish: jest.fn() };
      });

      await removePost(post, context);

      // markRemoved should be called before addComment
      expect(callOrder[0]).toBe('markRemoved');
    });
  });

  describe('Integration: Complete Removal Flow', () => {
    it('should skip removal if R5 was added', async () => {
      const context = createMockContext();
      const postId = 'post123';
      const post = createMockPost({ id: postId });

      mockIsPostWarned.mockResolvedValue(true);

      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: true, reason: 'Image post' });

      const { hasValidR5Comment } = require('../../src/services/commentValidation');
      hasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid R5 found' });

      await checkRemoval(postId, context);

      // Should not remove because R5 was added
      expect(post.remove).not.toHaveBeenCalled();
    });

    it('should skip removal if post no longer needs enforcement', async () => {
      const context = createMockContext();
      const postId = 'post123';
      const post = createMockPost({ id: postId });

      mockIsPostWarned.mockResolvedValue(true);

      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: false, reason: 'Flair excluded' });

      await checkRemoval(postId, context);

      expect(post.remove).not.toHaveBeenCalled();
    });

    it('should complete full removal flow', async () => {
      const context = createMockContext({
        commentonremoval: true,
        cleanupwarnings: true,
      });
      const postId = 'post123';
      const post = createMockPost({ id: postId });
      const warningComment = createMockComment({ id: 'warning123' });

      mockIsPostWarned.mockResolvedValue(true);
      mockGetWarningCommentId.mockResolvedValue('warning123');
      context.reddit.getCommentById = jest.fn().mockResolvedValue(warningComment);

      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: true, reason: 'Image post' });

      const { hasValidR5Comment } = require('../../src/services/commentValidation');
      hasValidR5Comment.mockResolvedValue({ hasValidR5: false });

      await checkRemoval(postId, context);

      // Should remove post
      expect(post.remove).toHaveBeenCalled();
      // Should track removal
      expect(mockMarkPostRemoved).toHaveBeenCalled();
      // Should post removal comment
      expect(post.addComment).toHaveBeenCalled();
      // Should clean up warning comment
      expect(warningComment.delete).toHaveBeenCalled();
    });
  });
});
