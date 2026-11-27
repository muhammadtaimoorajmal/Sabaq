import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { browserStorage, persistOptions } from './api/offline';
import { App, AppErrorBoundary } from './app/App';
import { AppProviders } from './app/AppProviders';
import { routes } from './app/routes';
import { createI18n } from './i18n';
import { loadPreferences } from './preferences/preferences';
import './styles/index.css';

const storage = browserStorage();
const preferences = loadPreferences(storage);
const router = createBrowserRouter(routes);
const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders
        i18n={createI18n(preferences.language)}
        preferences={preferences}
        persist={storage ? persistOptions(storage, __BUILD_ID__) : undefined}
      >
        <App router={router} />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
);

// The app keeps working without a connection once it has been opened (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?build=${__BUILD_ID__}`).catch(() => undefined);
  });
}
