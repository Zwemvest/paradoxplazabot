/**
 * Warning System Service
 * Features: 4001-4008
 *
 * Handles grace period tracking, warning scheduling, and warning comment posting
 */

import type { Post, TriggerContext } from '@devvit/public-api';
import type { BotSettings } from '../types';
import { isPostWarned, markPostWarned, getWarningCommentId as getWarningCommentIdFromStorage } from '../storage/postState.js';
import { substituteVariables } from '../utils/templates.js';
import { sendNotification } from './notificationService.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.warningSystem;

/**
 * Feature 4001: Grace Period Tracking
 * Schedule a warning check after the grace period expires
 */
export async function scheduleGracePeriodCheck(
  postId: string,
  context: TriggerContext
): Promise<void> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    const graceMinutes = settings.graceperiod || 5;

    logger.info('Scheduling grace period check', {
      postId,
      graceMinutes,
      action: 'schedule_grace_check',
    });

    // Schedule warning check after grace period
    const jobId = `grace_${postId}_${Date.now()}`;
    await context.scheduler.runJob({
      name: 'checkWarning',
      data: { postId },
      runAt: new Date(Date.now() + graceMinutes * 60 * 1000),
    });

    logger.info('Grace period check scheduled', {
      postId,
      jobId,
      action: 'grace_check_scheduled',
    });
  } catch (error) {
    logger.error('Failed to schedule grace period check', error, {
      postId,
      action: 'schedule_grace_check_failed',
    });
    // Don't throw - fail open
  }
}

/**
 * Feature 4002: Schedule Warning Check
 * Main handler for warning check scheduled job
 */
export async function checkWarning(postId: string, context: TriggerContext): Promise<void> {
  try {
    logger.info('Checking warning for post', { postId, action: 'check_warning' });

    // Get post
    const post = await context.reddit.getPostById(postId);
    if (!post) {
      logger.warn('Post not found, skipping', { postId, action: 'post_not_found' });
      return;
    }

    // Feature 4003 & 4008: Check if already warned (prevent duplicates)
    if (await isPostWarned(postId, context)) {
      logger.info('Post already warned, skipping', { postId, action: 'already_warned' });
      return;
    }

    // Check if post still needs enforcement
    const { shouldEnforceRule5 } = await import('./postValidation.js');
    const validationResult = await shouldEnforceRule5(post, context);

    if (!validationResult.shouldEnforce) {
      logger.info('Post no longer needs enforcement', {
        postId,
        reason: validationResult.reason,
        action: 'skip_enforcement',
      });
      return;
    }

    // Check if R5 was added during grace period (reinstatement path)
    const hasR5 = await checkR5CommentExists(post, context);
    if (hasR5) {
      logger.info('Post has R5 comment, skipping warning', {
        postId,
        action: 'r5_found_during_grace',
      });
      // This will be handled by reinstatement system
      return;
    }

    // Post still needs warning
    await issueWarning(post, context);

    // Schedule removal check if enforcement action is 'remove'
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    if (settings.enforcementaction === 'remove') {
      await scheduleRemovalCheck(postId, context);
    }
  } catch (error) {
    logger.error('Error during warning check', error, {
      postId,
      action: 'check_warning_failed',
    });
    // Fail open - don't throw
  }
}

/**
 * Feature 4004: Generate Warning Message
 * Feature 4005: Post Warning Comment
 * Feature 4006: Distinguish Comment as Moderator
 * Feature 4007: Track Warning State
 * Feature 4008: Prevent Duplicate Warnings
 */
