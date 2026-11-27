import type {
  ClassForMember,
  Course,
  CreateClassInput,
  CreateCourseInput,
  Member,
  MembershipRole,
  UpdateClassInput,
  UpdateCourseInput,
} from '@sabaq/shared';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

/** Cache keys, so every screen that shows the same data stays in step after a change. */
export const classKeys = {
  all: ['classes'] as const,
  detail: (id: string) => ['classes', id] as const,
  members: (id: string) => ['classes', id, 'members'] as const,
  courses: (id: string) => ['classes', id, 'courses'] as const,
};

/**
 * Joining, leaving or changing a class changes which announcements, deadlines and class
 * meetings a person sees, so those views refresh too.
 */
const refreshClassViews = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: ['announcements'] });
  void queryClient.invalidateQueries({ queryKey: ['agenda'] });
  void queryClient.invalidateQueries({ queryKey: ['workload'] });
};

export const useClasses = () =>
  useQuery({ queryKey: classKeys.all, queryFn: () => api<ClassForMember[]>('/classes') });

export const useClass = (id: string) =>
  useQuery({
    queryKey: classKeys.detail(id),
    queryFn: () => api<ClassForMember>(`/classes/${id}`),
  });

export const useMembers = (id: string) =>
  useQuery({
    queryKey: classKeys.members(id),
    queryFn: () => api<Member[]>(`/classes/${id}/members`),
  });

export const useCourses = (id: string) =>
  useQuery({
    queryKey: classKeys.courses(id),
    queryFn: () => api<Course[]>(`/classes/${id}/courses`),
  });

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClassInput) =>
      api<ClassForMember>('/classes', { method: 'POST', body: input }),
    onSuccess: (created) => {
      queryClient.setQueryData(classKeys.detail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: classKeys.all, exact: true });
      refreshClassViews(queryClient);
    },
  });
}

export function useJoinClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api<ClassForMember>('/classes/join', { method: 'POST', body: { code } }),
    onSuccess: (joined) => {
      queryClient.setQueryData(classKeys.detail(joined.id), joined);
      void queryClient.invalidateQueries({ queryKey: classKeys.all, exact: true });
      refreshClassViews(queryClient);
    },
  });
}

export function useUpdateClass(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClassInput) =>
      api<ClassForMember>(`/classes/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (updated) => {
      queryClient.setQueryData(classKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: classKeys.all, exact: true });
    },
  });
}

export function useArchiveClass(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/classes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: classKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: classKeys.all, exact: true });
      refreshClassViews(queryClient);
    },
  });
}

export function useRegenerateJoinCode(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<ClassForMember>(`/classes/${id}/join-code`, { method: 'POST' }),
    onSuccess: (updated) => queryClient.setQueryData(classKeys.detail(id), updated),
  });
}

export function useChangeRole(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MembershipRole }) =>
      api<Member[]>(`/classes/${id}/members/${userId}`, { method: 'PATCH', body: { role } }),
    onSuccess: (members) => {
      queryClient.setQueryData(classKeys.members(id), members);
      void queryClient.invalidateQueries({ queryKey: classKeys.detail(id), exact: true });
    },
  });
}

export function useRemoveMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api(`/classes/${id}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: classKeys.all });
      refreshClassViews(queryClient);
    },
  });
}

export function useSaveCourse(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      input,
    }: {
      courseId?: string;
      input: CreateCourseInput | UpdateCourseInput;
    }) =>
      courseId
        ? api<Course>(`/classes/${classId}/courses/${courseId}`, { method: 'PATCH', body: input })
        : api<Course>(`/classes/${classId}/courses`, { method: 'POST', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: classKeys.courses(classId) });
      void queryClient.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}

export function useDeleteCourse(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      api(`/classes/${classId}/courses/${courseId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: classKeys.courses(classId) });
      void queryClient.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}
