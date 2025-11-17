# 5000 - Removal System

## Overview
Remove posts that don't comply with Rule 5 after the warning period has elapsed.

---

## Features

### 5001 - Warning Period Tracking
**Description:** Track time elapsed since warning was posted.

**Implementation:**
```typescript
async function getWarningPeriod(context: Context): Promise<number> {
  const settings = await context.settings.getAll();
  return (settings.warningperiod as number) || 600; // Default: 10 minutes
}

async function getTimeSinceWarning(postId: string, context: Context): Promise<number> {
  const warningTime = await getWarningTime(postId, context);
  if (!warningTime) return 0;

  const now = Date.now();
  return Math.floor((now - warningTime.getTime()) / 1000); // Seconds
}

async function isWarningPeriodElapsed(postId: string, context: Context): Promise<boolean> {
  const warningPeriod = await getWarningPeriod(context);
  const timeSinceWarning = await getTimeSinceWarning(postId, context);
  return timeSinceWarning >= warningPeriod;
}
```

**Configuration:**
- Setting: `warningperiod` (number, seconds, default: 600)

---

### 5002 - Schedule Removal Check
**Description:** Schedule job to check if post should be removed after warning period.

**Implementation:**
```typescript
async function scheduleRemovalCheck(postId: string, context: Context): Promise<void> {
  const warningPeriod = await getWarningPeriod(context);
  const runAt = new Date(Date.now() + warningPeriod * 1000);

  await context.scheduler.runJob({
    name: 'checkForRemoval',
    data: { postId },
    runAt,
  });
}

Devvit.addSchedulerJob({
  name: 'checkForRemoval',
  onRun: async (event, context) => {
    const { postId } = event.data as { postId: string };

    const post = await context.reddit.getPostById(postId);

    // Check if R5 comment was added during warning period
    if (await hasValidR5Comment(post, context)) {
      await reinstatePost(post, context);
      return;
    }

    // Verify warning exists
    if (!await hasWarning(postId, context)) {
      return; // No warning, don't remove
    }

    // Check if already removed
    if (await isAlreadyRemoved(postId, context)) {
      return;
    }

    // Remove the post
    await removePost(post, context);
  }
});
```

---

### 5003 - Verify Warning Exists Before Removal
**Description:** Only remove posts that were previously warned (safety check).

**Implementation:**
```typescript
async function canRemovePost(postId: string, context: Context): Promise<boolean> {
  // Must have warning
  if (!await hasWarning(postId, context)) {
    return false;
  }

  // Warning period must have elapsed
  if (!await isWarningPeriodElapsed(postId, context)) {
    return false;
  }

  // Must not already be removed
  if (await isAlreadyRemoved(postId, context)) {
    return false;
  }

  return true;
}
```

---

### 5004 - Generate Removal Message
**Description:** Create removal comment using template with variable substitution.

**Implementation:**
```typescript
async function getRemovalTemplate(context: Context): Promise<string> {
  const settings = await context.settings.getAll();
  return (settings.removaltemplate as string) || `Hi /u/{{username}},

Your submission has been removed from /r/{{subreddit}} for breaking rule #5:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

If this was the only rule broken, we will reapprove your submission if you add background info.

