import { describe, it, expect } from 'vitest';
import { parseMarkdownSpec } from '../src/ingestion/parser.js';
import { normalizeSections } from '../src/ingestion/normalizer.js';
import { getDocConfig } from '../src/config/languages.js';

const tsConfig = getDocConfig('typescript');

describe('TypeScript Handbook ingestion', () => {
  it('strips YAML frontmatter and parses headings', () => {
    const md = `---\r\ntitle: "Basic Types"\r\npermalink: /docs/handbook/2/basic-types.html\r\n---\r\n\r\n## Static Type Checking\r\n\r\nTypeScript helps catch bugs.\r\n\r\n## Non-exception Failures\r\n\r\nMore content here.\r\n`;

    const sections = parseMarkdownSpec(md, tsConfig);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Static Type Checking');
    expect(sections[0].content).not.toContain('---');
    expect(sections[0].content).not.toContain('title:');
    expect(sections[1].title).toBe('Non-exception Failures');
  });

  it('handles \\r\\n line endings correctly', () => {
    const md = "## Class Members\r\n\r\nContent here.\r\n\r\n### Fields\r\n\r\nField content.\r\n";

    const sections = parseMarkdownSpec(md, tsConfig);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Class Members');
    expect(sections[1].title).toBe('Fields');
  });

  it('strips twoslash annotations from code blocks', () => {
    const md = `## Example\r\n\r\n\`\`\`ts twoslash\r\nconst x: number = 5;\r\n// @errors: 2339\r\nx.foo();\r\n// ^?\r\n\`\`\`\r\n`;

    const sections = parseMarkdownSpec(md, tsConfig);

    expect(sections).toHaveLength(1);
    expect(sections[0].content).not.toContain('@errors');
    expect(sections[0].content).not.toContain('^?');
    expect(sections[0].content).toContain('const x: number = 5;');
  });

  it('builds correct canonical URLs for TS Handbook', () => {
    const md = `## Defining Types\r\n\r\nContent\r\n`;

    const sections = parseMarkdownSpec(md, tsConfig, 'packages/documentation/copy/en/handbook-v2/Basics.md');
    const normalized = normalizeSections(sections, {
      language: 'typescript',
      doc: 'ts-handbook',
      version: 'snapshot-20260208',
      baseUrl: 'https://www.typescriptlang.org/docs/handbook/2',
      sourcePolicy: 'local_fulltext_ok',
      pageUrlPrefix: 'packages/documentation/copy/en/handbook-v2',
    });

    expect(normalized[0].canonical_url).toBe(
      'https://www.typescriptlang.org/docs/handbook/2/Basics.html#defining-types'
    );
    expect(normalized[0].source_policy).toBe('local_fulltext_ok');
  });

  it('creates section from frontmatter when no headings present', () => {
    const md = `---\r\ntitle: "Introduction"\r\npermalink: /docs/handbook/intro.html\r\n---\r\n\r\nWelcome to the TypeScript Handbook.\r\n`;

    const sections = parseMarkdownSpec(md, tsConfig);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Introduction');
    expect(sections[0].content).toContain('Welcome to the TypeScript Handbook.');
  });
});
