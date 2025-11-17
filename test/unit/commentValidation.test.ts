/**
 * Unit tests for comment validation service
 * Features: 3001, 3002, 3005, 3007, 3008, 3009, 3011
 */

import { hasValidR5Comment, hasR5AddedAfterWarning, hasAuthorComment } from '../../src/services/commentValidation';
import type { Post, Comment } from '@devvit/public-api';
import type { BotSettings } from '../../src/types';

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
      getCurrentUser: jest.fn(async () => ({ username: 'ParadoxPlazaBot' })),
    },
  } as any;
};

const createMockPost = (overrides: Partial<Post> = {}, mockComments: Comment[] = []): Post => {
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
    comments: {
      all: jest.fn(async () => mockComments),
    },
    ...overrides,
  } as any;
};

const createMockComment = (overrides: Partial<Comment> = {}): Comment => {
  return {
    id: 'comment123',
    authorName: 'testuser',
    body: 'This is a test comment with more than 50 characters to meet the minimum length requirement.',
    createdAt: new Date(),
    parentId: 'post123',
    ...overrides,
  } as any;
};

describe('Comment Validation Service', () => {
  describe('Feature 3001: R5 Comment Detection Logic', () => {
    it('should detect valid R5 comment', async () => {
      const comment = createMockComment({
        body: 'This is my Rule 5 explanation with sufficient length and context about the game.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
      expect(result.reason).toBe('Valid R5 comment found');
      expect(result.comment).toBeDefined();
    });

    it('should return false if no comments', async () => {
      const post = createMockPost({}, []);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toBe('No comments found');
    });

    it('should return false if no author comments', async () => {
      const comment = createMockComment({
        authorName: 'someoneelse',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toBe('No author comments found');
    });

    it('should handle errors gracefully', async () => {
      const post = createMockPost();
      post.comments.all = jest.fn().mockRejectedValue(new Error('Reddit API error'));
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toContain('error');
    });
  });

  describe('Feature 3002: Minimum Comment Length Check', () => {
    it('should pass comments meeting minimum length', async () => {
      const comment = createMockComment({
        body: 'This comment has exactly fifty characters here!',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({ mincommentlength: 50 });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });

    it('should fail comments below minimum length', async () => {
      const comment = createMockComment({
        body: 'Too short',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({ mincommentlength: 50 });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should use custom minimum length from settings', async () => {
      const comment = createMockComment({
        body: 'This comment is 30 chars ok',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({ mincommentlength: 25 });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });
  });

  describe('Feature 3005: Keyword Pattern Matching', () => {
    it('should validate containsOne - must have at least one keyword', async () => {
      const comment = createMockComment({
        body: 'This is about a screenshot from Victoria 3 showing my economy stats.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5containsone: 'screenshot\nimage\nvideo',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });

    it('should fail containsOne if no keywords present', async () => {
      const comment = createMockComment({
        body: 'This is a comment without the required keywords in the list.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5containsone: 'screenshot\nimage\nvideo',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toContain('containsOne');
    });

    it('should validate containsAll - must have all keywords', async () => {
      const comment = createMockComment({
        body: 'This screenshot shows my game with detailed context about the situation.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5containsall: 'screenshot\ncontext',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });

    it('should fail containsAll if missing any keyword', async () => {
      const comment = createMockComment({
        body: 'This screenshot shows my game but without the other required word.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5containsall: 'screenshot\ncontext',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toContain('containsAll');
    });

    it('should validate startsWith - comment must start with keyword', async () => {
      const comment = createMockComment({
        body: 'R5: This is my explanation about the screenshot and why it is relevant.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5startswith: 'R5:\nRule 5:',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });

    it('should fail startsWith if comment does not start with keyword', async () => {
      const comment = createMockComment({
        body: 'This is my explanation about the screenshot. R5 is mentioned later.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5startswith: 'R5:\nRule 5:',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toContain('does not start');
    });

    it('should validate endsWith - comment must end with keyword', async () => {
      const comment = createMockComment({
        body: 'This is my explanation about the screenshot and context. Hope this helps!',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5endswith: 'Hope this helps!\nThanks!',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });

    it('should fail endsWith if comment does not end with keyword', async () => {
      const comment = createMockComment({
        body: 'This is my explanation. Thanks! But then I added more text.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5endswith: 'Thanks!',
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toContain('does not end');
    });

    it('should validate multiple rules together', async () => {
      const comment = createMockComment({
        body: 'R5: This screenshot shows context about my Victoria 3 game economy.',
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext({
        r5startswith: 'R5:',
        r5containsall: 'screenshot\ncontext',
        mincommentlength: 50,
      });

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });
  });

  describe('Feature 3007: Fetch Post Comments', () => {
    it('should fetch all comments when location is "both"', async () => {
      const topComment = createMockComment({ id: 'top1', parentId: 'post123' });
      const replyComment = createMockComment({ id: 'reply1', parentId: 'top1' });
      const post = createMockPost({}, [topComment, replyComment]);
      const context = createMockContext({ r5commentlocation: 'both' });

      await hasValidR5Comment(post, context);

      expect(post.comments.all).toHaveBeenCalled();
    });

    it('should filter to top-level comments when location is "top"', async () => {
      const topComment = createMockComment({
        id: 'top1',
        parentId: 'post123',
        body: 'Valid top level R5 comment with sufficient length and detail.',
      });
      const replyComment = createMockComment({
        id: 'reply1',
        parentId: 'top1',
        body: 'This is a reply comment with sufficient length but should be ignored.',
      });
      const post = createMockPost({}, [topComment, replyComment]);
      const context = createMockContext({ r5commentlocation: 'top' });

      const result = await hasValidR5Comment(post, context);

      // Should find the top-level comment
      expect(result.hasValidR5).toBe(true);
    });

    it('should handle empty comment list', async () => {
      const post = createMockPost({}, []);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toBe('No comments found');
    });
  });

  describe('Feature 3008: Find Author Comments', () => {
    it('should filter comments to only post author', async () => {
      const authorComment = createMockComment({
        authorName: 'testuser',
        body: 'This is my R5 explanation with sufficient detail and context.',
      });
      const otherComment = createMockComment({
        authorName: 'someoneelse',
        body: 'This is someone else comment with sufficient detail and context.',
      });
      const post = createMockPost({ authorName: 'testuser' }, [authorComment, otherComment]);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
      expect(result.comment?.authorName).toBe('testuser');
    });

    it('should be case insensitive for author matching', async () => {
      const authorComment = createMockComment({
        authorName: 'TestUser',
        body: 'This is my R5 explanation with sufficient detail and context.',
      });
      const post = createMockPost({ authorName: 'testuser' }, [authorComment]);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
    });

    it('should handle deleted author', async () => {
      const comment = createMockComment();
      const post = createMockPost({ authorName: undefined }, [comment]);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toBe('No author comments found');
    });
  });

  describe('Feature 3009: Ignore Bot Comments', () => {
    it('should ignore comments by the bot itself', async () => {
      const botComment = createMockComment({
        authorName: 'ParadoxPlazaBot',
        body: 'This is a bot warning comment with sufficient length and detail.',
      });
      const authorComment = createMockComment({
        authorName: 'testuser',
        body: 'This is the real R5 explanation with sufficient detail and context.',
      });
      const post = createMockPost({ authorName: 'testuser' }, [botComment, authorComment]);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
      expect(result.comment?.authorName).toBe('testuser');
    });

    it('should be case insensitive for bot name', async () => {
      const botComment = createMockComment({
        authorName: 'paradoxplazabot',
        body: 'This is a bot comment with sufficient length.',
      });
      const authorComment = createMockComment({
        authorName: 'testuser',
        body: 'This is the real R5 explanation with sufficient detail and context.',
      });
      const post = createMockPost({ authorName: 'testuser' }, [botComment, authorComment]);
      const context = createMockContext();

      const result = await hasValidR5Comment(post, context);

      expect(result.hasValidR5).toBe(true);
      expect(result.comment?.id).toBe(authorComment.id);
    });
  });

  describe('Feature 3011: Check R5 Added After Warning', () => {
    it('should detect R5 added after warning', async () => {
      const warningTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      const comment = createMockComment({
        body: 'This is my R5 explanation with sufficient detail and context.',
        createdAt: new Date(Date.now()), // Just now (after warning)
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext();

      const result = await hasR5AddedAfterWarning(post, warningTime, context);

      expect(result.hasValidR5).toBe(true);
      expect(result.reason).toContain('R5 added after warning');
    });

    it('should reject R5 that existed before warning', async () => {
      const warningTime = Date.now(); // Now
      const comment = createMockComment({
        body: 'This is my R5 explanation with sufficient detail and context.',
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (before warning)
      });
      const post = createMockPost({}, [comment]);
      const context = createMockContext();

      const result = await hasR5AddedAfterWarning(post, warningTime, context);

      expect(result.hasValidR5).toBe(false);
      expect(result.reason).toContain('before warning');
    });

    it('should handle no R5 comment at all', async () => {
      const warningTime = Date.now() - 5 * 60 * 1000;
      const post = createMockPost({}, []);
      const context = createMockContext();

      const result = await hasR5AddedAfterWarning(post, warningTime, context);

      expect(result.hasValidR5).toBe(false);
    });
  });

  describe('Helper: hasAuthorComment', () => {
    it('should return true if author has any comment', async () => {
      const comment = createMockComment({
        authorName: 'testuser',
        body: 'Short comment',
      });
      const post = createMockPost({ authorName: 'testuser' }, [comment]);
      const context = createMockContext();

      const result = await hasAuthorComment(post, context);

      expect(result).toBe(true);
    });

    it('should return false if no author comments', async () => {
      const comment = createMockComment({
        authorName: 'someoneelse',
      });
      const post = createMockPost({ authorName: 'testuser' }, [comment]);
      const context = createMockContext();

      const result = await hasAuthorComment(post, context);

      expect(result).toBe(false);
    });
  });
});
