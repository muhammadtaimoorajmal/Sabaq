import { CalendarCheck, type LucideIcon, Settings } from 'lucide-react';
import type { ParseKeys } from 'i18next';

export interface NavItem {
  to: string;
  label: ParseKeys;
  icon: LucideIcon;
  /** Match only this exact path (for the home page). */
  end?: boolean;
}

/**
 * Primary destinations, in order of use. Each feature adds its item when it ships, so the
 * navigation never leads to empty placeholders. The bottom bar shows at most five.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'nav.today', icon: CalendarCheck, end: true },
  { to: '/settings', label: 'nav.settings', icon: Settings },
];
