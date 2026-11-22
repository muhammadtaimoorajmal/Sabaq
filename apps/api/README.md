# @sabaq/api

The Sabaq REST API: Node.js, Express 5 and TypeScript. It shares its validation schemas and domain logic with the web app through [`@sabaq/shared`](../../packages/shared/README.md).

> [!NOTE]
> This is the server foundation. The database arrives in milestone 6 and authentication in milestone 7; see the [roadmap](../../docs/roadmap.md).

## Running locally

From the repository root:

```bash
npm install
npm run dev:api      # http://localhost:4000, restarts on every change
```

Development mode reads `@sabaq/shared` straight from its TypeScript sources, so changes there apply immediately without a build. To change a setting, copy [`.env.example`](.env.example) to `.env`.

| Command (from the repository root) | What it does |
| --- | --- |
| `npm run dev:api` | Starts the API with automatic restarts and readable logs |
| `npm run build` | Compiles every package, including the API, to `dist/` |
| `npm start -w @sabaq/api` | Runs the compiled API, as in production |
| `npm test` | Runs all tests with coverage |

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | **Liveness.** Answers instantly without touching any dependency, so the web app can also use it to wake a sleeping server |
| `GET /api/health/ready` | **Readiness.** Checks every dependency (the database, from milestone 6) and answers `503` when one is down |
| `GET /api` | Name and version of the API |

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

## Security and operations

| Concern | How it is handled |
| --- | --- |
| Configuration | Validated at startup; invalid settings stop the server with a message listing each problem |
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
├── lib/              Errors, logger, input validation
├── middleware/       Request IDs, request logging, error handling
├── routes/           One router per feature
└── test/             Test helpers
```
