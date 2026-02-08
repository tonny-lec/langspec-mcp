import { describe, it, expect } from 'vitest';
import { parseMarkdownSpec } from '../src/ingestion/parser.js';
import { normalizeSections } from '../src/ingestion/normalizer.js';
import { getDocConfig } from '../src/config/languages.js';
import { parseSummaryMd } from '../src/ingestion/fetcher.js';

const rustConfig = getDocConfig('rust');

describe('Rust Reference ingestion', () => {
  it('parses SUMMARY.md manifest correctly', () => {
    const summary = `# The Rust Reference

[Introduction](introduction.md)

## Lexical structure

- [Input format](input-format.md)
- [Keywords](keywords.md)

## Items

- [Items](items.md)
  - [Modules](items/modules.md)
`;
    const files = parseSummaryMd(summary, 'src');

    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('src/introduction.md');
    expect(files).toContain('src/items/modules.md');
  });

  it('parses Rust Reference markdown with headings', () => {
    const md = [
      '# Types',
      '',
      '## Boolean type',
      '',
      'The bool type represents boolean values.',
      '',
      '### Examples',
      '',
      'let x: bool = true;',
      '',
      '## Numeric types',
      '',
      '### Integer types',
      '',
      'Signed and unsigned integers.',
    ].join('\n');

    const sections = parseMarkdownSpec(md, rustConfig, 'src/types.md');

    expect(sections.length).toBeGreaterThanOrEqual(4);
    expect(sections[0].title).toBe('Types');
    expect(sections[1].title).toBe('Boolean type');
    expect(sections[1].section_id).toBe('boolean-type');
  });

  it('builds correct canonical URLs for Rust sections', () => {
    const md = `## Trait Objects

Content about trait objects.
`;
    const sections = parseMarkdownSpec(md, rustConfig, 'src/types/trait-object.md');
    const normalized = normalizeSections(sections, {
      language: 'rust',
      doc: 'rust-reference',
      version: 'snapshot-20260208',
      baseUrl: 'https://doc.rust-lang.org/reference',
      sourcePolicy: 'local_fulltext_ok',
      pageUrlPrefix: 'src',
    });

    expect(normalized[0].canonical_url).toBe(
      'https://doc.rust-lang.org/reference/types/trait-object.html#trait-objects'
    );
    expect(normalized[0].source_policy).toBe('local_fulltext_ok');
  });

  it('handles nested paths in canonical URLs', () => {
    const md = `## Extern Crates\n\nContent`;
    const sections = parseMarkdownSpec(md, rustConfig, 'src/items/extern-crates.md');
    const normalized = normalizeSections(sections, {
      language: 'rust',
      doc: 'rust-reference',
      version: 'snapshot-20260208',
      baseUrl: 'https://doc.rust-lang.org/reference',
      pageUrlPrefix: 'src',
    });

    expect(normalized[0].canonical_url).toContain('items/extern-crates.html');
  });
});
