import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CircleAlert, CircleX } from 'lucide-react';
import type { AnswerFeedback, AttemptStateDTO, AttemptSummaryDTO, ExerciseAnswer, ExerciseType } from '@linguapath/shared';
import { learningApi } from '../../api/endpoints';
import { Alert, Button, ErrorState, errorMessage, PageLoader, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, useLanguageName, useLanguages, useTopics } from '../../lib/queries';
import { ExerciseView, useInstruction, type LanguageInfo } from './exercises/Exercise';
import { SpeakButton } from './SpeakButton';
import { SummaryView } from './SummaryView';

function FeedbackPanel({ feedback, onNext, last, locale }: { feedback: AnswerFeedback; onNext: () => void; last: boolean; locale: string }) {
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
            {feedback.verdict === 'correct' ? <SpeakButton text={feedback.expected} locale={locale} size="sm" recordingOnly /> : null}
          </p>
          {feedback.verdict !== 'correct' && feedback.verdict !== 'skipped' ? (
            <p>
              <span className="feedback__label">{t('player.expected')}:</span> <span className="target">{feedback.expected}</span>{' '}
              <SpeakButton text={feedback.expected} locale={locale} size="sm" recordingOnly />
            </p>
          ) : null}
          {feedback.note ? <p>{t(`player.note.${feedback.note.code}`, { detail: feedback.note.detail ?? '' })}</p> : null}
          {feedback.explanation ? <p className="feedback__explanation">{feedback.explanation}</p> : null}
        </div>
        <Button ref={ref} variant="primary" onClick={onNext}>
          {last ? t('player.finish') : t('player.next')}
        </Button>
      </div>
    </div>
  );
}

/** What the current task trains and how the answer is used: the attempt is part of the learner's analytics. */
function TaskContext({ state }: { state: AttemptStateDTO }) {
  const { t } = useI18n();
  const { topicTitle } = useTopics();
  const current = state.current!;
  return (
    <aside className="workspace__context" aria-label={t('player.contextTitle')}>
      <dl className="facts">
        <div>
          <dt>{t('player.topic')}</dt>
          <dd>{topicTitle(current.topic)}</dd>
        </div>
        <div>
          <dt>{t('player.skill')}</dt>
          <dd>{t(`skills.${current.skill}`)}</dd>
        </div>
      </dl>
      <p className="caption">{state.kind === 'placement' ? t('player.placementNote') : state.feedbackMode === 'deferred' ? t('player.deferredHint') : t('player.analyticsNote')}</p>
    </aside>
  );
}

/** Placeholder sent with "don't know": the server scores it as a wrong answer without checking it. */
function emptyAnswer(type: ExerciseType): ExerciseAnswer {
  switch (type) {
    case 'choice':
    case 'dialogue':
      return { type, option: '' };
    case 'order':
      return { type, tokens: [] };
    case 'speak':
      return { type, transcript: '' };
    case 'error_spot':
      return { type, index: 0 };
    case 'cloze_text':
      return { type, choices: [] };
    case 'chat':
      return { type, replies: [] };
    case 'categorize':
      return { type, placement: [] };
    default:
      return { type, text: '' };
  }
}

function Steps({ done, total }: { done: number; total: number }) {
  return (
    <span className="steps" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="steps__item" data-done={i < done || undefined} data-current={i === done || undefined} />
      ))}
    </span>
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
    mutationFn: ({ answer: a, dontKnow }: { answer: ExerciseAnswer; dontKnow?: boolean }) =>
      learningApi.answer(state.id, current.itemIndex, a, Date.now() - startedAt.current, dontKnow),
    onSuccess: (res) => {
      if (res.feedback) {
        setFeedback(res.feedback);
        setNextState(res.state);
      } else onAnswered(res.state);
    },
  });

  const check = useCallback(() => {
    if (answer && !submit.isPending && !feedback) submit.mutate({ answer });
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
    <div className="focus__body">
      <div className="workspace" key={`${state.id}-${current.itemIndex}`}>
        <section className="workspace__task" aria-labelledby="task-instruction">
          <h1 className="exercise__instruction" id="task-instruction">
            {instruction}
          </h1>
          <ExerciseView exercise={current} language={language} answer={answer} onAnswer={onAnswer} onSubmit={check} locked={!!feedback || submit.isPending} feedback={feedback} />
          {submit.error ? <Alert tone="bad">{errorMessage(submit.error, i18n)}</Alert> : null}
          {feedback ? (
            <FeedbackPanel feedback={feedback} onNext={proceed} last={!nextState?.current} locale={language.ttsLocale} />
          ) : (
            <div className="task-actions">
              <span className="caption task-actions__hint">{t('player.keyboardHint')}</span>
              {state.kind === 'placement' ? (
                <Button variant="ghost" disabled={submit.isPending} onClick={() => submit.mutate({ answer: emptyAnswer(current.type), dontKnow: true })} title={t('player.dontKnowHint')}>
                  {t('player.dontKnow')}
                </Button>
              ) : null}
              <Button variant="primary" disabled={!answer} loading={submit.isPending} onClick={check}>
                {isSkip ? t('player.skip') : t('player.check')}
              </Button>
            </div>
          )}
        </section>
        <TaskContext state={state} />
      </div>
    </div>
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
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} title={t('player.closeConfirm')}>
          <ArrowLeft size={16} aria-hidden />
          {t('player.close')}
        </Button>
        <div className="focus__title">
          {t(`player.kind.${state.kind}`) !== state.title ? <span className="eyebrow">{t(`player.kind.${state.kind}`)}</span> : null}
          <span className="focus__name">{state.title}</span>
        </div>
        {summary ? null : state.maxItems ? (
          <div className="focus__progress">
            <span className="small muted">{t('player.progressAdaptive', { current: answered + 1, max: state.maxItems })}</span>
          </div>
        ) : (
          <div className="focus__progress">
            <span className="small muted">{t('player.progress', { current: Math.min(answered + 1, state.total), total: state.total })}</span>
            <Steps done={answered} total={state.total} />
          </div>
        )}
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
