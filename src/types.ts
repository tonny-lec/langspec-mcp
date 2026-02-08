import { z } from 'zod';
import { getSupportedLanguages } from './config/languages.js';

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
  pageUrl?: string;
}

export interface FetchResult {
  html: string;
  etag: string | null;
  url: string;
  pageUrl?: string;
  status: number;
}

export interface FetchError {
  url: string;
  error: string;
}

export interface FetchOutcome {
  results: FetchResult[];
  errors: FetchError[];
  summary: {
    total: number;
    fetched: number;
    cached: number;
    failed: number;
  };
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

const supportedLanguages = getSupportedLanguages();
const LanguageEnum = z.enum(supportedLanguages as [string, ...string[]]);

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

export const BuildLearningPlanInputSchema = z.object({
  language: LanguageEnum,
  version: z.string().optional(),
  total_weeks: z.number().int().min(1).max(12).optional(),
  focus_areas: z.array(z.string()).optional(),
});

// ========================================
// Learning Plan Types
// ========================================

export interface LearningPlan {
  language: string;
  version: string;
  total_weeks: number;
  total_sections: number;
  weeks: WeekPlan[];
}

export interface WeekPlan {
  week: number;
  theme: string;
  sections: LearningPlanSection[];
  estimated_minutes: number;
}

export interface LearningPlanSection {
  section_id: string;
  title: string;
  section_path: string;
  url: string;
  depth: number;
  content_length: number;
}
