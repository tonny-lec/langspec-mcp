import { describe, it, expect } from 'vitest';
import { parseGoSpec, parseHtmlSpec, parseMarkdownSpec, parseSpec } from '../src/ingestion/parser.js';
import type { DocConfig } from '../src/config/languages.js';

// ========================================
// Existing Go HTML Parser Tests
// ========================================

describe('parseGoSpec', () => {
  it('parses h2 + h3 hierarchy with correct paths', () => {
    const html = `
      <h2 id="Types">Types</h2>
      <p>Type content here</p>
      <h3 id="Int">Int</h3>
      <p>Int content here</p>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(2);
    expect(sections[0].section_id).toBe('Types');
    expect(sections[0].title).toBe('Types');
    expect(sections[0].section_path).toBe('Types');
    expect(sections[0].content).toBe('Type content here');

    expect(sections[1].section_id).toBe('Int');
    expect(sections[1].title).toBe('Int');
    expect(sections[1].section_path).toBe('Types > Int');
    expect(sections[1].content).toBe('Int content here');
  });

  it('generates stableId with gen- prefix for headings without id', () => {
    const html = '<h2>No ID Heading</h2><p>Some content</p>';

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(1);
    expect(sections[0].section_id).toMatch(/^gen-[a-f0-9]{12}$/);
    expect(sections[0].title).toBe('No ID Heading');
  });

  it('handles deep h2 > h3 > h4 nesting', () => {
    const html = `
      <h2 id="A">A</h2>
      <p>A content</p>
      <h3 id="B">B</h3>
      <p>B content</p>
      <h4 id="C">C</h4>
      <p>C content</p>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(3);
    expect(sections[0].section_path).toBe('A');
    expect(sections[0].heading_level).toBe(2);
    expect(sections[1].section_path).toBe('A > B');
    expect(sections[1].heading_level).toBe(3);
    expect(sections[2].section_path).toBe('A > B > C');
    expect(sections[2].heading_level).toBe(4);
  });

  it('extracts text between headings joining with double newline', () => {
    const html = `
      <h2 id="A">A</h2>
      <p>text1</p>
      <p>text2</p>
      <h2 id="B">B</h2>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(2);
    expect(sections[0].content).toBe('text1\n\ntext2');
  });

  it('returns empty content for heading with no following text', () => {
    const html = `
      <h2 id="Empty">Empty</h2>
      <h2 id="Next">Next</h2>
      <p>Next content</p>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(2);
    expect(sections[0].section_id).toBe('Empty');
    expect(sections[0].content).toBe('');
    expect(sections[1].content).toBe('Next content');
  });
});

// ========================================
// HTML Parser with Config
// ========================================

describe('parseHtmlSpec', () => {
  const jlsConfig: DocConfig = {
    doc: 'jls',
    displayName: 'JLS',
    fetchStrategy: 'multi-html-toc',
    headingSelectors: 'h2, h3, h4',
    sourcePolicy: 'excerpt_only',
  };

  it('parses JLS-style HTML with id attributes', () => {
    const html = `
      <h2 id="jls-4">Chapter 4. Types, Values, and Variables</h2>
      <p>Overview text</p>
      <h3 id="jls-4.1">4.1. The Kinds of Types and Values</h3>
      <p>Type kinds content</p>
      <h4 id="jls-4.2.1">4.2.1. Integral Types and Values</h4>
      <p>Integral types content</p>
    `;

    const sections = parseHtmlSpec(html, jlsConfig, 'https://example.com/jls-4.html');

    expect(sections).toHaveLength(3);
    expect(sections[0].section_id).toBe('jls-4');
    expect(sections[1].section_id).toBe('jls-4.1');
    expect(sections[2].section_id).toBe('jls-4.2.1');
    expect(sections[2].section_path).toContain(' > ');
    expect(sections[0].pageUrl).toBe('https://example.com/jls-4.html');
  });

  it('sets pageUrl on all sections', () => {
    const html = '<h2 id="test">Test</h2><p>Content</p>';
    const sections = parseHtmlSpec(html, jlsConfig, 'https://example.com/jls-1.html');

    expect(sections[0].pageUrl).toBe('https://example.com/jls-1.html');
  });
});

// ========================================
// Markdown Parser
// ========================================

