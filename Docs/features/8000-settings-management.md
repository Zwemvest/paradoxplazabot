# 8000 - Settings Management

## Overview
Comprehensive configurable bot behavior through Devvit's automatic settings UI, allowing granular per-subreddit customization without code changes.

**Security Note:** This bot uses keyword matching instead of regex to prevent ReDoS (Regular Expression Denial of Service) attacks. All text validation is safe, performant, and immune to malicious patterns.

---

## Helper Functions

```typescript
// Parse newline-separated keyword lists from settings
function parseKeywordList(settingValue: string | undefined): string[] {
  if (!settingValue) return [];
  return settingValue
    .split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

// Check if text contains at least one keyword (OR logic)
function containsOne(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );
}

// Check if text contains all keywords (AND logic)
function containsAll(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return keywords.every(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );
}

// Check if text starts with one of the keywords (OR logic)
function startsWith(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.trim().toLowerCase();
  return keywords.some(keyword =>
    lowerText.startsWith(keyword.toLowerCase())
  );
}

// Check if text ends with one of the keywords (OR logic)
function endsWith(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.trim().toLowerCase();
  return keywords.some(keyword =>
    lowerText.endsWith(keyword.toLowerCase())
  );
}
```

---

## Features

### 8001 - Post Type Enforcement Rules
**Description:** Configure which post types the bot actively monitors and enforces.

**Implementation:**
```typescript
// Multi-select group for post types to enforce
{
  type: 'select',
  name: 'enforcedposttypes',
  label: 'Enforce on Post Types',
  helpText: 'Select which post types require R5 explanations (multi-select)',
  multiSelect: true,
  options: [
    { label: 'Image (post_hint = image)', value: 'image' },
    { label: 'Image Gallery (is_gallery = true)', value: 'gallery' },
    { label: 'Video (post_hint = video or is_video)', value: 'video' },
    { label: 'Text with Image URL', value: 'text_image' },
    { label: 'Text with Video URL', value: 'text_video' },
    { label: 'Text Containing Keywords', value: 'text_keywords' },
    { label: 'Text with Any URL', value: 'text_url' },
    { label: 'Link to Image', value: 'link_image' },
    { label: 'Link to Video', value: 'link_video' },
    { label: 'Links from Specific Domains', value: 'link_domains' },
    { label: 'All Links (url not empty)', value: 'link_all' },
  ],
  defaultValue: ['image', 'gallery', 'text_image', 'link_image'],
  scope: SettingScope.Installation,
}
```

**Post Type Detection Logic:**
```typescript
async function shouldEnforceByPostType(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();
  const enforcedTypes = settings.enforcedposttypes as string[] || [];

  // Check each enforced type
  if (enforcedTypes.includes('image') && post.postHint === 'image') return true;
  if (enforcedTypes.includes('gallery') && post.isGallery) return true;
  if (enforcedTypes.includes('video') && (post.postHint?.includes('video') || post.isVideo)) return true;

  // Text post checks
  if (post.isSelf && post.selftext) {
    const imagePatterns = await getImageDomains(context);
    const videoPatterns = await getVideoDomains(context);
    const keywords = await getEnforcementKeywords(context);

    if (enforcedTypes.includes('text_image') && matchesAnyPattern(post.selftext, imagePatterns)) return true;
    if (enforcedTypes.includes('text_video') && matchesAnyPattern(post.selftext, videoPatterns)) return true;
    if (enforcedTypes.includes('text_keywords') && containsKeyword(post.selftext, keywords)) return true;
    if (enforcedTypes.includes('text_url') && containsURL(post.selftext)) return true;
  }

  // Link post checks
  if (post.url) {
    const imagePatterns = await getImageDomains(context);
    const videoPatterns = await getVideoDomains(context);
    const linkDomains = await getLinkDomains(context);

    if (enforcedTypes.includes('link_image') && matchesAnyPattern(post.url, imagePatterns)) return true;
    if (enforcedTypes.includes('link_video') && matchesAnyPattern(post.url, videoPatterns)) return true;
    if (enforcedTypes.includes('link_domains') && matchesDomain(post.url, linkDomains)) return true;
    if (enforcedTypes.includes('link_all') && post.url.length > 0) return true;
  }

  return false;
}
```

---

### 8002 - Post Type Exclusion Rules
**Description:** Configure exclusions that override enforcement (skip list takes priority).

