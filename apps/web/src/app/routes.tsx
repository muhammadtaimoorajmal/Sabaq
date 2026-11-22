import type { RouteObject } from 'react-router';
import { ErrorPage, NotFoundPage } from '../pages/StatusPages';
import { PublicLayout, RequireAuth } from './shell/layouts';
import { RootLayout, type RouteHandle } from './shell/RootLayout';

const handle = (title: RouteHandle['title']): RouteHandle => ({ title });

/**
 * Every page, loaded on demand so the first visit downloads only what it shows. Pages behind
 * `RequireAuth` need a session; everything else is public.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            path: 'sign-in',
            handle: handle('signIn.title'),
            lazy: () => import('../pages/SignInPage').then((m) => ({ Component: m.SignInPage })),
          },
        ],
      },
      {
        path: 'design-system',
        handle: handle('nav.designSystem'),
        lazy: () =>
          import('../pages/DesignSystemPage').then((m) => ({ Component: m.DesignSystemPage })),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            index: true,
            handle: handle('nav.today'),
            lazy: () => import('../pages/TodayPage').then((m) => ({ Component: m.TodayPage })),
          },
          {
            path: 'settings',
            handle: handle('nav.settings'),
            lazy: () =>
              import('../pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
          },
        ],
      },
      { path: '*', element: <NotFoundPage />, handle: handle('notFound.title') },
    ],
  },
];
