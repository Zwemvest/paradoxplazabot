/**
 * Comment Validation Service
 * Features: 3001, 3002, 3005, 3007, 3008, 3009, 3011
 *
 * Validates whether a post has a valid Rule 5 (R5) comment
 */

import type { Post, Comment, TriggerContext } from '@devvit/public-api';
import type { BotSettings } from '../types';
import { meetsMinimumLength, containsOne, containsAll, startsWith, endsWith, parseKeywordList } from '../utils/keywordMatching.js';
import { log } from '../utils/logger.js';

/**
 * Result of R5 comment validation
 */
export interface R5ValidationResult {
  hasValidR5: boolean;
  reason: string;
  comment?: Comment;
  shouldReport?: boolean; // Feature 3003: Should be reported to mods
}

/**
 * Feature 3001: R5 Comment Detection Logic
 * Main entry point for checking if post has valid R5 comment
 */
export async function hasValidR5Comment(
  post: Post,
  context: TriggerContext
): Promise<R5ValidationResult> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;

    // Feature 3007: Fetch post comments
    const comments = await fetchPostComments(post, context);

    if (comments.length === 0) {
      return {
        hasValidR5: false,
        reason: 'No comments found',
      };
    }

    // Feature 3008: Find author comments (top-level only)
    const authorComments = await findAuthorComments(post, comments, context);

    if (authorComments.length === 0) {
      return {
        hasValidR5: false,
        reason: 'No author comments found',
      };
    }

    // Check each author comment for valid R5
    let lastFailureReason = 'No valid R5 comment found';
    for (const comment of authorComments) {
      const validation = await validateR5Comment(comment, settings);
      if (validation.hasValidR5) {
        return {
          hasValidR5: true,
          reason: validation.reason,
          comment,
        };
      }
      // Keep track of the most specific failure reason
      lastFailureReason = validation.reason;
    }

    return {
      hasValidR5: false,
      reason: lastFailureReason,
    };
  } catch (error) {
    log({
      level: 'error',
      message: 'Error checking R5 comment',
      service: 'CommentValidation',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      hasValidR5: false,
      reason: 'Error checking comments (fail open)',
    };
  }
}

/**
 * Feature 3011: Check R5 Added After Warning
 * Check if valid R5 was added after warning was issued
 */