**Implementation:**
```typescript
// === AUTHOR WHITELIST ===
{
  type: 'string',
  name: 'allowlistedusers',
  label: 'Allowed Authors',
  helpText: 'Comma-separated usernames to always skip (e.g., "automod,fatherlorris"). Leave empty to disable.',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === AGE LIMIT ===
{
  type: 'number',
  name: 'maxpostage',
  label: 'Skip Posts Older Than (hours)',
  helpText: 'Skip enforcement on posts older than X hours. Set to 0 to disable. Useful when first installing bot.',
  defaultValue: 0,
  scope: SettingScope.Installation,
  onValidate: (value) => {
    if (value < 0) return 'Post age cannot be negative';
    if (value > 720) return 'Post age cannot exceed 30 days (720 hours)';
  }
},

// === UPVOTE THRESHOLD ===
{
  type: 'number',
  name: 'skipupvotethreshold',
  label: 'Skip Posts with More Than X Upvotes',
  helpText: 'Skip enforcement on popular posts. Set to 0 to disable. Prevents removing viral posts.',
  defaultValue: 0,
  scope: SettingScope.Installation,
  onValidate: (value) => {
    if (value < 0) return 'Upvote threshold cannot be negative';
  }
},

// === TEXT POST KEYWORD EXCLUSIONS ===
{
  type: 'paragraph',
  name: 'textpostexclusionstartswith',
  label: 'Skip Text Posts Starting With',
  helpText: 'Skip text posts starting with these keywords. One per line. Example: "Discussion:", "Question:", "Meta:"',
  defaultValue: '',
  scope: SettingScope.Installation,
},
{
  type: 'paragraph',
  name: 'textpostexclusioncontainsone',
  label: 'Skip Text Posts Containing',
  helpText: 'Skip text posts containing any of these keywords. One per line. Example: "discussion", "question", "announcement"',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === LINK DOMAIN EXCLUSIONS ===
{
  type: 'string',
  name: 'linkdomainexclusions',
  label: 'Excluded Link Domains',
  helpText: 'Comma-separated domains to skip (e.g., "wikipedia.org,reddit.com,twitter.com")',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === MODERATOR APPROVAL ===
{
  type: 'boolean',
  name: 'respectmodapprovals',
  label: 'Skip Moderator-Approved Posts',
  helpText: 'Skip enforcement on posts manually approved by moderators',
  defaultValue: true,
  scope: SettingScope.Installation,
},

// === MODERATOR REMOVAL ===
{
  type: 'boolean',
  name: 'skipmodremoved',
  label: 'Skip Moderator-Removed Posts',
  helpText: 'Skip enforcement on posts already removed by moderators',
  defaultValue: true,
  scope: SettingScope.Installation,
},

// === MODERATOR COMMENT SKIP ===
{
  type: 'boolean',
  name: 'skipifmodcomment',
  label: 'Skip if Moderator Comments',
  helpText: 'Skip enforcement if moderator comments with matching keywords (regardless of comment removal status)',
  defaultValue: false,
  scope: SettingScope.Installation,
},
{
  type: 'paragraph',
  name: 'modcommentskipkeywords',
  label: 'Moderator Comment Skip Keywords',
  helpText: 'Skip if mod comment contains any of these keywords. One per line. Example: "approved", "exception granted", "r5 waived"',
  defaultValue: '',
  scope: SettingScope.Installation,
},
```

**Exclusion Logic:**
```typescript
async function shouldSkipPost(post: Post, context: Context): Promise<boolean> {
  const settings = await context.settings.getAll();

  // Check allowlist
  const allowlistedUsers = (settings.allowlistedusers as string || '').split(',').map(u => u.trim().toLowerCase());
  if (allowlistedUsers.includes(post.authorName?.toLowerCase())) return true;

  // Check post age
  const maxPostAge = settings.maxpostage as number || 0;
  if (maxPostAge > 0) {
    const postAgeHours = (Date.now() - post.createdAt.getTime()) / 3600000;
    if (postAgeHours > maxPostAge) return true;
  }

  // Check upvote threshold
  const upvoteThreshold = settings.skipupvotethreshold as number || 0;
  if (upvoteThreshold > 0 && post.score > upvoteThreshold) return true;

  // Check text post keyword exclusions
  if (post.isSelf && post.selftext) {
    const startsWithKeywords = parseKeywordList(settings.textpostexclusionstartswith as string);
    if (startsWith(post.selftext, startsWithKeywords)) return true;

    const containsKeywords = parseKeywordList(settings.textpostexclusioncontainsone as string);
    if (containsOne(post.selftext, containsKeywords)) return true;
  }

  // Check link domain exclusions
  if (post.url) {
    const excludedDomains = (settings.linkdomainexclusions as string || '').split(',').map(d => d.trim());
    const postDomain = new URL(post.url).hostname;
    if (excludedDomains.some(domain => postDomain.includes(domain))) return true;
  }

  // Check moderator approval
  if (settings.respectmodapprovals && post.approved) return true;

  // Check moderator removal
  if (settings.skipmodremoved && post.removed && !await wasRemovedByBot(post.id, context)) return true;

  // Check moderator comment
  if (settings.skipifmodcomment) {
    const skipKeywords = parseKeywordList(settings.modcommentskipkeywords as string);
    if (skipKeywords.length > 0 && await hasModCommentMatchingKeywords(post, skipKeywords, context)) return true;
  }

  return false;
}
```

