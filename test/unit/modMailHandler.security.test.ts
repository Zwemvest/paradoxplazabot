/**
 * SECURITY TESTS for modmail handler
 * Verifies bot only reinstates posts IT removed, not posts removed by human mods
 */

import { onModMail } from '../../src/handlers/modMailHandler';
import { wasRemovedByBot } from '../../src/storage/postState';
import { hasValidR5Comment } from '../../src/services/commentValidation';
import { reinstatePost } from '../../src/services/reinstatementSystem';

// Mock the dependencies
jest.mock('../../src/storage/postState');
jest.mock('../../src/services/commentValidation');
jest.mock('../../src/services/reinstatementSystem');

const mockWasRemovedByBot = wasRemovedByBot as jest.MockedFunction<typeof wasRemovedByBot>;
const mockHasValidR5Comment = hasValidR5Comment as jest.MockedFunction<typeof hasValidR5Comment>;
const mockReinstatePost = reinstatePost as jest.MockedFunction<typeof reinstatePost>;

describe('ModMail Handler - SECURITY TESTS', () => {
  let mockContext: any;
  let mockModMailReply: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModMailReply = jest.fn(async () => {});

    mockContext = {
      settings: {
        getAll: jest.fn(async () => ({
          enablemodmail: true,
          modmailkeywords: 'rule 5,r5',
          autoarchivemodmail: false,
          mincommentlength: 50,
          // Modmail templates
          modmailnopostid: '❌ **Unable to process request**\n\nCould not find a valid post ID in your message. Please include a link to your post or the post ID.',
          modmailpostnotfound: '❌ **Post not found**\n\nThe post `{{postid}}` could not be found. It may have been deleted.',
          modmailnotauthor: '❌ **Authorization failed**\n\nYou can only request reinstatement for your own posts.',
          modmailnotbotremoval: '❌ **This post was not removed by the bot**\n\nYour post was removed by a moderator, not the Rule 5 bot. Please contact the moderators directly for assistance.',
          modmailalreadyapproved: '✅ **Post is already approved**\n\nYour post is currently visible and has not been removed.',
          modmailnor5: '❌ **No valid Rule 5 comment found**\n\n{{reason}}\n\nPlease add a Rule 5 comment to your post before requesting reinstatement. Your comment must:\n- Be a top-level comment on the post\n- Be at least {{minlength}} characters long\n- Explain the context of your image/content',
          modmailsuccess: '✅ **Post reinstated successfully!**\n\nYour post has been approved and is now visible.\n\n[View your post]({{permalink}})',
          modmailerror: '❌ **An error occurred**\n\nWe encountered an error while processing your request. Please contact the moderators directly.',
        })),
      },
      reddit: {
        getPostById: jest.fn(async (id: string) => ({
          id,
          authorName: 'testuser',
          title: 'Test Post',
          permalink: `/r/test/comments/${id}/test`,
          removed: false,
        })),
        modMail: {
          getConversation: jest.fn(async () => ({
            conversation: {
              id: 'convo123',
              subject: 'Rule 5 Request',
            },
            messages: [
              {
                id: 'msg456',
                bodyMarkdown: 'Please reinstate https://reddit.com/r/test/comments/post123/title',
                author: {
                  name: 'testuser',
                },
              },
            ],
          })),
          reply: mockModMailReply,
          archiveConversation: jest.fn(async () => {}),
        },
      },
    };
  });

  describe('SECURITY: Bot Removal Verification', () => {
    it('should REJECT if post was removed by human moderator (not bot)', async () => {
      const event = {
        conversationId: 'convo123',
        messageId: 'msg456',
      };

      // CRITICAL: Bot did NOT remove this post
      mockWasRemovedByBot.mockResolvedValue(false);

      // Post IS removed (by human mod)
      mockContext.reddit.getPostById = jest.fn(async () => ({
        id: 'post123',
        authorName: 'testuser',
        removed: true, // Post is removed
      }));

      // User has valid R5 (shouldn't matter!)
      mockHasValidR5Comment.mockResolvedValue({
        hasValidR5: true,
        reason: 'Valid R5',
      });

      await onModMail(event as any, mockContext);

      // Should send rejection message
      expect(mockModMailReply).toHaveBeenCalledWith({
        body: expect.stringContaining('not removed by the bot'),
        conversationId: 'convo123',
        isInternal: false,
      });

      // Should NOT reinstate (respects human mod decision)
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });

    it('should APPROVE if post was removed by bot', async () => {
      const event = {
        conversationId: 'convo123',
        messageId: 'msg456',
      };

      // Bot DID remove this post
      mockWasRemovedByBot.mockResolvedValue(true);

      // Post is still removed
      mockContext.reddit.getPostById = jest.fn(async () => ({
        id: 'post123',
        authorName: 'testuser',
        removed: true,
      }));

      // User has valid R5
      mockHasValidR5Comment.mockResolvedValue({
        hasValidR5: true,
        reason: 'Valid R5',
      });

      await onModMail(event as any, mockContext);

      // Should reinstate
      expect(mockReinstatePost).toHaveBeenCalled();

      // Should send success message
      expect(mockModMailReply).toHaveBeenCalledWith({
        body: expect.stringContaining('reinstated successfully'),
        conversationId: 'convo123',
        isInternal: false,
      });
    });

    it('should skip if post is already approved (not removed at all)', async () => {
      const event = {
        conversationId: 'convo123',
        messageId: 'msg456',
      };

      // Bot did not remove it
      mockWasRemovedByBot.mockResolvedValue(false);

      // Post is NOT removed
      mockContext.reddit.getPostById = jest.fn(async () => ({
        id: 'post123',
        authorName: 'testuser',
        removed: false, // Not removed
      }));

      await onModMail(event as any, mockContext);

      // Should send "already approved" message
      expect(mockModMailReply).toHaveBeenCalledWith({
        body: expect.stringContaining('already approved'),
        conversationId: 'convo123',
        isInternal: false,
      });

      // Should NOT check R5 or reinstate
      expect(mockHasValidR5Comment).not.toHaveBeenCalled();
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });
  });

  describe('SECURITY: Scenarios', () => {
    it('Scenario: Moderator removes post for racism, user adds R5 → Bot MUST NOT approve', async () => {
      const event = {
        conversationId: 'convo123',
        messageId: 'msg456',
      };

      // Human mod removed this post (for racism)
      mockWasRemovedByBot.mockResolvedValue(false);
      mockContext.reddit.getPostById = jest.fn(async () => ({
        id: 'post123',
        authorName: 'testuser',
        removed: true,
      }));

      // User added R5 after mod removal
      mockHasValidR5Comment.mockResolvedValue({
        hasValidR5: true,
        reason: 'Valid R5 added',
      });

      await onModMail(event as any, mockContext);

      // Bot must reject - respects human mod decision
      expect(mockModMailReply).toHaveBeenCalledWith({
        body: expect.stringContaining('not removed by the bot'),
        conversationId: 'convo123',
        isInternal: false,
      });
      expect(mockReinstatePost).not.toHaveBeenCalled();
    });

    it('Scenario: Bot removes post, user adds R5 → Bot SHOULD approve', async () => {
      const event = {
        conversationId: 'convo123',
        messageId: 'msg456',
      };

      // Bot removed this post
      mockWasRemovedByBot.mockResolvedValue(true);
      mockContext.reddit.getPostById = jest.fn(async () => ({
        id: 'post123',
        authorName: 'testuser',
        removed: true,
      }));

      // User added R5
      mockHasValidR5Comment.mockResolvedValue({
        hasValidR5: true,
        reason: 'Valid R5',
      });

      await onModMail(event as any, mockContext);

      // Bot should approve - it was bot's own removal
      expect(mockReinstatePost).toHaveBeenCalled();
      expect(mockModMailReply).toHaveBeenCalledWith({
        body: expect.stringContaining('reinstated successfully'),
        conversationId: 'convo123',
        isInternal: false,
      });
    });
  });
});
