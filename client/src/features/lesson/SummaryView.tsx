import { Link } from 'react-router-dom';
import { ArrowRight, Check, X as XIcon } from 'lucide-react';
import type { AttemptSummaryDTO } from '@slog/shared';
import { Button, buttonClass, Meter } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useTopics } from '../../lib/queries';
import { reasonText, recommendationTitle } from '../today/recommendationText';
import { useStartActivity } from '../today/useStartActivity';

function formatDuration(sec: number, locale: string) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${new Intl.NumberFormat(locale).format(m)}:${String(s).padStart(2, '0')}`;
}

export function SummaryView({ summary }: { summary: AttemptSummaryDTO }) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const { topicTitle } = useTopics();
  const start = useStartActivity(summary.language);
  const titleKey =
    summary.kind === 'lesson' ? 'summary.titleLesson' : summary.kind === 'test' ? 'summary.titleTest' : summary.kind === 'practice' ? 'summary.titlePractice' : 'summary.titlePlacement';
  const tone = summary.percent >= 85 ? 'ok' : summary.percent >= 70 ? 'accent' : 'warn';

  return (
    <div className="focus__body summary">
      <header className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
        <p className="eyebrow">{summary.title}</p>
        <h1>{t(titleKey)}</h1>
      </header>

      {summary.placement ? (
        <section className="summary__score">
          <p className="summary__big target">{summary.placement.estimatedLevel}</p>
          <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
            <p>{t('summary.placementLevel', { level: t(`levels.${summary.placement.estimatedLevel}`) })}</p>
            <p className="small muted">{t('summary.placementLead')}</p>
            <ul className="summary__levels">
              {summary.placement.perLevel.map((l) => (
                <li key={l.level}>{t('summary.placementRow', l)}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="summary__score" aria-label={t('summary.score')}>
          <p className="summary__big">{summary.percent}%</p>
          <div className="stack" style={{ '--gap': 'var(--s2)', flex: 1 } as React.CSSProperties}>
            <Meter value={summary.percent} tone={tone} label={t('summary.score')} />
            <p>{t('summary.points', { points: summary.points, max: summary.maxPoints })}</p>
            <p className="small muted">{t('summary.breakdown', { correct: summary.correct, almost: summary.almost, incorrect: summary.incorrect })}</p>
            {summary.skipped ? <p className="small muted">{t('summary.skipped', { n: summary.skipped })}</p> : null}
            <p className="small muted">{t('summary.time', { time: formatDuration(summary.durationSec, i18n.locale) })}</p>
            {summary.kind !== 'practice' ? (
              <span className={`tag ${summary.passed ? 'tag--ok' : 'tag--warn'}`} style={{ alignSelf: 'flex-start' }}>
                {summary.passed ? t('summary.passed') : t('summary.notPassed')}
              </span>
            ) : null}
          </div>
        </section>
      )}

      {!summary.placement ? (
        <div className="summary__grid">
          <section className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
            <h2 className="summary__h">{t('summary.strengths')}</h2>
            {summary.strengths.length ? (
              <ul className="chip-list">
                {summary.strengths.map((topic) => (
                  <li key={topic} className="tag tag--ok">
                    {topicTitle(topic)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">—</p>
            )}
          </section>
          <section className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
            <h2 className="summary__h">{t('summary.weaknesses')}</h2>
            {summary.weaknesses.length ? (
              <ul className="chip-list">
                {summary.weaknesses.map((topic) => (
                  <li key={topic} className="tag tag--warn">
                    {topicTitle(topic)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">{t('summary.noWeaknesses')}</p>
            )}
          </section>
          {summary.byCategory.length ? (
            <section className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
              <h2 className="summary__h">{t('summary.errorsByCategory')}</h2>
              <ul className="plain-list small">
                {summary.byCategory.map((c) => (
                  <li key={c.category}>
                    {t(`errorCategories.${c.category}`)} — {c.count}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {summary.wordsAdded > 0 ? <p className="summary__note">{t('summary.wordsAdded', { words: plural('common.words', summary.wordsAdded) })}</p> : null}

      {summary.next ? (
        <section className="summary__next">
          <p className="eyebrow">{t('summary.nextTitle')}</p>
          <p className="summary__next-title">{recommendationTitle(summary.next, i18n, { topicTitle })}</p>
          <ul className="reason-list">
            {summary.next.reasons.slice(0, 2).map((r, i) => (
              <li key={i}>{reasonText(r, i18n, { topicTitle })}</li>
            ))}
          </ul>
          <div className="row">
            <Button variant="primary" size="lg" onClick={() => start.mutate(summary.next!)} loading={start.isPending}>
              {t(`recommendation.action.${summary.next.type}`)}
              <ArrowRight size={18} aria-hidden />
            </Button>
            <Link to="/today" className={buttonClass({ size: 'lg' })}>
              {t('summary.toToday')}
            </Link>
          </div>
        </section>
      ) : (
        <div className="row">
          <Link to="/today" className={buttonClass({ variant: 'primary', size: 'lg' })}>
            {t('summary.toToday')}
          </Link>
          <Link to="/path" className={buttonClass({ size: 'lg' })}>
            {t('summary.toPath')}
          </Link>
        </div>
      )}

      {summary.review.length > 0 ? (
        <details className="summary__review">
          <summary>{t('summary.review')}</summary>
          <ol className="review-list">
            {summary.review.map((item) => (
              <li key={item.itemIndex} data-verdict={item.verdict}>
                <span className="review-list__icon" aria-label={t(`player.verdict.${item.verdict}`)}>
                  {item.verdict === 'correct' ? <Check size={16} /> : <XIcon size={16} />}
                </span>
                <div className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                  <span className="small">{item.prompt}</span>
                  {item.verdict !== 'correct' ? (
                    <span className="small">
                      <span className="muted">{t('summary.yourAnswer')}:</span> <span className="target">{item.given || t('summary.noAnswer')}</span>
                    </span>
                  ) : null}
                  <span className="small">
                    <span className="muted">{t('player.expected')}:</span> <span className="target">{item.expected}</span>
                  </span>
                  {item.verdict !== 'correct' ? <span className="caption">{item.explanation}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
