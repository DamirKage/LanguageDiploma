import { Link } from 'react-router-dom';
import { ArrowRight, Check, X as XIcon } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CEFR_LEVELS, type AttemptSummaryDTO, type CefrLevel } from '@linguapath/shared';
import { meApi } from '../../api/endpoints';
import { Button, buttonClass, Meter, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useCountUp } from '../../lib/motion';
import { LEARNING_KEYS, useTopics } from '../../lib/queries';
import { reasonText, recommendationTitle } from '../today/recommendationText';
import { useStartActivity } from '../today/useStartActivity';

function formatDuration(sec: number, locale: string) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${new Intl.NumberFormat(locale).format(m)}:${String(s).padStart(2, '0')}`;
}

const BAND_POSITION = { low: 0.2, mid: 0.5, high: 0.8 } as const;

/** The four levels as one scale; the marker travels to the estimate, inside the level by sub-level. */
function LevelScale({ level, band }: { level: CefrLevel; band: keyof typeof BAND_POSITION }) {
  const index = CEFR_LEVELS.indexOf(level);
  const position = ((index + BAND_POSITION[band]) / CEFR_LEVELS.length) * 100;
  return (
    <div className="level-scale" aria-hidden style={{ '--levels': CEFR_LEVELS.length } as React.CSSProperties}>
      <div className="level-scale__track">
        {CEFR_LEVELS.map((l, i) => (
          <span key={l} data-reached={i <= index || undefined} />
        ))}
      </div>
      <span className="level-scale__marker" style={{ left: `${position}%` }} />
      <div className="level-scale__labels">
        {CEFR_LEVELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function Percent({ value }: { value: number }) {
  return <>{useCountUp(value)}%</>;
}

function PlacementResult({ summary, placement }: { summary: AttemptSummaryDTO; placement: NonNullable<AttemptSummaryDTO['placement']> }) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [chosen, setChosen] = useState<CefrLevel>(placement.estimatedLevel);
  const index = CEFR_LEVELS.indexOf(placement.estimatedLevel);
  const next = CEFR_LEVELS[index + 1];
  const options = CEFR_LEVELS.filter((_, i) => Math.abs(i - index) <= 1);
  const setLevel = useMutation({
    mutationFn: (level: CefrLevel) => meApi.setLevel(summary.language, level),
    onSuccess: (_, level) => {
      setChosen(level);
      toast(t('summary.placement.levelSet', { level }));
      for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const pct = (row: { correct: number; total: number }) => Math.round((row.correct / Math.max(1, row.total)) * 100);
  return (
    <>
      <section className="summary__score" aria-label={t('summary.score')}>
        <p className="summary__big">{placement.estimatedLevel}</p>
        <div className="stack" style={{ '--gap': 'var(--s2)', flex: 1 } as React.CSSProperties}>
          <p className="summary__lead">
            {t(`levels.${placement.estimatedLevel}`)} ·{' '}
            {placement.band === 'high' && next ? t('summary.placement.bandHigh', { next }) : t(`summary.placement.band.${placement.band}`)}
          </p>
          <LevelScale level={placement.estimatedLevel} band={placement.band} />
          <p className="small">{t(`summary.placement.canDo.${placement.estimatedLevel}`)}</p>
          <p className="small muted">
            {t('summary.placement.basis', { answers: plural('common.answers', placement.answered), self: t(`onboarding.self.${placement.selfAssessment}`) })}
          </p>
          <p className="small muted">{t(`summary.placement.confidence.${placement.confidence}`)}</p>
        </div>
      </section>

      <div className="summary__tables">
        <section className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
          <h2 className="summary__h">{t('summary.placement.byLevel')}</h2>
          <table className="table">
            <tbody>
              {placement.perLevel.map((row) => (
                <tr key={row.level}>
                  <td>{row.level}</td>
                  <td className="small">{t('summary.correctOf', row)}</td>
                  <td className="small">{pct(row)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
          <h2 className="summary__h">{t('summary.placement.bySkill')}</h2>
          <table className="table">
            <tbody>
              {placement.perSkill.map((row) => (
                <tr key={row.skill}>
                  <td>{t(`skills.${row.skill}`)}</td>
                  <td className="small">{t('summary.correctOf', row)}</td>
                  <td className="small">{pct(row)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <p className="caption">{t('summary.placement.method')}</p>

      <section className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
        <h2 className="summary__h">{t('summary.placement.chooseTitle')}</h2>
        <p className="small muted">{t('summary.placement.chooseLead')}</p>
        <div className="seg" role="radiogroup" aria-label={t('summary.placement.chooseTitle')}>
          {options.map((level) => (
            <button key={level} role="radio" aria-checked={chosen === level} aria-pressed={chosen === level} disabled={setLevel.isPending} onClick={() => level !== chosen && setLevel.mutate(level)}>
              {level}
              {level === placement.estimatedLevel ? ` · ${t('summary.placement.recommended')}` : ''}
            </button>
          ))}
        </div>
      </section>
    </>
  );
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
        <PlacementResult summary={summary} placement={summary.placement} />
      ) : (
        <section className="summary__score" aria-label={t('summary.score')}>
          <p className="summary__big">
            <Percent value={summary.percent} />
          </p>
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

      {!summary.placement && summary.byTopic.length ? (
        <section className="stack" style={{ '--gap': 'var(--s3)' } as React.CSSProperties}>
          <h2 className="summary__h">{t('summary.byTopic')}</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('path.col.topic')}</th>
                  <th>{t('summary.colAnswers')}</th>
                  <th>{t('summary.colResult')}</th>
                  <th>{t('summary.colConclusion')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.byTopic.map((row) => (
                  <tr key={row.topic}>
                    <td>{topicTitle(row.topic)}</td>
                    <td className="small">{t('summary.correctOf', { correct: row.correct, total: row.total })}</td>
                    <td className="small">{row.percent}%</td>
                    <td className="small">
                      {summary.weaknesses.includes(row.topic) ? (
                        <span className="text-warn">{t('summary.weaknesses')}</span>
                      ) : summary.strengths.includes(row.topic) ? (
                        <span className="text-ok">{t('summary.strengths')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.byCategory.length ? (
            <p className="small">
              <span className="muted">{t('summary.errorsByCategory')}:</span>{' '}
              {summary.byCategory.map((c) => `${t(`errorCategories.${c.category}`)} — ${c.count}`).join(', ')}
            </p>
          ) : null}
          <p className="caption">{t('summary.analyticsNote')}</p>
        </section>
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
