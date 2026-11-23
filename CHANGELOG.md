# Changelog

All notable changes to Sabaq are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Account screens: create an account (with a password strength meter that discourages common passwords, personal details and patterns), confirm the e-mail address from the e-mailed link or a reminder banner, sign in (Caps Lock warning, the remaining minutes of a locked account, optional one-tap demo accounts), forgotten and reset passwords, and change password in settings. Validation in plain language appears after leaving a field or on submit and clears as soon as a problem is fixed; forms work with password managers.
- A development mailbox (`GET /api/dev/mail`) that keeps the e-mails the API would have sent when no e-mail service is configured; never available in production.
- App shell: routes that load on demand, with protected pages that return people to their destination after signing in; an API client that renews sessions silently and shares one renewal between parallel requests; cached server data; an honest connection banner for a waking server or a lost connection; a header with display settings and an account menu; sidebar navigation on wide screens and a bottom bar on phones; announced page changes (title and focus); error pages with recovery and support references, a not-found page, and a last-resort error screen; a sign-in page; settings with display preferences and signed-in devices (sign out one or all).
- End-to-end tests in a real browser (`npm run test:e2e`) for user journeys, keyboard access, accessibility scans including color contrast in every theme and in Urdu, layouts at 320 px, and a Lighthouse accessibility score of 100; run in continuous integration.
- Web app (`apps/web`) with the design system: semantic color, type, spacing, radius, elevation and motion tokens; light, dark and high-contrast themes verified against WCAG 2.2 (AA, and AAA in high contrast) by automated contrast tests; text size from 87.5% to 150%, comfortable and compact spacing, reduced motion, and English and right-to-left Urdu, all applied instantly, remembered, and following system settings; accessible components (button, icon button, form fields with linked hints and errors, password visibility, character count, error summary, date and time field in the class time zone, checkbox, switch, radio group, segmented control, slider, dialog, sheet, menu, tabs, tooltip, toast, alert, badge, course tag, avatar, card, empty state, skeleton, spinner, skip link); a living style guide; automated accessibility scans in every theme and language.
- `npm run dev` starts the API and the web app together, with same-origin `/api` forwarding as in production.
- Research synthesis tools: `npm run research:survey` validates the survey export against the questionnaire and writes a report with charts, tables, open answers and a verdict for each hypothesis using the pre-registered thresholds (refusing verdicts on too little data); `npm run lint:research` enforces that every insight cites at least two independent sources. Synthesis workspace for the affinity map, hypothesis verdicts and behavioral variables, and conventions for committing survey data.
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

- The error summary takes focus once per submit attempt instead of whenever its contents change, so correcting a field never moves focus away from it.
- The greeting keeps a title with the first name ("Dr. Ayesha" rather than "Dr.").
- Continuous integration caches the MongoDB binary used by the database tests.
- Workspace packages build before the applications that depend on them, and type checks and tests read `@sabaq/shared` from its sources, so no build step is needed first.
- Prettier, commitlint and lint-staged settings moved into `package.json` to keep the repository root tidy.
- Dependabot no longer proposes major upgrades of ESLint, TypeScript and Node.js type definitions until the plugins that depend on them support the new versions.
