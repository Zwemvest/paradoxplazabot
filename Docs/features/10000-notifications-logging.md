# 10000 - Notifications & Logging

## Overview
Multi-platform notifications and structured logging for monitoring bot activity and errors.

---

## Features

### 10001 - Slack Integration
**Description:** Send notifications to Slack workspace via incoming webhooks.

**Implementation:**
```typescript
async function sendSlackNotification(
  message: string,
  context: Context
): Promise<void> {
  const settings = await context.settings.getAll();
  const enabled = settings.enableslack as boolean;
  const webhookUrl = settings.slackwebhook as string;

  if (!enabled || !webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}
```

**Configuration:**
- Setting: `enableslack` (boolean)
- Setting: `slackwebhook` (string, secret)

---

### 10002 - Discord Integration
**Description:** Send notifications to Discord server via webhooks.

**Implementation:**
```typescript
async function sendDiscordNotification(
  message: string,
  context: Context
): Promise<void> {
  const settings = await context.settings.getAll();
  const enabled = settings.enablediscord as boolean;
  const webhookUrl = settings.discordwebhook as string;

  if (!enabled || !webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
}
```

**Configuration:**
- Setting: `enablediscord` (boolean)
- Setting: `discordwebhook` (string, secret)

---

### 10003 - Rich Notification Formatting
**Description:** Send structured, rich-formatted notifications.

**Slack Format (Blocks):**
```typescript
interface SlackNotification {
  blocks: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
    };
    fields?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

async function sendRichSlackNotification(
  notification: SlackNotification,
  context: Context
): Promise<void> {
  const settings = await context.settings.getAll();
  const webhookUrl = settings.slackwebhook as string;

  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification),
  });
}

// Example usage
await sendRichSlackNotification({
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Post Removed* :no_entry:',
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Post:*\n<${postUrl}|${postTitle}>` },
        { type: 'mrkdwn', text: `*Author:*\n/u/${author}` },
        { type: 'mrkdwn', text: `*Subreddit:*\nr/${subreddit}` },
        { type: 'mrkdwn', text: `*Reason:*\nNo R5 comment after warning` },
      ],
    },
  ],
}, context);
```

**Discord Format (Embeds):**
```typescript
interface DiscordEmbed {
  embeds: Array<{
    title: string;
    description: string;
    color: number;
    fields: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    timestamp: string;
  }>;
}

async function sendRichDiscordNotification(
  notification: DiscordEmbed,
  context: Context
): Promise<void> {
  const settings = await context.settings.getAll();
  const webhookUrl = settings.discordwebhook as string;

  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification),
  });
}

