# Feature Domains for Rule5Bot (Generic Devvit Implementation)

## Overview

This documentation covers the complete feature set for Rule5Bot, a generic Rule 5 enforcement bot built with Reddit's Devvit platform. Originally based on the Paradox Plaza bot (Python/PRAW), Rule5Bot is now a fully configurable, reusable solution for ANY subreddit requiring screenshot explanations.

**Rule 5:** *"Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment."*

---

## Documentation Structure

All features are organized into **13 domains**, each with a unique number prefix (1000-13000). Individual features within each domain are numbered sequentially.

**Example:** Feature 1001 = "Retrieve new queues for all subreddits" (first feature in domain 1000)

---

## Feature Domains

### 1000 - Post Monitoring & Detection
[Read Documentation](./1000-post-monitoring-detection.md)

**Purpose:** Continuously monitor subreddit queues to identify posts requiring Rule 5 enforcement

**Key Features:**
- 1001: Retrieve New Queue for All Subreddits
- 1002: Trigger-Based Post Detection
- 1003: Deduplication System
- 1004: Multi-Subreddit Support
- 1005: Queue Polling Scheduler

---

### 2000 - Post Validation
[Read Documentation](./2000-post-validation.md)

**Purpose:** Determine if a post requires Rule 5 comment

**Key Features:**
- 2001: Image Detection via Post Hint
- 2002: URL Pattern Matching
- 2003: Text Post with Embedded Images
- 2004: Allowed User Check
- 2005: Moderator Approval Check
- 2006: Flair Exclusion Check
- 2007: Already Processed Check
- 2008: Complete Validation Pipeline

---

### 3000 - Comment Validation
[Read Documentation](./3000-comment-validation.md)

**Purpose:** Verify if submitter has added proper Rule 5 explanation

**Key Features:**
- 3001: Fetch Post Comments
- 3002: Find Author Comment
- 3003: Validate Comment Length
- 3004: Report Lazy R5 Comments
- 3005: Check for Valid R5 Comment
- 3006: Detect R5 Comment Added After Warning
- 3007: Handle Comment Timing
- 3008: Ignore Bot Comments

---

### 4000 - Warning System
[Read Documentation](./4000-warning-system.md)

**Purpose:** Alert users to add Rule 5 comment within grace period

**Key Features:**
- 4001: Grace Period Tracking
- 4002: Schedule Warning Check
- 4003: Check if Already Warned
- 4004: Generate Warning Message
- 4005: Post Warning Comment
- 4006: Distinguish Comment as Moderator
- 4007: Track Warning State
- 4008: Prevent Duplicate Warnings

---

### 5000 - Removal System
[Read Documentation](./5000-removal-system.md)

**Purpose:** Remove posts that don't comply after warning period

**Key Features:**
- 5001: Warning Period Tracking
- 5002: Schedule Removal Check
- 5003: Verify Warning Exists Before Removal
- 5004: Generate Removal Message
- 5005: Remove Post from Subreddit
- 5006: Post Removal Comment
- 5007: Distinguish Removal Comment
- 5008: Clean Up Warning Comments
- 5009: Track Removal State
- 5010: Fallback: Report Instead of Remove

---

### 6000 - Reinstatement System
[Read Documentation](./6000-reinstatement-system.md)

**Purpose:** Auto-approve posts when users add R5 comment

**Key Features:**
- 6001: Detect R5 Comment Added
- 6002: Verify R5 Comment Quality
- 6003: Clean Up Bot Comments
- 6004: Approve Post
- 6005: Add to Whitelist
- 6006: Clear Warning State
- 6007: Clear Removal State
- 6008: Complete Reinstatement Flow
- 6009: Silent Approval (No User Notification)
- 6010: Handle Already-Removed Posts
- 6011: Monitoring Frequency
- 6012: Check Comment Timing

---

### 7000 - Modmail Integration
[Read Documentation](./7000-modmail-integration.md)

**Purpose:** Handle manual reapproval requests via modmail

