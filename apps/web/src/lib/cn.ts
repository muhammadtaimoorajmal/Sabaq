import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const merge = extendTailwindMerge({
  extend: {
    // Teach tailwind-merge the design-token sizes, so `h-control` and `h-8` replace each other.
    theme: { spacing: ['control', 'gap'] },
  },
});

/** Joins class names, letting later Tailwind classes override earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
