# 9000 - Comment Templates

## Overview
Consistent, customizable user-facing messages with variable substitution and markdown support.

---

## Features

### 9001 - Warning Message Template
**Description:** Template for the warning comment posted after grace period.

**Default Template:**
```markdown
Hi /u/{{username}},

You have not yet added a rule #5 comment to your post:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

Since a rule #5 comment is mandatory, your post will be removed if you do not add this comment. You have a 10 minute grace period.

You do not need to reply, modmail, or report if you've added a rule #5 comment; this comment will be deleted automatically.
```

**Configuration:**
- Setting: `warningtemplate` (paragraph)
- Variables: `{{username}}`, `{{subreddit}}`, `{{permalink}}`, `{{postid}}`

---

### 9002 - Removal Message Template
**Description:** Template for the removal comment posted when post is removed.

**Default Template:**
```markdown
Hi /u/{{username}},

Your submission has been removed from /r/{{subreddit}} for breaking rule #5:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

If this was the only rule broken, we will reapprove your submission if you add background info.

Please [contact us through modmail](https://www.reddit.com/message/compose?to=/r/{{subreddit}}&subject=Rule%205%3A%20Screenshot%20is%20missing%20background%20info&message=Hello%20lovely%20moderators%2C%0A%0AI%20have%20added%20a%20descriptive%20comment%20to%20my%20post%2C%20%5Bhere%5D({{permalink}}).%0AAs%20such%2C%20I%20kindly%20request%20that%20you%20re-approve%20my%20post.%20%0A%0ACordially%2C%0A{{username}}) to get it reapproved.

Replying to this comment or sending a private message to this bot will not get your post reinstated; we only respond to the modmail.
```

**Configuration:**
- Setting: `removaltemplate` (paragraph)
- Variables: `{{username}}`, `{{subreddit}}`, `{{permalink}}`, `{{postid}}`

---

### 9003 - Modmail Approval Response Template
**Description:** Template for replying to modmail reapproval requests.

**Default Messages:**
```typescript
const modmailResponses = {
  approved: 'Post approved. Thank you for your patience.',

  no_post_id: 'Could not find a post ID or link in your message. Please include the full post URL.',

  not_author: 'You must be the post author to request reapproval.',

  not_bot_removal: 'This post was not removed by the bot. Please message the moderators.',

  no_r5_comment: 'Please add a Rule 5 comment (minimum {{minlength}} characters) to your post before requesting reapproval.',

  post_not_found: 'Could not find the post. It may have been deleted.',

  already_approved: 'This post is already approved.',
};
```

**Configuration:**
- Setting: `modmailapprovalreply` (string, default: "Post approved. Thank you for your patience.")
- Setting: `modmailerrorprefix` (string, default: "")

---

### 9004 - Variable Substitution Engine
**Description:** Replace template variables with actual values.

**Implementation:**
```typescript
interface TemplateVariables {
  username: string;
  subreddit: string;
  permalink: string;
  postid: string;
  minlength?: number;
  graceperiod?: number;
  warningperiod?: number;
}

function substituteVariables(
  template: string,
  variables: TemplateVariables
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
  }

  return result;
}
```

---

### 9005 - Supported Template Variables
**Description:** All available variables for template substitution.

**Variables:**

| Variable | Description | Example | Available In |
|----------|-------------|---------|--------------|
| `{{username}}` | Post author username | `johndoe` | All templates |
| `{{subreddit}}` | Subreddit name | `paradoxplaza` | All templates |
| `{{permalink}}` | Full post URL | `https://reddit.com/r/paradoxplaza/comments/abc123/title` | All templates |
| `{{postid}}` | Short post ID | `abc123` | All templates |
| `{{minlength}}` | Min comment length setting | `50` | Modmail templates |
| `{{graceperiod}}` | Grace period in minutes | `5` | Warning template |
| `{{warningperiod}}` | Warning period in minutes | `10` | Warning template |

---

### 9006 - Markdown Support
**Description:** Templates support full Reddit Markdown formatting.

**Supported Features:**
- **Bold**: `**text**`
- *Italic*: `*text*`
- Links: `[text](url)`
- Quotes: `> text`
- Lists: `- item` or `1. item`
- Code: `` `code` ``
- Headers: `# Header`
- Horizontal rules: `---`

**Example:**
```markdown
Hi /u/{{username}},

Your submission has been **removed** for breaking *rule #5*.

> Explain what you want people to look at when you post a screenshot.

Please [contact us](https://reddit.com/message/compose?to=/r/{{subreddit}}) to appeal.

---

*I am a bot, and this action was performed automatically.*
```

---

### 9007 - Pre-filled Modmail Link Generator
**Description:** Generate pre-filled modmail links for users.

**Implementation:**
```typescript
function generateModmailLink(
  subreddit: string,
  username: string,
  permalink: string
): string {
  const subject = 'Rule 5: Screenshot is missing background info';

  const body = `Hello lovely moderators,

I have added a descriptive comment to my post, [here](${permalink}).
As such, I kindly request that you re-approve my post.

Cordially,
${username}`;

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  return `https://www.reddit.com/message/compose?to=/r/${subreddit}&subject=${encodedSubject}&message=${encodedBody}`;
}
```

**Usage in Template:**
```markdown
Please [contact us through modmail]({{modmaillink}}) to get it reapproved.
```

**Example Output:**
```
Template:
https://www.reddit.com/message/compose?to=/r/{{subreddit}}&subject=Rule%205...

