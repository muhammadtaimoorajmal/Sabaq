# Changelog

All notable changes to Sabaq are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `@sabaq/shared` package: Zod schemas and types for users, preferences, authentication, classes, courses, tasks, submission rules, announcements, study slots, study groups and notifications; a role-and-action permission matrix; and fully tested domain logic for the Submission Checker, workload and deadline-clash assessment, time-zone-aware urgency, calendar-day arithmetic and secure join codes.
- Test coverage reporting, with 100% coverage required for domain logic.

### Changed

- Prettier, commitlint and lint-staged settings moved into `package.json` to keep the repository root tidy.
- Dependabot no longer proposes major upgrades of ESLint, TypeScript and Node.js type definitions until the plugins that depend on them support the new versions.
- Development tooling: npm workspaces, strict TypeScript base configuration, ESLint with accessibility rules, Prettier, markdownlint, a tested documentation link checker, Vitest, Git hooks (lint-staged, commitlint), GitHub Actions CI, Dependabot and recommended editor settings.
- User research kit: research plan with questions, falsifiable hypotheses and pre-registered survey thresholds; interview guides for students and for instructors and class representatives; contextual inquiry guide; survey specification; consent and privacy procedure; note, observation, participant, artifact and survey templates.
- Design-rationale records in Question–Option–Criteria format, with DR-001 (platform choice).
- Product vision, 30-milestone roadmap, README, license, contribution guide, code of conduct, security policy, issue forms (bug, feature, usability finding) and pull-request template, editor and line-ending configuration, and the monorepo folder structure.
