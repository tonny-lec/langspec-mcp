export type FetchStrategy = 'single-html' | 'multi-html-toc' | 'github-markdown';

export interface DocConfig {
  doc: string;
  displayName: string;
  fetchStrategy: FetchStrategy;
  sourcePolicy: 'excerpt_only' | 'local_fulltext_ok';
  headingSelectors?: string;
  notes?: string;

  // single-html / multi-html-toc
  url?: string;
  indexUrl?: string;
  chapterPattern?: RegExp;

  // github-markdown
  githubOwner?: string;
  githubRepo?: string;
  githubPath?: string;
  manifestFile?: string;
  canonicalBaseUrl?: string;
  excludePaths?: string[];
  urlSuffix?: string;
}

export interface LanguageConfig {
  language: string;
  displayName: string;
  docs: DocConfig[];
}

const LANGUAGES: LanguageConfig[] = [
  {
    language: 'go',
    displayName: 'Go',
    docs: [
      {
        doc: 'go-spec',
        displayName: 'The Go Programming Language Specification',
        fetchStrategy: 'single-html',
        url: 'https://go.dev/ref/spec',
        headingSelectors: 'h2, h3, h4',
        sourcePolicy: 'excerpt_only',
        canonicalBaseUrl: 'https://go.dev/ref/spec',
      },
    ],
  },
  {
    language: 'java',
    displayName: 'Java',
    docs: [
      {
        doc: 'jls',
        displayName: 'The Java Language Specification (SE21)',
        fetchStrategy: 'multi-html-toc',
        indexUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html/index.html',
        headingSelectors: 'h2, h3, h4',
        sourcePolicy: 'excerpt_only',
        canonicalBaseUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html',
        chapterPattern: /^jls-\d+\.html$/,
        notes: 'Oracle著作権のためexcerpt_only',
      },
    ],
  },
  {
    language: 'rust',
    displayName: 'Rust',
    docs: [
      {
        doc: 'rust-reference',
        displayName: 'The Rust Reference',
        fetchStrategy: 'github-markdown',
        githubOwner: 'rust-lang',
        githubRepo: 'reference',
        githubPath: 'src',
        manifestFile: 'SUMMARY.md',
        sourcePolicy: 'local_fulltext_ok',
        canonicalBaseUrl: 'https://doc.rust-lang.org/reference',
      },
    ],
  },
  {
    language: 'typescript',
    displayName: 'TypeScript',
    docs: [
      {
        doc: 'ts-handbook',
        displayName: 'TypeScript Handbook',
        fetchStrategy: 'github-markdown',
        githubOwner: 'microsoft',
        githubRepo: 'TypeScript-Website',
        githubPath: 'packages/documentation/copy/en/handbook-v2',
        sourcePolicy: 'local_fulltext_ok',
        notes: 'Handbookは完全な仕様書ではない（公式明記）',
      },
    ],
  },
  {
    language: 'vitest',
    displayName: 'Vitest',
    docs: [
      {
        doc: 'vitest-docs',
        displayName: 'Vitest Documentation',
        fetchStrategy: 'github-markdown',
        githubOwner: 'vitest-dev',
        githubRepo: 'vitest',
        githubPath: 'docs',
        sourcePolicy: 'local_fulltext_ok',
        canonicalBaseUrl: 'https://vitest.dev',
        excludePaths: ['.vitepress', 'team', 'public'],
        urlSuffix: '',
      },
    ],
  },
];

const languageMap = new Map<string, LanguageConfig>();
for (const lang of LANGUAGES) {
  languageMap.set(lang.language, lang);
}

export function getLanguageConfig(language: string): LanguageConfig {
  const config = languageMap.get(language);
  if (!config) {
    throw new Error(`Unknown language: ${language}. Supported: ${getSupportedLanguages().join(', ')}`);
  }
  return config;
}

export function getDocConfig(language: string, doc?: string): DocConfig {
  const langConfig = getLanguageConfig(language);
  if (doc) {
    const docConfig = langConfig.docs.find(d => d.doc === doc);
    if (!docConfig) {
      throw new Error(`Unknown doc '${doc}' for language '${language}'`);
    }
    return docConfig;
  }
  return langConfig.docs[0];
}

export function getSupportedLanguages(): string[] {
  return LANGUAGES.map(l => l.language);
}

export function getAllLanguageConfigs(): LanguageConfig[] {
  return LANGUAGES;
}
