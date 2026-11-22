import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkLinks,
  collectAnchors,
  extractLinks,
  runCli,
  slugify,
  stripCode,
} from './check-links.mjs';

describe('slugify', () => {
  it.each([
    ['Getting started', 'getting-started'],
    ['M02 · User research kit ✅', 'm02--user-research-kit-'],
    ['What is new?', 'what-is-new'],
    [
      'S3 · How information reaches you (8 min) · RQ1, H1',
      's3--how-information-reaches-you-8-min--rq1-h1',
    ],
    ['Sabaq · سبق', 'sabaq--سبق'],
    ['snake_case and-dashes', 'snake_case-and-dashes'],
  ])('turns %j into %j', (heading, expected) => {
    expect(slugify(heading)).toBe(expected);
  });
});

describe('collectAnchors', () => {
  it('numbers duplicate headings like GitHub', () => {
    const anchors = collectAnchors('# Notes\n## Notes\n### Notes\n');
    expect([...anchors]).toEqual(['notes', 'notes-1', 'notes-2']);
  });

  it('ignores headings inside code blocks', () => {
    expect(collectAnchors('```md\n# Not a heading\n```\n# Real\n').has('not-a-heading')).toBe(
      false,
    );
  });
});

describe('extractLinks', () => {
  it('finds links and images but not code examples', () => {
    const markdown = '[a](a.md) ![b](img/b.png "title") `[c](c.md)`\n```\n[d](d.md)\n```';
    expect(extractLinks(markdown)).toEqual(['a.md', 'img/b.png']);
  });

  it('strips inline code', () => {
    expect(stripCode('see `x` here')).toBe('see  here');
  });
});

describe('checkLinks', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'check-links-'));
    mkdirSync(path.join(root, 'docs'));
    writeFileSync(path.join(root, 'docs', 'guide.md'), '# Guide\n## Install steps\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('accepts valid files, anchors and external links', () => {
    writeFileSync(
      path.join(root, 'README.md'),
      '[guide](docs/guide.md) [steps](docs/guide.md#install-steps) [self](#readme) [web](https://example.com)\n# Readme\n',
    );
    expect(checkLinks(root)).toEqual({ files: 2, links: 3, problems: [] });
  });

  it('reports missing files and missing anchors', () => {
    writeFileSync(
      path.join(root, 'README.md'),
      '[gone](docs/missing.md) [bad](docs/guide.md#nope)\n',
    );
    const { problems } = checkLinks(root);
    expect(problems).toEqual([
      { file: 'README.md', link: 'docs/missing.md', reason: 'target does not exist' },
      { file: 'README.md', link: 'docs/guide.md#nope', reason: 'no heading for #nope' },
    ]);
  });

  it('skips private and generated folders', () => {
    mkdirSync(path.join(root, 'node_modules'));
    writeFileSync(path.join(root, 'node_modules', 'x.md'), '[broken](nowhere.md)\n');
    expect(checkLinks(root).problems).toEqual([]);
  });

  it('reports success and failure through the command line with exit codes', () => {
    /** @type {string[]} */
    const lines = [];
    const output = {
      /** @param {string} message */
      log: (message) => lines.push(`log: ${message}`),
      /** @param {string} message */
      error: (message) => lines.push(`error: ${message}`),
    };

    writeFileSync(path.join(root, 'README.md'), '[guide](docs/guide.md)\n');
    expect(runCli([root], output)).toBe(0);
    expect(lines.pop()).toBe('log: ✔ 1 links in 2 files, 0 broken');

    writeFileSync(path.join(root, 'README.md'), '[gone](docs/missing.md)\n');
    expect(runCli([root], output)).toBe(1);
    expect(lines.slice(-2)).toEqual([
      'error: ✖ README.md: docs/missing.md (target does not exist)',
      'error: 1 links in 2 files, 1 broken',
    ]);
  });
});
