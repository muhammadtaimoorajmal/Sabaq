# Contributing to Sabaq

Thank you for helping. Sabaq is built in 30 modules (see the [build plan](docs/01-module-plans.md)); every change belongs to one of them.

## Ground rules

1. **Users first.** Every interface change must be justified by user research, a usability finding or an HCI principle. Record major decisions as design-rationale records in [`docs/design-rationale/`](docs/design-rationale/README.md).
2. **Accessibility is not optional.** Every screen must work with the keyboard alone, with a screen reader, at 200% zoom, in dark and high-contrast themes, and in Urdu (right-to-left).
3. **The repository tells the truth.** Documentation describes what exists, not what is planned.
4. **No invented research data.** Research and test results come from real participants, anonymized as P1, P2 and so on.
5. **Never commit secrets.** Use `.env` files locally; only `.env.example` is tracked.

## Workflow

1. Open or pick an issue (use the **Usability finding** template for interface problems).
2. Create a branch from `main`: `feat/m17-join-class`, `fix/timeline-focus-order`, `docs/m09-personas`.
3. Make the change, then run the full checks (available from Module 03): `npm run check`.
4. Open a pull request using the template. CI must pass before merging.

## Commit messages

Sabaq uses [Conventional Commits](https://www.conventionalcommits.org/), scoped by module where possible:

```text
feat(M21): add overdue section to Today screen
fix(M15): announce password errors to screen readers
docs(M09): add primary persona
test(M22): cover extension mismatch in submission checker
chore(M03): configure lint-staged
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

## Code style

Formatting and linting are automated (Prettier and ESLint, from Module 03). TypeScript runs in strict mode, so `any` needs a written justification.
