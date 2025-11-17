/**
 * Keyword matching utilities
 * Safe text validation without regex (prevents ReDoS attacks)
 * Based on KEYWORD-MATCHING.md
 */

import type { KeywordValidationRules, ValidationResult } from '../types/index.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse newline-separated keyword lists from settings
 */
export function parseKeywordList(settingValue: string | undefined): string[] {
  if (!settingValue) return [];
  return settingValue
    .split('\n')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Check if text contains at least one keyword (OR logic)
 */
export function containsOne(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Check if text contains all keywords (AND logic)
 */
export function containsAll(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return keywords.every((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Check if text starts with one of the keywords (OR logic)
 */
export function startsWith(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.trim().toLowerCase();
  return keywords.some((keyword) => lowerText.startsWith(keyword.toLowerCase()));
}

/**
 * Check if text ends with one of the keywords (OR logic)
 */
export function endsWith(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lowerText = text.trim().toLowerCase();
  return keywords.some((keyword) => lowerText.endsWith(keyword.toLowerCase()));
}

/**
 * Check if text meets minimum length requirement
 */
export function meetsMinimumLength(text: string, minLength: number): boolean {
  return text.trim().length >= minLength;
}

// ============================================================================
// Combined Validation
// ============================================================================

/**
 * Validate text against keyword rules
 */
export function validateText(text: string, rules: KeywordValidationRules): ValidationResult {
  // 1. Check minimum length
  if (rules.minLength && text.trim().length < rules.minLength) {
    return {
      valid: false,
      reason: `Text too short (${text.trim().length} chars, minimum ${rules.minLength})`,
    };
  }

  // 2. Check contains all
  if (rules.containsAll && rules.containsAll.length > 0) {
    if (!containsAll(text, rules.containsAll)) {
      return {
        valid: false,
        reason: `Text must contain all keywords: ${rules.containsAll.join(', ')}`,
      };
    }
  }

  // 3. Check contains one
  if (rules.containsOne && rules.containsOne.length > 0) {
    if (!containsOne(text, rules.containsOne)) {
      return {
        valid: false,
        reason: `Text must contain at least one keyword: ${rules.containsOne.join(', ')}`,
      };
    }
  }

  // 4. Check starts with
  if (rules.startsWith && rules.startsWith.length > 0) {
    if (!startsWith(text, rules.startsWith)) {
      return {
        valid: false,
        reason: `Text must start with one of: ${rules.startsWith.join(', ')}`,
      };
    }
  }

  // 5. Check ends with
  if (rules.endsWith && rules.endsWith.length > 0) {
    if (!endsWith(text, rules.endsWith)) {
      return {
        valid: false,
        reason: `Text must end with one of: ${rules.endsWith.join(', ')}`,
      };
    }
  }

  return { valid: true };
}
