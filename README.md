# Paradox Plaza Rule 5 Bot

A Reddit moderation bot for enforcing Rule 5 on Paradox Gaming subreddits, built with Devvit.

**Rule 5:** *"Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment."*

---

## What This Bot Does

When users post screenshots without explanations, this bot:

1. ⏱️ **Waits 5 minutes** (grace period)
2. ⚠️ **Posts a warning** if no explanation comment added
3. ⏱️ **Waits 10 more minutes**
4. 🚫 **Removes the post** if still no explanation
5. ✅ **Auto-approves** if user adds explanation at any point
6. 📧 **Handles modmail** for manual reapproval requests

---

## Features

- ✅ **Highly configurable** - Choose which post types require R5
- ✅ **Flexible enforcement** - 11 post type options (images, videos, text, links)
- ✅ **Smart exclusions** - Keywords, flairs, domains, age, upvotes (no regex = safe from ReDoS)
- ✅ **Flair overrides** - Force or skip enforcement based on flair
- ✅ **Keyword filtering** - Enforce on or skip posts with specific text
- ✅ **Automated enforcement** with configurable grace periods
- ✅ **Quality control** - Report short R5 comments to moderators
- ✅ **Whitelist support** for trusted users
- ✅ **Silent approvals** when users comply
- ✅ **Modmail integration** for appeals
- ✅ **Multi-platform notifications** (Slack, Discord)
- ✅ **Customizable templates** for all messages
- ✅ **Per-subreddit configuration** via web UI

---

## For Moderators

### Installation

