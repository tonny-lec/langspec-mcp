import { describe, it, expect } from 'vitest';
import { normalizeSections } from '../src/ingestion/normalizer.js';
import { EXCERPT_MAX_LENGTH, hashContent } from '../src/db/schema.js';
import type { ParsedSection } from '../src/types.js';

const baseMeta = {
  language: 'go',
  doc: 'go-spec',
  version: 'go1.22',
  baseUrl: 'https://go.dev/ref/spec',
};

function makeParsedSection(overrides?: Partial<ParsedSection>): ParsedSection {
  return {
    section_id: 'Types',
    title: 'Types',
    section_path: 'Types',
    content: 'Some type content',
    heading_level: 2,
    ...overrides,
  };
}

describe('normalizeSections', () => {
  it('builds canonical_url from baseUrl#section_id', () => {
    const sections = [makeParsedSection({ section_id: 'Interfaces' })];
    const result = normalizeSections(sections, baseMeta);

    expect(result[0].canonical_url).toBe('https://go.dev/ref/spec#Interfaces');
  });

  it('truncates excerpt when fulltext exceeds EXCERPT_MAX_LENGTH', () => {
    const longContent = 'x'.repeat(EXCERPT_MAX_LENGTH + 100);
    const sections = [makeParsedSection({ content: longContent })];
    const result = normalizeSections(sections, baseMeta);

    expect(result[0].excerpt.length).toBe(EXCERPT_MAX_LENGTH + 3); // + "..."
    expect(result[0].excerpt.endsWith('...')).toBe(true);
    expect(result[0].fulltext).toBe(longContent);
  });

  it('does not truncate excerpt when fulltext is within limit', () => {
    const shortContent = 'short text';
    const sections = [makeParsedSection({ content: shortContent })];
    const result = normalizeSections(sections, baseMeta);

    expect(result[0].excerpt).toBe(shortContent);
    expect(result[0].fulltext).toBe(shortContent);
  });

  it('produces deterministic content_hash for same input', () => {
    const sections = [makeParsedSection({ content: 'deterministic input' })];
    const r1 = normalizeSections(sections, baseMeta);
    const r2 = normalizeSections(sections, baseMeta);

    expect(r1[0].content_hash).toBe(r2[0].content_hash);
    expect(r1[0].content_hash).toBe(hashContent('deterministic input'));
  });

  it('uses default source_policy excerpt_only when not specified', () => {
    const sections = [makeParsedSection()];
    const result = normalizeSections(sections, baseMeta);

    expect(result[0].source_policy).toBe('excerpt_only');
  });

  it('uses provided source_policy', () => {
    const sections = [makeParsedSection()];
    const result = normalizeSections(sections, {
      ...baseMeta,
      sourcePolicy: 'full_text',
    });

    expect(result[0].source_policy).toBe('full_text');
  });
});
