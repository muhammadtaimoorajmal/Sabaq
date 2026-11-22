import {
  AlarmClock,
  CalendarCheck,
  CheckCircle2,
  Copy,
  CopyPlus,
  FileCheck2,
  MoreVertical,
  Pencil,
  Send,
  Trash2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Alert,
  Avatar,
  DateTimeField,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
  Badge,
  Button,
  Card,
  Checkbox,
  CourseTag,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  ErrorSummary,
  Field,
  type FormError,
  IconButton,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  PasswordInput,
  Select,
  Skeleton,
  Spinner,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
} from '../components/ui';
import { PreferencesPanel } from '../preferences/PreferencesPanel';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-2xl font-bold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

const SWATCHES = [
  ['canvas', 'bg-canvas'],
  ['surface', 'bg-surface'],
  ['primary', 'bg-primary'],
  ['danger', 'bg-danger'],
  ['warning', 'bg-warning-soft'],
  ['success', 'bg-success-soft'],
] as const;

function DueDateExample() {
  const { t } = useTranslation();
  const [due, setDue] = useState<string | null>(null);
  return (
    <DateTimeField
      label={t('designSystem.sample.dueLabel')}
      hint={t('designSystem.sample.dueHint')}
      value={due}
      onChange={setDue}
      timeZone="Asia/Karachi"
    />
  );
}

function SignUpExample() {
  const { t } = useTranslation();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FormError[]>([]);
  const [saved, setSaved] = useState(false);
  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: FormError[] = [];
    if (values.name.trim().length < 2)
      found.push({ field: 'ds-name', message: t('designSystem.sample.nameRequired') });
    if (!/^\S+@\S+\.\S+$/.test(values.email))
      found.push({ field: 'ds-email', message: t('designSystem.sample.emailInvalid') });
    if (values.password.length < 8)
      found.push({ field: 'ds-password', message: t('designSystem.sample.passwordShort') });
    setErrors(found);
    setSaved(found.length === 0);
  };

  return (
    <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-5">
      <ErrorSummary errors={errors} />
      {saved && <Alert tone="success" live="polite" title={t('designSystem.sample.formSaved')} />}
      <Field
        id="ds-name"
        label={t('designSystem.sample.nameLabel')}
        hint={t('designSystem.sample.nameHint')}
        error={errorFor('ds-name')}
        required
      >
        <Input
          autoComplete="name"
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
      </Field>
      <Field
        id="ds-email"
        label={t('designSystem.sample.emailLabel')}
        error={errorFor('ds-email')}
        required
      >
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
      </Field>
      <Field
        id="ds-password"
        label={t('designSystem.sample.passwordLabel')}
        hint={t('designSystem.sample.passwordHint')}
        error={errorFor('ds-password')}
        required
      >
        <PasswordInput
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
      </Field>
      <Field label={t('designSystem.sample.reminderLabel')} optional>
        <Select defaultValue="day">
          <option value="none">{t('designSystem.sample.reminderNone')}</option>
          <option value="day">{t('designSystem.sample.reminderDay')}</option>
          <option value="hour">{t('designSystem.sample.reminderHour')}</option>
        </Select>
      </Field>
      <Field label={t('designSystem.sample.notesLabel')} optional>
        <Textarea showCount maxLength={120} />
      </Field>
      <Checkbox label={t('designSystem.sample.remindLabel')} defaultChecked />
      <Switch label={t('designSystem.sample.quietLabel')} />
      <Button type="submit" className="self-start">
        {t('designSystem.sample.submitForm')}
      </Button>
    </form>
  );
}

/**
 * A living style guide: every component in every state, inside the real theme, text size,
 * spacing and language settings.
 */
