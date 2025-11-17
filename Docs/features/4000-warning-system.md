# 4000 - Warning System

## Overview
Alert users to add Rule 5 comment within the grace period before removal.

---

## Features

### 4001 - Grace Period Tracking
**Description:** Track time elapsed since post creation and determine when to warn.

**Implementation:**
```typescript
async function getGracePeriod(context: Context): Promise<number> {
  const settings = await context.settings.getAll();
  return (settings.graceperiod as number) || 300; // Default: 5 minutes
}

function getPostAge(post: Post): number {
  const now = Date.now();
  const createdAt = post.createdAt.getTime();
  return Math.floor((now - createdAt) / 1000); // Age in seconds
}

async function isGracePeriodElapsed(post: Post, context: Context): Promise<boolean> {
  const gracePeriod = await getGracePeriod(context);
  const postAge = getPostAge(post);
  return postAge >= gracePeriod;
}
```

**Configuration:**
- Setting: `graceperiod` (number, seconds, default: 300)

---

### 4002 - Schedule Warning Check
**Description:** Set up scheduled job to check if posts need warnings after grace period.

**Implementation:**
```typescript
async function scheduleWarningCheck(postId: string, context: Context): Promise<void> {
  const gracePeriod = await getGracePeriod(context);
  const runAt = new Date(Date.now() + gracePeriod * 1000);

  await context.scheduler.runJob({
    name: 'checkForWarning',
    data: { postId },
    runAt,
  });
}

Devvit.addSchedulerJob({
  name: 'checkForWarning',
  onRun: async (event, context) => {
    const { postId } = event.data as { postId: string };

    const post = await context.reddit.getPostById(postId);

    // Check if R5 comment was added during grace period
    if (await hasValidR5Comment(post, context)) {
      await approvePost(post, context);
      return;
    }

    // Check if already warned
    if (await hasWarning(postId, context)) {
      return;
    }

    // Post warning
    await postWarning(post, context);
  }
});
```

---

### 4003 - Check if Already Warned
**Description:** Ensure we only warn once per post (idempotent operation).

**Implementation:**
```typescript
async function hasWarning(postId: string, context: Context): Promise<boolean> {
  const key = `warned:${postId}`;
  const value = await context.redis.get(key);
  return value !== null;
}

async function markAsWarned(postId: string, context: Context): Promise<void> {
  const key = `warned:${postId}`;
  const timestamp = Date.now().toString();

  // Store for 24 hours (covers warning + removal periods)
  await context.redis.set(key, timestamp, {
    expiration: new Date(Date.now() + 86400000)
  });
}

async function getWarningTime(postId: string, context: Context): Promise<Date | null> {
  const key = `warned:${postId}`;
  const timestamp = await context.redis.get(key);
  return timestamp ? new Date(parseInt(timestamp)) : null;
}
```

---

### 4004 - Generate Warning Message
**Description:** Create warning comment using template with variable substitution.

**Implementation:**
```typescript
async function getWarningTemplate(context: Context): Promise<string> {
  const settings = await context.settings.getAll();
  return (settings.warningtemplate as string) || `Hi /u/{{username}},

You have not yet added a rule #5 comment to your post:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

Since a rule #5 comment is mandatory, your post will be removed if you do not add this comment. You have a 10 minute grace period.

You do not need to reply, modmail, or report if you've added a rule #5 comment; this comment will be deleted automatically.`;
}

