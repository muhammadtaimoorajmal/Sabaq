import type { Agenda, AgendaTask, CreateTaskInput, UpdateTaskInput } from '@sabaq/shared';
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './client';

export const agendaKeys = {
  all: ['agenda'] as const,
  range: (from: string, to: string) => ['agenda', from, to] as const,
};

/** Tasks and class meetings from `from` to `to` (days in the person's time zone). */
export function useAgenda(from: string, to: string) {
  return useQuery({
    queryKey: agendaKeys.range(from, to),
    queryFn: () => api<Agenda>(`/agenda?from=${from}&to=${to}`),
    // Moving to the next week or month keeps showing the current one until the new one arrives.
    placeholderData: keepPreviousData,
  });
}

/** Applies a change to one task in every cached agenda, so the screen updates at once. */
function updateTaskEverywhere(
  queryClient: QueryClient,
  id: string,
  change: (task: AgendaTask) => AgendaTask,
) {
  queryClient.setQueriesData<Agenda>({ queryKey: agendaKeys.all }, (agenda) =>
    agenda
      ? { ...agenda, tasks: agenda.tasks.map((task) => (task.id === id ? change(task) : task)) }
      : agenda,
  );
}

/**
 * Marks a task done or not done. The screen changes immediately and goes back if the server
 * refuses, so ticking off work never waits for the network.
 */
export function useSetDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api(`/tasks/${id}/completion`, { method: done ? 'PUT' : 'DELETE' }),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: agendaKeys.all });
      const previous = queryClient.getQueriesData<Agenda>({ queryKey: agendaKeys.all });
      updateTaskEverywhere(queryClient, id, (task) => ({
        ...task,
        completedAt: done ? new Date().toISOString() : null,
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
  });
}

export function useSaveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CreateTaskInput | UpdateTaskInput }) =>
      id
        ? api<AgendaTask>(`/tasks/${id}`, { method: 'PATCH', body: input })
        : api<AgendaTask>('/tasks', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
  });
}
