import { describe, it, expect } from 'vitest';
import { DocSourceSchema, resolveDocSource, groupByLanguage } from '../src/config/doc-source.js';
import type { DocSource } from '../src/config/doc-source.js';

// ========================================
// Strategy auto-inference
// ========================================

describe('strategy auto-inference', () => {
  it('github → github-markdown', () => {
    const source: DocSource = {
      name: 'test',
      displayName: 'Test',
      github: 'owner/repo',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.fetchStrategy).toBe('github-markdown');
  });

  it('url + chapterPattern → multi-html-toc', () => {
    const source: DocSource = {
      name: 'test',
      displayName: 'Test',
      url: 'https://example.com/docs/index.html',
      chapterPattern: '^ch-\\d+\\.html$',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.fetchStrategy).toBe('multi-html-toc');
  });

  it('url only → single-html', () => {
    const source: DocSource = {
      name: 'test',
      displayName: 'Test',
      url: 'https://example.com/spec',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.fetchStrategy).toBe('single-html');
  });
});

// ========================================
// Existing 5 sources resolve correctly
// ========================================

describe('existing sources resolve correctly', () => {
  it('Go → single-html with correct fields', () => {
    const source: DocSource = {
      name: 'go',
      displayName: 'Go',
      doc: 'go-spec',
      docDisplayName: 'The Go Programming Language Specification',
      url: 'https://go.dev/ref/spec',
      sourcePolicy: 'excerpt_only',
    };
    const { language, docConfig } = resolveDocSource(source);
    expect(language).toBe('go');
    expect(docConfig.fetchStrategy).toBe('single-html');
    expect(docConfig.doc).toBe('go-spec');
    expect(docConfig.displayName).toBe('The Go Programming Language Specification');
    expect(docConfig.url).toBe('https://go.dev/ref/spec');
    expect(docConfig.sourcePolicy).toBe('excerpt_only');
    expect(docConfig.canonicalBaseUrl).toBe('https://go.dev/ref/spec');
    expect(docConfig.headingSelectors).toBe('h2, h3, h4');
  });

  it('Java → multi-html-toc with chapterPattern as RegExp', () => {
    const source: DocSource = {
      name: 'java',
      displayName: 'Java',
      doc: 'jls',
      docDisplayName: 'The Java Language Specification (SE21)',
      url: 'https://docs.oracle.com/javase/specs/jls/se21/html/index.html',
      chapterPattern: '^jls-\\d+\\.html$',
      sourcePolicy: 'excerpt_only',
      notes: 'Oracle著作権のためexcerpt_only',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.fetchStrategy).toBe('multi-html-toc');
    expect(docConfig.indexUrl).toBe('https://docs.oracle.com/javase/specs/jls/se21/html/index.html');
    expect(docConfig.chapterPattern).toBeInstanceOf(RegExp);
    expect(docConfig.chapterPattern!.test('jls-4.html')).toBe(true);
    expect(docConfig.chapterPattern!.test('index.html')).toBe(false);
    expect(docConfig.canonicalBaseUrl).toBe('https://docs.oracle.com/javase/specs/jls/se21/html');
    expect(docConfig.notes).toBe('Oracle著作権のためexcerpt_only');
  });

  it('Rust → github-markdown with manifest', () => {
    const source: DocSource = {
      name: 'rust',
      displayName: 'Rust',
      doc: 'rust-reference',
      docDisplayName: 'The Rust Reference',
      github: 'rust-lang/reference',
      path: 'src',
      manifestFile: 'SUMMARY.md',
      canonicalBaseUrl: 'https://doc.rust-lang.org/reference',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.fetchStrategy).toBe('github-markdown');
    expect(docConfig.githubOwner).toBe('rust-lang');
    expect(docConfig.githubRepo).toBe('reference');
    expect(docConfig.githubPath).toBe('src');
    expect(docConfig.manifestFile).toBe('SUMMARY.md');
    expect(docConfig.sourcePolicy).toBe('local_fulltext_ok');
    expect(docConfig.canonicalBaseUrl).toBe('https://doc.rust-lang.org/reference');
  });

  it('TypeScript → github-markdown without manifest', () => {
    const source: DocSource = {
      name: 'typescript',
      displayName: 'TypeScript',
      doc: 'ts-handbook',
      docDisplayName: 'TypeScript Handbook',
      github: 'microsoft/TypeScript-Website',
      path: 'packages/documentation/copy/en/handbook-v2',
      notes: 'Handbookは完全な仕様書ではない（公式明記）',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.fetchStrategy).toBe('github-markdown');
    expect(docConfig.githubOwner).toBe('microsoft');
    expect(docConfig.githubRepo).toBe('TypeScript-Website');
    expect(docConfig.githubPath).toBe('packages/documentation/copy/en/handbook-v2');
    expect(docConfig.sourcePolicy).toBe('local_fulltext_ok');
    expect(docConfig.manifestFile).toBeUndefined();
    expect(docConfig.notes).toBe('Handbookは完全な仕様書ではない（公式明記）');
  });

  it('Vitest → github-markdown with excludePaths and urlSuffix', () => {
    const source: DocSource = {
      name: 'vitest',
      displayName: 'Vitest',
      doc: 'vitest-docs',
      docDisplayName: 'Vitest Documentation',
      github: 'vitest-dev/vitest',
      path: 'docs',
      excludePaths: ['.vitepress', 'team', 'public'],
      canonicalBaseUrl: 'https://vitest.dev',
      urlSuffix: '',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.fetchStrategy).toBe('github-markdown');
    expect(docConfig.githubOwner).toBe('vitest-dev');
    expect(docConfig.githubRepo).toBe('vitest');
    expect(docConfig.githubPath).toBe('docs');
    expect(docConfig.excludePaths).toEqual(['.vitepress', 'team', 'public']);
    expect(docConfig.canonicalBaseUrl).toBe('https://vitest.dev');
    expect(docConfig.urlSuffix).toBe('');
    expect(docConfig.sourcePolicy).toBe('local_fulltext_ok');
  });
});

