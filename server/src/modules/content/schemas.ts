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

const errorSpot = z
  .object({
    ...base,
    type: z.literal('error_spot'),
    tokens: z.array(nonEmpty).min(3).max(30),
    errorIndex: z.number().int().min(0),
    correction: nonEmpty,
    translation: localizedText.optional(),
  })
  .refine((e) => e.errorIndex < e.tokens.length, { message: 'Номер ошибочного слова вне предложения', path: ['errorIndex'] })
  .refine((e) => e.tokens[e.errorIndex] !== e.correction, { message: 'Исправление должно отличаться от ошибочного слова', path: ['correction'] });

const clozeText = z
  .object({
    ...base,
    type: z.literal('cloze_text'),
    text: z.string().trim().min(1).max(1200),
    gaps: z.array(z.object({ options: z.array(nonEmpty).min(2).max(5), answer: nonEmpty })).min(2).max(8),
    translation: localizedText.optional(),
  })
  .refine((e) => e.gaps.every((g) => g.options.includes(g.answer)), { message: 'В каждом пропуске правильный ответ должен быть среди вариантов', path: ['gaps'] })
  .refine((e) => e.gaps.every((_, i) => e.text.includes(`{${i}}`)), { message: 'В тексте должны быть отмечены все пропуски: {0}, {1}…', path: ['text'] });

const chat = z
  .object({
    ...base,
    type: z.literal('chat'),
    context: localizedText.optional(),
    turns: z
      .array(z.object({ message: nonEmpty, messageTranslation: localizedText.optional(), options: z.array(nonEmpty).min(2).max(4), correctIndex: z.number().int().min(0) }))
      .min(2)
      .max(6),
  })
  .refine((e) => e.turns.every((t) => t.correctIndex < t.options.length), { message: 'Индекс правильного ответа вне списка', path: ['turns'] });

const categorize = z
  .object({
    ...base,
    type: z.literal('categorize'),
    categories: z.array(z.union([nonEmpty, localizedText])).min(2).max(4),
    items: z.array(z.object({ text: nonEmpty, category: z.number().int().min(0) })).min(4).max(12),
  })
  .refine((e) => e.items.every((it) => it.category < e.categories.length), { message: 'Номер группы вне списка групп', path: ['items'] })
  .refine((e) => new Set(e.items.map((it) => it.text)).size === e.items.length, { message: 'Элементы не должны повторяться', path: ['items'] });

export const exerciseSchema = z.union([choice, fillBlank, translate, order, listen, dialogue, speak, errorSpot, clozeText, chat, categorize]);

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
