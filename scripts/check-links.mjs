#!/usr/bin/env node
/**
 * Checks every relative link in the repository's Markdown files:
 * the target file must exist and, when a #fragment is given, the target
 * document must contain a heading that GitHub would turn into that anchor.
 *
 * Usage: node scripts/check-links.mjs [rootDirectory]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.course',
]);
const EXTERNAL_LINK = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Removes fenced code blocks and inline code so links inside examples are ignored.
 * @param {string} markdown
 * @returns {string}
 */
export function stripCode(markdown) {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
}

/**
 * Converts heading text into the anchor GitHub generates for it.
 * @param {string} heading
 * @returns {string}
 */
export function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * Lists every anchor available in a Markdown document, numbering duplicates like GitHub does.
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function collectAnchors(markdown) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  const anchors = new Set();
  for (const match of stripCode(markdown).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slugify(match[1] ?? '');
    const count = seen.get(base);
    anchors.add(count === undefined ? base : `${base}-${count + 1}`);
    seen.set(base, count === undefined ? 0 : count + 1);
  }
  return anchors;
}

/**
 * Extracts link targets from inline Markdown links and images.
 * @param {string} markdown
 * @returns {string[]}
 */
export function extractLinks(markdown) {
  return [...stripCode(markdown).matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)]
    .map((match) => match[1] ?? '')
    .filter(Boolean);
}

/**
 * Recursively finds Markdown files, skipping generated and private folders.
 * @param {string} directory
 * @returns {string[]}
 */
export function findMarkdownFiles(directory) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findMarkdownFiles(fullPath));
    else if (entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

/**
 * @typedef {{ file: string, link: string, reason: string }} LinkProblem
 * @typedef {{ files: number, links: number, problems: LinkProblem[] }} LinkReport
 */

/**
 * Checks all relative links below a root directory.
 * @param {string} root
 * @returns {LinkReport}
 */
export function checkLinks(root) {
  const files = findMarkdownFiles(root);
  /** @type {Map<string, Set<string>>} */
  const anchorCache = new Map();
  /** @param {string} file */
  const anchorsOf = (file) => {
    let anchors = anchorCache.get(file);
    if (!anchors) {
      anchors = collectAnchors(readFileSync(file, 'utf8'));
      anchorCache.set(file, anchors);
    }
    return anchors;
  };

  /** @type {LinkProblem[]} */
  const problems = [];
  let links = 0;
  for (const file of files) {
    for (const link of extractLinks(readFileSync(file, 'utf8'))) {
      if (EXTERNAL_LINK.test(link)) continue;
      links += 1;
      const [rawPath = '', fragment] = link.split('#');
      const target = rawPath ? path.resolve(path.dirname(file), decodeURI(rawPath)) : file;
      const relativeFile = path.relative(root, file).split(path.sep).join('/');
      if (!existsSync(target)) {
        problems.push({ file: relativeFile, link, reason: 'target does not exist' });
      } else if (
        fragment &&
        statSync(target).isFile() &&
        target.endsWith('.md') &&
        !anchorsOf(target).has(fragment)
      ) {
        problems.push({ file: relativeFile, link, reason: `no heading for #${fragment}` });
      }
    }
  }
  return { files: files.length, links, problems };
}

/**
 * Command-line entry point. Prints a report and returns the process exit code.
 * @param {string[]} args
 * @param {{ log: (message: string) => void, error: (message: string) => void }} output
 * @returns {number}
 */
export function runCli(args, output) {
  const report = checkLinks(path.resolve(args[0] ?? '.'));
  for (const problem of report.problems) {
    output.error(`✖ ${problem.file}: ${problem.link} (${problem.reason})`);
  }
  const summary = `${report.links} links in ${report.files} files, ${report.problems.length} broken`;
  if (report.problems.length > 0) {
    output.error(summary);
    return 1;
  }
  output.log(`✔ ${summary}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli(process.argv.slice(2), console);
}
