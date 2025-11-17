/**
 * Post Validation Service
 * Determines if a post requires Rule 5 enforcement
 *
 * Features implemented:
 * - 2001: Configurable Post Type Enforcement
 * - 2002: Domain Pattern Matching
 * - 2004: Flair-Based Enforcement Rules
 * - 2005: Allowed User Check
 * - 2010: Moderator Approval Check
 * - 2011: Moderator Removal Check
 * - 2013: Recently Approved Check
 * - 2014: Complete Validation Pipeline
 */

import type { Post, TriggerContext } from '@devvit/public-api';
import type { PostValidationResult, BotSettings } from '../types/index.js';
import { wasRecentlyApproved, wasRemovedByBot } from '../storage/postState.js';
import { parseKeywordList, containsOne } from '../utils/keywordMatching.js';
import { matchesAnyPattern, matchesDomain, containsURL, parseDomainList } from '../utils/domainMatching.js';
import { isSelfPost, getSelfText, isGallery, getFlairText, isVideo, getPostTypeHint } from '../utils/postHelpers.js';

// ============================================================================
// Feature 2014: Complete Validation Pipeline
// ============================================================================

/**
 * Main entry point: Determine if post requires R5 enforcement
 *
 * Priority order (highest to lowest):
 * 1. Skip if recently approved (prevents re-removal loops)
 * 2. Skip keywords (highest priority exclusion)
 * 3. Exclusion rules (allowlist, age, upvotes, etc.)
 * 4. Flair rules (override post type)
 * 5. Post type rules (check if post type is enforced)
 */
export async function shouldEnforceRule5(
  post: Post,
  context: TriggerContext
): Promise<PostValidationResult> {
  try {
    // 0. Skip if deleted author
    if (!post.authorName) {
      return { shouldEnforce: false, reason: 'Deleted author' };
    }

    // 1. Skip if recently approved (Feature 2013)
    if (await wasRecentlyApproved(post.id, context)) {
      return { shouldEnforce: false, reason: 'Recently approved (24h grace period)' };
    }

    const settings = await context.settings.getAll() as unknown as BotSettings;

    // 2. Skip keywords (highest priority)
    const selfText = getSelfText(post);
    if (isSelfPost(post) && selfText) {
      const skipKeywords = parseKeywordList(settings.skipkeywords);
      if (containsOne(selfText, skipKeywords)) {
        return { shouldEnforce: false, reason: 'Contains skip keyword' };
      }
    }

    // 3. Exclusion rules
    const exclusionResult = await checkExclusionRules(post, settings, context);
    if (!exclusionResult.shouldEnforce) {
      return exclusionResult;
    }

    // 4. Flair rules (Feature 2004)
    const flairResult = await shouldEnforceByFlair(post, settings);
    if (flairResult !== null) {
      // Flair rule applies (either enforce or exclude)
      return {
        shouldEnforce: flairResult,
        reason: flairResult ? 'Flair enforced' : 'Flair excluded',
      };
    }

    // 5. Post type rules (Feature 2001)
    const postTypeResult = await shouldEnforceByPostType(post, settings);
    return postTypeResult;

  } catch (error) {
    console.error('[PostValidation] Error during validation:', error);
    // Fail open: Don't enforce on errors
    return { shouldEnforce: false, reason: 'Validation error (fail open)' };
  }
}

// ============================================================================
// Feature 2001: Configurable Post Type Enforcement
// ============================================================================

