import { describe, it, expect } from 'vitest';
import { extractRelevantSnippet } from '../src/db/queries.js';

describe('extractRelevantSnippet', () => {
  it('returns full text when shorter than maxLen', () => {
    const result = extractRelevantSnippet('hello world', 'hello');
    expect(result).toEqual({
      text: 'hello world',
      start_char: 0,
      end_char: 11,
    });
  });

  it('centers window around token match', () => {
    // Build a long text where "goroutine" appears at a known position
    const prefix = 'a'.repeat(400);
    const suffix = 'b'.repeat(400);
    const text = prefix + 'goroutine' + suffix;

    const result = extractRelevantSnippet(text, 'goroutine', 300);

    // The snippet should contain "goroutine"
    expect(result.text).toContain('goroutine');
    // start_char should be near the match, not at 0
    expect(result.start_char).toBeGreaterThan(0);
    // Should have leading ellipsis since start > 0
    expect(result.text.startsWith('...')).toBe(true);
  });

  it('falls back to start when no token matches', () => {
    const text = 'a'.repeat(500);
    const result = extractRelevantSnippet(text, 'zzzzz', 300);

    expect(result.start_char).toBe(0);
    expect(result.end_char).toBe(300);
    expect(result.text).toBe('a'.repeat(300) + '...');
  });

  it('strips FTS5 operators from query', () => {
    const text = 'a'.repeat(200) + 'channel' + 'b'.repeat(200);
    const result = extractRelevantSnippet(text, 'AND OR NOT channel', 300);

    expect(result.text).toContain('channel');
  });

  it('uses earliest matching token position', () => {
    // "channel" appears at position 100, "goroutine" at position 300
    const text = 'x'.repeat(100) + 'channel' + 'x'.repeat(193) + 'goroutine' + 'x'.repeat(200);

    const result = extractRelevantSnippet(text, 'goroutine channel', 300);

    // Should center on "channel" (position 100), the earliest match
    expect(result.text).toContain('channel');
  });

  it('clamps end to text length when match is near the end', () => {
    const text = 'a'.repeat(500) + 'match';
    const result = extractRelevantSnippet(text, 'match', 300);

    expect(result.end_char).toBe(text.length);
    // Should have leading ellipsis
    expect(result.text.startsWith('...')).toBe(true);
    // Should NOT have trailing ellipsis since we reach the end
    expect(result.text.endsWith('...')).toBe(false);
    expect(result.text).toContain('match');
  });
});
