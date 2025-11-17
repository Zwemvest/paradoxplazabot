/**
 * Unit tests for warning system
 * Features: 4001-4008
 */

import { scheduleGracePeriodCheck, checkWarning, issueWarning, getWarningCommentId } from '../../src/services/warningSystem';
import { isPostWarned, markPostWarned } from '../../src/storage/postState';
import type { Post } from '@devvit/public-api';
import type { BotSettings } from '../../src/types';

// Mock the dependencies
jest.mock('../../src/storage/postState');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/postValidation');
jest.mock('../../src/utils/logger');

const mockIsPostWarned = isPostWarned as jest.MockedFunction<typeof isPostWarned>;
const mockMarkPostWarned = markPostWarned as jest.MockedFunction<typeof markPostWarned>;

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
    warningtemplate: 'Hello {{author}}, your post "{{postTitle}}" needs R5. Add it within {{warningMinutes}} minutes.',
    removaltemplate: '',
    reportreasontooshort: '',
    reportreasonnor5: '',
    notificationtemplate: '',
  };

  const scheduledJobs: any[] = [];
  const comments: any[] = [];

  return {
    settings: {
      getAll: jest.fn(async () => ({ ...defaultSettings, ...settingsOverride })),
    },
    scheduler: {
      runJob: jest.fn(async (job: any) => {
        scheduledJobs.push(job);
      }),
    },
    reddit: {
      getPostById: jest.fn(async (id: string) => {
        return createMockPost({ id });
      }),
    },
    _scheduledJobs: scheduledJobs,
    _comments: comments,
  } as any;
};

const createMockPost = (overrides: Partial<Post> = {}): Post => {
  const mockComment = {
    id: 'comment123',
    distinguish: jest.fn(async (asModerator: boolean) => {}),
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
    addComment: jest.fn(async (options: { text: string }) => {
      return mockComment;
    }),
    ...overrides,
  } as any;
};

