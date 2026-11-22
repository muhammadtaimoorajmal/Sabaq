import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import { createI18n } from './i18n';
import { loadPreferences } from './preferences/preferences';
import './styles/index.css';

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();
const preferences = loadPreferences(storage);
const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <AppProviders i18n={createI18n(preferences.language)} preferences={preferences}>
      <App />
    </AppProviders>
  </StrictMode>,
);
