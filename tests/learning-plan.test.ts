import { describe, it, expect } from 'vitest';
import {
  groupByTopLevel,
  reorderForFocus,
  assignToWeeks,
  type SectionRow,
  type TopicGroup,
} from '../src/tools/build-learning-plan.js';

function makeSection(overrides: Partial<SectionRow> & { section_path: string }): SectionRow {
  return {
    section_id: overrides.section_path.replace(/\s+/g, '_').toLowerCase(),
    title: overrides.section_path.split(' > ').pop()!,
    canonical_url: `https://go.dev/ref/spec#${overrides.section_id ?? 'test'}`,
    fulltext_length: 800,
    ...overrides,
  };
}

function makeSections(): SectionRow[] {
  return [
    makeSection({ section_path: 'Introduction', fulltext_length: 500 }),
    makeSection({ section_path: 'Lexical elements', fulltext_length: 1000 }),
    makeSection({ section_path: 'Lexical elements > Tokens', fulltext_length: 600 }),
    makeSection({ section_path: 'Types', fulltext_length: 2000 }),
    makeSection({ section_path: 'Types > Boolean types', fulltext_length: 400 }),
    makeSection({ section_path: 'Types > Numeric types', fulltext_length: 800 }),
    makeSection({ section_path: 'Declarations', fulltext_length: 1500 }),
    makeSection({ section_path: 'Statements', fulltext_length: 1200 }),
    makeSection({ section_path: 'Statements > If statements', fulltext_length: 600 }),
    makeSection({ section_path: 'Built-in functions', fulltext_length: 900 }),
  ];
}

describe('groupByTopLevel', () => {
  it('groups sections by top-level topic preserving order', () => {
    const sections = makeSections();
    const groups = groupByTopLevel(sections);

    const topics = groups.map(g => g.topic);
    expect(topics).toEqual([
      'Introduction',
      'Lexical elements',
      'Types',
      'Declarations',
      'Statements',
      'Built-in functions',
    ]);

    // "Lexical elements" group should have 2 sections
    const lexGroup = groups.find(g => g.topic === 'Lexical elements')!;
    expect(lexGroup.sections).toHaveLength(2);
    expect(lexGroup.totalChars).toBe(1600);

    // "Types" group should have 3 sections
    const typesGroup = groups.find(g => g.topic === 'Types')!;
    expect(typesGroup.sections).toHaveLength(3);
    expect(typesGroup.totalChars).toBe(3200);
  });
});

describe('reorderForFocus', () => {
  it('returns same order when no focus areas', () => {
    const sections = makeSections();
    const groups = groupByTopLevel(sections);
    const reordered = reorderForFocus(groups, undefined);

    expect(reordered.map(g => g.topic)).toEqual(groups.map(g => g.topic));
  });

  it('moves focus areas after prerequisites', () => {
    const sections = makeSections();
    const groups = groupByTopLevel(sections);
    const reordered = reorderForFocus(groups, ['Types']);

    const topics = reordered.map(g => g.topic);

    // Prerequisites should stay first
    expect(topics[0]).toBe('Introduction');
    expect(topics[1]).toBe('Lexical elements');

    // Focus area "Types" should come right after prereqs
    expect(topics[2]).toBe('Types');

    // Rest follows
    expect(topics).toContain('Declarations');
    expect(topics).toContain('Statements');
    expect(topics).toContain('Built-in functions');
  });
});

describe('assignToWeeks', () => {
  function getGroups(): TopicGroup[] {
    return groupByTopLevel(makeSections());
  }

  it('distributes all sections across 4 weeks', () => {
    const groups = getGroups();
    const weeks = assignToWeeks(groups, 4);

    expect(weeks.length).toBeLessThanOrEqual(4);
    expect(weeks.length).toBeGreaterThan(0);

    // All 10 sections should be present
    const totalSections = weeks.reduce((sum, w) => sum + w.sections.length, 0);
    expect(totalSections).toBe(10);

    // Weeks should be numbered sequentially
    weeks.forEach((w, i) => {
      expect(w.week).toBe(i + 1);
    });
  });

  it('puts everything in 1 week when total_weeks=1', () => {
    const groups = getGroups();
    const weeks = assignToWeeks(groups, 1);

    expect(weeks).toHaveLength(1);
    expect(weeks[0].sections).toHaveLength(10);
  });

  it('splits into more weeks when total_weeks=12', () => {
    const groups = getGroups();
    const weeks = assignToWeeks(groups, 12);

    // Should try to fill up to 12 weeks by splitting
    expect(weeks.length).toBeGreaterThan(1);
    expect(weeks.length).toBeLessThanOrEqual(12);

    // No empty weeks
    for (const w of weeks) {
      expect(w.sections.length).toBeGreaterThan(0);
    }

    // All sections accounted for
    const totalSections = weeks.reduce((sum, w) => sum + w.sections.length, 0);
    expect(totalSections).toBe(10);
  });

  it('calculates estimated_minutes as ceil(totalChars / 800)', () => {
    const groups = getGroups();
    const weeks = assignToWeeks(groups, 4);

    for (const w of weeks) {
      const totalChars = w.sections.reduce((sum, s) => sum + s.content_length, 0);
      expect(w.estimated_minutes).toBe(Math.ceil(totalChars / 800));
    }
  });
});
