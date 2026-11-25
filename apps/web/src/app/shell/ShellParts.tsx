import { LogOut, Settings, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useNavigate } from 'react-router';
import { apiAsset } from '../../api/client';
import { useAuth, useCurrentUser } from '../../auth/AuthProvider';
import {
  Avatar,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { useMediaQuery, WIDE_SCREEN } from '../../lib/useMediaQuery';
import { PreferencesPanel } from '../../preferences/PreferencesPanel';
import { NAV_ITEMS } from './navigation';

/** The product name, linking home. */
export function Logo() {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      aria-label={t('shell.home')}
      className="inline-flex items-center gap-2 rounded-md font-bold text-text"
    >
      <svg aria-hidden="true" viewBox="0 0 64 64" className="size-8">
        <rect width="64" height="64" rx="16" className="fill-primary" />
        <path
          d="M18 22c0-3.3 2.7-6 6-6h20v6H24v6h16c3.3 0 6 2.7 6 6v8c0 3.3-2.7 6-6 6H18v-6h22v-8H24c-3.3 0-6-2.7-6-6z"
          className="fill-primary-fg"
        />
      </svg>
      <span className="text-lg">{t('common.appName')}</span>
    </Link>
  );
}

/** Opens the display settings from anywhere, even before signing in. */
export function DisplaySettingsButton() {
  const { t } = useTranslation();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton label={t('shell.display')} icon={<SlidersHorizontal />} />
      </SheetTrigger>
      <SheetContent title={t('preferences.title')} description={t('preferences.description')}>
        <PreferencesPanel />
      </SheetContent>
    </Sheet>
  );
}

export function AccountMenu() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-control items-center justify-center rounded-full"
        >
          {/* The name comes from this text, not an aria-label, so the visible initials never
              contradict it (WCAG 2.5.3, Label in Name). */}
          <Avatar name={user.name} src={apiAsset(user.avatarUrl)} size="sm" decorative />
          <span className="sr-only">{t('shell.account', { name: user.name })}</span>
        </button>
      </MenuTrigger>
      <MenuContent>
        <div className="px-3 py-2">
          <p className="text-xs text-muted">{t('shell.signedInAs')}</p>
          <p className="font-semibold text-text">{user.name}</p>
          <p className="truncate text-sm text-muted" dir="ltr">
            {user.email}
          </p>
        </div>
        <MenuSeparator />
        <MenuItem icon={<Settings />} onSelect={() => void navigate('/settings')}>
          {t('nav.settings')}
        </MenuItem>
        <MenuItem icon={<LogOut />} onSelect={() => void signOut()}>
          {t('shell.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/**
 * The main navigation: a sidebar on wide screens and a bottom bar within thumb reach on
 * phones. Only one is rendered, so assistive technology meets a single navigation landmark.
 */
export function PrimaryNavigation() {
  const { t } = useTranslation();
  const wide = useMediaQuery(WIDE_SCREEN);
  return (
    <nav
      aria-label={t('nav.label')}
      className={cn(
        wide
          ? 'sticky top-16 flex h-[calc(100dvh-4rem)] w-60 shrink-0 flex-col gap-1 border-e-default border-border p-3'
          : 'fixed inset-x-0 bottom-0 z-30 flex border-t-default border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-lg',
      )}
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-md font-semibold text-muted transition-colors hover:text-text',
              wide
                ? 'min-h-control gap-3 px-3'
                : 'min-h-16 min-w-0 flex-1 flex-col justify-center gap-1 px-1 text-center text-xs break-words',
              isActive && (wide ? 'bg-primary-soft text-primary-text' : 'text-primary-text'),
            )
          }
        >
          <Icon aria-hidden="true" className={wide ? 'size-5' : 'size-6'} />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}
