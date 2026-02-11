import { z } from 'zod';
import type { DocConfig, FetchStrategy, LanguageConfig } from './languages.js';

// ========================================
// DocSource — unified external config model
// ========================================

export interface DocSource {
  name: string;
  displayName: string;

  // Source (exactly one of url or github)
  url?: string;
  github?: string;  // "owner/repo"

  // Optional
  doc?: string;
  docDisplayName?: string;
  sourcePolicy?: 'excerpt_only' | 'local_fulltext_ok';
  headingSelectors?: string;
  notes?: string;

  // multi-html-toc
  chapterPattern?: string;  // string → new RegExp()

  // github-markdown
  path?: string;
  manifestFile?: string;
  excludePaths?: string[];

  // URL construction
  canonicalBaseUrl?: string;
  urlSuffix?: string;
}

// ========================================
// Zod schema with validation
// ========================================

const githubPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export const DocSourceSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),

  url: z.string().url().optional(),
  github: z.string().regex(githubPattern, 'Must be "owner/repo" format').optional(),

  doc: z.string().optional(),
  docDisplayName: z.string().optional(),
  sourcePolicy: z.enum(['excerpt_only', 'local_fulltext_ok']).optional(),
  headingSelectors: z.string().optional(),
  notes: z.string().optional(),

  chapterPattern: z.string().optional(),

  path: z.string().optional(),
  manifestFile: z.string().optional(),
  excludePaths: z.array(z.string()).optional(),

  canonicalBaseUrl: z.string().url().optional(),
  urlSuffix: z.string().optional(),
}).refine(
  (data) => (data.url != null) !== (data.github != null),
  { message: 'Exactly one of "url" or "github" must be provided' },
).refine(
  (data) => {
    if (data.chapterPattern) {
      try {
        new RegExp(data.chapterPattern);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  { message: 'chapterPattern must be a valid regular expression' },
);

// ========================================
// Strategy inference
// ========================================

function inferStrategy(source: DocSource): FetchStrategy {
  if (source.github) return 'github-markdown';
  if (source.url && source.chapterPattern) return 'multi-html-toc';
  return 'single-html';
}

// ========================================
// Resolver: DocSource → LanguageConfig entry
// ========================================

export function resolveDocSource(source: DocSource): { language: string; docConfig: DocConfig } {
  const strategy = inferStrategy(source);
  const docSlug = source.doc ?? `${source.name}-docs`;

  const docConfig: DocConfig = {
    doc: docSlug,
    displayName: source.docDisplayName ?? source.displayName,
    fetchStrategy: strategy,
    sourcePolicy: source.sourcePolicy ?? (strategy === 'github-markdown' ? 'local_fulltext_ok' : 'excerpt_only'),
    headingSelectors: source.headingSelectors ?? 'h2, h3, h4',
    notes: source.notes,
  };

  switch (strategy) {
    case 'single-html': {
      docConfig.url = source.url!;
      docConfig.canonicalBaseUrl = source.canonicalBaseUrl ?? source.url!;
      break;
    }
    case 'multi-html-toc': {
      docConfig.indexUrl = source.url!;
      docConfig.chapterPattern = new RegExp(source.chapterPattern!);
      // Derive canonicalBaseUrl: strip filename from URL
      const urlObj = new URL(source.url!);
      const pathParts = urlObj.pathname.split('/');
      pathParts.pop(); // remove filename (e.g., index.html)
      urlObj.pathname = pathParts.join('/');
      docConfig.canonicalBaseUrl = source.canonicalBaseUrl ?? urlObj.toString().replace(/\/$/, '');
      break;
    }
    case 'github-markdown': {
      const [owner, repo] = source.github!.split('/');
      docConfig.githubOwner = owner;
      docConfig.githubRepo = repo;
      docConfig.githubPath = source.path ?? '';
      if (source.manifestFile) docConfig.manifestFile = source.manifestFile;
      if (source.canonicalBaseUrl) docConfig.canonicalBaseUrl = source.canonicalBaseUrl;
      if (source.excludePaths) docConfig.excludePaths = source.excludePaths;
      if (source.urlSuffix !== undefined) docConfig.urlSuffix = source.urlSuffix;
      break;
    }
  }

  return {
    language: source.name,
    docConfig,
  };
}

// ========================================
// Group resolved sources into LanguageConfig[]
// ========================================

export function groupByLanguage(
  resolved: Array<{ language: string; docConfig: DocConfig }>,
  sources: DocSource[],
): LanguageConfig[] {
  const map = new Map<string, LanguageConfig>();

  for (let i = 0; i < resolved.length; i++) {
    const { language, docConfig } = resolved[i];
    const source = sources[i];
    let entry = map.get(language);
    if (!entry) {
      entry = {
        language,
        displayName: source.displayName,
        docs: [],
      };
      map.set(language, entry);
    }
    entry.docs.push(docConfig);
  }

  return Array.from(map.values());
}
