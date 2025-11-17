/**
 * Domain and URL pattern matching utilities
 * Feature 2002: Domain Pattern Matching
 */

/**
 * Check if text contains any of the domain patterns
 * Case-insensitive matching
 */
export function matchesAnyPattern(text: string, patterns: string[]): boolean {
  if (!text || patterns.length === 0) return false;

  const lowerText = text.toLowerCase();
  return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
}

/**
 * Check if URL matches any of the specified domains
 * Extracts hostname and checks against domain list
 */
export function matchesDomain(url: string, domains: string[]): boolean {
  if (!url || domains.length === 0) return false;

  try {
    const urlDomain = new URL(url).hostname.toLowerCase();
    return domains.some(domain => urlDomain.includes(domain.toLowerCase()));
  } catch {
    // Invalid URL, return false
    return false;
  }
}

/**
 * Check if text contains any URL
 * Simple URL detection (not regex to avoid ReDoS)
 */
export function containsURL(text: string): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  return lowerText.includes('http://') || lowerText.includes('https://');
}

/**
 * Parse domain list from settings (newline-separated)
 */
export function parseDomainList(settingValue: string | undefined): string[] {
  if (!settingValue) return [];

  return settingValue
    .split('\n')
    .map(d => d.trim())
    .filter(d => d.length > 0);
}
