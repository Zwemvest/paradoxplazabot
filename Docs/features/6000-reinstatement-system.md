# 6000 - Reinstatement System

## Overview
Auto-approve posts when users add Rule 5 comments, cleaning up warnings silently.

---

## Features

### 6001 - Detect R5 Comment Added
**Description:** Monitor warned posts for R5 comments added by the author.

**Implementation:**
```typescript
Devvit.addSchedulerJob({
  name: 'monitorWarnedPosts',
  onRun: async (event, context) => {
    const warnedPosts = await getWarnedPosts(context);

    for (const postId of warnedPosts) {
      try {
        const post = await context.reddit.getPostById(postId);

        if (await hasValidR5Comment(post, context)) {
          await reinstatePost(post, context);
        }
      } catch (error) {
        // Post may be deleted, skip
        await clearWarningState(postId, context);
      }
    }
  }
});

async function getWarnedPosts(context: Context): Promise<string[]> {
  // Get all warned posts from Redis
  const pattern = 'warned:*';
  const keys = await context.redis.scan(pattern);

  return keys.map(key => key.replace('warned:', ''));
}
```

---

### 6002 - Verify R5 Comment Quality and Bot Removal
**Description:** Ensure the added R5 comment meets quality standards AND bot removed the post.

**CRITICAL SECURITY CHECK:** Only approve posts that the BOT removed, not posts removed by human moderators or posts that were never removed.

**Implementation:**
```typescript
async function shouldReinstatePost(post: Post, context: Context): Promise<boolean> {
  // Must have valid R5 comment
  if (!await hasValidR5Comment(post, context)) {
    return false;
  }

  // CRITICAL: Only reinstate if BOT removed it
  // Do NOT approve posts removed by human mods (may have other violations)
  if (!await wasRemovedByBot(post.id, context)) {
    return false;
  }

  // Must have been warned by bot (safety check)
  if (!await hasWarning(post.id, context)) {
    return false;
  }

  return true;
}
```

**Rationale:**
- **Never approve posts removed by human moderators** - They may have other rule violations
- **Never approve posts that were never removed** - They may break other rules
- **Only approve bot's own removals** - We only know about R5 violations

---

### 6003 - Clean Up Bot Comments
**Description:** Remove all bot warning comments from the post after approval.

**Implementation:**
```typescript
async function cleanupBotComments(post: Post, context: Context): Promise<void> {
  const comments = await post.comments.all();
  const appUser = await context.reddit.getCurrentUser();
  const botUsername = appUser.username;

  for (const comment of comments) {
    if (comment.authorName === botUsername) {
      try {
        await comment.delete();
      } catch (error) {
        // Comment may already be deleted, continue
      }
    }
  }
}
```

**Note:** This removes ALL bot comments (warnings, reminders, etc.)

---

### 6004 - Approve Post
**Description:** Approve the post via mod action.

**Implementation:**
```typescript
async function approvePost(post: Post, context: Context): Promise<void> {
  await post.approve();
}
```

**Requirements:**
- Bot must have moderator permissions with approval rights

---

### 6005 - Mark as Approved (NOT Whitelist)
**Description:** Track that post was approved, but DON'T add to permanent allowlist.

**IMPORTANT:** Do NOT allowlist approved posts. Only track approval for logging/analytics.

**Why:** If user deletes R5 comment later, bot should detect and warn again.

**Implementation:**
```typescript
async function markAsApproved(postId: string, context: Context): Promise<void> {
  const key = `approved:${postId}`;
  const timestamp = Date.now().toString();

  // Store for 7 days (long enough to prevent re-removal loops)
  await context.redis.set(key, timestamp, {
    expiration: new Date(Date.now() + 604800000) // 7 days
  });
}

async function wasRecentlyApproved(postId: string, context: Context): Promise<boolean> {
  const key = `approved:${postId}`;
  const value = await context.redis.get(key);

  if (!value) return false;

  const approvedAt = parseInt(value);
  const now = Date.now();
  const hoursSince = (now - approvedAt) / 3600000;

  // Consider "recently approved" if within 24 hours
  return hoursSince < 24;
}
```

**Changed Behavior:**
- ❌ **Old:** Add to permanent allowlist → never check again
- ✅ **New:** Track approval temporarily → continue monitoring

---

### 6006 - Clear Warning State
**Description:** Remove warning tracking data from Redis.

**Implementation:**
```typescript
async function clearWarningState(postId: string, context: Context): Promise<void> {
  const keys = [
    `warned:${postId}`,
    `warning:${postId}`,
    `warning:comment:${postId}`,
  ];

  for (const key of keys) {
    await context.redis.del(key);
  }
}
```

---

### 6007 - Clear Removal State (If Applicable)
**Description:** Remove removal tracking if post was already removed but user added R5.

**Implementation:**
```typescript
async function clearRemovalState(postId: string, context: Context): Promise<void> {
  const keys = [
    `removed:${postId}`,
    `removed:by:${postId}`,
    `removal:comment:${postId}`,
  ];

  for (const key of keys) {
    await context.redis.del(key);
  }
}

async function wasRemovedByBot(postId: string, context: Context): Promise<boolean> {
  const key = `removed:${postId}`;
  const value = await context.redis.get(key);
  return value !== null;
}
```

---

### 6008 - Complete Reinstatement Flow
**Description:** Execute full reinstatement process (ONLY for bot-removed posts).

