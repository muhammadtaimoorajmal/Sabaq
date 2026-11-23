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
            lazy: () =>
              import('../pages/auth/SignInPage').then((m) => ({ Component: m.SignInPage })),
          },
          {
            path: 'sign-up',
            handle: handle('auth.signUp.title'),
            lazy: () =>
              import('../pages/auth/SignUpPage').then((m) => ({ Component: m.SignUpPage })),
          },
          {
            path: 'forgot-password',
            handle: handle('auth.forgot.title'),
            lazy: () =>
              import('../pages/auth/PasswordRecovery').then((m) => ({
                Component: m.ForgotPasswordPage,
              })),
          },
          {
            path: 'reset-password',
            handle: handle('auth.reset.title'),
            lazy: () =>
              import('../pages/auth/PasswordRecovery').then((m) => ({
                Component: m.ResetPasswordPage,
              })),
          },
          {
            path: 'verify-email',
            handle: handle('auth.verify.bannerTitle'),
            lazy: () =>
              import('../pages/auth/VerifyEmailPage').then((m) => ({
                Component: m.VerifyEmailPage,
              })),
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
            path: 'classes',
            handle: handle('classes.title'),
            lazy: () =>
              import('../pages/classes/ClassesPage').then((m) => ({ Component: m.ClassesPage })),
          },
          {
            path: 'classes/new',
            handle: handle('classes.form.createTitle'),
            lazy: () =>
              import('../pages/classes/CreateClassPage').then((m) => ({
                Component: m.CreateClassPage,
              })),
          },
          {
            path: 'classes/:classId',
            handle: handle('classes.title'),
            lazy: () =>
              import('../pages/classes/ClassPage').then((m) => ({ Component: m.ClassPage })),
          },
          {
            path: 'join',
            handle: handle('classes.joinPage.title'),
            lazy: () =>
              import('../pages/classes/JoinClassPage').then((m) => ({
                Component: m.JoinClassPage,
              })),
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
