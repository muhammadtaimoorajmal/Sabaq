# @sabaq/shared

Schemas, types and domain logic shared by the Sabaq web app and API. Validation rules and business logic are written once, tested once, and behave identically in the browser and on the server.

Everything here is **pure**: no network, no database, no browser APIs. Domain logic has **100% test coverage**, enforced in CI.

## Contents

### Schemas (`src/schemas/`)

[Zod](https://zod.dev/) schemas, with TypeScript types inferred from them, for every entity and API input:

| Module | Covers |
| --- | --- |
| `api` | The API's error format and error codes, health and readiness responses |
| `common` | Identifiers, ISO dates, day keys, times of day, time zones, color tokens, URLs, pagination |
| `user` | Users, preferences (theme, text size, density, language, motion, quiet hours …), profile updates |
| `auth` | Registration, login, email verification, password reset and change |
| `class` | Classes, memberships and roles, join codes |
| `course` | Courses and their weekly sessions |
| `task` | Class and personal tasks |
| `submission-rule` | Naming patterns, allowed file types, size limits, submission channel, late policy |
| `announcement` | Typed announcements, edit history, "seen by" receipts |
| `agenda` | Tasks and class meetings for a range of days, with each task's course, class and permissions |
| `workload` | Daily load and level for a range of up to 190 days, and the tasks behind it |
| `planner` | Study slots |
| `study-group` | Study groups and join requests |
| `notification` | Language-independent notifications |

### Domain logic (`src/domain/`)

| Module | What it does |
| --- | --- |
| `submission` | **Submission Checker**: compares a file's name, extension, real content, size and timing with a task's rules, explains why a name is wrong (spaces, separators, a doubled extension, a "(1)" copy suffix) and returns the exact file name to use; fills the student's details into a naming pattern and reads the task number from its title |
| `file-kind` | Recognizes what a file really is from its first bytes (PDF, Word, Excel, PowerPoint, OpenDocument, ZIP, older Office, images, archives, plain text), so a renamed file is caught |
| `workload` | Daily workload per calendar day, load levels, and **deadline-clash assessment** with lighter-day suggestions |
| `urgency` | Overdue / today / tomorrow / next 7 days / later, judged in the class's time zone |
| `time` | Time-zone-correct calendar-day arithmetic, and the instant of a wall-clock time in a time zone (such as 23:59 class time), including daylight-saving transitions |
| `permissions` | The role-and-action matrix for students, class representatives, instructors and admins |
| `join-code` | Secure, unambiguous class join codes |
| `announcements` | Which fields an edit really changed, which changes members must hear about again, and when a notification may be delivered given someone's quiet hours |
| `paste` | **Paste-to-structure**: reads a chat-style message into a draft announcement (type, kind of task, course, date and time, venue, file-naming rule, file types, where to submit), with the exact span of text behind every detail |
| `agenda` | Each day's class meetings from the weekly timetable, in the class's time zone and placed on the viewer's calendar, with announced cancellations and room changes applied |
| `preferences` | Merging partial preference updates, and the database paths a partial update changes |

### Paste-to-structure

`parsePastedMessage(text, { now, timeZone, courses })` never posts anything: it returns a draft for the sender to check, and `matches` says where each detail came from so the interface can highlight it.

It reads English and Roman Urdu as classes write them: relative days ("tomorrow", "next Wed", "kal", "parson", "in 3 days"), dates in several forms (28/11, 28th Nov, Nov 28, 2026-11-28), times ("11pm", "23:59", "noon", "raat 11 baje"), course codes, full titles, initials such as HCI and distinctive first words such as "Database". Its conventions:

- Numeric dates are day first; a date without a year that has passed means next year.
- A weekday means its next occurrence after today ("this Thursday" can be today).
- A time from 1 to 7 without am/pm is in the afternoon; "midnight" means 23:59 of that day.
- Without a time, a deadline is due at 23:59; a quiz or class change uses the course's class time that day (and its room), or 09:00. Assumed times are flagged with `timeAssumed`.
- "Shifted" or "moved" is a venue change only when a place is named.

**Accuracy.** A corpus of 40 realistic, synthetic messages (`paste-corpus.test.ts`) must stay at 90% field accuracy or better; it is currently 100%, but it was written alongside the parser. A second set of 15 messages in other wording (`paste-holdout.test.ts`) was written afterwards to estimate accuracy on unfamiliar phrasing: 82.4% on first run, 98% after fixing the general gaps it revealed. Known limit: course nicknames that are not the code, title, initials or first word (such as "DBMS") are not recognised.

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
