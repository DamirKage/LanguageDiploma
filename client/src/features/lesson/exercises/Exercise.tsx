import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Turtle, Volume2 } from 'lucide-react';
import { localize, type AnswerFeedback, type ExerciseAnswer, type PublicExerciseView } from '@linguapath/shared';
import { Alert, Button } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { useRecognition, useSpeaker } from '../../../lib/speech';
import { SpeakButton } from '../SpeakButton';
import { SpecialChars } from './SpecialChars';

export interface LanguageInfo {
  code: string;
  name: string;
  ttsLocale: string;
  specialChars: string[];
}

export interface ExerciseProps<T extends PublicExerciseView['type'] = PublicExerciseView['type']> {
  exercise: Extract<PublicExerciseView, { type: T }>;
  language: LanguageInfo;
  answer: ExerciseAnswer | null;
  onAnswer: (answer: ExerciseAnswer | null) => void;
  /** Called when the learner wants to submit with the keyboard. */
  onSubmit: () => void;
  locked: boolean;
  feedback: AnswerFeedback | null;
}

function optionState(option: string, chosen: string | undefined, feedback: AnswerFeedback | null) {
  if (!feedback) return chosen === option ? 'selected' : undefined;
  if (feedback.expected === option) return 'correct';
  if (chosen === option) return 'wrong';
  return undefined;
}

function OptionList({
  options,
  chosen,
  onPick,
  locked,
  feedback,
  target,
}: {
  options: string[];
  chosen?: string;
  onPick: (o: string) => void;
  locked: boolean;
  feedback: AnswerFeedback | null;
  target: boolean;
}) {
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onPick(options[n - 1]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onPick, locked]);
  return (
    <div className="options" role="radiogroup">
      {options.map((option, i) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={chosen === option}
          className="options__item"
          data-state={optionState(option, chosen, feedback)}
          onClick={() => onPick(option)}
          disabled={locked}
        >
          <span className="options__key" aria-hidden>
            {i + 1}
          </span>
          <span className={target ? 'target' : undefined}>{option}</span>
        </button>
      ))}
    </div>
  );
}

function ChoiceExercise({ exercise, language, answer, onAnswer, locked, feedback }: ExerciseProps<'choice'>) {
  const chosen = answer?.type === 'choice' ? answer.option : undefined;
  return (
    <div className="exercise">
      <p className="exercise__prompt">{localize(exercise.question)}</p>
      {exercise.target ? (
        <p className="exercise__target target">
          <SpeakButton text={exercise.target} locale={language.ttsLocale} size="sm" />
          {exercise.target}
        </p>
      ) : null}
      <OptionList
        options={exercise.options}
        chosen={chosen}
        onPick={(option) => onAnswer({ type: 'choice', option })}
        locked={locked}
        feedback={feedback}
        target={exercise.optionsIn === 'target'}
      />
    </div>
  );
}

function TextAnswer({
  value,
  onChange,
  onSubmit,
  locked,
  language,
  placeholder,
  useTarget,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  locked: boolean;
  language: LanguageInfo;
  placeholder: string;
  useTarget: boolean;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!locked) ref.current?.focus();
  }, [locked]);
  const common = {
    ref,
    value,
    disabled: locked,
    placeholder,
    'aria-label': placeholder,
    autoCapitalize: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    lang: useTarget ? language.code : 'ru',
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
  };
  return (
    <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
      {multiline ? (
        <textarea className={`textarea ${useTarget ? 'input--target' : ''}`} rows={3} {...common} />
      ) : (
        <input className={`input ${useTarget ? 'input--target' : ''}`} {...common} />
      )}
      {useTarget ? <SpecialChars chars={language.specialChars} inputRef={ref} value={value} onChange={onChange} disabled={locked} /> : null}
    </div>
  );
}