async function shouldEnforceByPostType(
  post: Post,
  settings: BotSettings
): Promise<PostValidationResult> {
  const enforcedTypes = settings.enforcedposttypes || [];
  const postTypeHint = getPostTypeHint(post);

  // IMAGE: post_hint = 'image'
  if (enforcedTypes.includes('image') && postTypeHint === 'image') {
    return { shouldEnforce: true, reason: 'Image post' };
  }

  // GALLERY: is_gallery = true
  if (enforcedTypes.includes('gallery') && isGallery(post)) {
    return { shouldEnforce: true, reason: 'Image gallery' };
  }

  // VIDEO: post_hint includes 'video' or is_video = true
  if (enforcedTypes.includes('video')) {
    if (postTypeHint === 'video' || isVideo(post)) {
      return { shouldEnforce: true, reason: 'Video post' };
    }
  }

  // TEXT POST CHECKS
  const selfText = getSelfText(post);
  if (isSelfPost(post) && selfText) {
    const text = selfText;

    // TEXT WITH IMAGE URL
    if (enforcedTypes.includes('text_image')) {
      const imagePatterns = parseDomainList(settings.imagedomains);
      if (matchesAnyPattern(text, imagePatterns)) {
        return { shouldEnforce: true, reason: 'Text post with image URL' };
      }
    }

    // TEXT WITH VIDEO URL
    if (enforcedTypes.includes('text_video')) {
      const videoPatterns = parseDomainList(settings.videodomains);
      if (matchesAnyPattern(text, videoPatterns)) {
        return { shouldEnforce: true, reason: 'Text post with video URL' };
      }
    }

    // TEXT CONTAINING KEYWORDS
    if (enforcedTypes.includes('text_keywords')) {
      const keywords = parseKeywordList(settings.enforcementkeywords);
      if (containsOne(text, keywords)) {
        return { shouldEnforce: true, reason: 'Text post with enforcement keyword' };
      }
    }

    // TEXT WITH ANY URL
    if (enforcedTypes.includes('text_url')) {
      if (containsURL(text)) {
        return { shouldEnforce: true, reason: 'Text post with URL' };
      }
    }
  }

  // LINK POST CHECKS
  if (post.url) {
    const imagePatterns = parseDomainList(settings.imagedomains);
    const videoPatterns = parseDomainList(settings.videodomains);
    const linkDomains = parseDomainList(settings.linkenforcementdomains);

    // LINK TO IMAGE
    if (enforcedTypes.includes('link_image')) {
      if (matchesAnyPattern(post.url, imagePatterns)) {
        return { shouldEnforce: true, reason: 'Link to image' };
      }
    }

    // LINK TO VIDEO
    if (enforcedTypes.includes('link_video')) {
      if (matchesAnyPattern(post.url, videoPatterns)) {
        return { shouldEnforce: true, reason: 'Link to video' };
      }
    }

    // LINKS FROM SPECIFIC DOMAINS
    if (enforcedTypes.includes('link_domains')) {
      if (matchesDomain(post.url, linkDomains)) {
        return { shouldEnforce: true, reason: 'Link from enforced domain' };
      }
    }

    // ALL LINKS
    if (enforcedTypes.includes('link_all')) {
      return { shouldEnforce: true, reason: 'Link post (all links enforced)' };
    }
  }

  return { shouldEnforce: false, reason: 'Post type not enforced' };
}

// ============================================================================
// Feature 2004: Flair-Based Enforcement Rules
// ============================================================================

/**
 * Check flair to determine enforcement (overrides post type rules)
 * Returns null if no flair rule applies
 */
async function shouldEnforceByFlair(
  post: Post,
  settings: BotSettings
): Promise<boolean | null> {
  const flairText = getFlairText(post);
  if (!flairText) {
    return null; // No flair, can't determine
  }

  const postFlair = flairText.toLowerCase();

  // EXCLUDED FLAIRS (highest priority)
  const excludedFlairs = (settings.excludedflairs || '')
    .split(',')
    .map(f => f.trim().toLowerCase())
    .filter(f => f.length > 0);

  if (excludedFlairs.some(flair => postFlair.includes(flair))) {
    return false; // Explicitly excluded
  }

  // ENFORCED FLAIRS (overrides post type)
  const enforcedFlairs = (settings.enforcedflairs || '')
    .split(',')
    .map(f => f.trim().toLowerCase())
    .filter(f => f.length > 0);

  if (enforcedFlairs.some(flair => postFlair.includes(flair))) {
    return true; // Explicitly enforced
  }

  return null; // No flair-based rule, use post type rules
}

// ============================================================================
// Exclusion Rules
// ============================================================================

