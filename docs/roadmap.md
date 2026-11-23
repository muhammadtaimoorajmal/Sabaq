# Roadmap

Sabaq is built in **30 milestones**. Each one is built, verified and released on its own.
For the product itself, see the [vision](vision.md).

**Each milestone lists:**

- **Goal**: why it exists.
- **Depends on**: what must be finished first.
- **Deliverables**: what it produces.
- **Done when**: the checks that must pass before it ships.
- **Requires**: anything outside the code (accounts, research participants).

## Overview

| Phase | Milestones | Theme |
| --- | --- | --- |
| Foundation | M01–M04 | Repository, research kit, tooling, shared domain logic |
| Backend core | M05–M07 | API, database, authentication |
| Research and design | M08–M12 | Synthesis, personas, concepts, wireframes, formative testing |
| Frontend foundation | M13–M16 | Design system, app shell, authentication screens, deployment |
| Features | M17–M27 | Every product feature, built end to end |
| Quality and launch | M28–M30 | Hardening, usability benchmark, v1.0.0 |

**Why research sits after the backend core.** Field research takes one to two weeks. The research kit ships early (M02) so fieldwork starts immediately. Meanwhile, M03–M07 build the parts that do not depend on research findings: tooling, database and authentication. No *interface* is designed until research is synthesized (M08–M09).

---

## Foundation

### M01 · Repository foundation ✅

- **Goal:** A clean, welcoming repository that explains the product truthfully from the first commit.
- **Deliverables:** README, license, contribution guide, code of conduct, security policy, changelog; issue forms (bug, feature, usability finding) and pull-request template; editor and line-ending configuration; monorepo skeleton; vision and roadmap.

### M02 · User research kit ✅

- **Goal:** Everything needed to run rigorous user research with real students, class representatives and instructors.
- **Depends on:** M01.
- **Deliverables** in `docs/research/`: research plan (questions, hypotheses, participants, methods, ethics); interview guides for students and for instructors and class reps; contextual-inquiry observation guide; survey ready for any online form tool; consent and anonymization procedure; note-taking and data templates. In `docs/design-rationale/`: the record template and DR-001 (platform choice).
- **Done when:** every research question is covered by at least two methods and every instrument maps to a hypothesis.
- **Requires:** 5–7 interviews, 2–3 observation sessions and 30+ survey responses with real participants (runs in parallel with M03–M07).

### M03 · Tooling and continuous integration ✅

- **Goal:** Make mistakes hard to commit.
- **Depends on:** M01.
- **Deliverables:** npm workspaces; strict shared TypeScript configuration; ESLint (including accessibility rules) and Prettier; pre-commit hooks; commit-message linting; GitHub Actions running format → lint → typecheck → test → build on every push and pull request; Dependabot.
- **Done when:** `npm run check` passes locally and in CI.

### M04 · Shared domain package ✅

- **Goal:** One source of truth for data shapes and business rules, used by both web and API.
- **Depends on:** M03.
- **Deliverables:** Zod schemas and types (user, preferences, class, membership, course, announcement, task, submission rule, study slot, study group, notification); role and permission matrix; pure, tested domain logic:
  - `checkSubmission(file, rule, now)`: validates a naming pattern built from tokens such as `{TASK_NO}`, `{STUDENT_ID}` and `{SECTION}`, plus extension, size and deadline, and returns human-readable fixes and the corrected file name;
  - `computeDailyLoad()` and `findClashes()`: weighted workload per day and lighter alternatives;
  - `urgencyOf()`: overdue, due today, due this week, later.
- **Done when:** full branch coverage of domain logic; builds for both Node.js and browsers.

## Backend core

### M05 · API scaffold ✅

- **Goal:** A production-grade server skeleton.
- **Depends on:** M04.
- **Deliverables:** Express + TypeScript; configuration validated at startup with clear messages; structured logging with request IDs; consistent error format; security headers, CORS allow-list, rate limits, body-size limits; liveness and readiness endpoints (readiness reports database status once M06 adds it); graceful shutdown; tests.
- **Done when:** the server runs locally; tests and CI pass.

### M06 · Database ✅

- **Goal:** Persistent, well-indexed data in the cloud.
- **Depends on:** M05.
- **Deliverables:** MongoDB connection with retry and health reporting; models and indexes for every entity; a seed script that creates a realistic demo institution; integration tests against an in-memory database.
- **Done when:** the seed runs against Atlas; tests pass without network access.
- **Requires:** a MongoDB Atlas account and a free cluster (step-by-step guide included).

### M07 · Authentication API ✅