function FillBlankExercise({ exercise, language, answer, onAnswer, onSubmit, locked, feedback }: ExerciseProps<'fill_blank'>) {
  const { t } = useI18n();
  const text = answer?.type === 'fill_blank' ? answer.text : '';
  const [before, after] = exercise.sentence.split('___') as [string, string | undefined];
  return (
    <div className="exercise">
      <p className="exercise__sentence target">
        {before}
        <span className="gap" data-filled={text ? true : undefined}>
          {text || ' '}
        </span>
        {after}
      </p>
      {exercise.translationText ? <p className="exercise__translation">{exercise.translationText}</p> : null}
      {exercise.options ? (
        <OptionList options={exercise.options} chosen={text} onPick={(o) => onAnswer({ type: 'fill_blank', text: o })} locked={locked} feedback={feedback ? { ...feedback, expected: matchExpectedOption(exercise.options, feedback.expected) } : null} target />
      ) : (
        <TextAnswer
          value={text}
          onChange={(v) => onAnswer(v.trim() ? { type: 'fill_blank', text: v } : null)}
          onSubmit={onSubmit}
          locked={locked}
          language={language}
          placeholder={t('player.typeHere')}
          useTarget
        />
      )}
    </div>
  );
}

/** For gap options the feedback carries the whole sentence; find which option completes it. */
function matchExpectedOption(options: string[], expected: string) {
  return options.find((o) => expected.includes(o)) ?? expected;
}

function TranslateExercise({ exercise, language, answer, onAnswer, onSubmit, locked }: ExerciseProps<'translate'>) {
  const { t } = useI18n();
  const text = answer?.type === 'translate' ? answer.text : '';
  const toTarget = exercise.direction === 'to_target';
  return (
    <div className="exercise">
      <p className={`exercise__source ${toTarget ? '' : 'target'}`}>
        {!toTarget ? <SpeakButton text={exercise.source} locale={language.ttsLocale} size="sm" /> : null}
        {exercise.source}
      </p>
      <TextAnswer
        value={text}
        onChange={(v) => onAnswer(v.trim() ? { type: 'translate', text: v } : null)}
        onSubmit={onSubmit}
        locked={locked}
        language={language}
        placeholder={toTarget ? t('player.typeHereTarget') : t('player.typeHereUi')}
        useTarget={toTarget}
        multiline
      />
    </div>
  );
}

function OrderExercise({ exercise, answer, onAnswer, locked }: ExerciseProps<'order'>) {
  const { t } = useI18n();
  // Tiles are tracked by index because the same word can appear twice.
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => setPicked([]), [exercise.key]);
  useEffect(() => {
    if (answer === null) setPicked([]);
  }, [answer]);
  const update = (next: number[]) => {
    setPicked(next);
    onAnswer(next.length ? { type: 'order', tokens: next.map((i) => exercise.tiles[i]!) } : null);
  };
  return (
    <div className="exercise">
      <p className="exercise__translation exercise__translation--lead">{exercise.translationText}</p>
      <div className="tiles tiles--answer" aria-label={t('player.tilesArea')}>
        {picked.map((i, pos) => (
          <button key={`${i}-${pos}`} type="button" className="tile target" disabled={locked} onClick={() => update(picked.filter((_, p) => p !== pos))}>
            {exercise.tiles[i]}
          </button>
        ))}
      </div>
      <div className="tiles" aria-label={t('player.tilesBank')}>
        {exercise.tiles.map((tile, i) => (
          <button key={i} type="button" className="tile target" disabled={locked || picked.includes(i)} data-used={picked.includes(i) || undefined} onClick={() => update([...picked, i])}>
            {tile}
          </button>
        ))}
      </div>
      {picked.length > 0 && !locked ? (
        <Button variant="ghost" size="sm" onClick={() => update([])}>
          {t('player.clearOrder')}
        </Button>
      ) : null}
    </div>
  );
}

