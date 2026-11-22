# @sabaq/web

The Sabaq web app: React 19, TypeScript, Vite and Tailwind CSS 4, with accessible components built on Radix primitives. It shares validation and domain logic with the API through [`@sabaq/shared`](../../packages/shared/README.md).

> [!NOTE]
> The design system is in place, and the style guide is the current start page. The app shell, sign-in screens and features arrive in the next milestones; see the [roadmap](../../docs/roadmap.md).

## Running locally

From the repository root:

```bash
npm install
npm run dev        # the API on :4000 and the web app on :5173, together
```

Open <http://localhost:5173>. Requests to `/api` are forwarded to the API, the same way the production host forwards them, so the browser always talks to one origin.

| Command (from the repository root) | What it does |
| --- | --- |
| `npm run dev` | Starts the API and the web app together |
| `npm run dev:web` | Starts only the web app |
| `npm run build` | Builds every package, including an optimized web app in `apps/web/dist` |
| `npm test` | Runs all tests, including component and accessibility tests |

## Principles

- **Accessible by construction.** Components come with labels, keyboard support, focus management and announcements built in, so screens cannot easily get them wrong.
- **Personal.** Theme, text size, spacing, language and motion apply instantly and are remembered on the device; "Match my device" follows the operating system as it changes.
- **Bilingual and bidirectional.** English and Urdu share one message type, so a missing translation fails the build. Layouts use logical properties (start/end), so right-to-left needs no extra styles.
- **Honest feedback.** Errors say what happened and how to fix it, appear next to the field and in a summary, and every API error code has a translated explanation.

## Structure

```text
src/
├── app/              Providers and the root component
├── components/ui/    The component library (see docs/design-system)
├── i18n/             Translations (English, Urdu) and setup
├── pages/            Screens
├── preferences/      Display preferences: storage, system settings, the settings panel
├── styles/           Design tokens and themes (index.css), contrast tests
├── lib/              Small utilities
└── test/             Test setup and helpers (rendering, accessibility checks)
```
