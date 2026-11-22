import { SkipLink } from '../components/ui';
import { DesignSystemPage } from '../pages/DesignSystemPage';

/** The application. Routing and the app shell arrive in the next milestone. */
export function App() {
  return (
    <>
      <SkipLink />
      <DesignSystemPage />
    </>
  );
}
