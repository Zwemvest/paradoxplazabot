# 1000 - Post Monitoring & Detection

## Overview
Continuously monitor subreddit queues to identify posts requiring Rule 5 enforcement.

---

## Features

### 1001 - Retrieve New Queue for All Subreddits
**Description:** Fetch recent posts from the new queue across all configured subreddits.

**Implementation:**
- Use Devvit's PostSubmit trigger for real-time detection
- Use scheduled jobs for periodic queue polling (backup)
- Configurable queue limit per check (default: 100 posts)

**Technical Details:**
```typescript
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const post = await context.reddit.getPostById(event.postId);
    // Process post...
  }
});

Devvit.addSchedulerJob({
  name: 'pollNewQueue',
  onRun: async (event, context) => {
    const settings = await context.settings.getAll();
    const queueLimit = settings.queuelimit as number || 100;

    // Get subreddit list from settings or hardcoded
    const subreddits = ['paradoxplaza', 'eu4', 'hoi4', 'stellaris', 'victoria3'];

    for (const subName of subreddits) {
      const subreddit = await context.reddit.getSubredditByName(subName);
      const posts = await subreddit.getNewPosts({
        limit: queueLimit,
      }).all();

      for (const post of posts) {
        // Process each post
      }
    }
  }
});
```

**Configuration:**
- Setting: `queuelimit` (number, default: 100)
- Setting: `subredditlist` (string, comma-separated)

---

### 1002 - Trigger-Based Post Detection
**Description:** React immediately when new posts are submitted using Devvit's event system.

**Benefits:**
- Real-time response (no polling delay)
- Lower resource usage
- Instant grace period start

**Implementation:**
```typescript
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    // Event contains:
    // - postId: The ID of the newly submitted post
    // - subreddit: Subreddit info
    // - author: Author info

    await processNewPost(event.postId, context);
  }
});
```

---

### 1003 - Deduplication System
**Description:** Prevent processing the same post multiple times.

**Implementation:**
- Store processed post IDs in Redis with TTL
- Check Redis before processing any post
- Key pattern: `processed:{postId}`

**Technical Details:**
```typescript
async function isPostProcessed(postId: string, context: Context): Promise<boolean> {
  const key = `processed:${postId}`;
  const value = await context.redis.get(key);
  return value !== null;
}

async function markPostProcessed(postId: string, context: Context): Promise<void> {
  const key = `processed:${postId}`;
  // Store for 7 days (604800 seconds)
  await context.redis.set(key, 'true', { expiration: new Date(Date.now() + 604800000) });
}
```

---

### 1004 - Multi-Subreddit Support
**Description:** Monitor multiple subreddits with the same app installation or separate installations.

**Approaches:**

**Option A: Single Installation (Cross-Subreddit)**
- App monitors multiple subreddits from one installation
- Settings configured once
- Shared allowlist and configuration

**Option B: Per-Subreddit Installation**
- Each subreddit installs the app independently
- Per-subreddit settings and customization
- Isolated state and allowlists

**Recommendation:** Option B (per-subreddit) for better customization and isolation.

---

### 1005 - Queue Polling Scheduler
**Description:** Periodic backup check of new queue in case triggers miss posts.

**Configuration:**
- Setting: `pollinterval` (number, minutes, default: 5)
- Setting: `enablepolling` (boolean, default: false)

**Implementation:**
```typescript
Devvit.addSchedulerJob({
  name: 'pollNewQueue',
  onRun: async (event, context) => {
    const settings = await context.settings.getAll();
    if (!settings.enablepolling) return;

    // Poll logic...
  }
});

// Schedule the job to run every X minutes
await context.scheduler.runJob({
  name: 'pollNewQueue',
  cron: '*/5 * * * *', // Every 5 minutes
});
```

---

## Data Storage

### Redis Keys
- `processed:{postId}` - Boolean flag, TTL 7 days
- `monitoring:subreddits` - JSON array of monitored subreddit names

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `queuelimit` | number | 100 | Max posts to check per poll |
| `enablepolling` | boolean | false | Enable periodic queue polling |
| `pollinterval` | number | 5 | Minutes between polls |
| `subredditlist` | string | "" | Comma-separated list (if cross-subreddit) |

---

## Error Handling

- Handle rate limiting with exponential backoff
- Log failed post fetches
- Continue processing remaining posts on individual failures
- Alert via notifications on persistent errors

---

## Performance Considerations

- PostSubmit triggers are preferred over polling
- Limit queue size to prevent timeouts
- Use Redis expiration to auto-cleanup old entries
- Batch operations when possible
