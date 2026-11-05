import type {
  CefrLevel,
  ErrorCategory,
  Exercise,
  ExerciseType,
  LocalizedText,
  Skill,
} from '@linguapath/shared';

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
  listen: 'listening',
  dialogue: 'reading',
  speak: 'speaking',
  error_spot: 'grammar',
  cloze_text: 'grammar',
  chat: 'reading',
  categorize: 'vocabulary',
  reading: 'reading',
  writing: 'writing',
};

const CATEGORY_BY_SKILL: Record<Skill, ErrorCategory> = {
  vocabulary: 'vocabulary',
  grammar: 'grammar',
  listening: 'listening',
  reading: 'comprehension',
  speaking: 'pronunciation',
  writing: 'grammar',
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
  /** Questions for the lesson test; they are not shown during the lesson itself. */
  test: Draft[];
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

/** "Find the mistake": `wrong` is the word as it stands in the sentence, `correction` what it should be. */
export function errorSpot(sentence: string, wrong: string, correction: string, explanation: string, meta: Meta = {}, translation?: string): Draft {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const bare = (t: string) => t.replace(/^[¿¡«"(]+|[.,!?;:»")]+$/g, '');
  const errorIndex = tokens.findIndex((t) => bare(t) === wrong);
  if (errorIndex < 0) throw new Error(`errorSpot: "${wrong}" not found in "${sentence}"`);
  const fixed = tokens[errorIndex]!.replace(wrong, correction);
  return {
    type: 'error_spot',
    tokens,
    errorIndex,
    correction: fixed,
    explanation: ru(explanation),
    meta: { c: 'grammar', ...meta },
    ...(translation ? { translation: ru(translation) } : {}),
  };
}

/** Text with gaps written inline: `Gestern [bin|habe|war] ich …` — the first option is the answer. */
export function cloze(source: string, explanation: string, meta: Meta = {}, translation?: string): Draft {
  const gaps: Array<{ options: string[]; answer: string }> = [];
  const text = source.replace(/\[([^\]]+)\]/g, (_, body: string) => {
    const options = body.split('|').map((o) => o.trim());
    gaps.push({ options, answer: options[0]! });
    return `{${gaps.length - 1}}`;
  });
  if (gaps.length < 2) throw new Error(`cloze: at least two gaps expected in "${source}"`);
  return { type: 'cloze_text', text, gaps, explanation: ru(explanation), meta, ...(translation ? { translation: ru(translation) } : {}) };
}

/** Messenger role-play: [message, its Russian translation, reply options, index of the right reply]. */
export function chat(
  turns: Array<[message: string, translation: string, options: string[], correctIndex: number]>,
  explanation: string,
  meta: Meta = {},
  context?: string,
): Draft {
  return {
    type: 'chat',
    turns: turns.map(([message, translation, options, correctIndex]) => ({ message, messageTranslation: ru(translation), options, correctIndex })),
    explanation: ru(explanation),
    meta,
    ...(context ? { context: ru(context) } : {}),
  };
}

/** Sort into groups. Category names in the target language are plain strings; Russian ones go in `{ ru }`. */
export function categorize(categories: Array<string | { ru: string }>, items: Array<[text: string, category: number]>, explanation: string, meta: Meta = {}): Draft {
  return {
    type: 'categorize',
    categories: categories.map((c) => (typeof c === 'string' ? c : ru(c.ru))),
    items: items.map(([text, category]) => ({ text, category })),
    explanation: ru(explanation),
    meta,
  };
}

/**
 * Connected text with questions. `passage` holds paragraphs, or `[speaker, line]` pairs for a dialogue.
 * Questions are in Russian; their options are Russian too unless `optionsInTarget` is set.
 * In `listen` mode the learner hears the text first and reads it only after answering.
 */
export function reading(
  spec: {
    mode?: 'read' | 'listen';
    title?: string;
    passage: Array<string | [speaker: 'A' | 'B', text: string]>;
    translation?: string;
    questions: Array<[question: string, options: string[], correctIndex: number, optionsInTarget?: boolean]>;
  },
  explanation: string,
  meta: Meta = {},
): Draft {
  const mode = spec.mode ?? 'read';
  return {
    type: 'reading',
    mode,
    ...(spec.title ? { title: spec.title } : {}),
    passage: spec.passage.map((p) => (typeof p === 'string' ? { text: p } : { speaker: p[0], text: p[1] })),
    ...(spec.translation ? { translation: ru(spec.translation) } : {}),
    questions: spec.questions.map(([question, options, correctIndex, inTarget]) => ({
      question: ru(question),
      options: inTarget ? options : options.map((o) => ru(o)),
      correctIndex,
    })),
    explanation: ru(explanation),
    meta: { s: mode === 'listen' ? 'listening' : 'reading', c: mode === 'listen' ? 'listening' : 'comprehension', ...meta },
  };
}

/**
 * Free writing. `required` lists constructions as `[label, forms]`: the requirement is met when any form occurs
 * in the text (a form starting with "-" may stand inside a word). The model answer must satisfy every requirement.
 */
export function writing(
  spec: {
    task: string;
    minWords: number;
    maxWords?: number;
    required: Array<[label: string, forms: string[]]>;
    model: string;
    modelTranslation?: string;
    checklist: string[];
  },
  explanation: string,
  meta: Meta = {},
): Draft {
  return {
    type: 'writing',
    task: ru(spec.task),
    minWords: spec.minWords,
    ...(spec.maxWords ? { maxWords: spec.maxWords } : {}),
    required: spec.required.map(([label, forms]) => ({ label: ru(label), forms })),
    modelAnswer: spec.model,
    ...(spec.modelTranslation ? { modelTranslation: ru(spec.modelTranslation) } : {}),
    checklist: spec.checklist.map((c) => ru(c)),
    explanation: ru(explanation),
    meta: { s: 'writing', c: 'grammar', ...meta },
  };
}
