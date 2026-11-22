# @sabaq/shared

Schemas, types and domain logic shared by the Sabaq web app and API. Validation rules and business logic are written once, tested once, and behave identically in the browser and on the server.

Everything here is **pure**: no network, no database, no browser APIs. Domain logic has **100% test coverage**, enforced in CI.

## Contents

### Schemas (`src/schemas/`)

[Zod](https://zod.dev/) schemas, with TypeScript types inferred from them, for every entity and API input:

| Module | Covers |
| --- | --- |
| `common` | Identifiers, ISO dates, day keys, times of day, time zones, color tokens, URLs, pagination |
| `user` | Users, preferences (theme, text size, density, language, motion, quiet hours …), profile updates |
| `auth` | Registration, login, email verification, password reset and change |
| `class` | Classes, memberships and roles, join codes |
| `course` | Courses and their weekly sessions |
| `task` | Class and personal tasks |
| `submission-rule` | Naming patterns, allowed file types, size limits, submission channel, late policy |
| `announcement` | Typed announcements, edit history, "seen by" receipts |
| `planner` | Study slots |
| `study-group` | Study groups and join requests |
| `notification` | Language-independent notifications |

### Domain logic (`src/domain/`)

| Module | What it does |
| --- | --- |
| `submission` | **Submission Checker**: compares a file's name, extension, size and timing with a task's rules and returns the exact file name to use |
| `workload` | Daily workload per calendar day, load levels, and **deadline-clash assessment** with lighter-day suggestions |
| `urgency` | Overdue / today / tomorrow / next 7 days / later, judged in the class's time zone |
| `time` | Time-zone-correct calendar-day arithmetic, including daylight-saving transitions |
| `permissions` | The role-and-action matrix for students, class representatives, instructors and admins |
| `join-code` | Secure, unambiguous class join codes |

## Design principles

- **Results are codes, not sentences.** Functions return message keys such as `name.mismatch` with parameters, so the interface can present them in any language.
- **Time zones are explicit.** Every date calculation takes the class's IANA time zone, so "due today" means today where the class is.
- **Advice, never enforcement.** Clash detection and checks inform people; they do not block them.

## Example

```ts
import { checkSubmission } from '@sabaq/shared';

const result = checkSubmission({
  file: { name: 'lab11 final.docx', size: 2048 },
  rule: {
    namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}',
    caseSensitive: false,
    allowedExtensions: ['pdf'],
    maxSizeMB: 5,
    channel: { kind: 'lms', label: null, url: null },
    latePolicy: { kind: 'not_accepted', graceMinutes: 0 },
  },
  dueAt: '2026-11-25T18:59:00Z',
  now: new Date(),
  values: { TASK_NO: '11', STUDENT_ID: '12345' },
});

result.verdict; // 'fix'
result.expectedFileName; // 'Lab11_12345.pdf'
result.checks.map((check) => check.code);
// ['name.mismatch', 'extension.not_allowed', 'size.ok', 'deadline.on_time', 'channel.lms']
```

## Scripts

Run from the repository root:

| Command | What it does |
| --- | --- |
| `npm run build -w @sabaq/shared` | Compiles to `dist/` (JavaScript, type declarations and source maps) |
| `npm run typecheck -w @sabaq/shared` | Type-checks sources and tests |
| `npm test` | Runs all tests with coverage (root command) |
