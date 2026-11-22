# Sabaq — 30-Module Build Plan

Each module is built, verified, committed and pushed **on its own**, then reported before the next one starts.
For the product vision, see [00-vision-and-plan.md](00-vision-and-plan.md).

**How to read each module**

- **Goal**: why the module exists.
- **Depends on**: modules that must be finished first.
- **Deliverables**: the files and features it produces.
- **Steps**: the build order.
- **Definition of Done**: the checks that must pass before pushing.
- **🧑 Your part**: manual work only the team can do (accounts, real users, approvals).

**Commit convention:** `feat(M07): ...`, `docs(M09): ...` and so on (Conventional Commits, scoped by module).

## Overview

| Phase | Modules | Theme |
| --- | --- | --- |
| 0 · Foundation | M01–M04 | Repository, research kit, tooling, shared domain |
| A · Backend core | M05–M07 | API, database, authentication |
| 1–4 · Research and design | M08–M12 | Synthesis, personas, ideation, wireframes, formative testing |
| B · Frontend foundation | M13–M16 | Design system, app shell, auth screens, deployment |
| C · Features | M17–M27 | Every product feature, built full-stack |
| D · Quality and evaluation | M28–M30 | Hardening, summative evaluation, release |

**Why research modules sit after the backend core:** user research needs one to two weeks of real fieldwork. The research kit ships in M02 so fieldwork starts immediately. While the team is interviewing, M03–M07 build the parts that do not depend on research findings (tooling, database, login). No *interface* is designed until research is synthesized in M08–M09.

---

## Phase 0 · Foundation

### M01 · Repository foundation