function substituteVariables(
  template: string,
  variables: { [key: string]: string }
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

async function generateWarningMessage(post: Post, context: Context): Promise<string> {
  const template = await getWarningTemplate(context);
  const subreddit = await post.getSubreddit();

  return substituteVariables(template, {
    username: post.authorName || '[deleted]',
    subreddit: subreddit.name,
    permalink: post.permalink,
    postid: post.id,
  });
}
```

**Configuration:**
- Setting: `warningtemplate` (string, paragraph)

**Template Variables:**
- `{{username}}` - Post author's username
- `{{subreddit}}` - Subreddit name
- `{{permalink}}` - Full post URL path
- `{{postid}}` - Post ID

---

### 4005 - Post Warning Comment
**Description:** Add warning comment to post and distinguish as moderator.

**Implementation:**
```typescript
async function postWarning(post: Post, context: Context): Promise<void> {
  const message = await generateWarningMessage(post, context);

  const comment = await post.addComment({
    text: message,
  });

  await comment.distinguish(true); // Distinguish as mod

  await markAsWarned(post.id, context);

  // Schedule removal check
  await scheduleRemovalCheck(post.id, context);

  // Log/notify
  await logWarning(post, context);
}
```

---

### 4006 - Distinguish Comment as Moderator
**Description:** Mark bot comment with moderator distinction (green [M] badge).

**Implementation:**
```typescript
async function distinguishComment(comment: Comment): Promise<void> {
  await comment.distinguish(true);
}
```

**Note:** Bot must have moderator permissions in the subreddit.

---

### 4007 - Track Warning State
**Description:** Store warning state in Redis for later reference.

**Data Structure:**
```typescript
interface WarningState {
  postId: string;
  warnedAt: number; // Unix timestamp
  commentId: string;
  gracePeriodEnd: number; // Unix timestamp for grace period
  removalScheduledAt: number; // When removal will occur
}

async function storeWarningState(state: WarningState, context: Context): Promise<void> {
  const key = `warning:${state.postId}`;
  await context.redis.set(key, JSON.stringify(state), {
    expiration: new Date(Date.now() + 86400000) // 24 hours
  });
}

async function getWarningState(postId: string, context: Context): Promise<WarningState | null> {
  const key = `warning:${postId}`;
  const data = await context.redis.get(key);
  return data ? JSON.parse(data) : null;
}
```

---

### 4008 - Prevent Duplicate Warnings
**Description:** Check for existing warning comments before posting new one.

**Implementation:**
```typescript
async function hasExistingWarning(post: Post, context: Context): Promise<boolean> {
  // Check Redis first
  if (await hasWarning(post.id, context)) {
    return true;
  }

  // Fallback: Check post comments for bot's warning
  const comments = await post.comments.all();
  const appUser = await context.reddit.getCurrentUser();

  return comments.some(comment =>
    comment.authorName === appUser.username
  );
}
```

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `graceperiod` | number | 300 | Seconds before warning |
| `warningtemplate` | string | (default text) | Warning message template |
| `warningduration` | number | 600 | Seconds after warning before removal |

---

## Data Storage

### Redis Keys
- `warned:{postId}` - Timestamp when warned (TTL: 24h)
- `warning:{postId}` - Full warning state JSON (TTL: 24h)
- `warning:comment:{postId}` - Comment ID for cleanup (TTL: 24h)

---

## Workflow

1. **Post detected** (via trigger or poll)
2. **Schedule warning check** at `post_time + grace_period`
3. **Warning check runs**:
   - Has R5 comment? → Approve and exit
   - Already warned? → Exit
   - No R5? → Post warning
4. **Warning posted**:
   - Store warning state in Redis
   - Schedule removal check
   - Log/notify moderators

---

## Error Handling

- **Post deleted before warning**: Skip silently
- **Author deleted account**: Post warning anyway (visible to others)
- **Bot lacks mod permissions**: Log error, notify mods
- **Comment posting fails**: Retry once, then log error
- **Redis unavailable**: Fall back to comment checking

---

## Logging & Notifications

Log events:
- `post.warning.scheduled` - Warning check scheduled
- `post.warning.posted` - Warning comment added
- `post.warning.skipped.has_r5` - Post has R5, no warning needed
- `post.warning.error` - Failed to post warning

Notify moderators via Slack/Discord when:
- Setting: `notifyonwarning` is enabled
