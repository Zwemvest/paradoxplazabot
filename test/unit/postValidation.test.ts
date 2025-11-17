/**
 * Unit tests for post validation service
 * Features: 2001, 2002, 2004, 2005, 2010, 2011, 2013, 2014
 */

import { shouldEnforceRule5 } from '../../src/services/postValidation';
import type { Post } from '@devvit/public-api';
import type { BotSettings } from '../../src/types';

// Mock context with settings
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
    imagedomains: 'imgur.com\ni.redd.it\n.png\n.jpg',
    videodomains: 'youtube.com\nv.redd.it\n.mp4',
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
    reporttemplate: '',
    reportreason: '',
    modmailnopostid: '',
    modmailpostnotfound: '',
    modmailnotauthor: '',
    modmailnotbotremoval: '',
    modmailalreadyapproved: '',
    modmailnor5: '',
    modmailsuccess: '',
    modmailerror: '',
    reinstatementcomment: '',
  };

  const redisStore = new Map<string, { value: string; expiration?: Date }>();

  return {
    settings: {
      getAll: jest.fn(async () => ({ ...defaultSettings, ...settingsOverride })),
    },
    redis: {
      get: jest.fn(async (key: string) => {
        const item = redisStore.get(key);
        if (!item) return null;
        if (item.expiration && item.expiration < new Date()) {
          redisStore.delete(key);
          return null;
        }
        return item.value;
      }),
      set: jest.fn(async (key: string, value: string, options?: { expiration?: Date }) => {
        redisStore.set(key, { value, expiration: options?.expiration });
      }),
      del: jest.fn(async (key: string) => {
        redisStore.delete(key);
      }),
    },
  } as any;
};

const createMockPost = (overrides: Partial<Post> = {}): Post => {
  return {
    id: 'post123',
    authorName: 'testuser',
    createdAt: new Date(),
    score: 1,
    approved: false,
    removed: false,
    body: '', // New Devvit API uses 'body' for self text
    gallery: [], // New API uses gallery array
    url: 'https://i.imgur.com/test.jpg', // Default to external URL
    flair: { text: '' },
    ...overrides,
  } as Post;
};

