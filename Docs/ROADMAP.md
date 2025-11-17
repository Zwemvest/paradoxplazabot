# Implementation Roadmap

## Overview
This roadmap tracks the implementation status of all features using MoSCoW prioritization (Must have, Should have, Could have, Won't have).

**Status Legend:**
- 🔴 Not Started
- 🟡 In Progress
- 🔵 Blocked
- 🟢 Completed

**Latest Update:** Comprehensive configuration system designed. Features 2000, 3000, and 8000 have been expanded to support highly flexible, per-subreddit configuration of enforcement rules, exclusions, and R5 requirements.

**Key Enhancements:**
- **Configurable post types** - 11 different post type options for enforcement
- **Priority-based exclusions** - Keywords > Exclusions > Flairs > Post Types
- **Flexible R5 validation** - Location, length, report threshold, required text patterns
- **45+ configuration settings** - Comprehensive per-subreddit customization

---

## Phase 1: Core Enforcement (Must Have)

### 1000 - Post Monitoring & Detection
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 1001 | Retrieve New Queue for All Subreddits | Must | 🟢 Completed | Queue polling implemented |
| 1002 | Trigger-Based Post Detection | Must | 🟢 Completed | PostSubmit handler ready |
| 1003 | Deduplication System | Must | 🟢 Completed | Redis state tracking ready |
| 1004 | Multi-Subreddit Support | Should | 🟢 Completed | Per-subreddit installations (Devvit model) |
| 1005 | Queue Polling Scheduler | Could | 🟢 Completed | Configurable backup polling |

### 2000 - Post Validation
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 2001 | Configurable Post Type Enforcement | Must | 🟢 Completed | 11 post types implemented |
| 2002 | Domain Pattern Matching | Must | 🟢 Completed | Image/video/link domains working |
| 2003 | Keyword-Based Enforcement | Should | 🟢 Completed | Enforcement/skip keywords |
| 2004 | Flair-Based Enforcement Rules | Must | 🟢 Completed | Enforce/exclude by flair |
| 2005 | Allowed User Check | Must | 🟢 Completed | Whitelist validation |
| 2006 | Post Age Limit Check | Should | 🟢 Completed | Configurable age threshold |
| 2007 | Upvote Threshold Check | Should | 🟢 Completed | Skip viral posts |
| 2008 | Text Post Keyword Exclusion | Should | 🟢 Completed | StartsWith/ContainsOne keywords |
| 2009 | Link Domain Exclusion | Should | 🟢 Completed | Domain exclusion list |
| 2010 | Moderator Approval Check | Must | 🟢 Completed | Respects mod approvals |
| 2011 | Moderator Removal Check | Must | 🟢 Completed | Avoids mod-removed posts |
| 2012 | Moderator Comment Skip Check | Should | 🔴 Not Started | TODO: Fetch/check mod comments |
| 2013 | Recently Approved Check | Must | 🟢 Completed | 24h grace period |
| 2014 | Complete Validation Pipeline | Must | 🟢 Completed | Priority pipeline implemented |

### 3000 - Comment Validation
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 3001 | Configurable R5 Location Check | Must | 🟢 Completed | Implemented with keyword matching |
| 3002 | Minimum Length Validation | Must | 🟢 Completed | Uses mincommentlength setting |
| 3003 | Report Length Threshold | Should | 🔴 Not Started | Report if too short |
| 3004 | Required Text Pattern Check | Should | 🔴 Not Started | Regex requirements |
| 3005 | Complete R5 Validation | Must | 🟢 Completed | Keyword-based validation |
| 3006 | Report R5 to Moderators | Should | 🔴 Not Started | Short R5 reports |
| 3007 | Fetch Post Comments | Must | 🟢 Completed | Respects r5commentlocation |
| 3008 | Find Author Comments | Must | 🟢 Completed | Filters by author, top-level |
| 3009 | Ignore Bot Comments | Must | 🟢 Completed | Excludes bot's own comments |
| 3010 | Handle Comment Timing | Should | 🔴 Not Started | Track when added |
| 3011 | Check R5 Added After Warning | Must | 🟢 Completed | Timestamp-based validation |
| 3012 | Validate Comment Quality | Could | 🔴 Not Started | Lazy phrase detection |

### 4000 - Warning System
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 4001 | Grace Period Tracking | Must | 🟢 Completed | Scheduled jobs |
| 4002 | Schedule Warning Check | Must | 🟢 Completed | Registered in main.ts |
| 4003 | Check if Already Warned | Must | 🟢 Completed | Redis state check |
| 4004 | Generate Warning Message | Must | 🟢 Completed | Template substitution |
| 4005 | Post Warning Comment | Must | 🟢 Completed | Posted and distinguished |
| 4006 | Distinguish Comment as Moderator | Must | 🟢 Completed | Green [M] badge |
| 4007 | Track Warning State | Must | 🟢 Completed | Redis with comment ID |
| 4008 | Prevent Duplicate Warnings | Must | 🟢 Completed | Idempotent checks |

### 5000 - Removal System
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 5001 | Warning Period Tracking | Must | 🟢 Completed | Scheduled in warning system |
| 5002 | Schedule Removal Check | Must | 🟢 Completed | Registered in main.ts |
| 5003 | Verify Warning Exists Before Removal | Must | 🟢 Completed | Safety check prevents errors |
| 5004 | Generate Removal Message | Must | 🟢 Completed | Template substitution |
| 5005 | Remove Post from Subreddit | Must | 🟢 Completed | post.remove() API |
| 5006 | Post Removal Comment | Must | 🟢 Completed | Configurable via settings |
| 5007 | Distinguish Removal Comment | Must | 🟢 Completed | Green [M] badge |
| 5008 | Clean Up Warning Comments | Should | 🟢 Completed | Deletes warning on removal |
| 5009 | Track Removal State | Must | 🟢 Completed | Redis with comment ID |
| 5010 | Fallback: Report Instead of Remove | Should | 🔴 Not Started | Graceful degradation |

### 6000 - Reinstatement System
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 6001 | Detect R5 Comment Added | Must | 🟢 Completed | Monitoring job + periodic sweep |
| 6002 | Verify R5 Comment Quality | Must | 🟢 Completed | Uses hasR5AddedAfterWarning |
| 6003 | Clean Up Bot Comments | Must | 🟢 Completed | Deletes warning & removal |
| 6004 | Approve Post | Must | 🟢 Completed | post.approve() |
| 6005 | Add to Whitelist | Must | 🟢 Completed | 24h approval grace period |
| 6006 | Clear Warning State | Must | 🟢 Completed | clearPostState() |
| 6007 | Clear Removal State | Must | 🟢 Completed | clearPostState() |
| 6008 | Complete Reinstatement Flow | Must | 🟢 Completed | Full integration |
| 6009 | Silent Approval | Should | 🟢 Completed | Optional reinstate comment |
| 6010 | Handle Already-Removed Posts | Must | 🟢 Completed | Un-removes if needed |
| 6011 | Monitoring Frequency | Should | 🔴 Not Started | Default 1 min |
| 6012 | Check Comment Timing | Could | 🔴 Not Started | Analytics |

---

## Phase 2: Modmail & Settings (Must Have)

### 7000 - Modmail Integration
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 7001 | Monitor Modmail for R5 Subjects | Must | 🟢 Completed | Trigger-based |
| 7002 | Extract Post ID from Modmail Body | Must | 🟢 Completed | Regex parsing |
| 7003 | Verify Author Matches | Must | 🟢 Completed | Security check |
| 7004 | Check If Bot Removed Post | Must | 🟢 Completed | Redis check |
| 7005 | Verify R5 Comment Exists | Must | 🟢 Completed | Before approval |
| 7006 | Approve Post via Modmail Request | Must | 🟢 Completed | Main flow |
| 7007 | Reply to Modmail | Must | 🟢 Completed | |
| 7008 | Archive Modmail Conversation | Should | 🟢 Completed | Cleanup |
| 7009 | Handle Invalid Modmail Requests | Must | 🟢 Completed | Error messages |
| 7010 | Complete Modmail Processing Flow | Must | 🟢 Completed | Integrate all |
| 7011 | Pre-filled Modmail Template | Should | 🔴 Not Started | User convenience |

### 8000 - Settings Management
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 8001 | Post Type Enforcement Rules | Must | 🔴 Not Started | Multi-select, 11 options |
| 8002 | Post Type Exclusion Rules | Must | 🔴 Not Started | 9 exclusion methods |
| 8003 | Known Domain Configuration | Must | 🔴 Not Started | Image/video/link domains |
| 8004 | Keyword Filtering | Should | 🔴 Not Started | Enforcement/skip keywords |
| 8005 | Flair-Based Rules | Must | 🔴 Not Started | Enforce/exclude flairs |
| 8006 | R5 Comment Validation Requirements | Must | 🔴 Not Started | Location/length/pattern |
| 8007 | Enforcement Timing Configuration | Must | 🔴 Not Started | Grace/warning/removal |
| 8008 | Bot Behavior Configuration | Must | 🔴 Not Started | Remove/report/comment |
| 8009 | Notification Configuration | Should | 🔴 Not Started | Slack/Discord events |
| 8010 | Message Templates | Must | 🔴 Not Started | Variables/customization |
| 8011 | Accessing Settings in Code | Must | 🔴 Not Started | context.settings |
| 8012 | Settings Validation | Should | 🔴 Not Started | onValidate hooks |
| 8013 | Settings UI Location | Must | 🔴 Not Started | Auto by Devvit |
| 8014 | Multi-Subreddit Settings | Must | 🔴 Not Started | Per-installation |

---

## Phase 3: Templates & Notifications (Should Have)

### 9000 - Comment Templates
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 9001 | Warning Message Template | Must | 🔴 Not Started | |
| 9002 | Removal Message Template | Must | 🔴 Not Started | |
| 9003 | Modmail Approval Response Template | Must | 🔴 Not Started | |
| 9004 | Variable Substitution Engine | Must | 🔴 Not Started | Core functionality |
| 9005 | Supported Template Variables | Must | 🔴 Not Started | Documentation |
| 9006 | Markdown Support | Must | 🔴 Not Started | Reddit formatting |
| 9007 | Pre-filled Modmail Link Generator | Should | 🔴 Not Started | User convenience |
| 9008 | Template Preview/Testing | Could | 🔴 Not Started | Dev/mod tool |
| 9009 | Template Validation | Should | 🔴 Not Started | Prevent errors |
| 9010 | Multi-Language Support | Won't | 🔴 Not Started | Future enhancement |
| 9011 | Template Versioning | Could | 🔴 Not Started | Audit trail |

### 10000 - Notifications & Logging
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 10001 | Slack Integration | Should | 🔴 Not Started | Webhook-based |
| 10002 | Discord Integration | Should | 🔴 Not Started | Webhook-based |
| 10003 | Rich Notification Formatting | Should | 🔴 Not Started | Embeds/blocks |
| 10004 | Notification Events | Should | 🔴 Not Started | Warning/removal/approval |
| 10005 | Devvit Native Logging | Must | 🔴 Not Started | console.log |
| 10006 | Structured Logging Format | Should | 🔴 Not Started | JSON logs |
| 10007 | Event Types Taxonomy | Should | 🔴 Not Started | Naming convention |
| 10008 | Notification Aggregation | Could | 🔴 Not Started | Reduce spam |
| 10009 | Error Tracking | Must | 🔴 Not Started | Log failures |
| 10010 | Notification Rate Limiting | Should | 🔴 Not Started | Prevent spam |
| 10011 | Notification Preferences | Should | 🔴 Not Started | Per-event toggles |

---

## Phase 4: Storage & Auth (Must Have)

### 11000 - Persistent Storage
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 11001 | Redis Key Design | Must | 🔴 Not Started | Namespacing |
| 11002 | Post State Tracking | Must | 🔴 Not Started | Lifecycle |
| 11003 | Approval Tracking (not allowlist) | Must | 🔴 Not Started | 7d TTL, 24h grace |
| 11004 | Warning State Storage | Must | 🔴 Not Started | |
| 11005 | Removal State Storage | Must | 🔴 Not Started | |
| 11006 | TTL Management | Must | 🔴 Not Started | Auto-expiration |
| 11007 | Bulk Operations | Should | 🔴 Not Started | scan operations |
| 11008 | Analytics Storage | Could | 🔴 Not Started | Stats tracking |
| 11009 | Data Migration | Could | 🔴 Not Started | Schema changes |
| 11010 | Backup and Recovery | Could | 🔴 Not Started | Export/import |
| 11011 | Memory Management | Should | 🔴 Not Started | Monitor usage |

### 12000 - Authentication & Authorization
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 12001 | Reddit OAuth Authentication | Must | 🔴 Not Started | Auto by Devvit |
| 12002 | Moderator Permission Verification | Must | 🔴 Not Started | Check perms |
| 12003 | Permission Checks Before Actions | Must | 🔴 Not Started | Safety |
| 12004 | App Installation Authorization | Must | 🔴 Not Started | Manifest |
| 12005 | Rate Limiting Compliance | Must | 🔴 Not Started | 60/min |
| 12006 | Webhook Authentication | Should | 🔴 Not Started | URL validation |
| 12007 | Action Authorization Matrix | Should | 🔴 Not Started | Permission map |
| 12008 | Bot Account Management | Must | 🔴 Not Started | Setup guide |
| 12009 | Security Best Practices | Must | 🔴 Not Started | No secret logging |
| 12010 | Error Handling for Auth Failures | Must | 🔴 Not Started | Graceful degradation |
| 12011 | Audit Logging | Should | 🔴 Not Started | Action tracking |

---

## Phase 5: Testing & Quality (Should Have)

### 13000 - Testing
| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| 13001 | Unit Testing Strategy | Should | 🔴 Not Started | Jest setup |
| 13002 | Integration Testing | Should | 🔴 Not Started | Component interaction |
| 13003 | Mock Data Generation | Should | 🔴 Not Started | Test fixtures |
| 13004 | Image Detection Test Cases | Should | 🔴 Not Started | Validation tests |
| 13005 | Comment Validation Test Cases | Should | 🔴 Not Started | R5 checking |
| 13006 | Timing and Grace Period Tests | Should | 🔴 Not Started | Time-based logic |
| 13007 | Modmail Parsing Tests | Should | 🔴 Not Started | Regex tests |
| 13008 | Template Substitution Tests | Should | 🔴 Not Started | Variable tests |
| 13009 | Error Handling Tests | Should | 🔴 Not Started | Failure scenarios |
| 13010 | Performance Testing | Could | 🔴 Not Started | Load tests |
| 13011 | End-to-End Testing | Should | 🔴 Not Started | Complete workflows |
| 13012 | Test Environment Setup | Should | 🔴 Not Started | Jest config |

---

## Summary by Priority

### Must Have (MVP - 73 features)
Essential features required for basic Rule 5 enforcement:
- Post detection and validation
- Warning system
- Removal system
- Reinstatement when R5 added
- Modmail approval
- Settings management
- Basic storage and auth

**Target:** Phase 1-2 completion

---

### Should Have (Enhanced - 31 features)
Important features that significantly improve usability:
- Notifications (Slack/Discord)
- Template customization
- Lazy R5 reporting
- Comment cleanup
- Testing suite
- Analytics

**Target:** Phase 3-5 completion

---

### Could Have (Polish - 14 features)
Nice-to-have features for optimization:
- Queue polling backup
- Settings caching
- Template preview
- Notification aggregation
- Data backup/migration
- Performance optimization

**Target:** Post-MVP enhancements

---

### Won't Have (Future - 1 feature)
Deferred to future versions:
- Multi-language templates

---

## Implementation Order (Recommended)

### Sprint 1: Foundation (Weeks 1-2)
1. ✅ Project setup and Devvit configuration
2. ✅ Settings management (8001-8003, 8010)
3. ✅ Redis storage design (11001, 11006)
4. ✅ Post monitoring triggers (1002, 1003)
5. ✅ Basic post validation (2001, 2002, 2004-2007)

### Sprint 2: Core Enforcement (Weeks 3-4)
1. ✅ Comment validation (3001-3003, 3005, 3008)
2. ✅ Warning system (4001-4007)
3. ✅ Template system (9001-9004, 9006)
4. ✅ Grace period scheduler

### Sprint 3: Removal & Reinstatement (Weeks 5-6)
1. ✅ Removal system (5001-5007, 5009)
2. ✅ Reinstatement system (6001-6008, 6010)
3. ✅ Whitelist management (11003)
4. ✅ State tracking (11002, 11004, 11005)

### Sprint 4: Modmail & Auth (Weeks 7-8)
1. ✅ Modmail integration (7001-7007, 7009-7010)
2. ✅ Permission verification (12002-12003, 12005)
3. ✅ Error handling (12010)
4. ✅ Basic logging (10005, 10009)

### Sprint 5: Notifications & Testing (Weeks 9-10)
1. ✅ Slack/Discord integration (10001-10004)
2. ✅ Unit tests (13001, 13003-13008)
3. ✅ Integration tests (13002, 13011)
4. ✅ Structured logging (10006-10007)

### Sprint 6: Polish & Deploy (Weeks 11-12)
1. ✅ Enhanced features (Should Have items)
2. ✅ End-to-end testing on test subreddit
3. ✅ Documentation finalization
4. ✅ Production deployment
5. ✅ Monitoring and bug fixes

---

## Progress Tracking

**Total Features:** 142
- 🔴 Not Started: ~90 (63%)
- 🟡 In Progress: 0 (0%)
- 🔵 Blocked: 0 (0%)
- 🟢 Completed: ~52 (37%)

**By Priority:**
- Must Have: ~40/73 (55%)
- Should Have: ~10/45 (22%)
- Could Have: ~2/23 (9%)
- Won't Have: 0/1 (0%)

**By Phase:**
- Phase 1 (Core): ~35/51 (69%) - Core enforcement largely complete
- Phase 2 (Modmail/Settings): ~10/25 (40%) - Settings designed, modmail complete
- Phase 3 (Templates/Notifications): ~3/33 (9%) - Templates basic, notifications not started
- Phase 4 (Storage/Auth): ~4/22 (18%) - Storage designed, auth minimal
- Phase 5 (Testing): ~0/12 (0%) - Not started

---

## Blockers & Risks

| Issue | Severity | Status | Resolution |
|-------|----------|--------|------------|
| None yet | - | - | - |

---

## Notes

- Update this file as features progress
- Move blocked items to Blockers section
- Track dependencies between features
- Adjust priorities based on feedback
- Sprint targets are estimates, adjust as needed

---

**Last Updated:** 2025-01-17 (v1.0.1)
**Recent Changes:**
- Configurable modmail messages (9 templates)
- Inclusive terminology (allowlist)
- Security improvements (bot removal verification)
- Documentation cleanup
**Next Review:** v1.1.0 planning
