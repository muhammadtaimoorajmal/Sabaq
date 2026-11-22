# Data model

Sabaq stores its data in MongoDB through Mongoose models in [`apps/api/src/db/models`](../apps/api/src/db/models). The shapes match the shared Zod schemas in [`@sabaq/shared`](../packages/shared/README.md), which validate everything at the API boundary.

## Entities

```mermaid
erDiagram
    USER ||--o{ MEMBERSHIP : "belongs to classes"
    CLASS ||--o{ MEMBERSHIP : "has members"
    CLASS ||--o{ COURSE : offers
    CLASS ||--o{ TASK : "class tasks"
    USER ||--o{ TASK : "personal tasks"
    CLASS ||--o{ ANNOUNCEMENT : publishes
    ANNOUNCEMENT |o--o| TASK : creates
    ANNOUNCEMENT ||--o{ ANNOUNCEMENT_RECEIPT : "seen by"
    TASK ||--o{ TASK_COMPLETION : "done by"
    USER ||--o{ STUDY_SLOT : plans
    COURSE ||--o{ STUDY_GROUP : "study groups"
    STUDY_GROUP ||--o{ JOIN_REQUEST : receives
    USER ||--o{ NOTIFICATION : receives
```

| Collection | Holds | Notes |
| --- | --- | --- |
| `users` | Accounts and personal preferences | E-mail stored lowercase; the password hash (Argon2id) is never returned unless explicitly requested |
| `classes` | A cohort, such as one section of a program in one term | Has its own time zone, in which "due today" is judged, and a unique join code |
| `memberships` | A person's role in a class: student, class representative or instructor | Platform administrators are a separate role on the user |
| `courses` | Subjects taught to a class, with weekly timetable | Course codes are unique within a class, ignoring letter case |
| `tasks` | Deadlines: assignments, labs, quizzes, exams and more | Either a class task (everyone sees it) or a personal task, never both; may carry submission rules |
| `task_completions` | A person marking a task as done | One per person per task |
| `announcements` | Typed posts: deadline, assessment, venue change, cancellation, material, general | Deadline and assessment posts create a class task; every edit is kept in `edits` |
| `announcement_receipts` | A person having seen an announcement | Powers "Seen by" counts |
| `study_slots` | Time blocks in a person's planner | At most 12 hours each |
| `study_groups` | Groups formed around a course | Members never exceed capacity; meet in person or online |
| `study_group_join_requests` | Requests to join a group | One pending request per person per group |
| `notifications` | In-app notifications as message keys and parameters | Translated by the interface; deleted automatically after 180 days |

Authentication sessions and one-time e-mail tokens are added with the authentication API.

## Indexes

Every index serves a screen or a rule:

| Collection | Index | Purpose |
| --- | --- | --- |
| `users` | `email` (unique) | Sign-in; one account per address |
| `classes` | `joinCode` (unique) | Joining a class with a code |
| `memberships` | `classId + userId` (unique), `userId`, `classId + role` | One membership per class; "my classes"; member lists by role |
| `courses` | `classId + code` (unique, case-insensitive) | No duplicate course codes in a class |
| `tasks` | `classId + dueAt`, `ownerId + dueAt`, `announcementId` | Timelines in due-date order; the task created by an announcement |
| `task_completions` | `userId + taskId` (unique), `taskId` | "Done" state; completion counts |
| `announcements` | `classId + pinned + createdAt`, text on `title` and `body` | The class feed, pinned first; search |
| `announcement_receipts` | `announcementId + userId` (unique), `userId + classId` | "Seen by"; unseen counts |
| `study_slots` | `userId + start` | The planner's week view |
| `study_groups` | `classId + courseId`, `memberIds` | Browsing groups; "my groups" |
| `study_group_join_requests` | `groupId + userId` (unique while pending), `groupId + status` | No duplicate requests; the owner's inbox |
| `notifications` | `userId + deliverAt`, `userId + readAt`, `createdAt` (expires) | Notification list; unread count; automatic clean-up |

Indexes are created when the API connects; existing indexes are never dropped automatically.

## Conventions

- **Absent values are `null`**, never missing fields, so documents always have the same shape.
- **Times are stored as UTC instants.** Calendar logic (today, this week, workload per day) converts them in the class's time zone using the shared domain functions.
- **JSON output** uses a string `id` instead of `_id` and omits internal fields.
- **Untrusted input never reaches a query unvalidated.** Route handlers parse input with the shared Zod schemas first, so an object can never arrive where a string is expected (the classic query-injection vector).

## Demo data

`npm run db:seed -w @sabaq/api` (or `npm run dev:api` without a database) creates a fictional institution: one class with six courses, an instructor, a class representative, 23 students and an administrator; a semester of deadlines relative to today, including one deliberately overloaded day; announcements with receipts and an edit history; study groups, join requests, planner slots and notifications. All accounts use the password `sabaq-demo`, and all addresses use the reserved `.example` domain.

| Role | E-mail |
| --- | --- |
| Student | `zara.ahmed@northfield.example` |
| Class representative | `hamza.khan@northfield.example` |
| Instructor | `ayesha.siddiqui@northfield.example` |
| Administrator | `admin@northfield.example` |
