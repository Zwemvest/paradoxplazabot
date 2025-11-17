# 3000 - Comment Validation

## Overview
Verify if the post author has added a proper Rule 5 explanation based on configurable requirements: location, minimum length, report threshold, and required text patterns.

---

## Features

### 3001 - Configurable R5 Location Check
**Description:** Check for R5 in configured locations (selftext, comment, or both).

**Implementation:**
```typescript
async function getR5Location(context: Context): Promise<'selftext' | 'comment' | 'both'> {
  const settings = await context.settings.getAll();
  const location = settings.r5commentlocation as string || 'both';
  return location as 'selftext' | 'comment' | 'both';
}

async function findR5Text(post: Post, context: Context): Promise<string | null> {
  const location = await getR5Location(context);

  // CHECK TEXT POST BODY
  if ((location === 'selftext' || location === 'both') && post.isSelf) {
    const selftext = post.selftext || '';
    if (selftext.trim().length > 0) {
      return selftext;
    }
  }

  // CHECK AUTHOR COMMENTS
  if (location === 'comment' || location === 'both') {
    const comments = await post.comments.all();
    const authorComments = comments.filter(c =>
      c.authorName &&
      c.authorName.toLowerCase() === post.authorName?.toLowerCase() &&
      c.parentId === post.id // Top-level comment only
    );

    // Return first author comment (chronologically)
    if (authorComments.length > 0) {
      return authorComments[0].body;
    }
  }

  return null; // No R5 found
}
```

**Locations:**
- `selftext` - Only check text post body (not comments)
- `comment` - Only check top-level author comments
- `both` - Check text post body OR top-level author comment

**Use Cases:**
- `selftext` only - For subreddits where R5 must be in post body
- `comment` only - For image posts where R5 must be a comment
- `both` (default) - Most flexible, allows either location

**Configuration:**
- Setting: `r5commentlocation` (select) - Where to check for R5
- Default: `'both'`

---

### 3002 - Minimum Length Validation
**Description:** Ensure R5 meets minimum character requirement.

**Implementation:**
```typescript
async function getMinCommentLength(context: Context): Promise<number> {
  const settings = await context.settings.getAll();
  return (settings.mincommentlength as number) || 50;
}

function meetsMinimumLength(text: string, minLength: number): boolean {
  return text.trim().length >= minLength;
}
```

**Validation:**
- Default: 50 characters
- Range: 10-1000 characters (validated in settings)

**Rationale:**
- Prevents "R5: look at it" lazy comments
- Encourages substantive explanation
- Configurable per subreddit community standards

**Configuration:**
- Setting: `mincommentlength` (number) - Minimum characters required
- Default: `50`

---

### 3003 - Report Length Threshold
**Description:** Comments meeting minimum but below recommended length get reported to mods.

**Implementation:**
```typescript
async function getReportCommentLength(context: Context): Promise<number> {
  const settings = await context.settings.getAll();
  return (settings.reportcommentlength as number) || 75;
}

async function shouldReportShortR5(text: string, context: Context): Promise<boolean> {
  const minLength = await getMinCommentLength(context);
  const reportLength = await getReportCommentLength(context);
  const textLength = text.trim().length;

  // Report if between min and report threshold
  return textLength >= minLength && textLength < reportLength;
}
```

**Logic:**
- `length < minLength` → Invalid R5, remove post
- `minLength <= length < reportLength` → Valid R5, but report to mods
- `length >= reportLength` → Valid R5, no action

**Example:**
```
minLength = 50
reportLength = 75

45 chars → Invalid (remove)
50 chars → Valid but reported (meets minimum)
74 chars → Valid but reported (below recommended)
75 chars → Valid (no report)
```

**Use Cases:**
- Moderators want to review borderline R5 comments
- Community prefers longer explanations than hard minimum
- Allows gradual enforcement (report before remove)

**Configuration:**
- Setting: `reportcommentlength` (number) - Threshold for reporting
- Default: `75`
- Set equal to `mincommentlength` to disable reporting

---

### 3004 - Required Keyword Validation
**Description:** Optionally require R5 to contain specific keywords using flexible matching rules.

