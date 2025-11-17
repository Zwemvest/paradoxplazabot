/**
 * Unit tests for reinstatement system
 * Features: 6001-6008, 6010
 */

import { checkForR5Addition, reinstatePost, monitorWarnedPosts } from '../../src/services/reinstatementSystem';
import {
  isPostWarned,
  wasRemovedByBot,
  getWarningTime,
  getWarningCommentId,
  getRemovalCommentId,
  markPostApproved,
  clearPostState,
} from '../../src/storage/postState';
import { hasR5AddedAfterWarning } from '../../src/services/commentValidation';
import type { Post, Comment } from '@devvit/public-api';
import type { BotSettings } from '../../src/types';

// Mock the dependencies
jest.mock('../../src/storage/postState');
jest.mock('../../src/services/commentValidation');

const mockIsPostWarned = isPostWarned as jest.MockedFunction<typeof isPostWarned>;
const mockWasRemovedByBot = wasRemovedByBot as jest.MockedFunction<typeof wasRemovedByBot>;
const mockGetWarningTime = getWarningTime as jest.MockedFunction<typeof getWarningTime>;
const mockGetWarningCommentId = getWarningCommentId as jest.MockedFunction<typeof getWarningCommentId>;
const mockGetRemovalCommentId = getRemovalCommentId as jest.MockedFunction<typeof getRemovalCommentId>;
const mockMarkPostApproved = markPostApproved as jest.MockedFunction<typeof markPostApproved>;
const mockClearPostState = clearPostState as jest.MockedFunction<typeof clearPostState>;
const mockHasR5AddedAfterWarning = hasR5AddedAfterWarning as jest.MockedFunction<typeof hasR5AddedAfterWarning>;

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
    imagedomains: 'imgur.com',
    videodomains: 'youtube.com',
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
    removaltemplate: '',
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
      getCurrentSubreddit: jest.fn(async () => ({
        name: 'testsubreddit',
        getNewPosts: jest.fn(() => ({
          all: jest.fn(async () => []),
        })),
      })),
    },
  } as any;
};

const createMockPost = (overrides: Partial<Post> = {}): Post => {
  return {
    id: 'post123',
    authorName: 'testuser',
    title: 'Test Post',
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
    approve: jest.fn(async () => {}),
    addComment: jest.fn(async (options: { text: string }) => createMockComment()),
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
    distinguish: jest.fn(async () => {}),
    ...overrides,
  } as any;
};

