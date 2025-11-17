# 2000 - Post Validation

## Overview
Determine if a post requires Rule 5 comment enforcement based on configurable post types, exclusion rules, flair rules, and keywords.

**Priority Order (highest to lowest):**
1. **Skip keywords** - Skip if text contains skip keywords (highest priority)
2. **Exclusion rules** - Skip based on allowlisted users, age, upvotes, etc.
3. **Flair rules** - Enforce or exclude based on flair (overrides post type)
4. **Post type rules** - Check if post type is in enforcement list

---

## Features

### 2001 - Configurable Post Type Enforcement
**Description:** Check if post matches any configured enforcement type.

**Implementation:**
```typescript
async function shouldEnforceByPostType(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  const enforcedTypes = settings.enforcedposttypes as string[] || [];

  // IMAGE: post_hint = 'image'
  if (enforcedTypes.includes('image') && post.postHint === 'image') {
    return true;
  }

  // GALLERY: is_gallery = true
  if (enforcedTypes.includes('gallery') && post.isGallery) {
    return true;
  }

  // VIDEO: post_hint includes 'video' or is_video = true
  if (enforcedTypes.includes('video')) {
    if (post.postHint?.includes('video') || post.isVideo) {
      return true;
    }
  }

  // TEXT POST CHECKS
  if (post.isSelf && post.selftext) {
    const text = post.selftext;

    // TEXT WITH IMAGE URL
    if (enforcedTypes.includes('text_image')) {
      const imagePatterns = await getImageDomains(context);
      if (matchesAnyPattern(text, imagePatterns)) {
        return true;
      }
    }

    // TEXT WITH VIDEO URL
    if (enforcedTypes.includes('text_video')) {
      const videoPatterns = await getVideoDomains(context);
      if (matchesAnyPattern(text, videoPatterns)) {
        return true;
      }
    }

    // TEXT CONTAINING KEYWORDS
    if (enforcedTypes.includes('text_keywords')) {
      const keywords = await getEnforcementKeywords(context);
      if (containsKeyword(text, keywords)) {
        return true;
      }
    }

    // TEXT WITH ANY URL
    if (enforcedTypes.includes('text_url')) {
      if (containsURL(text)) {
        return true;
      }
    }
  }

  // LINK POST CHECKS
  if (post.url) {
    // LINK TO IMAGE
    if (enforcedTypes.includes('link_image')) {
      const imagePatterns = await getImageDomains(context);
      if (matchesAnyPattern(post.url, imagePatterns)) {
        return true;
      }
    }

    // LINK TO VIDEO
    if (enforcedTypes.includes('link_video')) {
      const videoPatterns = await getVideoDomains(context);
      if (matchesAnyPattern(post.url, videoPatterns)) {
        return true;
      }
    }

    // LINKS FROM SPECIFIC DOMAINS
    if (enforcedTypes.includes('link_domains')) {
      const linkDomains = await getLinkDomains(context);
      if (matchesDomain(post.url, linkDomains)) {
        return true;
      }
    }

    // ALL LINKS
    if (enforcedTypes.includes('link_all')) {
      return true;
    }
  }

  return false;
}
```

**Helper Functions:**
```typescript
function matchesAnyPattern(text: string, patterns: string[]): boolean {
  return patterns.some(pattern => text.toLowerCase().includes(pattern.toLowerCase()));
}

function matchesDomain(url: string, domains: string[]): boolean {
  try {
    const urlDomain = new URL(url).hostname.toLowerCase();
    return domains.some(domain => urlDomain.includes(domain.toLowerCase()));
  } catch {
    return false; // Invalid URL
  }
}

function containsURL(text: string): boolean {
  const urlRegex = /https?:\/\/[^\s]+/i;
  return urlRegex.test(text);
}

function containsKeyword(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}
```

