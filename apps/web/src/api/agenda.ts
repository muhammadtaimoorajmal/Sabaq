import type {
  Agenda,
  AgendaTask,
  CreateTaskInput,
  SubmissionRuleInput,
  UpdateTaskInput,
} from '@sabaq/shared';
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

export const taskKeys = {
  all: ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
};

/** The task as already loaded in any agenda on this device, if it is there. */
function taskFromAgendas(queryClient: QueryClient, id: string): AgendaTask | undefined {
  for (const [, agenda] of queryClient.getQueriesData<Agenda>({ queryKey: agendaKeys.all })) {
    const task = agenda?.tasks.find((item) => item.id === id);
    if (task) return task;
  }
  return undefined;
}

/**
 * One task, for its own page. It opens at once from the agenda already loaded (also offline)
 * and is refreshed from the server.
 */
export function useTask(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => api<AgendaTask>(`/tasks/${id}`),
    initialData: () => taskFromAgendas(queryClient, id),
    initialDataUpdatedAt: 0,
  });
}

/** Sets or removes (with `null`) how a task must be submitted. */
export function useSetRule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: SubmissionRuleInput | null) =>
      rule
        ? api<AgendaTask>(`/tasks/${id}/rule`, { method: 'PUT', body: rule })
        : api<AgendaTask>(`/tasks/${id}/rule`, { method: 'DELETE' }),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(id), task);
      updateTaskEverywhere(queryClient, id, () => task);
    },
  });
}

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
  queryClient.setQueryData<AgendaTask>(taskKeys.detail(id), (task) => task && change(task));
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
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) });
      const previous = [
        ...queryClient.getQueriesData<Agenda>({ queryKey: agendaKeys.all }),
        ...queryClient.getQueriesData<AgendaTask>({ queryKey: taskKeys.detail(id) }),
      ];
      updateTaskEverywhere(queryClient, id, (task) => ({
        ...task,
        completedAt: done ? new Date().toISOString() : null,
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: async (_data, _error, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) }),
      ]);
    },
  });
}

export function useSaveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CreateTaskInput | UpdateTaskInput }) =>
      id
        ? api<AgendaTask>(`/tasks/${id}`, { method: 'PATCH', body: input })
        : api<AgendaTask>('/tasks', { method: 'POST', body: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
        queryClient.invalidateQueries({ queryKey: taskKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['workload'] }),
      ]);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['workload'] }),
      ]);
    },
  });
}
