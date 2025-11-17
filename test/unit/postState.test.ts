/**
 * Unit tests for post state storage
 * Features: 1003 (Deduplication)
 */

import {
  isPostProcessed,
  markPostProcessed,
  isPostWarned,
  markPostWarned,
  getWarningTime,
  wasRemovedByBot,
  markPostRemoved,
  getRemovalTime,
  wasRecentlyApproved,
  markPostApproved,
  getPostState,
  clearPostState,
} from '../../src/storage/postState';

// Mock TriggerContext
const createMockContext = () => {
  const store = new Map<string, { value: string; expiration?: Date }>();

  return {
    redis: {
      get: jest.fn(async (key: string) => {
        const item = store.get(key);
        if (!item) return null;
        if (item.expiration && item.expiration < new Date()) {
          store.delete(key);
          return null;
        }
        return item.value;
      }),
      set: jest.fn(async (key: string, value: string, options?: { expiration?: Date }) => {
        store.set(key, { value, expiration: options?.expiration });
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  } as any;
};

describe('Post State Storage', () => {
  let context: any;

  beforeEach(() => {
    context = createMockContext();
  });

  describe('Deduplication (Feature 1003)', () => {
    it('should return false for unprocessed post', async () => {
      const result = await isPostProcessed('post123', context);
      expect(result).toBe(false);
    });

    it('should return true for processed post', async () => {
      await markPostProcessed('post123', context);
      const result = await isPostProcessed('post123', context);
      expect(result).toBe(true);
    });

    it('should mark post as processed with TTL', async () => {
      await markPostProcessed('post123', context);

      expect(context.redis.set).toHaveBeenCalledWith(
        'processed:post123',
        'true',
        expect.objectContaining({ expiration: expect.any(Date) })
      );
    });
  });

  describe('Warning State', () => {
    it('should return false for un-warned post', async () => {
      const result = await isPostWarned('post123', context);
      expect(result).toBe(false);
    });

    it('should return true for warned post', async () => {
      await markPostWarned('post123', context);
      const result = await isPostWarned('post123', context);
      expect(result).toBe(true);
    });

    it('should store warning timestamp', async () => {
      const beforeTime = Date.now();
      await markPostWarned('post123', context);
      const afterTime = Date.now();

      const timestamp = await getWarningTime('post123', context);
      expect(timestamp).not.toBeNull();
      expect(timestamp!).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp!).toBeLessThanOrEqual(afterTime);
    });

    it('should return null for warning time if not warned', async () => {
      const timestamp = await getWarningTime('post123', context);
      expect(timestamp).toBeNull();
    });
  });

  describe('Removal State', () => {
    it('should return false for non-removed post', async () => {
      const result = await wasRemovedByBot('post123', context);
      expect(result).toBe(false);
    });

    it('should return true for removed post', async () => {
      await markPostRemoved('post123', context);
      const result = await wasRemovedByBot('post123', context);
      expect(result).toBe(true);
    });

    it('should store removal timestamp', async () => {
      const beforeTime = Date.now();
      await markPostRemoved('post123', context);
      const afterTime = Date.now();

      const timestamp = await getRemovalTime('post123', context);
      expect(timestamp).not.toBeNull();
      expect(timestamp!).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp!).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Approval State (24h grace period)', () => {
    it('should return false for non-approved post', async () => {
      const result = await wasRecentlyApproved('post123', context);
      expect(result).toBe(false);
    });

    it('should return true for recently approved post', async () => {
      await markPostApproved('post123', context);
      const result = await wasRecentlyApproved('post123', context);
      expect(result).toBe(true);
    });

    it('should return false for approval older than 24 hours', async () => {
      // Mock an approval from 25 hours ago
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      await context.redis.set('approved:post123', twentyFiveHoursAgo.toString(), {
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await wasRecentlyApproved('post123', context);
      expect(result).toBe(false);
    });

    it('should return true for approval within 24 hours', async () => {
      // Mock an approval from 1 hour ago
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      await context.redis.set('approved:post123', oneHourAgo.toString(), {
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await wasRecentlyApproved('post123', context);
      expect(result).toBe(true);
    });
  });

  describe('Complete Post State', () => {
    it('should return complete state for post', async () => {
      await markPostWarned('post123', context);
      await markPostRemoved('post123', context);

      const state = await getPostState('post123', context);

      expect(state).toMatchObject({
        postId: 'post123',
        warned: true,
        removed: true,
        approved: false,
      });
      expect(state.warnedAt).toBeDefined();
      expect(state.removedAt).toBeDefined();
    });

    it('should return empty state for new post', async () => {
      const state = await getPostState('post123', context);

      expect(state).toEqual({
        postId: 'post123',
        warned: false,
        removed: false,
        approved: false,
      });
    });
  });

  describe('Clear Post State', () => {
    it('should clear all state for a post', async () => {
      // Set up state
      await markPostProcessed('post123', context);
      await markPostWarned('post123', context);
      await markPostRemoved('post123', context);
      await markPostApproved('post123', context);

      // Verify state exists
      expect(await isPostProcessed('post123', context)).toBe(true);
      expect(await isPostWarned('post123', context)).toBe(true);
      expect(await wasRemovedByBot('post123', context)).toBe(true);
      expect(await wasRecentlyApproved('post123', context)).toBe(true);

      // Clear state
      await clearPostState('post123', context);

      // Verify state cleared
      expect(await isPostProcessed('post123', context)).toBe(false);
      expect(await isPostWarned('post123', context)).toBe(false);
      expect(await wasRemovedByBot('post123', context)).toBe(false);
      expect(await wasRecentlyApproved('post123', context)).toBe(false);
    });
  });
});