**Supported Post Types:**
- `image` - Direct image posts (post_hint = 'image')
- `gallery` - Reddit image galleries (is_gallery = true)
- `video` - Video posts (post_hint includes 'video' or is_video = true)
- `text_image` - Text posts with image URLs
- `text_video` - Text posts with video URLs
- `text_keywords` - Text posts containing configured keywords
- `text_url` - Text posts with any URL
- `link_image` - Links to image hosting sites
- `link_video` - Links to video hosting sites
- `link_domains` - Links from specific configured domains
- `link_all` - All link posts

**Configuration:**
- Setting: `enforcedposttypes` (multi-select) - Post types to enforce
- Default: `['image', 'gallery', 'text_image', 'link_image']`

---

### 2002 - Domain Pattern Matching
**Description:** Get configured domain patterns for image/video/link detection.

**Implementation:**
```typescript
async function getImageDomains(context: Context): Promise<string[]> {
  const settings = await context.settings.getAll();
  const domains = settings.imagedomains as string || '';
  return domains.split('\n').map(d => d.trim()).filter(d => d.length > 0);
}

async function getVideoDomains(context: Context): Promise<string[]> {
  const settings = await context.settings.getAll();
  const domains = settings.videodomains as string || '';
  return domains.split('\n').map(d => d.trim()).filter(d => d.length > 0);
}

async function getLinkDomains(context: Context): Promise<string[]> {
  const settings = await context.settings.getAll();
  const domains = settings.linkenforcementdomains as string || '';
  return domains.split('\n').map(d => d.trim()).filter(d => d.length > 0);
}
```

**Default Image Domains:**
- steamusercontent.com
- steamuserimages-a.akamaihd.net
- steamcommunity.com/sharedfiles/filedetails
- i.redd.it, i.reddit, i.reddituploads.com, i.redditmedia.com
- imgur.com, twimg.com, sli.mg, gyazo.com
- .png, .gif, .jpg, .jpeg, .webp

**Default Video Domains:**
- v.redd.it
- youtube.com, youtu.be
- twitch.tv, clips.twitch.tv
- streamable.com, gfycat.com, redgifs.com
- .mp4, .webm, .mov, .avi

**Configuration:**
- Setting: `imagedomains` (paragraph) - One domain/pattern per line
- Setting: `videodomains` (paragraph) - One domain/pattern per line
- Setting: `linkenforcementdomains` (paragraph) - Domains that require R5

---

### 2003 - Keyword-Based Enforcement
**Description:** Check if text posts contain keywords that trigger enforcement.

**Implementation:**
```typescript
async function getEnforcementKeywords(context: Context): Promise<string[]> {
  const settings = await context.settings.getAll();
  const keywords = settings.enforcementkeywords as string || '';
  return keywords.split('\n').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
}

async function getSkipKeywords(context: Context): Promise<string[]> {
  const settings = await context.settings.getAll();
  const keywords = settings.skipkeywords as string || '';
  return keywords.split('\n').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
}

async function shouldEnforceByKeywords(text: string, context: Context): Promise<boolean> {
  // Skip keywords take priority
  const skipKeywords = await getSkipKeywords(context);
  if (containsKeyword(text, skipKeywords)) {
    return false;
  }

  // Check enforcement keywords
  const enforcementKeywords = await getEnforcementKeywords(context);
  return containsKeyword(text, enforcementKeywords);
}
```

**Use Cases:**
- Enforce on posts containing "screenshot", "gameplay", "battle result"
- Skip posts containing "discussion", "question", "announcement"
- Custom keywords per subreddit community

**Configuration:**
- Setting: `enforcementkeywords` (paragraph) - Keywords that trigger enforcement
- Setting: `skipkeywords` (paragraph) - Keywords that prevent enforcement (higher priority)

---

### 2004 - Flair-Based Enforcement Rules
**Description:** Check flair to determine enforcement (overrides post type rules).

