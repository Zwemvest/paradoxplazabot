# Claude Context Document

This file provides context for AI assistants (like Claude) working on this project.

---

## Project Overview

**Name:** Rule5Bot (Generic Devvit Implementation)

**Purpose:** Automated enforcement of Rule 5 on ANY subreddit requiring screenshot explanations. Rule 5 requires users to post a comment explaining their screenshots.

**Original:** Python bot using PRAW (originally for Paradox Gaming subreddits)

**Current:** Generic TypeScript bot using Devvit (Reddit's official developer platform) - works on any subreddit

---

## What is Rule 5?

**Rule 5:** "Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment."

**Why it exists:** Screenshots without context are confusing. Users need to explain what's happening in their game screenshots so others can understand and discuss.

**How it's enforced:**
1. User posts screenshot
2. Bot waits 5 minutes (grace period)
3. If no explanation comment: bot posts warning
4. Bot waits 10 more minutes
5. If still no explanation: bot removes post
6. If user adds explanation anytime: bot approves post

---

## Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Platform** | Reddit Devvit | Official Reddit developer platform |
| **Language** | TypeScript | Type-safe JavaScript |
| **Runtime** | Node.js | Via Devvit |
| **Storage** | Redis | Built into Devvit, key-value store |
| **Testing** | Jest | Unit & integration tests |
| **Triggers** | Devvit Events | PostSubmit, ModMail |
| **Scheduler** | Devvit Scheduler | Cron-like jobs |
| **Notifications** | Webhooks | Slack, Discord |

---

## Architecture Summary

**Event-Driven Design:**
- PostSubmit trigger detects new posts
- Scheduler runs periodic checks (warned posts, removal timeouts)
- ModMail trigger handles reapproval requests

**State Management:**
- Redis stores: allowlist, warning states, removal states
- TTL-based expiration (auto-cleanup)
- Namespaced keys per domain

**Configuration:**
- Per-subreddit settings via Devvit's auto-generated UI
- No code changes needed for configuration
- Moderators configure grace periods, templates, webhooks

See [Docs/ARCHITECTURE.md](./Docs/ARCHITECTURE.md) for diagrams and detailed flows.

---

## Code Organization

### Directory Structure

```
rule5bot/
├── src/
│   ├── main.ts              # Entry point, Devvit.configure()
│   ├── handlers/            # Event handlers
│   │   ├── postSubmit.ts    # New post detection
│   │   ├── modMail.ts       # Modmail processing
│   │   └── scheduler.ts     # Scheduled jobs
│   ├── services/            # Business logic
│   │   ├── validation.ts    # Post/comment validation
│   │   ├── enforcement.ts   # Warning/removal logic
│   │   ├── reinstatement.ts # Approval logic
│   │   └── modmail.ts       # Modmail handling
│   ├── storage/             # Redis operations
│   │   ├── approval.ts      # Approval tracking (NOT allowlist)
│   │   ├── warnings.ts
│   │   └── removals.ts
│   ├── utils/               # Helpers
│   │   ├── templates.ts     # Message templating
│   │   ├── notifications.ts # Slack/Discord
│   │   └── settings.ts      # Settings access
│   └── types/               # TypeScript types
│       └── index.ts
├── test/                    # Jest tests
├── Docs/                    # Feature documentation (142 features)
└── devvit.yaml             # Devvit manifest
```

### Key Modules

**Validation Service:**
- Checks if post is an image (post hint, URL patterns)
- Applies allowlist (users, flairs)
- Verifies R5 comments (length, author)

**Enforcement Service:**
- Manages grace period timing
- Posts warning comments
- Removes posts after timeout
- Tracks state in Redis

**Reinstatement Service:**
- Monitors warned posts for new R5 comments
- Auto-approves when R5 added
- Cleans up bot comments

**Storage Layer:**
- Redis key design (namespaced, TTL-managed)
- State tracking (processed, warned, removed, approved)
- Analytics (optional)

---

## Feature Domains

**13 domains, 142 features total:**

1. **1000 - Post Monitoring** (5 features) - Detection and deduplication
2. **2000 - Post Validation** (14 features) - Configurable post types, exclusions, keywords
3. **3000 - Comment Validation** (12 features) - R5 location, length, keyword requirements
4. **4000 - Warning System** (8 features) - Grace period, warnings
5. **5000 - Removal System** (10 features) - Post removal enforcement
6. **6000 - Reinstatement** (12 features) - Auto-approval when R5 added
7. **7000 - Modmail** (11 features) - Manual reapproval via modmail
8. **8000 - Settings** (14 features) - Comprehensive configuration management
9. **9000 - Templates** (11 features) - Message templating
10. **10000 - Notifications** (11 features) - Slack/Discord/logging
11. **11000 - Storage** (11 features) - Redis state management (NO permanent allowlist)
12. **12000 - Auth** (11 features) - Permissions, security
13. **13000 - Testing** (12 features) - Test coverage

Each feature has a unique ID (e.g., 1001, 2003, 7011).

See [Docs/features/0000-feature-domains.md](./Docs/features/0000-feature-domains.md) for complete list.

---

## MoSCoW Priorities

**Must Have (73 features) - MVP:**
- Core detection and validation
- Warning and removal systems
- Reinstatement when R5 added
- Modmail integration
- Basic settings and storage
- Security fixes (NO permanent allowlist)

**Should Have (45 features) - Enhanced:**
- Notifications (Slack/Discord)
- Template customization
- Analytics
- Testing suite
- Advanced validation (keywords, quality checks)
- Enhanced exclusion rules

**Could Have (23 features) - Polish:**
- Performance optimizations
- Advanced caching
- Template preview
- Data backup
- Extended analytics

**Won't Have (1 feature) - Future:**
- Multi-language support

See [Docs/ROADMAP.md](./Docs/ROADMAP.md) for full breakdown.

---

## Development Workflow

### Local Development

```bash
# Install Devvit CLI
npm install -g devvit

# Clone and setup
git clone <repo>
cd paradoxplazabot
npm install

# Create playtest version
devvit upload --bump-version

# Install on test subreddit
# Visit: https://developers.reddit.com/r/test-sub/apps
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm run test:coverage
```

### Deployment

```bash
# Publish to production
devvit publish

# Users install on their subreddits via:
# https://developers.reddit.com/apps/rule5bot
```

---

## Common Tasks

### Adding a New Feature

1. Identify domain (1000-13000)
2. Add feature to [Docs/ROADMAP.md](./Docs/ROADMAP.md)
3. Update domain doc (e.g., [Docs/features/1000-post-monitoring-detection.md](./Docs/features/1000-post-monitoring-detection.md))
4. Implement in `src/`
5. Write tests in `test/`
6. Update [ROADMAP.md](./Docs/ROADMAP.md) status

### Adding a Setting

1. Update [Docs/features/8000-settings-management.md](./Docs/features/8000-settings-management.md)
2. Add to `Devvit.addSettings()` in `src/main.ts`
3. Create helper in `src/utils/settings.ts`
4. Use in relevant service

### Adding a Notification

1. Update [Docs/features/10000-notifications-logging.md](./Docs/features/10000-notifications-logging.md)
2. Add event type to taxonomy
3. Implement in `src/utils/notifications.ts`
4. Call from relevant service

---

## Important Design Decisions

### 1. Per-Subreddit Installations
Each subreddit installs the app independently. State is isolated per installation.

**Why:** Different subreddits have different preferences (grace periods, strictness, etc.)

### 2. Trigger-First, Polling Backup
Primary detection via PostSubmit trigger. Optional queue polling as backup.

**Why:** Triggers are real-time and efficient. Polling is resource-intensive.

### 3. Redis for Everything
All state in Redis with TTLs. No external database.

**Why:** Built into Devvit, simple, auto-expires old data.

### 4. Silent Approvals
When user adds R5, bot approves silently (no notification to user).

**Why:** Avoid notification spam. User knows they complied.

### 5. Graceful Degradation
If Slack/Discord unavailable, fall back to reporting posts.

**Why:** Enforcement shouldn't fail due to notification issues.

---

## Key Redis Patterns

```typescript
// Whitelist (valid posts)
`allowlist:{postId}` → "true" [TTL: 30 days]

// Warning state
`warned:{postId}` → timestamp [TTL: 24 hours]
`warning:{postId}` → JSON {warnedAt, commentId, ...} [TTL: 24 hours]

// Removal state
`removed:{postId}` → timestamp [TTL: 30 days]
`removal:{postId}` → JSON {removedAt, removedBy, ...} [TTL: 30 days]

// Processing cache
`processed:{postId}` → "true" [TTL: 7 days]

// Modmail tracking
`modmail:processed:{conversationId}` → "true" [TTL: 7 days]

// Analytics (optional)
`stats:warnings:daily:{date}` → count [TTL: 90 days]
```

See [Docs/features/11000-persistent-storage.md](./Docs/features/11000-persistent-storage.md) for full schema.

---

## Testing Strategy

### Unit Tests
- Test individual functions (validation logic, template substitution)
- Mock external dependencies (Reddit API, Redis)
- Use Jest with TypeScript

### Integration Tests
- Test component interactions
- Mock Devvit context
- Verify state changes in Redis

### E2E Tests
- Test complete workflows (detection → warning → removal)
- Use real test subreddit
- Manual verification

**Target Coverage:** 80%+ overall, 90%+ for validation/enforcement

See [Docs/features/13000-testing.md](./Docs/features/13000-testing.md) for test cases.

---

## Common Gotchas

### Devvit-Specific

1. **No inbound webhooks:** Devvit apps can't receive HTTP requests. Only outbound fetch().
2. **Scheduler precision:** ~1 minute granularity, not second-precise
3. **Rate limits:** 60 requests/minute to Reddit API
4. **Redis namespace:** Each installation has separate Redis namespace
5. **No persistent filesystem:** Use Redis for all storage

### Reddit API

1. **Deleted authors:** `post.authorName` can be null/undefined
2. **Comment timing:** `createdAt` is UTC timestamp
3. **Mod permissions:** Verify before every mod action
4. **Distinguish requires mod:** Can only distinguish if bot is moderator
5. **Rate limits apply:** Even for moderator actions

### TypeScript

1. **Async everywhere:** All Devvit APIs are async/Promise-based
2. **Type assertions:** Cast settings values (`as string`, `as number`)
3. **Null checks:** Always check for null/undefined from Reddit API
4. **Array methods:** Use `.all()` for paginated results

---

## Debugging Tips

### Logs
```typescript
// Devvit logs appear in developer console
console.log('Debug:', value);
console.error('Error:', error);

// Structured logging
console.log(JSON.stringify({
  event: 'post.warning.posted',
  postId: post.id,
  timestamp: new Date().toISOString()
}));
```

### Local Testing
```bash
# Use test subreddit
# Install playtest version
devvit upload --bump-version

# Check logs at:
# https://developers.reddit.com/r/test-sub/apps/rule5bot
```

### Redis Inspection
```typescript
// Get all keys matching pattern
const keys = await context.redis.scan('warned:*');
console.log('Warned posts:', keys);

// Get specific value
const value = await context.redis.get('warning:abc123');
console.log('Warning state:', JSON.parse(value));

// Check approval tracking (NOT allowlist)
const approvedKeys = await context.redis.scan('approved:*');
console.log('Recently approved posts:', approvedKeys);
```

---

## Code Style

### Conventions
- Use async/await (not callbacks or raw promises)
- Descriptive variable names (`gracePeriodSeconds`, not `gp`)
- Extract magic numbers to constants
- Comment complex logic
- Use TypeScript types (no `any`)

### Example
```typescript
// Good
async function hasValidR5Comment(
  post: Post,
  context: Context
): Promise<boolean> {
  const MIN_COMMENT_LENGTH = await getMinCommentLength(context);
  const comments = await post.comments.all();

  for (const comment of comments) {
    if (comment.authorName === post.authorName) {
      if (comment.body.length >= MIN_COMMENT_LENGTH) {
        return true;
      }
    }
  }

  return false;
}

// Bad
async function check(p, c) {
  const min = 50; // magic number
  const comments = await p.comments.all();
  for (let i = 0; i < comments.length; i++) {
    if (comments[i].authorName === p.authorName && comments[i].body.length >= min) {
      return true;
    }
  }
  return false;
}
```

---

## Useful Resources

### Documentation
- [Devvit Docs](https://developers.reddit.com/docs/)
- [Reddit API](https://www.reddit.com/dev/api/)
- [Project Docs](./Docs/)

### Related Projects
- Original Python bot (link in README)
- Other Devvit Rule 5 bots (if any)

### Community
- r/Devvit - Devvit developer community
- [GitHub Issues](https://github.com/Zwemvest/rule5bot/issues)

---

## Quick Reference

### Settings Access
```typescript
const settings = await context.settings.getAll();
const gracePeriod = settings.graceperiod as number || 300;
```

### Redis Operations
```typescript
// Set with TTL
await context.redis.set(key, value, {
  expiration: new Date(Date.now() + 86400000) // 24 hours
});

// Get
const value = await context.redis.get(key);

// Delete
await context.redis.del(key);

// Scan
const keys = await context.redis.scan('pattern:*');
```

### Notifications
```typescript
await sendSlackNotification('Post removed', context);
await sendDiscordNotification('Post removed', context);
```

### Logging
```typescript
log({
  level: 'info',
  event: 'post.removal.executed',
  postId: post.id,
  author: post.authorName
});
```

---

## Questions to Ask When Contributing

1. **Which domain?** (1000-13000)
2. **What's the feature ID?** (e.g., 1001, 2003)
3. **Does it need settings?** Add to settings-management.md
4. **Does it need storage?** Design Redis keys
5. **Does it need tests?** Yes (aim for 80%+ coverage)
6. **Does it need notifications?** Add event type
7. **Is it in the roadmap?** Update ROADMAP.md status

---

## Contact

**Maintainer:** [Your info]
**Issues:** [GitHub link]
**Documentation:** [This repo]/Docs/

---

*This document is intended for AI assistants working on this codebase. Keep it updated as the project evolves.*
