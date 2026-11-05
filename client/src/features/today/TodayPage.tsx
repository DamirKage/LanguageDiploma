import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, RefreshCw } from 'lucide-react';
import type { Recommendation, RecommendationResult } from '@linguapath/shared';
import { analyticsApi, personalApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { Button, EmptyState, ErrorState, PageLoader, Section, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { qk, useActiveLanguage, useEnrollments, useTopics } from '../../lib/queries';
import { reasonText, recommendationTitle } from './recommendationText';
import { useStartActivity } from './useStartActivity';

function greetingKey(hour: number) {
  if (hour < 5) return 'today.greeting.night' as const;
  if (hour < 12) return 'today.greeting.morning' as const;
  if (hour < 18) return 'today.greeting.day' as const;
  return 'today.greeting.evening' as const;
}

function PlanItem({
  item,
  index,
  onStart,
  pending,
}: {
  item: Recommendation & { done?: boolean };
  index: number;
  onStart: (item: Recommendation) => void;
  pending: boolean;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const { topicTitle } = useTopics();
  const done = !!item.done;
  return (
    <li className="plan-item" data-done={done || undefined} style={{ '--i': index } as React.CSSProperties}>
      <span className="plan-item__num" aria-hidden>
        {done ? <Check size={16} /> : String(index + 1).padStart(2, '0')}
      </span>
      <div className="plan-item__body">
        <p className="eyebrow">
          {t(`recommendation.type.${item.type}`)} · {t('recommendation.minutes', { n: item.estimatedMinutes })}
        </p>
        <h3 className="plan-item__title">{recommendationTitle(item, i18n, { topicTitle })}</h3>
        <ul className="reason-list" aria-label={t('today.whyTitle')}>
          {item.reasons.map((reason, i) => (
            <li key={i}>{reasonText(reason, i18n, { topicTitle })}</li>
          ))}
        </ul>
      </div>
      <div className="plan-item__action">
        {done ? (
          <span className="tag tag--ok">{t('recommendation.done')}</span>
        ) : (
          <Button variant={index === 0 ? 'primary' : 'default'} onClick={() => onStart(item)} loading={pending}>
            {t(`recommendation.action.${item.type}`)}
            <ArrowRight size={16} aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );
}

/** The signals the plan is built from, shown next to it so the recommendations can be checked against the data. */
function Diagnosis({ language, recs }: { language: string; recs: RecommendationResult | undefined }) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const { topicTitle } = useTopics();
  const overview = useQuery({ queryKey: qk.analytics(language, 'overview'), queryFn: () => analyticsApi.overview(language) });
  const topics = useQuery({ queryKey: qk.analytics(language, 'topics'), queryFn: () => analyticsApi.topics(language) });
  if (!overview.data) return null;
  const o = overview.data;
  const weakest = (topics.data ?? [])
    .filter((tp) => tp.enoughData)
    .sort((a, b) => (a.recentAccuracy ?? a.accuracy) - (b.recentAccuracy ?? b.accuracy))[0];
  const pct = (v: number | null) => (v === null ? t('today.diagnosis.noData') : `${Math.round(v * 100)}%`);
  return (
    <Section title={t('today.diagnosis.title')}>
      <dl className="facts facts--wide">
        <div>
          <dt>{t('today.diagnosis.accuracy')}</dt>
          <dd>
            {pct(o.accuracy.last7Days)}
            <span className="caption"> · {t('today.diagnosis.accuracyAll', { value: pct(o.accuracy.overall), answers: plural('common.answers', o.accuracy.answers) })}</span>
          </dd>
        </div>
        <div>
          <dt>{t('today.diagnosis.weakTopic')}</dt>
          <dd>
            {weakest ? (
              <>
                {topicTitle(weakest.topic)}
                <span className="caption"> · {pct(weakest.recentAccuracy ?? weakest.accuracy)}, {plural('common.answers', weakest.answers)}</span>
              </>
            ) : (
              t('today.diagnosis.noData')
            )}
          </dd>
        </div>
        <div>
          <dt>{t('today.diagnosis.review')}</dt>
          <dd>{plural('today.diagnosis.words', o.words.dueToday)}</dd>
        </div>
        <div>
          <dt>{t('today.diagnosis.regularity')}</dt>
          <dd>
            {t('today.diagnosis.days', { days: o.rhythm.activeDaysLast28 })}
            <span className="caption"> · {t('today.diagnosis.minutes', { minutes: plural('common.minutes', o.rhythm.minutesLast7) })}</span>
          </dd>
        </div>
        {recs ? (
          <div>
            <dt>{t('today.difficultyTitle')}</dt>
            <dd>
              {t(`today.difficulty.${recs.difficultyAdjustment}`)}
              {recs.difficultyReason ? <span className="caption"> · {reasonText(recs.difficultyReason, i18n, { topicTitle })}</span> : null}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="caption">
        {t('today.diagnosis.note')} <Link to="/progress">{t('today.diagnosis.more')}</Link>
      </p>
    </Section>
  );
}

export default function TodayPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const { user } = useAuth();
  const { code, name } = useActiveLanguage();
  const { data: enrollments } = useEnrollments();
  const queryClient = useQueryClient();
  const enrollment = enrollments?.find((e) => e.language === code);
  useTitle('nav.today');

  const plan = useQuery({ queryKey: qk.plan(code ?? ''), queryFn: () => personalApi.plan(code!), enabled: !!code });
  const recs = useQuery({ queryKey: qk.recommendations(code ?? ''), queryFn: () => personalApi.recommendations(code!), enabled: !!code });
  const start = useStartActivity(code ?? '');
  const rebuild = useMutation({
    mutationFn: () => personalApi.rebuildPlan(code!),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.plan(code!), data);
      void queryClient.invalidateQueries({ queryKey: qk.recommendations(code!) });
    },
  });

  if (!code) return <EmptyState title={t('today.noLanguage')} action={<Link to="/onboarding?add=1">{t('nav.addLanguage')}</Link>} />;
  if (plan.isLoading) return <PageLoader />;
  if (plan.error) return <ErrorState error={plan.error} onRetry={() => plan.refetch()} />;

  const items = plan.data!.items;
  const allDone = items.length > 0 && items.every((i) => i.done);
  const extra = (recs.data?.items ?? []).filter((r) => !items.some((p) => p.key === r.key));
  const now = new Date();
  const pendingKey = start.isPending ? start.variables?.key : null;

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{i18n.date(now, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{t(greetingKey(now.getHours()), { name: user?.name ?? '' })}</h1>
        <p className="page-head__lead">
          {name}
          {enrollment ? ` · ${t(`levels.${enrollment.level}`)}` : ''}
        </p>
      </header>

      <div className="today">
        <div className="stack" style={{ '--gap': 'var(--s10)' } as React.CSSProperties}>
          <Section
            title={t('today.planTitle')}
            aside={
              <div className="row" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
                <span className="small muted">{t('today.planMeta', { planned: plan.data!.plannedMinutes, budget: plan.data!.budgetMinutes })}</span>
                <Button variant="ghost" size="sm" onClick={() => rebuild.mutate()} loading={rebuild.isPending} title={t('today.rebuildHint')}>
                  <RefreshCw size={14} aria-hidden />
                  {t('today.rebuild')}
                </Button>
              </div>
            }
          >
            {items.length === 0 ? (
              <p className="muted">{t('today.emptyPlan')}</p>
            ) : (
              <ol className="plan">
                {items.map((item, i) => (
                  <PlanItem key={item.key} item={item} index={i} onStart={(r) => start.mutate(r)} pending={pendingKey === item.key} />
                ))}
              </ol>
            )}
            {allDone ? (
              <div className="plan-done">
                <p className="plan-done__title">{t('today.planDone')}</p>
                <p className="muted">{t('today.planDoneLead')}</p>
              </div>
            ) : null}
          </Section>

          {extra.length > 0 ? (
            <Section title={t('today.more')}>
              <ol className="plan plan--compact">
                {extra.slice(0, 3).map((item, i) => (
                  <PlanItem key={item.key} item={item} index={items.length + i} onStart={(r) => start.mutate(r)} pending={pendingKey === item.key} />
                ))}
              </ol>
            </Section>
          ) : null}
        </div>

        <aside className="stack today__aside" style={{ '--gap': 'var(--s8)' } as React.CSSProperties}>
          <Diagnosis language={code} recs={recs.data} />
          {plan.data!.upcoming.length > 0 ? (
            <Section title={t('today.upcoming')}>
              <ol className="upcoming">
                {plan.data!.upcoming.map((l) => (
                  <li key={l.lessonId}>
                    <Link to={`/lessons/${l.lessonId}`}>{l.title}</Link>
                    <span className="small muted">
                      {l.level} · {l.moduleTitle}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