export function DesignSystemPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[18rem_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <h2 className="text-lg font-bold text-text">{t('preferences.title')}</h2>
          <p className="mt-1 mb-5 text-sm text-muted">{t('preferences.description')}</p>
          <PreferencesPanel />
        </Card>
      </aside>

      <main id="main" tabIndex={-1} className="flex min-w-0 flex-col gap-12 focus:outline-none">
        <header className="flex flex-col gap-2">
          <p className="font-semibold text-primary-text">{t('common.appName')}</p>
          <h1 className="text-display font-bold tracking-tight text-text">
            {t('designSystem.title')}
          </h1>
          <p className="max-w-2xl text-lg text-muted">{t('designSystem.intro')}</p>
        </header>

        <Section id="ds-colors" title={t('designSystem.sections.colors')}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SWATCHES.map(([name, background]) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-lg border-default border-border bg-surface p-3"
              >
                <span
                  aria-hidden="true"
                  className={`size-10 rounded-md border-default border-border ${background}`}
                />
                <span className="font-semibold">{t(`designSystem.colorNames.${name}`)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4">
            <CourseTag code="CS-341" color="blue" />
            <CourseTag code="CS-352" color="teal" />
            <CourseTag code="CS-363" color="purple" />
            <CourseTag code="CS-374" color="orange" />
            <CourseTag code="CS-385" color="green" />
            <CourseTag code="HU-210" color="pink" />
          </div>
        </Section>

        <Section id="ds-type" title={t('designSystem.sections.typography')}>
          <Card className="flex flex-col gap-3">
            <p className="text-4xl font-bold">{t('designSystem.typeScale')}</p>
            <p className="text-2xl font-semibold">{t('designSystem.typeScale')}</p>
            <p className="text-lg">{t('designSystem.typeScale')}</p>
            <p>{t('designSystem.typeScale')}</p>
            <p className="text-sm text-muted">{t('designSystem.typeScale')}</p>
          </Card>
        </Section>

        <Section id="ds-buttons" title={t('designSystem.sections.buttons')}>
          <Card className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CourseTag code="CS-363" color="purple" />
                <Badge tone="warning" icon={<AlarmClock />}>
                  {t('designSystem.sample.badgeToday')}
                </Badge>
              </div>
              <h3 className="mt-2 text-xl font-semibold">{t('designSystem.sample.heading')}</h3>
              <p className="text-muted">{t('designSystem.sample.body')}</p>
              <p className="mt-1 text-sm font-semibold text-warning-text">
                {t('designSystem.sample.due')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                loading={loading}
                loadingText={t('designSystem.sample.loading')}
                onClick={() => {
                  setLoading(true);
                  window.setTimeout(() => setLoading(false), 1500);
                }}
              >
                <Send aria-hidden="true" />
                {t('designSystem.sample.primary')}
              </Button>
              <Button variant="secondary">
                <FileCheck2 aria-hidden="true" />
                {t('designSystem.sample.secondary')}
              </Button>
              <Button variant="ghost">{t('designSystem.sample.ghost')}</Button>
              <Button variant="danger">
                <Trash2 aria-hidden="true" />
                {t('designSystem.sample.danger')}
              </Button>
              <Button disabled>{t('designSystem.sample.disabled')}</Button>
              <IconButton label={t('designSystem.sample.tooltip')} icon={<Copy />} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary">
                {t('designSystem.sample.secondary')}
              </Button>
              <Button size="lg">{t('designSystem.sample.primary')}</Button>
            </div>
          </Card>
        </Section>

        <Section id="ds-forms" title={t('designSystem.sections.forms')}>
          <Card>
            <SignUpExample />
          </Card>
        </Section>

        <Section id="ds-feedback" title={t('designSystem.sections.feedback')}>
          <div className="grid gap-3 md:grid-cols-2">
            <Alert tone="info" title={t('designSystem.sample.infoTitle')}>
              {t('designSystem.sample.infoBody')}
            </Alert>
            <Alert tone="success" title={t('designSystem.sample.successTitle')}>
              {t('designSystem.sample.successBody')}
            </Alert>
            <Alert tone="warning" title={t('designSystem.sample.warningTitle')}>
              {t('designSystem.sample.warningBody')}
            </Alert>
            <Alert tone="danger" title={t('designSystem.sample.dangerTitle')}>
              {t('designSystem.sample.dangerBody')}
            </Alert>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">{t('designSystem.sample.badgeOverdue')}</Badge>
            <Badge tone="warning">{t('designSystem.sample.badgeToday')}</Badge>
            <Badge tone="primary">{t('designSystem.sample.badgeSoon')}</Badge>
            <Badge tone="success" icon={<CheckCircle2 />}>
              {t('designSystem.sample.badgeDone')}
            </Badge>
            <Badge>{t('designSystem.sample.badgeNeutral')}</Badge>
          </div>
          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              toast(t('designSystem.sample.toastMessage'), {
                action: { label: t('designSystem.sample.undo'), onClick: () => undefined },
              })
            }
          >
            {t('designSystem.sample.showToast')}
          </Button>
        </Section>

        <Section id="ds-overlays" title={t('designSystem.sections.overlays')}>
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">{t('designSystem.sample.openDialog')}</Button>
              </DialogTrigger>
              <DialogContent
                title={t('designSystem.sample.dialogTitle')}
                description={t('designSystem.sample.dialogBody')}
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="secondary">{t('common.cancel')}</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="danger">{t('designSystem.sample.dialogConfirm')}</Button>
                    </DialogClose>
                  </>
                }
              />
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">
                  <SlidersHorizontal aria-hidden="true" />
                  {t('designSystem.sample.openSheet')}
                </Button>
              </SheetTrigger>
              <SheetContent
                title={t('designSystem.sample.sheetTitle')}
                description={t('designSystem.sample.sheetBody')}
                footer={
                  <SheetClose asChild>
                    <Button>{t('designSystem.sample.sheetApply')}</Button>
                  </SheetClose>
                }
              >
                <div className="flex flex-col gap-3">
                  <Checkbox label="CS-341 · Human-Computer Interaction" defaultChecked />
                  <Checkbox label="CS-363 · Database Systems" defaultChecked />
                  <Checkbox label="CS-385 · Computer Networks" />
                </div>
              </SheetContent>
            </Sheet>
            <Menu>
              <MenuTrigger asChild>
                <IconButton
                  label={t('common.moreOptions')}
                  icon={<MoreVertical />}
                  variant="secondary"
                />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Pencil />}>{t('designSystem.sample.menuEdit')}</MenuItem>
                <MenuItem icon={<CopyPlus />}>{t('designSystem.sample.menuDuplicate')}</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger>
                  {t('designSystem.sample.menuDelete')}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </Section>

        <Section id="ds-dates" title={t('designSystem.sections.dates')}>
          <Card>
            <DueDateExample />
          </Card>
        </Section>

        <Section id="ds-people" title={t('designSystem.sections.people')}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name="Zara Ahmed" size="lg" />
            <Avatar name="Dr. Ayesha Siddiqui" />
            <Avatar name="Hamza Khan" size="sm" />
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {['Ali Raza', 'Fatima Noor', 'Omar Farooq', 'Hira Shah'].map((name) => (
                <Avatar key={name} name={name} size="sm" className="ring-2 ring-surface" />
              ))}
            </div>
          </div>
        </Section>

        <Section id="ds-tabs" title={t('designSystem.sections.navigation')}>
          <Card>
            <Tabs defaultValue="today">
              <TabList label={t('designSystem.sections.navigation')}>
                <Tab value="today">{t('designSystem.sample.tabToday')}</Tab>
                <Tab value="week">{t('designSystem.sample.tabWeek')}</Tab>
                <Tab value="later">{t('designSystem.sample.tabLater')}</Tab>
              </TabList>
              <TabPanel value="today">{t('designSystem.sample.tabTodayBody')}</TabPanel>
              <TabPanel value="week">{t('designSystem.sample.tabWeekBody')}</TabPanel>
              <TabPanel value="later">{t('designSystem.sample.tabLaterBody')}</TabPanel>
            </Tabs>
          </Card>
        </Section>

        <Section id="ds-states" title={t('designSystem.sections.states')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <EmptyState
                headingLevel={3}
                icon={<CalendarCheck />}
                title={t('designSystem.sample.emptyTitle')}
                action={
                  <Button variant="secondary">
                    <Users aria-hidden="true" />
                    {t('designSystem.sample.emptyAction')}
                  </Button>
                }
              >
                {t('designSystem.sample.emptyBody')}
              </EmptyState>
            </Card>
            <Card className="flex flex-col gap-3">
              <Spinner />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-32" />
            </Card>
          </div>
        </Section>
      </main>
    </div>
  );
}