Please [contact us through modmail](https://www.reddit.com/message/compose?to=/r/{{subreddit}}&subject=Rule%205%3A%20Screenshot%20is%20missing%20background%20info&message=Hello%20lovely%20moderators%2C%0A%0AI%20have%20added%20a%20descriptive%20comment%20to%20my%20post%2C%20%5Bhere%5D({{permalink}}).%0AAs%20such%2C%20I%20kindly%20request%20that%20you%20re-approve%20my%20post.%20%0A%0ACordially%2C%0A{{username}}) to get it reapproved.

Replying to this comment or sending a private message to this bot will not get your post reinstated; we only respond to the modmail.`;
}

async function generateRemovalMessage(post: Post, context: Context): Promise<string> {
  const template = await getRemovalTemplate(context);
  const subreddit = await post.getSubreddit();

  return substituteVariables(template, {
    username: post.authorName || '[deleted]',
    subreddit: subreddit.name,
    permalink: `https://reddit.com${post.permalink}`,
    postid: post.id,
  });
}
```

**Configuration:**
- Setting: `removaltemplate` (string, paragraph)

**Template Variables:**
- `{{username}}` - Post author's username
- `{{subreddit}}` - Subreddit name
- `{{permalink}}` - Full post URL
- `{{postid}}` - Post ID

---

### 5005 - Remove Post from Subreddit
**Description:** Execute the actual post removal via mod action.

**Implementation:**
```typescript
async function removePost(post: Post, context: Context): Promise<void> {
  // Post removal message first
  const message = await generateRemovalMessage(post, context);
  const removalComment = await post.addComment({
    text: message,
  });
  await removalComment.distinguish(true);

  // Remove the post
  await post.remove();

  // Clean up warning comments
  await cleanupWarningComments(post, context);

  // Mark as removed in Redis
  await markAsRemoved(post.id, context);

  // Log and notify
  await logRemoval(post, context);
  await notifyRemoval(post, context);
}
```

---

### 5006 - Post Removal Comment
**Description:** Add removal explanation comment before removing post.

**Implementation:**
```typescript
async function postRemovalComment(post: Post, context: Context): Promise<Comment> {
  const message = await generateRemovalMessage(post, context);

  const comment = await post.addComment({
    text: message,
  });

  await comment.distinguish(true);

  return comment;
}
```

---

### 5007 - Distinguish Removal Comment
**Description:** Mark removal comment with moderator distinction.

**Implementation:**
```typescript
async function distinguishRemovalComment(comment: Comment): Promise<void> {
  await comment.distinguish(true);
}
```

---

### 5008 - Clean Up Warning Comments
**Description:** Delete warning comments after posting removal message.

**Implementation:**
```typescript
async function cleanupWarningComments(post: Post, context: Context): Promise<void> {
  const comments = await post.comments.all();
  const appUser = await context.reddit.getCurrentUser();
  const botUsername = appUser.username;

  for (const comment of comments) {
    if (comment.authorName === botUsername) {
      // Check if it's a warning comment (not removal comment)
      const warningTemplate = await getWarningTemplate(context);
      if (comment.body && comment.body.includes('grace period')) {
        await comment.delete();
      }
    }
  }
}
```

---

### 5009 - Track Removal State
**Description:** Store removal state in Redis for audit and reinstatement.

**Implementation:**
```typescript
async function isAlreadyRemoved(postId: string, context: Context): Promise<boolean> {
  const key = `removed:${postId}`;
  const value = await context.redis.get(key);
  return value !== null;
}

async function markAsRemoved(postId: string, context: Context): Promise<void> {
  const key = `removed:${postId}`;
  const timestamp = Date.now().toString();

  await context.redis.set(key, timestamp, {
    expiration: new Date(Date.now() + 2592000000) // 30 days
  });
}

async function getRemovalTime(postId: string, context: Context): Promise<Date | null> {
  const key = `removed:${postId}`;
  const timestamp = await context.redis.get(key);
  return timestamp ? new Date(parseInt(timestamp)) : null;
}
```

---

### 5010 - Fallback: Report Instead of Remove
**Description:** If notifications are disconnected, report post instead of removing.

**Implementation:**
```typescript
async function shouldFallbackToReport(context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();

  // Check if any notification system is connected
  const slackEnabled = settings.enableslack as boolean;
  const discordEnabled = settings.enablediscord as boolean;

  if (!slackEnabled && !discordEnabled) {
    // No notification system available, use report fallback
    return true;
  }

  return false;
}

async function reportInsteadOfRemove(post: Post, context: Context): Promise<void> {
  await post.report({
    reason: 'Breaking rule 5: No rule 5 comment added after grace period.',
  });

  await logWarning(`Post ${post.id} reported instead of removed (no notification system)`, context);
}
```

**Configuration:**
- Setting: `fallbacktoreport` (boolean, default: false)
- Automatically enabled if no notification system configured

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `warningperiod` | number | 600 | Seconds after warning before removal |
| `removaltemplate` | string | (default text) | Removal message template |
| `fallbacktoreport` | boolean | false | Report instead of remove when disconnected |
| `cleanupwarnings` | boolean | true | Delete warning comments after removal |

---

## Data Storage

### Redis Keys
- `removed:{postId}` - Timestamp when removed (TTL: 30 days)
- `removed:by:{postId}` - Username of bot account that removed
- `removal:comment:{postId}` - Removal comment ID (TTL: 30 days)

---

## Workflow

1. **Warning period elapses**
2. **Removal check scheduled job runs**:
   - Has R5 comment? → Reinstate and exit
   - No warning? → Exit (safety)
   - Already removed? → Exit
3. **Remove post**:
   - Post removal comment
   - Remove post from subreddit
   - Clean up warning comments
   - Store removal state
   - Log and notify

---

## Error Handling

- **Post already removed by mod**: Skip, log as already handled
- **Post deleted by author**: Skip removal
- **Bot lacks permissions**: Log error, notify mods
- **Removal fails**: Retry once, then report post and alert mods
- **Notification system down**: Use fallback report mode

---

## Logging & Notifications

Log events:
- `post.removal.scheduled` - Removal check scheduled
- `post.removal.executed` - Post removed
- `post.removal.skipped.has_r5` - R5 added, post not removed
- `post.removal.fallback.report` - Reported instead of removed
- `post.removal.error` - Removal failed

Notify moderators via Slack/Discord:
- Post title and link
- Author username
- Removal reason
- Time warned vs. removed
- Link to removal comment
