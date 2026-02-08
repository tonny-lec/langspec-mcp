import type { ParsedSection, NormalizedSection } from '../types.js';
import { hashContent, EXCERPT_MAX_LENGTH } from '../db/schema.js';

export function normalizeSections(
  sections: ParsedSection[],
  meta: {
    language: string;
    doc: string;
    version: string;
    baseUrl: string;
    sourcePolicy?: string;
  },
): NormalizedSection[] {
  const policy = meta.sourcePolicy ?? 'excerpt_only';

  return sections.map(s => {
    const fulltext = s.content;
    const excerpt = fulltext.length > EXCERPT_MAX_LENGTH
      ? fulltext.substring(0, EXCERPT_MAX_LENGTH) + '...'
      : fulltext;

    return {
      language: meta.language,
      doc: meta.doc,
      version: meta.version,
      section_id: s.section_id,
      title: s.title,
      section_path: s.section_path,
      canonical_url: `${meta.baseUrl}#${s.section_id}`,
      excerpt,
      fulltext,
      content_hash: hashContent(fulltext),
      source_policy: policy,
    };
  });
}
