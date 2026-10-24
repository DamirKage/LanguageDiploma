import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, X } from 'lucide-react';
import type { ReviewAnswer, ReviewAnswerResultDTO, ReviewCardDTO, ReviewGrade } from '@linguapath/shared';
import { reviewApi } from '../../api/endpoints';
import { Alert, Button, buttonClass, EmptyState, ErrorState, errorMessage, Meter, PageLoader, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, qk, useActiveLanguage } from '../../lib/queries';
import { SpeakButton } from '../lesson/SpeakButton';
import { SpecialChars } from '../lesson/exercises/SpecialChars';
import { WordMeta } from '../vocabulary/WordMeta';

const MODE_KEY = 'linguapath.reviewMode';

function readMode(): 'auto' | 'flip' {
  try {
    return localStorage.getItem(MODE_KEY) === 'flip' ? 'flip' : 'auto';
  } catch {
    return 'auto';
  }
}

function useNextDueLabel() {
  const { t, plural } = useI18n();
  return (result: ReviewAnswerResultDTO) =>
    t('review.nextIn', { when: result.intervalDays <= 1 ? t('review.tomorrow') : t('review.inDays', { days: plural('common.days', result.intervalDays) }) });
}

function Card({
  card,
  ttsLocale,
  specialChars,
  onDone,
}: {
  card: ReviewCardDTO;
  ttsLocale: string;
  specialChars: string[];
  onDone: (remembered: boolean) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewAnswerResultDTO | null>(null);
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nextDue = useNextDueLabel();
  const answer = useMutation({ mutationFn: (a: ReviewAnswer) => reviewApi.answer(card.wordId, a), onSuccess: setResult });
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (result) nextRef.current?.focus();
  }, [result]);
  useEffect(() => {
    if (card.mode === 'typed') inputRef.current?.focus();
  }, [card.mode]);

  const elapsed = () => Date.now() - startedAt.current;
  const remembered = result ? result.quality >= 3 : false;

  return (
    <div className="review-card" data-verdict={result?.verdict}>
      <div className="review-card__face">
        {card.isNew ? <span className="tag tag--accent">{t('review.newBadge')}</span> : null}
        {card.mode === 'typed' ? (
          <>
            <p className="review-card__prompt">{card.translation}</p>
            <WordMeta word={card} />
          </>
        ) : (
          <>
            <p className="review-card__term target">
              <SpeakButton text={card.term} locale={ttsLocale} audioUrl={card.audioUrl} />
              {card.term}
            </p>
            <WordMeta word={card} />
          </>
        )}
      </div>

      {card.mode === 'choice' ? (
        <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
          <p className="small muted">{t('review.chooseTranslation')}</p>
          <div className="options">
            {(card.options ?? []).map((option) => (
              <button
                key={option}
                type="button"
                className="options__item"
                disabled={!!result || answer.isPending}
                data-state={result ? (option === result.expected ? 'correct' : option === chosen ? 'wrong' : undefined) : chosen === option ? 'selected' : undefined}
                onClick={() => {
                  setChosen(option);
                  answer.mutate({ mode: 'choice', option, timeMs: elapsed() });
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {card.mode === 'typed' ? (
        <form
          className="stack"
          style={{ '--gap': 'var(--s2)' } as React.CSSProperties}
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim() && !result) answer.mutate({ mode: 'typed', text: typed, timeMs: elapsed() });
          }}
        >
          <label className="small muted" htmlFor="typed-answer">
            {t('review.typeTerm')}
          </label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input
              id="typed-answer"
              ref={inputRef}
              className="input input--target"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!!result}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button type="submit" variant="primary" disabled={!typed.trim() || !!result} loading={answer.isPending}>
              {t('player.check')}
            </Button>
          </div>
          <SpecialChars chars={specialChars} inputRef={inputRef} value={typed} onChange={setTyped} disabled={!!result} />
        </form>
      ) : null}

      {card.mode === 'flip' ? (
        revealed ? (
          <div className="stack">
            <p className="review-card__answer">{card.translation}</p>
            {card.example ? (
              <p className="small">
                <span className="target">{card.example}</span> <span className="muted">— {card.exampleTranslation}</span>
              </p>
            ) : null}
            {!result ? (
              <div className="grades">
                {(['again', 'hard', 'good', 'easy'] as ReviewGrade[]).map((grade) => (
                  <button key={grade} type="button" className="grades__btn" data-grade={grade} disabled={answer.isPending} onClick={() => answer.mutate({ mode: 'flip', grade })}>
                    <span>{t(`review.grade.${grade}`)}</span>
                    <span className="caption">{t(`review.gradeHint.${grade}`)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
            <p className="small muted">{t('review.recall')}</p>
            <Button variant="primary" size="lg" onClick={() => setRevealed(true)}>
              {t('review.showAnswer')}
            </Button>
          </div>
        )
      ) : null}

      {answer.error ? <Alert tone="bad">{errorMessage(answer.error, i18n)}</Alert> : null}

      {result ? (
        <div className="review-card__result" role="status">
          <p className="feedback__verdict">{t(`player.verdict.${result.verdict}`)}</p>
          {card.mode !== 'flip' && result.verdict !== 'correct' ? <p>{t('review.correctAnswer', { answer: result.expected })}</p> : null}
          {card.mode === 'typed' ? (
            <p className="small">
              {card.term} — {card.translation}
            </p>
          ) : null}
          {card.mode === 'choice' && card.example ? (
            <p className="small">
              <span className="target">{card.example}</span> <span className="muted">— {card.exampleTranslation}</span>
            </p>
          ) : null}
          <p className="small muted">{nextDue(result)}</p>
          <Button ref={nextRef} variant="primary" size="lg" onClick={() => onDone(remembered)}>
            {t('common.next')}
            <ArrowRight size={18} aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Session() {
  const i18n = useI18n();
  const { t } = i18n;
  const { code, language } = useActiveLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode] = useState(readMode);
  const queue = useQuery({ queryKey: ['review-session', code, mode], queryFn: () => reviewApi.queue(code!, mode), enabled: !!code, gcTime: 0, staleTime: Infinity });
  const [index, setIndex] = useState(0);
  const [remembered, setRemembered] = useState(0);
  useTitle('review.title');

  useEffect(
    () => () => {
      for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
    },
    [queryClient],
  );

  if (queue.isLoading || !code) return <PageLoader />;
  const cards = queue.data?.cards ?? [];
  const done = index >= cards.length;

  return (
    <div className="focus">
      <header className="focus__head">
        <Button variant="ghost" icon onClick={() => navigate('/review')} aria-label={t('player.close')}>
          <X size={20} />
        </Button>
        <Meter value={Math.min(index, cards.length)} max={Math.max(cards.length, 1)} tone="accent" label={t('review.title')} />
        <span className="small muted">
          {Math.min(index + 1, cards.length)}/{cards.length}
        </span>
      </header>
      <div className="focus__body">
        {queue.error ? (
          <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
        ) : cards.length === 0 ? (
          <EmptyState title={t('review.empty')} lead={t('review.emptyLead')} action={<Link to="/today" className={buttonClass({ variant: 'primary' })}>{t('summary.toToday')}</Link>} />
        ) : done ? (
          <div className="stack">
            <h1>{t('review.finishedTitle')}</h1>
            <p className="summary__big">{t('review.finishedStats', { remembered, total: cards.length })}</p>
            <div className="row">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setIndex(0);
                  setRemembered(0);
                  void queue.refetch();
                }}
              >
                {t('review.start')}
              </Button>
              <Link to="/today" className={buttonClass({ size: 'lg' })}>
                {t('summary.toToday')}
              </Link>
            </div>
          </div>
        ) : (
          <Card
            key={cards[index]!.wordId}
            card={cards[index]!}
            ttsLocale={language?.ttsLocale ?? code}
            specialChars={language?.specialChars ?? []}
            onDone={(ok) => {
              if (ok) setRemembered((n) => n + 1);
              setIndex((i) => i + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Overview() {
  const { t } = useI18n();
  const { code, name } = useActiveLanguage();
  const [mode, setMode] = useState(readMode);
  const queue = useQuery({ queryKey: qk.reviewQueue(code ?? '', 'auto'), queryFn: () => reviewApi.queue(code!, 'auto'), enabled: !!code });
  useTitle('review.title');
  const choose = (m: 'auto' | 'flip') => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage may be unavailable in private mode */
    }
  };

  if (queue.isLoading) return <PageLoader />;
  if (queue.error) return <ErrorState error={queue.error} onRetry={() => queue.refetch()} />;
  const data = queue.data!;

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{name}</p>
        <h1>{t('review.title')}</h1>
        <p className="page-head__lead">{t('review.lead')}</p>
      </header>
      {data.cards.length === 0 ? (
        <EmptyState title={t('review.empty')} lead={t('review.emptyLead')} action={<Link to="/vocabulary">{t('nav.vocabulary')}</Link>} />
      ) : (
        <section className="review-start">
          <p className="review-start__count target">{data.cards.length}</p>
          <div className="stack">
            <p>{t('review.queueMeta', { due: data.dueCount, fresh: data.newCount })}</p>
            <div className="seg" role="group" aria-label={t('review.modeHint')}>
              <button aria-pressed={mode === 'auto'} onClick={() => choose('auto')}>
                {t('review.modeAuto')}
              </button>
              <button aria-pressed={mode === 'flip'} onClick={() => choose('flip')}>
                {t('review.modeFlip')}
              </button>
            </div>
            <p className="caption">{t('review.modeHint')}</p>
            <div>
              <Link to="/review/session" className={buttonClass({ variant: 'primary', size: 'lg' })}>
                {t('review.start')}
                <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      )}
      <p className="small">
        <Link to="/vocabulary">{t('nav.vocabulary')} →</Link>
      </p>
    </>
  );
}

export default function ReviewPage({ session }: { session?: boolean }) {
  return session ? <Session /> : <Overview />;
}