**Key Features:**
- 7001: Monitor Modmail for R5 Subjects
- 7002: Extract Post ID from Modmail Body
- 7003: Verify Author Matches
- 7004: Check If Bot Removed Post
- 7005: Verify R5 Comment Exists
- 7006: Approve Post via Modmail Request
- 7007: Reply to Modmail
- 7008: Archive Modmail Conversation
- 7009: Handle Invalid Modmail Requests
- 7010: Complete Modmail Processing Flow
- 7011: Pre-filled Modmail Template

---

### 8000 - Settings Management
[Read Documentation](./8000-settings-management.md)

**Purpose:** Configurable bot behavior per subreddit or global

**Key Features:**
- 8001: Installation Settings Definition
- 8002: App Settings (Developer-Only)
- 8003: Accessing Settings in Code
- 8004: Settings Validation
- 8005: Settings Caching
- 8006: Template Variable Substitution
- 8007: Settings UI Location
- 8008: Multi-Subreddit Settings
- 8009: Settings Change Detection
- 8010: Default Settings Fallback

**Moderator Configuration URL:**
```
https://developers.reddit.com/r/{subreddit}/apps/{app-name}
```

---

### 9000 - Comment Templates
[Read Documentation](./9000-comment-templates.md)

**Purpose:** Consistent, customizable communication with users

**Key Features:**
- 9001: Warning Message Template
- 9002: Removal Message Template
- 9003: Modmail Approval Response Template
- 9004: Variable Substitution Engine
- 9005: Supported Template Variables
- 9006: Markdown Support
- 9007: Pre-filled Modmail Link Generator
- 9008: Template Preview/Testing
- 9009: Template Validation
- 9010: Multi-Language Support (Future)
- 9011: Template Versioning

---

### 10000 - Notifications & Logging
[Read Documentation](./10000-notifications-logging.md)

**Purpose:** Monitor bot activity and report actions/errors

**Key Features:**
- 10001: Slack Integration
- 10002: Discord Integration
- 10003: Rich Notification Formatting
- 10004: Notification Events
- 10005: Devvit Native Logging
- 10006: Structured Logging Format
- 10007: Event Types Taxonomy
- 10008: Notification Aggregation
- 10009: Error Tracking
- 10010: Notification Rate Limiting
- 10011: Notification Preferences

---

### 11000 - Persistent Storage
[Read Documentation](./11000-persistent-storage.md)

**Purpose:** Track state and configuration across bot runs

**Key Features:**
- 11001: Redis Key Design
- 11002: Post State Tracking
- 11003: Whitelist Management
- 11004: Warning State Storage
- 11005: Removal State Storage
- 11006: TTL (Time-To-Live) Management
- 11007: Bulk Operations
- 11008: Analytics Storage
- 11009: Data Migration
- 11010: Backup and Recovery
- 11011: Memory Management

---

### 12000 - Authentication & Authorization
[Read Documentation](./12000-authentication-authorization.md)

**Purpose:** Secure bot operations and permissions

**Key Features:**
- 12001: Reddit OAuth Authentication
- 12002: Moderator Permission Verification
- 12003: Permission Checks Before Actions
- 12004: App Installation Authorization
- 12005: Rate Limiting Compliance
- 12006: Webhook Authentication (Slack/Discord)
- 12007: Action Authorization Matrix
- 12008: Bot Account Management
- 12009: Security Best Practices
- 12010: Error Handling for Auth Failures
- 12011: Audit Logging

---

### 13000 - Testing
[Read Documentation](./13000-testing.md)

**Purpose:** Ensure reliability and correctness

**Key Features:**
- 13001: Unit Testing Strategy
- 13002: Integration Testing
- 13003: Mock Data Generation
- 13004: Image Detection Test Cases
- 13005: Comment Validation Test Cases
- 13006: Timing and Grace Period Tests
- 13007: Modmail Parsing Tests
- 13008: Template Substitution Tests
- 13009: Error Handling Tests
- 13010: Performance Testing
- 13011: End-to-End Testing
- 13012: Test Environment Setup

---

## Implementation Summary

