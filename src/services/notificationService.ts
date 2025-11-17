/**
 * Notification Service
 * Features: 10001-10004
 *
 * Sends notifications to Slack/Discord webhooks for bot events
 */

import type { TriggerContext } from '@devvit/public-api';
import type { BotSettings, NotificationEvent, NotificationPayload } from '../types';

/**
 * Feature 10001, 10002: Slack and Discord Integration
 * Send notification to configured webhooks
 */
export async function sendNotification(
  payload: NotificationPayload,
  context: TriggerContext
): Promise<void> {
  try {
    const settings = (await context.settings.getAll()) as unknown as BotSettings;

    // Check if this event type should trigger notifications
    const enabledEvents = settings.notificationevents || [];
    if (!enabledEvents.includes(payload.event)) {
      console.log(`[Notifications] Event ${payload.event} not enabled for notifications`);
      return;
    }

    // Feature 10001: Slack Integration
    if (settings.enableslack && settings.slackwebhook) {
      await sendSlackNotification(payload, settings.slackwebhook, context);
    }

    // Feature 10002: Discord Integration
    if (settings.enablediscord && settings.discordwebhook) {
      await sendDiscordNotification(payload, settings.discordwebhook, context);
    }
  } catch (error) {
    console.error('[Notifications] Error sending notification:', error);
    // Fail open - don't block bot operations
  }
}

/**
 * Feature 10001, 10003: Send Slack notification with rich formatting
 */
async function sendSlackNotification(
  payload: NotificationPayload,
  webhookUrl: string,
  context: TriggerContext
): Promise<void> {
  try {
    const color = getEventColor(payload.event);
    const emoji = getEventEmoji(payload.event);

    const slackPayload = {
      attachments: [
        {
          color: color,
          title: `${emoji} ${getEventTitle(payload.event)}`,
          fields: [
            {
              title: 'User',
              value: `u/${payload.username}`,
              short: true,
            },
            {
              title: 'Subreddit',
              value: `r/${payload.subreddit}`,
              short: true,
            },
            {
              title: 'Post',
              value: `<${payload.postUrl}|View Post>`,
              short: false,
            },
            {
              title: 'Reason',
              value: payload.reason,
              short: false,
            },
          ],
          footer: 'Rule 5 Bot',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      console.error(`[Notifications] Slack webhook failed: ${response.status}`);
    } else {
      console.log(`[Notifications] Sent Slack notification for ${payload.event}`);
    }
  } catch (error) {
    console.error('[Notifications] Error sending Slack notification:', error);
  }
}

/**
 * Feature 10002, 10003: Send Discord notification with rich formatting
 */
async function sendDiscordNotification(
  payload: NotificationPayload,
  webhookUrl: string,
  context: TriggerContext
): Promise<void> {
  try {
    const color = getEventColorHex(payload.event);
    const emoji = getEventEmoji(payload.event);

    const discordPayload = {
      embeds: [
        {
          title: `${emoji} ${getEventTitle(payload.event)}`,
          color: color,
          fields: [
            {
              name: 'User',
              value: `u/${payload.username}`,
              inline: true,
            },
            {
              name: 'Subreddit',
              value: `r/${payload.subreddit}`,
              inline: true,
            },
            {
              name: 'Post',
              value: `[View Post](${payload.postUrl})`,
              inline: false,
            },
            {
              name: 'Reason',
              value: payload.reason,
              inline: false,
            },
          ],
          footer: {
            text: 'Rule 5 Bot',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      console.error(`[Notifications] Discord webhook failed: ${response.status}`);
    } else {
      console.log(`[Notifications] Sent Discord notification for ${payload.event}`);
    }
  } catch (error) {
    console.error('[Notifications] Error sending Discord notification:', error);
  }
}

/**
 * Feature 10003: Helper functions for rich formatting
 */

function getEventTitle(event: NotificationEvent): string {
  const titles: Record<NotificationEvent, string> = {
    r5_report: 'R5 Comment Reported',
    r5_invalid: 'Invalid R5 Comment',
    warning: 'Warning Issued',
    removal: 'Post Removed',
    reinstatement: 'Post Reinstated',
    error: 'Bot Error',
  };
  return titles[event] || event;
}

function getEventEmoji(event: NotificationEvent): string {
  const emojis: Record<NotificationEvent, string> = {
    r5_report: '⚠️',
    r5_invalid: '❌',
    warning: '⏰',
    removal: '🚫',
    reinstatement: '✅',
    error: '💥',
  };
  return emojis[event] || '📢';
}

function getEventColor(event: NotificationEvent): string {
  // Slack colors
  const colors: Record<NotificationEvent, string> = {
    r5_report: 'warning',
    r5_invalid: 'danger',
    warning: 'warning',
    removal: 'danger',
    reinstatement: 'good',
    error: 'danger',
  };
  return colors[event] || '#808080';
}

function getEventColorHex(event: NotificationEvent): number {
  // Discord colors (decimal)
  const colors: Record<NotificationEvent, number> = {
    r5_report: 0xffa500, // Orange
    r5_invalid: 0xff0000, // Red
    warning: 0xffa500, // Orange
    removal: 0xff0000, // Red
    reinstatement: 0x00ff00, // Green
    error: 0xff0000, // Red
  };
  return colors[event] || 0x808080; // Gray
}
