# 11000 - Persistent Storage

## Overview
Track state and configuration across bot runs using Devvit's built-in Redis implementation.

---

## Features

### 11001 - Redis Key Design
**Description:** Structured key naming convention for organized data storage.

**Key Patterns:**

```typescript
// Post processing state
`processed:{postId}`          // Post has been checked (TTL: 1 hour)
`approved:{postId}`           // Post was approved by bot (TTL: 7 days)
                              // NOT a permanent allowlist!

// Warning tracking
`warned:{postId}`             // Timestamp when warned (TTL: 24 hours)
`warning:{postId}`            // Full warning state JSON (TTL: 24 hours)
`warning:comment:{postId}`    // Warning comment ID (TTL: 24 hours)

// Removal tracking
`removed:{postId}`            // Timestamp when removed (TTL: 30 days)
`removed:by:{postId}`         // Bot username who removed (TTL: 30 days)
`removal:comment:{postId}`    // Removal comment ID (TTL: 30 days)

// Modmail tracking
`modmail:processed:{conversationId}`  // Processed modmail (TTL: 7 days)
`modmail:approved:{postId}`           // Approved via modmail (TTL: 30 days)

// Analytics (optional)
`stats:warnings:daily:{date}`   // Daily warning count
`stats:removals:daily:{date}`   // Daily removal count
`stats:approvals:daily:{date}`  // Daily approval count
```

**IMPORTANT CHANGE:**
- ❌ **Removed:** `allowlist:{postId}` - No permanent allowlist
- ✅ **Added:** `approved:{postId}` - Temporary approval tracking (7 days)
- ✅ **Changed:** `processed:{postId}` - Now 1 hour TTL instead of 7 days

---

### 11002 - Post State Tracking
**Description:** Track the lifecycle state of each post.

**Implementation:**
```typescript
enum PostState {
  NEW = 'new',
  GRACE_PERIOD = 'grace_period',
  WARNED = 'warned',
  REMOVED = 'removed',
  APPROVED = 'approved',
}

interface PostStateData {
  postId: string;
  state: PostState;
  detectedAt: number;
  warnedAt?: number;
  removedAt?: number;
  approvedAt?: number;
  author: string;
  subreddit: string;
}

async function getPostState(postId: string, context: Context): Promise<PostStateData | null> {
  const key = `state:${postId}`;
  const data = await context.redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setPostState(state: PostStateData, context: Context): Promise<void> {
  const key = `state:${state.postId}`;
  await context.redis.set(key, JSON.stringify(state), {
    expiration: new Date(Date.now() + 2592000000) // 30 days
  });
}
```

---

### 11003 - Approval Tracking (NOT Whitelist)
**Description:** Track approved posts temporarily to prevent re-removal loops.

**CRITICAL CHANGE:** No permanent allowlist. Track approvals for 7 days only.

**Why:** If user deletes R5 comment, bot should re-enforce after approval expires.

**Implementation:**
```typescript
async function markAsApproved(postId: string, context: Context): Promise<void> {
  const key = `approved:${postId}`;
  const timestamp = Date.now().toString();

  // Store for 7 days (prevents re-removal loops)
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

async function getApprovalTime(postId: string, context: Context): Promise<Date | null> {
  const key = `approved:${postId}`;
  const value = await context.redis.get(key);
  return value ? new Date(parseInt(value)) : null;
}

async function getApprovalCount(context: Context): Promise<number> {
  const keys = await context.redis.scan('approved:*');
  return keys.length;
}
```

**Changed Behavior:**
- ❌ **Old:** Permanent allowlist (30 days+)
- ✅ **New:** Temporary approval tracking (7 days, 24h grace)

---

### 11004 - Warning State Storage
**Description:** Persist warning information for tracking and removal decisions.

**Implementation:**
```typescript
interface WarningState {
  postId: string;
  warnedAt: number;
  commentId: string;
  gracePeriodEnd: number;
  removalScheduledAt: number;
  author: string;
}

async function storeWarningState(state: WarningState, context: Context): Promise<void> {
  const key = `warning:${state.postId}`;
  await context.redis.set(key, JSON.stringify(state), {
    expiration: new Date(Date.now() + 86400000) // 24 hours
  });

  // Also store simple timestamp for quick checks
  await context.redis.set(`warned:${state.postId}`, state.warnedAt.toString(), {
    expiration: new Date(Date.now() + 86400000)
  });
}

async function getWarningState(postId: string, context: Context): Promise<WarningState | null> {
  const key = `warning:${postId}`;
  const data = await context.redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function clearWarningState(postId: string, context: Context): Promise<void> {
  await context.redis.del(`warning:${postId}`);
  await context.redis.del(`warned:${postId}`);
  await context.redis.del(`warning:comment:${postId}`);
}
```

