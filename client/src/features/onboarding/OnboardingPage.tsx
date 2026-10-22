import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { CEFR_LEVELS, DAILY_MINUTES_OPTIONS, LEARNING_GOALS, type CefrLevel, type LearningGoal } from '@slog/shared';
import { learningApi, meApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { Brand } from '../../components/layout/AppShell';
import { Alert, Button, ErrorState, errorMessage, LanguageMark, PageLoader, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, useEnrollments, useLanguages } from '../../lib/queries';

type Step = 'language' | 'goals' | 'time' | 'level';
type StartMode = 'placement' | 'beginner' | 'choose';

export default function OnboardingPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const addingLanguage = params.get('add') === '1' && !!user?.onboarded;
  const steps: Step[] = addingLanguage ? ['language', 'level'] : ['language', 'goals', 'time', 'level'];
  const [stepIndex, setStepIndex] = useState(0);
  const [language, setLanguage] = useState<string | null>(null);
  const [goals, setGoals] = useState<LearningGoal[]>(user?.goals ?? []);
  const [minutes, setMinutes] = useState<number>(user?.dailyMinutes ?? 15);
  const [mode, setMode] = useState<StartMode>('placement');
  const [level, setLevel] = useState<CefrLevel>('A1');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const languages = useLanguages();
  const enrollments = useEnrollments();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useTitle('nav.addLanguage');

  const step = steps[stepIndex]!;
  const enrolled = new Set((enrollments.data ?? []).map((e) => e.language));
  const canNext = step === 'language' ? !!language : step === 'goals' ? goals.length > 0 : true;

  async function finish() {
    if (!language) return;
    setPending(true);
    setError(null);
    try {
      await meApi.enroll(language);
      const updated = await meApi.update(
        addingLanguage ? { activeLanguage: language } : { activeLanguage: language, goals, dailyMinutes: minutes, onboarded: true },
      );
      setUser(updated);
      for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
      if (mode === 'placement') {
        const attempt = await learningApi.startPlacement(language);
        navigate(`/learn/${attempt.id}`, { replace: true });
      } else {
        await learningApi.skipPlacement(language, mode === 'beginner' ? 'A1' : level);
        navigate('/today', { replace: true });
      }
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  if (languages.isLoading) return <PageLoader />;
  if (languages.error) return <ErrorState error={languages.error} onRetry={() => languages.refetch()} />;

  return (
    <div className="public">
      <header className="public__head">
        <Brand />
        <span className="small muted">{t('onboarding.stepOf', { step: stepIndex + 1, total: steps.length })}</span>
      </header>
      <main className="public__main" id="main">
        <div className="onboarding">
          {step === 'language' ? (
            <section className="stack" aria-labelledby="ob-title">
              <h1 id="ob-title">{t('onboarding.languageTitle')}</h1>
              <p className="muted">{t('onboarding.languageLead')}</p>
              <div className="onboarding__grid" role="radiogroup" aria-labelledby="ob-title">
                {languages.data!.map((lang) => (
                  <button
                    key={lang.code}
                    role="radio"
                    aria-checked={language === lang.code}
                    className="option"
                    onClick={() => setLanguage(lang.code)}
                  >
                    <LanguageMark code={lang.code} size="lg" />
                    <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                      <span className="option__title target" style={{ fontSize: 'var(--text-lg)' }}>
                        {lang.nativeName}
                      </span>
                      <span className="option__hint">
                        {i18n.tx(`languages.${lang.code}`, lang.name)} · {lang.levels[0]}–{lang.levels.at(-1)}
                        {enrolled.has(lang.code) ? ` · ${t('onboarding.alreadyLearning')}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 'goals' ? (
            <section className="stack" aria-labelledby="ob-title">
              <h1 id="ob-title">{t('onboarding.goalsTitle')}</h1>
              <p className="muted">{t('onboarding.goalsLead')}</p>
              <div className="onboarding__grid">
                {LEARNING_GOALS.map((goal) => {
                  const on = goals.includes(goal);
                  return (
                    <button
                      key={goal}
                      className="option"
                      aria-pressed={on}
                      onClick={() => setGoals(on ? goals.filter((g) => g !== goal) : [...goals, goal])}
                    >
                      <span className="onboarding__check" aria-hidden>
                        {on ? <Check size={14} /> : null}
                      </span>
                      <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                        <span className="option__title">{t(`goals.${goal}`)}</span>
                        <span className="option__hint">{t(`goalHints.${goal}`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 'time' ? (
            <section className="stack" aria-labelledby="ob-title">
              <h1 id="ob-title">{t('onboarding.timeTitle')}</h1>
              <p className="muted">{t('onboarding.timeLead')}</p>
              <div className="onboarding__grid onboarding__grid--3" role="radiogroup" aria-labelledby="ob-title">
                {DAILY_MINUTES_OPTIONS.map((n) => (
                  <button key={n} role="radio" aria-checked={minutes === n} className="option" onClick={() => setMinutes(n)}>
                    <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                      <span className="option__title">{t('onboarding.timeOption', { n })}</span>
                      <span className="option__hint">{i18n.tx(`onboarding.timeHints.${n}`, '')}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 'level' ? (
            <section className="stack" aria-labelledby="ob-title">
              <h1 id="ob-title">{t('onboarding.levelTitle')}</h1>
              <p className="muted">{t('onboarding.levelLead')}</p>
              <div className="stack" role="radiogroup" aria-labelledby="ob-title">
                {(
                  [
                    ['placement', 'onboarding.placementOption', 'onboarding.placementHint'],
                    ['beginner', 'onboarding.beginnerOption', 'onboarding.beginnerHint'],
                    ['choose', 'onboarding.chooseLevelOption', 'onboarding.chooseLevelHint'],
                  ] as const
                ).map(([value, title, hint]) => (
                  <button key={value} role="radio" aria-checked={mode === value} className="option" onClick={() => setMode(value)}>
                    <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                      <span className="option__title">{t(title)}</span>
                      <span className="option__hint">{t(hint)}</span>
                    </span>
                  </button>
                ))}
              </div>
              {mode === 'choose' ? (
                <div className="seg" role="radiogroup" aria-label={t('common.level')}>
                  {CEFR_LEVELS.map((l) => (
                    <button key={l} role="radio" aria-checked={level === l} aria-pressed={level === l} onClick={() => setLevel(l)}>
                      {l}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? <Alert tone="bad">{errorMessage(error, i18n)}</Alert> : null}

          <div className="spread onboarding__actions">
            {stepIndex > 0 ? (
              <Button variant="ghost" onClick={() => setStepIndex((i) => i - 1)}>
                <ArrowLeft size={16} aria-hidden />
                {t('common.back')}
              </Button>
            ) : (
              <span />
            )}
            {stepIndex < steps.length - 1 ? (
              <Button variant="primary" size="lg" disabled={!canNext} onClick={() => setStepIndex((i) => i + 1)}>
                {t('common.next')}
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={finish} loading={pending}>
                {mode === 'placement' ? t('onboarding.placementOption') : t('onboarding.finish')}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
