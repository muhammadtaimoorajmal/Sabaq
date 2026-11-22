<div align="center">

# Sabaq · سبق

**Your semester, in one calm place.**

An open-source academic companion that brings every deadline, announcement and submission rule into one structured place, so students stop missing deadlines and stop losing marks to avoidable mistakes.

[![CI](https://github.com/muhammadtaimoorajmal/Sabaq/actions/workflows/ci.yml/badge.svg)](https://github.com/muhammadtaimoorajmal/Sabaq/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-in%20development-orange)](docs/roadmap.md)
[![Roadmap](https://img.shields.io/badge/roadmap-6%20of%2030%20milestones-blue)](#roadmap)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[Vision](docs/vision.md) · [Roadmap](docs/roadmap.md) · [Documentation](docs/README.md) · [Contributing](CONTRIBUTING.md)

</div>

---

> [!NOTE]
> Sabaq is under active development and is not usable yet. This README only describes what already exists; the live app will be linked here once it is deployed.

## Why Sabaq

Course information usually arrives through channels that were never designed for it: chat groups, the learning management system (LMS), PDF handouts and verbal reminders. The result:

- **Announcements get buried.** A deadline posted in a busy chat group is easy to miss.
- **Rules hide in documents.** File-naming rules such as `Lab11_<StudentID>_<Section>` sit inside a PDF, and a wrong name can cost marks.
- **Workload is invisible.** Nobody, student or instructor, can see when several courses pile deadlines onto the same day.
- **Senders fly blind.** Whoever posts an announcement never knows whether the class actually saw it.

## What Sabaq does

| Feature | What it does |
| --- | --- |
| **Today and Timeline** | Every deadline, quiz and class across all courses, ordered by urgency |
| **Structured Announcements** | One post by a class representative or instructor becomes a deadline in every student's timeline |
| **"Seen by" receipts** | Senders see how many students have seen each announcement |
| **Paste-to-Structure Assistant** | Paste a chat-style message; Sabaq drafts a structured announcement for you to confirm |
| **Submission Checker** | Checks a file's name, type, size and timing against the assignment's rules before upload, entirely in the browser |
| **Workload Heatmap and Clash Warning** | Shows crunch days, and warns instructors when a new deadline lands on an already busy day |
| **Planner** | Drag tasks into study slots, with a full keyboard alternative |
| **Study Group Finder** | Find or form study groups for each course |
| **Focus and personalization** | Quiet hours; light, dark and high-contrast themes; text size; density; multiple languages including right-to-left |

### What makes it different

Learning management systems, calendars and to-do apps already exist, but none of them:

1. turn **one** announcement into a correct deadline for the **whole class**;
2. check **submission rules before upload**;
3. warn instructors about **deadline clashes across courses**;
4. accept **the way classes already communicate** (pasted chat messages);
5. tell senders **who has actually seen** an announcement.

Read the full reasoning in the [product vision](docs/vision.md).

## Who it is for

| Role | Uses Sabaq to |
| --- | --- |
| **Students** | See what is due, submit correctly, plan the week, find study partners |
| **Class representatives** | Post announcements once instead of answering the same questions again and again |
| **Instructors** | Set deadlines with clear rules, avoid overloading the class, confirm information arrived |
| **Admins** | Manage programs, classes and users |

## Designed with users, not just for them

Sabaq follows a user-centered design process: field research → personas and task analysis → competing concepts → low-fidelity prototypes → usability testing → iteration → a measured benchmark against today's workflow. Research instruments, findings, design decisions and test results are all published in [`docs/`](docs/README.md).

Accessibility is a requirement, not a feature: every screen is built to work with a keyboard alone, with screen readers, at 200% zoom, in high contrast and in right-to-left languages.

## Architecture

```mermaid
flowchart LR
    U["Browser<br/>(phone or laptop)"] --> W["Web app<br/>React + TypeScript<br/>Vercel"]
    W -->|"/api (same-origin proxy)"| A["REST API<br/>Node.js + Express<br/>Render"]
    A --> D[("MongoDB Atlas")]
```

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, i18next |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | MongoDB Atlas with Mongoose |
| Shared | Zod schemas and domain logic used by both frontend and backend |
| Testing | Vitest, Supertest, Playwright, axe-core |
| Hosting | Vercel (web), Render (API), MongoDB Atlas (data) |

## Repository structure

```text
Sabaq/
├── apps/
│   ├── web/          React frontend
│   └── api/          Express backend
├── packages/
│   └── shared/       Types, validation schemas and domain logic
├── docs/             Vision, roadmap, research, design, decisions, testing
└── .github/          Workflows and templates
```

## Getting started

**Requirements:** [Node.js](https://nodejs.org/) 22.12 or newer (see [`.nvmrc`](.nvmrc)) and Git.

```bash
git clone https://github.com/muhammadtaimoorajmal/Sabaq.git
cd Sabaq
npm install        # also installs the Git hooks
npm run check      # everything CI runs: format, lint, docs, types, tests
```

| Script | What it does |
| --- | --- |
| `npm run dev:api` | Starts the API at `http://localhost:4000` with automatic restarts and a temporary demo database |
| `npm run check` | Runs every check below, exactly as continuous integration does |
| `npm run format` | Formats code and configuration with Prettier |
| `npm run lint` | Lints code with ESLint, including accessibility rules for interface files |
| `npm run lint:md` | Lints the documentation with markdownlint |
| `npm run lint:links` | Verifies that every link and heading anchor in the documentation resolves |
| `npm run typecheck` | Type-checks with TypeScript in strict mode |
| `npm run test` | Runs all tests with coverage (domain logic must stay at 100%) |
| `npm run build` | Builds every workspace package |

The API and its database are in place ([`apps/api`](apps/api/README.md), [data model](docs/data-model.md)); no database setup is needed for development. The web app arrives in later milestones; see the [roadmap](#roadmap).

## Roadmap

Sabaq is built in 30 milestones, each verified before release. Details are in the [roadmap](docs/roadmap.md).

**Foundation**

- [x] M01 · Repository foundation
- [x] M02 · User research kit
- [x] M03 · Tooling and continuous integration
- [x] M04 · Shared domain package

**Backend core**

- [x] M05 · API scaffold
- [x] M06 · Database
- [ ] M07 · Authentication API

**Research and design**

- [ ] M08 · Research synthesis
- [ ] M09 · Personas, goals, task analysis, usability targets
- [ ] M10 · Ideation and concept selection
- [ ] M11 · Information architecture and low-fidelity prototype
- [ ] M12 · Formative usability testing

**Frontend foundation**

- [ ] M13 · Design system
- [ ] M14 · App shell
- [ ] M15 · Authentication screens
- [ ] M16 · Deployment

**Features**

- [ ] M17 · Classes and membership
- [ ] M18 · Onboarding, profile and personalization
- [ ] M19 · Structured announcements and receipts
- [ ] M20 · Paste-to-structure assistant
- [ ] M21 · Today and Timeline
- [ ] M22 · Submission Checker
- [ ] M23 · Workload heatmap and clash warning
- [ ] M24 · Planner
- [ ] M25 · Study Group Finder
- [ ] M26 · Notifications and focus mode
- [ ] M27 · Power features and polish

**Quality and launch**

- [ ] M28 · Hardening
- [ ] M29 · Usability benchmark
- [ ] M30 · Launch v1.0.0

## Contributing

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Usability problems count as bugs: report them with the **Usability finding** issue form.

## License

[MIT](LICENSE) © 2026 Muhammad Taimoor Ajmal
