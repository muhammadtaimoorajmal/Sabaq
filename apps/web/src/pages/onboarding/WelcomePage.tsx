import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useCompleteOnboarding } from '../../api/account';
import { useClasses } from '../../api/classes';
import { useCurrentUser } from '../../auth/AuthProvider';
import { Button, Card } from '../../components/ui';
import { cn } from '../../lib/cn';
import { PreferencesPanel } from '../../preferences/PreferencesPanel';
import { AvatarPicker } from '../account/AvatarPicker';
import { ProfileForm } from '../account/ProfileForm';
import { linkClass } from '../auth/parts';
import { JoinCodeForm } from '../classes/JoinClassPage';
import { greetingName } from '../TodayPage';

export const WELCOME_STEPS = ['profile', 'display', 'class'] as const;
type Step = (typeof WELCOME_STEPS)[number];

/** The step from the address (`?step=2`), so the browser's Back button moves between steps. */
const stepFrom = (value: string | null) => {
  const index = Number(value ?? '1') - 1;
  return Number.isInteger(index) && index >= 0 && index < WELCOME_STEPS.length ? index : 0;
};

function Progress({ current }: { current: number }) {
  const { t } = useTranslation();
  return (
    <ol aria-label={t('welcome.progress')} className="grid grid-cols-3 gap-2">
      {WELCOME_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} aria-current={active ? 'step' : undefined} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 rounded-full',
                done || active ? 'bg-primary' : 'bg-surface-sunken',
              )}
            />
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm',
                active ? 'font-bold text-text' : 'text-muted',
              )}
            >
              {done && <Check aria-hidden="true" className="size-4 text-success-text" />}
              {t(`welcome.steps.${step}`)}
              {done && <span className="sr-only">{t('welcome.completed')}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ClassStep({ onFinish, back }: { onFinish: (to: string) => void; back: () => void }) {
  const { t } = useTranslation();
  const classes = useClasses();
  const mine = classes.data ?? [];

  if (mine.length > 0) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="font-semibold text-text">{t('welcome.class.alreadyIn')}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {mine.map((cls) => (
              <li key={cls.id} className="flex items-center gap-2 text-text">
                <Check aria-hidden="true" className="size-4 text-success-text" />
                {cls.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onFinish('/')}>{t('welcome.finish')}</Button>
          <Button variant="secondary" onClick={back}>
            {t('welcome.back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <JoinCodeForm id="welcome-join" onJoined={(joined) => onFinish(`/classes/${joined.id}`)} />
      <div className="flex flex-col gap-3 border-t-default border-border pt-5">
        <p className="text-muted">
          {t('welcome.class.createIntro')}{' '}
          <Link
            to="/classes/new"
            className={linkClass}
            onClick={(event) => {
              event.preventDefault();
              onFinish('/classes/new');
            }}
          >
            {t('classes.create')}
          </Link>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={back}>
            {t('welcome.back')}
          </Button>
          <Button variant="ghost" onClick={() => onFinish('/')}>
            {t('welcome.class.later')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The first minute after signing up: who you are, how Sabaq should look, and your class.
 * Every step can be skipped, the progress is always visible, and everything chosen here can be
 * changed later in Settings.
 */
export function WelcomePage() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const current = stepFrom(params.get('step'));
  const step: Step = WELCOME_STEPS[current] ?? 'profile';
  const complete = useCompleteOnboarding();
  const heading = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(current);

  // Moving to another step puts keyboard and screen reader focus on its heading.
  useEffect(() => {
    if (shownStep.current === current) return;
    shownStep.current = current;
    heading.current?.focus();
  }, [current]);

  const goTo = (index: number) => setParams({ step: String(index + 1) });
  const finish = (to: string) =>
    complete.mutate(undefined, { onSettled: () => void navigate(to, { replace: true }) });
  const next = () => goTo(current + 1);
  const back = () => goTo(current - 1);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-muted">
            {t('welcome.stepOf', { current: current + 1, total: WELCOME_STEPS.length })}
          </p>
          <h1 className="text-display font-bold tracking-tight text-text">
            {t('welcome.title', { name: greetingName(user.name) })}
          </h1>
          <p className="text-muted">{t('welcome.intro')}</p>
        </div>
        <Button variant="ghost" loading={complete.isPending} onClick={() => finish('/')}>
          {t('welcome.skip')}
        </Button>
      </header>

      <Progress current={current} />

      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold text-text">
            {t(`welcome.${step}.title`)}
          </h2>
          <p className="text-muted">{t(`welcome.${step}.intro`)}</p>
        </div>

        {step === 'profile' && (
          <>
            <AvatarPicker />
            <ProfileForm id="welcome-profile" submitLabel={t('welcome.next')} onSaved={next} />
          </>
        )}

        {step === 'display' && (
          <>
            <PreferencesPanel />
            <p className="text-sm text-muted">{t('welcome.display.more')}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={next}>{t('welcome.next')}</Button>
              <Button variant="secondary" onClick={back}>
                {t('welcome.back')}
              </Button>
            </div>
          </>
        )}

        {step === 'class' && <ClassStep onFinish={finish} back={back} />}
      </Card>
    </div>
  );
}
