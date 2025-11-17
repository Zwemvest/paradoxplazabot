/**
 * Core type definitions for the Paradox Plaza Rule 5 Bot
 */

// import type { Post, Comment } from '@devvit/public-api'; // Unused currently

// ============================================================================
// Post Validation Types
// ============================================================================

export interface PostValidationResult {
  shouldEnforce: boolean;
  reason?: string;
}

export type PostType =
  | 'image'
  | 'gallery'
  | 'video'
  | 'text_image'
  | 'text_video'
  | 'text_keywords'
  | 'text_url'
  | 'link_image'
  | 'link_video'
  | 'link_domains'
  | 'link_all';

// ============================================================================
// R5 Validation Types
// ============================================================================

export interface R5ValidationResult {
  valid: boolean;
  shouldReport: boolean;
  reason: string;
  text?: string;
}

export type R5Location = 'selftext' | 'comment' | 'both';

// ============================================================================
// Keyword Matching Types
// ============================================================================

export interface KeywordValidationRules {
  minLength?: number;
  containsOne?: string[];
  containsAll?: string[];
  startsWith?: string[];
  endsWith?: string[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ============================================================================
// Redis Storage Types
// ============================================================================

export interface PostState {
  postId: string;
  warned: boolean;
  warnedAt?: number;
  warningCommentId?: string;
  removed: boolean;
  removedAt?: number;
  removalCommentId?: string;
  approved: boolean;
  approvedAt?: number;
}

export interface ScheduledAction {
  postId: string;
  action: 'warn' | 'remove';
  scheduledFor: number;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface BotSettings {
  // Post Type Enforcement
  enforcedposttypes: PostType[];

  // Exclusions
  allowlistedusers: string;
  maxpostage: number;
  skipupvotethreshold: number;
  textpostexclusionstartswith: string;
  textpostexclusioncontainsone: string;
  linkdomainexclusions: string;
  respectmodapprovals: boolean;
  skipmodremoved: boolean;
  skipifmodcomment: boolean;
  modcommentskipkeywords: string;

  // Known Domains
  imagedomains: string;
  videodomains: string;
  linkenforcementdomains: string;

  // Keywords
  enforcementkeywords: string;
  skipkeywords: string;
  modmailkeywords: string;

  // Flairs
  enforcedflairs: string;
  excludedflairs: string;

  // R5 Validation
  mincommentlength: number;
  reportcommentlength: number;
  r5containsone: string;
  r5containsall: string;
  r5startswith: string;
  r5endswith: string;
  r5commentlocation: R5Location;

  // Timing
  graceperiod: number;
  warningperiod: number;
  removalperiod: number;

  // Bot Behavior
  enforcementaction: 'remove' | 'report' | 'both';
  commentonwarning: boolean;
  commentonremoval: boolean;
  commentonreinstatement: boolean;
  enablemodmail: boolean;
  autoreinstate: boolean;
  autoarchivemodmail: boolean;
  cleanupwarnings: boolean;

  // Notifications
  enableslack: boolean;
  slackwebhook: string;
  enablediscord: boolean;
  discordwebhook: string;
  notificationevents: string[];

  // Templates
  warningtemplate: string;
  removaltemplate: string;
  reporttemplate: string; // Feature 5010
  reportreason: string; // Feature 5010
  reportreasontooshort: string;
  reportreasonnor5: string;
  notificationtemplate: string;

  // Modmail Message Templates
  modmailnopostid: string;
  modmailpostnotfound: string;
  modmailnotauthor: string;
  modmailnotbotremoval: string;
  modmailalreadyapproved: string;
  modmailnor5: string;
  modmailsuccess: string;
  modmailerror: string;
  reinstatementcomment: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationEvent =
  | 'r5_report'
  | 'r5_invalid'
  | 'warning'
  | 'removal'
  | 'reinstatement'
  | 'error';

export interface NotificationPayload {
  event: NotificationEvent;
  username: string;
  subreddit: string;
  postUrl: string;
  reason: string;
}

// ============================================================================
// Template Variables
// ============================================================================

export interface TemplateVariables {
  username?: string;
  author?: string; // Alias for username
  subreddit?: string;
  permalink?: string;
  postid?: string;
  postTitle?: string;
  postUrl?: string;
  graceminutes?: string | number;
  graceMinutes?: string | number; // Camel case alias
  warningminutes?: string | number;
  warningMinutes?: string | number; // Camel case alias
  modmaillink?: string;
  event?: string;
  reason?: string;
  action?: string; // Feature 5010: Action taken (removed/reported)
}

// ============================================================================
// Utility Types
// ============================================================================

export interface CommentTiming {
  postCreated: Date;
  commentCreated: Date;
  minutesAfterPost: number;
  addedBeforeWarning: boolean;
  addedAfterWarning: boolean;
  addedAfterRemoval: boolean;
}

export interface QualityCheck {
  valid: boolean;
  reason?: string;
}