// Example usage
await sendRichDiscordNotification({
  embeds: [{
    title: 'Post Removed',
    description: 'A post was removed for Rule 5 violation',
    color: 0xff0000, // Red
    fields: [
      { name: 'Post', value: `[${postTitle}](${postUrl})`, inline: false },
      { name: 'Author', value: `/u/${author}`, inline: true },
      { name: 'Subreddit', value: `r/${subreddit}`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  }],
}, context);
```

---

### 10004 - Notification Events
**Description:** Specific events that trigger notifications.

**Event Types:**

#### Warning Posted
```typescript
async function notifyWarning(post: Post, context: Context): Promise<void> {
  const settings = await context.settings.getAll();
  if (!settings.notifyonwarning) return;

  const message = `⚠️ Warning posted on <${getPostUrl(post)}|post> by /u/${post.authorName} in r/${(await post.getSubreddit()).name}`;

  await sendNotification(message, context);
}
```

#### Post Removed
```typescript
async function notifyRemoval(post: Post, context: Context): Promise<void> {
  const settings = await context.settings.getAll();
  if (!settings.notifyonremoval) return;

  const subreddit = await post.getSubreddit();
  const message = `🚫 Deleted post <https://reddit.com${post.permalink}|${post.title}> from /u/${post.authorName} in r/${subreddit.name} - no R5 comment after warning`;

  await sendNotification(message, context);
}
```

#### Post Approved
```typescript
async function notifyApproval(post: Post, context: Context): Promise<void> {
  const settings = await context.settings.getAll();
  if (!settings.notifyonapproval) return;

  const subreddit = await post.getSubreddit();
  const message = `✅ Approved post <https://reddit.com${post.permalink}|${post.title}> from /u/${post.authorName} in r/${subreddit.name} - R5 comment added`;

  await sendNotification(message, context);
}
```

#### Modmail Approval
```typescript
async function notifyModmailApproval(
  post: Post,
  conversation: ModMailConversation,
  context: Context
): Promise<void> {
  const subreddit = await post.getSubreddit();
  const message = `📧 Approved post <https://reddit.com${post.permalink}|${post.title}> from /u/${post.authorName} via <https://mod.reddit.com/mail/all/${conversation.id}|modmail> in r/${subreddit.name}`;

  await sendNotification(message, context);
}
```

#### Errors
```typescript
async function notifyError(error: Error, context: string): Promise<void> {
  const message = `❌ Error in ${context}: ${error.message}`;
  await sendNotification(message, context);
}
```

---

### 10005 - Devvit Native Logging
**Description:** Use Devvit's built-in logging for debugging and monitoring.

**Implementation:**
```typescript
// Available log levels
console.log('Info message');
console.warn('Warning message');
console.error('Error message');
console.debug('Debug message'); // Only in debug mode

// Structured logging
function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  data: object
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };

  console[level](JSON.stringify(logData));
}

// Usage
logEvent('info', 'post.warning.posted', {
  postId: post.id,
  author: post.authorName,
  subreddit: subreddit.name,
});
```

---

### 10006 - Structured Logging Format
**Description:** Consistent log format for parsing and analysis.

**Log Format:**
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  postId?: string;
  author?: string;
  subreddit?: string;
  message?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function log(entry: Partial<LogEntry>): void {
  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'unknown',
    ...entry,
  };

  console[fullEntry.level](JSON.stringify(fullEntry));
}

// Usage
log({
  level: 'info',
  event: 'post.removal.executed',
  postId: 'abc123',
  author: 'johndoe',
  subreddit: 'paradoxplaza',
  message: 'Post removed after warning period elapsed',
});
```

---

### 10007 - Event Types Taxonomy
**Description:** Standard event names for consistent logging.

**Event Naming Convention:** `domain.action.status`

**Events:**

**Post Monitoring:**
- `post.detected.new` - New post detected
- `post.detected.image` - Image post identified
- `post.detected.skip` - Post skipped (allowlist, flair, etc.)

**Validation:**
- `post.validation.passed` - Post doesn't need enforcement
- `post.validation.failed` - Post needs enforcement
- `post.validation.error` - Validation error

**Warning:**
- `post.warning.scheduled` - Warning check scheduled
- `post.warning.posted` - Warning comment posted
- `post.warning.skipped` - Warning skipped (has R5)
- `post.warning.error` - Warning failed

**Removal:**
- `post.removal.scheduled` - Removal check scheduled
- `post.removal.executed` - Post removed
- `post.removal.skipped` - Removal skipped (has R5)
- `post.removal.error` - Removal failed

**Reinstatement:**
- `post.reinstatement.detected` - R5 comment detected
- `post.reinstatement.approved` - Post approved
- `post.reinstatement.error` - Approval failed

**Modmail:**
- `modmail.received` - R5 modmail received
- `modmail.approved` - Post approved via modmail
- `modmail.rejected` - Modmail request rejected
- `modmail.error` - Modmail processing error

---

### 10008 - Notification Aggregation
**Description:** Group similar notifications to reduce spam.