### Technology Stack
- **Platform:** Reddit Devvit
- **Language:** TypeScript
- **Storage:** Redis (built-in)
- **Triggers:** PostSubmit, ModMail
- **Scheduler:** Devvit Scheduler API
- **Notifications:** Slack/Discord webhooks

### Architecture
- Event-driven architecture using Devvit triggers
- Scheduled jobs for grace period checks
- Redis for persistent state tracking
- Per-subreddit settings via Devvit's settings UI
- Multi-platform notifications (Slack, Discord, Devvit logs)

### Key Design Decisions
1. **Single App, Multiple Installations:** Each subreddit installs the app independently with their own settings
2. **Trigger-First Approach:** Use PostSubmit triggers instead of polling where possible
3. **Redis for Everything:** All state stored in Redis with appropriate TTLs
4. **Silent Approvals:** Don't spam users when they comply
5. **Graceful Degradation:** Fall back to reporting if notifications unavailable

---

## Implementation Notes for Devvit

**Key Considerations:**
- Devvit's scheduler/trigger system vs. continuous polling
- Redis for persistent storage (built-in to Devvit)
- Devvit's modmail API capabilities
- Form builder for configuration UI
- App settings for timing/thresholds
- Multi-subreddit installation handling
- Rate limiting and API quotas

---

## Quick Start

### For Developers
1. Review feature domains (this document)
2. Check [Architecture](./ARCHITECTURE.md) for system design
3. Review [Roadmap](./ROADMAP.md) for implementation plan
4. Set up Devvit development environment
5. Implement features in order of dependencies
6. Write tests for each feature (see [13000-testing.md](./13000-testing.md))
7. Deploy to test subreddit

### For Moderators
1. Install app on subreddit (requires moderator permissions)
2. Configure settings at `https://developers.reddit.com/r/{subreddit}/apps/rule5bot`
3. Set grace period, warning period, and message templates
4. Configure Slack/Discord webhooks (optional)
5. Add allowlisted users and excluded flairs
6. Monitor bot activity via notifications

---

## Documentation Index

- **[0000-feature-domains.md](./0000-feature-domains.md)** - This file, domain overview
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flows
- **[ROADMAP.md](./ROADMAP.md)** - Implementation roadmap with MoSCoW priorities
- **[SECURITY-FIX.md](./SECURITY-FIX.md)** - ⚠️ **CRITICAL:** Security fixes for approval system
- **[1000-post-monitoring-detection.md](./1000-post-monitoring-detection.md)** - Post detection features
- **[2000-post-validation.md](./2000-post-validation.md)** - Post validation features
- **[3000-comment-validation.md](./3000-comment-validation.md)** - Comment validation features
- **[4000-warning-system.md](./4000-warning-system.md)** - Warning system features
- **[5000-removal-system.md](./5000-removal-system.md)** - Removal system features
- **[6000-reinstatement-system.md](./6000-reinstatement-system.md)** - Reinstatement features
- **[7000-modmail-integration.md](./7000-modmail-integration.md)** - Modmail features
- **[8000-settings-management.md](./8000-settings-management.md)** - Settings features
- **[9000-comment-templates.md](./9000-comment-templates.md)** - Template features
- **[10000-notifications-logging.md](./10000-notifications-logging.md)** - Notification features
- **[11000-persistent-storage.md](./11000-persistent-storage.md)** - Storage features
- **[12000-authentication-authorization.md](./12000-authentication-authorization.md)** - Auth features
- **[13000-testing.md](./13000-testing.md)** - Testing features

---

## Total Feature Count

**142 Features** across 13 domains:
- Must Have (MVP): 73 features
- Should Have: 45 features
- Could Have: 23 features
- Won't Have (Future): 1 feature

**Breakdown by domain:**
- 1000: 5 features
- 2000: 14 features (expanded)
- 3000: 12 features (expanded)
- 4000: 8 features
- 5000: 10 features
- 6000: 12 features
- 7000: 11 features
- 8000: 14 features (expanded)
- 9000: 11 features
- 10000: 11 features
- 11000: 11 features
- 12000: 11 features
- 13000: 12 features
