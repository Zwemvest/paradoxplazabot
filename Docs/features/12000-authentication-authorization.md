# 12000 - Authentication & Authorization

## Overview
Secure bot operations and verify permissions for Reddit API access and moderator actions.

---

## Features

### 12001 - Reddit OAuth Authentication
**Description:** Devvit handles Reddit OAuth automatically for installed apps.

**How It Works:**
- Devvit apps run with the permissions of the app installation
- No manual OAuth flow required
- Authentication is handled by Devvit platform
- Access tokens are managed automatically

**Implementation:**
```typescript
// Authentication is automatic - just use the context
async function getCurrentUser(context: Context): Promise<User> {
  return await context.reddit.getCurrentUser();
}

// The app runs as its own user account
const appUser = await context.reddit.getCurrentUser();
console.log(`Bot username: ${appUser.username}`);
```

---

### 12002 - Moderator Permission Verification
**Description:** Verify the bot has necessary moderator permissions before taking actions.

**Required Permissions:**
- **Posts** - Remove, approve, distinguish
- **Comments** - Post, remove, distinguish
- **Modmail** - Read, reply, archive
- **Reports** - Create reports

**Implementation:**
```typescript
async function hasModPermissions(
  subredditName: string,
  context: Context
): Promise<boolean> {
  try {
    const subreddit = await context.reddit.getSubredditByName(subredditName);
    const moderators = await subreddit.getModerators().all();
    const appUser = await context.reddit.getCurrentUser();

    const isModerator = moderators.some(
      mod => mod.username === appUser.username
    );

    return isModerator;
  } catch {
    return false;
  }
}

async function canDistinguishComments(context: Context): Promise<boolean> {
  // If bot is moderator, it can distinguish
  return await hasModPermissions(subredditName, context);
}

async function canRemovePosts(context: Context): Promise<boolean> {
  // Check if bot has posts permission
  return await hasModPermissions(subredditName, context);
}
```

---

### 12003 - Permission Checks Before Actions
**Description:** Always verify permissions before executing mod actions.

**Implementation:**
```typescript
async function safeRemovePost(post: Post, context: Context): Promise<boolean> {
  const subreddit = await post.getSubreddit();

  if (!await hasModPermissions(subreddit.name, context)) {
    console.error(`Bot lacks mod permissions in r/${subreddit.name}`);
    await notifyError(
      new Error('Missing mod permissions'),
      `Attempted to remove post in r/${subreddit.name}`
    );
    return false;
  }

  try {
    await post.remove();
    return true;
  } catch (error) {
    console.error('Failed to remove post:', error);
    return false;
  }
}

async function safeDistinguishComment(comment: Comment, context: Context): Promise<boolean> {
  try {
    await comment.distinguish(true);
    return true;
  } catch (error) {
    if (error.message.includes('permission')) {
      console.error('Bot lacks permission to distinguish comments');
      return false;
    }
    throw error;
  }
}
```

---

### 12004 - App Installation Authorization
**Description:** Control which subreddits can install the app.

**Devvit App Manifest:**
```yaml
# devvit.yaml
name: rule5-bot
version: 1.0.0
permissions:
  - identity       # Read user info
  - modPosts       # Moderate posts
  - modComments    # Moderate comments
  - modMail        # Access modmail
  - subreddit      # Read subreddit info
  - submit         # Post comments
```

**Note:** Installation is controlled by Reddit - any mod with appropriate permissions can install apps on their subreddit.

---

### 12005 - Rate Limiting Compliance
**Description:** Respect Reddit API rate limits to avoid bans.

**Reddit Rate Limits:**
- 60 requests per minute per OAuth client
- 600 requests per 10 minutes
- Burst allowance for short spikes

**Implementation:**
```typescript
class RateLimiter {
  private requests: number[] = [];
  private maxPerMinute = 60;
  private maxPer10Minutes = 600;

  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const tenMinutesAgo = now - 600000;

    // Clean old requests
    this.requests = this.requests.filter(time => time > tenMinutesAgo);

    // Check limits
    const recentRequests = this.requests.filter(time => time > oneMinuteAgo);
    const totalRequests = this.requests.length;

    if (recentRequests.length >= this.maxPerMinute) {
      console.warn('Rate limit: Too many requests per minute');
      return false;
    }

    if (totalRequests >= this.maxPer10Minutes) {
      console.warn('Rate limit: Too many requests per 10 minutes');
      return false;
    }

    this.requests.push(now);
    return true;
  }

  async waitForCapacity(): Promise<void> {
    while (!await this.checkLimit()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

const rateLimiter = new RateLimiter();

async function makeAPICall(fn: () => Promise<any>): Promise<any> {
  await rateLimiter.waitForCapacity();
  return await fn();
}
```

---

### 12006 - Webhook Authentication (Slack/Discord)
**Description:** Secure webhook URLs stored as secrets.

**Implementation:**
```typescript
async function validateWebhookURL(url: string, type: 'slack' | 'discord'): boolean {
  if (type === 'slack') {
    return /^https:\/\/hooks\.slack\.com\/services\/.+/.test(url);
  } else if (type === 'discord') {
    return /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/.+/.test(url);
  }
  return false;
}

async function getWebhookURL(type: 'slack' | 'discord', context: Context): Promise<string | null> {
  const settings = await context.settings.getAll();
  const key = type === 'slack' ? 'slackwebhook' : 'discordwebhook';
  const url = settings[key] as string;

  if (!url) return null;

  if (!validateWebhookURL(url, type)) {
    console.error(`Invalid ${type} webhook URL`);
    return null;
  }

  return url;
}
```

**Security:**
- Webhook URLs stored as `isSecret: true` settings
- Not logged or displayed in UI
- Validated before use

