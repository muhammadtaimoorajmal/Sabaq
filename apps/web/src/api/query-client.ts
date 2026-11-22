import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './client';

/**
 * Cached server data. Client errors (4xx) are never retried, since repeating the same
 * request cannot fix them; network and server errors are retried twice with back-off.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failures, error) => {
          if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500)
            return false;
          return failures < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
