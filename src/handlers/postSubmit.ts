/**
 * PostSubmit Event Handler
 * Feature 1002: Trigger-Based Post Detection
 *
 * Responds immediately when new posts are submitted
 */

import type { TriggerContext } from '@devvit/public-api';
import type { PostSubmit } from '@devvit/protos';
import { isPostProcessed, markPostProcessed } from '../storage/postState.js';

/**
 * Handle new post submission
 * This is the primary entry point for post monitoring
 */
export async function onPostSubmit(event: PostSubmit, context: TriggerContext): Promise<void> {
  try {
    const postId = event.post?.id;

    if (!postId) {
      console.error('[PostSubmit] No post ID in event');
      return;
    }

    // Feature 1003: Deduplication check
    if (await isPostProcessed(postId, context)) {
      console.warn(`[PostSubmit] Post ${postId} already processed, skipping`);
      return;
    }

    console.log(`[PostSubmit] Processing new post: ${postId}`);

    // Mark as processed immediately to prevent race conditions
    await markPostProcessed(postId, context);

    // Get full post object
    const post = await context.reddit.getPostById(postId);

    if (!post) {
      console.error(`[PostSubmit] Could not fetch post ${postId}`);
      return;
    }

    // Feature 2014: Validate post
    const { shouldEnforceRule5 } = await import('../services/postValidation.js');
    const validationResult = await shouldEnforceRule5(post, context);

    if (validationResult.shouldEnforce) {
      console.log(
        `[PostSubmit] Post ${postId} requires R5 enforcement: ${validationResult.reason}`
      );

      // Feature 4001: Schedule grace period check
      const { scheduleGracePeriodCheck } = await import('../services/warningSystem.js');
      await scheduleGracePeriodCheck(postId, context);
    } else {
      console.log(
        `[PostSubmit] Post ${postId} does not require enforcement: ${validationResult.reason}`
      );
    }

    console.log(`[PostSubmit] Successfully processed post ${postId}`);
  } catch (error) {
    console.error('[PostSubmit] Error processing post:', error);
    // Fail open: Don't block user posts due to bot errors
  }
}