// ========================================
// Default values
// ========================================

describe('default values', () => {
  it('doc defaults to name + "-docs"', () => {
    const source: DocSource = { name: 'mylib', displayName: 'MyLib', url: 'https://example.com/docs' };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.doc).toBe('mylib-docs');
  });

  it('sourcePolicy defaults to excerpt_only for url-based', () => {
    const source: DocSource = { name: 'test', displayName: 'Test', url: 'https://example.com/spec' };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.sourcePolicy).toBe('excerpt_only');
  });

  it('sourcePolicy defaults to local_fulltext_ok for github-based', () => {
    const source: DocSource = { name: 'test', displayName: 'Test', github: 'owner/repo' };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.sourcePolicy).toBe('local_fulltext_ok');
  });

  it('headingSelectors defaults to "h2, h3, h4"', () => {
    const source: DocSource = { name: 'test', displayName: 'Test', url: 'https://example.com/spec' };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.headingSelectors).toBe('h2, h3, h4');
  });

  it('githubPath defaults to empty string', () => {
    const source: DocSource = { name: 'test', displayName: 'Test', github: 'owner/repo' };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.githubPath).toBe('');
  });

  it('canonicalBaseUrl defaults to url for single-html', () => {
    const source: DocSource = { name: 'test', displayName: 'Test', url: 'https://example.com/spec' };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.canonicalBaseUrl).toBe('https://example.com/spec');
  });

  it('canonicalBaseUrl auto-derives directory for multi-html-toc', () => {
    const source: DocSource = {
      name: 'test',
      displayName: 'Test',
      url: 'https://example.com/docs/v1/index.html',
      chapterPattern: '^ch\\d+\\.html$',
    };
    const { docConfig } = resolveDocSource(source);
    expect(docConfig.canonicalBaseUrl).toBe('https://example.com/docs/v1');
  });
});

// ========================================
// Zod validation
// ========================================

describe('DocSourceSchema validation', () => {
  it('accepts valid github source', () => {
    const result = DocSourceSchema.safeParse({
      name: 'test', displayName: 'Test', github: 'owner/repo',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid url source', () => {
    const result = DocSourceSchema.safeParse({
      name: 'test', displayName: 'Test', url: 'https://example.com/spec',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when neither url nor github', () => {
    const result = DocSourceSchema.safeParse({
      name: 'test', displayName: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when both url and github', () => {
    const result = DocSourceSchema.safeParse({
      name: 'test', displayName: 'Test',
      url: 'https://example.com', github: 'owner/repo',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid github format', () => {
    const result = DocSourceSchema.safeParse({
      name: 'test', displayName: 'Test', github: 'no-slash',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid regex in chapterPattern', () => {
    const result = DocSourceSchema.safeParse({
      name: 'test', displayName: 'Test',
      url: 'https://example.com/spec',
      chapterPattern: '[invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = DocSourceSchema.safeParse({
      name: '', displayName: 'Test', url: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });
});

// ========================================
// groupByLanguage
// ========================================

describe('groupByLanguage', () => {
  it('groups multiple docs under same language', () => {
    const sources: DocSource[] = [
      { name: 'go', displayName: 'Go', url: 'https://go.dev/spec', doc: 'go-spec' },
      { name: 'go', displayName: 'Go', url: 'https://go.dev/blog', doc: 'go-blog' },
    ];
    const resolved = sources.map(s => resolveDocSource(s));
    const configs = groupByLanguage(resolved, sources);
    expect(configs).toHaveLength(1);
    expect(configs[0].language).toBe('go');
    expect(configs[0].docs).toHaveLength(2);
  });

  it('keeps different languages separate', () => {
    const sources: DocSource[] = [
      { name: 'go', displayName: 'Go', url: 'https://go.dev/spec' },
      { name: 'rust', displayName: 'Rust', github: 'rust-lang/reference' },
    ];
    const resolved = sources.map(s => resolveDocSource(s));
    const configs = groupByLanguage(resolved, sources);
    expect(configs).toHaveLength(2);
  });
});
