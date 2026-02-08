import type Database from 'better-sqlite3';
import { DatabaseQueries } from '../db/queries.js';
import { getLanguageConfig } from '../config/languages.js';
import type { LanguageInfo } from '../types.js';

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
    const config = getLanguageConfig(language);
    const docConfig = config.docs[0];
    result.push({
      language,
      docs: Array.from(docs).sort(),
      notes: docConfig?.notes,
    });
  }

  return result.sort((a, b) => a.language.localeCompare(b.language));
}
