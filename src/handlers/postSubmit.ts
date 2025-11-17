/**
 * PostSubmit Event Handler
 * Feature 1002: Trigger-Based Post Detection
 *
 * Responds immediately when new posts are submitted
 */

import type { TriggerContext } from '@devvit/public-api';
import type { PostSubmit } from '@devvit/protos';
import { isPostProcessed, markPostProcessed } from '../storage/postState.js';
import { log } from '../utils/logger.js';

/**
 * Handle new post submission
 * This is the primary entry point for post monitoring
 */
export async function onPostSubmit(event: PostSubmit, context: TriggerContext): Promise<void> {
  try {
    const postId = event.post?.id;

    if (!postId) {
      log({ level: 'error', message: 'No post ID in event', service: 'PostSubmit' });
      return;
    }

    // Feature 1003: Deduplication check
    if (await isPostProcessed(postId, context)) {
      log({ level: 'warn', message: `Post ${postId} already processed, skipping`, service: 'PostSubmit' });
      return;
    }

    log({ level: 'info', message: `Processing new post: ${postId}`, service: 'PostSubmit' });

    // Mark as processed immediately to prevent race conditions
    await markPostProcessed(postId, context);

    // Get full post object
    const post = await context.reddit.getPostById(postId);

    if (!post) {
      log({ level: 'error', message: `Could not fetch post ${postId}`, service: 'PostSubmit' });
      return;
    }

    // Feature 2014: Validate post
    const { shouldEnforceRule5 } = await import('../services/postValidation.js');
    const validationResult = await shouldEnforceRule5(post, context);

    if (validationResult.shouldEnforce) {
      log({
        level: 'info',
        message: `Post ${postId} requires R5 enforcement: ${validationResult.reason}`,
        service: 'PostSubmit',
      });

      // Feature 4001: Schedule grace period check
      const { scheduleGracePeriodCheck } = await import('../services/warningSystem.js');
      await scheduleGracePeriodCheck(postId, context);
    } else {
      log({
        level: 'info',
        message: `Post ${postId} does not require enforcement: ${validationResult.reason}`,
        service: 'PostSubmit',
      });
    }

    log({ level: 'info', message: `Successfully processed post ${postId}`, service: 'PostSubmit' });
  } catch (error) {
    log({
      level: 'error',
      message: 'Error processing post',
      service: 'PostSubmit',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Fail open: Don't block user posts due to bot errors
  }
}
