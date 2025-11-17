/**
 * ModMail Handler
 * Features: 7001-7010
 *
 * Handles manual reinstatement requests via modmail
 */

import type { TriggerContext } from '@devvit/public-api';
import type { ModMail } from '@devvit/protos';
import type { BotSettings } from '../types';
import { wasRemovedByBot } from '../storage/postState.js';
import { hasValidR5Comment } from '../services/commentValidation.js';
import { reinstatePost } from '../services/reinstatementSystem.js';
import { substituteVariables } from '../utils/templates.js';
import { log } from '../utils/logger.js';

// Type for modmail conversation response
interface ModMailConversation {
  conversation?: {
    subject?: string;
  };
  messages?: Array<{
    bodyMarkdown?: string;
    author?: {
      name?: string;
    };
  }>;
}

/**
 * Feature 7001: Monitor Modmail for R5 Subjects
 * Main entry point for modmail processing
 */
export async function onModMail(event: ModMail, context: TriggerContext): Promise<void> {
  try {
    // Event contains conversationId and messageId
    const conversationId = event.conversationId;
    const messageId = event.messageId;

    if (!conversationId || !messageId) {
      log({ level: 'error', message: 'Missing conversationId or messageId in modmail event' });
      return;
    }

    log({ level: 'info', message: `Processing modmail conversation: ${conversationId}` });

    const settings = (await context.settings.getAll()) as unknown as BotSettings;

    // Check if modmail is enabled
    if (!settings.enablemodmail) {
      log({ level: 'info', message: 'Modmail processing disabled' });
      return;
    }

    // Get conversation details to check subject
    const conversation = (await context.reddit.modMail.getConversation({ conversationId })) as ModMailConversation;

    if (!conversation || !conversation.conversation) {
      log({ level: 'error', message: 'Could not fetch modmail conversation' });
      return;
    }

    // Check subject contains R5 keywords
    const subject = conversation.conversation.subject?.toLowerCase() || '';
    const keywords = (settings.modmailkeywords || 'rule 5,r5,rule5').toLowerCase().split(',');

    const containsKeyword = keywords.some(keyword =>
      subject.includes(keyword.trim())
    );

    if (!containsKeyword) {
      log({ level: 'info', message: `Modmail subject doesn't contain R5 keywords: "${conversation.conversation.subject}"` });
      return;
    }

    log({ level: 'info', message: 'R5 reinstatement request detected in modmail' });

    // Feature 7010: Complete Modmail Processing Flow
    await processModMailReinstatement(conversationId, conversation, context);

  } catch (error) {
    log({ level: 'error', message: 'Error processing modmail', error: error instanceof Error ? error : undefined });
    // Fail open - don't throw
  }
}

/**
 * Feature 7010: Complete Modmail Processing Flow
 * Processes reinstatement request from modmail
 */
