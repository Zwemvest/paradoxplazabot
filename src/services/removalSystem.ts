/**
 * Removal System Service
 * Features: 5001-5010
 *
 * Handles post removal after warning period expires without R5
 */

import type { Post, TriggerContext } from '@devvit/public-api';
import type { BotSettings } from '../types';
import { isPostWarned, markPostRemoved, getWarningCommentId } from '../storage/postState.js';
import { substituteVariables, getR5ReinstatementModmailLink } from '../utils/templates.js';
import { sendNotification } from './notificationService.js';

/**
 * Feature 5002: Schedule Removal Check
 * Main handler for removal check scheduled job
 * Note: Scheduling happens in warningSystem.ts (Feature 5001)
 */
export async function checkRemoval(postId: string, context: TriggerContext): Promise<void> {
  try {
    console.log(`[RemovalSystem] Checking removal for post ${postId}`);

    // Get post
    const post = await context.reddit.getPostById(postId);
    if (!post) {
      console.warn(`[RemovalSystem] Post ${postId} not found, skipping`);
      return;
    }

    // Feature 5003: Verify Warning Exists Before Removal
    if (!(await isPostWarned(postId, context))) {
      console.warn(`[RemovalSystem] Post ${postId} was never warned, skipping removal`);
      return;
    }

    // Check if post still needs enforcement
    const { shouldEnforceRule5 } = await import('./postValidation.js');
    const validationResult = await shouldEnforceRule5(post, context);

    if (!validationResult.shouldEnforce) {
      console.log(
        `[RemovalSystem] Post ${postId} no longer needs enforcement: ${validationResult.reason}`
      );
      return;
    }

    // Check if R5 was added since warning
    const hasR5 = await checkR5Added(post, context);
    if (hasR5) {
      console.log(
        `[RemovalSystem] Post ${postId} has R5 comment, skipping removal (will be handled by reinstatement)`
      );
      return;
    }

    // Post still needs removal
    await removePost(post, context);

    console.log(`[RemovalSystem] Successfully removed post ${postId}`);
  } catch (error) {
    console.error(`[RemovalSystem] Error during removal check for ${postId}:`, error);
    // Fail open - don't throw
  }
}

/**
 * Feature 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010:
 * Complete post removal/reporting with comment and cleanup
 */
export async function removePost(post: Post, context: TriggerContext): Promise<void> {
  try {
    const postId = post.id;
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    const enforcementAction = settings.enforcementaction || 'remove';

    let wasRemoved = false;
    let wasReported = false;

    // Feature 5005 & 5010: Remove or Report Post
    if (enforcementAction === 'remove' || enforcementAction === 'both') {
      try {
        console.log(`[RemovalSystem] Removing post ${postId}`);
        await post.remove();
        wasRemoved = true;
        console.log(`[RemovalSystem] Post ${postId} removed`);
      } catch (error) {
        console.error(`[RemovalSystem] Failed to remove post ${postId}:`, error);
        // Feature 5010: Fallback to reporting if removal fails
        console.log(`[RemovalSystem] Falling back to report for post ${postId}`);
      }
    }

    // Feature 5010: Report post if removal failed or if action is 'report'/'both'
    if (!wasRemoved || enforcementAction === 'report' || enforcementAction === 'both') {
      try {
        const reportReason = settings.reportreason || 'Missing Rule 5 explanation after warning period';
        console.log(`[RemovalSystem] Reporting post ${postId}`);
        await context.reddit.report(post, { reason: reportReason });
        wasReported = true;
        console.log(`[RemovalSystem] Post ${postId} reported to moderators`);
      } catch (error) {
        console.error(`[RemovalSystem] Failed to report post ${postId}:`, error);
      }
    }

    // Feature 5009: Track Removal State
    // Mark as removed/reported BEFORE posting comment (in case comment fails)
    await markPostRemoved(postId, context);

    // Feature 5006: Post Removal Comment (if enabled)
    if (settings.commentonremoval) {
      await postRemovalComment(post, settings, context, wasRemoved, wasReported);
    } else {
      console.log(`[RemovalSystem] Removal comments disabled, skipping comment for ${postId}`);
    }

    // Feature 5008: Clean Up Warning Comments (if enabled)
    if (settings.cleanupwarnings) {
      await cleanupWarningComments(postId, context);
    }

    // Feature 10004: Send notification
    const subreddit = await context.reddit.getCurrentSubreddit();
    const actionTaken = wasRemoved ? 'removed' : wasReported ? 'reported' : 'processed';
    await sendNotification(
      {
        event: 'removal',
        username: post.authorName || '[deleted]',
        subreddit: subreddit.name,
        postUrl: `https://reddit.com${post.permalink}`,
        reason: `Post ${actionTaken} for missing Rule 5 explanation`,
      },
      context
    );
  } catch (error) {
    console.error(`[RemovalSystem] Error removing post ${post.id}:`, error);
    // Fail open
  }
}