export async function issueWarning(post: Post, context: TriggerContext): Promise<void> {
  try {
    const postId = post.id;

    // Feature 4003 & 4008: Final duplicate check before posting
    if (await isPostWarned(postId, context)) {
      logger.warn('Post already warned, aborting', { postId, action: 'duplicate_warning_prevented' });
      return;
    }

    const settings = (await context.settings.getAll()) as unknown as BotSettings;

    // Check if we should comment
    if (!settings.commentonwarning) {
      logger.info('Warning comments disabled, marking as warned without comment', {
        postId,
        action: 'silent_warning',
      });
      // Still mark as warned for state tracking
      await markPostWarned(postId, context);
      return;
    }

    // Feature 4004: Generate warning message
    const template = settings.warningtemplate || getDefaultWarningTemplate();
    const warningMessage = substituteVariables(template, {
      author: post.authorName || '[deleted]',
      postTitle: post.title || '',
      postUrl: `https://reddit.com${post.permalink}`,
      graceMinutes: String(settings.graceperiod || 5),
      warningMinutes: String(settings.warningperiod || 10),
    });

    logger.info('Posting warning comment', { postId, action: 'post_warning_comment' });

    // Feature 4005: Post warning comment
    const comment = await post.addComment({
      text: warningMessage,
    });

    if (comment) {
      // Feature 4006: Distinguish comment as moderator
      await comment.distinguish(true);
      logger.info('Warning comment posted and distinguished', {
        postId,
        commentId: comment.id,
        action: 'warning_issued',
      });

      // Feature 4007: Track warning state
      await markPostWarned(postId, context, comment.id);

      // Feature 10004: Send notification
      const subreddit = await context.reddit.getCurrentSubreddit();
      await sendNotification(
        {
          event: 'warning',
          username: post.authorName || '[deleted]',
          subreddit: subreddit.name,
          postUrl: `https://reddit.com${post.permalink}`,
          reason: 'Post requires Rule 5 explanation',
        },
        context
      );
    } else {
      logger.error('Failed to post warning comment', undefined, {
        postId,
        action: 'warning_comment_failed',
      });
    }
  } catch (error) {
    logger.error('Error issuing warning', error, {
      postId: post.id,
      action: 'issue_warning_failed',
    });
    // Fail open
  }
}

/**
 * Check if R5 comment exists
 * Feature 3011: Check R5 Added After Warning
 */
async function checkR5CommentExists(post: Post, context: TriggerContext): Promise<boolean> {
  try {
    const { hasValidR5Comment, reportR5Comment } = await import('./commentValidation.js');
    const result = await hasValidR5Comment(post, context);

    // Feature 3003 & 3006: Report if comment should be reported
    if (result.hasValidR5 && result.shouldReport && result.comment) {
      await reportR5Comment(result.comment, result.reason, context);
    }

    return result.hasValidR5;
  } catch (error) {
    logger.error('Error checking R5 comment', error, {
      postId: post.id,
      action: 'check_r5_failed',
    });
    return false; // Fail open - assume no R5
  }
}

/**
 * Schedule removal check after warning period
 * Links to Feature 5002: Schedule Removal Check
 */
async function scheduleRemovalCheck(postId: string, context: TriggerContext): Promise<void> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    const warningMinutes = settings.warningperiod || 10;

    logger.info('Scheduling removal check', {
      postId,
      warningMinutes,
      action: 'schedule_removal_check',
    });

    await context.scheduler.runJob({
      name: 'checkRemoval',
      data: { postId },
      runAt: new Date(Date.now() + warningMinutes * 60 * 1000),
    });

    logger.info('Removal check scheduled', {
      postId,
      action: 'removal_check_scheduled',
    });
  } catch (error) {
    logger.error('Failed to schedule removal check', error, {
      postId,
      action: 'schedule_removal_failed',
    });
    // Don't throw
  }
}

/**
 * Default warning template
 */
function getDefaultWarningTemplate(): string {
  return `Hello {{author}},

Your post "{{postTitle}}" requires a Rule 5 comment to explain the historical or gaming context.

Please add a top-level comment to your post explaining what this image/content shows and why it's relevant to the subreddit. Your comment should be substantive (at least 50 characters).

If you don't add a Rule 5 comment within {{warningMinutes}} minutes, your post will be automatically removed. You can message the moderators to have it reinstated once you've added context.

[Link to your post]({{postUrl}})`;
}

/**
 * Get warning comment ID for a post
 * Used by removal and reinstatement systems
 */
export async function getWarningCommentId(
  postId: string,
  context: TriggerContext
): Promise<string | null> {
  try {
    return await getWarningCommentIdFromStorage(postId, context);
  } catch (error) {
    logger.error('Failed to get warning comment ID', error, {
      postId,
      action: 'get_warning_comment_id_failed',
    });
    return null;
  }
}