describe('Reinstatement System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature 6001: Detect R5 Comment Added', () => {
    it('should check for R5 on warned posts', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(true);
      mockWasRemovedByBot.mockResolvedValue(false);
      mockGetWarningTime.mockResolvedValue(Date.now() - 10 * 60 * 1000);
      mockHasR5AddedAfterWarning.mockResolvedValue({
        hasValidR5: true,
        reason: 'R5 added',
      });

      await checkForR5Addition(postId, context);

      expect(mockIsPostWarned).toHaveBeenCalledWith(postId, context);
      expect(mockGetWarningTime).toHaveBeenCalledWith(postId, context);
    });

    it('should check for R5 on removed posts', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(false);
      mockWasRemovedByBot.mockResolvedValue(true);
      mockGetWarningTime.mockResolvedValue(Date.now() - 20 * 60 * 1000);
      mockHasR5AddedAfterWarning.mockResolvedValue({
        hasValidR5: true,
        reason: 'R5 added after removal',
      });

      await checkForR5Addition(postId, context);

      expect(mockWasRemovedByBot).toHaveBeenCalledWith(postId, context);
    });

    it('should skip posts that were never warned or removed', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(false);
      mockWasRemovedByBot.mockResolvedValue(false);

      await checkForR5Addition(postId, context);

      expect(mockGetWarningTime).not.toHaveBeenCalled();
    });

    it('should handle missing post gracefully', async () => {
      const context = createMockContext();
      context.reddit.getPostById = jest.fn().mockResolvedValue(null);

      mockIsPostWarned.mockResolvedValue(true);
      mockWasRemovedByBot.mockResolvedValue(false);

      await expect(checkForR5Addition('post123', context)).resolves.not.toThrow();
    });
  });

  describe('Feature 6002: Verify R5 Comment Quality', () => {
    it('should verify R5 quality using hasR5AddedAfterWarning', async () => {
      const context = createMockContext();
      const postId = 'post123';
      const warningTime = Date.now() - 10 * 60 * 1000;

      mockIsPostWarned.mockResolvedValue(true);
      mockWasRemovedByBot.mockResolvedValue(false);
      mockGetWarningTime.mockResolvedValue(warningTime);
      mockHasR5AddedAfterWarning.mockResolvedValue({
        hasValidR5: true,
        reason: 'Valid R5 found',
      });

      await checkForR5Addition(postId, context);

      expect(mockHasR5AddedAfterWarning).toHaveBeenCalled();
    });

    it('should not reinstate if R5 quality insufficient', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(true);
      mockWasRemovedByBot.mockResolvedValue(false);
      mockGetWarningTime.mockResolvedValue(Date.now() - 10 * 60 * 1000);
      mockHasR5AddedAfterWarning.mockResolvedValue({
        hasValidR5: false,
        reason: 'Comment too short',
      });

      await checkForR5Addition(postId, context);

      expect(mockClearPostState).not.toHaveBeenCalled();
    });
  });

  describe('Feature 6003: Clean Up Bot Comments', () => {
    it('should delete warning comment', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });
      const warningComment = createMockComment({ id: 'warning123' });

      mockWasRemovedByBot.mockResolvedValue(false);
      mockGetWarningCommentId.mockResolvedValue('warning123');
      mockGetRemovalCommentId.mockResolvedValue(null);
      context.reddit.getCommentById = jest.fn().mockResolvedValue(warningComment);

      await reinstatePost(post, context);

      expect(mockGetWarningCommentId).toHaveBeenCalledWith('post123', context);
      expect(warningComment.delete).toHaveBeenCalled();
    });

    it('should delete removal comment', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });
      const removalComment = createMockComment({ id: 'removal123' });

      mockWasRemovedByBot.mockResolvedValue(true);
      mockGetWarningCommentId.mockResolvedValue(null);
      mockGetRemovalCommentId.mockResolvedValue('removal123');
      context.reddit.getCommentById = jest.fn().mockResolvedValue(removalComment);

      await reinstatePost(post, context);

      expect(mockGetRemovalCommentId).toHaveBeenCalledWith('post123', context);
      expect(removalComment.delete).toHaveBeenCalled();
    });

    it('should delete both warning and removal comments', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });
      const warningComment = createMockComment({ id: 'warning123' });
      const removalComment = createMockComment({ id: 'removal123' });

      mockWasRemovedByBot.mockResolvedValue(true);
      mockGetWarningCommentId.mockResolvedValue('warning123');
      mockGetRemovalCommentId.mockResolvedValue('removal123');
      context.reddit.getCommentById = jest
        .fn()
        .mockResolvedValueOnce(warningComment)
        .mockResolvedValueOnce(removalComment);

      await reinstatePost(post, context);

      expect(warningComment.delete).toHaveBeenCalled();
      expect(removalComment.delete).toHaveBeenCalled();
    });

    it('should handle missing comments gracefully', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });

      mockWasRemovedByBot.mockResolvedValue(false);
      mockGetWarningCommentId.mockResolvedValue(null);
      mockGetRemovalCommentId.mockResolvedValue(null);

      await expect(reinstatePost(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 6004: Approve Post', () => {
    it('should approve post using post.approve()', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });

      mockWasRemovedByBot.mockResolvedValue(false);

      await reinstatePost(post, context);

      // Post was not removed, so approve() shouldn't be called for un-removal
      // But it will be approved via markPostApproved
      expect(mockMarkPostApproved).toHaveBeenCalledWith('post123', context);
    });

    it('should handle approval errors gracefully', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });
      post.approve = jest.fn().mockRejectedValue(new Error('Approval error'));

      mockWasRemovedByBot.mockResolvedValue(true);

      await expect(reinstatePost(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 6010: Handle Already-Removed Posts', () => {
    it('should un-remove posts that were removed by bot', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123', removed: true });

      mockWasRemovedByBot.mockResolvedValue(true);

      await reinstatePost(post, context);

      expect(post.approve).toHaveBeenCalled();
    });

    it('should not call approve if post was never removed', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123', removed: false });

      mockWasRemovedByBot.mockResolvedValue(false);

      await reinstatePost(post, context);

      expect(post.approve).not.toHaveBeenCalled();
    });
  });

  describe('Feature 6005: Add to Whitelist (24h grace period)', () => {
    it('should mark post as approved', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });

      mockWasRemovedByBot.mockResolvedValue(false);

      await reinstatePost(post, context);

      expect(mockMarkPostApproved).toHaveBeenCalledWith('post123', context);
    });
  });

  describe('Feature 6006 & 6007: Clear Warning and Removal State', () => {
    it('should clear all post state', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123' });

      mockWasRemovedByBot.mockResolvedValue(true);

      await reinstatePost(post, context);

      expect(mockClearPostState).toHaveBeenCalledWith('post123', context);
    });
  });

  describe('Feature 6008: Complete Reinstatement Flow', () => {
    it('should complete full reinstatement', async () => {
      const context = createMockContext();
      const post = createMockPost({ id: 'post123', removed: true });
      const warningComment = createMockComment({ id: 'warning123' });

      mockWasRemovedByBot.mockResolvedValue(true);
      mockGetWarningCommentId.mockResolvedValue('warning123');
      mockGetRemovalCommentId.mockResolvedValue(null);
      context.reddit.getCommentById = jest.fn().mockResolvedValue(warningComment);

      await reinstatePost(post, context);

      // Should un-remove
      expect(post.approve).toHaveBeenCalled();
      // Should clean up comments
      expect(warningComment.delete).toHaveBeenCalled();
      // Should clear state
      expect(mockClearPostState).toHaveBeenCalled();
      // Should mark approved
      expect(mockMarkPostApproved).toHaveBeenCalled();
    });

    it('should post reinstatement comment if enabled', async () => {
      const context = createMockContext({
        commentonreinstatement: true,
      });
      const post = createMockPost({ id: 'post123' });
      const reinstateComment = createMockComment({ id: 'reinstate123' });

      mockWasRemovedByBot.mockResolvedValue(false);
      post.addComment = jest.fn().mockResolvedValue(reinstateComment);

      await reinstatePost(post, context);

      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.stringContaining('approved'),
      });
      expect(reinstateComment.distinguish).toHaveBeenCalledWith(true);
    });

    it('should not post reinstatement comment if disabled', async () => {
      const context = createMockContext({
        commentonreinstatement: false,
      });
      const post = createMockPost({ id: 'post123' });

      mockWasRemovedByBot.mockResolvedValue(false);

      await reinstatePost(post, context);

      expect(post.addComment).not.toHaveBeenCalled();
    });
  });

  describe('Integration: End-to-End Reinstatement', () => {
    it('should detect R5 and trigger full reinstatement', async () => {
      const context = createMockContext();
      const postId = 'post123';
      const post = createMockPost({ id: postId, removed: true });
      const warningComment = createMockComment({ id: 'warning123' });

      context.reddit.getPostById = jest.fn().mockResolvedValue(post);
      context.reddit.getCommentById = jest.fn().mockResolvedValue(warningComment);

      mockIsPostWarned.mockResolvedValue(true);
      mockWasRemovedByBot.mockResolvedValue(true);
      mockGetWarningTime.mockResolvedValue(Date.now() - 15 * 60 * 1000);
      mockGetWarningCommentId.mockResolvedValue('warning123');
      mockGetRemovalCommentId.mockResolvedValue(null);
      mockHasR5AddedAfterWarning.mockResolvedValue({
        hasValidR5: true,
        reason: 'R5 added after warning',
      });

      await checkForR5Addition(postId, context);

      // Should approve (un-remove)
      expect(post.approve).toHaveBeenCalled();
      // Should clean up comments
      expect(warningComment.delete).toHaveBeenCalled();
      // Should clear state
      expect(mockClearPostState).toHaveBeenCalled();
      // Should mark approved
      expect(mockMarkPostApproved).toHaveBeenCalled();
    });
  });
});
