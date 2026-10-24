import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, CircleX, X } from 'lucide-react';
import type { AnswerFeedback, AttemptStateDTO, AttemptSummaryDTO, ExerciseAnswer } from '@linguapath/shared';
import { learningApi } from '../../api/endpoints';
import { Alert, Button, ErrorState, errorMessage, Meter, PageLoader, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, useLanguageName, useLanguages } from '../../lib/queries';
import { ExerciseView, useInstruction, type LanguageInfo } from './exercises/Exercise';
import { SummaryView } from './SummaryView';

function FeedbackPanel({ feedback, onNext, last }: { feedback: AnswerFeedback; onNext: () => void; last: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const Icon = feedback.verdict === 'correct' ? CheckCircle2 : feedback.verdict === 'almost' ? CircleAlert : CircleX;
  return (
    <div className="feedback" data-verdict={feedback.verdict} role="status" aria-live="assertive">
      <div className="feedback__inner">
        <div className="feedback__text">
          <p className="feedback__verdict">
            <Icon size={22} aria-hidden />
            {t(`player.verdict.${feedback.verdict}`)}
          </p>
          {feedback.verdict !== 'correct' && feedback.verdict !== 'skipped' ? (
            <p>
              <span className="feedback__label">{t('player.expected')}:</span> <span className="target">{feedback.expected}</span>
            </p>
          ) : null}
          {feedback.note ? <p>{t(`player.note.${feedback.note.code}`, { detail: feedback.note.detail ?? '' })}</p> : null}
          {feedback.explanation ? <p className="feedback__explanation">{feedback.explanation}</p> : null}
        </div>
        <Button ref={ref} variant="primary" size="lg" onClick={onNext}>
          {last ? t('player.finish') : t('player.next')}
        </Button>
      </div>
    </div>
  );
}

function ExerciseStage({
  state,
  language,
  onAnswered,
}: {
  state: AttemptStateDTO;
  language: LanguageInfo;
  onAnswered: (next: AttemptStateDTO) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const current = state.current!;
  const [answer, setAnswer] = useState<ExerciseAnswer | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [nextState, setNextState] = useState<AttemptStateDTO | null>(null);
  const startedAt = useRef(Date.now());
  const instruction = useInstruction(current, language);

  const submit = useMutation({
    mutationFn: (a: ExerciseAnswer) => learningApi.answer(state.id, current.itemIndex, a, Date.now() - startedAt.current),
    onSuccess: (res) => {
      if (res.feedback) {
        setFeedback(res.feedback);
        setNextState(res.state);
      } else onAnswered(res.state);
    },
  });

  const check = useCallback(() => {
    if (answer && !submit.isPending && !feedback) submit.mutate(answer);
  }, [answer, submit, feedback]);
  const proceed = useCallback(() => nextState && onAnswered(nextState), [nextState, onAnswered]);
  const onAnswer = useCallback((a: ExerciseAnswer | null) => setAnswer(a), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (feedback) proceed();
      else check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feedback, proceed, check]);

  const isSkip = (answer?.type === 'speak' || answer?.type === 'listen') && answer.skipped;
  return (
    <>
      <div className="focus__body" key={`${state.id}-${current.itemIndex}`}>
        <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
          {current.isRetry ? <span className="tag tag--warn" style={{ alignSelf: 'flex-start' }}>{t('player.retryBadge')}</span> : null}
          <h1 className="exercise__instruction">{instruction}</h1>
        </div>
        <ExerciseView exercise={current} language={language} answer={answer} onAnswer={onAnswer} onSubmit={check} locked={!!feedback || submit.isPending} feedback={feedback} />
        {submit.error ? <Alert tone="bad">{errorMessage(submit.error, i18n)}</Alert> : null}
        {state.feedbackMode === 'deferred' ? <p className="caption">{t('player.deferredHint')}</p> : null}
      </div>
      {feedback ? (
        <FeedbackPanel feedback={feedback} onNext={proceed} last={!nextState?.current} />
      ) : (
        <div className="action-bar">
          <div className="action-bar__inner">
            <span className="caption action-bar__hint">{t('player.keyboardHint')}</span>
            <Button variant="primary" size="lg" disabled={!answer} loading={submit.isPending} onClick={check}>
              {isSkip ? t('player.skip') : t('player.check')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Remounts the player for each attempt so moving to the next activity starts clean. */
export default function PlayerPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  return <Player key={attemptId} attemptId={attemptId!} />;
}

function Player({ attemptId }: { attemptId: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const languageName = useLanguageName();
  const { data: languages } = useLanguages();
  const [state, setState] = useState<AttemptStateDTO | null>(null);
  const [summary, setSummary] = useState<AttemptSummaryDTO | null>(null);

  const initial = useQuery({ queryKey: ['attempt', attemptId], queryFn: () => learningApi.attempt(attemptId), gcTime: 0, staleTime: Infinity });
  useEffect(() => {
    if (initial.data) setState(initial.data);
  }, [initial.data]);
  useTitle(null, state?.title);

  const complete = useMutation({
    mutationFn: () => (state!.status === 'completed' ? learningApi.summary(state!.id) : learningApi.complete(state!.id)),
    onSuccess: (data) => {
      setSummary(data);
      for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const finished = !!state && (!state.current || state.status === 'completed');
  useEffect(() => {
    if (finished && !summary && !complete.isPending && !complete.error) complete.mutate();
  }, [finished, summary, complete]);

  if (initial.isLoading || !state) {
    return initial.error ? (
      <div className="focus">
        <div className="focus__body">
          <ErrorState error={initial.error} onRetry={() => initial.refetch()} />
        </div>
      </div>
    ) : (
      <PageLoader />
    );
  }

  const meta = languages?.find((l) => l.code === state.language);
  const language: LanguageInfo = {
    code: state.language,
    name: languageName(state.language),
    ttsLocale: meta?.ttsLocale ?? state.language,
    specialChars: meta?.specialChars ?? [],
  };
  const answered = state.current ? state.current.itemIndex : state.total;

  return (
    <div className="focus">
      <header className="focus__head">
        <Button variant="ghost" icon onClick={() => navigate(-1)} aria-label={t('player.close')} title={t('player.closeConfirm')}>
          <X size={20} />
        </Button>
        <Meter value={summary ? state.total : answered} max={state.total} tone="accent" label={t('player.progress', { current: Math.min(answered + 1, state.total), total: state.total })} />
        <span className="small muted" aria-hidden>
          {Math.min(answered + (summary ? 0 : 1), state.total)}/{state.total}
        </span>
      </header>
      {summary ? (
        <SummaryView summary={summary} />
      ) : finished ? (
        <div className="focus__body">{complete.error ? <ErrorState error={complete.error} onRetry={() => complete.mutate()} /> : <PageLoader />}</div>
      ) : (
        <ExerciseStage key={state.current!.itemIndex} state={state} language={language} onAnswered={setState} />
      )}
    </div>
  );
}