---

### 8003 - Known Domain Configuration
**Description:** Configure image/video hosting domains and enforcement link domains.

**Implementation:**
```typescript
// === IMAGE DOMAINS ===
{
  type: 'paragraph',
  name: 'imagedomains',
  label: 'Known Image Domains',
  helpText: 'One domain/pattern per line. Defaults included: imgur, i.redd.it, steamusercontent, gyazo',
  defaultValue: `steamusercontent.com
steamuserimages-a.akamaihd.net
steamcommunity.com/sharedfiles
i.redd.it
i.reddit
i.reddituploads.com
i.redditmedia.com
twimg.com
imgur.com
sli.mg
gyazo.com
.png
.gif
.jpg
.jpeg
.webp`,
  scope: SettingScope.Installation,
},

// === VIDEO DOMAINS ===
{
  type: 'paragraph',
  name: 'videodomains',
  label: 'Known Video Domains',
  helpText: 'One domain/pattern per line. Defaults included: youtube, v.redd.it, streamable, gfycat',
  defaultValue: `v.redd.it
youtube.com
youtu.be
twitch.tv
clips.twitch.tv
streamable.com
gfycat.com
redgifs.com
.mp4
.webm
.mov
.avi`,
  scope: SettingScope.Installation,
},

// === LINK ENFORCEMENT DOMAINS ===
{
  type: 'paragraph',
  name: 'linkenforcementdomains',
  label: 'Link Enforcement Domains',
  helpText: 'Links from these domains require R5. One domain per line. Example: "twitter.com" enforces all Twitter links.',
  defaultValue: '',
  scope: SettingScope.Installation,
},
```

**Domain Parsing:**
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

---

### 8004 - Keyword Filtering
**Description:** Configure enforcement and skip keywords for text posts.

**Implementation:**
```typescript
// === ENFORCEMENT KEYWORDS ===
{
  type: 'paragraph',
  name: 'enforcementkeywords',
  label: 'Enforcement Keywords',
  helpText: 'Text posts containing these keywords require R5. One keyword per line. Case-insensitive.',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === SKIP KEYWORDS (TAKES PRIORITY) ===
{
  type: 'paragraph',
  name: 'skipkeywords',
  label: 'Skip Keywords',
  helpText: 'Text posts containing these keywords skip enforcement (overrides enforcement keywords). One keyword per line. Case-insensitive.',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === MODMAIL KEYWORDS ===
{
  type: 'paragraph',
  name: 'modmailkeywords',
  label: 'Modmail Subject Keywords',
  helpText: 'Modmail subjects containing these keywords will be processed by bot. One keyword per line. Default: "rule 5", "r5", "screenshot"',
  defaultValue: `rule 5
r5
screenshot
reapproval
reinstate`,
  scope: SettingScope.Installation,
},
```

**Keyword Checking:**
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