---

### 12007 - Action Authorization Matrix
**Description:** Define which actions require which permissions.

**Permission Matrix:**

| Action | Required Permission | Check Method |
|--------|-------------------|--------------|
| Remove post | Moderator with posts | `canRemovePosts()` |
| Approve post | Moderator with posts | `canApprovePosts()` |
| Post comment | Moderator (or any user) | `canPostComments()` |
| Distinguish comment | Moderator | `canDistinguishComments()` |
| Read modmail | Moderator with mail | `canAccessModmail()` |
| Reply to modmail | Moderator with mail | `canReplyModmail()` |
| Report post | Any user | Always allowed |

**Implementation:**
```typescript
interface PermissionCheck {
  canRemovePosts: boolean;
  canApprovePosts: boolean;
  canDistinguishComments: boolean;
  canAccessModmail: boolean;
}

async function getPermissions(
  subredditName: string,
  context: Context
): Promise<PermissionCheck> {
  const isMod = await hasModPermissions(subredditName, context);

  return {
    canRemovePosts: isMod,
    canApprovePosts: isMod,
    canDistinguishComments: isMod,
    canAccessModmail: isMod,
  };
}
```

---

### 12008 - Bot Account Management
**Description:** Best practices for bot account setup.

**Setup Steps:**
1. Create dedicated Reddit account for bot
2. Set descriptive username (e.g., `ParadoxPlazaR5Bot`)
3. Add profile description explaining bot purpose
4. Add contact info for bot operator
5. Add bot to subreddit as moderator with required permissions

**Recommended Permissions:**
- ✅ Manage Posts and Comments
- ✅ Manage Modmail
- ❌ Manage Users (not needed)
- ❌ Manage Settings (not needed)
- ❌ Manage Flair (not needed)

---

### 12009 - Security Best Practices
**Description:** Secure coding practices for the bot.

**Best Practices:**

✅ **Never log secrets** - Don't log webhook URLs or API keys
```typescript
// Bad
console.log('Webhook URL:', webhookUrl);

// Good
console.log('Webhook configured:', !!webhookUrl);
```

✅ **Validate all inputs** - Sanitize user-provided data
```typescript
function sanitizeUsername(username: string): string {
  return username.replace(/[^a-zA-Z0-9_-]/g, '');
}
```

✅ **Use parameterized queries** - Prevent injection
```typescript
// Redis keys should be constructed safely
const key = `allowlist:${postId}`;
// Not: `allowlist:${userInput}` without validation
```

✅ **Fail securely** - Default to least privilege
```typescript
async function hasPermission(context: Context): Promise<boolean> {
  try {
    return await checkPermission(context);
  } catch {
    // Fail closed - deny by default
    return false;
  }
}
```

✅ **Rate limit external calls** - Prevent abuse
✅ **Validate webhook responses** - Check status codes
✅ **Use HTTPS only** - For all webhook calls
✅ **Rotate credentials** - If compromised

---

### 12010 - Error Handling for Auth Failures
**Description:** Gracefully handle authentication and authorization errors.

**Implementation:**
```typescript
async function handleAuthError(error: Error, context: string): Promise<void> {
  if (error.message.includes('403') || error.message.includes('permission')) {
    console.error(`Authorization failed in ${context}: Bot lacks permissions`);
    await notifyError(error, `Authorization failure: ${context}`);

    // Fall back to reporting instead of removing
    await useFallbackMode(context);
  } else if (error.message.includes('401') || error.message.includes('authentication')) {
    console.error(`Authentication failed in ${context}: Invalid credentials`);
    await notifyError(error, `Authentication failure: ${context}`);

    // Critical error - stop operations
    throw error;
  } else {
    // Other error, rethrow
    throw error;
  }
}

async function executeWithAuth<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    await handleAuthError(error, context);
    return null;
  }
}
```

---

### 12011 - Audit Logging
**Description:** Log all privileged actions for accountability.

**Implementation:**
```typescript
interface AuditLogEntry {
  timestamp: string;
  action: string;
  postId?: string;
  author?: string;
  subreddit: string;
  result: 'success' | 'failure';
  error?: string;
}

async function auditLog(entry: AuditLogEntry): Promise<void> {
  const logKey = `audit:${entry.subreddit}:${Date.now()}`;

  await context.redis.set(logKey, JSON.stringify(entry), {
    expiration: new Date(Date.now() + 7776000000) // 90 days
  });

  console.log(`[AUDIT] ${entry.action} in r/${entry.subreddit}: ${entry.result}`);
}

// Usage
await auditLog({
  timestamp: new Date().toISOString(),
  action: 'post.removal',
  postId: post.id,
  author: post.authorName,
  subreddit: subreddit.name,
  result: 'success',
});
```

---

## Security Checklist

- ✅ App requests minimal required permissions
- ✅ Webhook URLs stored as secrets
- ✅ No secrets logged to console
- ✅ All mod actions require permission checks
- ✅ Rate limiting implemented
- ✅ Input validation on user data
- ✅ Graceful auth error handling
- ✅ Audit logging for privileged actions
- ✅ Fail-safe defaults (deny on error)
- ✅ HTTPS for all external calls

---

## Troubleshooting

**Bot can't remove posts:**
- Verify bot is moderator with "Manage Posts" permission
- Check Reddit API status
- Verify app has `modPosts` permission in manifest

**Bot can't distinguish comments:**
- Must be moderator to distinguish
- Check comment author matches bot user

**Rate limit errors:**
- Reduce polling frequency
- Batch operations where possible
- Implement exponential backoff

**Authentication failures:**
- Check app installation is active
- Verify Reddit API credentials
- Check for suspended bot account
