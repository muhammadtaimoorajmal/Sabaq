import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={200}>
    {children}
  </TooltipPrimitive.Provider>
);

/**
 * A short hint shown on hover and on keyboard focus. Never put essential information only in
 * a tooltip: touch screens cannot hover.
 */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-sm bg-text px-2.5 py-1.5 text-sm text-canvas shadow-md"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-text" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
