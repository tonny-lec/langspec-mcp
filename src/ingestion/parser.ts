import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import type { ParsedSection } from '../types.js';
import type { DocConfig } from '../config/languages.js';

function stableId(baseUrl: string, headingText: string, index: number): string {
  const input = `${baseUrl}|${headingText}|${index}`;
  return 'gen-' + createHash('sha256').update(input).digest('hex').substring(0, 12);
}

// ========================================
// HTML Parser
// ========================================

export function parseHtmlSpec(
  html: string,
  config: DocConfig,
  pageUrl?: string,
): ParsedSection[] {
  const $ = load(html);
  const sections: ParsedSection[] = [];
  const baseUrl = pageUrl ?? config.url ?? '';

  const selectorStr = config.headingSelectors ?? 'h2, h3, h4';
  const selectors = selectorStr.split(',').map(s => s.trim());

  // Build selector for with and without IDs
  const fullSelector = selectors
    .flatMap(s => [`${s}[id]`, `${s}:not([id])`])
    .join(', ');

  const pathStack: Array<{ level: number; title: string }> = [];
  const headings = $(fullSelector);

  headings.each((i, elem) => {
    const $heading = $(elem);
    const title = $heading.text().trim();
    const tagName = ('tagName' in elem ? elem.tagName : '').toLowerCase();
    const level = parseInt(tagName.substring(1), 10);

    const sectionId = $heading.attr('id') || stableId(baseUrl, title, i);

    while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
      pathStack.pop();
    }
    pathStack.push({ level, title });

    const sectionPath = pathStack.map(p => p.title).join(' > ');

    const contentParts: string[] = [];
    let $next = $heading.next();

    while ($next.length > 0) {
      const nextTag = $next[0]?.tagName?.toLowerCase();
      if (nextTag && selectors.some(s => nextTag === s.replace(/\[.*\]/, '').trim())) {
        break;
      }
      const text = $next.text().trim();
      if (text) contentParts.push(text);
      $next = $next.next();
    }

    sections.push({
      section_id: sectionId,
      title,
      section_path: sectionPath,
      content: contentParts.join('\n\n'),
      heading_level: level,
      pageUrl,
    });
  });

  const label = pageUrl ? pageUrl.split('/').pop() : 'HTML';
  console.error(`[Parser] Parsed ${sections.length} sections from ${label}`);
  return sections;
}

// ========================================
// Markdown Parser
// ========================================

interface FrontMatter {
  title?: string;
  permalink?: string;
}

function parseFrontMatter(content: string): { frontMatter: FrontMatter; body: string } {
  const normalized = content.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!fmMatch) return { frontMatter: {}, body: normalized };

  const fmBlock = fmMatch[1];
  const body = normalized.slice(fmMatch[0].length);
  const frontMatter: FrontMatter = {};

  for (const line of fmBlock.split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) {
      const [, key, value] = kv;
      const cleaned = value.replace(/^['"]|['"]$/g, '').trim();
      if (key === 'title') frontMatter.title = cleaned;
      if (key === 'permalink') frontMatter.permalink = cleaned;
    }
  }

  return { frontMatter, body };
}

function stripTwoslash(text: string): string {
  return text
    .replace(/\/\/\s*@\w+.*$/gm, '')   // // @errors: 2339, // @noErrors, etc.
    .replace(/\/\/\s*\^[\?\!].*$/gm, '') // // ^? hover queries
    .replace(/\n{3,}/g, '\n\n');         // collapse excess blank lines
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function parseMarkdownSpec(
  markdown: string,
  config: DocConfig,
  pageUrl?: string,
): ParsedSection[] {
  const { frontMatter, body } = parseFrontMatter(markdown);
  const cleaned = stripTwoslash(body);
  const lines = cleaned.replace(/\r\n/g, '\n').split('\n');

  const sections: ParsedSection[] = [];
  const pathStack: Array<{ level: number; title: string }> = [];
  let currentTitle = '';
  let currentLevel = 0;
  let currentId = '';
  let currentContent: string[] = [];
  let headingIndex = 0;

  const baseUrl = pageUrl ?? '';

  function flushSection() {
    if (!currentTitle) return;
    const content = currentContent.join('\n').trim();
    sections.push({
      section_id: currentId,
      title: currentTitle,
      section_path: pathStack.map(p => p.title).join(' > '),
      content,
      heading_level: currentLevel,
      pageUrl,
    });
  }

  let inFencedBlock = false;

  for (const line of lines) {
    // Track fenced code blocks (``` or ~~~) to avoid parsing headings inside them
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFencedBlock = !inFencedBlock;
      currentContent.push(line);
      continue;
    }

    const headingMatch = !inFencedBlock && line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushSection();

      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      // Extract explicit anchor {#id} if present
      const anchorMatch = title.match(/\{#([^}]+)\}\s*$/);
      let id: string;
      let cleanTitle: string;
      if (anchorMatch) {
        id = anchorMatch[1];
        cleanTitle = title.replace(/\s*\{#[^}]+\}\s*$/, '').trim();
      } else {
        id = slugify(title);
        cleanTitle = title;
      }

      while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
        pathStack.pop();
      }
      pathStack.push({ level, title: cleanTitle });

      currentTitle = cleanTitle;
      currentLevel = level;
      currentId = id || stableId(baseUrl, cleanTitle, headingIndex);
      currentContent = [];
      headingIndex++;
    } else {
      currentContent.push(line);
    }
  }

  flushSection();

  // If no headings found but frontmatter has title, create a single section
  if (sections.length === 0 && frontMatter.title) {
    const content = cleaned.trim();
    const id = frontMatter.permalink
      ? slugify(frontMatter.title)
      : stableId(baseUrl, frontMatter.title, 0);
    sections.push({
      section_id: id,
      title: frontMatter.title,
      section_path: frontMatter.title,
      content,
      heading_level: 1,
      pageUrl,
    });
  }

  const label = pageUrl ? pageUrl.split('/').pop() : 'Markdown';
  console.error(`[Parser] Parsed ${sections.length} sections from ${label}`);
  return sections;
}

// ========================================
// Unified Parser Entry
// ========================================

export function parseSpec(
  content: string,
  config: DocConfig,
  pageUrl?: string,
): ParsedSection[] {
  if (config.fetchStrategy === 'github-markdown') {
    return parseMarkdownSpec(content, config, pageUrl);
  }
  return parseHtmlSpec(content, config, pageUrl);
}

// Backward compatibility
export function parseGoSpec(html: string, baseUrl: string = ''): ParsedSection[] {
  return parseHtmlSpec(html, {
    doc: 'go-spec',
    displayName: 'Go Spec',
    fetchStrategy: 'single-html',
    url: baseUrl,
    headingSelectors: 'h2, h3, h4',
    sourcePolicy: 'excerpt_only',
  });
}