- **Goal:** A clean, professional repository that explains the product truthfully from the first commit.
- **Depends on:** nothing.
- **Deliverables:** `README.md`, `LICENSE` (MIT), `.gitignore`, `.gitattributes` (LF line endings on all platforms), `.editorconfig`, `.nvmrc`, `.markdownlint.jsonc`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`; GitHub issue templates (bug, feature, **usability finding**) and a pull-request template; the monorepo folder skeleton (`apps/web`, `apps/api`, `packages/shared`, `docs/*`), each with a README stating its purpose; this plan and the vision document.
- **Steps:** write documents → create the skeleton → `git init` on `main` → first commit → push.
- **Definition of Done:** the repository renders cleanly on GitHub; no secrets or junk files tracked; every folder explains itself.
- **🧑 Your part:** add the repository description and topics on GitHub (text provided in the report).

### M02 · Research kit (fieldwork starts now)

- **Goal:** Give the team everything needed to run Phase 1 research with real students (CLO 4.1, CLO 2.1).
- **Depends on:** M01.
- **Deliverables** in `docs/research/`:
  - Research plan: research questions, hypotheses H1–H5, participant criteria (5–7 students across semesters, including one CR and, if possible, one instructor), schedule, ethics.
  - Semi-structured interview guide: warm-up, critical-incident questions ("tell me about the last deadline you nearly missed"), probes, wrap-up.
  - Contextual inquiry sheet for observing students in the library, cafeteria, labs and hostel, following the four principles from L09–10 (context, partnership, interpretation, focus).
  - Survey questionnaire, ready to paste into Google Forms, with Likert and multiple-choice items that test each hypothesis.
  - Consent and anonymization procedure (participants are coded P1–P7, no real names).
  - Raw-data templates for interview notes, observation logs and the survey export (CSV).
  - Design-rationale template (QOC format from L14 and Lab 11) plus the first record: *DR-001 platform choice (web PWA vs native mobile vs chatbot)*.
- **Definition of Done:** every instrument maps to at least one hypothesis; a dry run of the interview guide takes 20–30 minutes.
- **🧑 Your part:** run 5–7 interviews and 2–3 observation sessions; publish the survey to classmates (target 30+ responses). Fill in the templates. This runs in parallel with M03–M07.

### M03 · Monorepo tooling and continuous integration

- **Goal:** Make mistakes hard to commit (error prevention applied to our own process).
- **Depends on:** M01.
- **Deliverables:** npm workspaces root `package.json`; shared `tsconfig.base.json` with strict mode; ESLint (TypeScript and accessibility rules) and Prettier; Husky + lint-staged pre-commit hook; commitlint for the commit convention; GitHub Actions workflow running install → format check → lint → typecheck → test → build on every push and pull request; Dependabot configuration.
- **Definition of Done:** `npm run check` passes locally and in CI; a deliberately malformed commit message is rejected.

### M04 · Shared domain package

- **Goal:** One source of truth for data shapes and business rules, used by both the web app and the API.
- **Depends on:** M03.
- **Deliverables** in `packages/shared`:
  - Zod schemas and TypeScript types: User, Preferences, Class (section), Membership, Course, Announcement, Task, SubmissionRule, StudySlot, StudyGroup, Notification.
  - Role and permission matrix (student, CR, instructor, admin).
  - Pure domain logic with unit tests:
    - `checkSubmission(file, rule, now)`: validates naming pattern tokens (`{LAB_NO}`, `{SAPID}`, `{CLASS}` …), extension, size and deadline, and returns precise, human-readable fixes plus the corrected file name.
    - `computeDailyLoad(tasks, range)` and `findClashes(load, proposedDate)`: weighted workload per day and lighter alternative days.
    - `urgencyOf(task, now)`: overdue / due today / due this week / later.
- **Definition of Done:** 100% branch coverage on domain logic; the package builds for both Node and the browser.

## Phase A · Backend core

### M05 · API scaffold

- **Goal:** A production-grade Express server skeleton.
- **Depends on:** M04.
- **Deliverables** in `apps/api`: Express + TypeScript; environment variables validated with Zod at startup (the server refuses to start with bad config and explains why); structured logging (pino) with request IDs; central error handler returning a consistent `{ error: { code, message, details } }` shape; Helmet, CORS allow-list, rate limiting, request-size limits; `GET /api/health` (includes database status); graceful shutdown; Supertest tests.
- **Definition of Done:** server starts with `npm run dev -w apps/api`; tests and CI pass.

### M06 · Database: MongoDB Atlas models and seed data

- **Goal:** Persistent, well-indexed data in the cloud.
- **Depends on:** M05.
- **Deliverables:** Mongoose connection with retry and health reporting; models for every entity in M04 with indexes (unique email, unique join code, compound indexes for timeline queries); a seed script creating a realistic demo institution (Riphah-like programs, a BSCS 5-1 class, six courses, sample announcements and tasks) for demos and testing; integration tests against an in-memory MongoDB.
- **Definition of Done:** the seed runs against Atlas; tests pass without touching Atlas.
- **🧑 Your part:** create a free MongoDB Atlas account and an M0 cluster, add a database user, allow network access, and put the connection string in a local `.env` file (never committed). Step-by-step instructions come with the module.

### M07 · Authentication API

- **Goal:** Secure, complete account lifecycle.
- **Depends on:** M06.
- **Deliverables:** register (email, name, password, optional SAP ID); email verification link; login; short-lived access token plus rotating refresh token in an httpOnly, Secure, SameSite cookie, with reuse detection that revokes the whole session family; logout and "log out of all devices"; forgot and reset password with single-use expiring tokens; Argon2id hashing; account lockout and rate limits against brute force; `GET /api/me`; email sending via SMTP (logged to the console in development).
- **Definition of Done:** tests cover every success and failure path, including expired, reused and tampered tokens.
- **🧑 Your part:** create a free Brevo (or similar) SMTP account and add its credentials to `.env`.

## Phases 1–4 · Research and design

### M08 · Research synthesis

- **Goal:** Turn raw fieldwork into evidence (CLO 4.1).
- **Depends on:** M02 fieldwork completed by the team.
- **Deliverables** in `docs/research/`: anonymized interview and observation notes; affinity map (codes → themes → insights); survey analysis with charts; a verdict on each hypothesis H1–H5 (confirmed, rejected or modified, with quotes); behavioral variables mapped per participant (L08 method for persona construction).
- **Definition of Done:** every insight cites at least two data sources.
- **🧑 Your part:** supply the completed notes and survey CSV.

### M09 · Personas, goals, problem statement, task analysis and usability targets

- **Goal:** Define who we design for and what success means.
- **Depends on:** M08.
- **Deliverables** in `docs/design/`: 1 primary and 1–2 secondary personas built with the L08 template (overview, a day in the life, goals, fears, skills, technology attitudes), each with experience, end and life goals (L09); problem statements in the form "*[Persona] needs a way to [need] because [insight]*"; stakeholder map; scenarios and essential use cases; hierarchical task analysis (HTA) for the core tasks (check what is due, submit correctly, post an announcement, set a deadline); measurable usability requirements, for example "a first-time user finds their next deadline in under 10 seconds" and "the Submission Checker catches 100% of naming errors in tests".
- **Definition of Done:** every persona attribute traces back to M08 evidence.

### M10 · Ideation, concepts and design rationale

- **Goal:** Explore multiple solutions before committing (CCP attribute: conflicting requirements).
- **Depends on:** M09.
- **Deliverables:** brainstorm log; 3–4 distinct concept sketches (for example: a chat-bot concept, a calendar-first concept, a feed-first concept, a dashboard-first concept), each with a storyboard; QOC design space analysis selecting the concept, with criteria taken from the usability targets; design-rationale records for each major decision.
- **Definition of Done:** the selected concept is justified against explicit criteria, and rejected options are documented.
- **🧑 Your part:** hand-draw or digitally draw the sketches and storyboards (photos go into the repo); scripted descriptions are provided.

### M11 · Information architecture, user flows and low-fidelity prototype

- **Goal:** A testable structure before any visual design (L14 low fidelity).
- **Depends on:** M10.
- **Deliverables:** site map; conceptual model (objects, actions, relationships, per Norman); user flows for every core task; paper-prototype guidance; a **clickable low-fidelity HTML wireframe** in grayscale of every core screen, hosted alongside the docs so testers can open it on any device.
- **Definition of Done:** every core task from M09 can be completed end to end in the wireframe.

### M12 · Formative usability testing, round 1

- **Goal:** Find major problems while they are cheap to fix (CLO 5.1).
- **Depends on:** M11.
- **Deliverables** in `docs/testing/round-1/`: test plan in the Lab 10 format (tasks, criteria, contexts, participant tables, rule of thumb); think-aloud protocol script; observation and timing sheets; heuristic evaluation kit for classmates (Nielsen's 10, severity scale 0–4, issues-by-evaluator matrix); test report with quotes and a prioritized issue list; redesign decisions linked to each issue (feeds M13 onward).
- **Definition of Done:** every severity 3–4 issue has a planned fix.
- **🧑 Your part:** run 5 think-aloud sessions and recruit 3–5 classmates as heuristic evaluators.

## Phase B · Frontend foundation

### M13 · Design system and style guide

- **Goal:** A consistent, accessible visual language (Lab 7, CLO 3.1).
- **Depends on:** M12.
- **Deliverables** in `apps/web`: design tokens (color, typography, spacing, radius, elevation, motion); three themes (light, dark, high contrast), all text meeting WCAG AA contrast (AAA in high contrast); a fluid type scale that responds to the user's font-size preference; density modes (comfortable, compact); reduced-motion support; component library on Radix primitives (button, input, select, checkbox, radio, switch, dialog, sheet, tabs, toast, tooltip, badge, card, empty state, skeleton, avatar, date picker); visible focus rings everywhere; a living **style guide page** inside the app; `docs/design-system/` summary.
- **Definition of Done:** automated contrast check passes for every token pair; every component is keyboard operable; axe reports zero violations on the style guide page.

### M14 · Web app scaffold and app shell

- **Goal:** The frame every screen lives in.
- **Depends on:** M13.
- **Deliverables:** Vite + React + TypeScript; routing with protected routes; TanStack Query; API client with automatic token refresh and an honest "waking the server" state; i18n (English and Urdu) with right-to-left layout; app shell (sidebar on desktop, bottom navigation on mobile, breadcrumbs, page titles); "skip to content" link; error boundary with recovery; 404 page; responsive layout from 320 px to wide screens.
- **Definition of Done:** works on phone and desktop; keyboard-only navigation reaches everything; Lighthouse accessibility score of 100.

### M15 · Authentication screens

- **Goal:** Register and log in without friction or confusion.
- **Depends on:** M07, M14.
- **Deliverables:** register, login, verify email, resend verification, forgot password, reset password; inline validation on blur with plain-language messages (Nielsen #9); password strength meter and show/hide toggle; Caps Lock warning; autofocus and correct autocomplete attributes so password managers work; clear loading and success states; session-expired handling that returns the user to where they were.
- **Definition of Done:** Playwright tests cover every auth flow; zero axe violations.

### M16 · Deployment pipeline

- **Goal:** Sabaq is usable by anyone, anywhere, from here on.
- **Depends on:** M15.
- **Deliverables:** Render service for the API (build and start commands, health check, environment variables); Vercel project for the web app with the `/api` rewrite to Render; production Atlas database and network rules; CI deploys `main` automatically; `docs/deployment.md` runbook; README shows the live link.
- **Definition of Done:** register → verify email → log in works on the live site from a phone on mobile data.
- **🧑 Your part:** create Vercel and Render accounts, connect the GitHub repository, and paste environment variables when prompted (exact steps provided).

## Phase C · Features (each built full-stack: API + UI + tests)

### M17 · Classes and membership

- **Deliverables:** instructors and CRs create a class (program, section, session) and its courses (code, title, schedule, venue, color); a join code and shareable link with QR code; students join, the CR role is assigned by the instructor; member list and role management; leave a class; permission checks on every endpoint.
- **Definition of Done:** a student can join with a code in under 30 seconds; unauthorized actions are rejected with clear messages.

### M18 · Onboarding, profile and personalization

- **Deliverables:** first-run onboarding (role, SAP ID, join class) with progress indication and a skip option; profile page; settings page for theme, font size, density, language, reduced motion, notification preferences and quiet hours; settings persist per account and apply instantly; delete account and export my data.
- **Definition of Done:** a new user is set up in under 2 minutes; every preference survives logging in on a new device.

### M19 · Structured announcements and "seen by" receipts

- **Deliverables:** typed announcements (deadline, exam/quiz, venue change, cancellation, material, general) with type-specific fields; creating a deadline-type announcement also creates the task for every member; edit with change history ("updated 2 h ago: venue changed"); pin; receipts recorded when an announcement is viewed; the sender sees counts and the list of who has not seen it; student inbox with filters and unread state.
- **Definition of Done:** an announcement posted by a CR appears for every class member, and receipts update.

### M20 · Paste-to-structure assistant

- **Deliverables:** a parser in `packages/shared` that extracts date and time (including relative forms like "next Wednesday 11 pm"), course code or name, venue, task type and naming pattern from free text; the CR sees the extracted fields highlighted and confirms or edits them before posting (the system suggests, the human decides); a test corpus built from realistic, anonymized class messages.
- **Definition of Done:** at least 90% field accuracy on the test corpus; nothing is posted without confirmation.

### M21 · Today and Timeline

- **Deliverables:** **Today** screen (overdue, due today, next 7 days, today's classes and venues); **Timeline** with list, week and month views; filters by course and type; mark as done with undo; personal tasks; countdowns; empty states that teach; offline cache of the timeline.
- **Definition of Done:** meets the M09 target for finding the next deadline; works offline after the first load.

### M22 · Submission Checker

- **Deliverables:** instructors attach a submission rule to any task (naming pattern built from tokens with a live preview, allowed file types, maximum size, channel, late policy); students drag a file onto the task, or pick one; the check runs **entirely in the browser** (files are never uploaded to Sabaq, which protects privacy); results show a checklist with exact fixes, the corrected name with a copy button, and a reminder of the submission channel ("upload on Moellim, email not accepted").
- **Definition of Done:** catches every rule violation in the test suite; zero false alarms on correct files.

### M23 · Workload heatmap and deadline-clash warning

- **Deliverables:** class workload API computed from all courses; heatmap view (week and semester) for students, with an accessible text and table alternative to color; while an instructor picks a due date, an inline warning shows the class's load on that day and suggests lighter days (never blocks; the instructor decides).
- **Definition of Done:** clash suggestions match the domain-logic tests; the heatmap is understandable without color.

### M24 · Planner

- **Deliverables:** weekly planner where students drag tasks into study slots (dnd-kit) with a full keyboard alternative ("move to Tuesday 4 pm"); resize slots; conflicts with class schedules highlighted; undo and redo; the planned time appears on Today.
- **Definition of Done:** everything possible with the mouse is also possible with the keyboard alone.

### M25 · Study Group Finder

- **Deliverables:** create a group per course (topic, capacity, time, place or online link); browse and filter; match suggestions based on overlapping free time from the planner; join requests with approve or decline; group page with members and next meeting.
- **Definition of Done:** the task "find a study partner for SE3223" completes within the M09 target.

### M26 · Notifications and focus mode

- **Deliverables:** in-app notification center; triggers for new announcements, approaching deadlines, changes to a task, group requests; batching into digests to protect attention; quiet hours and a manual focus mode; optional email digest; per-type preferences.
- **Definition of Done:** no notification arrives during quiet hours; every notification links to its source.

### M27 · Power features and polish

- **Deliverables:** command palette (`Ctrl+K`) for navigation and actions; global search across announcements, tasks, courses and groups; keyboard shortcut help (`?`); undo toasts for every destructive action; contextual help and a short optional product tour; PWA install and offline support; final micro-interactions that respect reduced motion.
- **Definition of Done:** every primary action is reachable through both the interface and the command palette.

## Phase D · Quality and evaluation

### M28 · Hardening: admin, accessibility, testing, security, performance

- **Deliverables:** admin console (programs, classes, users, roles); full accessibility audit (axe on every page in CI, manual keyboard-only pass, NVDA screen-reader pass, 200% zoom, Urdu RTL pass) with a report in `docs/testing/accessibility.md`; complete Playwright end-to-end suite for every flow; security review (OWASP Top 10 checklist, dependency audit, headers, rate limits); performance budget (Lighthouse ≥ 90 on mobile in all categories).
- **Definition of Done:** CI green with all suites; zero critical or serious accessibility violations.

### M29 · Round 2 testing and summative evaluation

- **Goal:** Prove the product works better than today's workflow (CLO 5.1; required for an "Excellent" grade).
- **Deliverables** in `docs/testing/`: round-2 formative test on the live high-fidelity app with an iteration log (issue → change → verified with users); **comparative summative test**: the same tasks done with WhatsApp + Moellim + PDF versus with Sabaq, measuring completion rate, time on task, error count and SUS score; statistical summary with charts; final accessibility check against the inclusive-design standards (CLO 3.1).
- **Definition of Done:** every claim in the README is backed by data from this module.
- **🧑 Your part:** run the sessions with 6+ participants (session scripts and data sheets provided).

### M30 · Portfolio, presentation and release

- **Deliverables:** design portfolio (`docs/portfolio.md`) covering all six phases with evidence links; a 5–10 minute presentation deck and a demo script with a ready demo account; final README with screenshots and a demo GIF; `CHANGELOG.md` for v1.0.0; Git tag and GitHub Release `v1.0.0`; deployment check.
- **Definition of Done:** a person who has never seen Sabaq can understand, open and use it from the README alone.
- **🧑 Your part:** present.
