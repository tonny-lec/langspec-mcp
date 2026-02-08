import { z } from 'zod';

// ========================================
// Database Model Types
// ========================================

export interface Section {
  id: number;
  language: string;
  doc: string;
  version: string;
  section_id: string;
  title: string;
  section_path: string;
  canonical_url: string;
  excerpt: string;
  fulltext: string;
  content_hash: string;
  source_policy: string;
}

export interface Snapshot {
  id: number;
  language: string;
  doc: string;
  version: string;
  fetched_at: string;
  etag: string | null;
  source_url: string;
}

// ========================================
// Ingestion Pipeline Types
// ========================================

export interface ParsedSection {
  section_id: string;
  title: string;
  section_path: string;
  content: string;
  heading_level: number;
}

export interface FetchResult {
  html: string;
  etag: string | null;
  url: string;
}

export interface NormalizedSection {
  language: string;
  doc: string;
  version: string;
  section_id: string;
  title: string;
  section_path: string;
  canonical_url: string;
  excerpt: string;
  fulltext: string;
  content_hash: string;
  source_policy: string;
}

// ========================================
// MCP Tool Response Types
// ========================================

export interface Citation {
  language: string;
  doc: string;
  version: string;
  section_id: string;
  title: string;
  section_path: string;
  url: string;
  snippet: {
    text: string;
    start_char: number;
    end_char: number;
  };
  source_policy: string;
  score?: number;
}

export interface VersionInfo {
  version: string;
  fetched_at: string;
  source_url: string;
}

export interface LanguageInfo {
  language: string;
  docs: string[];
  notes?: string;
}

// ========================================
// MCP Tool Input Schemas (Zod)
// ========================================

const LanguageEnum = z.enum(['go', 'java', 'rust', 'typescript']);

export const ListLanguagesInputSchema = z.object({});

export const ListVersionsInputSchema = z.object({
  language: LanguageEnum,
});

export const SearchSpecInputSchema = z.object({
  query: z.string().min(1),
  language: LanguageEnum,
  version: z.string().optional(),
  filters: z.object({
    doc: z.string().optional(),
    section_path_prefix: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).optional(),
});

export const GetSectionInputSchema = z.object({
  language: LanguageEnum,
  version: z.string(),
  section_id: z.string().min(1),
});
