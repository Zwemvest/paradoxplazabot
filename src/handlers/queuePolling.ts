/**
 * Queue Polling Scheduler
 * Feature 1001: Retrieve New Queue (backup to PostSubmit triggers)
 * Feature 1005: Queue Polling Scheduler
 *
 * Periodically checks new queue as backup in case triggers miss posts
 */

import type { ScheduledJobEvent, TriggerContext } from '@devvit/public-api';
import { isPostProcessed, markPostProcessed } from '../storage/postState.js';
import { log } from '../utils/logger.js';

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
      log({ level: 'info', message: 'Polling disabled, skipping', service: 'QueuePolling' });
      return;
    }

    const queueLimit = (settings.queuelimit as number) || 100;

    log({ level: 'info', message: `Starting queue poll (limit: ${queueLimit})`, service: 'QueuePolling' });

    // Get current subreddit
    const subreddit = await context.reddit.getCurrentSubreddit();
    const subredditName = subreddit.name;

    log({ level: 'info', message: `Polling r/${subredditName}`, service: 'QueuePolling' });

    // Fetch new posts
    const posts = await context.reddit.getNewPosts({
      subredditName: subredditName,
      limit: queueLimit,
    }).all();

    log({ level: 'info', message: `Found ${posts.length} posts in new queue`, service: 'QueuePolling' });

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
          log({
            level: 'info',
            message: `Post ${post.id} requires enforcement: ${validationResult.reason}`,
            service: 'QueuePolling',
          });
          // Feature 4001: Schedule grace period check
          const { scheduleGracePeriodCheck } = await import('../services/warningSystem.js');
          await scheduleGracePeriodCheck(post.id, context);
        }

        processedCount++;
      } catch (error) {
        log({
          level: 'error',
          message: `Error processing post ${post.id}`,
          service: 'QueuePolling',
          error: error instanceof Error ? error : new Error(String(error)),
        });
        // Continue with next post
      }
    }

    log({
      level: 'info',
      message: `Completed: ${processedCount} processed, ${skippedCount} skipped`,
      service: 'QueuePolling',
    });
  } catch (error) {
    log({
      level: 'error',
      message: 'Error during queue poll',
      service: 'QueuePolling',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Don't throw - let next scheduled run try again
  }
}
