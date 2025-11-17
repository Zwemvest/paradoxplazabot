# 7000 - Modmail Integration

## Overview
Handle manual reapproval requests via modmail when users add R5 comments after removal.

---

## Features

### 7001 - Monitor Modmail for R5 Subjects
**Description:** Listen for modmail conversations with R5-related keywords.

**Implementation:**
```typescript
Devvit.addTrigger({
  event: 'ModMail',
  onEvent: async (event, context) => {
    const conversation = await context.reddit.getModMailConversation(event.conversationId);

    const subject = conversation.subject?.toLowerCase() || '';

    // Check for R5 keywords
    if (subject.includes('r5') || subject.includes('rule 5') || subject.includes('rule 5')) {
      await processModmailRequest(conversation, context);
    }
  }
});
```

**Keywords to Detect:**
- `r5`
- `rule 5`
- `rule five`
- `screenshot`
- Custom keywords from settings

**Configuration:**
- Setting: `modmailkeywords` (string, comma-separated)

---

### 7002 - Extract Post ID from Modmail Body
**Description:** Parse modmail message to find the Reddit post ID or URL.

**Implementation:**
```typescript
function extractPostId(text: string): string | null {
  // Pattern: https://reddit.com/r/{sub}/comments/{postId}/...
  const urlPattern = /https?:\/\/(?:www\.)?reddit\.com\/r\/[\w]+\/comments\/([\w]+)/i;
  const match = text.match(urlPattern);

  if (match && match[1]) {
    return match[1];
  }

  // Pattern: direct post ID (6-7 alphanumeric characters)
  const idPattern = /\b([a-z0-9]{6,7})\b/i;
  const idMatch = text.match(idPattern);

  return idMatch ? idMatch[1] : null;
}

async function getPostIdFromModmail(conversation: ModMailConversation): Promise<string | null> {
  const messages = conversation.messages || [];

  // Check first message (user's initial request)
  if (messages.length > 0 && messages[0].body) {
    const postId = extractPostId(messages[0].body);
    if (postId) return postId;
  }

  // Check conversation body
  if (conversation.body) {
    return extractPostId(conversation.body);
  }

  return null;
}
```

---

### 7003 - Verify Author Matches
**Description:** Ensure the modmail sender is the post author (prevent abuse).

**Implementation:**
```typescript
async function isAuthorOfPost(
  conversation: ModMailConversation,
  postId: string,
  context: Context
): Promise<boolean> {
  const messages = conversation.messages || [];
  if (messages.length === 0) return false;

  const modmailAuthor = messages[0].author?.name;
  if (!modmailAuthor) return false;

  try {
    const post = await context.reddit.getPostById(postId);
    const postAuthor = post.authorName;

    return postAuthor?.toLowerCase() === modmailAuthor.toLowerCase();
  } catch (error) {
    return false;
  }
}
```

---

### 7004 - Check If Bot Removed Post
**Description:** Verify the bot was responsible for the removal (not another mod).

**Implementation:**
```typescript
async function wasBotRemoval(postId: string, context: Context): Promise<boolean> {
  // Check Redis for removal record
  const removalKey = `removed:${postId}`;
  const wasRemoved = await context.redis.get(removalKey);

  if (!wasRemoved) return false;

  // Optional: Check removed_by field on post
  try {
    const post = await context.reddit.getPostById(postId);
    const appUser = await context.reddit.getCurrentUser();

    // If available, verify bot was remover
    // (Note: This field may not be exposed in Devvit API)
    return true; // Rely on Redis record
  } catch {
    return false;
  }
}
```

---

### 7005 - Verify R5 Comment Exists
**Description:** Check if user actually added the R5 comment before approving.

**Implementation:**
```typescript
async function verifyR5BeforeApproval(postId: string, context: Context): Promise<boolean> {
  try {
    const post = await context.reddit.getPostById(postId);
    return await hasValidR5Comment(post, context);
  } catch {
    return false;
  }
}
```

---

### 7006 - Approve Post via Modmail Request
**Description:** Re-approve the post if all conditions are met.

**Implementation:**
```typescript
async function approveViaModmail(
  postId: string,
  conversation: ModMailConversation,
  context: Context
): Promise<boolean> {
  // Verify all conditions
  if (!await isAuthorOfPost(conversation, postId, context)) {
    await replyToModmail(conversation, 'You must be the post author to request reapproval.', context);
    return false;
  }

  if (!await wasBotRemoval(postId, context)) {
    await replyToModmail(conversation, 'This post was not removed by the bot, please contact moderators.', context);
    return false;
  }

  if (!await verifyR5BeforeApproval(postId, context)) {
    await replyToModmail(conversation, 'Please add a Rule 5 comment to your post before requesting reapproval.', context);
    return false;
  }

  // Approve the post
  const post = await context.reddit.getPostById(postId);
  await reinstatePost(post, context);

  // Reply and archive
  await replyToModmail(conversation, 'Post approved. Thank you for your patience.', context);
  await archiveModmail(conversation, context);

  // Notify mods
  await notifyModmailApproval(post, conversation, context);

  return true;
}
```

---

### 7007 - Reply to Modmail
**Description:** Send a reply message in the modmail conversation.

