import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints';
import { ErrorState, Meter, PageLoader, Section, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useLanguageName, useTopics } from '../../lib/queries';
import { BarChart } from '../progress/charts';

export function AdminDashboard() {
  const i18n = useI18n();
  const { t } = i18n;
  const languageName = useLanguageName();
  const { topicTitle } = useTopics();
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  useTitle('admin.nav.dashboard');
  if (stats.isLoading) return <PageLoader />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;
  const s = stats.data!;
  const day = (d: string) => i18n.date(d, { day: 'numeric', month: 'short' });
  const maxEnroll = Math.max(1, ...s.enrollmentsByLanguage.map((e) => e.count));

  return (
    <>
      <header className="page-head">
        <h1>{t('admin.title')}</h1>
        <p className="page-head__lead">{t('admin.dashboard.contentValue', s.content)}</p>
      </header>
      <dl className="stats">
        {(
          [
            ['admin.dashboard.users', s.users.total],
            ['admin.dashboard.active7', s.users.active7d],
            ['admin.dashboard.active30', s.users.active30d],
            ['admin.dashboard.new30', s.users.newLast30d],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="stat">
            <dt className="eyebrow">{t(key)}</dt>
            <dd className="stat__value">{value}</dd>
          </div>
        ))}
      </dl>

      <Section title={t('admin.dashboard.activity')}>
        <div className="chart-pair chart-pair--3">
          {(['lessons', 'tests', 'reviews'] as const).map((k) => (
            <figure key={k} className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
              <figcaption className="small">{t(`admin.dashboard.${k}`)}</figcaption>
              <BarChart labels={s.completionsByDay.map((d) => day(d.date))} values={s.completionsByDay.map((d) => d[k])} label={t(`admin.dashboard.${k}`)} />
            </figure>
          ))}
        </div>
      </Section>

      <div className="two-col">
        <Section title={t('admin.dashboard.enrollments')}>
          <ul className="bars">
            {s.enrollmentsByLanguage.map((e) => (
              <li key={e.language} className="bars__row">
                <div className="spread small">
                  <span>{languageName(e.language)}</span>
                  <span>{e.count}</span>
                </div>
                <Meter value={e.count} max={maxEnroll} label={languageName(e.language)} />
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t('admin.dashboard.scores')}>
          {s.averageScoreByLanguageLevel.length === 0 ? (
            <p className="muted">{t('admin.dashboard.empty')}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {s.averageScoreByLanguageLevel.map((r) => (
                    <tr key={`${r.language}-${r.level}`}>
                      <td>{languageName(r.language)}</td>
                      <td>{r.level}</td>
                      <td style={{ textAlign: 'right' }}>{r.averagePercent}%</td>
                      <td className="muted small" style={{ textAlign: 'right' }}>
                        n = {r.attempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <div className="two-col">
        <Section title={t('admin.dashboard.hardestTopics')}>
          {s.hardestTopics.length === 0 ? (
            <p className="muted">{t('admin.dashboard.empty')}</p>
          ) : (
            <ul className="plain-list small">
              {s.hardestTopics.map((h) => (
                <li key={`${h.language}-${h.topic}`} className="spread">
                  <span>
                    {languageName(h.language)} · {topicTitle(h.topic)}
                  </span>
                  <span className="muted">
                    {t('admin.dashboard.accuracy', { n: Math.round(h.accuracy * 100) })} · {t('admin.dashboard.learners', { n: h.learners })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={t('admin.dashboard.hardestExercises')}>
          {s.hardestExercises.length === 0 ? (
            <p className="muted">{t('admin.dashboard.empty')}</p>
          ) : (
            <ul className="plain-list small">
              {s.hardestExercises.map((h) => (
                <li key={h.key} className="spread">
                  <span>
                    <code>{h.key}</code> {h.lessonTitle}
                  </span>
                  <span className="muted">{t('admin.dashboard.accuracy', { n: Math.round(h.accuracy * 100) })}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      <p className="caption">{t('admin.dashboard.privacy')}</p>
    </>
  );
}