---

### 11005 - Removal State Storage
**Description:** Track removals for modmail verification and analytics.

**Implementation:**
```typescript
interface RemovalState {
  postId: string;
  removedAt: number;
  removedBy: string;  // Bot username
  commentId: string;
  author: string;
  subreddit: string;
  reason: string;
}

async function storeRemovalState(state: RemovalState, context: Context): Promise<void> {
  const key = `removal:${state.postId}`;
  await context.redis.set(key, JSON.stringify(state), {
    expiration: new Date(Date.now() + 2592000000) // 30 days
  });

  // Simple timestamp for quick checks
  await context.redis.set(`removed:${state.postId}`, state.removedAt.toString(), {
    expiration: new Date(Date.now() + 2592000000)
  });
}

async function getRemovalState(postId: string, context: Context): Promise<RemovalState | null> {
  const key = `removal:${postId}`;
  const data = await context.redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function wasRemovedByBot(postId: string, context: Context): Promise<boolean> {
  const key = `removed:${postId}`;
  return await context.redis.get(key) !== null;
}
```

---

### 11006 - TTL (Time-To-Live) Management
**Description:** Automatic data expiration to prevent unbounded growth.

**TTL Strategy:**

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Processed posts | 1 hour | Rate limiting, allow re-checks |
| Approved posts | 7 days | Prevent re-removal loops temporarily |
| Warning state | 24 hours | Only relevant during enforcement window |
| Removal state | 30 days | Support modmail appeals |
| Modmail tracking | 7 days | Prevent duplicate processing |
| Analytics | 90 days | Historical data retention |

**Implementation:**
```typescript
const TTL = {
  PROCESSED: 3600000,        // 1 hour (changed from 7 days)
  APPROVED: 604800000,       // 7 days (new, replaces WHITELIST)
  WARNING: 86400000,         // 24 hours
  REMOVAL: 2592000000,       // 30 days
  MODMAIL: 604800000,        // 7 days
  ANALYTICS: 7776000000,     // 90 days
};

async function setWithTTL(
  key: string,
  value: string,
  ttl: number,
  context: Context
): Promise<void> {
  await context.redis.set(key, value, {
    expiration: new Date(Date.now() + ttl)
  });
}
```

**Key Changes:**
- ❌ **Removed:** WHITELIST (30 days)
- ✅ **Added:** APPROVED (7 days) - Not permanent
- ✅ **Changed:** PROCESSED from 7 days → 1 hour

---

### 11007 - Bulk Operations
**Description:** Efficient batch reads/writes for performance.

**Implementation:**
```typescript
async function getWarnedPosts(context: Context): Promise<string[]> {
  const keys = await context.redis.scan('warned:*');
  return keys.map(key => key.replace('warned:', ''));
}

async function getRemovedPosts(context: Context): Promise<string[]> {
  const keys = await context.redis.scan('removed:*');
  return keys.map(key => key.replace('removed:', ''));
}

async function getProcessedPosts(context: Context): Promise<string[]> {
  const keys = await context.redis.scan('processed:*');
  return keys.map(key => key.replace('processed:', ''));
}

async function clearOldData(context: Context): Promise<void> {
  // Redis TTL handles this automatically, but can manually clean if needed
  const oldKeys = await context.redis.scan('*:*');

  for (const key of oldKeys) {
    const ttl = await context.redis.ttl(key);
    if (ttl === -1) {
      // No TTL set, add one
      await context.redis.expire(key, TTL.WHITELIST);
    }
  }
}
```

---

### 11008 - Analytics Storage
**Description:** Store metrics for monitoring and reporting.

**Implementation:**
```typescript
interface DailyStats {
  date: string; // YYYY-MM-DD
  warnings: number;
  removals: number;
  approvals: number;
  modmailApprovals: number;
  errors: number;
}

async function incrementStat(
  statType: 'warnings' | 'removals' | 'approvals',
  context: Context
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const key = `stats:${statType}:daily:${date}`;

  const current = await context.redis.get(key);
  const newValue = (parseInt(current || '0') + 1).toString();

  await context.redis.set(key, newValue, {
    expiration: new Date(Date.now() + TTL.ANALYTICS)
  });
}

async function getDailyStats(date: string, context: Context): Promise<DailyStats> {
  const stats: DailyStats = {
    date,
    warnings: 0,
    removals: 0,
    approvals: 0,
    modmailApprovals: 0,
    errors: 0,
  };

  for (const statType of Object.keys(stats)) {
    if (statType === 'date') continue;
    const key = `stats:${statType}:daily:${date}`;
    const value = await context.redis.get(key);
    stats[statType] = parseInt(value || '0');
  }

  return stats;
}
```