**Implementation:**
```typescript
async function replyToModmail(
  conversation: ModMailConversation,
  message: string,
  context: Context
): Promise<void> {
  await conversation.reply({
    body: message,
  });
}
```

**Message Types:**
- Approval confirmation
- Error messages (not author, no R5, etc.)
- Instructions for adding R5

---

### 7008 - Archive Modmail Conversation
**Description:** Archive the modmail after successful approval.

**Implementation:**
```typescript
async function archiveModmail(
  conversation: ModMailConversation,
  context: Context
): Promise<void> {
  await conversation.archive();
}
```

**Note:** Only archive on successful approval, not on errors.

---

### 7009 - Handle Invalid Modmail Requests
**Description:** Respond appropriately to invalid or incomplete requests.

**Error Cases:**
```typescript
async function handleModmailErrors(
  conversation: ModMailConversation,
  error: string,
  context: Context
): Promise<void> {
  const errorMessages = {
    no_post_id: 'Could not find a post ID or link in your message. Please include the full post URL.',
    not_author: 'You must be the post author to request reapproval.',
    not_bot_removal: 'This post was not removed by the bot. Please message the moderators.',
    no_r5_comment: 'Please add a Rule 5 comment (50+ characters) to your post before requesting reapproval.',
    post_not_found: 'Could not find the post. It may have been deleted.',
    already_approved: 'This post is already approved.',
  };

  const message = errorMessages[error] || 'An error occurred processing your request.';

  await replyToModmail(conversation, message, context);
}
```

---

### 7010 - Complete Modmail Processing Flow
**Description:** Main handler for modmail events.

**Implementation:**
```typescript
async function processModmailRequest(
  conversation: ModMailConversation,
  context: Context
): Promise<void> {
  // Extract post ID
  const postId = await getPostIdFromModmail(conversation);
  if (!postId) {
    await handleModmailErrors(conversation, 'no_post_id', context);
    return;
  }

  // Verify author
  if (!await isAuthorOfPost(conversation, postId, context)) {
    await handleModmailErrors(conversation, 'not_author', context);
    return;
  }

  // Verify bot removal
  if (!await wasBotRemoval(postId, context)) {
    await handleModmailErrors(conversation, 'not_bot_removal', context);
    return;
  }

  // Verify R5 comment exists
  if (!await verifyR5BeforeApproval(postId, context)) {
    await handleModmailErrors(conversation, 'no_r5_comment', context);
    return;
  }

  // Approve post
  const approved = await approveViaModmail(postId, conversation, context);

  if (approved) {
    await logModmailApproval(postId, conversation.author?.name || 'unknown', context);
  }
}
```

---

### 7011 - Pre-filled Modmail Template
**Description:** Provide users with easy-to-use modmail template in removal message.

**Template:**
```
https://www.reddit.com/message/compose?to=/r/{{subreddit}}&subject=Rule%205%3A%20Screenshot%20is%20missing%20background%20info&message=Hello%20lovely%20moderators%2C%0A%0AI%20have%20added%20a%20descriptive%20comment%20to%20my%20post%2C%20%5Bhere%5D({{permalink}}).%0AAs%20such%2C%20I%20kindly%20request%20that%20you%20re-approve%20my%20post.%20%0A%0ACordially%2C%0A{{username}}
```

**Decoded Message:**
```
Hello lovely moderators,

I have added a descriptive comment to my post, [here]({{permalink}}).
As such, I kindly request that you re-approve my post.

Cordially,
{{username}}
```

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `modmailkeywords` | string | "r5,rule 5" | Keywords to trigger modmail processing |
| `modmailapprovalreply` | string | (default) | Reply message on approval |
| `requireauthormatch` | boolean | true | Verify modmail sender is post author |

---

## Data Storage

### Redis Keys
- `modmail:processed:{conversationId}` - Prevent duplicate processing (TTL: 7 days)
- `modmail:approved:{postId}` - Track approvals via modmail (TTL: 30 days)

---

## Workflow

1. **Modmail received** with R5-related subject
2. **Extract post ID** from message body
3. **Verify conditions**:
   - Sender is post author
   - Bot removed the post
   - R5 comment exists on post
4. **Approve post**:
   - Reinstate via standard flow
   - Reply to modmail
   - Archive conversation
5. **Notify moderators**

---

## Edge Cases

- **Multiple modmails for same post**: Only process first, mark as handled
- **Post already approved**: Reply with "already approved"
- **User provides wrong post ID**: Verify author match fails, reject
- **R5 comment deleted after modmail**: Detect during verification, reject
- **Post deleted by user**: Can't approve, reply with error

---

## Error Handling

- **Post not found**: Reply with error, don't archive
- **Conversation not found**: Log error, skip
- **Reply fails**: Log error, alert mods via notification
- **Approval fails**: Reply with error, alert mods
- **Redis unavailable**: Allow approval but log warning

---

## Logging & Notifications

Log events:
- `modmail.received.r5` - R5 modmail detected
- `modmail.processed.approved` - Post approved via modmail
- `modmail.processed.rejected` - Request rejected (with reason)
- `modmail.error` - Error processing modmail

Notify moderators:
- Post approved via modmail
- Link to post and modmail conversation
- Author username
- Timestamp
