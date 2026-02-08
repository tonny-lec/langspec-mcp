import { describe, it, expect } from 'vitest';
import { parseSummaryMd } from '../src/ingestion/fetcher.js';

describe('parseSummaryMd', () => {
  it('extracts markdown file paths from SUMMARY.md', () => {
    const markdown = `# Summary

- [Introduction](introduction.md)
- [Items](items.md)
  - [Modules](items/modules.md)
  - [Extern crates](items/extern-crates.md)
`;
    const files = parseSummaryMd(markdown, 'src');

    expect(files).toEqual([
      'src/introduction.md',
      'src/items.md',
      'src/items/modules.md',
      'src/items/extern-crates.md',
    ]);
  });

  it('skips SUMMARY.md itself', () => {
    const markdown = `- [Summary](SUMMARY.md)\n- [Intro](intro.md)`;
    const files = parseSummaryMd(markdown, 'src');

    expect(files).toEqual(['src/intro.md']);
  });

  it('handles nested indentation', () => {
    const markdown = `
- [A](a.md)
    - [B](b.md)
        - [C](c.md)
`;
    const files = parseSummaryMd(markdown, 'docs');

    expect(files).toEqual(['docs/a.md', 'docs/b.md', 'docs/c.md']);
  });

  it('skips lines without markdown links', () => {
    const markdown = `# Title\n\nSome text\n- [File](file.md)\n---\n`;
    const files = parseSummaryMd(markdown, 'src');

    expect(files).toEqual(['src/file.md']);
  });

  it('handles empty manifest', () => {
    const files = parseSummaryMd('', 'src');
    expect(files).toEqual([]);
  });

  it('handles paths with subdirectories', () => {
    const markdown = `- [Types](types/README.md)\n- [Generics](types/generics.md)`;
    const files = parseSummaryMd(markdown, 'src');

    expect(files).toEqual(['src/types/README.md', 'src/types/generics.md']);
  });

  it('skips non-.md links', () => {
    const markdown = `- [Docs](https://example.com)\n- [File](file.md)`;
    const files = parseSummaryMd(markdown, 'src');

    expect(files).toEqual(['src/file.md']);
  });

  it('handles real Rust Reference SUMMARY.md format', () => {
    const markdown = `# The Rust Reference

[Introduction](introduction.md)

## Lexical structure

- [Input format](input-format.md)
- [Keywords](keywords.md)
  - [Reserved keywords](keywords/reserved.md)

## Items

- [Items](items.md)
  - [Modules](items/modules.md)
`;
    const files = parseSummaryMd(markdown, 'src');

    expect(files).toHaveLength(6);
    expect(files[0]).toBe('src/introduction.md');
    expect(files[5]).toBe('src/items/modules.md');
  });
});
