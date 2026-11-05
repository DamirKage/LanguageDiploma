import { useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Play, X } from 'lucide-react';
import { Button } from '../../../components/ui';
import { SpokenText } from '../../../components/motion/SpokenText';
import { useI18n } from '../../../i18n';
import { useSpeaker } from '../../../lib/speech';
import { SpeakButton } from '../SpeakButton';
import type { ExerciseProps } from './Exercise';
import { SpecialChars } from './SpecialChars';

/* ---------- Connected text (or recording) with questions ---------- */

export function ReadingExercise({ exercise, language, answer, onAnswer, locked, feedback }: ExerciseProps<'reading'>) {
  const { t } = useI18n();
  const { speakSequence, speaking, canSpeak } = useSpeaker(language.ttsLocale);
  const [choices, setChoices] = useState<string[]>(() => (answer?.type === 'reading' ? answer.choices : exercise.questions.map(() => '')));
  const listening = exercise.mode === 'listen';
  const [textShown, setTextShown] = useState(!listening);
  const right = feedback ? feedback.expected.split(' / ') : [];
  const audible = exercise.passage.some((p) => canSpeak(p.text));
  // In listening mode the text appears once the answer is checked, or on request when no voice is available.
  const showText = !listening || !!feedback || textShown || !audible;

  useEffect(() => {
    setChoices(exercise.questions.map(() => ''));
    setTextShown(exercise.mode !== 'listen');
  }, [exercise.key, exercise.mode, exercise.questions]);

  const play = () => speakSequence(exercise.passage.map((p) => ({ text: p.text, speaker: p.speaker })));
  const pick = (q: number, option: string) => {
    const next = choices.map((c, i) => (i === q ? option : c));
    setChoices(next);
    onAnswer(next.every(Boolean) ? { type: 'reading', choices: next } : null);
  };
  const dialogue = exercise.passage.some((p) => p.speaker);

  return (
    <div className="exercise reading">
      {exercise.title ? <h3 className="reading__title target">{exercise.title}</h3> : null}
      {audible ? (
        <div className="reading__audio">
          <Button variant={listening && !feedback ? 'primary' : 'ghost'} size="sm" data-speaking={speaking || undefined} onClick={play}>
            <Play size={14} aria-hidden />
            {speaking ? t('player.readingPlayAgain') : t('player.readingPlay')}
          </Button>
          {listening && !feedback ? (
            <Button variant="ghost" size="sm" aria-pressed={textShown} onClick={() => setTextShown((v) => !v)}>
              {textShown ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
              {textShown ? t('player.readingHideText') : t('player.readingShowText')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {showText ? (
        <div className={`reading__passage target${dialogue ? ' reading__passage--dialogue' : ''}`}>
          {exercise.passage.map((p, i) => (
            <p key={i} data-speaker={p.speaker}>
              {p.speaker ? <span className="reading__speaker">{p.speaker === 'A' ? '—' : '–'}</span> : null}
              <SpokenText text={p.text} />
            </p>
          ))}
        </div>
      ) : (
        <p className="caption">{t('player.readingTextHidden')}</p>
      )}
      {feedback?.translation ? (
        <details className="reading__translation">
          <summary>{t('player.readingTranslation')}</summary>
          <p>{feedback.translation}</p>
        </details>
      ) : null}
      <ol className="reading__questions">
        {exercise.questions.map((q, i) => (
          <li key={i} className="reading__question">
            <p className="reading__question-text">{q.question}</p>
            <div className="options" role="radiogroup" aria-label={t('player.readingQuestion', { n: i + 1 })}>
              {q.options.map((o) => {
                const chosen = choices[i] === o;
                const state = feedback ? (right[i] === o ? 'correct' : chosen ? 'wrong' : undefined) : chosen ? 'selected' : undefined;
                return (
                  <button key={o} type="button" role="radio" aria-checked={chosen} className="options__item" data-state={state} disabled={locked} onClick={() => pick(i, o)}>
                    <span>{o}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- Free writing with a model answer ---------- */

function countWords(text: string) {
  return text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
}

export function WritingExercise({ exercise, language, answer, onAnswer, locked, feedback }: ExerciseProps<'writing'>) {
  const { t } = useI18n();
  const [text, setText] = useState(answer?.type === 'writing' ? answer.text : '');
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setText('');
    setTicked({});
  }, [exercise.key]);

  const words = countWords(text);
  const change = (value: string) => {
    setText(value);
    onAnswer(countWords(value) > 0 ? { type: 'writing', text: value } : null);
  };
  const status = (ok: boolean | undefined) =>
    ok === undefined ? null : ok ? <Check size={14} aria-label="✓" className="writing__ok" /> : <X size={14} aria-label="✗" className="writing__miss" />;

  return (
    <div className="exercise writing">
      <p className="writing__task">{exercise.task}</p>
      {exercise.requirements.length ? (
        <div className="writing__needs">
          <span className="caption">{t('player.writingNeeds')}</span>
          <ul>
            {exercise.requirements.map((r, i) => (
              <li key={i} data-state={feedback?.parts ? (feedback.parts[i + 1] ? 'correct' : 'wrong') : undefined}>
                {status(feedback?.parts?.[i + 1])}
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <textarea
        ref={ref}
        className="input writing__input target"
        lang={language.code}
        rows={6}
        value={text}
        disabled={locked}
        placeholder={t('player.writingPlaceholder')}
        onChange={(e) => change(e.target.value)}
      />
      <div className="writing__meta">
        <span className="caption" data-state={feedback?.parts ? (feedback.parts[0] ? 'correct' : 'wrong') : words >= exercise.minWords ? 'correct' : undefined}>
          {status(feedback?.parts?.[0])}
          {exercise.maxWords
            ? t('player.writingWordsRange', { n: words, min: exercise.minWords, max: exercise.maxWords })
            : t('player.writingWords', { n: words, min: exercise.minWords })}
        </span>
        {!locked ? <SpecialChars chars={language.specialChars} inputRef={ref} value={text} onChange={change} disabled={locked} /> : null}
      </div>
      {feedback ? (
        <div className="writing__review">
          <p className="eyebrow">{t('player.writingModel')}</p>
          <p className="writing__model target">
            <SpeakButton text={feedback.expected} locale={language.ttsLocale} size="sm" recordingOnly />
            {feedback.expected}
          </p>
          {feedback.translation ? (
            <details>
              <summary>{t('player.writingModelTranslation')}</summary>
              <p>{feedback.translation}</p>
            </details>
          ) : null}
          {feedback.checklist?.length ? (
            <fieldset className="writing__checklist">
              <legend className="eyebrow">{t('player.writingChecklist')}</legend>
              <p className="caption">{t('player.writingChecklistHint')}</p>
              {feedback.checklist.map((c, i) => (
                <label key={i} className="writing__check">
                  <input type="checkbox" checked={!!ticked[i]} onChange={(e) => setTicked((prev) => ({ ...prev, [i]: e.target.checked }))} />
                  <span>{c}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