**Implementation:**
```typescript
async function shouldEnforceByFlair(post: Post, context: Context): Promise<boolean | null> {
  if (!post.linkFlairText) return null; // No flair, can't determine

  const settings = await context.settings.getAll();
  const postFlair = post.linkFlairText.toLowerCase();

  // EXCLUDED FLAIRS (highest priority)
  const excludedFlairs = (settings.excludedflairs as string || '')
    .split(',')
    .map(f => f.trim().toLowerCase())
    .filter(f => f.length > 0);

  if (excludedFlairs.some(flair => postFlair.includes(flair))) {
    return false; // Explicitly excluded, skip enforcement
  }

  // ENFORCED FLAIRS (overrides post type)
  const enforcedFlairs = (settings.enforcedflairs as string || '')
    .split(',')
    .map(f => f.trim().toLowerCase())
    .filter(f => f.length > 0);

  if (enforcedFlairs.some(flair => postFlair.includes(flair))) {
    return true; // Explicitly enforced
  }

  return null; // No flair-based rule, use post type rules
}
```

**Priority:**
1. Excluded flairs return `false` (skip)
2. Enforced flairs return `true` (enforce)
3. No match returns `null` (use post type rules)

**Example Usage:**
```typescript
const flairResult = await shouldEnforceByFlair(post, context);

if (flairResult === false) {
  // Skip - flair is excluded
  return false;
} else if (flairResult === true) {
  // Enforce - flair requires R5
  return true;
} else {
  // No flair rule, check post type
  return await shouldEnforceByPostType(post, context);
}
```

**Configuration:**
- Setting: `excludedflairs` (string) - Comma-separated flair keywords to exclude
- Setting: `enforcedflairs` (string) - Comma-separated flair keywords to enforce
- Default excluded: `"comic,art"`

---

### 2005 - Allowed User Check
**Description:** Skip enforcement for trusted users.

**Implementation:**
```typescript
async function isAllowedUser(username: string, context: Context): Promise<boolean> {
  if (!username) return false;

  const settings = await context.settings.getAll();
  const allowlistStr = settings.allowlistedusers as string || '';

  if (!allowlistStr) return false; // Whitelist disabled

  const allowlist = allowlistStr
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(u => u.length > 0);

  return allowlist.includes(username.toLowerCase());
}
```

**Use Cases:**
- Subreddit artists who regularly post art
- Bots (e.g., AutoModerator)
- Trusted contributors

**Configuration:**
- Setting: `allowlistedusers` (string) - Comma-separated usernames
- Default: `""` (disabled)

---

### 2006 - Post Age Limit Check
**Description:** Skip enforcement on old posts.

**Implementation:**
```typescript
async function isPostTooOld(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  const maxPostAge = settings.maxpostage as number || 0;

  if (maxPostAge <= 0) {
    return false; // Feature disabled
  }

  const postAgeHours = (Date.now() - post.createdAt.getTime()) / 3600000;
  return postAgeHours > maxPostAge;
}
```

**Use Cases:**
- Prevent enforcement when first installing bot (set to 24 hours)
- Avoid disrupting established posts after downtime
- Focus enforcement on new content only

**Configuration:**
- Setting: `maxpostage` (number, hours) - Skip posts older than X hours
- Default: `0` (disabled)
- Validation: 0-720 hours (30 days)

---

### 2007 - Upvote Threshold Check
**Description:** Skip enforcement on popular posts.

**Implementation:**
```typescript
async function hasHighUpvotes(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  const threshold = settings.skipupvotethreshold as number || 0;

  if (threshold <= 0) {
    return false; // Feature disabled
  }

  return post.score > threshold;
}
```

**Use Cases:**
- Prevent removing viral posts (e.g., >500 upvotes)
- Avoid community backlash from removing popular content
- Focus enforcement on new/low-engagement posts

**Configuration:**
- Setting: `skipupvotethreshold` (number) - Skip if upvotes exceed this value
- Default: `0` (disabled)

---

### 2008 - Text Post Keyword Exclusion
**Description:** Skip text posts matching keyword patterns.