**Implementation:**
```typescript
async function validateR5Keywords(text: string, context: Context): Promise<{ valid: boolean, reason?: string }> {
  const settings = await context.settings.getAll();

  // Check contains one (OR logic)
  const containsOneKeywords = parseKeywordList(settings.r5containsone as string);
  if (containsOneKeywords.length > 0 && !containsOne(text, containsOneKeywords)) {
    return {
      valid: false,
      reason: `Must contain one of: ${containsOneKeywords.join(', ')}`
    };
  }

  // Check contains all (AND logic)
  const containsAllKeywords = parseKeywordList(settings.r5containsall as string);
  if (containsAllKeywords.length > 0 && !containsAll(text, containsAllKeywords)) {
    return {
      valid: false,
      reason: `Must contain all of: ${containsAllKeywords.join(', ')}`
    };
  }

  // Check starts with (OR logic)
  const startsWithKeywords = parseKeywordList(settings.r5startswith as string);
  if (startsWithKeywords.length > 0 && !startsWith(text, startsWithKeywords)) {
    return {
      valid: false,
      reason: `Must start with one of: ${startsWithKeywords.join(', ')}`
    };
  }

  // Check ends with (OR logic)
  const endsWithKeywords = parseKeywordList(settings.r5endswith as string);
  if (endsWithKeywords.length > 0 && !endsWith(text, endsWithKeywords)) {
    return {
      valid: false,
      reason: `Must end with one of: ${endsWithKeywords.join(', ')}`
    };
  }

  return { valid: true };
}
```

**Use Cases:**
- Require explanatory words: containsOne = ["what", "why", "how", "because", "explain", "reason"]
- Require R5 prefix: startsWith = ["R5:", "Explanation:"]
- Require question format: endsWith = ["?"]
- Require multiple elements: containsAll = ["screenshot", "game", "year"]

**Example Configurations:**

**Require explanatory language:**
```
r5containsone:
what
why
how
because
explain
reason
```

**Require R5 prefix:**
```
r5startswith:
R5:
Explanation:
Context:
```

**Require both context and explanation:**
```
r5containsall:
screenshot
explanation
```

**Configuration:**
- Setting: `r5containsone` (paragraph) - Must contain at least one of these keywords
- Setting: `r5containsall` (paragraph) - Must contain all of these keywords
- Setting: `r5startswith` (paragraph) - Must start with one of these keywords
- Setting: `r5endswith` (paragraph) - Must end with one of these keywords
- All default to `""` (disabled)

---

### 3005 - Complete R5 Validation
**Description:** Main validation function applying all checks.

**Implementation:**
```typescript
interface R5ValidationResult {
  valid: boolean;
  shouldReport: boolean;
  reason: string;
  text?: string;
}

async function hasValidR5Comment(post: Post, context: Context): Promise<R5ValidationResult> {
  // STEP 1: Find R5 text
  const r5Text = await findR5Text(post, context);

  if (!r5Text) {
    return {
      valid: false,
      shouldReport: false,
      reason: 'No R5 comment found',
    };
  }

  // STEP 2: Check minimum length
  const minLength = await getMinCommentLength(context);
  if (!meetsMinimumLength(r5Text, minLength)) {
    return {
      valid: false,
      shouldReport: false,
      reason: `R5 too short (${r5Text.trim().length} chars, minimum ${minLength})`,
      text: r5Text,
    };
  }

  // STEP 3: Check required keywords
  const keywordValidation = await validateR5Keywords(r5Text, context);
  if (!keywordValidation.valid) {
    return {
      valid: false,
      shouldReport: false,
      reason: keywordValidation.reason || 'R5 missing required keywords',
      text: r5Text,
    };
  }

  // STEP 4: Check if should report (meets minimum but below recommended)
  const shouldReport = await shouldReportShortR5(r5Text, context);

  return {
    valid: true,
    shouldReport: shouldReport,
    reason: shouldReport ? 'R5 meets minimum but below recommended length' : 'Valid R5',
    text: r5Text,
  };
}
```

**Validation Flow:**
```
Find R5 text
  ↓
R5 found? → NO → Invalid (remove)
  ↓ YES
Length >= minimum? → NO → Invalid (remove)
  ↓ YES
Contains required text? → NO → Invalid (remove)
  ↓ YES
Length >= report threshold? → NO → Valid but report
  ↓ YES
Valid (no report)
```

---

### 3006 - Report R5 to Moderators
**Description:** Report posts with short but valid R5 comments.

**Implementation:**
```typescript
async function reportShortR5(post: Post, context: Context): Promise<void> {
  const settings = await context.settings.getAll();
  const reportReason = settings.reportreasontooshort as string || 'R5 comment is too short (meets minimum but below recommended length)';

  await post.report({
    reason: reportReason,
  });
}
```

**When to Report:**
- R5 meets `mincommentlength`
- R5 below `reportcommentlength`
- R5 contains required text (if configured)

**Configuration:**
- Setting: `reportreasontooshort` (string) - Custom report reason
- Default: `"R5 comment is too short (meets minimum but below recommended length)"`

---

### 3007 - Fetch Post Comments
**Description:** Retrieve all comments from a post to search for author's R5 comment.

