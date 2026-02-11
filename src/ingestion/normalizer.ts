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
    pageUrlPrefix?: string;
    urlSuffix?: string;
  },
): NormalizedSection[] {
  const policy = meta.sourcePolicy ?? 'excerpt_only';

  return sections.map(s => {
    const fulltext = s.content;
    const excerpt = fulltext.length > EXCERPT_MAX_LENGTH
      ? fulltext.substring(0, EXCERPT_MAX_LENGTH) + '...'
      : fulltext;

    const canonicalUrl = buildCanonicalUrl(meta.baseUrl, s.section_id, s.pageUrl, meta.pageUrlPrefix, meta.urlSuffix);

    return {
      language: meta.language,
      doc: meta.doc,
      version: meta.version,
      section_id: s.section_id,
      title: s.title,
      section_path: s.section_path,
      canonical_url: canonicalUrl,
      excerpt,
      fulltext,
      content_hash: hashContent(fulltext),
      source_policy: policy,
    };
  });
}

function buildCanonicalUrl(baseUrl: string, sectionId: string, pageUrl?: string, pageUrlPrefix?: string, urlSuffix?: string): string {
  if (!pageUrl) {
    // Single-page: baseUrl#sectionId (Go)
    return `${baseUrl}#${sectionId}`;
  }

  // Multi-page HTML: pageUrl#sectionId (Java)
  if (pageUrl.startsWith('http')) {
    return `${pageUrl}#${sectionId}`;
  }

  // GitHub Markdown: derive canonical from baseUrl + page path
  // Strip known prefix (e.g., "src/" or "packages/documentation/copy/en/handbook-v2/")
  let pageName = pageUrl;
  if (pageUrlPrefix) {
    const prefix = pageUrlPrefix.endsWith('/') ? pageUrlPrefix : pageUrlPrefix + '/';
    if (pageName.startsWith(prefix)) {
      pageName = pageName.slice(prefix.length);
    }
  }
  pageName = pageName.replace(/\.md$/, '');

  const suffix = urlSuffix ?? '.html';
  return `${baseUrl}/${pageName}${suffix}#${sectionId}`;
}
