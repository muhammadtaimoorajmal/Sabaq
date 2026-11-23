import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Inline links in running text: underlined, so they never rely on color alone. */
export const linkClass =
  'rounded-sm font-semibold text-primary-text underline underline-offset-2 hover:no-underline';

export function AuthHeader({ title, intro }: { title: ReactNode; intro?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold text-text">{title}</h1>
      {intro && <p className="text-muted">{intro}</p>}
    </div>
  );
}

/** "Already have an account? Sign in" style lines under a form. */
export function AuthSwitch({
  question,
  to,
  action,
}: {
  question: ReactNode;
  to: string;
  action: ReactNode;
}) {
  return (
    <p className="text-center text-muted">
      {question}{' '}
      <Link to={to} className={linkClass}>
        {action}
      </Link>
    </p>
  );
}

/** Reads `#token=…` from the address once, then removes it so it is not kept in history. */
export function takeTokenFromHash(): string | null {
  const match = /(?:^#|&)token=([\w-]+)/.exec(window.location.hash);
  if (!match) return null;
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search,
  );
  return match[1] ?? null;
}

/** Keeps the post-sign-in destination when moving between sign-in and sign-up. */
export function withNext(path: string, next: string): string {
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`;
}
