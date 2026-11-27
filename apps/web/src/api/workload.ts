import type { Workload } from '@sabaq/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './client';

/** Whose workload: the signed-in person's (all their classes) or one class's. */
export type WorkloadScope = { kind: 'mine' } | { kind: 'class'; classId: string };

export const workloadKeys = {
  all: ['workload'] as const,
  of: (scope: WorkloadScope, from: string, to: string) =>
    ['workload', scope.kind === 'mine' ? 'mine' : scope.classId, from, to] as const,
};

export function useWorkload(scope: WorkloadScope, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: workloadKeys.of(scope, from, to),
    queryFn: () =>
      api<Workload>(
        `${scope.kind === 'mine' ? '/workload' : `/classes/${scope.classId}/workload`}?from=${from}&to=${to}`,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}
