# Rule5Bot

A Reddit moderation bot for enforcing Rule 5 (screenshot explanations), built on Devvit.

Originally developed for Paradox grand strategy gaming communities, now a generic solution for any subreddit that needs users to explain their screenshots.

## What's Rule 5?

Most gaming and visual content subreddits have some version of this rule:

> **Rule 5:** Explain what you want people to look at when you post a screenshot.

Without context, a screenshot of a game or complex image can be confusing. Rule 5 ensures posters explain what's happening so everyone can understand and participate in the discussion.

## How it works

1. User posts a screenshot
2. Bot waits 5 minutes (grace period)
3. No explanation comment? Bot posts a warning
4. Bot waits another 10 minutes
5. Still no explanation? Post gets removed
6. User adds explanation anytime? Post gets auto-approved

The bot only touches its own removals - it won't interfere with human moderator decisions.

## Features

**Flexible enforcement:**
- Choose which post types need R5 (images, videos, text posts with media, links)
- Exclude by keywords, flairs, domains, post age, or upvotes
- Enforce based on keywords or flairs

**Quality control:**
- Configurable minimum comment length
- Optional keyword requirements
- Report short-but-valid comments to mods

**Moderation-friendly:**
- Respects moderator actions
- Auto-handles modmail appeals
- Slack/Discord notifications
- Fully customizable message templates

**Per-subreddit configuration:**
- Every setting through Devvit's web UI
- No code changes needed
- Each subreddit configures independently

## Installation

For moderators:

1. Visit [developers.reddit.com](https://developers.reddit.com/)
2. Find "Rule5Bot" in the app directory
3. Install on your subreddit
4. Grant mod permissions (Manage Posts, Modmail)
5. Configure at `developers.reddit.com/r/yoursubreddit/apps/rule5bot`

## Configuration

The bot is highly configurable. Key settings:

**Post types to enforce:**
- Images, galleries, videos
- Text posts with image/video URLs
- Links to media hosting sites
- All of the above or just specific types

**Exclusions:**
- Allowed users
- Specific keywords ("discussion", "question")
- Flairs ("art", "comic")
- Old posts or viral posts (upvote threshold)
- Moderator-approved posts

**R5 requirements:**
- Minimum length (default: 50 chars)
- Where to check (selftext, comment, or both)
- Optional keyword requirements

**Timing:**
- Grace period before warning (default: 5 min)
- Warning period before removal (default: 10 min)

**Actions:**
- Remove posts or just report them
- Enable/disable warning comments
- Auto-reinstate from modmail

See the [configuration guide](./Docs/features/8000-settings-management.md) for full details.

## Example configurations

**Strict (competitive gaming):**
```
Enforce: Images, videos, text with media, all links
Min length: 75 chars
Grace: 3 min, Warning: 7 min
Skip: Nothing (enforce everything)
```

**Balanced (default):**
```
Enforce: Images, galleries, text with images
Min length: 50 chars
Grace: 5 min, Warning: 10 min
Skip: "art" and "comic" flairs
```

**Lenient (casual community):**
```
Enforce: Images only
Min length: 30 chars
Grace: 10 min, Warning: 15 min
Skip: >100 upvotes, >12h old, discussion/question posts
```

## Development

Built with:
- Reddit Devvit
- TypeScript
- Jest for testing
- Redis for storage

```bash
# Setup
npm install -g devvit
git clone https://github.com/Zwemvest/rule5bot.git
cd rule5bot
npm install

# Development
devvit upload --bump-version

# Testing
npm test
```

See [Docs/](./Docs/) for architecture details and the complete feature list (142 features across 13 domains).

## Contributing

Contributions welcome! Check [ROADMAP.md](./Docs/ROADMAP.md) for priorities. Make sure to include tests with your PRs.

## License

MIT License - free to use, modify, and distribute. See [LICENSE.md](./Docs/LICENSE.md) for details.

## Credits

**Original concept:** Paradox Plaza Rule 5 bot (Python/PRAW)

**Devvit version:** /u/Zwemvest

Built with help from Claude (Anthropic) - turns out AI is pretty good at writing Reddit bots, who knew?

See [CONTRIBUTORS.md](./Docs/CONTRIBUTORS.md) for everyone who helped.