After Substitution:
https://www.reddit.com/message/compose?to=/r/eu4&subject=Rule%205...
```

---

### 9008 - Template Preview/Testing
**Description:** Allow moderators to preview templates with sample data.

**Future Enhancement:**
```typescript
function previewTemplate(
  template: string,
  context: Context
): string {
  const sampleVariables: TemplateVariables = {
    username: 'SampleUser',
    subreddit: 'paradoxplaza',
    permalink: 'https://reddit.com/r/paradoxplaza/comments/abc123/sample_post',
    postid: 'abc123',
    minlength: 50,
    graceperiod: 5,
    warningperiod: 10,
  };

  return substituteVariables(template, sampleVariables);
}
```

**Could be exposed via:**
- Custom post with preview UI
- Menu action "Preview Templates"
- Settings page preview button

---

### 9009 - Template Validation
**Description:** Validate templates before saving.

**Validation Rules:**
```typescript
function validateTemplate(template: string): string[] {
  const errors: string[] = [];

  // Check for balanced brackets
  const openBrackets = (template.match(/\{\{/g) || []).length;
  const closeBrackets = (template.match(/\}\}/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push('Unbalanced variable brackets {{}}');
  }

  // Check for unknown variables
  const validVars = ['username', 'subreddit', 'permalink', 'postid', 'minlength', 'graceperiod', 'warningperiod'];
  const varPattern = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = varPattern.exec(template)) !== null) {
    if (!validVars.includes(match[1])) {
      errors.push(`Unknown variable: {{${match[1]}}}`);
    }
  }

  // Check minimum length
  if (template.trim().length < 20) {
    errors.push('Template must be at least 20 characters');
  }

  // Check for required elements (optional)
  if (!template.includes('{{username}}')) {
    errors.push('Warning: Template should include {{username}}');
  }

  return errors;
}
```

---

### 9010 - Multi-Language Support (Future)
**Description:** Support for multiple language templates.

**Potential Structure:**
```typescript
interface LocalizedTemplates {
  en: {
    warning: string;
    removal: string;
  };
  de: {
    warning: string;
    removal: string;
  };
  // etc.
}

async function getTemplateForLanguage(
  templateType: 'warning' | 'removal',
  context: Context
): Promise<string> {
  const settings = await context.settings.getAll();
  const language = settings.language as string || 'en';

  // Load localized template
  // ...
}
```

---

### 9011 - Template Versioning
**Description:** Track template changes for audit purposes.

**Implementation:**
```typescript
interface TemplateVersion {
  template: string;
  version: number;
  updatedAt: number;
  updatedBy: string;
}

async function saveTemplateVersion(
  templateName: string,
  template: string,
  context: Context
): Promise<void> {
  const versions = await getTemplateVersions(templateName, context);
  const newVersion: TemplateVersion = {
    template,
    version: versions.length + 1,
    updatedAt: Date.now(),
    updatedBy: 'moderator', // Get from context
  };

  versions.push(newVersion);

  // Store in Redis
  await context.redis.set(
    `template:versions:${templateName}`,
    JSON.stringify(versions)
  );
}
```

---

## Template Examples

### Example 1: Minimal Warning
```markdown
Hi /u/{{username}}, please add a Rule 5 comment explaining your screenshot within 10 minutes or your post will be removed.
```

### Example 2: Friendly Warning
```markdown
Hey there, /u/{{username}}! 👋

We noticed your post doesn't have a Rule 5 comment yet. Could you add a comment explaining what we're looking at in your screenshot?

You have **10 minutes** before we have to remove it. No worries though - just add the comment and you're good to go!

Check out our [full rules](https://reddit.com/r/{{subreddit}}/wiki/rules) if you need more info.
```

### Example 3: Strict Removal
```markdown
**REMOVED: Rule 5 Violation**

/u/{{username}}, your submission has been removed from /r/{{subreddit}}.

**Reason:** No Rule 5 comment was provided within the grace period.

**To appeal:** Add a descriptive comment to your post and [message the moderators]({{modmaillink}}).

**Questions?** See our [wiki](https://reddit.com/r/{{subreddit}}/wiki/rules).
```

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `warningtemplate` | paragraph | (default text) | Warning comment template |
| `removaltemplate` | paragraph | (default text) | Removal comment template |
| `modmailapprovalreply` | string | "Post approved..." | Modmail approval response |

---

## Best Practices

✅ **Be clear and concise** - Users should immediately understand what they need to do
✅ **Include links** - Link to rules wiki and modmail
✅ **Use friendly tone** - Enforcement doesn't have to be harsh
✅ **Provide timeframes** - Tell users how long they have
✅ **Offer help** - Direct users to resources or modmail
✅ **Use formatting** - Bold/italic for emphasis
✅ **Test templates** - Preview with sample data before deploying

❌ **Don't be too verbose** - Keep it scannable
❌ **Don't use jargon** - "R5" might confuse new users
❌ **Don't forget variables** - Always include {{username}} at minimum
❌ **Don't use emojis excessively** - One or two is okay, more looks unprofessional
