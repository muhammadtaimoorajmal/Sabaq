# @sabaq/web

The Sabaq web app: React 19, TypeScript, Vite and Tailwind CSS 4, with accessible components built on Radix primitives. It shares validation and domain logic with the API through [`@sabaq/shared`](../../packages/shared/README.md).

> [!NOTE]
> The design system, app shell and account screens are in place: sign-up, e-mail confirmation, sign-in with optional demo accounts, password recovery, settings with password change and signed-in devices, and error and not-found pages. Product features arrive in the next milestones; see the [roadmap](../../docs/roadmap.md).

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

## Account screens

| Screen | Path | Highlights |
| --- | --- | --- |
| Create an account | `/sign-up` | Strength meter that also flags the person's own name and e-mail; optional student ID; "Sign in instead" when the address is taken |
| Sign in | `/sign-in` | Caps Lock warning; "Forgot your password?" carries the typed address; a locked account says how many minutes remain; optional one-tap demo accounts |
| Confirm e-mail | `/verify-email#token=…` | Confirms automatically from the e-mailed link; a reminder banner with one-tap resend until confirmed |
| Forgot password | `/forgot-password` | Always the same answer, so accounts stay private; "Send again" |
| Choose a new password | `/reset-password#token=…` | Strength meter; clear next steps for expired or incomplete links |
| Change password | Settings | Needs the current password; signs out other devices |

## Announcements

| Screen | Path | Highlights |
| --- | --- | --- |
| Inbox | `/inbox` | Every class's announcements; unread count in the navigation; filters for unread, type and words; "Mark all as read" |
| Class announcements | `/classes/:id` (first tab) | The same feed for one class; `?announcement=<id>` (used by notifications) scrolls to and focuses that announcement |

- **One line that matters.** Each card leads with its type (icon and name, never color alone), course and class, then the one fact a student needs, such as "Due Friday, January 8 at 11:59 PM" in their own time zone and clock.
- **Honest "seen".** An announcement counts as seen only after it has been mostly on screen for a second; quickly scrolling past does not count. Announcements seen together are reported in one request.
- **Changes are never missed.** An announcement whose time or place changed after someone saw it is marked "Updated since you saw it", and its edit history says who changed what and when.
- **Receipts for senders.** Instructors and class representatives see "Seen by 18 of 31" on each card, and a panel listing who has not seen it yet, refreshed every few seconds while open.
- **A composer that asks only what applies.** The type comes first and decides the fields (a deadline needs a due time and creates a task for everyone; a venue change needs the new room). Dates are entered in the class's time zone, links are checked, and a live preview shows exactly what students will see.

### Paste a message

The composer starts with "Paste a message": a message from the class chat fills in the form (type, course, title, kind of task, due date or class time, venue and file rules). The message is shown with every detected detail highlighted and labelled for screen readers, a summary lists what was understood and anything assumed ("The message gives no time, so one was assumed"), and every filled-in field says "Filled in from the message; check it" until the sender changes it. Nothing is posted until the sender presses Post.

## Onboarding and settings

| Screen | Path | Highlights |
| --- | --- | --- |
| Welcome | `/welcome` | Three steps (about you, comfort, your class) with visible progress, Back, and "Skip setup" on every step; the step is in the address, so the browser's Back button works; focus moves to each step's heading. Shown after sign-up; Today offers to finish it until done or dismissed |
| Settings | `/settings` | Profile with photo, display, date and time, notifications with quiet hours, password and devices, and your data (download a copy, delete the account), with "On this page" links |

**Preferences follow the person.** Display, time and notification settings apply instantly, are remembered on the device, and are saved to the account a moment after each change (several quick changes are sent together). Signing in on another device brings them along; sign-up keeps the settings chosen before the account existed. If saving fails, the change still applies on this device and a single message explains it.

**Photos are prepared on the device.** A chosen photo is cropped to a square, scaled to 256 pixels and compressed before upload, so even a large phone photo becomes a few kilobytes.

**Validation at the right moment.** Problems appear after leaving a field you filled in, or on submit, never while typing a field for the first time and never for empty fields you merely tab through. They disappear the moment they are fixed. After a submit, an error summary lists every problem and takes focus once; it never steals focus while you correct a field.

**Password managers.** Every field uses the right `autocomplete` value (`username`, `current-password`, `new-password`, `email`, `name`), and the change-password form tells managers which account it belongs to.

**Demo accounts.** The sign-in page offers one-tap demo accounts in development, and on any build with `VITE_DEMO_ACCOUNTS=true` (for a public demo backed by the demo data).

**E-mail in development.** Without an e-mail service, messages go to the API's development mailbox: open <http://localhost:4000/api/dev/mail> to follow verification and password links.

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
