import type {
  AnnouncementForUser,
  AnnouncementPage,
  AnnouncementReceipts,
  AnnouncementType,
  CreateAnnouncementInput,
  UnreadCount,
  UpdateAnnouncementInput,
} from '@sabaq/shared';
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './client';

export interface FeedFilters {
  classId?: string;
  type?: AnnouncementType;
  unread?: boolean;
  q?: string;
}

export const announcementKeys = {
  all: ['announcements'] as const,
  feed: (filters: FeedFilters) => ['announcements', 'feed', filters] as const,
  unread: ['announcements', 'unread'] as const,
  receipts: (id: string) => ['announcements', 'receipts', id] as const,
};

/** How often managers' receipt counts and the unread badge refresh while the page is open. */
export const LIVE_REFRESH_MS = 30_000;
/** How often the "seen by" panel refreshes while it is open. */
export const RECEIPTS_REFRESH_MS = 10_000;

const feedPath = (filters: FeedFilters, before?: string) => {
  const params = new URLSearchParams();
  if (filters.classId) params.set('classId', filters.classId);
  if (filters.type) params.set('type', filters.type);
  if (filters.unread) params.set('unread', 'true');
  if (filters.q) params.set('q', filters.q);
  if (before) params.set('before', before);
  const query = params.toString();
  return `/announcements${query ? `?${query}` : ''}`;
};

/** The announcement feed, newest first, loading older pages on request. */
export function useAnnouncementFeed(filters: FeedFilters, { live = false } = {}) {
  return useInfiniteQuery({
    queryKey: announcementKeys.feed(filters),
    queryFn: ({ pageParam }) => api<AnnouncementPage>(feedPath(filters, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    // Managers watch receipts climb; everyone gets new posts without reloading.
    refetchInterval: live ? LIVE_REFRESH_MS : false,
  });
}

/** Unread announcements across every class, for the navigation badge. */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: announcementKeys.unread,
    queryFn: () => api<UnreadCount>('/announcements/unread'),
    refetchInterval: LIVE_REFRESH_MS,
    enabled,
  });
}

export function useReceipts(classId: string, id: string, open: boolean) {
  return useQuery({
    queryKey: announcementKeys.receipts(id),
    queryFn: () => api<AnnouncementReceipts>(`/classes/${classId}/announcements/${id}/receipts`),
    enabled: open,
    refetchInterval: open ? RECEIPTS_REFRESH_MS : false,
  });
}

/** Marks announcements as seen in every cached feed page, without waiting for the server. */
function markSeenInCache(queryClient: QueryClient, ids: Set<string>, seenAt: string) {
  queryClient.setQueriesData<InfiniteData<AnnouncementPage>>(
    { queryKey: [...announcementKeys.all, 'feed'] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            ids.has(item.id) && !item.seenAt ? { ...item, seenAt } : item,
          ),
        })),
      },
  );
}

/** Announcements seen in quick succession are reported together, after this pause. */
export const SEEN_BATCH_MS = 400;

/**
 * Reports announcements as seen. Calls made close together are sent as one request, so
 * scrolling through the feed costs one request rather than one per card.
 */
export function useMarkSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<undefined>('/announcements/seen', { method: 'POST', body: { ids } }),
    onMutate: (ids) => markSeenInCache(queryClient, new Set(ids), new Date().toISOString()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: announcementKeys.unread }),
  });
}

const refreshAll = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: announcementKeys.all });

export function useCreateAnnouncement(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) =>
      api<AnnouncementForUser>(`/classes/${classId}/announcements`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => refreshAll(queryClient),
  });
}

export function useUpdateAnnouncement(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAnnouncementInput }) =>
      api<AnnouncementForUser>(`/classes/${classId}/announcements/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => refreshAll(queryClient),
  });
}

export function useDeleteAnnouncement(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<undefined>(`/classes/${classId}/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => refreshAll(queryClient),
  });
}