**Implementation:**
```typescript
async function reinstatePost(post: Post, context: Context): Promise<void> {
  // CRITICAL: Verify we should reinstate (includes bot removal check)
  if (!await shouldReinstatePost(post, context)) {
    return;
  }

  // Verify post is actually removed
  if (!post.removed) {
    console.warn(`Post ${post.id} not removed, skipping reinstatement`);
    return;
  }

  // Clean up bot comments (warnings and removal messages)
  await cleanupBotComments(post, context);

  // Approve the post
  await approvePost(post, context);

  // Mark as approved (temporary, NOT permanent allowlist)
  await markAsApproved(post.id, context);

  // Clear warning and removal states
  await clearWarningState(post.id, context);
  await clearRemovalState(post.id, context);

  // Log and notify
  await logReinstatement(post, context);

  // Optionally notify (silent by default)
  const settings = await context.settings.getAll();
  if (settings.notifyonapproval as boolean) {
    await notifyReinstatement(post, context);
  }
}
```

**Key Changes:**
- ✅ Only reinstates bot-removed posts
- ✅ Verifies post is actually removed before approving
- ✅ Marks as approved temporarily (NOT permanent allowlist)
- ✅ Allows re-enforcement if R5 deleted later

---

### 6009 - Silent Approval (No User Notification)
**Description:** Approve posts without sending notifications to avoid spam.

**Rationale:**
- User already knows they added R5 comment
- No need to notify them of approval
- Reduces notification fatigue

**Configuration:**
- Setting: `silentapproval` (boolean, default: true)

**Implementation:**
```typescript
async function shouldNotifyUser(context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  return !(settings.silentapproval as boolean ?? true);
}
```

---

### 6010 - Handle Already-Removed Posts
**Description:** Special handling for posts that were removed but user added R5.

**Implementation:**
```typescript
async function reinstateRemovedPost(post: Post, context: Context): Promise<void> {
  // Verify bot was the one who removed it
  if (!await wasRemovedByBot(post.id, context)) {
    // Another mod removed it, don't override
    return;
  }

  // Clean up bot removal comment
  await cleanupBotComments(post, context);

  // Approve the post
  await approvePost(post, context);

  // Add to allowlist
  await addToWhitelist(post.id, context);

  // Clear all tracking
  await clearWarningState(post.id, context);
  await clearRemovalState(post.id, context);

  // Log
  await logReinstatement(post, context);
}
```

---

### 6011 - Monitoring Frequency
**Description:** How often to check warned posts for new R5 comments.

**Configuration:**
- Setting: `monitoringinterval` (number, minutes, default: 1)

**Implementation:**
```typescript
await context.scheduler.runJob({
  name: 'monitorWarnedPosts',
  cron: '*/1 * * * *', // Every 1 minute
});
```

**Tradeoff:**
- More frequent = faster approval, higher resource usage
- Less frequent = slower approval, lower resource usage

---

### 6012 - Check Comment Timing
**Description:** Track when R5 comment was added (before or after warning).

**Implementation:**
```typescript
async function getCommentTiming(post: Post, context: Context): Promise<'before_warning' | 'after_warning' | 'after_removal'> {
  const authorComments = await findAuthorComments(post, context);
  const minLength = await getMinCommentLength(context);

  const validComment = authorComments.find(c => isCommentLongEnough(c, minLength));
  if (!validComment) return 'after_removal';

  const commentTime = validComment.createdAt.getTime();
  const warningTime = await getWarningTime(post.id, context);

  if (!warningTime) {
    return 'before_warning';
  }

  if (commentTime < warningTime.getTime()) {
    return 'before_warning';
  }

  const removalTime = await getRemovalTime(post.id, context);
  if (removalTime && commentTime > removalTime.getTime()) {
    return 'after_removal';
  }

  return 'after_warning';
}
```

**Use Cases:**
- Analytics: Track user compliance timing
- Logging: Include in reinstatement logs
- Optional: Different notifications based on timing

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `monitoringinterval` | number | 1 | Minutes between warned post checks |
| `silentapproval` | boolean | true | Don't notify users on approval |
| `notifyonapproval` | boolean | false | Send notifications to mods on approval |
| `cleanupcomments` | boolean | true | Delete bot comments on approval |

---

## Data Storage

### Redis Keys
- `allowlist:{postId}` - Approved/valid posts (TTL: 30 days)
- `reinstated:{postId}` - Timestamp of reinstatement (TTL: 30 days)

---

## Workflow

1. **Monitoring job runs** (every 1 minute)
2. **For each warned post**:
   - Fetch post
   - Check for valid R5 comment
   - If found → Reinstate
3. **Reinstatement**:
   - Clean up bot comments
   - Approve post (if removed)
   - Add to allowlist
   - Clear warning/removal states
   - Log event

---

## Edge Cases

- **User edits comment to make it longer**: Detection will catch updated version
- **User adds multiple comments**: Any one valid comment counts
- **User deletes then re-adds R5**: New comment will be detected
- **Another mod removes post**: Don't auto-approve (respect mod action)
- **Another mod approves post**: Clear warning state, add to allowlist
- **Post deleted by user**: Clear tracking, skip reinstatement

---

## Error Handling

- **Post not found**: Clear tracking, continue
- **Post deleted**: Clear tracking, continue
- **Approval fails**: Log error, retry once, alert mods
- **Comment deletion fails**: Log warning, continue with approval
- **Redis unavailable**: Skip cycle, retry on next run

---

## Logging & Notifications

Log events:
- `post.reinstatement.detected` - R5 comment found
- `post.reinstatement.approved` - Post approved
- `post.reinstatement.cleaned` - Bot comments removed
- `post.reinstatement.error` - Reinstatement failed

Notify moderators (if enabled):
- Post title and link
- Author username
- Timing: before/after warning/removal
- R5 comment link