function MatchExercise({ exercise, onAnswer, locked }: ExerciseProps<'match'>) {
  const { t } = useI18n();
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  useEffect(() => {
    setPairs({});
    setActiveLeft(null);
  }, [exercise.key]);
  const usedRight = new Set(Object.values(pairs));
  const commit = (next: Record<string, string>) => {
    setPairs(next);
    onAnswer(Object.keys(next).length === exercise.left.length ? { type: 'match', pairs: Object.entries(next).map(([left, right]) => ({ left, right })) } : null);
  };
  const pairIndex = (left: string) => Object.keys(pairs).indexOf(left);
  return (
    <div className="exercise match">
      <div className="match__col" aria-label={t('player.matchLeft')}>
        {exercise.left.map((left) => (
          <button
            key={left}
            type="button"
            className="tile tile--wide target"
            disabled={locked}
            aria-pressed={activeLeft === left}
            data-paired={left in pairs ? pairIndex(left) % 4 : undefined}
            onClick={() => {
              if (left in pairs) {
                const { [left]: _removed, ...rest } = pairs;
                commit(rest);
                setActiveLeft(left);
              } else setActiveLeft(left);
            }}
          >
            {left}
          </button>
        ))}
      </div>
      <div className="match__col" aria-label={t('player.matchRight')}>
        {exercise.right.map((right) => {
          const owner = Object.keys(pairs).find((l) => pairs[l] === right);
          return (
            <button
              key={right}
              type="button"
              className="tile tile--wide"
              disabled={locked || (!activeLeft && !owner)}
              data-paired={owner ? pairIndex(owner) % 4 : undefined}
              onClick={() => {
                if (owner) {
                  const { [owner]: _removed, ...rest } = pairs;
                  commit(rest);
                  return;
                }
                if (!activeLeft || usedRight.has(right)) return;
                commit({ ...pairs, [activeLeft]: right });
                setActiveLeft(null);
              }}
            >
              {right}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListenExercise({ exercise, language, answer, onAnswer, onSubmit, locked, feedback }: ExerciseProps<'listen'>) {
  const { t } = useI18n();
  const { speak, available, speaking } = useSpeaker(language.ttsLocale);
  const canPlay = available || !!exercise.audioUrl;
  const played = useRef(false);
  useEffect(() => {
    played.current = false;
  }, [exercise.key]);
  useEffect(() => {
    if (canPlay && !played.current && !locked) {
      played.current = true;
      const timer = setTimeout(() => speak(exercise.audioText, { audioUrl: exercise.audioUrl }), 350);
      return () => clearTimeout(timer);
    }
  }, [canPlay, exercise.audioText, exercise.audioUrl, speak, locked]);

  if (!canPlay) {
    return (
      <div className="exercise">
        <Alert tone="warn">{t('player.ttsUnavailable', { language: language.name })}</Alert>
        <div>
          <Button onClick={() => onAnswer({ type: 'listen', text: '', skipped: true })} aria-pressed={answer?.type === 'listen' && !!answer.skipped} disabled={locked}>
            {t('player.skipNoPenalty')}
          </Button>
        </div>
      </div>
    );
  }
  const text = answer?.type === 'listen' ? answer.text : '';
  return (
    <div className="exercise">
      <div className="listen">
        <button type="button" className="listen__play" data-speaking={speaking || undefined} onClick={() => speak(exercise.audioText, { audioUrl: exercise.audioUrl })} aria-label={t('player.play')}>
          <Volume2 size={32} aria-hidden />
        </button>
        <Button variant="ghost" size="sm" onClick={() => speak(exercise.audioText, { audioUrl: exercise.audioUrl, rate: 0.6 })}>
          <Turtle size={16} aria-hidden />
          {t('player.playSlow')}
        </Button>
      </div>
      {exercise.mode === 'choice' && exercise.options ? (
        <OptionList options={exercise.options} chosen={text} onPick={(o) => onAnswer({ type: 'listen', text: o })} locked={locked} feedback={feedback} target />
      ) : (
        <TextAnswer
          value={text}
          onChange={(v) => onAnswer(v.trim() ? { type: 'listen', text: v } : null)}
          onSubmit={onSubmit}
          locked={locked}
          language={language}
          placeholder={t('player.typeHereTarget')}
          useTarget
        />
      )}
    </div>
  );
}

function DialogueExercise({ exercise, language, answer, onAnswer, locked, feedback }: ExerciseProps<'dialogue'>) {
  const { t } = useI18n();
  const chosen = answer?.type === 'dialogue' ? answer.option : undefined;
  return (
    <div className="exercise">
      {exercise.translationText ? (
        <p className="exercise__context">
          <span className="eyebrow">{t('player.contextLabel')}</span> {exercise.translationText}
        </p>
      ) : null}
      <ol className="dialogue">
        {exercise.lines.map((line, i) => (
          <li key={i} className="dialogue__line" data-speaker={line.speaker}>
            <span className="dialogue__speaker" aria-hidden>
              {line.speaker}
            </span>
            {line.text ? (
              <span className="dialogue__bubble">
                <span className="target">{line.text}</span>
                <SpeakButton text={line.text} locale={language.ttsLocale} size="sm" />
                {line.translation ? <span className="dialogue__translation">{line.translation}</span> : null}
              </span>
            ) : (
              <span className="dialogue__bubble dialogue__bubble--gap target">{chosen ?? '…'}</span>
            )}
          </li>
        ))}
      </ol>
      <OptionList options={exercise.options} chosen={chosen} onPick={(o) => onAnswer({ type: 'dialogue', option: o })} locked={locked} feedback={feedback} target />
    </div>
  );
}

function SpeakExercise({ exercise, language, answer, onAnswer, locked }: ExerciseProps<'speak'>) {
  const { t } = useI18n();
  const recognition = useRecognition(language.ttsLocale);
  useEffect(() => {
    if (recognition.status === 'done' && recognition.transcript) onAnswer({ type: 'speak', transcript: recognition.transcript });
  }, [recognition.status, recognition.transcript, onAnswer]);
  const unavailable = recognition.status === 'unsupported' || recognition.status === 'denied';
  const skipped = answer?.type === 'speak' && answer.skipped;
  return (
    <div className="exercise">
      <p className="exercise__target exercise__target--large target">
        <SpeakButton text={exercise.text} locale={language.ttsLocale} />
        {exercise.text}
      </p>
      <p className="exercise__translation">{exercise.translationText}</p>
      {unavailable ? (
        <Alert tone="warn">{recognition.status === 'denied' ? t('player.speakDenied') : t('player.speakUnsupported')}</Alert>
      ) : (
        <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
          <div className="row">
            {recognition.status === 'listening' ? (
              <Button variant="accent" onClick={recognition.stop}>
                <Square size={16} aria-hidden />
                {t('player.speakStop')}
              </Button>
            ) : (
              <Button variant="accent" onClick={recognition.start} disabled={locked}>
                <Mic size={16} aria-hidden />
                {t('player.speakStart')}
              </Button>
            )}
            {recognition.status === 'listening' ? <span className="small muted" aria-live="polite">{t('player.speakListening')}</span> : null}
          </div>
          {recognition.transcript ? (
            <p className="small" aria-live="polite">
              {t('player.speakHeard', { text: recognition.transcript })}
            </p>
          ) : null}
          <p className="caption">{t('player.speakExperimental')}</p>
        </div>
      )}
      <div>
        <Button variant="ghost" size="sm" disabled={locked} aria-pressed={!!skipped} onClick={() => onAnswer({ type: 'speak', transcript: '', skipped: true })}>
          {t('player.skipNoPenalty')}
        </Button>
      </div>
    </div>
  );
}

export function ExerciseView(props: ExerciseProps) {
  const { exercise } = props;
  switch (exercise.type) {
    case 'choice':
      return <ChoiceExercise {...(props as ExerciseProps<'choice'>)} />;
    case 'fill_blank':
      return <FillBlankExercise {...(props as ExerciseProps<'fill_blank'>)} />;
    case 'translate':
      return <TranslateExercise {...(props as ExerciseProps<'translate'>)} />;
    case 'order':
      return <OrderExercise {...(props as ExerciseProps<'order'>)} />;
    case 'match':
      return <MatchExercise {...(props as ExerciseProps<'match'>)} />;
    case 'listen':
      return <ListenExercise {...(props as ExerciseProps<'listen'>)} />;
    case 'dialogue':
      return <DialogueExercise {...(props as ExerciseProps<'dialogue'>)} />;
    case 'speak':
      return <SpeakExercise {...(props as ExerciseProps<'speak'>)} />;
  }
}

export function useInstruction(exercise: PublicExerciseView, language: LanguageInfo) {
  const { t } = useI18n();
  return useMemo(() => {
    if (exercise.instruction) return exercise.instruction;
    switch (exercise.type) {
      case 'translate':
        return exercise.direction === 'to_target'
          ? t('player.instruction.translate_to_target', { language: language.name.toLowerCase() })
          : t('player.instruction.translate_to_ui');
      case 'listen':
        return exercise.mode === 'choice' ? t('player.instruction.listen_choice') : t('player.instruction.listen');
      default:
        return t(`player.instruction.${exercise.type}`);
    }
  }, [exercise, language.name, t]);
}
