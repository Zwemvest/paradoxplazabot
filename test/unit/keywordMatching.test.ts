/**
 * Unit tests for keyword matching utilities
 */

import {
  parseKeywordList,
  containsOne,
  containsAll,
  startsWith,
  endsWith,
  meetsMinimumLength,
  validateText,
} from '../../src/utils/keywordMatching';

describe('Keyword Matching', () => {
  describe('parseKeywordList', () => {
    it('should parse newline-separated keywords', () => {
      const input = 'what\nwhy\nhow';
      const result = parseKeywordList(input);
      expect(result).toEqual(['what', 'why', 'how']);
    });

    it('should trim whitespace', () => {
      const input = '  what  \n  why  \n  how  ';
      const result = parseKeywordList(input);
      expect(result).toEqual(['what', 'why', 'how']);
    });

    it('should filter empty lines', () => {
      const input = 'what\n\n\nwhy\n\nhow';
      const result = parseKeywordList(input);
      expect(result).toEqual(['what', 'why', 'how']);
    });

    it('should return empty array for undefined', () => {
      const result = parseKeywordList(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = parseKeywordList('');
      expect(result).toEqual([]);
    });
  });

  describe('containsOne', () => {
    it('should return true if text contains one keyword', () => {
      const text = 'This explains what happened';
      const keywords = ['what', 'why', 'how'];
      expect(containsOne(text, keywords)).toBe(true);
    });

    it('should return false if text contains no keywords', () => {
      const text = 'This is a picture';
      const keywords = ['what', 'why', 'how'];
      expect(containsOne(text, keywords)).toBe(false);
    });

    it('should be case insensitive', () => {
      const text = 'This explains WHAT happened';
      const keywords = ['what', 'why', 'how'];
      expect(containsOne(text, keywords)).toBe(true);
    });

    it('should return true for empty keyword list', () => {
      const text = 'Any text';
      expect(containsOne(text, [])).toBe(true);
    });
  });

  describe('containsAll', () => {
    it('should return true if text contains all keywords', () => {
      const text = 'screenshot with explanation';
      const keywords = ['screenshot', 'explanation'];
      expect(containsAll(text, keywords)).toBe(true);
    });

    it('should return false if text missing one keyword', () => {
      const text = 'just a screenshot';
      const keywords = ['screenshot', 'explanation'];
      expect(containsAll(text, keywords)).toBe(false);
    });

    it('should be case insensitive', () => {
      const text = 'SCREENSHOT with EXPLANATION';
      const keywords = ['screenshot', 'explanation'];
      expect(containsAll(text, keywords)).toBe(true);
    });

    it('should return true for empty keyword list', () => {
      const text = 'Any text';
      expect(containsAll(text, [])).toBe(true);
    });
  });

  describe('startsWith', () => {
    it('should return true if text starts with keyword', () => {
      const text = 'Discussion: about game';
      const keywords = ['Discussion:', 'Question:'];
      expect(startsWith(text, keywords)).toBe(true);
    });

    it('should return false if text does not start with keyword', () => {
      const text = 'My screenshot';
      const keywords = ['Discussion:', 'Question:'];
      expect(startsWith(text, keywords)).toBe(false);
    });

    it('should trim whitespace', () => {
      const text = '  Discussion: about game';
      const keywords = ['Discussion:', 'Question:'];
      expect(startsWith(text, keywords)).toBe(true);
    });

    it('should be case insensitive', () => {
      const text = 'discussion: about game';
      const keywords = ['Discussion:', 'Question:'];
      expect(startsWith(text, keywords)).toBe(true);
    });

    it('should return true for empty keyword list', () => {
      const text = 'Any text';
      expect(startsWith(text, [])).toBe(true);
    });
  });

  describe('endsWith', () => {
    it('should return true if text ends with keyword', () => {
      const text = 'What is this?';
      const keywords = ['?', '...'];
      expect(endsWith(text, keywords)).toBe(true);
    });

    it('should return false if text does not end with keyword', () => {
      const text = 'My game';
      const keywords = ['?', '...'];
      expect(endsWith(text, keywords)).toBe(false);
    });

    it('should trim whitespace', () => {
      const text = 'What is this?  ';
      const keywords = ['?', '...'];
      expect(endsWith(text, keywords)).toBe(true);
    });

    it('should be case insensitive', () => {
      const text = 'Ending with WORD';
      const keywords = ['word'];
      expect(endsWith(text, keywords)).toBe(true);
    });

    it('should return true for empty keyword list', () => {
      const text = 'Any text';
      expect(endsWith(text, [])).toBe(true);
    });
  });

  describe('meetsMinimumLength', () => {
    it('should return true if text meets minimum', () => {
      const text = 'Long enough text';
      expect(meetsMinimumLength(text, 10)).toBe(true);
    });

    it('should return false if text too short', () => {
      const text = 'short';
      expect(meetsMinimumLength(text, 10)).toBe(false);
    });

    it('should trim whitespace before checking', () => {
      const text = '  text  ';
      expect(meetsMinimumLength(text, 4)).toBe(true);
    });
  });

  describe('validateText', () => {
    it('should validate minimum length', () => {
      const rules = { minLength: 10 };
      expect(validateText('short', rules).valid).toBe(false);
      expect(validateText('long enough text', rules).valid).toBe(true);
    });

    it('should validate contains one', () => {
      const rules = { containsOne: ['what', 'why', 'how'] };
      expect(validateText('This explains what happened', rules).valid).toBe(true);
      expect(validateText('This is a picture', rules).valid).toBe(false);
    });

    it('should validate contains all', () => {
      const rules = { containsAll: ['screenshot', 'explanation'] };
      expect(validateText('screenshot with explanation', rules).valid).toBe(true);
      expect(validateText('just a screenshot', rules).valid).toBe(false);
    });

    it('should validate starts with', () => {
      const rules = { startsWith: ['Discussion:', 'Question:'] };
      expect(validateText('Discussion: about game', rules).valid).toBe(true);
      expect(validateText('My screenshot', rules).valid).toBe(false);
    });

    it('should validate ends with', () => {
      const rules = { endsWith: ['?', '...'] };
      expect(validateText('What is this?', rules).valid).toBe(true);
      expect(validateText('My game', rules).valid).toBe(false);
    });

    it('should combine multiple rules', () => {
      const rules = {
        minLength: 20,
        containsOne: ['what', 'why'],
        startsWith: ['R5:'],
      };
      expect(validateText('R5: This explains what happened', rules).valid).toBe(true);
      expect(validateText('R5: Short', rules).valid).toBe(false); // Too short
      expect(validateText('This explains what happened', rules).valid).toBe(false); // No "R5:"
    });

    it('should return reason for failure', () => {
      const rules = { minLength: 20 };
      const result = validateText('short', rules);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too short');
    });
  });
});
