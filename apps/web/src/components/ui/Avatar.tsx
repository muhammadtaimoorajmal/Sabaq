import { COLOR_TOKENS } from '@sabaq/shared';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '../../lib/cn';

const BACKGROUNDS: Record<(typeof COLOR_TOKENS)[number], string> = {
  blue: 'bg-course-blue',
  teal: 'bg-course-teal',
  green: 'bg-course-green',
  lime: 'bg-course-lime',
  amber: 'bg-course-amber',
  orange: 'bg-course-orange',
  red: 'bg-course-red',
  pink: 'bg-course-pink',
  purple: 'bg-course-purple',
  indigo: 'bg-course-indigo',
  slate: 'bg-course-slate',
};

/** Up to two initials, from the first and last word ("Zara Ahmed" → "ZA"). */
export function initialsOf(name: string): string {
  const words = name
    .replace(/^Dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase();
}

/** The same person always gets the same color, so people are easy to recognize. */
export function colorOf(name: string): (typeof COLOR_TOKENS)[number] {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return COLOR_TOKENS[hash % COLOR_TOKENS.length] ?? 'slate';
}

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' };

/**
 * A person's photo, or their initials on a stable color while it loads or when there is none.
 * The name is the accessible label; pass `decorative` when the name is already shown beside it.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  decorative = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn('inline-flex shrink-0 overflow-hidden rounded-full', SIZES[size], className)}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        className={cn(
          'flex size-full items-center justify-center font-bold text-canvas',
          BACKGROUNDS[colorOf(name)],
        )}
      >
        {initialsOf(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
