import { loadSources } from './source-loader.js';

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

// Lazy-loaded from data/sources.json
let _languages: LanguageConfig[] | null = null;
let _languageMap: Map<string, LanguageConfig> | null = null;

function ensureLoaded(): void {
  if (!_languages) {
    _languages = loadSources();
    _languageMap = new Map<string, LanguageConfig>();
    for (const lang of _languages) {
      _languageMap.set(lang.language, lang);
    }
  }
}

export function getLanguageConfig(language: string): LanguageConfig {
  ensureLoaded();
  const config = _languageMap!.get(language);
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
  ensureLoaded();
  return _languages!.map(l => l.language);
}

export function getAllLanguageConfigs(): LanguageConfig[] {
  ensureLoaded();
  return _languages!;
}
