import { localize, type Exercise, type PublicExerciseView } from '@linguapath/shared';
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
    case 'error_spot':
      return {
        ...common,
        type: 'error_spot',
        tokens: ex.tokens,
        translation: ex.translation,
        translationText: ex.translation ? localize(ex.translation, locale) : undefined,
      };
    case 'cloze_text':
      return {
        ...common,
        type: 'cloze_text',
        text: ex.text,
        translation: ex.translation,
        translationText: ex.translation ? localize(ex.translation, locale) : undefined,
        gaps: ex.gaps.map((g, i) => ({ options: shuffle(g.options, seed + i) })),
      };
    case 'chat':
      return {
        ...common,
        type: 'chat',
        context: ex.context,
        translationText: ex.context ? localize(ex.context, locale) : undefined,
        turns: ex.turns.map((t, i) => ({
          message: t.message,
          messageTranslation: t.messageTranslation ? localize(t.messageTranslation, locale) : undefined,
          options: shuffle(t.options, seed + i),
        })),
      };
    case 'categorize':
      return {
        ...common,
        type: 'categorize',
        categories: ex.categories.map((c) => localize(c, locale)),
        items: shuffle(ex.items.map((it) => it.text), seed),
      };
    case 'reading':
      return {
        ...common,
        type: 'reading',
        mode: ex.mode,
        title: ex.title,
        passage: ex.passage,
        questions: ex.questions.map((q, i) => ({ question: localize(q.question, locale), options: shuffle(q.options.map((o) => localize(o, locale)), seed + i) })),
      };
    case 'writing':
      return {
        ...common,
        type: 'writing',
        task: localize(ex.task, locale),
        minWords: ex.minWords,
        maxWords: ex.maxWords,
        requirements: ex.required.map((r) => localize(r.label, locale)),
      };
  }
}