**Implementation:**
```typescript
async function matchesTextExclusionKeywords(post: Post, context: Context): Promise<boolean> {
  if (!post.isSelf || !post.selftext) return false;

  const settings = await context.settings.getAll();
  const text = post.selftext;

  // Check starts with keywords
  const startsWithKeywords = parseKeywordList(settings.textpostexclusionstartswith as string);
  if (startsWith(text, startsWithKeywords)) {
    return true;
  }

  // Check contains one keywords
  const containsKeywords = parseKeywordList(settings.textpostexclusioncontainsone as string);
  if (containsOne(text, containsKeywords)) {
    return true;
  }

  return false;
}
```

**Use Cases:**
- Skip posts starting with "Discussion:", "Question:", "Meta:"
- Skip posts containing "announcement", "dev diary", "official"
- Skip posts matching community-specific patterns

**Example Configurations:**
- Starts with: "Discussion:", "Question:", "Meta:", "[Dev Diary]"
- Contains: "announcement", "dev diary", "official", "aar"

**Configuration:**
- Setting: `textpostexclusionstartswith` (paragraph) - Skip if text starts with these (one per line)
- Setting: `textpostexclusioncontainsone` (paragraph) - Skip if text contains any of these (one per line)
- Default: `""` (disabled)

---

### 2009 - Link Domain Exclusion
**Description:** Skip links from specific domains.

**Implementation:**
```typescript
async function isLinkFromExcludedDomain(post: Post, context: Context): Promise<boolean> {
  if (!post.url) return false;

  const settings = await context.settings.getAll();
  const excludedDomainsStr = settings.linkdomainexclusions as string || '';

  if (!excludedDomainsStr) return false; // Feature disabled

  const excludedDomains = excludedDomainsStr
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(d => d.length > 0);

  try {
    const postDomain = new URL(post.url).hostname.toLowerCase();
    return excludedDomains.some(domain => postDomain.includes(domain));
  } catch {
    return false; // Invalid URL
  }
}
```

**Use Cases:**
- Skip links to wikipedia.org (educational content)
- Skip links to reddit.com (crossposts)
- Skip links to twitter.com (news)

**Configuration:**
- Setting: `linkdomainexclusions` (string) - Comma-separated domains
- Default: `""` (disabled)

---

### 2010 - Moderator Approval Check
**Description:** Skip posts approved by moderators.

**Implementation:**
```typescript
async function shouldRespectModApproval(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  const respectApprovals = settings.respectmodapprovals as boolean ?? true;

  if (!respectApprovals) {
    return false; // Don't respect mod approvals, enforce anyway
  }

  return post.approved === true;
}
```

**Use Cases:**
- Respect manual moderator decisions (default: true)
- Strict mode: Enforce R5 even on approved posts (set to false)

**Configuration:**
- Setting: `respectmodapprovals` (boolean) - Skip moderator-approved posts
- Default: `true`

---

### 2011 - Moderator Removal Check
**Description:** Skip posts already removed by moderators.

**Implementation:**
```typescript
async function wasRemovedByModerator(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  const skipModRemoved = settings.skipmodremoved as boolean ?? true;

  if (!skipModRemoved) {
    return false; // Don't skip mod-removed posts
  }

  // Check if removed and NOT by bot
  if (post.removed && !await wasRemovedByBot(post.id, context)) {
    return true;
  }

  return false;
}

async function wasRemovedByBot(postId: string, context: Context): Promise<boolean> {
  const key = `removed:${postId}`;
  return await context.redis.get(key) !== null;
}
```

**Use Cases:**
- Avoid interfering with posts removed for other violations
- Skip posts removed by human moderators
- Allow bot to check its own removals for reinstatement

**Configuration:**
- Setting: `skipmodremoved` (boolean) - Skip moderator-removed posts
- Default: `true`

---

### 2012 - Moderator Comment Skip Check
**Description:** Skip posts where moderator commented with specific keywords.

