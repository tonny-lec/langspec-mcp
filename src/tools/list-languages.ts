import type Database from 'better-sqlite3';
import { DatabaseQueries } from '../db/queries.js';
import type { LanguageInfo } from '../types.js';

const LANGUAGE_NOTES: Record<string, string> = {
  typescript: 'Handbookは完全な仕様書ではない（公式明記）',
};

const LANGUAGE_DISPLAY: Record<string, string> = {
  go: 'Go',
  java: 'Java',
  rust: 'Rust',
  typescript: 'TypeScript',
};

export function listLanguages(db: Database.Database): LanguageInfo[] {
  const queries = new DatabaseQueries(db);
  const available = queries.listAvailableLanguages();

  const langMap = new Map<string, Set<string>>();
  for (const { language, doc } of available) {
    if (!langMap.has(language)) langMap.set(language, new Set());
    langMap.get(language)!.add(doc);
  }

  const result: LanguageInfo[] = [];
  for (const [language, docs] of langMap) {
    result.push({
      language,
      docs: Array.from(docs).sort(),
      notes: LANGUAGE_NOTES[language],
    });
  }

  return result.sort((a, b) => a.language.localeCompare(b.language));
}
