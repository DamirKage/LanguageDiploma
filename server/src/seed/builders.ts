import type {
  CefrLevel,
  ErrorCategory,
  Exercise,
  ExerciseType,
  LocalizedText,
  Skill,
} from '@slog/shared';

/** Exercise metadata shorthand: topic, skill, error category, difficulty. */
export interface Meta {
  t?: string;
  s?: Skill;
  c?: ErrorCategory;
  d?: 1 | 2 | 3;
  words?: string[];
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type Draft = DistributiveOmit<Exercise, 'key' | 'topic' | 'skill' | 'errorCategory' | 'difficulty'> & { meta: Meta };

const ru = (text: string): LocalizedText => ({ ru: text });

const DEFAULT_SKILL: Record<ExerciseType, Skill> = {
  choice: 'vocabulary',
  fill_blank: 'grammar',
  translate: 'vocabulary',
  order: 'grammar',
  match: 'vocabulary',
  listen: 'listening',
  dialogue: 'reading',
  speak: 'speaking',
};

const CATEGORY_BY_SKILL: Record<Skill, ErrorCategory> = {
  vocabulary: 'vocabulary',
  grammar: 'grammar',
  listening: 'listening',
  reading: 'comprehension',
  speaking: 'pronunciation',
};

export function choice(question: string, options: string[], correctIndex: number, explanation: string, meta: Meta = {}, target?: string): Draft {
  return { type: 'choice', question: ru(question), target, optionsIn: 'target', options, correctIndex, explanation: ru(explanation), meta };
}

/** Multiple choice whose options are written in Russian (e.g. "what does this mean?"). */
export function choiceRu(question: string, target: string, options: string[], correctIndex: number, explanation: string, meta: Meta = {}): Draft {
  return { type: 'choice', question: ru(question), target, optionsIn: 'ui', options: options.map(ru), correctIndex, explanation: ru(explanation), meta };
}

export function fill(sentence: string, answers: string[], explanation: string, meta: Meta = {}, extra: { translation?: string; options?: string[] } = {}): Draft {
  return {
    type: 'fill_blank',
    sentence,
    answers,
    explanation: ru(explanation),
    meta,
    ...(extra.translation ? { translation: ru(extra.translation) } : {}),
    ...(extra.options ? { options: extra.options } : {}),
  };
}

export function translate(source: string, answers: string[], explanation: string, meta: Meta = {}): Draft {
  return { type: 'translate', direction: 'to_target', source: ru(source), answers, explanation: ru(explanation), meta };
}

export function translateBack(source: string, answersRu: string[], explanation: string, meta: Meta = {}): Draft {
  return { type: 'translate', direction: 'to_ui', source, answersUi: { ru: answersRu }, explanation: ru(explanation), meta: { s: 'reading', c: 'comprehension', ...meta } };
}

export function order(tokens: string[], translation: string, explanation: string, meta: Meta = {}, extra: { distractors?: string[]; alternatives?: string[][] } = {}): Draft {
  return { type: 'order', tokens, translation: ru(translation), explanation: ru(explanation), meta: { c: 'word_order', ...meta }, ...extra };
}

export function match(pairs: Array<[string, string]>, explanation: string, meta: Meta = {}): Draft {
  return { type: 'match', pairs: pairs.map(([left, right]) => ({ left, right: ru(right) })), explanation: ru(explanation), meta };
}

export function listen(text: string, explanation: string, meta: Meta = {}, extra: { options?: string[]; answers?: string[]; translation?: string } = {}): Draft {
  return {
    type: 'listen',
    audioText: text,
    mode: extra.options ? 'choice' : 'type',
    answers: extra.answers ?? [text],
    explanation: ru(explanation),
    meta,
    ...(extra.options ? { options: extra.options } : {}),
    ...(extra.translation ? { translation: ru(extra.translation) } : {}),
  };
}

export function dialogue(
  lines: Array<[speaker: 'A' | 'B', text: string | null, translation?: string]>,
  options: string[],
  correctIndex: number,
  explanation: string,
  meta: Meta = {},
  context?: string,
): Draft {
  return {
    type: 'dialogue',
    lines: lines.map(([speaker, text, translation]) => ({ speaker, text, ...(translation ? { translation: ru(translation) } : {}) })),
    options,
    correctIndex,
    explanation: ru(explanation),
    meta,
    ...(context ? { context: ru(context) } : {}),
  };
}

export function speak(text: string, translation: string, explanation: string, meta: Meta = {}): Draft {
  return { type: 'speak', text, translation: ru(translation), explanation: ru(explanation), meta: { c: 'pronunciation', ...meta } };
}

export type WordSpec = [term: string, translation: string, partOfSpeech: string, example: string, exampleTranslation: string, gender?: string];

export interface LessonSpec {
  key: string;
  title: string;
  objective: string;
  topic: string;
  minutes: number;
  theory: Array<{ title: string; body: string; examples?: Array<[string, string]> }>;
  words: WordSpec[];
  exercises: Draft[];
}

export interface ModuleSpec {
  title: string;
  description: string;
  lessons: LessonSpec[];
}

export interface CourseSpec {
  level: CefrLevel;
  title: string;
  description: string;
  modules: ModuleSpec[];
}

export interface PlacementItem {
  level: CefrLevel;
  exercise: Draft;
}

export interface LanguageSpec {
  code: string;
  name: string;
  nativeName: string;
  ttsLocale: string;
  specialChars: string[];
  order: number;
  courses: CourseSpec[];
  placement: PlacementItem[];
}

export function finalizeExercise(draft: Draft, key: string, lessonTopic: string): Exercise {
  const { meta, ...rest } = draft;
  const skill = meta.s ?? DEFAULT_SKILL[draft.type];
  return {
    ...rest,
    key,
    topic: meta.t ?? lessonTopic,
    skill,
    errorCategory: meta.c ?? CATEGORY_BY_SKILL[skill],
    difficulty: meta.d ?? 1,
    ...(meta.words ? { wordRefs: meta.words } : {}),
  } as Exercise;
}

export { ru };