1. Go to [Reddit Developer Platform](https://developers.reddit.com/)
2. Find "Paradox Plaza Rule 5 Bot" in the app directory
3. Click "Install" on your subreddit
4. Grant moderator permissions (Manage Posts & Comments, Modmail)

### Configuration

Configure settings at:
```
https://developers.reddit.com/r/{your-subreddit}/apps/rule5bot
```

#### What Post Types Should Require R5?

Choose which types of posts require Rule 5 explanations:

**Images & Videos:**
- Image posts (post_hint = 'image')
- Image galleries (Reddit galleries)
- Video posts (Reddit videos, hosted videos)

**Text Posts:**
- Text posts containing image URLs
- Text posts containing video URLs
- Text posts containing specific keywords
- Text posts with any URL

**Link Posts:**
- Links to image hosting sites (imgur, gyazo, etc.)
- Links to video hosting sites (youtube, twitch, etc.)
- Links from specific domains (configurable)
- All link posts

**Default:** Images, galleries, text with images, links to images

#### When Should Bot Skip Enforcement?

**By Keywords:**
- Skip posts containing specific words (e.g., "discussion", "question")
- Enforce on posts with specific words (e.g., "screenshot", "gameplay")

**By User/Post Properties:**
- Whitelisted authors
- Posts older than X hours
- Posts with more than X upvotes
- Text posts starting with or containing keywords
- Links from specific domains

**By Moderation:**
- Posts approved by moderators
- Posts removed by moderators
- Posts with mod comments containing text

**By Flair:**
- Excluded flairs (never require R5, e.g., "art", "comic")
- Enforced flairs (always require R5, overrides post type)

#### R5 Comment Requirements

**Location:**
- Check text post body only
- Check author comments only
- Check both (default)

**Length:**
- Minimum length (default: 50 chars)
- Report if below recommended (default: 75 chars)

**Content:**
- Optional: Require specific keywords (contains one, contains all, starts with, ends with)
- Optional: Block lazy phrases ("look at it", "self-explanatory")

#### Timing

- Grace period before first action (default: 5 min)
- Warning period before removal (default: 10 min)
- Set warning period to 0 for immediate removal

#### Bot Actions

- Remove posts (default) or report to mod queue
- Comment on warnings (recommended)
- Comment on removals (recommended)
- Comment on reinstatements (not recommended, silent better)
- Monitor modmail for appeals
- Auto-reinstate from modmail
- Auto-archive modmail after processing

#### Notifications

**Platforms:**
- Slack webhook
- Discord webhook

**Events:**
- R5 reported (valid but too short)
- R5 invalid
- Warning posted
- Post removed
- Post reinstated
- Bot errors (recommended)

#### Message Templates

Customize all bot messages with variables:
- Warning message
- Removal message
- Report reasons
- Notification messages

**Available Variables:** `{{username}}`, `{{subreddit}}`, `{{permalink}}`, `{{postid}}`, `{{graceminutes}}`, `{{warningminutes}}`

### Usage

The bot runs automatically. No action required from moderators unless:
- A user appeals via modmail → bot auto-approves if R5 comment exists
- Bot encounters errors → check Slack/Discord notifications

---

## For Developers

### Tech Stack

- **Platform:** Reddit Devvit
- **Language:** TypeScript
- **Storage:** Redis (built-in)
- **Testing:** Jest

### Project Structure

```
paradoxplazabot/
├── src/                    # Source code
│   ├── handlers/          # Event handlers (PostSubmit, ModMail)
│   ├── services/          # Business logic (validation, enforcement)
│   ├── storage/           # Redis operations
│   └── utils/             # Helpers (templates, notifications)
├── Docs/                   # Feature documentation
│   ├── 0000-feature-domains.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── 1000-13000-*.md    # Feature domain docs
├── test/                   # Test files
└── devvit.yaml            # Devvit configuration
```

### Quick Start

```bash
# Install Devvit CLI
npm install -g devvit

# Clone repository
git clone https://github.com/your-org/paradoxplazabot.git
cd paradoxplazabot

# Install dependencies
npm install

# Start development
devvit upload --bump-version

# Install on test subreddit
# Go to https://developers.reddit.com/r/your-test-sub/apps
```

### Documentation

- **[Docs/0000-feature-domains.md](./Docs/0000-feature-domains.md)** - Feature overview
- **[Docs/ARCHITECTURE.md](./Docs/ARCHITECTURE.md)** - System architecture
- **[Docs/ROADMAP.md](./Docs/ROADMAP.md)** - Implementation roadmap
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant context

See [Docs/](./Docs/) for detailed feature specifications (118 features across 13 domains).

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- validation.test.ts
```

---

## Supported Subreddits

Currently deployed on:
- r/paradoxplaza
- r/eu4
- r/hoi4
- r/stellaris
- r/victoria2
- r/victoria3
- r/Imperator
- r/EU5

Each subreddit has independent configuration.

---

## How It Works

### Configurable Post Detection

The bot uses a flexible, configurable system to determine which posts require R5:

**1. Choose Post Types to Enforce** (Multi-select)
- Image posts (direct uploads)
- Image galleries
- Video posts
- Text posts with image URLs
- Text posts with video URLs
- Text posts containing keywords
- Text posts with any URL
- Links to images
- Links to videos
- Links from specific domains
- All links

**2. Exclusion Priority System**

The bot applies checks in this order (highest to lowest priority):

1. **Skip Keywords** (highest) - If text contains skip keywords → always skip
2. **Exclusion Rules** - Whitelist, age, upvotes, keywords, domains, mod actions
3. **Flair Rules** - Excluded flairs → skip | Enforced flairs → enforce
4. **Post Type Rules** - Check if post type is in enforcement list

**Example:** Even if images require R5, a post with "Art" flair will be skipped (flair exclusion overrides post type).

### Exclusion Options

**By Keywords:**
- Skip keywords (e.g., "discussion", "question") - highest priority
- Enforcement keywords (e.g., "screenshot", "gameplay")

**By Content:**
- Text posts starting with keywords (e.g., "Discussion:", "Question:")
- Text posts containing keywords (e.g., "discussion", "announcement")
- Links from excluded domains (e.g., wikipedia.org, reddit.com)

**By User/Post:**
- Whitelisted authors (comma-separated usernames)
- Posts older than X hours
- Posts with more than X upvotes (prevents removing viral posts)

**By Moderation:**
- Moderator-approved posts (configurable)
- Moderator-removed posts (avoids interference)
- Posts with mod comments containing keywords (e.g., "approved", "exception")

**By Flair:**
- Excluded flairs (e.g., "art", "comic") - never enforce
- Enforced flairs (e.g., "screenshot", "gameplay") - always enforce, overrides post type

### R5 Comment Validation

**Configurable Requirements:**
- **Location:** Text post body, comment, or both
- **Minimum length:** Default 50 characters (configurable 10-1000)
- **Report threshold:** Default 75 characters (report if between min and threshold)
- **Required keywords:** Optional keyword matching (contains one, contains all, starts with, ends with)
  - Example: Require at least one explanatory word: "what", "why", "how", "because"

**Quality Control:**
- Comments meeting minimum but below recommended → reported to mods
- Optional: Block lazy phrases ("look at it", "self-explanatory")
- Optional: Block pure URLs without explanation

### Enforcement Flow

```
Post Submitted
  ↓
Recently approved? → YES → Skip (24h grace)
  ↓ NO
Contains skip keywords? → YES → Skip
  ↓ NO
Whitelisted user? → YES → Skip
  ↓ NO
Too old / too many upvotes? → YES → Skip
  ↓ NO
Matches exclusion keywords/domain? → YES → Skip
  ↓ NO
Mod approved/removed/commented? → YES → Skip
  ↓ NO
Flair excluded? → YES → Skip
  ↓ NO
Flair enforced? → YES → Enforce
  ↓ NO (null)
Post type enforced? → YES → Enforce
  ↓ NO
Skip (not enforced)

IF ENFORCED:
  ↓
Wait grace period (default: 5 min)
  ↓
Has valid R5? → YES → Done (no action needed)
  ↓ NO
Post warning (if enabled)
  ↓
Wait warning period (default: 10 min)
  ↓
Has valid R5? → YES → Approve, clean up warnings
  ↓ NO
Remove post (or report if configured)
  ↓
Notify mods
```

### Reinstatement

- **Automatic:** Monitoring job (every 1 min) detects R5 comments added after warning
- **Manual:** Users send modmail → bot verifies R5 → auto-approves

---

## Configuration Examples

### Default Configuration (Balanced)
```
Enforce: Images, galleries, text with images, links to images
Skip: Posts with "art" or "comic" flair
Minimum R5: 50 characters
Report if: 50-74 characters (valid but short)
Grace: 5 minutes
Warning: 10 minutes
Action: Remove with comment
Notifications: Removals and errors
```

### Strict Configuration
```
Enforce: Images, galleries, videos, all text with media, all links
Excluded flairs: None (enforce even on art)
Minimum R5: 75 characters
Report if: 75-100 characters
Required text: Must contain "what", "why", or "how"
Grace: 3 minutes
Warning: 7 minutes
Skip upvotes: 0 (enforce on all posts)
Notifications: All events (warnings, removals, reports)
```

### Lenient Configuration
```
Enforce: Images only (not galleries or videos)
Excluded flairs: art, comic, discussion, question, meta
Skip keywords: discussion, question, announcement
Minimum R5: 30 characters
Report threshold: Disabled (no reporting)
Grace: 10 minutes
Warning: 15 minutes
Skip if: >100 upvotes or >12 hours old
Notifications: Errors only
```

### Image-Only Subreddit
```
Enforce: Images, galleries, text with images
Skip: Videos, all text-only, all link posts
Excluded flairs: art, comic
Minimum R5: 50 characters
Location: Comment only (not selftext)
Grace: 5 minutes
Warning: 10 minutes
```

### Keyword-Based Enforcement
```
Enforce: Text containing "screenshot", "gameplay", "battle"
Skip: Text containing "discussion", "question", "help"
Post types: Text posts only (not images/videos)
Minimum R5: 40 characters
Grace: 7 minutes
Warning: 0 (immediate removal after grace)
```

---

## Support

**Issues:** [GitHub Issues](https://github.com/your-org/paradoxplazabot/issues)

**Modmail:** Contact bot operator via your subreddit's modmail

**Documentation:** See [Docs/](./Docs/) directory

---

## Contributing

Contributions welcome! Please:
1. Read [Docs/ROADMAP.md](./Docs/ROADMAP.md) for feature priorities
2. Check existing issues
3. Follow TypeScript + Jest testing conventions
4. Submit PR with tests

---

## License

[Specify license - MIT, GPL, etc.]

---

## Credits

**Original Python Bot:** Based on the original Paradox Plaza Rule 5 bot
**Devvit Port:** [Your name/team]
**Maintained By:** [Maintainer info]
**Contributors:** [Link to contributors]

---

## Changelog

### v1.0.0 (Planned)
- Initial Devvit implementation
- Core enforcement features (detection, warning, removal, reinstatement)
- Settings management
- Modmail integration
- Slack/Discord notifications
- Comprehensive testing

See [Docs/ROADMAP.md](./Docs/ROADMAP.md) for detailed development timeline.
