#!/usr/bin/env node

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { initializeDatabase } from './db/schema.js';
import { ingestSpec } from './ingestion/index.js';
import { startServer } from './server.js';
import { getSupportedLanguages } from './config/languages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = resolve(__dirname, '../data');
const DB_PATH = resolve(DB_DIR, 'langspec.db');

const SUPPORTED_LANGUAGES = getSupportedLanguages();

function parseLanguageFlag(args: string[]): string {
  const idx = args.indexOf('--language');
  if (idx === -1) return 'go';
  const lang = args[idx + 1];
  if (!lang) {
    console.error("Error: --language requires a value");
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
        console.error(`[CLI] Ingesting all languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
        mkdirSync(DB_DIR, { recursive: true });
        const db = initializeDatabase(DB_PATH);
        try {
          for (const lang of SUPPORTED_LANGUAGES) {
            await ingestSpec(db, lang);
          }
        } finally {
          db.close();
        }
        console.error('[CLI] All languages ingested');
        break;
      }

      if (!SUPPORTED_LANGUAGES.includes(language)) {
        console.error(`Error: Language '${language}' not yet supported.`);
        console.error(`Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}, all`);
        process.exit(1);
      }

      console.error(`[CLI] Starting ingestion for language: ${language}`);
      mkdirSync(DB_DIR, { recursive: true });
      const db = initializeDatabase(DB_PATH);
      try {
        await ingestSpec(db, language);
      } finally {
        db.close();
      }
      console.error('[CLI] Done');
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
      console.error('Usage:');
      console.error('  langspec-mcp ingest [--language <lang>]  - Fetch and index spec (default: go)');
      console.error('  langspec-mcp serve                       - Start MCP server (stdio)');
      console.error('');
      console.error(`Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}, all`);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
