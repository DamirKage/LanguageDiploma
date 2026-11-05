import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { ExerciseAnswer } from '@linguapath/shared';
import { Button } from '../../../components/ui';
import { SpokenText } from '../../../components/motion/SpokenText';
import { useI18n } from '../../../i18n';
import { prefersReducedMotion } from '../../../lib/motion';
import { useSpeaker } from '../../../lib/speech';
import { SpeakButton } from '../SpeakButton';
import type { ExerciseProps } from './Exercise';

/* ---------- Find the mistake ---------- */

export function ErrorSpotExercise({ exercise, language, answer, onAnswer, locked, feedback }: ExerciseProps<'error_spot'>) {
  const { t } = useI18n();
  const chosen = answer?.type === 'error_spot' ? answer.index : null;
  const errorAt = feedback?.parts ? feedback.parts.findIndex((ok) => !ok) : -1;
  const fixed = errorAt >= 0 ? feedback!.expected.split(/\s+/)[errorAt] : null;
  return (
    <div className="exercise">
      {exercise.translationText ? <p className="exercise__translation">{exercise.translationText}</p> : null}
      <p className="spot target" role="radiogroup" aria-label={t('player.errorSpotHint')}>
        {exercise.tokens.map((token, i) => {
          const state = feedback ? (i === errorAt ? 'error' : i === chosen ? 'wrong' : undefined) : i === chosen ? 'selected' : undefined;
          return (
            <button key={i} type="button" role="radio" aria-checked={chosen === i} className="spot__word" data-state={state} disabled={locked} onClick={() => onAnswer({ type: 'error_spot', index: i })}>
              {token}
              {state === 'error' && fixed ? <span className="spot__fix">{fixed}</span> : null}
            </button>
          );
        })}
      </p>
      <p className="caption">{feedback && fixed ? t('player.errorSpotFixed', { word: fixed }) : t('player.errorSpotHint')}</p>
      {feedback ? <SpeakButton text={feedback.expected} locale={language.ttsLocale} size="sm" recordingOnly /> : null}
    </div>
  );
}

/* ---------- Text with gaps ---------- */

