# @sabaq/api

The Sabaq REST API: Node.js, Express 5 and TypeScript. It shares its validation schemas and domain logic with the web app through [`@sabaq/shared`](../../packages/shared/README.md).

> [!NOTE]
> The server, database and authentication are in place; feature endpoints arrive with each feature. See the [roadmap](../../docs/roadmap.md).

## Running locally

From the repository root:

```bash
npm install
npm run dev:api      # http://localhost:4000, restarts on every change
```

No database or account is needed: without `MONGODB_URI`, development mode starts a temporary MongoDB on your computer and fills it with [demo data](../../docs/data-model.md#demo-data). The first start downloads MongoDB once (it is cached afterwards); changes are lost when the server stops.

To use a persistent database, follow the [MongoDB Atlas guide](../../docs/guides/mongodb-atlas.md) and copy [`.env.example`](.env.example) to `.env`. Development mode reads `@sabaq/shared` straight from its TypeScript sources, so changes there apply immediately without a build.

| Command (from the repository root) | What it does |
| --- | --- |
| `npm run dev:api` | Starts the API with automatic restarts and readable logs |
| `npm run build` | Compiles every package, including the API, to `dist/` |
| `npm start -w @sabaq/api` | Runs the compiled API, as in production |
| `npm run db:seed -w @sabaq/api` | Loads the demo institution into the database in `MONGODB_URI` (add `-- --reset` to replace existing Sabaq data) |
| `npm test` | Runs all tests with coverage |

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | **Liveness.** Answers instantly without touching any dependency, so the web app can also use it to wake a sleeping server |
| `GET /api/health/ready` | **Readiness.** Pings the database and answers `503` when it is unreachable |
| `GET /api` | Name and version of the API |
| `GET /api/dev/mail` | **Development only.** The e-mails the API would have sent (newest first; filter with `?to=`), so verification and password links can be opened without a mail account. Never available in production or when SMTP is configured |

### Authentication (`/api/auth`)

| Method and path | Purpose |
| --- | --- |
| `POST /register` | Create an account (`name`, `email`, `password`, optional `studentId`); signs in and e-mails a verification link |
| `POST /login` | Sign in with e-mail and password |
| `POST /refresh` | Exchange the refresh cookie for a new access token (and a new cookie) |
| `POST /logout` | Sign out this device |
| `POST /logout-all` | Sign out every device |
| `GET /me` | The signed-in user |
| `GET /sessions` | Signed-in devices, such as "Chrome on Windows" |
| `DELETE /sessions/:id` | Sign out one device |
| `POST /verify-email` | Confirm an address with the token from the e-mailed link |
| `POST /resend-verification` | Send a new verification link |
| `POST /forgot-password` | E-mail a password reset link |
| `POST /reset-password` | Set a new password with the token from the link; signs out every device |
| `POST /change-password` | Change the password (needs the current one); signs out other devices |

### Classes (`/api/classes`)

Every route needs a session. People outside a class get `404`, so class identifiers reveal nothing; members without permission get `403` with a message saying who may do it.

| Method and path | Purpose | Who |
| --- | --- | --- |
| `GET /` | My classes, with my role and the member count | Anyone |
| `POST /` | Create a class (`myRole`: class representative or instructor) | Anyone |
| `POST /join` | Join with a code (case and separators ignored); joining again just opens the class | Anyone |
| `GET /:id` | The class, including its join code | Members |
| `PATCH /:id` | Edit name, section, program, term, institution, time zone | Instructors, class representatives |
| `DELETE /:id` | Remove (archive) the class for everyone | Instructors, the creator |
| `POST /:id/join-code` | Replace the join code; the old one stops working | Instructors, class representatives |
| `GET /:id/members` | Members by role, then name | Members |
| `PATCH /:id/members/:userId` | Change a role; only instructors appoint or change instructors | Instructors, class representatives |
| `DELETE /:id/members/:userId` | Remove someone, or leave (your own id) | Managers; anyone for themselves |
| `GET /:id/courses` | Courses with their weekly timetable | Members |
| `POST`, `PATCH`, `DELETE /:id/courses/…` | Manage courses; codes are unique per class, ignoring case | Instructors, class representatives |

A class always keeps at least one instructor or class representative: the last one cannot leave or step down (`last_manager`).

### Announcements

The feed covers every class the person belongs to; posting and managing happen in one class.

| Method and path | Purpose | Who |
| --- | --- | --- |
| `GET /api/announcements` | The feed: pinned first (on the first page), then newest. Filters: `classId`, `type`, `unread=true`, `q` (words in the title or body), `before` and `limit` for paging | Members |
| `GET /api/announcements/unread` | Unread counts, in total and per class | Members |
| `POST /api/announcements/seen` | Record that announcements were seen (`ids`, up to 100); unknown ones are ignored | Members |
| `POST /api/classes/:id/announcements` | Post one of six types: `deadline` and `assessment` (with `dueAt`, `taskType`; they create one class task for every member), `venue_change` (`startsAt`, `venue`), `cancellation` (`startsAt`), `material`, `general` | Instructors, class representatives |
| `PATCH /api/classes/:id/announcements/:announcementId` | Edit; every change is recorded with the fields that changed. Pinning is not an edit. Changing `dueAt`, `startsAt` or `venue` makes it unread again for everyone and notifies them; the class task follows | The author, instructors |
| `DELETE /api/classes/:id/announcements/:announcementId` | Delete, with its task, receipts and notifications | The author, instructors |
| `GET /api/classes/:id/announcements/:announcementId/receipts` | Who has seen it and who has not (current members other than the author) | Instructors, class representatives |

Members are notified of new posts and important changes. A notification created during someone's quiet hours is delivered when they end, in that person's time zone.

### Agenda and tasks

| Method and path | Purpose |
| --- | --- |
| `GET /api/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD` | Tasks and class meetings for up to 62 days, in the person's time zone: class tasks from every class and personal tasks due in the range, plus unfinished work overdue within the last 30 days; each day's meetings with announced cancellations and room changes applied (`status`: `scheduled`, `cancelled` or `moved`, with the usual room) |
| `POST /api/tasks` | Add a personal task (visible to its owner only; its course must be from one of the person's classes) |
| `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` | Change or delete a personal task, or a class task without an announcement (instructors, class representatives). Tasks created by an announcement change with the announcement |
| `GET /api/tasks/:id` | One task the person can see, with its course, class, class section, submission rules and what the person may do (`canManage`, `canEditRule`) |
| `PUT /api/tasks/:id/rule`, `DELETE /api/tasks/:id/rule` | Set or remove how the task must be submitted (file-name pattern, file types, size limit, where to submit, late policy): the owner of a personal task, or instructors and class representatives for any class task, including tasks created by announcements |
| `PUT /api/tasks/:id/completion`, `DELETE /api/tasks/:id/completion` | Mark a task done or not done, for this person only |

### Workload

| Method and path | Purpose |
| --- | --- |
| `GET /api/workload?from=YYYY-MM-DD&to=YYYY-MM-DD` | The person's workload for up to 190 days, in their time zone: every day with its task count, load (each task's effort, by default from its type) and level (`none`, `light`, `moderate`, `heavy`, `extreme`), and the tasks behind it. Includes their personal tasks |
| `GET /api/classes/:id/workload?from=…&to=…` | A class's workload across all its courses, in the class's time zone; class tasks only, never anyone's personal tasks. Members only |

### Your account (`/api/account`)

Every route needs a session and acts on the signed-in person only.

| Method and path | Purpose |
| --- | --- |
| `PATCH /profile` | Change the name or student ID (`null` clears it) |
| `PATCH /preferences` | Change only the preferences sent (for example `{ "notifications": { "quietHours": { "start": "23:00" } } }`), so two devices editing different settings never overwrite each other |
| `PUT /avatar` | Set the profile photo from a `data:` URL of a JPEG, PNG or WebP image of at most 64 KB; the file's first bytes must match its type |
| `DELETE /avatar` | Remove the profile photo |
| `POST /onboarding` | Record that the welcome steps were finished or skipped (the first time is kept) |
| `GET /export` | Download everything stored about the person as `sabaq-data-<date>.json`, without password or token hashes |
| `DELETE /` | Delete the account (`password` required). Refused with `last_manager`, listing the classes, while the person is the only manager of a class that has other members; classes with no other members are removed. Posts made in classes stay with the class |

Profile photos are served at `GET /api/users/:id/avatar/:version`. The version changes with every upload, so addresses cannot be guessed and each photo is cached for a year (`Cache-Control: public, max-age=31536000, immutable`).

Sign-up also accepts optional `preferences`, so display settings chosen before creating an account are kept.

Sign-up, sign-in and refresh answer with `authResponseSchema` from `@sabaq/shared`. Routes that act on an e-mail address answer `202` whether or not an account exists, so they cannot be used to discover who has an account.

## Conventions

### Errors

Every unsuccessful response has the same shape, defined by `apiErrorSchema` in `@sabaq/shared`:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some fields are not valid.",
    "requestId": "3c1b9fa2-be47-44ac-a763-c4b13ae33058",
    "issues": [{ "path": "email", "code": "invalid_format", "message": "Invalid email address" }]
  }
}
```

- `code` is stable and machine-readable; the web app turns it into a translated message.
- `message` is for developers and is never shown to users as-is.
- `requestId` matches the `X-Request-Id` response header and the server logs, so a user's report can be traced to one log line.
- Unexpected errors always answer `internal_error` without internal details; the full error goes to the logs only.

### Validation

Route handlers validate input with `parseInput(schema, input)` using the shared Zod schemas. Invalid input produces a `validation_failed` error listing every invalid field at once, so forms can mark them all together.

Never pass unvalidated input to a database query: validation guarantees that, for example, an e-mail is a string and not an object such as `{ "$ne": null }`.

### Data

Models, indexes and conventions are described in the [data model](../../docs/data-model.md). The API connects with automatic retries and exponential back-off, creates missing indexes on start-up, and closes the connection during graceful shutdown.

## How sign-in works

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    B->>A: POST /api/auth/login (e-mail, password)
    A-->>B: access token (15 min) + HttpOnly refresh cookie (30 days)
    B->>A: API requests with Authorization: Bearer <access token>
    Note over B,A: The access token expires
    B->>A: POST /api/auth/refresh (cookie sent automatically)
    A-->>B: new access token + new refresh cookie (old one retired)
```

