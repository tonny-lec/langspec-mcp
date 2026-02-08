import { load } from 'cheerio';
import type { ParsedSection } from '../types.js';

export function parseGoSpec(html: string): ParsedSection[] {
  const $ = load(html);
  const sections: ParsedSection[] = [];

  // Track heading hierarchy for section_path
  const pathStack: Array<{ level: number; title: string }> = [];

  // Collect all headings with IDs
  const headings = $('h2[id], h3[id], h4[id]');

  headings.each((_i, elem) => {
    const $heading = $(elem);
    const sectionId = $heading.attr('id');
    if (!sectionId) return;

    const title = $heading.text().trim();
    const tagName = elem.tagName.toLowerCase();
    const level = parseInt(tagName.substring(1), 10);

    // Update path stack: pop entries at same or deeper level
    while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
      pathStack.pop();
    }
    pathStack.push({ level, title });

    const sectionPath = pathStack.map(p => p.title).join(' > ');

    // Extract text content until next heading of same or higher level
    const contentParts: string[] = [];
    let $next = $heading.next();

    while ($next.length > 0) {
      const nextTag = $next[0]?.tagName?.toLowerCase();

      // Stop at next heading
      if (nextTag === 'h2' || nextTag === 'h3' || nextTag === 'h4') {
        break;
      }

      const text = $next.text().trim();
      if (text) {
        contentParts.push(text);
      }

      $next = $next.next();
    }

    const content = contentParts.join('\n\n');

    sections.push({
      section_id: sectionId,
      title,
      section_path: sectionPath,
      content,
      heading_level: level,
    });
  });

  console.error(`[Parser] Parsed ${sections.length} sections from Go spec`);
  return sections;
}
