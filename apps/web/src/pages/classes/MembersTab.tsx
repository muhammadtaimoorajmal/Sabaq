import {
  type ClassForMember,
  type Member,
  MEMBERSHIP_ROLES,
  type MembershipRole,
} from '@sabaq/shared';
import { LogOut, MoreVertical, UserMinus, UserCog } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useChangeRole, useMembers, useRemoveMember } from '../../api/classes';
import { ApiRequestError, apiAsset } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { allowed } from './helpers';

export function MembersTab({ cls }: { cls: ClassForMember }) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const members = useMembers(cls.id);
  const changeRole = useChangeRole(cls.id);
  const remove = useRemoveMember(cls.id);
  const [removing, setRemoving] = useState<Member | null>(null);
  const canManage = allowed(user, cls, 'class.manage_members');
  const isInstructor = user.platformRole === 'admin' || cls.role === 'instructor';
  const roleName = (role: MembershipRole) => t(`classes.roles.${role}`);
  const onError = (error: Error) =>
    toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined)));
  const joined = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));

  const leaving = removing?.user.id === user.id;
  const confirmRemoval = () => {
    if (!removing) return;
    remove.mutate(removing.user.id, {
      onSuccess: () => {
        setRemoving(null);
        if (leaving) {
          toast.success(t('classes.members.left', { name: cls.name }));
          void navigate('/classes', { replace: true });
        } else {
          toast.success(t('classes.members.removed', { name: removing.user.name }));
        }
      },
      onError: (error) => {
        setRemoving(null);
        onError(error);
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {members.isPending && <Skeleton className="h-40 w-full rounded-xl" />}
      {members.isError && <Alert tone="danger" title={t('errors.unknown')} />}
      <ul className="flex flex-col divide-y divide-border rounded-xl border-default border-border bg-surface">
        {members.data?.map((member) => {
          const self = member.user.id === user.id;
          // Only instructors can appoint, change or remove instructors.
          const canChange = canManage && !self && (isInstructor || member.role !== 'instructor');
          const roles = MEMBERSHIP_ROLES.filter(
            (role) => role !== member.role && (isInstructor || role !== 'instructor'),
          );
          return (
            <li key={member.user.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar name={member.user.name} src={apiAsset(member.user.avatarUrl)} decorative />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-text">
                  {member.user.name}
                  {self && <Badge tone="success">{t('classes.members.you')}</Badge>}
                </p>
                <p className="text-sm text-muted">
                  {roleName(member.role)} ·{' '}
                  {t('classes.members.joined', { date: joined(member.joinedAt) })}
                </p>
              </div>
              {self && (
                <Button size="sm" variant="secondary" onClick={() => setRemoving(member)}>
                  <LogOut aria-hidden="true" />
                  {t('classes.members.leave')}
                </Button>
              )}
              {canChange && (
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton
                      label={t('classes.members.actions', { name: member.user.name })}
                      icon={<MoreVertical />}
                    />
                  </MenuTrigger>
                  <MenuContent>
                    {roles.map((role) => (
                      <MenuItem
                        key={role}
                        icon={<UserCog />}
                        onSelect={() =>
                          changeRole.mutate(
                            { userId: member.user.id, role },
                            {
                              onSuccess: () =>
                                toast.success(
                                  t('classes.members.roleChanged', {
                                    name: member.user.name,
                                    role: roleName(role),
                                  }),
                                ),
                              onError,
                            },
                          )
                        }
                      >
                        {t('classes.members.makeRole', { role: roleName(role) })}
                      </MenuItem>
                    ))}
                    <MenuSeparator />
                    <MenuItem icon={<UserMinus />} danger onSelect={() => setRemoving(member)}>
                      {t('classes.members.remove')}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={
          leaving
            ? t('classes.members.leaveTitle', { name: cls.name })
            : t('classes.members.removeTitle', { name: removing?.user.name })
        }
        body={leaving ? t('classes.members.leaveBody') : t('classes.members.removeBody')}
        confirmLabel={leaving ? t('classes.members.leave') : t('classes.members.remove')}
        pending={remove.isPending}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}
