import type { PreferencesUpdate, ProfileUpdate, User } from '@sabaq/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { api } from './client';

/** Keeps the signed-in user up to date after every account change. */
function useAccountMutation<Input>(request: (input: Input) => Promise<User>) {
  const { updateUser } = useAuth();
  return useMutation({ mutationFn: request, onSuccess: updateUser });
}

export const saveProfile = (update: ProfileUpdate) =>
  api<User>('/account/profile', { method: 'PATCH', body: update });

export const savePreferences = (update: PreferencesUpdate) =>
  api<User>('/account/preferences', { method: 'PATCH', body: update });

export const useUpdateProfile = () => useAccountMutation(saveProfile);

export const useSetAvatar = () =>
  useAccountMutation((image: string) =>
    api<User>('/account/avatar', { method: 'PUT', body: { image } }),
  );

export const useRemoveAvatar = () =>
  useAccountMutation(() => api<User>('/account/avatar', { method: 'DELETE' }));

/** Finishing or skipping the welcome steps; both mean "do not show them again". */
export const useCompleteOnboarding = () =>
  useAccountMutation(() => api<User>('/account/onboarding', { method: 'POST' }));

/** Deletes the account, then forgets the session and every cached answer on this device. */
export function useDeleteAccount() {
  const { endLocally } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      api<undefined>('/account', { method: 'DELETE', body: { password } }),
    onSuccess: () => {
      queryClient.clear();
      endLocally();
    },
  });
}

/** Downloads a copy of the person's data as a JSON file. */
export async function downloadAccountData(now = new Date()): Promise<void> {
  const data = await api<unknown>('/account/export');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sabaq-data-${now.toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
