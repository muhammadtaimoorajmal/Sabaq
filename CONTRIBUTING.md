# Contributing to Sabaq

Thank you for helping make Sabaq better. This guide explains how to contribute; the [roadmap](docs/roadmap.md) shows what is being built and in what order.

## Ground rules

1. **Users first.** Every interface change should be justified by user research, a usability finding or an established design principle. Record significant decisions in [`docs/design-rationale/`](docs/design-rationale/README.md).
2. **Accessibility is not optional.** Every screen must work with a keyboard alone, with a screen reader, at 200% zoom, in dark and high-contrast themes, and in right-to-left languages.
3. **Documentation tells the truth.** Describe what exists, not what is planned.
4. **Research data stays anonymous.** Participants are referred to as P1, P2 and so on. Never commit names, student IDs, contact details or recordings.
5. **Never commit secrets.** Keep credentials in local `.env` files; only `.env.example` is tracked.

## Workflow

1. Open or pick an issue. Use the **Usability finding** form for anything confusing, slow or inaccessible.
2. Create a branch from `main`, for example `feat/join-class`, `fix/timeline-focus-order` or `docs/personas`.
3. Make the change and run `npm run check` before pushing. Git hooks already format and lint staged files and validate your commit message.
4. Open a pull request using the template. Continuous integration must pass before merging.

## Commit messages

Sabaq uses [Conventional Commits](https://www.conventionalcommits.org/) with the affected area as the scope:

```text
feat(timeline): add overdue section to the Today screen
fix(auth): announce password errors to screen readers
docs(research): add student interview guide
test(shared): cover extension mismatch in the submission checker
ci: cache npm dependencies
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

## Code style

TypeScript runs in strict mode. Formatting (Prettier), linting (ESLint with accessibility rules) and documentation checks (markdownlint and the link checker) are automated, so style is never a matter of debate in review. Install the editor extensions recommended in `.vscode/extensions.json` to get the same feedback while you type.