async function checkExclusionRules(
  post: Post,
  settings: BotSettings,
  context: TriggerContext
): Promise<PostValidationResult> {
  // Feature 2005: Allowed users
  if (await isAllowedUser(post.authorName || '', settings)) {
    return { shouldEnforce: false, reason: 'Allowed user' };
  }

  // Post age limit
  const maxPostAge = settings.maxpostage || 0;
  if (maxPostAge > 0) {
    const postAgeHours = (Date.now() - post.createdAt.getTime()) / 3600000;
    if (postAgeHours > maxPostAge) {
      return { shouldEnforce: false, reason: `Post too old (${postAgeHours.toFixed(1)}h)` };
    }
  }

  // Upvote threshold
  const upvoteThreshold = settings.skipupvotethreshold || 0;
  if (upvoteThreshold > 0 && post.score > upvoteThreshold) {
    return { shouldEnforce: false, reason: `Too many upvotes (${post.score})` };
  }

  // Text post keyword exclusions
  const postSelfText = getSelfText(post);
  if (isSelfPost(post) && postSelfText) {
    const startsWithKeywords = parseKeywordList(settings.textpostexclusionstartswith);
    if (startsWithKeywords.length > 0) {
      const trimmedText = postSelfText.trim().toLowerCase();
      if (startsWithKeywords.some(kw => trimmedText.startsWith(kw.toLowerCase()))) {
        return { shouldEnforce: false, reason: 'Text starts with exclusion keyword' };
      }
    }

    const containsKeywords = parseKeywordList(settings.textpostexclusioncontainsone);
    if (containsOne(postSelfText, containsKeywords)) {
      return { shouldEnforce: false, reason: 'Text contains exclusion keyword' };
    }
  }

  // Link domain exclusions
  if (post.url) {
    const excludedDomains = (settings.linkdomainexclusions || '')
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    if (matchesDomain(post.url, excludedDomains)) {
      return { shouldEnforce: false, reason: 'Link from excluded domain' };
    }
  }

  // Feature 2010: Moderator approval
  if (settings.respectmodapprovals && post.approved) {
    return { shouldEnforce: false, reason: 'Moderator approved' };
  }

  // Feature 2011: Moderator removal
  if (settings.skipmodremoved && post.removed) {
    // Check if removed by bot vs. moderator
    if (!await wasRemovedByBot(post.id, context)) {
      return { shouldEnforce: false, reason: 'Moderator removed' };
    }
  }

  // Feature 2012: Moderator comment skip
  if (settings.skipifmodcomment) {
    const hasModComment = await hasModCommentWithKeywords(post, settings, context);
    if (hasModComment) {
      return { shouldEnforce: false, reason: 'Moderator granted exception via comment' };
    }
  }

  // All exclusion checks passed
  return { shouldEnforce: true, reason: 'No exclusions apply' };
}

// ============================================================================
// Feature 2005: Allowed User Check
// ============================================================================

async function isAllowedUser(username: string, settings: BotSettings): Promise<boolean> {
  if (!username) return false;

  const allowlistStr = settings.allowlistedusers || '';
  if (!allowlistStr) return false;

  const allowlist = allowlistStr
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(u => u.length > 0);

  return allowlist.includes(username.toLowerCase());
}

// ============================================================================
// Feature 2012: Moderator Comment Skip Check
// ============================================================================

/**
 * Check if any moderator has commented with skip keywords
 */
async function hasModCommentWithKeywords(
  post: Post,
  settings: BotSettings,
  context: TriggerContext
): Promise<boolean> {
  try {
    const keywordsStr = settings.modcommentskipkeywords || '';
    if (!keywordsStr.trim()) {
      return false; // No keywords configured
    }

    const keywords = parseKeywordList(keywordsStr);
    if (keywords.length === 0) {
      return false;
    }

    // Get all comments on the post
    const comments = await post.comments.all();
    if (comments.length === 0) {
      return false;
    }

    // Get current subreddit to check mod status
    const subreddit = await context.reddit.getCurrentSubreddit();
    const moderators = await subreddit.getModerators().all();
    const modUsernames = moderators.map(m => m.username.toLowerCase());

    // Check each comment
    for (const comment of comments) {
      const commentAuthor = comment.authorName?.toLowerCase();
      if (!commentAuthor) continue;

      // Check if commenter is a moderator
      if (!modUsernames.includes(commentAuthor)) continue;

      // Check if comment contains any skip keywords
      const commentBody = (comment.body || '').toLowerCase();
      if (containsOne(commentBody, keywords)) {
        console.log(
          `[PostValidation] Found mod comment with skip keyword from u/${comment.authorName}`
        );
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[PostValidation] Error checking mod comments:', error);
    return false; // Fail open
  }
}
