#!/usr/bin/env node
/**
 * Enforces the synthesis rule "every insight cites at least two independent data points":
 * each `### I<n> · …` heading in the affinity map needs an `**Evidence:**` line with at least
 * two references from at least two different sources (participants, sessions, artifacts or
 * survey responses).
 *
 * Usage: node scripts/research/check-insights.mjs [affinity-map.md]
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MAP = 'docs/research/synthesis/affinity-map.md';

/**
 * Evidence references: interview notes `P3-07` / `S1-02`, observations `O2-05`, artifacts
 * `A07`, survey answers `R12-Q25`. The source is the part before the first dash.
 */
const REFERENCE = /^(?:[PSO]\d+-\d+|A\d+|R\d+-Q\d+)$/;

/**
 * @param {string} reference
 * @returns {string}
 */
export function sourceOf(reference) {
  return reference.split('-')[0] ?? reference;
}

/**
 * @typedef {{ id: string, line: number, references: string[] }} Insight
 * @typedef {{ line: number, message: string }} InsightProblem
 */

/**
 * Reads insights from the affinity map, ignoring comments and code blocks.
 * @param {string} markdown
 * @returns {{ insights: Insight[], problems: InsightProblem[] }}
 */
export function checkInsights(markdown) {
  const visible = markdown
    .replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, (block) => block.replace(/[^\n]/g, ' '));
  const lines = visible.split('\n');
  /** @type {Insight[]} */
  const insights = [];
  /** @type {InsightProblem[]} */
  const problems = [];
  /** @type {Insight | undefined} */
  let current;
  lines.forEach((text, index) => {
    const heading = /^###\s+(I\d+)\b/.exec(text);
    if (heading) {
      current = { id: heading[1] ?? '', line: index + 1, references: [] };
      insights.push(current);
      return;
    }
    if (/^#{1,3}\s/.test(text)) {
      current = undefined;
      return;
    }
    const evidence = /^\*\*Evidence:\*\*\s*(.*)$/.exec(text.trim());
    if (current && evidence) {
      current.references.push(
        ...(evidence[1] ?? '')
          .split(/[,;]/)
          .map((reference) => reference.trim())
          .filter(Boolean),
      );
    }
  });

  for (const insight of insights) {
    const invalid = insight.references.filter((reference) => !REFERENCE.test(reference));
    for (const reference of invalid) {
      problems.push({
        line: insight.line,
        message: `${insight.id}: "${reference}" is not a valid reference`,
      });
    }
    const valid = insight.references.filter((reference) => REFERENCE.test(reference));
    const sources = new Set(valid.map(sourceOf));
    if (valid.length < 2 || sources.size < 2) {
      problems.push({
        line: insight.line,
        message: `${insight.id}: needs at least two references from two different sources (has ${valid.length} from ${sources.size})`,
      });
    }
  }
  return { insights, problems };
}

/**
 * @param {string[]} args
 * @param {{ log: (message: string) => void, error: (message: string) => void }} output
 * @returns {number}
 */
export function runCli(args, output) {
  const file = path.resolve(args[0] ?? DEFAULT_MAP);
  if (!existsSync(file)) {
    output.error(`No affinity map at ${file}`);
    return 1;
  }
  const { insights, problems } = checkInsights(readFileSync(file, 'utf8'));
  for (const problem of problems) output.error(`✖ line ${problem.line}: ${problem.message}`);
  if (problems.length > 0) return 1;
  output.log(`✔ ${insights.length} insights, each backed by independent evidence`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli(process.argv.slice(2), console);
}
