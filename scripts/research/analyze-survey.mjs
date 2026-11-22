#!/usr/bin/env node
/**
 * Analyzes the anonymized survey export and writes the findings report.
 *
 * Usage: node scripts/research/analyze-survey.mjs [responses.csv] [report.md]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groups, parseCsv, readResponses, renderReport } from './survey.mjs';

export const DEFAULT_INPUT = 'docs/research/data/survey/responses.csv';
export const DEFAULT_OUTPUT = 'docs/research/findings/survey-analysis.md';

/**
 * @param {string[]} args
 * @param {{ log: (message: string) => void, error: (message: string) => void }} output
 * @returns {number} exit code: 0 when the data is clean, 1 when it is missing or has problems
 */
export function runCli(args, output) {
  const input = path.resolve(args[0] ?? DEFAULT_INPUT);
  const report = path.resolve(args[1] ?? DEFAULT_OUTPUT);
  if (!existsSync(input)) {
    output.error(
      `No survey data at ${path.relative(process.cwd(), input)}. Export the responses as CSV with the columns of docs/research/templates/survey-responses.csv, remove identifying columns, and save it there.`,
    );
    return 1;
  }
  const { responses, problems } = readResponses(parseCsv(readFileSync(input, 'utf8')));
  mkdirSync(path.dirname(report), { recursive: true });
  writeFileSync(report, renderReport(responses, problems));

  const { students, senders } = groups(responses);
  output.log(
    `✔ ${responses.length} responses (${students.length} students, ${senders.length} senders) → ${path.relative(process.cwd(), report)}`,
  );
  for (const problem of problems) {
    output.error(`✖ row ${problem.row}, ${problem.column}: ${problem.message}`);
  }
  return problems.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli(process.argv.slice(2), console);
}
