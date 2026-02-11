import { describe, it, expect } from 'vitest';
import { getDocConfig, getLanguageConfig } from '../src/config/languages.js';
import { normalizeSections } from '../src/ingestion/normalizer.js';
import type { ParsedSection } from '../src/types.js';

describe('Vitest config', () => {
  it('vitest language config exists and is well-formed', () => {
    const config = getLanguageConfig('vitest');
    expect(config.language).toBe('vitest');
    expect(config.displayName).toBe('Vitest');
    expect(config.docs).toHaveLength(1);
  });

  it('vitest doc config has correct github-markdown settings', () => {
    const doc = getDocConfig('vitest');
    expect(doc.fetchStrategy).toBe('github-markdown');
    expect(doc.githubOwner).toBe('vitest-dev');
    expect(doc.githubRepo).toBe('vitest');
    expect(doc.githubPath).toBe('docs');
    expect(doc.sourcePolicy).toBe('local_fulltext_ok');
    expect(doc.canonicalBaseUrl).toBe('https://vitest.dev');
    expect(doc.excludePaths).toEqual(['.vitepress', 'team', 'public']);
    expect(doc.urlSuffix).toBe('');
  });

  it('java config has explicit chapterPattern', () => {
    const doc = getDocConfig('java');
    expect(doc.chapterPattern).toBeDefined();
    expect(doc.chapterPattern!.test('jls-4.html')).toBe(true);
    expect(doc.chapterPattern!.test('index.html')).toBe(false);
  });
});

describe('urlSuffix in canonical URL', () => {
  function makeParsedSection(overrides?: Partial<ParsedSection>): ParsedSection {
    return {
      section_id: 'mock-timers',
      title: 'Mock Timers',
      section_path: 'Guide > Mock Timers',
      content: 'Vitest mock timers content',
      heading_level: 2,
      ...overrides,
    };
  }

  it('uses empty urlSuffix for VitePress clean URLs', () => {
    const sections = [makeParsedSection({
      section_id: 'mock-timers',
      pageUrl: 'docs/guide/mocking.md',
    })];
    const result = normalizeSections(sections, {
      language: 'vitest',
      doc: 'vitest-docs',
      version: 'snapshot-20260211',
      baseUrl: 'https://vitest.dev',
      pageUrlPrefix: 'docs',
      urlSuffix: '',
    });

    expect(result[0].canonical_url).toBe('https://vitest.dev/guide/mocking#mock-timers');
  });

  it('uses .html suffix by default (backward compat)', () => {
    const sections = [makeParsedSection({
      section_id: 'boolean-type',
      pageUrl: 'src/types.md',
    })];
    const result = normalizeSections(sections, {
      language: 'rust',
      doc: 'rust-reference',
      version: 'snapshot-20260211',
      baseUrl: 'https://doc.rust-lang.org/reference',
      pageUrlPrefix: 'src',
    });

    expect(result[0].canonical_url).toBe('https://doc.rust-lang.org/reference/types.html#boolean-type');
  });

  it('handles nested subdirectory paths with empty urlSuffix', () => {
    const sections = [makeParsedSection({
      section_id: 'viewport-api',
      pageUrl: 'docs/guide/browser/commands.md',
    })];
    const result = normalizeSections(sections, {
      language: 'vitest',
      doc: 'vitest-docs',
      version: 'snapshot-20260211',
      baseUrl: 'https://vitest.dev',
      pageUrlPrefix: 'docs',
      urlSuffix: '',
    });

    expect(result[0].canonical_url).toBe('https://vitest.dev/guide/browser/commands#viewport-api');
  });
});
