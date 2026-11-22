# @sabaq/web

The Sabaq web app: React 19, TypeScript, Vite and Tailwind CSS 4, with accessible components built on Radix primitives. It shares validation and domain logic with the API through [`@sabaq/shared`](../../packages/shared/README.md).

> [!NOTE]
> The design system and app shell are in place: sign-in, navigation, settings with signed-in devices, and error and not-found pages. The full set of sign-up and password screens and the product features arrive in the next milestones; see the [roadmap](../../docs/roadmap.md).

## Running locally

From the repository root:

```bash
npm install
npm run dev        # the API on :4000 and the web app on :5173, together
```

Open <http://localhost:5173> and sign in with the demo student `zara.ahmed@northfield.example` and password `sabaq-demo` (other demo accounts are listed in the [data model](../../docs/data-model.md#demo-data)). The style guide is at <http://localhost:5173/design-system>. Requests to `/api` are forwarded to the API, the same way the production host forwards them, so the browser always talks to one origin.

| Command (from the repository root) | What it does |
| --- | --- |
| `npm run dev` | Starts the API and the web app together |
| `npm run dev:web` | Starts only the web app |
| `npm run build` | Builds every package, including an optimized web app in `apps/web/dist` |
| `npm test` | Runs all tests, including component and accessibility tests |
| `npm run test:e2e` | Runs end-to-end tests in a real browser (see below) |

## Principles

- **Accessible by construction.** Components come with labels, keyboard support, focus management and announcements built in, so screens cannot easily get them wrong.
- **Personal.** Theme, text size, spacing, language and motion apply instantly and are remembered on the device; "Match my device" follows the operating system as it changes.
- **Bilingual and bidirectional.** English and Urdu share one message type, so a missing translation fails the build. Layouts use logical properties (start/end), so right-to-left needs no extra styles.
- **Honest feedback.** Errors say what happened and how to fix it, appear next to the field and in a summary, and every API error code has a translated explanation.

## How the shell works

- **Pages load on demand.** Each route is a separate download, so the first visit fetches only what it shows.
- **Sessions survive reloads.** The access token lives in memory only; on load, the refresh cookie restores the session. When an access token expires, the API client renews it once (shared by parallel requests) and repeats the request, so nobody is signed out while their session is valid.
- **Protected pages remember the destination.** Signed-out visitors go to sign-in and return to the page they wanted. A session that ends while someone is working is explained, not silently dropped.
- **An honest connection state.** If the server takes longer than 2.5 seconds (a free host waking up), a banner says so and retries automatically; offline devices are told they are offline.
- **Page changes are announced.** After each navigation the document title updates and focus moves to the new page's heading, so screen-reader and keyboard users know where they are.
- **Responsive navigation.** A sidebar on wide screens, a bottom bar within thumb reach on phones; only one is rendered at a time.
- **Failures are recoverable.** Pages that fail show a way forward and a support reference; even a crash outside the router shows a bilingual reload message instead of a blank screen.

## Quality checks

| Check | Where | What it proves |
| --- | --- | --- |
| Component and page tests | `npm test` (jsdom) | Behavior, keyboard use, focus, announcements, translations, every API error code explained |
| Contrast tests | `src/styles/tokens.test.ts` | Every color pair meets WCAG 2.2 (AA; AAA in high contrast) |
| End-to-end tests | `npm run test:e2e` (Chrome, desktop and phone sizes) | Real sign-in with the demo API, sessions across reloads, Tab-only navigation, no sideways scrolling at 320 px, visible field outlines |
| Accessibility scans | End-to-end tests with axe-core | Zero WCAG 2.2 A/AA violations, including color contrast, in light, dark, high contrast at 150% and Urdu |
| Lighthouse | End-to-end tests | Accessibility score of 100 on every page |

## Structure

```text
src/
├── api/              API client (silent session refresh), connection status, data caching
├── app/              Providers, routes and the app shell (layouts, navigation)
├── auth/             The session: restore, sign in, sign out
├── components/ui/    The component library (see docs/design-system)
├── i18n/             Translations (English, Urdu) and setup
├── pages/            Screens
├── preferences/      Display preferences: storage, system settings, the settings panel
├── styles/           Design tokens and themes (index.css), contrast tests
├── lib/              Small utilities
└── test/             Test setup and helpers (rendering, accessibility checks)
```