/**
 * Feature 5004, 5006, 5007: Generate and post removal comment
 */
async function postRemovalComment(
  post: Post,
  settings: BotSettings,
  context: TriggerContext,
  wasRemoved: boolean,
  _wasReported: boolean
): Promise<void> {
  try {
    const postId = post.id;
    const subreddit = await context.reddit.getCurrentSubreddit();

    // Feature 7011: Generate pre-filled modmail link
    const modmailLink = getR5ReinstatementModmailLink(
      subreddit.name,
      postId,
      `https://reddit.com${post.permalink}`
    );

    // Feature 5004 & 5010: Generate Removal/Report Message
    const template = wasRemoved
      ? (settings.removaltemplate || getDefaultRemovalTemplate())
      : (settings.reporttemplate || getDefaultReportTemplate());

    const removalMessage = substituteVariables(template, {
      author: post.authorName || '[deleted]',
      postTitle: post.title || '',
      postUrl: `https://reddit.com${post.permalink}`,
      graceMinutes: String(settings.graceperiod || 5),
      warningMinutes: String(settings.warningperiod || 10),
      modmaillink: modmailLink,
      action: wasRemoved ? 'removed' : 'reported to moderators',
    });

    console.log(`[RemovalSystem] Posting ${wasRemoved ? 'removal' : 'report'} comment on post ${postId}`);

    // Feature 5006: Post Removal Comment
    const comment = await post.addComment({
      text: removalMessage,
    });

    if (comment) {
      // Feature 5007: Distinguish Removal Comment as Moderator
      await comment.distinguish(true);
      console.log(`[RemovalSystem] Posted and distinguished ${wasRemoved ? 'removal' : 'report'} comment ${comment.id}`);

      // Update removal state with comment ID
      await markPostRemoved(postId, context, comment.id);
    } else {
      console.error(`[RemovalSystem] Failed to post removal comment on ${postId}`);
    }
  } catch (error) {
    console.error(`[RemovalSystem] Error posting removal comment for ${post.id}:`, error);
    // Don't throw - removal already happened
  }
}

/**
 * Feature 5008: Clean Up Warning Comments
 * Delete warning comments when post is removed
 */
async function cleanupWarningComments(postId: string, context: TriggerContext): Promise<void> {
  try {
    const warningCommentId = await getWarningCommentId(postId, context);
    if (!warningCommentId) {
      console.log(`[RemovalSystem] No warning comment to clean up for ${postId}`);
      return;
    }

    console.log(`[RemovalSystem] Cleaning up warning comment ${warningCommentId}`);

    const comment = await context.reddit.getCommentById(warningCommentId);
    if (comment) {
      await comment.delete();
      console.log(`[RemovalSystem] Deleted warning comment ${warningCommentId}`);
    }
  } catch (error) {
    console.error(`[RemovalSystem] Error cleaning up warning comments for ${postId}:`, error);
    // Don't throw - removal already happened
  }
}

/**
 * Check if R5 was added since warning
 * Used to prevent removal if user added R5
 */
async function checkR5Added(post: Post, context: TriggerContext): Promise<boolean> {
  try {
    const { hasValidR5Comment } = await import('./commentValidation.js');
    const result = await hasValidR5Comment(post, context);
    return result.hasValidR5;
  } catch (error) {
    console.error(`[RemovalSystem] Error checking R5:`, error);
    return false; // Fail open - assume no R5
  }
}

/**
 * Default removal template
 */
function getDefaultRemovalTemplate(): string {
  return `Hello {{author}},

Your post "{{postTitle}}" has been removed for violating Rule 5.

You were given {{warningMinutes}} minutes to add a Rule 5 comment explaining the context of your post, but no valid comment was found.

If you would like to have your post reinstated, please:
1. Add a proper Rule 5 comment to this post
2. Send a message to the moderators with a link to this post

[Link to your removed post]({{postUrl}})`;
}

/**
 * Default report template (Feature 5010)
 */
function getDefaultReportTemplate(): string {
  return `Hello {{author}},

Your post "{{postTitle}}" has been {{action}} for violating Rule 5.

You were given {{warningMinutes}} minutes to add a Rule 5 comment explaining the context of your post, but no valid comment was found.

Please add a proper Rule 5 comment to this post. Moderators will review your post and may approve it if a valid explanation is added.

[Link to your post]({{postUrl}})`;
}
