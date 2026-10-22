import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { analyticsApi, meApi } from '../../api/endpoints';
import { Button, ErrorState, Meter, PageLoader, Section, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { qk, useActiveLanguage, useTopics } from '../../lib/queries';
import { BarChart, LineChart } from './charts';

const pct = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 100));

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <dt className="eyebrow">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {sub ? <dd className="caption">{sub}</dd> : null}
    </div>
  );
}

function History({ language }: { language: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [page, setPage] = useState(1);
  const history = useQuery({ queryKey: qk.history(language, page), queryFn: () => meApi.history({ language, page, pageSize: 10 }), placeholderData: (p) => p });
  if (!history.data) return null;
  const totalPages = Math.max(1, Math.ceil(history.data.total / history.data.pageSize));
  return (
    <Section title={t('progress.historyTitle')}>
      {history.data.items.length === 0 ? (
        <p className="muted">{t('progress.historyEmpty')}</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {history.data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      {i18n.date(a.completedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className="tag">{t(`progress.kind.${a.kind}`)}</span>
                    </td>
                    <td style={{ width: '100%' }}>{a.title}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{a.kind === 'placement' ? a.level : `${a.percent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="row">
              <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('common.prev')}
              </Button>
              <span className="small muted">{t('common.page', { page, total: totalPages })}</span>
              <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {t('common.nextPage')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}

export default function ProgressPage() {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const { code, name } = useActiveLanguage();
  const { topicTitle } = useTopics();
  const lang = code ?? '';
  const enabled = !!code;
  const overview = useQuery({ queryKey: qk.analytics(lang, 'overview'), queryFn: () => analyticsApi.overview(lang), enabled });
  const timeline = useQuery({ queryKey: qk.analytics(lang, 'timeline-30'), queryFn: () => analyticsApi.timeline(lang, 30), enabled });
  const topics = useQuery({ queryKey: qk.analytics(lang, 'topics'), queryFn: () => analyticsApi.topics(lang), enabled });
  const errors = useQuery({ queryKey: qk.analytics(lang, 'errors'), queryFn: () => analyticsApi.errors(lang), enabled });
  const srs = useQuery({ queryKey: qk.analytics(lang, 'srs'), queryFn: () => analyticsApi.srs(lang), enabled });
  useTitle('progress.title');

  if (overview.isLoading || !code) return <PageLoader />;
  if (overview.error) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data!;
  const hasActivity = (timeline.data ?? []).some((d) => d.answers > 0 || d.reviews > 0);
  const shortDate = (d: string) => i18n.date(d, { day: 'numeric', month: 'short' });

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{name}</p>
        <h1>{t('progress.title')}</h1>
        <p className="page-head__lead">{t('progress.lead')}</p>
      </header>

      <dl className="stats">
        <Stat label={t('progress.level')} value={o.level ?? '—'} sub={o.level ? t(`levels.${o.level}`) : undefined} />
        <Stat label={t('progress.lessons')} value={t('progress.lessonsValue', { done: o.lessons.completed, total: o.lessons.total })} />
        <Stat label={t('progress.words')} value={String(o.words.inReview)} sub={t('progress.wordsValue', { learned: o.words.learned, review: o.words.inReview })} />
        <Stat
          label={t('progress.accuracy')}
          value={o.accuracy.overall === null ? '—' : `${pct(o.accuracy.overall)}%`}
          sub={o.accuracy.answers ? plural('common.answers', o.accuracy.answers) : t('common.notEnoughData')}
        />
        <Stat
          label={t('progress.rhythm')}
          value={t('progress.rhythmDays', { days: o.rhythm.activeDaysLast28 })}
          sub={t('progress.rhythmMinutes', { minutes: plural('common.minutes', o.rhythm.minutesLast7) })}
        />
        <Stat label={t('progress.tests')} value={o.tests.averagePercent === null ? '—' : `${o.tests.averagePercent}%`} sub={t('progress.testsValue', { passed: o.tests.passed, taken: o.tests.taken })} />
      </dl>
      <p className="caption" style={{ marginTop: 'calc(var(--s8) * -1)' }}>
        {t('progress.accuracyCaption')}
      </p>

      <Section title={t('progress.timelineTitle')}>
        {!hasActivity ? (
          <p className="muted">{t('progress.timelineEmpty')}</p>
        ) : (
          <div className="chart-pair">
            <figure className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
              <figcaption className="small">{t('progress.timelineAccuracy')}</figcaption>
              <LineChart labels={timeline.data!.map((d) => shortDate(d.date))} values={timeline.data!.map((d) => pct(d.accuracy))} label={t('progress.timelineAccuracy')} max={100} suffix="%" />
            </figure>
            <figure className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
              <figcaption className="small">{t('progress.timelineMinutes')}</figcaption>
              <BarChart labels={timeline.data!.map((d) => shortDate(d.date))} values={timeline.data!.map((d) => d.minutes)} label={t('progress.timelineMinutes')} />
            </figure>
          </div>
        )}
      </Section>

      <div className="two-col">
        <Section title={t('progress.topicsTitle')}>
          {!topics.data?.length ? (
            <p className="muted">{t('progress.topicsEmpty')}</p>
          ) : (
            <ul className="bars">
              {topics.data.map((topic) => {
                const value = pct(topic.accuracy)!;
                const trend =
                  topic.recentAccuracy !== null && topic.previousAccuracy !== null && Math.abs(topic.recentAccuracy - topic.previousAccuracy) >= 0.1
                    ? topic.recentAccuracy > topic.previousAccuracy
                      ? 'up'
                      : 'down'
                    : null;
                return (
                  <li key={topic.topic} className="bars__row" data-faint={!topic.enoughData || undefined}>
                    <div className="spread">
                      <span className="small">{topicTitle(topic.topic)}</span>
                      <span className="small">
                        {topic.enoughData ? `${value}%` : t('common.notEnoughData')}
                        <span className="muted"> · {plural('common.answers', topic.answers)}</span>
                      </span>
                    </div>
                    {topic.enoughData ? <Meter value={value} tone={value < 60 ? 'bad' : value < 75 ? 'warn' : 'ok'} label={topicTitle(topic.topic)} /> : null}
                    {trend ? (
                      <span className="caption row" style={{ '--gap': '4px' } as React.CSSProperties}>
                        {trend === 'up' ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
                        {t(trend === 'up' ? 'progress.trendUp' : 'progress.trendDown', { from: pct(topic.previousAccuracy)!, to: pct(topic.recentAccuracy)! })}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="caption">{t('progress.topicsCaption')}</p>
        </Section>

        <Section title={t('progress.errorsTitle')}>
          {!errors.data?.byCategory.length ? (
            <p className="muted">{t('progress.errorsEmpty')}</p>
          ) : (
            <>
              <ul className="bars">
                {errors.data.byCategory.map((c) => (
                  <li key={c.category} className="bars__row">
                    <div className="spread">
                      <span className="small">{t(`errorCategories.${c.category}`)}</span>
                      <span className="small">
                        {c.errors} <span className="muted">· {pct(c.rate)}%</span>
                      </span>
                    </div>
                    <Meter value={c.rate * 100} tone="bad" label={t(`errorCategories.${c.category}`)} />
                  </li>
                ))}
              </ul>
              <p className="caption">{t('progress.errorsCaption')}</p>
              <h3 className="small" style={{ marginTop: 'var(--s2)' }}>
                {t('progress.errorsByType')}
              </h3>
              <ul className="plain-list small">
                {errors.data.byExerciseType
                  .filter((e) => e.errors > 0)
                  .map((e) => (
                    <li key={e.type} className="spread">
                      <span>{t(`exerciseTypes.${e.type}`)}</span>
                      <span className="muted">
                        {e.errors} / {e.answers}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Section>
      </div>

      {errors.data?.recent.length ? (
        <Section title={t('progress.mistakesTitle')} aside={<span className="small muted">{t('progress.mistakesLead')}</span>}>
          <ul className="mistakes">
            {errors.data.recent.slice(0, 8).map((m, i) => (
              <li key={i}>
                <p className="small">{m.prompt}</p>
                <p className="small">
                  <span className="mistakes__given target">{m.given || '—'}</span> → <span className="target">{m.expected}</span>
                </p>
                <p className="caption">
                  {topicTitle(m.topic)} · {t(`errorCategories.${m.category}`)} · {i18n.date(m.at, { day: 'numeric', month: 'short' })}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {srs.data ? (
        <Section title={t('progress.srsTitle')} aside={<Link to="/review">{t('nav.review')} →</Link>}>
          <div className="two-col">
            <figure className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
              <figcaption className="small">{t('progress.srsForecast')}</figcaption>
              <BarChart labels={srs.data.forecast.map((f) => shortDate(f.date))} values={srs.data.forecast.map((f) => f.count)} label={t('progress.srsForecast')} />
            </figure>
            <div className="stack">
              <p>{srs.data.retention30d === null ? t('progress.srsRetentionNone') : t('progress.srsRetention', { n: pct(srs.data.retention30d)! })}</p>
              <p className="caption">{t('progress.srsRetentionCaption')}</p>
              <ul className="chip-list">
                {(Object.entries(srs.data.states) as Array<[keyof typeof srs.data.states, number]>).map(([state, n]) => (
                  <li key={state} className="tag">
                    {t(`srsStates.${state}`)}: {n}
                  </li>
                ))}
              </ul>
              {srs.data.leeches.length ? (
                <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
                  <h3 className="small">{t('progress.leeches')}</h3>
                  <p className="caption">{t('progress.leechesLead')}</p>
                  <ul className="plain-list small">
                    {srs.data.leeches.map((l) => (
                      <li key={l.wordId}>
                        <span className="target">{l.term}</span> — {l.translation}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}

      <History language={code} />
    </>
  );
}