**Implementation:**
```typescript
async function getPostComments(postId: string, context: Context): Promise<Comment[]> {
  const post = await context.reddit.getPostById(postId);
  const comments = await post.comments.all();
  return comments;
}

async function getTopLevelComments(post: Post, context: Context): Promise<Comment[]> {
  const allComments = await post.comments.all();
  return allComments.filter(comment => comment.parentId === post.id);
}
```

**Considerations:**
- Only check top-level comments (not replies)
- Handle deleted/removed comments gracefully
- Ignore bot's own comments
- Filter by author in `findAuthorComments()`

---

### 3008 - Find Author Comments
**Description:** Locate comments made by the post author.

**Implementation:**
```typescript
async function findAuthorComments(post: Post, context: Context): Promise<Comment[]> {
  if (!post.authorName) return [];

  const comments = await post.comments.all();
  const authorName = post.authorName.toLowerCase();

  return comments.filter(comment =>
    comment.authorName &&
    comment.authorName.toLowerCase() === authorName &&
    comment.parentId === post.id // Top-level only
  );
}
```

**Edge Cases:**
- Author deletes their account → Skip enforcement
- Author is suspended → Skip enforcement
- Author is shadowbanned → Comments may not appear
- Multiple author comments → Use first chronologically

---

### 3009 - Ignore Bot Comments
**Description:** Don't count bot's own comments as R5.

**Implementation:**
```typescript
async function isBotComment(comment: Comment, context: Context): Promise<boolean> {
  if (!comment.authorName) return false;

  // Get bot's username from context
  const appUser = await context.reddit.getCurrentUser();
  return comment.authorName.toLowerCase() === appUser.username.toLowerCase();
}

async function findAuthorCommentsExcludingBot(post: Post, context: Context): Promise<Comment[]> {
  const authorComments = await findAuthorComments(post, context);
  const filtered = [];

  for (const comment of authorComments) {
    if (!await isBotComment(comment, context)) {
      filtered.push(comment);
    }
  }

  return filtered;
}
```

**Why:**
- Bot's warning/removal comments shouldn't count as R5
- Prevents false positives if bot username matches author

---

### 3010 - Handle Comment Timing
**Description:** Track when R5 comment was added relative to post and warnings.

**Implementation:**
```typescript
interface CommentTiming {
  postCreated: Date;
  commentCreated: Date;
  minutesAfterPost: number;
  addedBeforeWarning: boolean;
  addedAfterWarning: boolean;
  addedAfterRemoval: boolean;
}

async function getCommentTiming(post: Post, comment: Comment, context: Context): Promise<CommentTiming> {
  const postCreated = post.createdAt;
  const commentCreated = comment.createdAt;
  const minutesAfterPost = (commentCreated.getTime() - postCreated.getTime()) / 60000;

  const hasWarning = await context.redis.get(`warned:${post.id}`) !== null;
  const wasRemoved = await context.redis.get(`removed:${post.id}`) !== null;

  let warningTime: Date | null = null;
  if (hasWarning) {
    const warningTimeStr = await context.redis.get(`warned:${post.id}`);
    if (warningTimeStr) {
      warningTime = new Date(parseInt(warningTimeStr));
    }
  }

  return {
    postCreated,
    commentCreated,
    minutesAfterPost,
    addedBeforeWarning: !hasWarning,
    addedAfterWarning: hasWarning && warningTime ? commentCreated > warningTime : false,
    addedAfterRemoval: wasRemoved,
  };
}
```

**Use Cases:**
- Track if user complied before warning
- Track if user added R5 after warning (triggers reinstatement)
- Analytics: How long does it take users to add R5?

---

### 3011 - Check for R5 Added After Warning
**Description:** Detect when user adds valid R5 after being warned.

**Implementation:**
```typescript
async function wasR5AddedAfterWarning(post: Post, context: Context): Promise<boolean> {
  // Check if post was warned
  const warnedKey = `warned:${post.id}`;
  const warningTimeStr = await context.redis.get(warnedKey);
  if (!warningTimeStr) {
    return false; // Never warned
  }

  const warningTime = new Date(parseInt(warningTimeStr));

  // Check if valid R5 exists
  const r5Result = await hasValidR5Comment(post, context);
  if (!r5Result.valid) {
    return false; // No valid R5
  }

  // Find when R5 was added
  const authorComments = await findAuthorComments(post, context);
  if (authorComments.length === 0) {
    // R5 is in selftext, assume it was there from start
    return false;
  }

  const r5Comment = authorComments[0];
  return r5Comment.createdAt > warningTime; // R5 added after warning
}
```

**Triggers:**
- Automatic reinstatement flow (see 6000-reinstatement-system.md)
- Clean up warning comments
- Approve post
- Mark as approved in Redis

