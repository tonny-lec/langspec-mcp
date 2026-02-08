import type Database from 'better-sqlite3';
import { DatabaseQueries } from '../db/queries.js';
import type { VersionInfo } from '../types.js';

export function listVersions(db: Database.Database, language: string): VersionInfo[] {
  const queries = new DatabaseQueries(db);
  return queries.listVersions(language);
}
