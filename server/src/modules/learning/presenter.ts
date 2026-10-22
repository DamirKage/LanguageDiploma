import { localize, type Exercise, type PublicExerciseView } from '@slog/shared';
import { shuffle } from '../../lib/text';

/** Strips answers from an exercise and shuffles options deterministically by `seed`. */
export function toPublicExercise(ex: Exercise, seed: number, locale = 'ru'): PublicExerciseView {
  const common = {
    key: ex.key,
    skill: ex.skill,
    topic: ex.topic,
    instruction: ex.instruction ? localize(ex.instruction, locale) : '',
  };
  switch (ex.type) {
    case 'choice':
      return {
        ...common,
        type: 'choice',
        question: ex.question,
        target: ex.target,
        optionsIn: ex.optionsIn,
        options: shuffle(ex.options.map((o) => localize(o, locale)), seed),
      };
    case 'fill_blank':
      return {
        ...common,
        type: 'fill_blank',
        sentence: ex.sentence,
        translation: ex.translation,
        translationText: ex.translation ? localize(ex.translation, locale) : undefined,
        options: ex.options ? shuffle(ex.options, seed) : undefined,
      };
    case 'translate':
      return { ...common, type: 'translate', direction: ex.direction, source: localize(ex.source, locale) };
    case 'order':
      return {
        ...common,
        type: 'order',
        translation: ex.translation,
        translationText: localize(ex.translation, locale),
        tiles: shuffle([...ex.tokens, ...(ex.distractors ?? [])], seed),
      };
    case 'match':
      return {
        ...common,
        type: 'match',
        left: shuffle(ex.pairs.map((p) => p.left), seed),
        right: shuffle(ex.pairs.map((p) => localize(p.right, locale)), seed + 1),
      };
    case 'listen':
      return {
        ...common,
        type: 'listen',
        audioText: ex.audioText,
        audioUrl: ex.audioUrl,
        mode: ex.mode,
        options: ex.options ? shuffle(ex.options, seed) : undefined,
      };
    case 'dialogue':
      return {
        ...common,
        type: 'dialogue',
        context: ex.context,
        translationText: ex.context ? localize(ex.context, locale) : undefined,
        lines: ex.lines.map((l) => ({ speaker: l.speaker, text: l.text, translation: l.translation ? localize(l.translation, locale) : undefined })),
        options: shuffle(ex.options, seed),
      };
    case 'speak':
      return { ...common, type: 'speak', text: ex.text, translation: ex.translation, translationText: localize(ex.translation, locale) };
  }
}