describe('parseMarkdownSpec', () => {
  const rustConfig: DocConfig = {
    doc: 'rust-reference',
    displayName: 'Rust Reference',
    fetchStrategy: 'github-markdown',
    sourcePolicy: 'local_fulltext_ok',
  };

  const tsConfig: DocConfig = {
    doc: 'ts-handbook',
    displayName: 'TypeScript Handbook',
    fetchStrategy: 'github-markdown',
    sourcePolicy: 'local_fulltext_ok',
  };

  it('parses markdown headings into sections', () => {
    const md = `## Types

Type content here.

### Boolean Type

Boolean content here.
`;

    const sections = parseMarkdownSpec(md, rustConfig);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Types');
    expect(sections[0].section_id).toBe('types');
    expect(sections[0].content).toBe('Type content here.');
    expect(sections[1].title).toBe('Boolean Type');
    expect(sections[1].section_id).toBe('boolean-type');
    expect(sections[1].section_path).toBe('Types > Boolean Type');
  });

  it('handles explicit anchor {#id} syntax', () => {
    const md = `## Traits {#traits}\n\nTrait content\n`;

    const sections = parseMarkdownSpec(md, rustConfig);

    expect(sections).toHaveLength(1);
    expect(sections[0].section_id).toBe('traits');
    expect(sections[0].title).toBe('Traits');
  });

  it('strips YAML frontmatter', () => {
    const md = `---
title: "Basic Types"
permalink: /docs/handbook/2/basic-types.html
---

## Static Type Checking

Static type checking content.
`;

    const sections = parseMarkdownSpec(md, tsConfig);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Static Type Checking');
    expect(sections[0].content).not.toContain('---');
    expect(sections[0].content).not.toContain('title:');
  });

  it('strips twoslash annotations', () => {
    const md = `## Examples

\`\`\`ts
const x: number = 5;
// @errors: 2339
x.foo();
// ^?
\`\`\`
`;

    const sections = parseMarkdownSpec(md, tsConfig);

    expect(sections).toHaveLength(1);
    expect(sections[0].content).not.toContain('@errors');
    expect(sections[0].content).not.toContain('^?');
  });

  it('handles h1-h4 nesting in markdown', () => {
    const md = `# Top Level

## Section A

Content A.

### Sub Section B

Content B.

## Section C

Content C.
`;

    const sections = parseMarkdownSpec(md, rustConfig);

    expect(sections).toHaveLength(4);
    expect(sections[0].title).toBe('Top Level');
    expect(sections[0].section_path).toBe('Top Level');
    expect(sections[1].section_path).toBe('Top Level > Section A');
    expect(sections[2].section_path).toBe('Top Level > Section A > Sub Section B');
    expect(sections[3].section_path).toBe('Top Level > Section C');
  });

  it('creates single section from frontmatter when no headings', () => {
    const md = `---
title: "Introduction"
permalink: /docs/handbook/intro.html
---

This is the introduction to TypeScript.
`;

    const sections = parseMarkdownSpec(md, tsConfig);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Introduction');
    expect(sections[0].content).toContain('This is the introduction');
  });

  it('sets pageUrl on markdown sections', () => {
    const md = `## Test\n\nContent`;
    const sections = parseMarkdownSpec(md, rustConfig, 'src/types.md');

    expect(sections[0].pageUrl).toBe('src/types.md');
  });

  it('skips headings inside fenced code blocks', () => {
    const md = [
      '## Real Heading',
      '',
      'Some content.',
      '',
      '```rust',
      '# fn main() {',
      '#     println!("hidden");',
      '# }',
      '```',
      '',
      '## Another Heading',
      '',
      'More content.',
    ].join('\n');

    const sections = parseMarkdownSpec(md, rustConfig);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Real Heading');
    expect(sections[0].content).toContain('# fn main()');
    expect(sections[1].title).toBe('Another Heading');
  });

  it('skips headings inside tilde fenced code blocks', () => {
    const md = [
      '## Heading',
      '',
      '~~~',
      '# not a heading',
      '## also not a heading',
      '~~~',
      '',
      'After fence.',
    ].join('\n');

    const sections = parseMarkdownSpec(md, rustConfig);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Heading');
    expect(sections[0].content).toContain('# not a heading');
  });
});

// ========================================
// Unified parseSpec
// ========================================

describe('parseSpec', () => {
  it('routes to HTML parser for single-html strategy', () => {
    const config: DocConfig = {
      doc: 'go-spec',
      displayName: 'Go Spec',
      fetchStrategy: 'single-html',
      url: 'https://go.dev/ref/spec',
      headingSelectors: 'h2, h3, h4',
      sourcePolicy: 'excerpt_only',
    };

    const html = '<h2 id="Types">Types</h2><p>Content</p>';
    const sections = parseSpec(html, config);

    expect(sections).toHaveLength(1);
    expect(sections[0].section_id).toBe('Types');
  });

  it('routes to Markdown parser for github-markdown strategy', () => {
    const config: DocConfig = {
      doc: 'rust-reference',
      displayName: 'Rust Reference',
      fetchStrategy: 'github-markdown',
      sourcePolicy: 'local_fulltext_ok',
    };

    const md = `## Types\n\nContent here`;
    const sections = parseSpec(md, config);

    expect(sections).toHaveLength(1);
    expect(sections[0].section_id).toBe('types');
  });
});