**Implementation:**
```typescript
class NotificationAggregator {
  private queue: Map<string, any[]> = new Map();
  private timer: NodeJS.Timeout | null = null;

  add(eventType: string, data: any): void {
    if (!this.queue.has(eventType)) {
      this.queue.set(eventType, []);
    }

    this.queue.get(eventType)!.push(data);

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 60000); // 1 minute
    }
  }

  async flush(): Promise<void> {
    for (const [eventType, events] of this.queue) {
      if (events.length > 0) {
        await this.sendAggregatedNotification(eventType, events);
      }
    }

    this.queue.clear();
    this.timer = null;
  }

  private async sendAggregatedNotification(
    eventType: string,
    events: any[]
  ): Promise<void> {
    const message = `${events.length} ${eventType} events in the last minute:\n${events.map(e => `- ${e.summary}`).join('\n')}`;
    // Send notification...
  }
}
```

---

### 10009 - Error Tracking
**Description:** Capture and report errors with context.

**Implementation:**
```typescript
async function trackError(
  error: Error,
  context: {
    operation: string;
    postId?: string;
    [key: string]: any;
  }
): Promise<void> {
  const errorData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };

  // Log to console
  console.error(JSON.stringify(errorData));

  // Send notification if critical
  if (isCriticalError(error)) {
    await sendNotification(
      `🚨 Critical error in ${context.operation}: ${error.message}`,
      context
    );
  }
}

function isCriticalError(error: Error): boolean {
  // Define critical errors
  return error.name === 'PermissionError' ||
         error.message.includes('rate limit') ||
         error.message.includes('authentication');
}
```

---

### 10010 - Notification Rate Limiting
**Description:** Prevent notification spam by rate limiting.

**Implementation:**
```typescript
class RateLimiter {
  private lastSent: Map<string, number> = new Map();
  private minInterval = 60000; // 1 minute

  async canSend(key: string): Promise<boolean> {
    const now = Date.now();
    const lastTime = this.lastSent.get(key);

    if (!lastTime || (now - lastTime) >= this.minInterval) {
      this.lastSent.set(key, now);
      return true;
    }

    return false;
  }
}

const notificationRateLimiter = new RateLimiter();

async function sendNotification(
  message: string,
  context: Context
): Promise<void> {
  // Create a key based on message type
  const key = message.substring(0, 20); // First 20 chars

  if (await notificationRateLimiter.canSend(key)) {
    await sendSlackNotification(message, context);
    await sendDiscordNotification(message, context);
  }
}
```

---

### 10011 - Notification Preferences
**Description:** Fine-grained control over what gets notified.

**Settings:**
```typescript
{
  notifyonwarning: false,     // Don't notify on warnings (too frequent)
  notifyonremoval: true,      // Notify on removals (important)
  notifyonapproval: true,     // Notify on approvals (via modmail)
  notifyonerror: true,        // Notify on errors (critical)
  notifylevel: 'important',   // 'all' | 'important' | 'critical'
}
```

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableslack` | boolean | false | Enable Slack notifications |
| `slackwebhook` | string | "" | Slack webhook URL (secret) |
| `enablediscord` | boolean | false | Enable Discord notifications |
| `discordwebhook` | string | "" | Discord webhook URL (secret) |
| `notifyonwarning` | boolean | false | Notify when warning posted |
| `notifyonremoval` | boolean | true | Notify when post removed |
| `notifyonapproval` | boolean | true | Notify when post approved |
| `notifyonerror` | boolean | true | Notify on errors |

---

## Fallback Behavior

**When notifications fail:**
1. Log to console
2. Continue operation (don't block on notification failure)
3. Store failed notifications in Redis for retry
4. Fall back to reporting posts instead of removing (if configured)

---

## Best Practices

✅ **Use rich formatting** - Embeds/blocks are more readable
✅ **Include links** - Link to posts, modmail, etc.
✅ **Be concise** - Short notifications are better
✅ **Rate limit** - Prevent spam
✅ **Aggregate** - Group similar events
✅ **Log everything** - Even if not notifying
✅ **Handle failures** - Don't block on notification errors

❌ **Don't notify too frequently** - Causes alert fatigue
❌ **Don't include secrets** - Never log sensitive data
❌ **Don't block operations** - Notifications are secondary
❌ **Don't retry indefinitely** - Give up after a few attempts