- **Goal:** A secure, complete account lifecycle.
- **Depends on:** M06.
- **Deliverables:** register; email verification; login; short-lived access tokens with rotating refresh tokens in httpOnly cookies and reuse detection; logout and "log out of all devices"; forgot and reset password with single-use expiring tokens; Argon2id hashing; brute-force protection; current-user endpoint; email delivery over SMTP (printed to the console in development).
- **Done when:** tests cover every success and failure path, including expired, reused and tampered tokens.
- **Requires:** an SMTP provider account (a free tier is enough).

## Research and design

### M08 · Research synthesis 🛠️

> **Status:** analysis tools and synthesis structure are ready ([synthesis](research/synthesis/README.md)); findings are written once fieldwork data is committed.

- **Goal:** Turn raw fieldwork into evidence.
- **Depends on:** completed M02 fieldwork.
- **Deliverables:** anonymized notes; affinity map (observations → themes → insights); survey analysis with charts; a verdict on every hypothesis with supporting quotes; behavioral variables per participant.
- **Done when:** every insight cites at least two independent data points.

### M09 · Personas, goals, task analysis and usability targets

- **Goal:** Define who Sabaq is for and what success means.
- **Depends on:** M08.
- **Deliverables:** one primary and one or two secondary personas, each with experience, end and life goals; problem statements ("*[persona] needs a way to [need] because [insight]*"); stakeholder map; scenarios and essential use cases; hierarchical task analysis of the core tasks; measurable usability targets (for example, "a first-time user finds their next deadline in under 10 seconds").
- **Done when:** every persona attribute traces back to research evidence.

### M10 · Ideation and concept selection

- **Goal:** Explore several solutions before committing to one.
- **Depends on:** M09.
- **Deliverables:** brainstorm log; three or four distinct concepts (for example chat-first, calendar-first, feed-first, dashboard-first), each with a sketch and storyboard; Question–Option–Criteria analysis selecting the concept; decision records.
- **Done when:** the chosen concept is justified against explicit criteria, and rejected options are documented.

### M11 · Information architecture and low-fidelity prototype

- **Goal:** A testable structure before any visual design.
- **Depends on:** M10.
- **Deliverables:** site map; conceptual model (objects, actions, relationships); user flows for every core task; a clickable grayscale wireframe of every core screen that runs on any device.
- **Done when:** every core task can be completed end to end in the wireframe.

### M12 · Formative usability testing