**Implementation:**
```typescript
async function hasModCommentMatchingKeywords(post: Post, skipKeywords: string[], context: Context): Promise<boolean> {
  if (skipKeywords.length === 0) return false;

  try {
    const comments = await post.comments.all();
    const subreddit = await post.getSubreddit();
    const moderators = await subreddit.getModerators().all();
    const modUsernames = moderators.map(mod => mod.username.toLowerCase());

    for (const comment of comments) {
      if (!comment.authorName) continue;

      // Is this a mod comment?
      if (modUsernames.includes(comment.authorName.toLowerCase())) {
        // Does it contain any skip keywords? (ignores removed status)
        if (containsOne(comment.body, skipKeywords)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking mod comments:', error);
    return false;
  }
}

async function shouldSkipDueToModComment(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  const skipIfModComment = settings.skipifmodcomment as boolean || false;

  if (!skipIfModComment) return false;

  const skipKeywords = parseKeywordList(settings.modcommentskipkeywords as string);
  if (skipKeywords.length === 0) return false;

  return await hasModCommentMatchingKeywords(post, skipKeywords, context);
}
```

**Use Cases:**
- Moderator manually reviews post and comments "Approved per discussion"
- Moderator comments "Exception granted" or "R5 waived"
- Allows moderators to override bot without using approve/remove actions

**Example Keywords:**
- "approved", "exception granted", "r5 waived"
- "manual approval", "exception", "approved per discussion"

**Configuration:**
- Setting: `skipifmodcomment` (boolean) - Enable mod comment skip feature
- Setting: `modcommentskipkeywords` (paragraph) - Keywords to match (one per line)
- Default: `false` (disabled)

---

### 2013 - Recently Approved Check
**Description:** Skip posts recently approved by bot (prevents re-removal loops).

**Implementation:**
```typescript
async function wasRecentlyApproved(postId: string, context: Context): Promise<boolean> {
  const key = `approved:${postId}`;
  const value = await context.redis.get(key);

  if (!value) return false;

  const approvedAt = parseInt(value);
  const hoursSince = (Date.now() - approvedAt) / 3600000;

  // Consider "recently approved" if within 24 hours
  return hoursSince < 24;
}
```

**Why 24 Hours:**
- Prevents re-removal loops if user is still editing comment
- Gives user time to improve R5 if initially too short
- After 24 hours, bot can re-check if user deleted R5

**Security:**
- Bot will re-check posts after 24 hours
- User cannot delete R5 and keep post indefinitely
- See SECURITY-FIX.md for detailed explanation

**Configuration:**
- Hardcoded to 24 hours (not configurable)
- Redis TTL: 7 days

---

### 2014 - Complete Validation Pipeline
**Description:** Main validation function that applies all checks in priority order.

**Implementation:**
```typescript
async function shouldEnforceRule5(post: Post, context: Context): Promise<boolean> {
  // 0. SKIP IF DELETED AUTHOR
  if (!post.authorName) return false;

  // 1. SKIP IF RECENTLY APPROVED (prevents re-removal loops)
  if (await wasRecentlyApproved(post.id, context)) {
    return false;
  }

  // 2. SKIP KEYWORDS (highest priority)
  if (post.isSelf && post.selftext) {
    const skipKeywords = await getSkipKeywords(context);
    if (containsKeyword(post.selftext, skipKeywords)) {
      return false;
    }
  }

  // 3. EXCLUSION RULES (second priority)

  // 3a. Allowed users
  if (await isAllowedUser(post.authorName, context)) {
    return false;
  }

  // 3b. Post age limit
  if (await isPostTooOld(post, context)) {
    return false;
  }

  // 3c. Upvote threshold
  if (await hasHighUpvotes(post, context)) {
    return false;
  }

  // 3d. Text post keyword exclusion
  if (await matchesTextExclusionKeywords(post, context)) {
    return false;
  }

  // 3e. Link domain exclusion
  if (await isLinkFromExcludedDomain(post, context)) {
    return false;
  }

  // 3f. Moderator-approved posts
  if (await shouldRespectModApproval(post, context)) {
    return false;
  }

  // 3g. Moderator-removed posts
  if (await wasRemovedByModerator(post, context)) {
    return false;
  }

  // 3h. Moderator comment skip
  if (await shouldSkipDueToModComment(post, context)) {
    return false;
  }

  // 4. FLAIR RULES (override post type)
  const flairResult = await shouldEnforceByFlair(post, context);
  if (flairResult === false) {
    return false; // Excluded by flair
  } else if (flairResult === true) {
    return true; // Enforced by flair
  }

  // 5. POST TYPE RULES (default behavior)
  return await shouldEnforceByPostType(post, context);
}
```

