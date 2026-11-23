import type { ClassForMember } from '@sabaq/shared';
import { ChevronRight, LogIn, Plus, School } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useClasses } from '../../api/classes';
import { Alert, Badge, Button, EmptyState, Skeleton } from '../../components/ui';
import { classSubtitle } from './helpers';

/** The two ways in: join with a code, or create a class. */
export function ClassActions({ emphasis = 'join' }: { emphasis?: 'join' | 'create' }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild variant={emphasis === 'join' ? 'primary' : 'secondary'}>
        <Link to="/join">
          <LogIn aria-hidden="true" />
          {t('classes.join')}
        </Link>
      </Button>
      <Button asChild variant={emphasis === 'create' ? 'primary' : 'secondary'}>
        <Link to="/classes/new">
          <Plus aria-hidden="true" />
          {t('classes.create')}
        </Link>
      </Button>
    </div>
  );
}

export function ClassCard({ cls }: { cls: ClassForMember }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to={`/classes/${cls.id}`}
        className="group flex items-center gap-4 rounded-xl border-default border-border bg-surface p-5 shadow-sm transition-colors hover:border-primary"
      >
        <span aria-hidden="true" className="rounded-lg bg-primary-soft p-3 text-primary-text">
          <School className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg font-semibold text-text">{cls.name}</span>
          <span className="truncate text-sm text-muted">{classSubtitle(cls)}</span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={cls.role === 'student' ? 'neutral' : 'primary'}>
              {t(`classes.roles.${cls.role}`)}
            </Badge>
            {t('classes.memberCount', { count: cls.memberCount })}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
        />
      </Link>
    </li>
  );
}

export function ClassesPage() {
  const { t } = useTranslation();
  const classes = useClasses();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display font-bold tracking-tight text-text">{t('classes.title')}</h1>
          <p className="text-muted">{t('classes.intro')}</p>
        </div>
        {classes.data && classes.data.length > 0 && <ClassActions />}
      </header>

      {classes.isPending && (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}
      {classes.isError && (
        <Alert
          tone="danger"
          title={t('classes.loadFailed')}
          action={
            <Button size="sm" variant="secondary" onClick={() => void classes.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {classes.data?.length === 0 && (
        <EmptyState
          icon={<School />}
          title={t('classes.emptyTitle')}
          action={<ClassActions />}
          className="rounded-xl border-default border-dashed border-border-strong"
        >
          {t('classes.emptyBody')}
        </EmptyState>
      )}
      {classes.data && classes.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {classes.data.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </ul>
      )}
    </div>
  );
}
