/**
 * Reinstatement System Service
 * Features: 6001-6008, 6010
 *
 * Handles automatic approval when users add R5 comments
 */

import type { Post, TriggerContext } from '@devvit/public-api';
import type { BotSettings } from '../types';
import {
  isPostWarned,
  wasRemovedByBot,
  getWarningTime,
  getWarningCommentId,
  getRemovalCommentId,
  markPostApproved,
  clearPostState,
} from '../storage/postState.js';
import { hasR5AddedAfterWarning } from '../services/commentValidation.js';
import { sendNotification } from './notificationService.js';
import { log } from '../utils/logger.js';

/**
 * Feature 6001: Detect R5 Comment Added
 * Check if warned/removed posts have R5 added
 * This should be called periodically or on CommentCreate events
 */
export async function checkForR5Addition(postId: string, context: TriggerContext): Promise<void> {
  try {
    log({ level: 'info', message: `Checking R5 for post ${postId}`, service: 'ReinstatementSystem' });

    // Only check posts that were warned or removed by bot
    const wasWarned = await isPostWarned(postId, context);
    const wasRemoved = await wasRemovedByBot(postId, context);

    if (!wasWarned && !wasRemoved) {
      log({ level: 'info', message: `Post ${postId} not warned or removed, skipping`, service: 'ReinstatementSystem' });
      return;
    }

    // Get post
    const post = await context.reddit.getPostById(postId);
    if (!post) {
      log({ level: 'warn', message: `Post ${postId} not found`, service: 'ReinstatementSystem' });
      return;
    }

    // Feature 6002: Verify R5 Comment Quality
    // Check if valid R5 was added after warning
    const warningTime = await getWarningTime(postId, context);
    if (!warningTime) {
      log({ level: 'warn', message: `No warning time found for ${postId}`, service: 'ReinstatementSystem' });
      return;
    }

    const r5Result = await hasR5AddedAfterWarning(post, warningTime, context);

    if (r5Result.hasValidR5) {
      log({
        level: 'info',
        message: `Valid R5 found for post ${postId}: ${r5Result.reason}`,
        service: 'ReinstatementSystem',
      });
      // Feature 6008: Complete Reinstatement Flow
      await reinstatePost(post, context);
    } else {
      log({ level: 'info', message: `No valid R5 for post ${postId}: ${r5Result.reason}`, service: 'ReinstatementSystem' });
    }
  } catch (error) {
    log({
      level: 'error',
      message: `Error checking R5 for ${postId}`,
      service: 'ReinstatementSystem',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Fail open
  }
}

/**
 * Feature 6008: Complete Reinstatement Flow
 * Full reinstatement with all steps
 */
export async function reinstatePost(post: Post, context: TriggerContext): Promise<void> {
  try {
    const postId = post.id;
    const settings = (await context.settings.getAll()) as unknown as BotSettings;

    log({ level: 'info', message: `Reinstating post ${postId}`, service: 'ReinstatementSystem' });

    // Feature 6010: Handle Already-Removed Posts
    const wasRemoved = await wasRemovedByBot(postId, context);
    if (wasRemoved) {
      // Feature 6004: Approve Post (un-remove it)
      await post.approve();
      log({ level: 'info', message: `Approved (un-removed) post ${postId}`, service: 'ReinstatementSystem' });
    }

    // Feature 6003: Clean Up Bot Comments
    await cleanupBotComments(postId, context);

    // Feature 6006: Clear Warning State
    // Feature 6007: Clear Removal State
    // Feature 6005: Add to Whitelist (24-hour approval grace period)
    await clearPostState(postId, context);
    await markPostApproved(postId, context);

    log({ level: 'info', message: `Post ${postId} reinstated successfully`, service: 'ReinstatementSystem' });

    // Optional: Post reinstatement comment (Feature 6009 - Should Have)
    if (settings.commentonreinstatement) {
      await postReinstatementComment(post, context);
    }

    // Feature 10004: Send notification
    const subreddit = await context.reddit.getCurrentSubreddit();
    await sendNotification(
      {
        event: 'reinstatement',
        username: post.authorName || '[deleted]',
        subreddit: subreddit.name,
        postUrl: `https://reddit.com${post.permalink}`,
        reason: 'Post reinstated after valid Rule 5 explanation added',
      },
      context
    );
  } catch (error) {
    log({
      level: 'error',
      message: `Error reinstating post ${post.id}`,
      service: 'ReinstatementSystem',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Don't throw - partial reinstatement is better than none
  }
}

/**
 * Feature 6003: Clean Up Bot Comments
 * Delete warning and removal comments
 */
async function cleanupBotComments(postId: string, context: TriggerContext): Promise<void> {
  try {
    // Clean up warning comment
    const warningCommentId = await getWarningCommentId(postId, context);
    if (warningCommentId) {
      log({ level: 'info', message: `Deleting warning comment ${warningCommentId}`, service: 'ReinstatementSystem' });
      const warningComment = await context.reddit.getCommentById(warningCommentId);
      if (warningComment) {
        await warningComment.delete();
        log({ level: 'info', message: `Deleted warning comment`, service: 'ReinstatementSystem' });
      }
    }

    // Clean up removal comment
    const removalCommentId = await getRemovalCommentId(postId, context);
    if (removalCommentId) {
      log({ level: 'info', message: `Deleting removal comment ${removalCommentId}`, service: 'ReinstatementSystem' });
      const removalComment = await context.reddit.getCommentById(removalCommentId);
      if (removalComment) {
        await removalComment.delete();
        log({ level: 'info', message: `Deleted removal comment`, service: 'ReinstatementSystem' });
      }
    }
  } catch (error) {
    log({
      level: 'error',
      message: `Error cleaning up comments for ${postId}`,
      service: 'ReinstatementSystem',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Don't throw - continue with reinstatement
  }
}

/**
 * Feature 6009: Silent Approval (Should Have)
 * Post optional reinstatement comment
 */
async function postReinstatementComment(
  post: Post,
  context: TriggerContext
): Promise<void> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    const message = settings.reinstatementcomment || 'Thank you for adding Rule 5 context! Your post has been approved.';

    log({ level: 'info', message: `Posting reinstatement comment on ${post.id}`, service: 'ReinstatementSystem' });
    const comment = await post.addComment({ text: message });
    if (comment) {
      await comment.distinguish(true);
      log({ level: 'info', message: `Posted reinstatement comment`, service: 'ReinstatementSystem' });
    }
  } catch (error) {
    log({
      level: 'error',
      message: `Error posting reinstatement comment`,
      service: 'ReinstatementSystem',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Don't throw
  }
}

/**
 * Batch check for R5 additions
 * Can be called by scheduled job to monitor multiple posts
 */
export async function monitorWarnedPosts(context: TriggerContext): Promise<void> {
  try {
    log({ level: 'info', message: `Starting R5 monitoring sweep`, service: 'ReinstatementSystem' });

    const subreddit = await context.reddit.getCurrentSubreddit();
// TODO: Use this setting
    //     const _settings = (await context.settings.getAll()) as unknown as BotSettings;

    // Get recent posts (posts from last 24-48 hours that might have warnings)
    // This is a backup to CommentCreate events
    const posts = await context.reddit.getNewPosts({
      subredditName: subreddit.name,
      limit: 100,
    }).all();

    let checkedCount = 0; // TODO: Track reinstated count for analytics

    for (const post of posts) {
      try {
        // Check if warned or removed
        const wasWarned = await isPostWarned(post.id, context);
        const wasRemoved = await wasRemovedByBot(post.id, context);

        if (wasWarned || wasRemoved) {
          await checkForR5Addition(post.id, context);
          checkedCount++;
        }
      } catch (error) {
        log({
          level: 'error',
          message: `Error checking post ${post.id}`,
          service: 'ReinstatementSystem',
          error: error instanceof Error ? error : new Error(String(error)),
        });
        // Continue with next post
      }
    }

    log({
      level: 'info',
      message: `Monitoring sweep complete: ${checkedCount} posts checked`,
      service: 'ReinstatementSystem',
    });
  } catch (error) {
    log({
      level: 'error',
      message: 'Error during monitoring sweep',
      service: 'ReinstatementSystem',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Fail open
  }
}