**Priority Order Summary:**
1. **Skip recently approved** - Prevents re-removal loops (24h grace)
2. **Skip keywords** - Text containing skip keywords → always skip
3. **Exclusion rules** - Whitelist, age, upvotes, keywords, domains, mod actions, mod comments
4. **Flair rules** - Excluded flairs → skip, enforced flairs → enforce
5. **Post type rules** - Check if post type is in enforcement list

**Example Flow:**
```
Post submitted
  ↓
Recently approved? → YES → Skip
  ↓ NO
Contains skip keywords? → YES → Skip
  ↓ NO
Allowed user? → YES → Skip
  ↓ NO
Too old? → YES → Skip
  ↓ NO
Too many upvotes? → YES → Skip
  ↓ NO
Matches text exclusion keywords? → YES → Skip
  ↓ NO
Link from excluded domain? → YES → Skip
  ↓ NO
Moderator approved? → YES → Skip
  ↓ NO
Moderator removed? → YES → Skip
  ↓ NO
Mod comment contains skip keywords? → YES → Skip
  ↓ NO
Flair excluded? → YES → Skip
  ↓ NO
Flair enforced? → YES → Enforce
  ↓ NO (null)
Post type enforced? → YES → Enforce
  ↓ NO
Skip (not enforced)
```

---

## Configuration Settings

| Category | Setting | Type | Default | Description |
|----------|---------|------|---------|-------------|
| **Post Types** | `enforcedposttypes` | multi-select | image, gallery, text_image, link_image | Post types to enforce |
| **Domains** | `imagedomains` | paragraph | (defaults) | Image hosting domains |
| | `videodomains` | paragraph | (defaults) | Video hosting domains |
| | `linkenforcementdomains` | paragraph | "" | Link domains requiring R5 |
| **Keywords** | `enforcementkeywords` | paragraph | "" | Text keywords requiring R5 |
| | `skipkeywords` | paragraph | "" | Text keywords skipping R5 (priority) |
| **Flairs** | `enforcedflairs` | string | "" | Flairs always requiring R5 |
| | `excludedflairs` | string | "comic,art" | Flairs never requiring R5 |
| **Exclusions** | `allowlistedusers` | string | "" | Usernames to skip |
| | `maxpostage` | number | 0 | Skip posts older than X hours |
| | `skipupvotethreshold` | number | 0 | Skip posts with >X upvotes |
| | `textpostexclusionstartswith` | paragraph | "" | Skip text posts starting with keywords |
| | `textpostexclusioncontainsone` | paragraph | "" | Skip text posts containing keywords |
| | `linkdomainexclusions` | string | "" | Domains to skip |
| | `respectmodapprovals` | boolean | true | Skip mod-approved posts |
| | `skipmodremoved` | boolean | true | Skip mod-removed posts |
| | `skipifmodcomment` | boolean | false | Enable mod comment skip |
| | `modcommentskipkeywords` | paragraph | "" | Keywords for mod comment skip |

---

## Edge Cases

- **Deleted authors**: Skip enforcement (can't notify)
- **Removed posts**: Check if bot removed it or another mod
- **Gallery posts**: Treat as enforced if `gallery` in `enforcedposttypes`
- **Crossposts with images**: Check if original URL matches image patterns
- **Invalid URLs**: Catch errors, skip domain checks
- **Empty keyword lists**: All configurable features disabled by default (empty = no requirements)

---

## Performance Considerations

- Cache domain lists per execution (avoid repeated splits)
- Batch Redis lookups when checking multiple posts
- Fail open: if checks error, skip enforcement rather than false positive
- Short-circuit evaluation: check cheapest conditions first
- Use null/undefined to indicate "no rule" vs false for "skip"
