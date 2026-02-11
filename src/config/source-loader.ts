import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DocSourceSchema, resolveDocSource, groupByLanguage } from './doc-source.js';
import type { LanguageConfig } from './languages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCES_PATH = resolve(__dirname, '../../data/sources.json');

const DocSourceArraySchema = z.array(DocSourceSchema);

export function loadSources(filePath?: string): LanguageConfig[] {
  const sourcesPath = filePath ?? DEFAULT_SOURCES_PATH;

  let raw: string;
  try {
    raw = readFileSync(sourcesPath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read sources file: ${sourcesPath}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in sources file: ${sourcesPath}: ${(err as Error).message}`);
  }

  const result = DocSourceArraySchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Validation error in sources file:\n${issues}`);
  }

  const sources = result.data;

  // Check for duplicate names
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.name)) {
      throw new Error(`Duplicate source name: "${source.name}" in ${sourcesPath}`);
    }
    seen.add(source.name);
  }

  const resolved = sources.map(s => resolveDocSource(s));
  return groupByLanguage(resolved, sources);
}
