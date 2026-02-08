import type Database from 'better-sqlite3';
import { DatabaseQueries } from '../db/queries.js';
import type { LearningPlan, WeekPlan, LearningPlanSection } from '../types.js';

export interface SectionRow {
  section_id: string;
  title: string;
  section_path: string;
  canonical_url: string;
  fulltext_length: number;
}

export interface TopicGroup {
  topic: string;
  sections: LearningPlanSection[];
  totalChars: number;
}

export function buildLearningPlan(
  db: Database.Database,
  params: {
    language: string;
    version?: string;
    total_weeks?: number;
    focus_areas?: string[];
  },
): LearningPlan {
  const queries = new DatabaseQueries(db);
  const totalWeeks = params.total_weeks ?? 4;

  const { version, sections } = queries.getAllSectionsForPlan(
    params.language,
    params.version,
  );

  if (sections.length === 0) {
    throw new Error(`No sections found for language: ${params.language}`);
  }

  const groups = groupByTopLevel(sections);
  const reordered = reorderForFocus(groups, params.focus_areas);
  const weeks = assignToWeeks(reordered, totalWeeks);

  return {
    language: params.language,
    version,
    total_weeks: weeks.length,
    total_sections: sections.length,
    weeks,
  };
}

export function groupByTopLevel(sections: SectionRow[]): TopicGroup[] {
  const groupMap = new Map<string, TopicGroup>();
  const groupOrder: string[] = [];

  for (const s of sections) {
    const parts = s.section_path.split(' > ');
    const topic = parts[0];
    const depth = parts.length - 1;

    const planSection: LearningPlanSection = {
      section_id: s.section_id,
      title: s.title,
      section_path: s.section_path,
      url: s.canonical_url,
      depth,
      content_length: s.fulltext_length,
    };

    const existing = groupMap.get(topic);
    if (existing) {
      existing.sections.push(planSection);
      existing.totalChars += s.fulltext_length;
    } else {
      groupOrder.push(topic);
      groupMap.set(topic, {
        topic,
        sections: [planSection],
        totalChars: s.fulltext_length,
      });
    }
  }

  return groupOrder.map(t => groupMap.get(t)!);
}

export function reorderForFocus(
  groups: TopicGroup[],
  focusAreas?: string[],
): TopicGroup[] {
  if (!focusAreas || focusAreas.length === 0) return groups;

  const lowerFocus = focusAreas.map(f => f.toLowerCase());

  // Prerequisite topics that always stay at the front
  const prereqs = new Set([
    'introduction',
    'notation',
    'source code representation',
    'lexical elements',
  ]);

  const prereqGroups: TopicGroup[] = [];
  const focusGroups: TopicGroup[] = [];
  const rest: TopicGroup[] = [];

  for (const g of groups) {
    const lowerTopic = g.topic.toLowerCase();
    if (prereqs.has(lowerTopic)) {
      prereqGroups.push(g);
    } else if (lowerFocus.some(f => lowerTopic.includes(f) || f.includes(lowerTopic))) {
      focusGroups.push(g);
    } else {
      rest.push(g);
    }
  }

  return [...prereqGroups, ...focusGroups, ...rest];
}

export function assignToWeeks(
  groups: TopicGroup[],
  totalWeeks: number,
): WeekPlan[] {
  const totalChars = groups.reduce((sum, g) => sum + g.totalChars, 0);
  const targetPerWeek = totalChars / totalWeeks;
  const threshold = targetPerWeek * 1.3;

  const weeks: WeekPlan[] = [];
  let currentSections: LearningPlanSection[] = [];
  let currentChars = 0;
  let currentTopics: string[] = [];

  for (const group of groups) {
    currentSections.push(...group.sections);
    currentChars += group.totalChars;
    if (!currentTopics.includes(group.topic)) {
      currentTopics.push(group.topic);
    }

    // Move to next week if we exceeded threshold and not the last week
    if (currentChars >= threshold && weeks.length < totalWeeks - 1) {
      weeks.push(makeWeekPlan(weeks.length + 1, currentTopics, currentSections));
      currentSections = [];
      currentChars = 0;
      currentTopics = [];
    }
  }

  // Push remaining sections
  if (currentSections.length > 0) {
    weeks.push(makeWeekPlan(weeks.length + 1, currentTopics, currentSections));
  }

  // If we have more weeks than totalWeeks, merge extras into the last week
  while (weeks.length > totalWeeks) {
    const extra = weeks.pop()!;
    const last = weeks[weeks.length - 1];
    last.sections.push(...extra.sections);
    last.estimated_minutes += extra.estimated_minutes;
    // Merge theme topics
    const extraTopics = extra.theme.split(', ');
    const lastTopics = last.theme.split(', ');
    for (const t of extraTopics) {
      if (!lastTopics.includes(t)) lastTopics.push(t);
    }
    last.theme = lastTopics.join(', ');
  }

  // If we have fewer weeks than totalWeeks, try to split the largest week
  while (weeks.length < totalWeeks) {
    // Find the week with the most sections
    let largestIdx = 0;
    for (let i = 1; i < weeks.length; i++) {
      if (weeks[i].sections.length > weeks[largestIdx].sections.length) {
        largestIdx = i;
      }
    }

    const largest = weeks[largestIdx];
    if (largest.sections.length < 2) break; // Can't split further

    const mid = Math.ceil(largest.sections.length / 2);
    const firstHalf = largest.sections.slice(0, mid);
    const secondHalf = largest.sections.slice(mid);

    weeks.splice(
      largestIdx,
      1,
      makeWeekPlanFromSections(largestIdx + 1, firstHalf),
      makeWeekPlanFromSections(largestIdx + 2, secondHalf),
    );

    // Renumber all weeks
    for (let i = 0; i < weeks.length; i++) {
      weeks[i].week = i + 1;
    }
  }

  return weeks;
}

function makeWeekPlan(
  weekNum: number,
  topics: string[],
  sections: LearningPlanSection[],
): WeekPlan {
  const totalChars = sections.reduce((sum, s) => sum + s.content_length, 0);
  return {
    week: weekNum,
    theme: generateTheme(topics),
    sections,
    estimated_minutes: Math.ceil(totalChars / 800),
  };
}

function makeWeekPlanFromSections(
  weekNum: number,
  sections: LearningPlanSection[],
): WeekPlan {
  // Derive topics from section paths
  const topics = [...new Set(sections.map(s => s.section_path.split(' > ')[0]))];
  return makeWeekPlan(weekNum, topics, sections);
}

function generateTheme(topics: string[]): string {
  return topics.join(', ');
}
