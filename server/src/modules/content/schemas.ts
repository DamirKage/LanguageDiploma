import { z } from 'zod';
import { CEFR_LEVELS, ERROR_CATEGORIES, SKILLS } from '@linguapath/shared';

export const localizedText = z
  .object({ ru: z.string().trim().min(1, 'Заполните текст на русском языке').max(5000) })
  .catchall(z.string().max(5000));

export const optionalLocalizedText = z.object({ ru: z.string().max(5000) }).catchall(z.string().max(5000));

const nonEmpty = z.string().trim().min(1).max(500);

const base = {
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{2,80}$/, 'Ключ: латиница, цифры, «-» и «_»'),
  skill: z.enum(SKILLS),
  topic: z.string().trim().min(1).max(60),
  errorCategory: z.enum(ERROR_CATEGORIES),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  instruction: localizedText.optional(),
  explanation: localizedText,
  wordRefs: z.array(nonEmpty).max(20).optional(),
  /** Only used inside placement tests. */
  level: z.enum(CEFR_LEVELS).optional(),
};

const choice = z
  .object({
    ...base,
    type: z.literal('choice'),
    question: localizedText,
    target: z.string().max(500).optional(),
    optionsIn: z.enum(['target', 'ui']),
    options: z.array(z.union([nonEmpty, localizedText])).min(2).max(6),
    correctIndex: z.number().int().min(0),
  })
  .refine((e) => e.correctIndex < e.options.length, { message: 'Индекс правильного ответа вне списка', path: ['correctIndex'] })
  .refine((e) => e.options.every((o) => (e.optionsIn === 'target' ? typeof o === 'string' : typeof o === 'object')), {
    message: 'Тип вариантов не соответствует optionsIn',
    path: ['options'],
  });

const fillBlank = z
  .object({
    ...base,
    type: z.literal('fill_blank'),
    sentence: z.string().trim().min(3).max(500),
    translation: localizedText.optional(),
    answers: z.array(nonEmpty).min(1).max(10),
    options: z.array(nonEmpty).min(2).max(6).optional(),
  })
  .refine((e) => e.sentence.includes('___'), { message: 'Предложение должно содержать пропуск ___', path: ['sentence'] })
  .refine((e) => !e.options || e.options.includes(e.answers[0]!), {
    message: 'Первый правильный ответ должен быть среди вариантов',
    path: ['options'],
  });

const translate = z
  .object({
    ...base,
    type: z.literal('translate'),
    direction: z.enum(['to_target', 'to_ui']),
    source: z.union([localizedText, nonEmpty]),
    answers: z.array(nonEmpty).min(1).max(20).optional(),
    answersUi: z.object({ ru: z.array(nonEmpty).min(1).max(20) }).catchall(z.array(nonEmpty)).optional(),
  })
  .refine((e) => (e.direction === 'to_target' ? !!e.answers && typeof e.source === 'object' : !!e.answersUi && typeof e.source === 'string'), {
    message: 'Для перевода на изучаемый язык нужны answers и исходный текст на русском, для обратного — answersUi',
  });

const order = z.object({
  ...base,
  type: z.literal('order'),
  tokens: z.array(nonEmpty).min(2).max(15),
  distractors: z.array(nonEmpty).max(5).optional(),
  translation: localizedText,
  alternatives: z.array(z.array(nonEmpty)).max(5).optional(),
});

const match = z.object({
  ...base,
  type: z.literal('match'),
  pairs: z.array(z.object({ left: nonEmpty, right: localizedText })).min(2).max(6),
});

const listen = z
  .object({
    ...base,
    type: z.literal('listen'),
    audioText: z.string().trim().min(1).max(300),
    audioUrl: z.string().max(500).optional(),
    mode: z.enum(['type', 'choice']),
    options: z.array(nonEmpty).min(2).max(6).optional(),
    answers: z.array(nonEmpty).min(1).max(10),
    translation: localizedText.optional(),
  })
  .refine((e) => e.mode === 'type' || (e.options && e.options.includes(e.answers[0]!)), {
    message: 'Для режима выбора нужны варианты, включающие правильный ответ',
    path: ['options'],
  });

const dialogue = z
  .object({
    ...base,
    type: z.literal('dialogue'),
    context: localizedText.optional(),
    lines: z
      .array(z.object({ speaker: z.enum(['A', 'B']), text: z.string().trim().min(1).max(300).nullable(), translation: localizedText.optional() }))
      .min(2)
      .max(10),
    options: z.array(nonEmpty).min(2).max(5),
    correctIndex: z.number().int().min(0),
  })
  .refine((e) => e.lines.filter((l) => l.text === null).length === 1, { message: 'В диалоге должна быть ровно одна пропущенная реплика', path: ['lines'] })
  .refine((e) => e.correctIndex < e.options.length, { message: 'Индекс правильного ответа вне списка', path: ['correctIndex'] });

const speak = z.object({
  ...base,
  type: z.literal('speak'),
  text: z.string().trim().min(1).max(200),
  translation: localizedText,
});

export const exerciseSchema = z.union([choice, fillBlank, translate, order, match, listen, dialogue, speak]);
export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const theoryBlockSchema = z.object({
  title: localizedText,
  body: localizedText,
  examples: z.array(z.object({ target: nonEmpty, translation: localizedText })).max(10).optional(),
});

export function assertUniqueKeys(exercises: Array<{ key: string }>) {
  const seen = new Set<string>();
  for (const e of exercises) {
    if (seen.has(e.key)) return e.key;
    seen.add(e.key);
  }
  return null;
}
