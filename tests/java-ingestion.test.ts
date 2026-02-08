import { describe, it, expect } from 'vitest';
import { parseHtmlSpec } from '../src/ingestion/parser.js';
import { normalizeSections } from '../src/ingestion/normalizer.js';
import { getDocConfig } from '../src/config/languages.js';

const javaConfig = getDocConfig('java');

describe('Java JLS ingestion', () => {
  it('parses JLS HTML with jls-X.Y.Z section IDs', () => {
    const html = `
      <h2 id="jls-4">Chapter 4. Types, Values, and Variables</h2>
      <p>Java is a statically typed language.</p>
      <h3 id="jls-4.1">4.1. The Kinds of Types and Values</h3>
      <p>Types are either primitive or reference.</p>
      <h4 id="jls-4.2.1">4.2.1. Integral Types and Values</h4>
      <p>The values of the integral types are integers.</p>
    `;

    const sections = parseHtmlSpec(html, javaConfig, 'https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html');

    expect(sections).toHaveLength(3);
    expect(sections[0].section_id).toBe('jls-4');
    expect(sections[0].title).toContain('Types');
    expect(sections[1].section_id).toBe('jls-4.1');
    expect(sections[2].section_id).toBe('jls-4.2.1');
    expect(sections[2].section_path).toContain(' > ');
  });

  it('builds correct canonical URLs for Java sections', () => {
    const html = `
      <h2 id="jls-8">Chapter 8. Classes</h2>
      <p>Class declarations.</p>
    `;

    const pageUrl = 'https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html';
    const sections = parseHtmlSpec(html, javaConfig, pageUrl);
    const normalized = normalizeSections(sections, {
      language: 'java',
      doc: 'jls',
      version: 'se21',
      baseUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html',
      sourcePolicy: 'excerpt_only',
    });

    expect(normalized[0].canonical_url).toBe(
      'https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html#jls-8'
    );
    expect(normalized[0].source_policy).toBe('excerpt_only');
  });

  it('enforces excerpt_only source policy', () => {
    const html = '<h2 id="jls-1">Chapter 1. Introduction</h2><p>Content</p>';

    const sections = parseHtmlSpec(html, javaConfig, 'https://example.com/jls-1.html');
    const normalized = normalizeSections(sections, {
      language: 'java',
      doc: 'jls',
      version: 'se21',
      baseUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html',
      sourcePolicy: 'excerpt_only',
    });

    expect(normalized[0].source_policy).toBe('excerpt_only');
  });

  it('sets pageUrl for multi-chapter navigation', () => {
    const html = '<h2 id="jls-5">Chapter 5</h2><p>Conversions.</p>';
    const pageUrl = 'https://docs.oracle.com/javase/specs/jls/se21/html/jls-5.html';
    const sections = parseHtmlSpec(html, javaConfig, pageUrl);

    expect(sections[0].pageUrl).toBe(pageUrl);
  });
});
