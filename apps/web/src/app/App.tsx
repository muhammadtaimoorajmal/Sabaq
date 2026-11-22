import { Component, type ErrorInfo, type ReactNode } from 'react';
import { type DataRouter, RouterProvider } from 'react-router';

/**
 * Last line of defense for errors outside any page (for example in a provider): a plain,
 * dependency-free message with a reload button, so the app never shows a blank screen.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Sabaq stopped because of an unexpected error', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        role="alert"
        className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center"
      >
        <h1 className="text-2xl font-bold text-text">
          Sabaq could not start · سبق شروع نہیں ہو سکا
        </h1>
        <p className="text-muted">Please reload the page. · براہِ کرم صفحہ دوبارہ لوڈ کریں۔</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mx-auto h-control rounded-md bg-primary px-5 font-semibold text-primary-fg"
        >
          Reload · دوبارہ لوڈ کریں
        </button>
      </main>
    );
  }
}

/** The application; the router is created once by the entry point (or a test). */
export function App({ router }: { router: DataRouter }) {
  return <RouterProvider router={router} />;
}