describe('Post Validation Service', () => {
  describe('Feature 2013: Recently Approved Check', () => {
    it('should skip recently approved posts', async () => {
      const context = createMockContext();
      const post = createMockPost({ url: 'https://i.imgur.com/test.jpg' });

      // Mark as approved 1 hour ago
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      await context.redis.set('approved:post123', oneHourAgo.toString(), {
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toContain('Recently approved');
    });

    it('should not skip posts approved >24h ago', async () => {
      const context = createMockContext();
      const post = createMockPost({ url: 'https://i.imgur.com/test.jpg' });

      // Mark as approved 25 hours ago
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      await context.redis.set('approved:post123', twentyFiveHoursAgo.toString(), {
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true); // Should enforce (image post)
    });
  });

  describe('Feature 2001: Post Type Enforcement', () => {
    it('should enforce on image posts', async () => {
      const context = createMockContext();
      const post = createMockPost({ url: 'https://i.imgur.com/test.jpg' });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
      expect(result.reason).toBe('Image post');
    });

    it('should enforce on gallery posts', async () => {
      const context = createMockContext();
      const post = createMockPost({
        gallery: [{ mediaId: 'img1' }, { mediaId: 'img2' }],
        url: 'https://reddit.com/gallery/abc123'
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
      expect(result.reason).toBe('Image gallery');
    });

    it('should enforce on video posts', async () => {
      const context = createMockContext({
        enforcedposttypes: ['video'],
      });
      const post = createMockPost({
        url: 'https://v.redd.it/abc123'
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
      expect(result.reason).toBe('Video post');
    });

    it('should enforce on text posts with image URLs', async () => {
      const context = createMockContext();
      const post = createMockPost({
        body: 'Check out this screenshot: https://i.redd.it/abc123.png',
        url: 'https://reddit.com/r/test/comments/abc123'
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
      expect(result.reason).toBe('Text post with image URL');
    });

    it('should enforce on link posts to images', async () => {
      const context = createMockContext();
      const post = createMockPost({
        url: 'https://imgur.com/abc123',
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
      // imgur.com URLs are treated as image posts (not link posts)
      expect(result.reason).toBe('Image post');
    });

    it('should not enforce on text posts without enforced content', async () => {
      const context = createMockContext();
      const post = createMockPost({
        body: 'Just a discussion about the game',
        url: 'https://reddit.com/r/test/comments/abc123'
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Post type not enforced');
    });
  });

  describe('Feature 2004: Flair-Based Rules', () => {
    it('should skip posts with excluded flairs', async () => {
      const context = createMockContext();
      const post = createMockPost({
        url: 'https://i.imgur.com/test.jpg', // Would normally be enforced
        flair: { text: 'Art' },
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Flair excluded');
    });

    it('should enforce posts with enforced flairs', async () => {
      const context = createMockContext({
        enforcedflairs: 'screenshot,gameplay',
      });
      const post = createMockPost({
        body: 'Just text', // Would normally not be enforced
        url: 'https://reddit.com/r/test/comments/abc123',
        flair: { text: 'Screenshot' },
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
      expect(result.reason).toBe('Flair enforced');
    });

    it('should prioritize excluded flair over enforced flair', async () => {
      const context = createMockContext({
        enforcedflairs: 'screenshot',
        excludedflairs: 'art,comic',
      });
      const post = createMockPost({
        flair: { text: 'Comic Art' },
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Flair excluded');
    });
  });

  describe('Feature 2005: Allowed Users', () => {
    it('should skip allowlisted users', async () => {
      const context = createMockContext({
        allowlistedusers: 'automod,trusteduser,artist',
      });
      const post = createMockPost({
        authorName: 'trusteduser',
        url: 'https://i.imgur.com/test.jpg',
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Allowed user');
    });

    it('should be case insensitive', async () => {
      const context = createMockContext({
        allowlistedusers: 'TrustedUser',
      });
      const post = createMockPost({
        authorName: 'trusteduser',
        url: 'https://i.imgur.com/test.jpg',
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
    });
  });

  describe('Feature 2010: Moderator Approval Check', () => {
    it('should skip moderator-approved posts', async () => {
      const context = createMockContext({
        respectmodapprovals: true,
      });
      const post = createMockPost({
        url: 'https://i.imgur.com/test.jpg',
        approved: true,
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Moderator approved');
    });

    it('should enforce on approved posts if setting disabled', async () => {
      const context = createMockContext({
        respectmodapprovals: false,
      });
      const post = createMockPost({
        url: 'https://i.imgur.com/test.jpg',
        approved: true,
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
    });
  });

  describe('Feature 2011: Moderator Removal Check', () => {
    it('should skip moderator-removed posts', async () => {
      const context = createMockContext({
        skipmodremoved: true,
      });
      const post = createMockPost({
        url: 'https://i.imgur.com/test.jpg',
        removed: true,
      });

      // Don't mark as removed by bot
      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Moderator removed');
    });

    it('should enforce on bot-removed posts', async () => {
      const context = createMockContext();
      const post = createMockPost({
        url: 'https://i.imgur.com/test.jpg',
        removed: true,
      });

      // Mark as removed by bot
      await context.redis.set('removed:post123', Date.now().toString(), {
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(true);
    });
  });

  describe('Exclusion Rules Priority', () => {
    it('should skip if skip keywords present (highest priority)', async () => {
      const context = createMockContext({
        skipkeywords: 'discussion\nquestion\nannouncement',
      });
      const post = createMockPost({
        body: 'This is a discussion about the game',
        url: 'https://reddit.com/r/test/comments/abc123', // Self post
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Contains skip keyword');
    });

    it('should skip old posts', async () => {
      const context = createMockContext({
        maxpostage: 24, // 24 hours
      });

      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const post = createMockPost({
        url: 'https://i.imgur.com/test.jpg',
        createdAt: twoDaysAgo,
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toContain('Post too old');
    });

    it('should skip high upvote posts', async () => {
      const context = createMockContext({
        skipupvotethreshold: 100,
      });
      const post = createMockPost({
        url: 'https://i.imgur.com/test.jpg',
        score: 150,
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toContain('Too many upvotes');
    });

    it('should skip posts from excluded domains', async () => {
      const context = createMockContext({
        linkdomainexclusions: 'wikipedia.org,reddit.com',
      });
      const post = createMockPost({
        url: 'https://en.wikipedia.org/wiki/Game',
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Link from excluded domain');
    });
  });

  describe('Feature 2014: Complete Validation Pipeline', () => {
    it('should apply checks in correct priority order', async () => {
      const context = createMockContext({
        allowlistedusers: 'testuser',
        excludedflairs: 'comic',
      });
      const post = createMockPost({
        authorName: 'testuser',
        url: 'https://i.imgur.com/test.jpg',
        flair: { text: 'Comic' },
      });

      // Whitelist is higher priority than flair
      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Allowed user');
    });

    it('should handle deleted authors', async () => {
      const context = createMockContext();
      const post = createMockPost({
        authorName: undefined,
        url: 'https://i.imgur.com/test.jpg',
      });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toBe('Deleted author');
    });

    it('should fail open on errors', async () => {
      const context = createMockContext();
      context.settings.getAll = jest.fn().mockRejectedValue(new Error('Settings error'));

      const post = createMockPost({ url: 'https://i.imgur.com/test.jpg' });

      const result = await shouldEnforceRule5(post, context);

      expect(result.shouldEnforce).toBe(false);
      expect(result.reason).toContain('error');
    });
  });
});
