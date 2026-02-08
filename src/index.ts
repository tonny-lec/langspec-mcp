#!/usr/bin/env node

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { initializeDatabase } from './db/schema.js';
import { ingestSpec } from './ingestion/index.js';
import { startServer } from './server.js';
import { getSupportedLanguages } from './config/languages.js';
import { createLogger, setLogLevel, parseLogLevel } from './lib/logger.js';

setLogLevel(parseLogLevel(process.env.LOG_LEVEL));
const log = createLogger('CLI');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = resolve(__dirname, '../data');
const DB_PATH = resolve(DB_DIR, 'langspec.db');

const SUPPORTED_LANGUAGES = getSupportedLanguages();

function parseLanguageFlag(args: string[]): string {
  const idx = args.indexOf('--language');
  if (idx === -1) return 'go';
  const lang = args[idx + 1];
  if (!lang) {
    log.error('--language requires a value');
    process.exit(1);
  }
  return lang.toLowerCase();
}

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'ingest': {
      const language = parseLanguageFlag(process.argv.slice(3));

      if (language === 'all') {
        log.info('Ingesting all languages', { languages: SUPPORTED_LANGUAGES });
        mkdirSync(DB_DIR, { recursive: true });
        const db = initializeDatabase(DB_PATH);
        try {
          for (const lang of SUPPORTED_LANGUAGES) {
            await ingestSpec(db, lang);
          }
        } finally {
          db.close();
        }
        log.info('All languages ingested');
        break;
      }

      if (!SUPPORTED_LANGUAGES.includes(language)) {
        log.error('Unsupported language', { language, supported: SUPPORTED_LANGUAGES });
        process.exit(1);
      }

      log.info('Starting ingestion', { language });
      mkdirSync(DB_DIR, { recursive: true });
      const db = initializeDatabase(DB_PATH);
      try {
        await ingestSpec(db, language);
      } finally {
        db.close();
      }
      log.info('Done');
      break;
    }

    case 'serve': {
      mkdirSync(DB_DIR, { recursive: true });
      const db = initializeDatabase(DB_PATH);
      await startServer(db);
      // Server runs indefinitely via stdio
      break;
    }

    default: {
      log.error('Unknown command. Usage: langspec-mcp ingest [--language <lang>] | serve', {
        supported: SUPPORTED_LANGUAGES,
      });
      process.exit(1);
    }
  }
}

main().catch((error) => {
  log.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