---

### 3012 - Validate Comment Quality
**Description:** Additional quality checks beyond length.

**Implementation:**
```typescript
interface QualityCheck {
  valid: boolean;
  reason?: string;
}

async function checkR5Quality(text: string, context: Context): Promise<QualityCheck> {
  // Check for pure URLs (no explanation)
  const urlOnlyRegex = /^https?:\/\/[^\s]+$/;
  if (urlOnlyRegex.test(text.trim())) {
    return {
      valid: false,
      reason: 'R5 is only a URL without explanation',
    };
  }

  // Check for common lazy responses
  const lazyPhrases = [
    'look at it',
    'self-explanatory',
    'just look',
    'see the image',
    'obvious',
  ];

  const lowerText = text.toLowerCase();
  for (const phrase of lazyPhrases) {
    if (lowerText.includes(phrase) && text.length < 100) {
      return {
        valid: false,
        reason: `R5 contains lazy phrase: "${phrase}"`,
      };
    }
  }

  return { valid: true };
}

async function hasValidR5CommentWithQuality(post: Post, context: Context): Promise<R5ValidationResult> {
  // First, check basic R5 validation
  const r5Result = await hasValidR5Comment(post, context);

  if (!r5Result.valid || !r5Result.text) {
    return r5Result;
  }

  // Then, check quality
  const qualityCheck = await checkR5Quality(r5Result.text, context);
  if (!qualityCheck.valid) {
    return {
      valid: false,
      shouldReport: false,
      reason: qualityCheck.reason || 'R5 quality check failed',
      text: r5Result.text,
    };
  }

  return r5Result;
}
```

**Quality Checks:**
- Pure URLs without explanation
- Common lazy phrases ("look at it", "self-explanatory")
- Could expand to:
  - Emoji-only comments
  - Repetitive characters ("aaaaa")
  - Copy-paste detection

**Configuration:**
- Could add setting: `enablequalitychecks` (boolean)
- Could add setting: `lazyphrases` (paragraph) - Custom phrases

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `r5commentlocation` | select | both | Where to check for R5 (selftext, comment, both) |
| `mincommentlength` | number | 50 | Minimum characters for valid R5 |
| `reportcommentlength` | number | 75 | Report if R5 below this length |
| `r5containsone` | paragraph | "" | Keywords R5 must contain (at least one) |
| `r5containsall` | paragraph | "" | Keywords R5 must contain (all of them) |
| `r5startswith` | paragraph | "" | Keywords R5 must start with (one of them) |
| `r5endswith` | paragraph | "" | Keywords R5 must end with (one of them) |
| `reportreasontooshort` | string | (default) | Report reason for short R5 |

---

## Validation Results

### Valid R5 (No Report)
```typescript
{
  valid: true,
  shouldReport: false,
  reason: 'Valid R5',
  text: 'This is my campaign as France. I managed to unite all of Europe under my rule after 300 years of diplomacy and warfare. The screenshot shows my final borders.'
}
```

### Valid R5 (Report to Mods)
```typescript
{
  valid: true,
  shouldReport: true,
  reason: 'R5 meets minimum but below recommended length',
  text: 'This is my France campaign. I united Europe.'
}
```

### Invalid R5 (Too Short)
```typescript
{
  valid: false,
  shouldReport: false,
  reason: 'R5 too short (35 chars, minimum 50)',
  text: 'My France campaign. Very big now.'
}
```

### Invalid R5 (Missing Required Text)
```typescript
{
  valid: false,
  shouldReport: false,
  reason: 'R5 missing required explanatory text',
  text: 'Here is a screenshot of my game. It looks cool.'
}
```

### No R5 Found
```typescript
{
  valid: false,
  shouldReport: false,
  reason: 'No R5 comment found',
}
```

---

## Edge Cases

- **Deleted authors**: Return invalid, skip enforcement at higher level
- **Deleted comments**: Ignore, continue searching for valid R5
- **Multiple author comments**: Use first chronologically
- **R5 in selftext + comment**: Either counts as valid (if location = 'both')
- **Bot's own comments**: Ignore, don't count as R5
- **Edited comments**: Count edited content (Reddit provides latest version)
- **Empty keyword lists**: No keyword requirements, only length validation applies

---

## Performance Considerations

- **Cache settings**: Don't re-fetch settings for every validation
- **Limit comment depth**: Only check top-level comments
- **Batch operations**: When checking multiple posts, batch Redis lookups
- **Fail open**: If validation errors, treat as "no R5" rather than crash
- **Short-circuit**: Check cheapest conditions first (length before keywords)
- **Keyword matching**: O(n) performance, no backtracking, immune to ReDoS attacks