function containsKeyword(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

async function shouldEnforceByKeywords(text: string, context: Context): Promise<boolean> {
  const skipKeywords = await getSkipKeywords(context);
  if (containsKeyword(text, skipKeywords)) return false; // Skip takes priority

  const enforcementKeywords = await getEnforcementKeywords(context);
  return containsKeyword(text, enforcementKeywords);
}
```

---

### 8005 - Flair-Based Rules
**Description:** Configure flair-based enforcement and exclusions.

**Implementation:**
```typescript
// === ENFORCE ON FLAIRS ===
{
  type: 'string',
  name: 'enforcedflairs',
  label: 'Enforce on Flairs (overrides post type)',
  helpText: 'Comma-separated flair keywords. Posts with these flairs ALWAYS require R5, regardless of post type. Example: "screenshot,image,gameplay"',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === EXCLUDE FLAIRS ===
{
  type: 'string',
  name: 'excludedflairs',
  label: 'Excluded Flairs (overrides post type)',
  helpText: 'Comma-separated flair keywords. Posts with these flairs NEVER require R5, regardless of post type. Example: "comic,art,discussion,meta"',
  defaultValue: 'comic,art',
  scope: SettingScope.Installation,
},
```

**Flair Checking:**
```typescript
async function shouldEnforceByFlair(post: Post, context: Context): Promise<boolean | null> {
  if (!post.linkFlairText) return null; // No flair, can't determine

  const settings = await context.settings.getAll();
  const postFlair = post.linkFlairText.toLowerCase();

  // Check excluded flairs first (highest priority)
  const excludedFlairs = (settings.excludedflairs as string || '').split(',').map(f => f.trim().toLowerCase());
  if (excludedFlairs.some(flair => postFlair.includes(flair))) {
    return false; // Explicit exclusion
  }

  // Check enforced flairs
  const enforcedFlairs = (settings.enforcedflairs as string || '').split(',').map(f => f.trim().toLowerCase());
  if (enforcedFlairs.some(flair => postFlair.includes(flair))) {
    return true; // Explicit enforcement
  }

  return null; // No flair-based rule, use post type rules
}
```

---

### 8006 - R5 Comment Validation Requirements
**Description:** Define what constitutes a valid Rule 5 comment.

**Implementation:**
```typescript
// === MINIMUM LENGTH ===
{
  type: 'number',
  name: 'mincommentlength',
  label: 'Minimum R5 Comment Length',
  helpText: 'Minimum characters required for valid R5 comment',
  defaultValue: 50,
  scope: SettingScope.Installation,
  onValidate: (value) => {
    if (value < 10) return 'Minimum length must be at least 10 characters';
    if (value > 1000) return 'Minimum length cannot exceed 1000 characters';
  }
},

// === REPORT LENGTH (TOO SHORT BUT ACCEPTABLE) ===
{
  type: 'number',
  name: 'reportcommentlength',
  label: 'Report R5 Comment Length',
  helpText: 'Comments meeting this length count as valid but get reported to mods. Set equal to minimum to disable. Example: minimum=50, report=75 means 50-74 chars = valid but reported.',
  defaultValue: 75,
  scope: SettingScope.Installation,
},

// === REQUIRED KEYWORDS (CONTAINS ONE) ===
{
  type: 'paragraph',
  name: 'r5containsone',
  label: 'R5 Must Contain One Of (optional)',
  helpText: 'R5 must contain at least one of these keywords. One per line. Example: "what", "why", "how", "because", "explain"',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === REQUIRED KEYWORDS (CONTAINS ALL) ===
{
  type: 'paragraph',
  name: 'r5containsall',
  label: 'R5 Must Contain All Of (optional)',
  helpText: 'R5 must contain all of these keywords. One per line. Rare use case.',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === REQUIRED START ===
{
  type: 'paragraph',
  name: 'r5startswith',
  label: 'R5 Must Start With (optional)',
  helpText: 'R5 must start with one of these keywords. One per line. Example: "R5:", "Explanation:"',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === REQUIRED END ===
{
  type: 'paragraph',
  name: 'r5endswith',
  label: 'R5 Must End With (optional)',
  helpText: 'R5 must end with one of these keywords. One per line. Rare use case.',
  defaultValue: '',
  scope: SettingScope.Installation,
},

// === COMMENT LOCATION ===
{
  type: 'select',
  name: 'r5commentlocation',
  label: 'Where to Check for R5',
  helpText: 'Where should the bot look for the R5 explanation?',
  options: [
    { label: 'Text post body only', value: 'selftext' },
    { label: 'Parent comment by author only', value: 'comment' },
    { label: 'Text post body OR parent comment', value: 'both' },
  ],
  defaultValue: ['both'],
  scope: SettingScope.Installation,
},
```

**Validation Logic:**
```typescript
async function hasValidR5Comment(post: Post, context: Context): Promise<{ valid: boolean, shouldReport: boolean, reason?: string }> {
  const settings = await context.settings.getAll();
  const minLength = settings.mincommentlength as number || 50;
  const reportLength = settings.reportcommentlength as number || 75;
  const location = settings.r5commentlocation as string || 'both';

  let r5Text = '';

  // Check text post body
  if ((location === 'selftext' || location === 'both') && post.isSelf) {
    r5Text = post.selftext || '';
  }

  // Check author comments
  if ((location === 'comment' || location === 'both') && !r5Text) {
    const comments = await post.comments.all();
    const authorComment = comments.find(c =>
      c.authorName === post.authorName &&
      c.parentId === post.id // Top-level comment
    );
    if (authorComment) {
      r5Text = authorComment.body;
    }
  }

  // Length check
  if (r5Text.length < minLength) {
    return { valid: false, shouldReport: false, reason: 'Too short' };
  }

  // Keyword validation
  const containsOneKeywords = parseKeywordList(settings.r5containsone as string);
  if (containsOneKeywords.length > 0 && !containsOne(r5Text, containsOneKeywords)) {
    return { valid: false, shouldReport: false, reason: `Must contain one of: ${containsOneKeywords.join(', ')}` };
  }

  const containsAllKeywords = parseKeywordList(settings.r5containsall as string);
  if (containsAllKeywords.length > 0 && !containsAll(r5Text, containsAllKeywords)) {
    return { valid: false, shouldReport: false, reason: `Must contain all of: ${containsAllKeywords.join(', ')}` };
  }

  const startsWithKeywords = parseKeywordList(settings.r5startswith as string);
  if (startsWithKeywords.length > 0 && !startsWith(r5Text, startsWithKeywords)) {
    return { valid: false, shouldReport: false, reason: `Must start with one of: ${startsWithKeywords.join(', ')}` };
  }

  const endsWithKeywords = parseKeywordList(settings.r5endswith as string);
  if (endsWithKeywords.length > 0 && !endsWith(r5Text, endsWithKeywords)) {
    return { valid: false, shouldReport: false, reason: `Must end with one of: ${endsWithKeywords.join(', ')}` };
  }

  // Report if between min and report threshold
  if (r5Text.length < reportLength) {
    return { valid: true, shouldReport: true, reason: 'Meets minimum but below recommended length' };
  }

  return { valid: true, shouldReport: false };
}
```

---

### 8007 - Enforcement Timing Configuration
**Description:** Configure grace periods and warning/removal timing.

**Implementation:**
```typescript
// === GRACE PERIOD ===
{
  type: 'number',
  name: 'graceperiod',
  label: 'Grace Period (minutes)',
  helpText: 'Minutes before first action (warning or removal). Set to 0 to act immediately.',
  defaultValue: 5,
  scope: SettingScope.Installation,
  onValidate: (value) => {
    if (value < 0) return 'Grace period cannot be negative';
    if (value > 1440) return 'Grace period cannot exceed 24 hours (1440 minutes)';
  }
},

// === WARNING PERIOD ===
{
  type: 'number',
  name: 'warningperiod',
  label: 'Warning Period (minutes)',
  helpText: 'Minutes after warning before removal. Set to 0 to remove without warning.',
  defaultValue: 10,
  scope: SettingScope.Installation,
  onValidate: (value) => {
    if (value < 0) return 'Warning period cannot be negative';
    if (value > 1440) return 'Warning period cannot exceed 24 hours (1440 minutes)';
  }
},

// === REMOVAL PERIOD ===
{
  type: 'number',
  name: 'removalperiod',
  label: 'Direct Removal Period (minutes)',
  helpText: 'Minutes before removal if not using warnings. Only used if warning period = 0. Combines with grace period.',
  defaultValue: 15,
  scope: SettingScope.Installation,
  onValidate: (value) => {
    if (value < 0) return 'Removal period cannot be negative';
  }
},
```

**Validation:**
```typescript
async function validateTimingSettings(context: Context): Promise<string | null> {
  const settings = await context.settings.getAll();
  const grace = settings.graceperiod as number || 0;
  const warning = settings.warningperiod as number || 0;
  const removal = settings.removalperiod as number || 0;

  // At least one period must be non-zero
  if (grace === 0 && warning === 0 && removal === 0) {
    return 'At least one timing period (grace, warning, or removal) must be greater than 0';
  }

  return null; // Valid
}
```

---

### 8008 - Bot Behavior Configuration
**Description:** Configure how the bot acts when enforcing.

**Implementation:**
```typescript
// === REMOVAL VS REPORTING ===
{
  type: 'select',
  name: 'enforcementaction',
  label: 'Enforcement Action',
  helpText: 'What should the bot do after grace/warning periods?',
  options: [
    { label: 'Remove posts (standard moderation)', value: 'remove' },
    { label: 'Report posts only (review queue)', value: 'report' },
    { label: 'Both remove and report', value: 'both' },
  ],
  defaultValue: ['remove'],
  scope: SettingScope.Installation,
},

// === WARNING COMMENT ===
{
  type: 'boolean',
  name: 'commentonwarning',
  label: 'Comment on Warning',
  helpText: 'Post a comment when warning users about missing R5',
  defaultValue: true,
  scope: SettingScope.Installation,
},

// === REMOVAL COMMENT ===
{
  type: 'boolean',
  name: 'commentonremoval',
  label: 'Comment on Removal',
  helpText: 'Post a comment when removing posts for missing R5',
  defaultValue: true,
  scope: SettingScope.Installation,
},

// === REINSTATEMENT COMMENT ===
{
  type: 'boolean',
  name: 'commentonreinstatement',
  label: 'Comment on Reinstatement',
  helpText: 'Post a comment when approving removed posts (not recommended - silent approval is better UX)',
  defaultValue: false,
  scope: SettingScope.Installation,
},

// === MODMAIL MONITORING ===
{
  type: 'boolean',
  name: 'enablemodmail',
  label: 'Monitor Modmail',
  helpText: 'Check modmail for reinstatement requests',
  defaultValue: true,
  scope: SettingScope.Installation,
},

// === AUTO-REINSTATE FROM MODMAIL ===
{
  type: 'boolean',
  name: 'autoreinstate',
  label: 'Auto-Reinstate from Modmail',
  helpText: 'Automatically approve posts when valid modmail received (requires modmail monitoring)',
  defaultValue: true,
  scope: SettingScope.Installation,
},

// === AUTO-ARCHIVE MODMAIL ===
{
  type: 'boolean',
  name: 'autoarchivemodmail',
  label: 'Auto-Archive Modmail',
  helpText: 'Automatically archive modmail conversations after processing',
  defaultValue: true,
  scope: SettingScope.Installation,
},

// === CLEANUP WARNING COMMENTS ===
{
  type: 'boolean',
  name: 'cleanupwarnings',
  label: 'Cleanup Warning Comments',
  helpText: 'Delete warning comments after user complies or post is removed',
  defaultValue: true,
  scope: SettingScope.Installation,
},
```

---

### 8009 - Notification Configuration
**Description:** Configure what events trigger Slack/Discord notifications.

**Implementation:**
```typescript
// === SLACK SETTINGS ===
{
  type: 'boolean',
  name: 'enableslack',
  label: 'Enable Slack Notifications',
  helpText: 'Send notifications to Slack webhook',
  defaultValue: false,
  scope: SettingScope.Installation,
},
{
  type: 'string',
  name: 'slackwebhook',
  label: 'Slack Webhook URL',
  helpText: 'Your Slack incoming webhook URL',
  defaultValue: '',
  scope: SettingScope.Installation,
  isSecret: true,
},

// === DISCORD SETTINGS ===
{
  type: 'boolean',
  name: 'enablediscord',
  label: 'Enable Discord Notifications',
  helpText: 'Send notifications to Discord webhook',
  defaultValue: false,
  scope: SettingScope.Installation,
},
{
  type: 'string',
  name: 'discordwebhook',
  label: 'Discord Webhook URL',
  helpText: 'Your Discord webhook URL',
  defaultValue: '',
  scope: SettingScope.Installation,
  isSecret: true,
},

// === NOTIFICATION EVENTS ===
{
  type: 'select',
  name: 'notificationevents',
  label: 'Notify On Events',
  helpText: 'Which events should trigger notifications? (multi-select)',
  multiSelect: true,
  options: [
    { label: 'R5 Reported (too short but valid)', value: 'r5_report' },
    { label: 'R5 Not Meeting Requirements', value: 'r5_invalid' },
    { label: 'Warning Posted', value: 'warning' },
    { label: 'Post Removed', value: 'removal' },
    { label: 'Post Reinstated', value: 'reinstatement' },
    { label: 'Bot Errors', value: 'error' },
  ],
  defaultValue: ['removal', 'reinstatement', 'error'],
  scope: SettingScope.Installation,
},
```

---

### 8010 - Message Templates
**Description:** Customizable message templates with variable substitution.

**Implementation:**
```typescript
// === WARNING TEMPLATE ===
{
  type: 'paragraph',
  name: 'warningtemplate',
  label: 'Warning Message Template',
  helpText: 'Variables: {{username}}, {{subreddit}}, {{permalink}}, {{postid}}, {{graceminutes}}, {{warningminutes}}',
  defaultValue: `Hi /u/{{username}},

You have not yet added a rule #5 comment to your post:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

Since a rule #5 comment is mandatory, your post will be removed if you do not add this comment within {{warningminutes}} minutes.

You do not need to reply, modmail, or report if you've added a rule #5 comment; this comment will be deleted automatically.`,
  scope: SettingScope.Installation,
},

// === REMOVAL TEMPLATE ===
{
  type: 'paragraph',
  name: 'removaltemplate',
  label: 'Removal Message Template',
  helpText: 'Variables: {{username}}, {{subreddit}}, {{permalink}}, {{postid}}, {{modmaillink}}',
  defaultValue: `Hi /u/{{username}},

Your submission has been removed from /r/{{subreddit}} for breaking rule #5:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

If this was the only rule broken, we will reapprove your submission if you add background info.

Please [contact us through modmail]({{modmaillink}}) to get it reapproved.

Replying to this comment or sending a private message to this bot will not get your post reinstated; we only respond to the modmail.`,
  scope: SettingScope.Installation,
},

// === REPORT REASON: TOO SHORT ===
{
  type: 'string',
  name: 'reportreasontooshort',
  label: 'Report Reason: R5 Too Short',
  helpText: 'Reason text when reporting posts with R5 comments that meet minimum but not recommended length',
  defaultValue: 'R5 comment is too short (meets minimum but below recommended length)',
  scope: SettingScope.Installation,
},

// === REPORT REASON: NO R5 ===
{
  type: 'string',
  name: 'reportreasonnor5',
  label: 'Report Reason: No R5',
  helpText: 'Reason text when reporting posts without R5 (if using report mode instead of removal)',
  defaultValue: 'No Rule 5 explanation provided',
  scope: SettingScope.Installation,
},

// === SLACK/DISCORD NOTIFICATION TEMPLATES ===
{
  type: 'paragraph',
  name: 'notificationtemplate',
  label: 'Notification Message Template',
  helpText: 'Template for Slack/Discord. Variables: {{event}}, {{username}}, {{subreddit}}, {{posturl}}, {{reason}}',
  defaultValue: `**{{event}}** in r/{{subreddit}}
User: u/{{username}}
Post: {{posturl}}
Reason: {{reason}}`,
  scope: SettingScope.Installation,
},
```

**Template Substitution:**
```typescript
function substituteVariables(
  template: string,
  variables: { [key: string]: string | number }
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

async function getWarningMessage(post: Post, context: Context): Promise<string> {
  const settings = await context.settings.getAll();
  const template = settings.warningtemplate as string;
  const gracePeriod = settings.graceperiod as number || 0;
  const warningPeriod = settings.warningperiod as number || 0;

  return substituteVariables(template, {
    username: post.authorName || '[deleted]',
    subreddit: post.subredditName,
    permalink: `https://reddit.com${post.permalink}`,
    postid: post.id,
    graceminutes: gracePeriod,
    warningminutes: warningPeriod,
  });
}
```

---

### 8011 - Accessing Settings in Code
**Description:** Retrieve settings values in triggers and handlers.

**Implementation:**
```typescript
async function getSettings(context: Context) {
  return await context.settings.getAll();
}

async function getSetting<T>(name: string, context: Context): Promise<T | undefined> {
  const settings = await context.settings.getAll();
  return settings[name] as T;
}

// Usage examples
const gracePeriod = await getSetting<number>('graceperiod', context) || 5;
const enforcedTypes = await getSetting<string[]>('enforcedposttypes', context) || ['image'];
const slackEnabled = await getSetting<boolean>('enableslack', context) || false;
```

---

### 8012 - Settings Validation
**Description:** Validate settings values to prevent misconfigurations.

**Validation Rules:**
```typescript
// Timing validations
graceperiod: {
  min: 0,
  max: 1440,
  message: 'Must be between 0 and 1440 minutes (24 hours)'
}

warningperiod: {
  min: 0,
  max: 1440,
  message: 'Must be between 0 and 1440 minutes (24 hours)'
}

// At least one timing period must be > 0
custom: {
  check: (settings) => {
    const grace = settings.graceperiod || 0;
    const warning = settings.warningperiod || 0;
    const removal = settings.removalperiod || 0;
    return grace > 0 || warning > 0 || removal > 0;
  },
  message: 'At least one timing period must be greater than 0'
}

// Length validations
mincommentlength: {
  min: 10,
  max: 1000,
  message: 'Must be between 10 and 1000 characters'
}

// URL validation
slackwebhook: {
  pattern: /^https:\/\/hooks\.slack\.com\/services\/.+/,
  message: 'Must be a valid Slack webhook URL'
}

discordwebhook: {
  pattern: /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/.+/,
  message: 'Must be a valid Discord webhook URL'
}
```

---

### 8013 - Settings UI Location
**Description:** Where moderators access the settings interface.

**URL Pattern:**
```
https://developers.reddit.com/r/{subreddit}/apps/{app-name}
```

**Example:**
```
https://developers.reddit.com/r/paradoxplaza/apps/rule5bot
```

**Access Requirements:**
- User must be moderator of the subreddit
- App must be installed on the subreddit

---

### 8014 - Multi-Subreddit Settings
**Description:** Each subreddit gets independent settings.

**Example Configuration:**

**r/paradoxplaza:**
- Enforce: Images, galleries, text with images
- Grace: 5 min, Warning: 10 min
- Excluded flairs: comic, art
- Slack: Enabled

**r/eu4:**
- Enforce: Images, galleries, videos
- Grace: 3 min, Warning: 7 min
- Excluded flairs: comic, art, discussion
- Discord: Enabled

**r/hoi4:**
- Enforce: Images only
- Grace: 10 min, Warning: 15 min
- Skip upvote threshold: 100
- Both Slack and Discord: Enabled

---

## Configuration Settings Summary

### Post Type Enforcement
| Setting | Type | Default |
|---------|------|---------|
| `enforcedposttypes` | select (multi) | image, gallery, text_image, link_image |

### Post Type Exclusions
| Setting | Type | Default |
|---------|------|---------|
| `allowlistedusers` | string | "" |
| `maxpostage` | number | 0 (disabled) |
| `skipupvotethreshold` | number | 0 (disabled) |
| `textpostexclusionstartswith` | paragraph | "" |
| `textpostexclusioncontainsone` | paragraph | "" |
| `linkdomainexclusions` | string | "" |
| `respectmodapprovals` | boolean | true |
| `skipmodremoved` | boolean | true |
| `skipifmodcomment` | boolean | false |
| `modcommentskipkeywords` | paragraph | "" |

### Known Domains
| Setting | Type | Default |
|---------|------|---------|
| `imagedomains` | paragraph | (imgur, i.redd.it, etc.) |
| `videodomains` | paragraph | (youtube, v.redd.it, etc.) |
| `linkenforcementdomains` | paragraph | "" |

### Keywords
| Setting | Type | Default |
|---------|------|---------|
| `enforcementkeywords` | paragraph | "" |
| `skipkeywords` | paragraph | "" |
| `modmailkeywords` | paragraph | "rule 5", "r5", etc. |

### Flair Rules
| Setting | Type | Default |
|---------|------|---------|
| `enforcedflairs` | string | "" |
| `excludedflairs` | string | "comic,art" |

### R5 Validation
| Setting | Type | Default |
|---------|------|---------|
| `mincommentlength` | number | 50 |
| `reportcommentlength` | number | 75 |
| `r5containsone` | paragraph | "" |
| `r5containsall` | paragraph | "" |
| `r5startswith` | paragraph | "" |
| `r5endswith` | paragraph | "" |
| `r5commentlocation` | select | both |

### Timing
| Setting | Type | Default |
|---------|------|---------|
| `graceperiod` | number | 5 |
| `warningperiod` | number | 10 |
| `removalperiod` | number | 15 |

### Bot Behavior
| Setting | Type | Default |
|---------|------|---------|
| `enforcementaction` | select | remove |
| `commentonwarning` | boolean | true |
| `commentonremoval` | boolean | true |
| `commentonreinstatement` | boolean | false |
| `enablemodmail` | boolean | true |
| `autoreinstate` | boolean | true |
| `autoarchivemodmail` | boolean | true |
| `cleanupwarnings` | boolean | true |

### Notifications
| Setting | Type | Default |
|---------|------|---------|
| `enableslack` | boolean | false |
| `slackwebhook` | string (secret) | "" |
| `enablediscord` | boolean | false |
| `discordwebhook` | string (secret) | "" |
| `notificationevents` | select (multi) | removal, reinstatement, error |

### Templates
| Setting | Type | Default |
|---------|------|---------|
| `warningtemplate` | paragraph | (see above) |
| `removaltemplate` | paragraph | (see above) |
| `reportreasontooshort` | string | (see above) |
| `reportreasonnor5` | string | (see above) |
| `notificationtemplate` | paragraph | (see above) |

---

## Benefits

✅ **Granular control** - Configure exactly which posts require R5
✅ **Flexible exclusions** - Multiple ways to skip enforcement
✅ **Keyword-based enforcement** - Enforce on text posts with specific content
✅ **Flair overrides** - Flair rules take priority over post types
✅ **Configurable validation** - Define what makes a valid R5
✅ **Flexible timing** - Grace, warning, and removal periods
✅ **Behavior customization** - Remove vs report, commenting preferences
✅ **Multi-platform notifications** - Slack and Discord with event filtering
✅ **Template customization** - Customize all user-facing messages
✅ **Per-subreddit settings** - Each installation independent
✅ **No code changes needed** - All configuration via UI
✅ **Type safety** - Field types enforced by Devvit
✅ **Validation** - Built-in input validation prevents misconfigurations
✅ **Secret handling** - Secure storage for webhooks
