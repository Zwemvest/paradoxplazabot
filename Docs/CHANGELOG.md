# Changelog

All notable changes to Rule5Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-01-17

### Changed
- **Inclusive terminology:** Renamed all "whitelist" references to "allowlist" throughout codebase
  - Setting: `whitelistedusers` → `allowlistedusers`
  - 133 occurrences updated across TypeScript and Markdown files
- **Documentation overhaul:**
  - Rewrote README to be more concise and human-friendly (485 → 159 lines)
  - Removed AI-obvious language and corporate speak
  - Updated all references from "ParadoxPlazaBot" to generic "Rule5Bot"
  - Added practical configuration examples
- **Branding updates:**
  - Updated author to /u/Zwemvest
  - Fixed GitHub repository URLs to `Zwemvest/rule5bot`
  - Updated package.json metadata

### Added
- **Configurable modmail messages:** 9 new template settings for all modmail responses
  - No Post ID, Post Not Found, Not Author, Not Bot Removal
  - Already Approved, No Valid R5, Success, Error
  - Reinstatement comment template
- Comprehensive changelog (this file!)
- CONTRIBUTORS.md file

### Security
- **Critical fix:** Bot now explicitly checks if it removed a post before auto-approving
  - Prevents interference with human moderator decisions
  - Only reinstates posts the bot removed itself
  - Full test coverage for security scenarios

### Documentation
- Added CHANGELOG-CONFIGURABLE-MESSAGES.md with detailed implementation notes
- Updated CLAUDE.md with correct GitHub links and terminology
- All 142 features documented across 13 domain documents

## [1.0.0] - 2025-01-04

### Added
- Initial Devvit implementation of Rule5Bot
- Core features:
  - Post detection (11 configurable post types)
  - Grace period and warning system
  - Automated removal with configurable timing
  - Auto-reinstatement when R5 added
  - Modmail integration for manual appeals
  - Slack/Discord notifications
  - Fully customizable message templates
- Comprehensive exclusion system:
  - Keyword-based (enforcement and skip keywords)
  - Flair-based (enforced and excluded)
  - User allowlist
  - Post age and upvote thresholds
  - Domain exclusions
  - Moderator action respect
- Quality control:
  - Configurable R5 length requirements
  - Keyword matching (contains, starts with, ends with)
  - Report short-but-valid comments
- Storage:
  - Redis-based state management
  - TTL-based cleanup (no manual maintenance)
  - Per-subreddit isolation
- Testing:
  - Jest test suite
  - Security-focused test coverage
  - Integration tests for critical paths
- Documentation:
  - 142 features across 13 domains
  - Architecture documentation
  - Migration guide from Python/PRAW version
  - Comprehensive settings documentation

### Changed
- Ported from Python/PRAW to TypeScript/Devvit
- Migrated from file-based to Redis storage
- Changed from single-instance multi-subreddit to per-subreddit installations

### Removed
- Permanent whitelist feature (security vulnerability in original)
  - Replaced with temporary approval tracking (24h grace, 7d TTL)
  - See SECURITY-FIX.md for details

---

## Version History

- **1.0.1** (2025-01-17) - Documentation & terminology updates, configurable messages
- **1.0.0** (2025-01-04) - Initial Devvit release

[1.0.1]: https://github.com/Zwemvest/rule5bot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Zwemvest/rule5bot/releases/tag/v1.0.0
