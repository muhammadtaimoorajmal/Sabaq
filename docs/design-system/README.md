# Design system

Sabaq's visual language and component library. The living style guide is the web app's start page during development (`npm run dev`, then <http://localhost:5173>): every component appears in context next to the display settings, so each can be seen adapting to them.

## Principles

1. **Calm.** Few colors, generous space, one primary action per area. Urgency is shown only where it is real.
2. **Never color alone.** Every status pairs color with an icon, a word or a shape (WCAG 1.4.1).
3. **Readable for everyone.** Text sizes are relative, so the text-size preference and browser zoom scale the entire interface without breaking layouts.
4. **Predictable.** The same action looks and behaves the same everywhere; destructive actions are red, confirm what will happen, and offer undo where possible.
5. **Forgiving.** Errors are prevented first (clear hints, sensible defaults), explained in plain language when they happen, and easy to fix.

## Tokens

All tokens are CSS custom properties in [`apps/web/src/styles/index.css`](../../apps/web/src/styles/index.css). Components use semantic names only (for example `bg-surface`, `text-muted`), never raw colors, so every component works in every theme.

| Group | Tokens |
| --- | --- |
| Surfaces | `canvas` (page), `surface` (cards, inputs), `surface-sunken` (wells, tracks) |
| Text | `text`, `muted` |
| Lines | `border` (dividers), `border-strong` (input outlines, 3:1 or more) |
| Actions | `primary`, `primary-hover`, `primary-fg`, `primary-soft`, `primary-text` |
| Status | `danger`, `danger-fg`, `danger-soft`, `danger-text`; `warning-soft`, `warning-text`; `success-soft`, `success-text` |
| Courses | `course-blue` … `course-slate`: eleven distinguishable colors for course markers and avatars |
| Focus | `focus`: the focus ring (3 px, offset 2 px) |
| Shape | `radius-sm` … `radius-xl`; `shadow-sm`, `shadow-md`, `shadow-lg` |
| Motion | `duration-fast` (120 ms), `duration-base` (200 ms), `duration-slow` (320 ms); `ease-out`, `ease-in-out` |
| Size | `control` (control height, follows density), `gap`; `text-display` (fluid page titles) |

## Themes

| Theme | Character | Contrast target |
| --- | --- | --- |
| Light | Default; soft grey page, white surfaces, blue actions | WCAG 2.2 AA: 4.5:1 text, 3:1 non-text |
| Dark | Low-glare greys; lighter blues so actions stay visible | WCAG 2.2 AA |
| High contrast | Pure black and white, yellow actions, cyan focus ring, 2 px borders | WCAG 2.2 AAA: 7:1 text |

**Match my device** chooses high contrast when the operating system asks for more contrast, otherwise dark or light from the system color scheme, and switches live when the system changes.

**Evidence:** [`tokens.test.ts`](../../apps/web/src/styles/tokens.test.ts) computes the WCAG contrast ratio of every text and background pair used in the interface, in every theme, on every test run. A color change that breaks contrast fails continuous integration.

## Personalization

| Setting | Options | How it works |
| --- | --- | --- |
| Theme | Match my device, light, dark, high contrast | `data-theme` on the root element |
| Text size | 87.5% to 150% in 12.5% steps | Root font size; everything is sized in rem |
| Spacing | Comfortable (44 px controls), compact (36 px) | `data-density`; both exceed WCAG 2.2's 24 px minimum target |
| Language | English, Urdu | `lang` and `dir`; Urdu uses Noto Nastaliq Urdu with taller line spacing, and the layout mirrors |
| Animations | Match my device, reduce, show all | `data-motion`; reduce removes transitions and animations |

Preferences apply before the first paint, so pages never flash in the wrong theme or direction.

## Components

| Component | Use it for | Accessibility built in |
| --- | --- | --- |
| Button | Actions; primary, secondary, ghost, danger; three sizes | Real `<button>`; busy state announced; can render a link |
| IconButton | Compact actions | Required label, shown as a tooltip |
| Field + Input, PasswordInput, Textarea, Select | Form fields | Label, hint and error linked to the control; error above the field; show/hide password; character count that reports overflow instead of truncating; native select |
| DateTimeField | Deadlines and times | Native date and time pickers, quick choices, the chosen moment confirmed in words, always in the class's time zone |
| ErrorSummary | After a failed submit | Receives focus, counts problems, links move focus to each field |
| Checkbox, Switch | On/off choices | Whole label clickable; descriptions linked |
| RadioGroup, SegmentedControl | One of several | One tab stop; arrow keys follow reading direction |
| Slider | Ranges such as text size | Readable value announced ("125%"), with − and + buttons beside it |
| Dialog | Confirmations, short tasks | Focus trapped and restored, Escape closes, title and description announced |
| Sheet | Filters, details, navigation on phones | Bottom sheet on phones, side panel on larger screens; dialog focus handling |
| Menu | Lists of actions | Arrow keys, type-ahead, Escape |
| Tabs | Switching views | Arrow keys; the selected tab is the only tab stop |
| Tooltip | Short hints | Shown on hover and focus; never the only place for information |
| Toast | Results of actions | Polite announcements, pause on hover or focus, stay 6 seconds, optional undo |
| Alert | Messages in the page | Icon and title per tone; live only when it appears in response to an action |
| Badge, CourseTag | Status, course markers | Text with color, never color alone |
| Avatar | People | Photo or initials on a stable color; labelled, or decorative beside a visible name |
| Card, EmptyState, Skeleton, Spinner | Structure, empty and loading states | Empty states explain why and what to do; skeletons hidden from screen readers; spinners announced |
| SkipLink | Every page | First tab stop; jumps to the main content |

## Quality checks

Run on every change in continuous integration:

- **Contrast:** every token pair, every theme ([`tokens.test.ts`](../../apps/web/src/styles/tokens.test.ts)).
- **Automated accessibility:** axe-core scans the whole style guide in light, dark (compact), high contrast at 150% text, and Urdu right to left, plus each component on its own. Zero violations are allowed.
- **Keyboard and screen-reader behavior:** component tests drive every component with the keyboard and check names, descriptions, focus movement and announcements.
- **Translations:** English and Urdu must have identical keys, and every API error code must have a message in both.
