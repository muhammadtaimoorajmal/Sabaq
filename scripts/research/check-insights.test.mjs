import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkInsights, runCli, sourceOf } from './check-insights.mjs';

describe('checkInsights', () => {
  it('accepts insights backed by two independent sources', () => {
    const map = [
      '## Insights',
      '### I1 · Deadlines hide in chat',
      '**Evidence:** P1-03, P4-02, R12-Q25',
      '### I2 · Senders cannot see reach',
      '**Evidence:** S1-04; O2-01',
    ].join('\n');
    expect(checkInsights(map)).toEqual({
      insights: [
        { id: 'I1', line: 2, references: ['P1-03', 'P4-02', 'R12-Q25'] },
        { id: 'I2', line: 4, references: ['S1-04', 'O2-01'] },
      ],
      problems: [],
    });
  });

  it('rejects single-source insights, missing evidence and malformed references', () => {
    const map = [
      '### I1 · One participant only',
      '**Evidence:** P1-03, P1-07',
      '### I2 · No evidence',
      '### I3 · Typo',
      '**Evidence:** P1-03, interview 2',
    ].join('\n');
    expect(checkInsights(map).problems.map((problem) => problem.message)).toEqual([
      'I1: needs at least two references from two different sources (has 2 from 1)',
      'I2: needs at least two references from two different sources (has 0 from 0)',
      'I3: "interview 2" is not a valid reference',
      'I3: needs at least two references from two different sources (has 1 from 1)',
    ]);
  });

  it('ignores examples in comments and code blocks, and evidence outside insights', () => {
    const map = [
      '<!--',
      '### I9 · Example insight',
      '-->',
      '```md',
      '### I8 · Another example',
      '```',
      '## Themes',
      '**Evidence:** P1-01',
    ].join('\n');
    expect(checkInsights(map)).toEqual({ insights: [], problems: [] });
  });

  it('names the source of a reference', () => {
    expect(['P3-07', 'A07', 'R12-Q25'].map(sourceOf)).toEqual(['P3', 'A07', 'R12']);
  });
});

describe('runCli', () => {
  it('reports results with exit codes', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'insights-'));
    /** @type {string[]} */
    const lines = [];
    const output = {
      /** @param {string} message */
      log: (message) => lines.push(message),
      /** @param {string} message */
      error: (message) => lines.push(`error: ${message}`),
    };
    const file = path.join(directory, 'map.md');

    expect(runCli([path.join(directory, 'none.md')], output)).toBe(1);
    writeFileSync(file, '### I1 · Good\n**Evidence:** P1-01, S1-01\n');
    expect(runCli([file], output)).toBe(0);
    expect(lines.at(-1)).toBe('✔ 1 insights, each backed by independent evidence');
    writeFileSync(file, '### I1 · Weak\n**Evidence:** P1-01\n');
    expect(runCli([file], output)).toBe(1);
    rmSync(directory, { recursive: true, force: true });
  });
});
