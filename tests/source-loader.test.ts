import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSources } from '../src/config/source-loader.js';

const TMP_DIR = resolve(import.meta.dirname, '../.tmp-test-sources');

function writeTmpJson(filename: string, data: unknown): string {
  mkdirSync(TMP_DIR, { recursive: true });
  const path = resolve(TMP_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

function cleanup() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('loadSources', () => {
  it('loads the real data/sources.json and returns 5 languages', () => {
    const configs = loadSources();
    expect(configs).toHaveLength(5);
    const names = configs.map(c => c.language).sort();
    expect(names).toEqual(['go', 'java', 'rust', 'typescript', 'vitest']);
  });

  it('each language has correct displayName and at least 1 doc', () => {
    const configs = loadSources();
    for (const config of configs) {
      expect(config.displayName).toBeTruthy();
      expect(config.docs.length).toBeGreaterThan(0);
      for (const doc of config.docs) {
        expect(doc.doc).toBeTruthy();
        expect(doc.fetchStrategy).toBeTruthy();
        expect(doc.sourcePolicy).toBeTruthy();
      }
    }
  });

  it('Go config matches expected values', () => {
    const configs = loadSources();
    const go = configs.find(c => c.language === 'go')!;
    expect(go.docs[0].fetchStrategy).toBe('single-html');
    expect(go.docs[0].url).toBe('https://go.dev/ref/spec');
    expect(go.docs[0].sourcePolicy).toBe('excerpt_only');
  });

  it('Java config has RegExp chapterPattern', () => {
    const configs = loadSources();
    const java = configs.find(c => c.language === 'java')!;
    expect(java.docs[0].fetchStrategy).toBe('multi-html-toc');
    expect(java.docs[0].chapterPattern).toBeInstanceOf(RegExp);
    expect(java.docs[0].chapterPattern!.test('jls-4.html')).toBe(true);
  });

  it('Vitest config has excludePaths and empty urlSuffix', () => {
    const configs = loadSources();
    const vitest = configs.find(c => c.language === 'vitest')!;
    expect(vitest.docs[0].excludePaths).toEqual(['.vitepress', 'team', 'public']);
    expect(vitest.docs[0].urlSuffix).toBe('');
  });
});

describe('loadSources error handling', () => {
  afterEach(cleanup);

  it('throws on missing file', () => {
    expect(() => loadSources('/nonexistent/path.json')).toThrow('Failed to read sources file');
  });

  it('throws on invalid JSON', () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const path = resolve(TMP_DIR, 'bad.json');
    writeFileSync(path, '{ not valid json');
    expect(() => loadSources(path)).toThrow('Invalid JSON');
  });

  it('throws on validation error (missing required fields)', () => {
    const path = writeTmpJson('invalid.json', [{ name: 'test' }]);
    expect(() => loadSources(path)).toThrow('Validation error');
  });

  it('throws on duplicate source names', () => {
    const path = writeTmpJson('dupes.json', [
      { name: 'test', displayName: 'Test', url: 'https://example.com/a' },
      { name: 'test', displayName: 'Test2', url: 'https://example.com/b' },
    ]);
    expect(() => loadSources(path)).toThrow('Duplicate source name: "test"');
  });

  it('loads valid custom file', () => {
    const path = writeTmpJson('custom.json', [
      { name: 'mylib', displayName: 'MyLib', url: 'https://example.com/docs' },
    ]);
    const configs = loadSources(path);
    expect(configs).toHaveLength(1);
    expect(configs[0].language).toBe('mylib');
  });
});
