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
    <li className="plan-item" data-done={done || undefined}>
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

function Rhythm({ language }: { language: string }) {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: qk.analytics(language, 'timeline-28'), queryFn: () => analyticsApi.timeline(language, 28) });
  if (!data) return null;
  const active = data.filter((d) => d.answers > 0 || d.reviews > 0).length;
  return (
    <Section title={t('today.rhythmTitle')}>
      <div className="rhythm" role="img" aria-label={t('today.rhythmCaption', { days: active })}>
        {data.map((d) => (
          <span key={d.date} className="rhythm__cell" data-active={d.answers > 0 || d.reviews > 0 || undefined} title={d.date} />
        ))}
      </div>
      <p className="small">{t('today.rhythmCaption', { days: active })}</p>
      <p className="caption">{t('today.rhythmLegend')}</p>
    </Section>
  );
}

function Difficulty({ recs }: { recs: RecommendationResult }) {
  const i18n = useI18n();
  const { topicTitle } = useTopics();
  return (
    <Section title={i18n.t('today.difficultyTitle')}>
      <p className="today__stat">{i18n.t(`today.difficulty.${recs.difficultyAdjustment}`)}</p>
      {recs.difficultyReason ? <p className="small muted">{reasonText(recs.difficultyReason, i18n, { topicTitle })}</p> : null}
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
          <Rhythm language={code} />
          {recs.data ? <Difficulty recs={recs.data} /> : null}
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