export function ClozeTextExercise({ exercise, answer, onAnswer, locked, feedback }: ExerciseProps<'cloze_text'>) {
  const { t } = useI18n();
  const [choices, setChoices] = useState<string[]>(() => (answer?.type === 'cloze_text' ? answer.choices : exercise.gaps.map(() => '')));
  useEffect(() => setChoices(exercise.gaps.map(() => '')), [exercise.key]);
  const pick = (i: number, value: string) => {
    const next = choices.map((c, k) => (k === i ? value : c));
    setChoices(next);
    onAnswer(next.every(Boolean) ? { type: 'cloze_text', choices: next } : null);
  };
  const pieces = exercise.text.split(/\{(\d+)\}/);
  return (
    <div className="exercise">
      <p className="cloze target">
        {pieces.map((piece, i) => {
          if (i % 2 === 0) return <span key={i}>{piece}</span>;
          const gap = Number(piece);
          const state = feedback?.parts ? (feedback.parts[gap] ? 'correct' : 'wrong') : choices[gap] ? 'filled' : undefined;
          return (
            <select
              key={i}
              className="cloze__gap"
              data-state={state}
              value={choices[gap] ?? ''}
              disabled={locked}
              aria-label={t('player.clozeGap', { n: gap + 1 })}
              onChange={(e) => pick(gap, e.target.value)}
            >
              <option value="" disabled>
                …
              </option>
              {exercise.gaps[gap]!.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          );
        })}
      </p>
      {exercise.translationText ? <p className="exercise__translation">{exercise.translationText}</p> : null}
    </div>
  );
}

/* ---------- Messenger role-play ---------- */

export function ChatExercise({ exercise, language, answer, onAnswer, locked, feedback }: ExerciseProps<'chat'>) {
  const { t } = useI18n();
  const { speak, hasRecording } = useSpeaker(language.ttsLocale);
  const [replies, setReplies] = useState<string[]>(() => (answer?.type === 'chat' ? answer.replies : []));
  const [typing, setTyping] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  const step = replies.length;
  const turn = exercise.turns[step];
  const better = feedback ? feedback.expected.split(' / ') : [];

  useEffect(() => setReplies([]), [exercise.key]);
  useEffect(() => {
    if (!turn || feedback) return;
    setTyping(true);
    const timer = setTimeout(
      () => {
        setTyping(false);
        if (hasRecording(turn.message, 'B')) speak(turn.message, { speaker: 'B' });
      },
      prefersReducedMotion() ? 0 : 750,
    );
    return () => clearTimeout(timer);
    // Each new message "types" once, so the effect runs per step and not when the speaker changes.
  }, [step, exercise.key, feedback]);
  useEffect(() => {
    const el = end.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [step, typing]);

  const reply = (option: string) => {
    const next = [...replies, option];
    setReplies(next);
    onAnswer(next.length === exercise.turns.length ? { type: 'chat', replies: next } : null);
  };

  return (
    <div className="exercise">
      {exercise.translationText ? (
        <p className="exercise__context">
          <span className="eyebrow">{t('player.contextLabel')}</span> {exercise.translationText}
        </p>
      ) : null}
      <div className="chat" aria-live="polite">
        {exercise.turns.slice(0, step + 1).map((tn, i) => {
          const shown = i < step || !typing || !!feedback;
          return (
            <div key={i} className="chat__pair">
              <div className="chat__msg chat__msg--them">
                {shown ? (
                  <>
                    <SpokenText text={tn.message} className="target" />
                    <SpeakButton text={tn.message} locale={language.ttsLocale} size="sm" speaker="B" recordingOnly />
                    {tn.messageTranslation ? <span className="chat__translation">{tn.messageTranslation}</span> : null}
                  </>
                ) : (
                  <span className="chat__typing" aria-label={t('player.chatTyping')}>
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              {replies[i] !== undefined ? (
                <div className="chat__msg chat__msg--me" data-state={feedback?.parts ? (feedback.parts[i] ? 'correct' : 'wrong') : undefined}>
                  <span className="target">{replies[i]}</span>
                  {feedback?.parts && !feedback.parts[i] && better[i] ? <span className="chat__better">{better[i]}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {turn && !typing && !locked ? (
        <div className="chat__options" role="group" aria-label={t('player.chatPick')}>
          {turn.options.map((o) => (
            <button key={o} type="button" className="chat__option target" onClick={() => reply(o)}>
              {o}
            </button>
          ))}
        </div>
      ) : null}
      {replies.length > 0 && !locked ? (
        <div>
          <Button variant="ghost" size="sm" onClick={() => (setReplies([]), onAnswer(null))}>
            <RotateCcw size={14} aria-hidden />
            {t('player.clearOrder')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Sort into groups ---------- */

export function CategorizeExercise({ exercise, answer, onAnswer, locked, feedback }: ExerciseProps<'categorize'>) {
  const { t } = useI18n();
  const [placement, setPlacement] = useState<Array<{ text: string; category: number }>>(() => (answer?.type === 'categorize' ? answer.placement : []));
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const flight = useRef<{ text: string; from: DOMRect } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setPlacement([]), [exercise.key]);

  useLayoutEffect(() => {
    const f = flight.current;
    flight.current = null;
    if (!f || prefersReducedMotion()) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(f.text)}"]`);
    if (!el || typeof el.animate !== 'function') return;
    const r = el.getBoundingClientRect();
    el.animate([{ transform: `translate(${f.from.left - r.left}px, ${f.from.top - r.top}px)` }, { transform: 'none' }], {
      duration: 360,
      easing: 'cubic-bezier(0.2, 1.3, 0.4, 1)',
    });
  }, [placement]);

  const commit = (next: Array<{ text: string; category: number }>) => {
    setPlacement(next);
    onAnswer(next.length === exercise.items.length ? ({ type: 'categorize', placement: next } satisfies ExerciseAnswer) : null);
  };
  const remember = (text: string) => {
    const el = root.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(text)}"]`);
    if (el) flight.current = { text, from: el.getBoundingClientRect() };
  };
  const place = (text: string, category: number) => {
    remember(text);
    commit([...placement.filter((p) => p.text !== text), { text, category }]);
    setSelected(null);
  };
  const unplace = (text: string) => {
    remember(text);
    commit(placement.filter((p) => p.text !== text));
  };
  const pool = exercise.items.filter((text) => !placement.some((p) => p.text === text));

  return (
    <div className="exercise" ref={root}>
      <div className="sorter__pool" aria-label={t('player.categorizeLeft', { n: pool.length })}>
        {pool.map((text) => (
          <button
            key={text}
            type="button"
            data-item={text}
            className="sorter__item target"
            aria-pressed={selected === text}
            disabled={locked}
            draggable={!locked}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', text)}
            onClick={() => setSelected(selected === text ? null : text)}
          >
            {text}
          </button>
        ))}
        {pool.length === 0 ? null : <span className="caption">{t('player.categorizeHint')}</span>}
      </div>
      <div className="sorter__bins" style={{ '--bins': exercise.categories.length } as React.CSSProperties}>
        {exercise.categories.map((name, c) => (
          <div
            key={c}
            className="sorter__bin"
            data-over={over === c || undefined}
            data-ready={selected !== null || undefined}
            onDragOver={(e) => {
              if (locked) return;
              e.preventDefault();
              setOver(c);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const text = e.dataTransfer.getData('text/plain');
              if (text) place(text, c);
            }}
          >
            <button type="button" className="sorter__bin-title" disabled={locked || selected === null} onClick={() => selected && place(selected, c)}>
              {name}
            </button>
            <div className="sorter__bin-items">
              {placement.map((p, i) =>
                p.category === c ? (
                  <button
                    key={p.text}
                    type="button"
                    data-item={p.text}
                    className="sorter__item sorter__item--placed target"
                    data-state={feedback?.parts ? (feedback.parts[i] ? 'correct' : 'wrong') : undefined}
                    disabled={locked}
                    title={t('player.categorizeBack')}
                    onClick={() => unplace(p.text)}
                  >
                    {p.text}
                  </button>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
