import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const merge = extendTailwindMerge({
  extend: {
    // Teach tailwind-merge the design-token sizes, so `h-control` and `h-8` replace each other.
    theme: { spacing: ['control', 'gap'] },
    // The theme-aware border widths (index.css) are widths, not colors: without this,
    // `border-default border-border-strong` would lose its width and the border would vanish.
    classGroups: {
      'border-w': ['border-default'],
      'border-w-t': ['border-t-default'],
      'border-w-b': ['border-b-default'],
      'border-w-e': ['border-e-default'],
    },
  },
});

/** Joins class names, letting later Tailwind classes override earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