export async function hasR5AddedAfterWarning(
  post: Post,
  warningTime: number,
  context: TriggerContext
): Promise<R5ValidationResult> {
  try {
    const result = await hasValidR5Comment(post, context);

    if (!result.hasValidR5 || !result.comment) {
      return result;
    }

    // Check if comment was created after warning
    const commentTime = result.comment.createdAt.getTime();
    if (commentTime > warningTime) {
      return {
        hasValidR5: true,
        reason: `R5 added after warning (${Math.floor((commentTime - warningTime) / 60000)} minutes later)`,
        comment: result.comment,
      };
    }

    return {
      hasValidR5: false,
      reason: 'R5 comment exists but was created before warning',
    };
  } catch (error) {
    log({
      level: 'error',
      message: 'Error checking post-warning R5',
      service: 'CommentValidation',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      hasValidR5: false,
      reason: 'Error checking post-warning R5 (fail open)',
    };
  }
}

/**
 * Feature 3007: Fetch Post Comments
 * Get all comments for a post
 */
async function fetchPostComments(post: Post, _context: TriggerContext): Promise<Comment[]> {
  try {
    // Get comments based on r5commentlocation setting
// TODO: Use r5commentlocation setting
    //     const _settings = (await context.settings.getAll()) as unknown as BotSettings;
// TODO: Use this setting
    //     const _location = settings.r5commentlocation || 'both';

    const allComments = await post.comments.all();

    // Filter by location if needed
    // Note: location can be 'selftext', 'comment', or 'both'
    // For 'selftext' - we don't check comments at all (handled in hasValidR5Comment)
    // For 'comment' and 'both' - we check all comments
    // The actual filtering happens in findAuthorComments
    return allComments;
  } catch (error) {
    log({
      level: 'error',
      message: 'Error fetching comments',
      service: 'CommentValidation',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return [];
  }
}

/**
 * Feature 3008: Find Author Comments
 * Filter comments to only those by the post author (top-level only)
 */
async function findAuthorComments(
  post: Post,
  comments: Comment[],
  context: TriggerContext
): Promise<Comment[]> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    const location = settings.r5commentlocation || 'both';
    const authorName = post.authorName?.toLowerCase();

    if (!authorName) {
      return [];
    }

    // Filter by author
    let authorComments = comments.filter(
      (c) => c.authorName?.toLowerCase() === authorName
    );

    // Feature 3009: Ignore bot comments
    const botName = (await context.reddit.getCurrentUser())?.username?.toLowerCase();
    if (botName) {
      authorComments = authorComments.filter(
        (c) => c.authorName?.toLowerCase() !== botName
      );
    }

    // Filter by location
    // For 'comment' - only check top-level comments (direct replies to post)
    // For 'both' - check all author comments
    // 'selftext' is handled in hasValidR5Comment before we get here
    if (location === 'comment') {
      // Only top-level comments (direct replies to post)
      authorComments = authorComments.filter(
        (c) => !c.parentId || c.parentId === post.id
      );
    }

    return authorComments;
  } catch (error) {
    log({
      level: 'error',
      message: 'Error filtering author comments',
      service: 'CommentValidation',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return [];
  }
}

/**
 * Feature 3001, 3002, 3005: Validate R5 Comment
 * Check if comment meets R5 requirements
 */
async function validateR5Comment(
  comment: Comment,
  settings: BotSettings
): Promise<R5ValidationResult> {
  const text = comment.body || '';
  const textLength = text.trim().length;

  // Feature 3002: Minimum Comment Length Check
  const minCommentLength = settings.mincommentlength || 50;
  if (!meetsMinimumLength(text, minCommentLength)) {
    return {
      hasValidR5: false,
      reason: `Comment too short (${textLength} < ${minCommentLength} chars)`,
    };
  }

  // Feature 3003: Report Length Threshold Check
  // If comment is above minimum but below report threshold, mark for reporting
  const reportLength = settings.reportcommentlength || minCommentLength;
  const shouldReport = reportLength > minCommentLength && textLength < reportLength;

  // Feature 3005: Keyword Pattern Matching
  // Check all R5 validation rules

  // containsOne - Must contain at least one keyword
  const containsOneKeywords = parseKeywordList(settings.r5containsone);
  if (containsOneKeywords.length > 0) {
    if (!containsOne(text, containsOneKeywords)) {
      return {
        hasValidR5: false,
        reason: 'Missing required keyword (containsOne)',
      };
    }
  }

  // containsAll - Must contain all keywords
  const containsAllKeywords = parseKeywordList(settings.r5containsall);
  if (containsAllKeywords.length > 0) {
    if (!containsAll(text, containsAllKeywords)) {
      return {
        hasValidR5: false,
        reason: 'Missing required keywords (containsAll)',
      };
    }
  }

  // startsWith - Must start with keyword
  const startsWithKeywords = parseKeywordList(settings.r5startswith);
  if (startsWithKeywords.length > 0) {
    if (!startsWith(text, startsWithKeywords)) {
      return {
        hasValidR5: false,
        reason: 'Comment does not start with required keyword',
      };
    }
  }

  // endsWith - Must end with keyword
  const endsWithKeywords = parseKeywordList(settings.r5endswith);
  if (endsWithKeywords.length > 0) {
    if (!endsWith(text, endsWithKeywords)) {
      return {
        hasValidR5: false,
        reason: 'Comment does not end with required keyword',
      };
    }
  }

  // All checks passed
  if (shouldReport) {
    return {
      hasValidR5: true,
      reason: `Valid but short R5 comment (${textLength} chars, report threshold: ${reportLength})`,
      shouldReport: true,
      comment,
    };
  }

  return {
    hasValidR5: true,
    reason: 'Valid R5 comment found',
    shouldReport: false,
    comment,
  };
}

/**
 * Helper: Check if post has ANY author comment (regardless of quality)
 * Used for reporting/analytics
 */
export async function hasAuthorComment(
  post: Post,
  context: TriggerContext
): Promise<boolean> {
  try {
    const comments = await fetchPostComments(post, context);
    const authorComments = await findAuthorComments(post, comments, context);
    return authorComments.length > 0;
  } catch (error) {
    log({
      level: 'error',
      message: 'Error checking author comment',
      service: 'CommentValidation',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return false;
  }
}

/**
 * Feature 3006: Report R5 to Moderators
 * Report a comment that is too short or low quality
 */
export async function reportR5Comment(
  comment: Comment,
  reason: string,
  context: TriggerContext
): Promise<void> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    const reportReason = settings.reportreasontooshort || 'Rule 5 explanation too short or low quality';

    await context.reddit.report(comment, {
      reason: reportReason,
    });

    log({ level: 'info', message: `Reported R5 comment ${comment.id}: ${reason}`, service: 'CommentValidation' });

    // Send notification if enabled
    const { sendNotification } = await import('./notificationService.js');
    const post = await context.reddit.getPostById(comment.postId);
    if (post) {
      const subreddit = await context.reddit.getCurrentSubreddit();
      await sendNotification(
        {
          event: 'r5_report',
          username: comment.authorName || '[deleted]',
          subreddit: subreddit.name,
          postUrl: `https://reddit.com${post.permalink}`,
          reason: reason,
        },
        context
      );
    }
  } catch (error) {
    log({
      level: 'error',
      message: 'Error reporting R5 comment',
      service: 'CommentValidation',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Fail open
  }
}
