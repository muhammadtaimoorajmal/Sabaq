import type { ClassForMember } from '@sabaq/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useArchiveClass, useClass, useUpdateClass } from '../../api/classes';
import { ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { NotFoundPage } from '../StatusPages';
import { ClassDetailsForm } from './ClassDetailsForm';
import { CoursesTab } from './CoursesTab';
import { allowed, classSubtitle } from './helpers';
import { MembersTab } from './MembersTab';
import { ShareCard } from './ShareCard';

function SettingsTab({ cls }: { cls: ClassForMember }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const update = useUpdateClass(cls.id);
  const archive = useArchiveClass(cls.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const failure = update.error instanceof ApiRequestError ? update.error : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 text-xl font-bold text-text">{t('classes.settings.details')}</h2>
        {failure && (
          <Alert
            tone="danger"
            live="assertive"
            className="mb-5"
            title={t(errorKey(failure.code))}
          />
        )}
        <ClassDetailsForm
          id="edit-class"
          mode="edit"
          initial={cls}
          pending={update.isPending}
          submitLabel={t('common.save')}
          pendingLabel={t('common.saving')}
          onSubmit={({ myRole: _role, ...input }) =>
            update.mutate(input, { onSuccess: () => toast.success(t('classes.settings.saved')) })
          }
        />
      </Card>
      <Card className="flex flex-col gap-3 border-danger/40">
        <h2 className="text-xl font-bold text-danger-text">{t('classes.settings.dangerTitle')}</h2>
        <p className="text-muted">{t('classes.settings.dangerBody')}</p>
        <Button variant="danger" className="self-start" onClick={() => setConfirmOpen(true)}>
          <Trash2 aria-hidden="true" />
          {t('classes.settings.archive')}
        </Button>
      </Card>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('classes.settings.archiveTitle', { name: cls.name })}
        body={t('classes.settings.dangerBody')}
        confirmLabel={t('classes.settings.archiveConfirm')}
        pending={archive.isPending}
        onConfirm={() =>
          archive.mutate(undefined, {
            onSuccess: () => {
              toast.success(t('classes.settings.archived', { name: cls.name }));
              void navigate('/classes', { replace: true });
            },
            onError: (error) => {
              setConfirmOpen(false);
              toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined)));
            },
          })
        }
      />
    </div>
  );
}

const TABS = ['courses', 'members', 'settings'] as const;
type TabName = (typeof TABS)[number];

/** One class: invite card, then courses, members and (for managers) settings. */
export function ClassPage() {
  const { t } = useTranslation();
  const { classId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const user = useCurrentUser();
  const cls = useClass(classId);

  if (cls.isPending) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (cls.isError) {
    if (cls.error instanceof ApiRequestError && cls.error.code === 'not_found')
      return <NotFoundPage />;
    return (
      <Alert
        tone="danger"
        title={t(errorKey(cls.error instanceof ApiRequestError ? cls.error.code : undefined))}
      />
    );
  }

  const data = cls.data;
  const canSettings = allowed(user, data, 'class.update');
  const tabs = TABS.filter((tab) => tab !== 'settings' || canSettings);
  const requested = params.get('tab') as TabName | null;
  const tab = requested && tabs.includes(requested) ? requested : 'courses';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          to="/classes"
          className="self-start text-sm font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
        >
          {t('classes.title')}
        </Link>
        <h1 className="text-display font-bold tracking-tight text-text">{data.name}</h1>
        <p className="text-muted">{classSubtitle(data)}</p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone={data.role === 'student' ? 'neutral' : 'primary'}>
            {t(`classes.roles.${data.role}`)}
          </Badge>
          {t('classes.memberCount', { count: data.memberCount })}
        </p>
      </header>

      <ShareCard cls={data} />

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabList label={t('classes.tabs.label')}>
          {tabs.map((name) => (
            <Tab key={name} value={name}>
              {t(`classes.tabs.${name}`)}
            </Tab>
          ))}
        </TabList>
        <TabPanel value="courses">
          <CoursesTab cls={data} />
        </TabPanel>
        <TabPanel value="members">
          <MembersTab cls={data} />
        </TabPanel>
        {canSettings && (
          <TabPanel value="settings">
            <SettingsTab cls={data} />
          </TabPanel>
        )}
      </Tabs>
    </div>
  );
}
