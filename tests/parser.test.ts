import { describe, it, expect } from 'vitest';
import { parseGoSpec } from '../src/ingestion/parser.js';

describe('parseGoSpec', () => {
  it('parses h2 + h3 hierarchy with correct paths', () => {
    const html = `
      <h2 id="Types">Types</h2>
      <p>Type content here</p>
      <h3 id="Int">Int</h3>
      <p>Int content here</p>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(2);
    expect(sections[0].section_id).toBe('Types');
    expect(sections[0].title).toBe('Types');
    expect(sections[0].section_path).toBe('Types');
    expect(sections[0].content).toBe('Type content here');

    expect(sections[1].section_id).toBe('Int');
    expect(sections[1].title).toBe('Int');
    expect(sections[1].section_path).toBe('Types > Int');
    expect(sections[1].content).toBe('Int content here');
  });

  it('generates stableId with gen- prefix for headings without id', () => {
    const html = '<h2>No ID Heading</h2><p>Some content</p>';

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(1);
    expect(sections[0].section_id).toMatch(/^gen-[a-f0-9]{12}$/);
    expect(sections[0].title).toBe('No ID Heading');
  });

  it('handles deep h2 > h3 > h4 nesting', () => {
    const html = `
      <h2 id="A">A</h2>
      <p>A content</p>
      <h3 id="B">B</h3>
      <p>B content</p>
      <h4 id="C">C</h4>
      <p>C content</p>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(3);
    expect(sections[0].section_path).toBe('A');
    expect(sections[0].heading_level).toBe(2);
    expect(sections[1].section_path).toBe('A > B');
    expect(sections[1].heading_level).toBe(3);
    expect(sections[2].section_path).toBe('A > B > C');
    expect(sections[2].heading_level).toBe(4);
  });

  it('extracts text between headings joining with double newline', () => {
    const html = `
      <h2 id="A">A</h2>
      <p>text1</p>
      <p>text2</p>
      <h2 id="B">B</h2>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(2);
    expect(sections[0].content).toBe('text1\n\ntext2');
  });

  it('returns empty content for heading with no following text', () => {
    const html = `
      <h2 id="Empty">Empty</h2>
      <h2 id="Next">Next</h2>
      <p>Next content</p>
    `;

    const sections = parseGoSpec(html);

    expect(sections).toHaveLength(2);
    expect(sections[0].section_id).toBe('Empty');
    expect(sections[0].content).toBe('');
    expect(sections[1].content).toBe('Next content');
  });
});
