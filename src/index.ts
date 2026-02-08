#!/usr/bin/env node

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { initializeDatabase } from './db/schema.js';
import { ingestGoSpec } from './ingestion/index.js';
import { startServer } from './server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = resolve(__dirname, '../data');
const DB_PATH = resolve(DB_DIR, 'langspec.db');

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'ingest': {
      console.error('[CLI] Starting ingestion...');
      mkdirSync(DB_DIR, { recursive: true });
      const db = initializeDatabase(DB_PATH);
      try {
        await ingestGoSpec(db);
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
      console.error('  langspec-mcp ingest   - Fetch and index Go specification');
      console.error('  langspec-mcp serve    - Start MCP server (stdio)');
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
