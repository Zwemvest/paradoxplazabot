/**
 * Redis storage for post state tracking
 * Implements deduplication and state management
 */

import type { TriggerContext } from '@devvit/public-api';
import type { PostState } from '../types/index.js';

// ============================================================================
// Constants
// ============================================================================

const TTL_7_DAYS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
// const _TTL_24_HOURS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ============================================================================
// Deduplication (Feature 1003)
// ============================================================================

/**
 * Check if post has already been processed (prevents reprocessing)
 * Key: processed:{postId}
 * TTL: 7 days
 */
export async function isPostProcessed(postId: string, context: TriggerContext): Promise<boolean> {
  const key = `processed:${postId}`;
  const value = await context.redis.get(key);
  return value !== null;
}

/**
 * Mark post as processed to prevent future reprocessing
 * Stores for 7 days then auto-expires
 */
export async function markPostProcessed(postId: string, context: TriggerContext): Promise<void> {
  const key = `processed:${postId}`;
  const expiration = new Date(Date.now() + TTL_7_DAYS);
  await context.redis.set(key, 'true', { expiration });
}

// ============================================================================
// Warning State
// ============================================================================

/**
 * Check if post has been warned
 * Key: warned:{postId}
 * TTL: 7 days
 */
export async function isPostWarned(postId: string, context: TriggerContext): Promise<boolean> {
  const key = `warned:${postId}`;
  const value = await context.redis.get(key);
  return value !== null;
}

/**
 * Mark post as warned and store timestamp and optional comment ID
 */
export async function markPostWarned(
  postId: string,
  context: TriggerContext,
  commentId?: string
): Promise<void> {
  const key = `warned:${postId}`;
  const timestamp = Date.now().toString();
  const expiration = new Date(Date.now() + TTL_7_DAYS);
  await context.redis.set(key, timestamp, { expiration });

  // Store comment ID separately if provided
  if (commentId) {
    const commentKey = `warned_comment:${postId}`;
    await context.redis.set(commentKey, commentId, { expiration });
  }
}

/**
 * Get warning timestamp
 */
export async function getWarningTime(postId: string, context: TriggerContext): Promise<number | null> {
  const key = `warned:${postId}`;
  const value = await context.redis.get(key);
  if (!value) return null;
  return parseInt(value, 10);
}

/**
 * Get warning comment ID
 */
export async function getWarningCommentId(postId: string, context: TriggerContext): Promise<string | null> {
  const key = `warned_comment:${postId}`;
  const value = await context.redis.get(key);
  return value ?? null;
}

// ============================================================================
// Removal State
// ============================================================================

/**
 * Check if post has been removed by bot
 * Key: removed:{postId}
 * TTL: 7 days
 */
export async function wasRemovedByBot(postId: string, context: TriggerContext): Promise<boolean> {
  const key = `removed:${postId}`;
  const value = await context.redis.get(key);
  return value !== null;
}

/**
 * Mark post as removed by bot and store timestamp and optional comment ID
 */
export async function markPostRemoved(
  postId: string,
  context: TriggerContext,
  commentId?: string
): Promise<void> {
  const key = `removed:${postId}`;
  const timestamp = Date.now().toString();
  const expiration = new Date(Date.now() + TTL_7_DAYS);
  await context.redis.set(key, timestamp, { expiration });

  // Store comment ID separately if provided
  if (commentId) {
    const commentKey = `removed_comment:${postId}`;
    await context.redis.set(commentKey, commentId, { expiration });
  }
}

/**
 * Get removal timestamp
 */
export async function getRemovalTime(postId: string, context: TriggerContext): Promise<number | null> {
  const key = `removed:${postId}`;
  const value = await context.redis.get(key);
  if (!value) return null;
  return parseInt(value, 10);
}

/**
 * Get removal comment ID
 */
export async function getRemovalCommentId(postId: string, context: TriggerContext): Promise<string | null> {
  const key = `removed_comment:${postId}`;
  const value = await context.redis.get(key);
  return value ?? null;
}

// ============================================================================
// Approval State (24-hour grace period to prevent re-removal loops)
// ============================================================================

/**
 * Check if post was recently approved (within 24 hours)
 * Key: approved:{postId}
 * TTL: 7 days (but only considered "recent" for 24h)
 */
export async function wasRecentlyApproved(postId: string, context: TriggerContext): Promise<boolean> {
  const key = `approved:${postId}`;
  const value = await context.redis.get(key);

  if (!value) return false;

  const approvedAt = parseInt(value, 10);
  const hoursSince = (Date.now() - approvedAt) / (60 * 60 * 1000);

  // Consider "recently approved" if within 24 hours
  return hoursSince < 24;
}

/**
 * Mark post as approved by bot
 */
export async function markPostApproved(
  postId: string,
  context: TriggerContext
): Promise<void> {
  const key = `approved:${postId}`;
  const timestamp = Date.now().toString();
  const expiration = new Date(Date.now() + TTL_7_DAYS);
  await context.redis.set(key, timestamp, { expiration });
}

/**
 * Get approval timestamp
 */
export async function getApprovalTime(postId: string, context: TriggerContext): Promise<number | null> {
  const key = `approved:${postId}`;
  const value = await context.redis.get(key);
  if (!value) return null;
  return parseInt(value, 10);
}

// ============================================================================
// Complete Post State
// ============================================================================

/**
 * Get complete state for a post
 */
export async function getPostState(postId: string, context: TriggerContext): Promise<PostState> {
  const warnedTime = await getWarningTime(postId, context);
  const warningCommentId = await getWarningCommentId(postId, context);
  const removedTime = await getRemovalTime(postId, context);
  const removalCommentId = await getRemovalCommentId(postId, context);
  const approvedTime = await getApprovalTime(postId, context);

  return {
    postId,
    warned: warnedTime !== null,
    warnedAt: warnedTime ?? undefined,
    warningCommentId: warningCommentId ?? undefined,
    removed: removedTime !== null,
    removedAt: removedTime ?? undefined,
    removalCommentId: removalCommentId ?? undefined,
    approved: approvedTime !== null,
    approvedAt: approvedTime ?? undefined,
  };
}

/**
 * Clear all state for a post (useful for testing or manual overrides)
 */
export async function clearPostState(postId: string, context: TriggerContext): Promise<void> {
  await context.redis.del(`processed:${postId}`);
  await context.redis.del(`warned:${postId}`);
  await context.redis.del(`warned_comment:${postId}`);
  await context.redis.del(`removed:${postId}`);
  await context.redis.del(`removed_comment:${postId}`);
  await context.redis.del(`approved:${postId}`);
}
