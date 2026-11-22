# Changelog

All notable changes to Sabaq are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Authentication API: sign-up, sign-in, sign-out (one device or all), session refresh with rotating refresh tokens and theft detection, a list of signed-in devices, e-mail verification, forgotten and changed passwords; account lock after repeated failures, rate limits, and protection against account discovery and cross-site request forgery; bilingual e-mails (English and right-to-left Urdu) over SMTP, written to the log during development.
- Shared contract additions: authentication error codes, `authResponseSchema` and `sessionInfoSchema`.
- Documentation: the authentication design in the API guide, and an e-mail setup guide for Brevo.
- Database layer (`apps/api`): MongoDB connection with retries and exponential back-off, readiness reporting and graceful disconnect; Mongoose models and purposeful indexes for users, classes, memberships, courses, tasks, completions, announcements, receipts, study slots, study groups, join requests and notifications; Argon2id password hashing; a fictional demo institution with dates relative to today, loadable with `npm run db:seed` behind safety checks; a temporary in-memory database with demo data when no `MONGODB_URI` is set; tests that run without network access.
- `zonedDateTime` in `@sabaq/shared`: the instant of a wall-clock time in a time zone, with defined behavior across daylight-saving changes.
- Documentation: data model and a MongoDB Atlas setup guide.
- API foundation (`apps/api`): Express 5 and TypeScript; configuration validated at startup with readable messages; structured, privacy-preserving request logs with request IDs; one error format for every failure; Helmet security headers, CORS allow-list, rate limiting and body-size limits; liveness (`/api/health`) and readiness (`/api/health/ready`) endpoints; graceful shutdown; documented `.env.example`; tests for every module.
- Shared API contract in `@sabaq/shared`: error codes, the error response format, and health and readiness responses.
- `@sabaq/shared` package: Zod schemas and types for users, preferences, authentication, classes, courses, tasks, submission rules, announcements, study slots, study groups and notifications; a role-and-action permission matrix; and fully tested domain logic for the Submission Checker, workload and deadline-clash assessment, time-zone-aware urgency, calendar-day arithmetic and secure join codes.
- Test coverage reporting, with 100% coverage required for domain logic.
- Development tooling: npm workspaces, strict TypeScript base configuration, ESLint with accessibility rules, Prettier, markdownlint, a tested documentation link checker, Vitest, Git hooks (lint-staged, commitlint), GitHub Actions CI, Dependabot and recommended editor settings.
- User research kit: research plan with questions, falsifiable hypotheses and pre-registered survey thresholds; interview guides for students and for instructors and class representatives; contextual inquiry guide; survey specification; consent and privacy procedure; note, observation, participant, artifact and survey templates.
- Design-rationale records in Question–Option–Criteria format, with DR-001 (platform choice).
- Product vision, 30-milestone roadmap, README, license, contribution guide, code of conduct, security policy, issue forms (bug, feature, usability finding) and pull-request template, editor and line-ending configuration, and the monorepo folder structure.

### Changed

- Continuous integration caches the MongoDB binary used by the database tests.
- Workspace packages build before the applications that depend on them, and type checks and tests read `@sabaq/shared` from its sources, so no build step is needed first.
- Prettier, commitlint and lint-staged settings moved into `package.json` to keep the repository root tidy.
- Dependabot no longer proposes major upgrades of ESLint, TypeScript and Node.js type definitions until the plugins that depend on them support the new versions.
