/**
 * Post Helper Functions
 *
 * Provides compatibility helpers for accessing Post properties
 * that may have changed in the Devvit API
 */

import type { Post } from '@devvit/public-api';

/**
 * Check if a post is a self/text post
 */
export function isSelfPost(post: Post): boolean {
  // A post is a self post if it has body text and no external URL
  // (URL will be the reddit permalink)
  return !!post.body && post.url.includes('reddit.com');
}

/**
 * Get the self text/body of a post
 */
export function getSelfText(post: Post): string {
  return post.body || '';
}

/**
 * Check if post is a gallery
 */
export function isGallery(post: Post): boolean {
  return post.gallery && post.gallery.length > 0;
}

/**
 * Get flair text from post
 */
export function getFlairText(post: Post): string | undefined {
  return post.flair?.text;
}

/**
 * Check if post is a video (basic heuristic)
 */
export function isVideo(post: Post): boolean {
  // Check if URL contains common video hosting patterns
  const url = post.url.toLowerCase();
  return url.includes('v.redd.it') ||
         url.includes('youtube.com') ||
         url.includes('youtu.be') ||
         url.includes('vimeo.com') ||
         url.endsWith('.mp4') ||
         url.endsWith('.webm') ||
         url.endsWith('.mov');
}

/**
 * Get a hint about what type of post this is
 * Returns: 'self', 'link', 'image', 'video', 'gallery', or 'unknown'
 */
export function getPostTypeHint(post: Post): string {
  if (isSelfPost(post)) return 'self';
  if (isGallery(post)) return 'gallery';
  if (isVideo(post)) return 'video';

  const url = post.url.toLowerCase();
  // Check for image extensions
  if (url.endsWith('.jpg') || url.endsWith('.jpeg') ||
      url.endsWith('.png') || url.endsWith('.gif') ||
      url.includes('i.redd.it') || url.includes('imgur.com')) {
    return 'image';
  }

  // If not self post and has external URL, it's a link
  if (!post.url.includes('reddit.com')) {
    return 'link';
  }

  return 'unknown';
}
