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

  // ========================================
  // Multi-page URL tests
  // ========================================

  it('builds canonical_url with pageUrl for multi-page HTML (Java)', () => {
    const sections = [makeParsedSection({
      section_id: 'jls-4.2.1',
      pageUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html',
    })];
    const result = normalizeSections(sections, {
      language: 'java',
      doc: 'jls',
      version: 'se21',
      baseUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html',
    });

    expect(result[0].canonical_url).toBe(
      'https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.2.1'
    );
  });

  it('builds canonical_url from GitHub markdown path (Rust)', () => {
    const sections = [makeParsedSection({
      section_id: 'boolean-type',
      pageUrl: 'src/types.md',
    })];
    const result = normalizeSections(sections, {
      language: 'rust',
      doc: 'rust-reference',
      version: 'snapshot-20260208',
      baseUrl: 'https://doc.rust-lang.org/reference',
      pageUrlPrefix: 'src',
    });

    expect(result[0].canonical_url).toBe(
      'https://doc.rust-lang.org/reference/types.html#boolean-type'
    );
  });

  it('handles nested markdown paths (Rust items/modules)', () => {
    const sections = [makeParsedSection({
      section_id: 'extern-crate-items',
      pageUrl: 'src/items/modules.md',
    })];
    const result = normalizeSections(sections, {
      language: 'rust',
      doc: 'rust-reference',
      version: 'snapshot-20260208',
      baseUrl: 'https://doc.rust-lang.org/reference',
      pageUrlPrefix: 'src',
    });

    expect(result[0].canonical_url).toBe(
      'https://doc.rust-lang.org/reference/items/modules.html#extern-crate-items'
    );
  });

  it('builds canonical_url for TypeScript Handbook from GitHub path', () => {
    const sections = [makeParsedSection({
      section_id: 'static-type-checking',
      pageUrl: 'packages/documentation/copy/en/handbook-v2/Basics.md',
    })];
    const result = normalizeSections(sections, {
      language: 'typescript',
      doc: 'ts-handbook',
      version: 'snapshot-20260208',
      baseUrl: 'https://www.typescriptlang.org/docs/handbook/2',
      pageUrlPrefix: 'packages/documentation/copy/en/handbook-v2',
    });

    expect(result[0].canonical_url).toBe(
      'https://www.typescriptlang.org/docs/handbook/2/Basics.html#static-type-checking'
    );
  });
});