describe('Warning System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature 4001: Grace Period Tracking', () => {
    it('should schedule a warning check after grace period', async () => {
      const context = createMockContext({ graceperiod: 5 });
      const postId = 'post123';

      await scheduleGracePeriodCheck(postId, context);

      expect(context.scheduler.runJob).toHaveBeenCalledTimes(1);
      const job = context._scheduledJobs[0];
      expect(job.name).toBe('checkWarning');
      expect(job.data.postId).toBe(postId);
      expect(job.runAt).toBeInstanceOf(Date);

      // Check that runAt is approximately 5 minutes from now
      const expectedTime = Date.now() + 5 * 60 * 1000;
      const actualTime = job.runAt.getTime();
      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(1000); // Within 1 second
    });

    it('should use custom grace period from settings', async () => {
      const context = createMockContext({ graceperiod: 10 });
      const postId = 'post123';

      await scheduleGracePeriodCheck(postId, context);

      const job = context._scheduledJobs[0];
      const expectedTime = Date.now() + 10 * 60 * 1000;
      const actualTime = job.runAt.getTime();
      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(1000);
    });

    it('should not throw on scheduler errors', async () => {
      const context = createMockContext();
      context.scheduler.runJob = jest.fn().mockRejectedValue(new Error('Scheduler error'));

      await expect(scheduleGracePeriodCheck('post123', context)).resolves.not.toThrow();
    });
  });

  describe('Feature 4002: Schedule Warning Check', () => {
    it('should check warning and issue if post still needs enforcement', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(false);

      // Mock validation to say it needs enforcement
      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: true, reason: 'Image post' });

      await checkWarning(postId, context);

      expect(context.reddit.getPostById).toHaveBeenCalledWith(postId);
      expect(mockIsPostWarned).toHaveBeenCalledWith(postId, context);
    });

    it('should skip if post not found', async () => {
      const context = createMockContext();
      context.reddit.getPostById = jest.fn().mockResolvedValue(null);

      await checkWarning('post123', context);

      expect(mockIsPostWarned).not.toHaveBeenCalled();
    });

    it('should not throw on errors', async () => {
      const context = createMockContext();
      context.reddit.getPostById = jest.fn().mockRejectedValue(new Error('Reddit API error'));

      await expect(checkWarning('post123', context)).resolves.not.toThrow();
    });
  });

  describe('Feature 4003 & 4008: Check if Already Warned / Prevent Duplicate Warnings', () => {
    it('should skip if post already warned', async () => {
      const context = createMockContext();
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(true);

      await checkWarning(postId, context);

      // Should not try to issue warning
      expect(context.reddit.getPostById).toHaveBeenCalled();
      expect(mockMarkPostWarned).not.toHaveBeenCalled();
    });

    it('should not post duplicate warning even if called twice', async () => {
      const context = createMockContext();
      const post = createMockPost();

      mockIsPostWarned.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await issueWarning(post, context);
      await issueWarning(post, context);

      // Only marked once
      expect(mockMarkPostWarned).toHaveBeenCalledTimes(1);
    });
  });

  describe('Feature 4004: Generate Warning Message', () => {
    it('should generate warning message from template', async () => {
      const context = createMockContext({
        warningtemplate: 'Hello {{author}}, your post "{{postTitle}}" needs R5.',
      });
      const post = createMockPost({
        authorName: 'testuser',
        title: 'My Test Post',
      });

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.stringContaining('Hello testuser'),
      });
      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.stringContaining('My Test Post'),
      });
    });

    it('should substitute all template variables', async () => {
      const context = createMockContext({
        warningtemplate: '{{author}} - {{postTitle}} - {{warningMinutes}} - {{postUrl}}',
        warningperiod: 15,
      });
      const post = createMockPost({
        authorName: 'user123',
        title: 'Title Here',
        permalink: '/r/test/comments/abc',
      });

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(post.addComment).toHaveBeenCalledWith({
        text: 'user123 - Title Here - 15 - https://reddit.com/r/test/comments/abc',
      });
    });

    it('should use default template if none provided', async () => {
      const context = createMockContext({
        warningtemplate: '',
      });
      const post = createMockPost();

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.stringContaining('Rule 5'),
      });
    });
  });

  describe('Feature 4005: Post Warning Comment', () => {
    it('should post warning comment to post', async () => {
      const context = createMockContext();
      const post = createMockPost();

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(post.addComment).toHaveBeenCalledTimes(1);
      expect(post.addComment).toHaveBeenCalledWith({
        text: expect.any(String),
      });
    });

    it('should not post comment if commentonwarning is false', async () => {
      const context = createMockContext({
        commentonwarning: false,
      });
      const post = createMockPost();

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(post.addComment).not.toHaveBeenCalled();
      // But should still mark as warned
      expect(mockMarkPostWarned).toHaveBeenCalledWith('post123', context);
    });

    it('should handle comment posting errors gracefully', async () => {
      const context = createMockContext();
      const post = createMockPost();
      post.addComment = jest.fn().mockRejectedValue(new Error('Comment API error'));

      mockIsPostWarned.mockResolvedValue(false);

      await expect(issueWarning(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 4006: Distinguish Comment as Moderator', () => {
    it('should distinguish warning comment', async () => {
      const context = createMockContext();
      const post = createMockPost();
      const mockComment = {
        id: 'comment123',
        distinguish: jest.fn(async () => {}),
      };
      post.addComment = jest.fn().mockResolvedValue(mockComment);

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(mockComment.distinguish).toHaveBeenCalledWith(true);
    });

    it('should handle distinguish errors gracefully', async () => {
      const context = createMockContext();
      const post = createMockPost();
      const mockComment = {
        id: 'comment123',
        distinguish: jest.fn().mockRejectedValue(new Error('Distinguish error')),
      };
      post.addComment = jest.fn().mockResolvedValue(mockComment);

      mockIsPostWarned.mockResolvedValue(false);

      await expect(issueWarning(post, context)).resolves.not.toThrow();
    });
  });

  describe('Feature 4007: Track Warning State', () => {
    it('should mark post as warned with comment ID', async () => {
      const context = createMockContext();
      const post = createMockPost();
      const mockComment = {
        id: 'comment123',
        distinguish: jest.fn(async () => {}),
      };
      post.addComment = jest.fn().mockResolvedValue(mockComment);

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(mockMarkPostWarned).toHaveBeenCalledWith('post123', context, 'comment123');
    });

    it('should mark as warned even if comment posting disabled', async () => {
      const context = createMockContext({
        commentonwarning: false,
      });
      const post = createMockPost();

      mockIsPostWarned.mockResolvedValue(false);

      await issueWarning(post, context);

      expect(mockMarkPostWarned).toHaveBeenCalledWith('post123', context);
    });
  });

  describe('Integration: Complete Warning Flow', () => {
    it('should complete full warning flow and schedule removal', async () => {
      const context = createMockContext({
        graceperiod: 5,
        warningperiod: 10,
        enforcementaction: 'remove',
      });
      const postId = 'post123';
      const post = createMockPost({ id: postId });

      mockIsPostWarned.mockResolvedValue(false);

      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: true, reason: 'Image post' });

      // Schedule grace period
      await scheduleGracePeriodCheck(postId, context);

      expect(context._scheduledJobs.length).toBe(1);
      expect(context._scheduledJobs[0].name).toBe('checkWarning');

      // Run warning check
      await checkWarning(postId, context);

      // Should have scheduled removal check
      expect(context._scheduledJobs.length).toBe(2);
      expect(context._scheduledJobs[1].name).toBe('checkRemoval');

      // Check removal scheduled for warningperiod minutes from now
      const removalJob = context._scheduledJobs[1];
      const expectedTime = Date.now() + 10 * 60 * 1000;
      const actualTime = removalJob.runAt.getTime();
      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(1000);
    });

    it('should not schedule removal if enforcement action is report', async () => {
      const context = createMockContext({
        enforcementaction: 'report',
      });
      const postId = 'post123';

      mockIsPostWarned.mockResolvedValue(false);

      const { shouldEnforceRule5 } = require('../../src/services/postValidation');
      shouldEnforceRule5.mockResolvedValue({ shouldEnforce: true, reason: 'Image post' });

      await checkWarning(postId, context);

      // Should only have warning, no removal scheduled
      expect(context._scheduledJobs.length).toBe(0);
    });
  });
});
