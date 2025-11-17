/**
 * Unit tests for modmail handler
 * Features: 7001-7010
 */

import { onModMail } from '../../src/handlers/modMailHandler';
import { wasRemovedByBot } from '../../src/storage/postState';
import { hasValidR5Comment } from '../../src/services/commentValidation';
import { reinstatePost } from '../../src/services/reinstatementSystem';
import type { Post } from '@devvit/public-api';
import type { BotSettings } from '../../src/types';

// Mock the dependencies
jest.mock('../../src/storage/postState');
jest.mock('../../src/services/commentValidation');
jest.mock('../../src/services/reinstatementSystem');

const mockWasRemovedByBot = wasRemovedByBot as jest.MockedFunction<typeof wasRemovedByBot>;
const mockHasValidR5Comment = hasValidR5Comment as jest.MockedFunction<typeof hasValidR5Comment>;
const mockReinstatePost = reinstatePost as jest.MockedFunction<typeof reinstatePost>;

// Create mock context
const createMockContext = (settingsOverride: Partial<BotSettings> = {}) => {
  const defaultSettings: BotSettings = {
    enforcedposttypes: ['image'],
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
    modmailkeywords: 'rule 5,r5,rule5',
    enforcedflairs: '',
    excludedflairs: '',
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

  const mockConversation = {
    conversation: {
      id: 'convo123',
      subject: 'Rule 5 Reinstatement Request',
    },
    messages: [
      {
        id: 'msg456',
        bodyMarkdown: 'Please reinstate my post: https://reddit.com/r/test/comments/post123/test',
        author: {
          name: 'testuser',
        },
      },
    ],
  };

  return {
    settings: {
      getAll: jest.fn(async () => ({ ...defaultSettings, ...settingsOverride })),
    },
    reddit: {
      getPostById: jest.fn(async (id: string) => createMockPost({ id })),
      modMail: {
        getConversation: jest.fn(async () => mockConversation),
        reply: jest.fn(async () => {}),
        archiveConversation: jest.fn(async () => {}),
      },
    },
  } as any;
};

const createMockPost = (overrides: Partial<Post> = {}): Post => {
  return {
    id: 'post123',
    authorName: 'testuser',
    title: 'Test Post',
    permalink: '/r/test/comments/post123/test',
    removed: false,
    ...overrides,
  } as any;
};

const createMockModMail = (overrides: any = {}) => {
  return {
    conversationId: 'convo123',
    messageId: 'msg456',
    ...overrides,
  };
};

describe('ModMail Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature 7001: Monitor Modmail for R5 Subjects', () => {
    it('should process modmail with R5 keywords', async () => {
      const context = createMockContext();
      const event = createMockModMail();

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid R5' });

      await onModMail(event as any, context);

      expect(mockReinstatePost).toHaveBeenCalled();
    });

    it('should skip modmail without R5 keywords', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({ subject: 'General Question' });
      const event = { modMail: modmail };

      await onModMail(event as any, context);

      expect(mockReinstatePost).not.toHaveBeenCalled();
    });

    it('should handle various R5 keyword formats', async () => {
      const context = createMockContext();
      const keywords = ['Rule 5', 'r5', 'rule5', 'RULE 5', 'R5'];

      for (const keyword of keywords) {
        const modmail = createMockModMail({ subject: `Request: ${keyword}` });
        const event = { modMail: modmail };

        mockWasRemovedByBot.mockResolvedValue(true);
        mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

        await onModMail(event as any, context);
      }

      expect(mockReinstatePost).toHaveBeenCalledTimes(keywords.length);
    });

    it('should skip if modmail processing disabled', async () => {
      const context = createMockContext({ enablemodmail: false });
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      await onModMail(event as any, context);

      expect(mockReinstatePost).not.toHaveBeenCalled();
    });
  });

  describe('Feature 7002: Extract Post ID from Modmail Body', () => {
    it('should extract from full Reddit URL', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({
        bodyMarkdown: 'My post: https://reddit.com/r/paradoxplaza/comments/abc123/my_post',
      });
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(context.reddit.getPostById).toHaveBeenCalledWith('abc123');
    });

    it('should extract from short Reddit URL', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({
        bodyMarkdown: 'Please check https://redd.it/xyz789',
      });
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(context.reddit.getPostById).toHaveBeenCalledWith('xyz789');
    });

    it('should extract from plain post ID', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({
        bodyMarkdown: 'Post ID: abc123',
      });
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(context.reddit.getPostById).toHaveBeenCalledWith('abc123');
    });

    it('should reply with error if no post ID found', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({
        bodyMarkdown: 'Please help me!',
      });
      const event = { modMail: modmail };

      await onModMail(event as any, context);

      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('Could not find a valid post ID'),
        isInternal: false,
      });
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });
  });

  describe('Feature 7003: Verify Author Matches', () => {
    it('should allow author to request reinstatement of own post', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      context.reddit.getPostById = jest.fn().mockResolvedValue(
        createMockPost({ authorName: 'testuser' })
      );

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(mockReinstatePost).toHaveBeenCalled();
    });

    it('should reject if authors do not match', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({ author: { name: 'differentuser' } });
      const event = { modMail: modmail };

      context.reddit.getPostById = jest.fn().mockResolvedValue(
        createMockPost({ authorName: 'testuser' })
      );

      await onModMail(event as any, context);

      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('only request reinstatement for your own posts'),
        isInternal: false,
      });
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });

    it('should be case insensitive', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({ author: { name: 'TestUser' } });
      const event = { modMail: modmail };

      context.reddit.getPostById = jest.fn().mockResolvedValue(
        createMockPost({ authorName: 'testuser' })
      );

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(mockReinstatePost).toHaveBeenCalled();
    });
  });

  describe('Feature 7004: Check If Bot Removed Post', () => {
    it('should process if post was removed by bot', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(mockReinstatePost).toHaveBeenCalled();
    });

    it('should reply if post is already approved', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(false);
      context.reddit.getPostById = jest.fn().mockResolvedValue(
        createMockPost({ removed: false })
      );

      await onModMail(event as any, context);

      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('already approved'),
        isInternal: false,
      });
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });

    it('SECURITY: should reject if post was removed by human moderator', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      // Bot didn't remove it
      mockWasRemovedByBot.mockResolvedValue(false);
      // But post is removed (by human mod)
      context.reddit.getPostById = jest.fn().mockResolvedValue(
        createMockPost({ removed: true })
      );

      await onModMail(event as any, context);

      // Should reject with appropriate message
      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('not removed by the bot'),
        isInternal: false,
      });
      // Should NOT reinstate
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });

    it('SECURITY: should not approve posts removed by other moderators even with valid R5', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      // Bot didn't remove it
      mockWasRemovedByBot.mockResolvedValue(false);
      // Post was removed by human mod
      context.reddit.getPostById = jest.fn().mockResolvedValue(
        createMockPost({ removed: true })
      );
      // User has valid R5 (shouldn't matter!)
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      // Should reject before even checking R5
      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('not removed by the bot'),
        isInternal: false,
      });
      // Should NOT reinstate (respects human mod decision)
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });
  });

  describe('Feature 7005: Verify R5 Comment Exists', () => {
    it('should reinstate if valid R5 exists', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({
        hasValidR5: true,
        reason: 'Valid R5 comment found',
      });

      await onModMail(event as any, context);

      expect(mockReinstatePost).toHaveBeenCalled();
    });

    it('should reject if no valid R5', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({
        hasValidR5: false,
        reason: 'Comment too short',
      });

      await onModMail(event as any, context);

      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('No valid Rule 5 comment'),
        isInternal: false,
      });
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });
  });

  describe('Feature 7006: Approve Post via Modmail Request', () => {
    it('should call reinstatePost', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(mockReinstatePost).toHaveBeenCalled();
    });
  });

  describe('Feature 7007: Reply to Modmail', () => {
    it('should send success reply on reinstatement', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('reinstated successfully'),
        isInternal: false,
      });
    });

    it('should send error reply on failure', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({ bodyMarkdown: 'no post id here' });
      const event = { modMail: modmail };

      await onModMail(event as any, context);

      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('Unable to process'),
        isInternal: false,
      });
    });
  });

  describe('Feature 7008: Archive Modmail Conversation', () => {
    it('should archive on successful reinstatement', async () => {
      const context = createMockContext({ autoarchivemodmail: true });
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(modmail.archive).toHaveBeenCalled();
    });

    it('should not archive if setting disabled', async () => {
      const context = createMockContext({ autoarchivemodmail: false });
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      expect(modmail.archive).not.toHaveBeenCalled();
    });

    it('should not archive on error', async () => {
      const context = createMockContext();
      const modmail = createMockModMail({ bodyMarkdown: 'no post link here' });
      const event = { modMail: modmail };

      await onModMail(event as any, context);

      expect(modmail.archive).not.toHaveBeenCalled();
    });
  });

  describe('Feature 7009 & 7010: Complete Flow', () => {
    it('should handle complete successful flow', async () => {
      const context = createMockContext();
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      mockWasRemovedByBot.mockResolvedValue(true);
      mockHasValidR5Comment.mockResolvedValue({ hasValidR5: true, reason: 'Valid' });

      await onModMail(event as any, context);

      // Should extract post ID
      expect(context.reddit.getPostById).toHaveBeenCalled();
      // Should verify author
      // Should check removal
      expect(mockWasRemovedByBot).toHaveBeenCalled();
      // Should verify R5
      expect(mockHasValidR5Comment).toHaveBeenCalled();
      // Should reinstate
      expect(mockReinstatePost).toHaveBeenCalled();
      // Should reply
      expect(modmail.reply).toHaveBeenCalled();
      // Should archive
      expect(modmail.archive).toHaveBeenCalled();
    });

    it('should handle post not found', async () => {
      const context = createMockContext();
      context.reddit.getPostById = jest.fn().mockResolvedValue(null);
      const modmail = createMockModMail();
      const event = { modMail: modmail };

      await onModMail(event as any, context);

      expect(modmail.reply).toHaveBeenCalledWith({
        body: expect.stringContaining('Post not found'),
        isInternal: false,
      });
    });
  });
});