---

### 11009 - Data Migration
**Description:** Handle schema changes and data migrations.

**Implementation:**
```typescript
const SCHEMA_VERSION = 2;

async function migrateData(context: Context): Promise<void> {
  const versionKey = 'schema:version';
  const currentVersion = parseInt(await context.redis.get(versionKey) || '0');

  if (currentVersion < SCHEMA_VERSION) {
    console.log(`Migrating from v${currentVersion} to v${SCHEMA_VERSION}`);

    if (currentVersion < 1) {
      // Migration 1: Add TTL to existing keys
      await addTTLToExistingKeys(context);
    }

    if (currentVersion < 2) {
      // Migration 2: Restructure warning state
      await restructureWarningState(context);
    }

    await context.redis.set(versionKey, SCHEMA_VERSION.toString());
    console.log('Migration complete');
  }
}

async function addTTLToExistingKeys(context: Context): Promise<void> {
  const allKeys = await context.redis.scan('*');

  for (const key of allKeys) {
    const ttl = await context.redis.ttl(key);
    if (ttl === -1) {
      // No TTL, add default
      await context.redis.expire(key, TTL.WHITELIST);
    }
  }
}
```

---

### 11010 - Backup and Recovery
**Description:** Export/import Redis data for backup.

**Implementation:**
```typescript
async function exportData(context: Context): Promise<string> {
  const data: { [key: string]: string } = {};
  const keys = await context.redis.scan('*');

  for (const key of keys) {
    const value = await context.redis.get(key);
    if (value) {
      data[key] = value;
    }
  }

  return JSON.stringify(data, null, 2);
}

async function importData(jsonData: string, context: Context): Promise<void> {
  const data = JSON.parse(jsonData);

  for (const [key, value] of Object.entries(data)) {
    await context.redis.set(key, value as string);
  }
}

// Could be triggered via menu action or scheduled job
Devvit.addMenuItem({
  label: 'Export Bot Data',
  location: 'subreddit',
  onPress: async (event, context) => {
    const data = await exportData(context);
    // Save to file or display
    context.ui.showToast('Data exported (check console)');
    console.log(data);
  },
});
```

---

### 11011 - Memory Management
**Description:** Monitor and manage Redis memory usage.

**Implementation:**
```typescript
async function getStorageStats(context: Context): Promise<{
  totalKeys: number;
  keysByType: { [type: string]: number };
}> {
  const allKeys = await context.redis.scan('*');

  const keysByType: { [type: string]: number } = {};

  for (const key of allKeys) {
    const type = key.split(':')[0];
    keysByType[type] = (keysByType[type] || 0) + 1;
  }

  return {
    totalKeys: allKeys.length,
    keysByType,
  };
}

// Example output:
// {
//   totalKeys: 1523,
//   keysByType: {
//     allowlist: 1200,
//     warned: 45,
//     removed: 250,
//     processed: 28
//   }
// }
```

---

## Data Retention Policy

| Data Type | Retention | Cleanup Method |
|-----------|-----------|----------------|
| Processed posts | 7 days | Automatic TTL |
| Whitelist | 30 days | Automatic TTL |
| Warning state | 24 hours | Automatic TTL |
| Removal state | 30 days | Automatic TTL |
| Modmail tracking | 7 days | Automatic TTL |
| Analytics | 90 days | Automatic TTL |
| Error logs | 7 days | Manual cleanup |

---

## Best Practices

✅ **Use namespaced keys** - Prefix with data type (e.g., `allowlist:`, `warned:`)
✅ **Set TTL on everything** - Prevent unbounded growth
✅ **Use structured data** - JSON for complex objects
✅ **Batch operations** - Use scan for bulk reads
✅ **Handle missing keys** - Always check for null
✅ **Monitor storage** - Track key counts and sizes
✅ **Plan migrations** - Version your schema

❌ **Don't store secrets** - Use app settings instead
❌ **Don't use user input as keys** - Sanitize/hash first
❌ **Don't store indefinitely** - Always set expiration
❌ **Don't overwrite without checking** - Verify before updating
❌ **Don't ignore errors** - Handle Redis failures gracefully