- **Access tokens** are short-lived signed tokens that the web app keeps in memory only. Every request also checks that the session is still active, so signing out takes effect immediately.
- **Refresh tokens** live only in an `HttpOnly`, `SameSite=Strict` cookie limited to `/api/auth` (HTTPS-only in production). The database stores only their SHA-256 hash.
- **Rotation with theft detection:** every refresh retires the old token. If a retired token is presented again after a 30-second grace period (which lets several open tabs refresh at once), it must have been copied, so the whole session is ended.
- **Sessions** last 30 days from their last use.
- **Brute-force protection:** a per-address rate limit on sensitive routes, and an account lock of 15 minutes after 5 failed sign-ins, reported with a clear message and a `Retry-After` header. A password reset also unlocks the account.
- **No account discovery:** a wrong password and an unknown address produce the same message after the same amount of work.
- **E-mailed links** carry their token in the URL fragment (`#token=…`), which browsers never send to servers. They are single-use, expire (verification after 24 hours, reset after 1 hour) and can be requested at most once a minute.
- **Cross-site request forgery:** routes that rely on the cookie accept requests only from the web app's own origin.

## Security and operations

| Concern | How it is handled |
| --- | --- |
| Configuration | Validated at startup; invalid settings stop the server with a message listing each problem. A database is mandatory in production |
| Passwords | Argon2id with the parameters OWASP recommends; at least 8 characters and no arbitrary composition rules, following NIST guidance |
| E-mail | Any SMTP provider ([Brevo guide](../../docs/guides/email-brevo.md)); messages in the recipient's language, including right-to-left Urdu. Without SMTP outside production, e-mails go to the log |
| Headers | Helmet with a strict content security policy (`default-src 'none'`); `X-Powered-By` removed |
| Cross-origin requests | Only origins listed in `CORS_ORIGINS` may send credentials |
| Abuse | Per-client rate limit with standard `RateLimit` and `Retry-After` headers; the health check is exempt |
| Request size | JSON bodies only, at most 100 KB |
| Caching | `Cache-Control: no-store` on every response, because responses can contain personal data |
| Logs | One structured line per request with method, path, status, duration and request ID. Never headers, cookies, query strings or bodies; passwords and tokens are redacted |
| Shutdown | On `SIGTERM` the server stops accepting connections, lets in-flight requests finish, then runs cleanup; connections still open after `SHUTDOWN_TIMEOUT_MS` are closed |
| Proxies | `TRUST_PROXY` sets how many proxies to trust, so limits apply to real client addresses |

## Structure

```text
src/
├── index.ts          Entry point: configuration, server start, process signals
├── app.ts            Builds the Express application (no side effects, used by tests)
├── server.ts         Listening and graceful shutdown
├── config/env.ts     Environment variables and their validation
├── account/          Profile, photo, preferences, welcome steps, data export, account deletion
├── announcements/    Structured announcements, receipts and the unread feed
├── auth/             Sign-in, sessions, tokens, e-mail verification, passwords
├── classes/          Classes, memberships, roles and courses
├── tasks/            The agenda, personal tasks and completion
├── workload/         Daily load for a person or a class
├── db/               Connection, models, demo data
├── mail/             E-mail delivery and templates
├── cli/              Command-line tools (seed)
├── lib/              Errors, logger, input validation, password hashing
├── middleware/       Request IDs, request logging, error handling
├── routes/           One router per feature
└── test/             Test helpers
```