- **Goal:** Find the biggest problems while they are cheap to fix.
- **Depends on:** M11.
- **Deliverables:** test plan (tasks, success criteria, contexts, participant matrix); think-aloud script; observation and timing sheets; heuristic-evaluation kit (Nielsen's 10 heuristics, severity 0–4, findings-by-evaluator matrix); report with quotes and a prioritized issue list; each issue linked to a design change.
- **Done when:** every severity 3–4 issue has a planned fix.
- **Requires:** five think-aloud sessions and three to five heuristic evaluators.

## Frontend foundation

### M13 · Design system ✅

- **Goal:** A consistent, accessible visual language.
- **Depends on:** M12.
- **Deliverables:** design tokens (color, type, spacing, radius, elevation, motion); light, dark and high-contrast themes; fluid type scale that follows the user's text-size preference; comfortable and compact density; reduced motion; accessible component library (button, input, select, checkbox, radio, switch, dialog, sheet, tabs, toast, tooltip, badge, card, empty state, skeleton, avatar, date picker); a living style-guide page.
- **Done when:** every text and color pair meets WCAG 2.2 AA (AAA in high contrast); every component works by keyboard; zero automated accessibility violations.

### M14 · App shell ✅

- **Goal:** The frame every screen lives in.
- **Depends on:** M13.
- **Deliverables:** routing with protected routes; data fetching and caching; API client with silent token refresh and an honest "connecting" state; internationalization with right-to-left layout; responsive navigation (sidebar on desktop, bottom bar on mobile); skip link; error boundary with recovery; not-found page; layouts from 320 px upward.
- **Done when:** everything is reachable by keyboard; Lighthouse accessibility score is 100.

### M15 · Authentication screens ✅

- **Goal:** Sign up and sign in without friction or confusion.
- **Depends on:** M07, M14.
- **Deliverables:** register, sign in, verify email, resend verification, forgot and reset password; validation in plain language at the right moment; password strength meter, show/hide toggle, Caps Lock warning; autocomplete that works with password managers; clear loading and success states; returning the user to where they were after the session expires.
- **Done when:** end-to-end tests cover every flow; zero accessibility violations.

### M16 · Deployment

- **Goal:** Anyone can use Sabaq from anywhere.
- **Depends on:** M15.
- **Deliverables:** API on Render with a health check; web app on Vercel with the `/api` rewrite; production database and network rules; automatic deployment of `main`; deployment runbook; live link in the README.
- **Done when:** register → verify → sign in works on the live site from a phone on mobile data.
- **Requires:** Vercel and Render accounts connected to the repository.

## Features (each built end to end: API, interface, tests)

### M17 · Classes and membership ✅

- Instructors and class reps create a class (program, section, term) and its courses (code, title, schedule, venue, color); join code, link and QR code; join, leave, roles and member management; permission checks on every endpoint.
- **Done when:** a student joins a class in under 30 seconds; unauthorized actions are refused with clear messages.

### M18 · Onboarding, profile and personalization

- First-run onboarding with progress and a skip option; profile; settings for theme, text size, density, language, reduced motion, notifications and quiet hours, applied instantly and synced across devices; data export and account deletion.
- **Done when:** a new user is set up in under two minutes.

### M19 · Structured announcements and receipts

- Typed announcements (deadline, quiz or exam, venue change, cancellation, material, general) with type-specific fields; deadline announcements create a task for every member; visible edit history; pinning; "seen by" receipts with the list of who has not seen it; inbox with filters and unread state.
- **Done when:** a post reaches every member and receipts update live.

### M20 · Paste-to-structure assistant

- A parser in the shared package that extracts date and time (including relative forms such as "next Wednesday 11 pm"), course, venue, task type and naming pattern from free text; extracted fields are highlighted for confirmation before anything is posted; a test corpus of realistic anonymized messages.
- **Done when:** at least 90% field accuracy on the corpus; nothing is posted without confirmation.

### M21 · Today and Timeline

- Today screen (overdue, due today, next seven days, today's classes and venues); timeline in list, week and month views; filters; mark as done with undo; personal tasks; countdowns; empty states that teach; offline copy.
- **Done when:** the "find my next deadline" target from M09 is met; works offline after first load.

### M22 · Submission Checker

- Instructors attach rules to any task (naming pattern built from tokens with live preview, allowed types, maximum size, submission channel, late policy); students drop a file onto the task; checks run entirely in the browser; results show a checklist with exact fixes, the corrected file name with a copy button, and where to submit.
- **Done when:** every rule violation in the test suite is caught, with zero false alarms on correct files.

### M23 · Workload heatmap and clash warning

- Class workload across all courses; week and term heatmaps with an equivalent table view that does not rely on color; while an instructor picks a due date, an inline notice shows that day's load and suggests lighter days (advisory, never blocking).
- **Done when:** suggestions match the domain tests; the view is understandable without color.

### M24 · Planner

- Weekly planner: drag tasks into study slots, with a full keyboard alternative; resize slots; conflicts with class times highlighted; undo and redo; planned work appears on Today.
- **Done when:** everything possible with a mouse is possible with a keyboard alone.

### M25 · Study Group Finder

- Groups per course (topic, capacity, time, place or online link); browse and filter; suggestions based on overlapping free time; join requests; group page.
- **Done when:** "find a study partner for a course" meets its M09 target.

### M26 · Notifications and focus mode

- Notification center; triggers for announcements, approaching deadlines, task changes and group requests; batched digests; quiet hours and manual focus mode; optional email digest; per-type preferences.
- **Done when:** nothing is delivered during quiet hours; every notification links to its source.

### M27 · Power features and polish

- Command palette (`Ctrl+K`); global search; keyboard shortcut reference (`?`); undo for every destructive action; contextual help and an optional short tour; installable PWA with offline support; motion that respects user preferences.
- **Done when:** every primary action is reachable both from the interface and from the command palette.

## Quality and launch

### M28 · Hardening

- Admin console; full accessibility audit (automated checks on every page in CI, keyboard-only pass, screen-reader pass, 200% zoom, right-to-left pass); complete end-to-end suite; security review against the OWASP Top 10 and a dependency audit; performance budget (Lighthouse ≥ 90 on mobile).
- **Done when:** all suites pass in CI with zero critical or serious accessibility violations.

### M29 · Usability benchmark

- Second formative round on the live app with an iteration log (issue → change → verified); comparative benchmark of the same tasks in the current chat + LMS + PDF workflow versus Sabaq, measuring completion rate, time on task, errors and SUS score; results with charts.
- **Done when:** every improvement claimed in the README is backed by this data.
- **Requires:** six or more participants.

### M30 · Launch v1.0.0

- Case study of the full design process; final README with screenshots and a demo animation; public demo account; changelog; `v1.0.0` tag and GitHub release.
- **Done when:** someone who has never heard of Sabaq can understand it, open it and use it from the README alone.
