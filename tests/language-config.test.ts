import { describe, it, expect } from 'vitest';
import {
  getLanguageConfig,
  getDocConfig,
  getSupportedLanguages,
  getAllLanguageConfigs,
} from '../src/config/languages.js';

describe('LanguageConfig registry', () => {
  it('getSupportedLanguages returns all 4 languages', () => {
    const langs = getSupportedLanguages();
    expect(langs).toContain('go');
    expect(langs).toContain('java');
    expect(langs).toContain('rust');
    expect(langs).toContain('typescript');
    expect(langs).toHaveLength(4);
  });

  it('getLanguageConfig returns config for each language', () => {
    for (const lang of getSupportedLanguages()) {
      const config = getLanguageConfig(lang);
      expect(config.language).toBe(lang);
      expect(config.displayName).toBeTruthy();
      expect(config.docs.length).toBeGreaterThan(0);
    }
  });

  it('getLanguageConfig throws for unknown language', () => {
    expect(() => getLanguageConfig('cobol')).toThrow('Unknown language: cobol');
  });

  it('getDocConfig returns first doc by default', () => {
    const doc = getDocConfig('go');
    expect(doc.doc).toBe('go-spec');
    expect(doc.fetchStrategy).toBe('single-html');
  });

  it('getDocConfig returns specific doc by name', () => {
    const doc = getDocConfig('java', 'jls');
    expect(doc.doc).toBe('jls');
    expect(doc.fetchStrategy).toBe('multi-html-toc');
  });

  it('getDocConfig throws for unknown doc', () => {
    expect(() => getDocConfig('go', 'nonexistent')).toThrow("Unknown doc 'nonexistent'");
  });

  it('each doc has required fields', () => {
    for (const lang of getAllLanguageConfigs()) {
      for (const doc of lang.docs) {
        expect(doc.doc).toBeTruthy();
        expect(doc.displayName).toBeTruthy();
        expect(doc.fetchStrategy).toBeTruthy();
        expect(doc.sourcePolicy).toBeTruthy();
      }
    }
  });

  it('fetch strategy configs have correct fields', () => {
    const go = getDocConfig('go');
    expect(go.url).toBeTruthy();

    const java = getDocConfig('java');
    expect(java.indexUrl).toBeTruthy();

    const rust = getDocConfig('rust');
    expect(rust.githubOwner).toBe('rust-lang');
    expect(rust.githubRepo).toBe('reference');

    const ts = getDocConfig('typescript');
    expect(ts.githubOwner).toBe('microsoft');
    expect(ts.githubRepo).toBe('TypeScript-Website');
  });
});
