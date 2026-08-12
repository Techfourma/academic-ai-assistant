import { describe, it, expect, beforeEach } from 'vitest';
import { getNormalizedMessage, clearInFlightRequests } from '../src/middleware/deduplicate.js';

describe('Deduplication', () => {
  beforeEach(() => {
    clearInFlightRequests();
  });

  describe('Message Normalization', () => {
    it('should trim whitespace', () => {
      expect(getNormalizedMessage('  hello  ')).toBe('hello');
    });

    it('should collapse multiple spaces', () => {
      expect(getNormalizedMessage('hello   world')).toBe('hello world');
    });

    it('should lowercase', () => {
      expect(getNormalizedMessage('HELLO WORLD')).toBe('hello world');
    });

    it('should handle all transformations', () => {
      expect(getNormalizedMessage('  APA   SYARAT  SEMINAR?  '))
        .toBe('apa syarat seminar?');
    });

    it('should treat equivalent messages as same', () => {
      const msg1 = getNormalizedMessage('Apa syarat seminar?');
      const msg2 = getNormalizedMessage('  apa   syarat  seminar?  ');
      expect(msg1).toBe(msg2);
    });
  });
});