/**
 * Queue Polling Scheduler
 * Feature 1001: Retrieve New Queue (backup to PostSubmit triggers)
 * Feature 1005: Queue Polling Scheduler
 *
 * Periodically checks new queue as backup in case triggers miss posts
 */

import type { ScheduledJobEvent, TriggerContext } from '@devvit/public-api';
import { isPostProcessed, markPostProcessed } from '../storage/postState.js';

/**
 * Poll new queue for posts
 * Runs periodically as backup to PostSubmit triggers
 */
export async function onQueuePolling(
  event: ScheduledJobEvent<{}>,
  context: TriggerContext
): Promise<void> {
  try {
    const settings = await context.settings.getAll();

    // Check if polling is enabled
    const enablePolling = settings.enablepolling as boolean;
    if (!enablePolling) {
      console.log('[QueuePolling] Polling disabled, skipping');
      return;
    }

    const queueLimit = (settings.queuelimit as number) || 100;

    console.log(`[QueuePolling] Starting queue poll (limit: ${queueLimit})`);

    // Get current subreddit
    const subreddit = await context.reddit.getCurrentSubreddit();
    const subredditName = subreddit.name;

    console.log(`[QueuePolling] Polling r/${subredditName}`);

    // Fetch new posts
    const posts = await context.reddit.getNewPosts({
      subredditName: subredditName,
      limit: queueLimit,
    }).all();

    console.log(`[QueuePolling] Found ${posts.length} posts in new queue`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const post of posts) {
      try {
        // Skip if already processed
        if (await isPostProcessed(post.id, context)) {
          skippedCount++;
          continue;
        }

        // Mark as processed
        await markPostProcessed(post.id, context);

        // Feature 2014: Validate post
        const { shouldEnforceRule5 } = await import('../services/postValidation.js');
        const validationResult = await shouldEnforceRule5(post, context);

        if (validationResult.shouldEnforce) {
          console.log(
            `[QueuePolling] Post ${post.id} requires enforcement: ${validationResult.reason}`
          );
          // Feature 4001: Schedule grace period check
          const { scheduleGracePeriodCheck } = await import('../services/warningSystem.js');
          await scheduleGracePeriodCheck(post.id, context);
        }

        processedCount++;
      } catch (error) {
        console.error(`[QueuePolling] Error processing post ${post.id}:`, error);
        // Continue with next post
      }
    }

    console.log(
      `[QueuePolling] Completed: ${processedCount} processed, ${skippedCount} skipped`
    );
  } catch (error) {
    console.error('[QueuePolling] Error during queue poll:', error);
    // Don't throw - let next scheduled run try again
  }
}
