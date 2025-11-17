/**
 * Template substitution utilities
 * Replace variables in message templates
 */

import type { TemplateVariables } from '../types/index.js';

/**
 * Substitute variables in template string
 * Variables format: {{variableName}}
 */
export function substituteVariables(template: string, variables: TemplateVariables): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      // Escape special regex characters in the key
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
  }

  return result;
}

/**
 * Get modmail link for a subreddit
 */
export function getModmailLink(subreddit: string, subject?: string): string {
  const encodedSubject = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `https://www.reddit.com/message/compose?to=/r/${subreddit}${encodedSubject}`;
}

/**
 * Feature 7011: Pre-filled Modmail Template
 * Generate modmail link with pre-filled subject and body for R5 reinstatement
 */
export function getR5ReinstatementModmailLink(
  subreddit: string,
  postId: string,
  postUrl: string
): string {
  const subject = 'Rule 5 Reinstatement Request';
  const body = `I have added a Rule 5 explanation comment to my post and would like to request reinstatement.\n\nPost: ${postUrl}\nPost ID: ${postId}\n\nThank you!`;

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  return `https://www.reddit.com/message/compose?to=/r/${subreddit}&subject=${encodedSubject}&message=${encodedBody}`;
}

/**
 * Get post permalink URL
 */
export function getPostUrl(permalink: string): string {
  return `https://reddit.com${permalink}`;
}