async function processModMailReinstatement(
  conversationId: string,
  conversation: ModMailConversation,
  context: TriggerContext
): Promise<void> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;

    // Get the latest message body
    const messages = conversation.messages || [];
    const latestMessage = messages[messages.length - 1];
    const messageBody = latestMessage?.bodyMarkdown || '';

    // Feature 7002: Extract Post ID from Modmail Body
    const postId = extractPostId(messageBody);

    if (!postId) {
      // Feature 7009: Handle Invalid Modmail Requests
      await replyToModMail(
        conversationId,
        context,
        settings.modmailnopostid,
        false
      );
      return;
    }

    log({ level: 'info', message: `Extracted post ID from modmail: ${postId}` });

    // Get the post
    const post = await context.reddit.getPostById(postId);

    if (!post) {
      const message = substituteVariables(settings.modmailpostnotfound, { postid: postId });
      await replyToModMail(conversationId, context, message, false);
      return;
    }

    // Feature 7003: Verify Author Matches
    const modmailAuthor = latestMessage?.author?.name?.toLowerCase();
    const postAuthor = post.authorName?.toLowerCase();

    if (!modmailAuthor || !postAuthor || modmailAuthor !== postAuthor) {
      await replyToModMail(
        conversationId,
        context,
        settings.modmailnotauthor,
        false
      );
      return;
    }

    // Feature 7004: Check If Bot Removed Post
    const wasRemoved = await wasRemovedByBot(postId, context);

    // SECURITY: Only approve posts the bot removed itself
    if (!wasRemoved && post.removed) {
      // Post was removed by someone else (human moderator)
      await replyToModMail(
        conversationId,
        context,
        settings.modmailnotbotremoval,
        false
      );
      return;
    }

    if (!wasRemoved && !post.removed) {
      // Post isn't removed at all
      await replyToModMail(
        conversationId,
        context,
        settings.modmailalreadyapproved,
        true
      );
      return;
    }

    // Feature 7005: Verify R5 Comment Exists
    const r5Result = await hasValidR5Comment(post, context);

    if (!r5Result.hasValidR5) {
      const message = substituteVariables(settings.modmailnor5, {
        reason: r5Result.reason,
        minlength: settings.mincommentlength.toString(),
      });
      await replyToModMail(conversationId, context, message, false);
      return;
    }

    // Feature 7006: Approve Post via Modmail Request
    log({ level: 'info', message: `Reinstating post via modmail: ${postId}` });
    await reinstatePost(post, context);

    // Feature 7007: Reply to Modmail
    const successMessage = substituteVariables(settings.modmailsuccess, {
      permalink: `https://reddit.com${post.permalink}`,
    });
    await replyToModMail(conversationId, context, successMessage, true);

    log({ level: 'info', message: `Successfully processed reinstatement: ${postId}` });

  } catch (error) {
    log({ level: 'error', message: 'Error during reinstatement processing', error: error instanceof Error ? error : undefined });

    // Try to send error message
    try {
      const settings = (await context.settings.getAll()) as unknown as BotSettings;
      await replyToModMail(conversationId, context, settings.modmailerror, false);
    } catch (replyError) {
      log({ level: 'error', message: 'Could not send error reply to modmail', error: replyError instanceof Error ? replyError : undefined });
    }
  }
}

/**
 * Feature 7002: Extract Post ID from Modmail Body
 * Extracts post ID from various Reddit URL formats
 */
function extractPostId(text: string): string | null {
  if (!text) return null;

  // Try to find Reddit post URLs
  // Format: reddit.com/r/subreddit/comments/POST_ID/
  const urlMatch = text.match(/reddit\.com\/r\/\w+\/comments\/([a-z0-9]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Format: redd.it/POST_ID
  const shortMatch = text.match(/redd\.it\/([a-z0-9]+)/i);
  if (shortMatch) {
    return shortMatch[1];
  }

  // Try to find standalone post ID (alphanumeric, 6-7 chars, must contain at least one digit)
  // Reddit post IDs typically have mixed alphanumeric characters
  const idMatch = text.match(/\b([a-z0-9]{6,7})\b/i);
  if (idMatch && /\d/.test(idMatch[1])) {
    return idMatch[1];
  }

  return null;
}

/**
 * Feature 7007: Reply to Modmail
 * Sends reply to modmail conversation
 */
async function replyToModMail(
  conversationId: string,
  context: TriggerContext,
  message: string,
  shouldArchive: boolean
): Promise<void> {
  try {
    // Send reply using context.reddit.modMail.reply
    await context.reddit.modMail.reply({
      body: message,
      conversationId: conversationId,
      isInternal: false,
    });

    log({ level: 'info', message: `Sent reply to modmail: ${conversationId}` });

    // Feature 7008: Archive Modmail Conversation (if enabled and successful)
    const settings = (await context.settings.getAll()) as unknown as BotSettings;
    if (shouldArchive && settings.autoarchivemodmail) {
      try {
        await context.reddit.modMail.archiveConversation(conversationId);
        log({ level: 'info', message: `Archived modmail: ${conversationId}` });
      } catch (archiveError) {
        log({ level: 'error', message: 'Could not archive modmail', error: archiveError instanceof Error ? archiveError : undefined });
        // Don't throw - reply was successful
      }
    }
  } catch (error) {
    log({ level: 'error', message: 'Error replying to modmail', error: error instanceof Error ? error : undefined });
    throw error; // Propagate to caller
  }
}
