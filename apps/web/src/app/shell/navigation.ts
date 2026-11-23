import { CalendarCheck, type LucideIcon, School, Settings } from 'lucide-react';

export interface NavItem {
  to: string;
  label: 'nav.today' | 'nav.classes' | 'nav.settings';
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
  { to: '/classes', label: 'nav.classes', icon: School },
  { to: '/settings', label: 'nav.settings', icon: Settings },
];
