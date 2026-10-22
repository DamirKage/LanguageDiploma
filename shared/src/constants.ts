export const LANGUAGE_CODES = ['kk', 'en', 'tr', 'de', 'es'] as const;
export type LanguageCode = string;

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export function levelIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

export function nextLevel(level: CefrLevel): CefrLevel | null {
  return CEFR_LEVELS[levelIndex(level) + 1] ?? null;
}

export const SKILLS = ['vocabulary', 'grammar', 'listening', 'reading', 'speaking'] as const;
export type Skill = (typeof SKILLS)[number];

export const EXERCISE_TYPES = [
  'choice',
  'fill_blank',
  'translate',
  'order',
  'match',
  'listen',
  'dialogue',
  'speak',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Kind of mistake, independent of the topic the exercise belongs to. */
export const ERROR_CATEGORIES = [
  'grammar',
  'vocabulary',
  'spelling',
  'word_order',
  'listening',
  'comprehension',
  'pronunciation',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export const LEARNING_GOALS = ['travel', 'conversation', 'work', 'study', 'culture', 'exam'] as const;
export type LearningGoal = (typeof LEARNING_GOALS)[number];

export const DAILY_MINUTES_OPTIONS = [5, 10, 15, 20, 30, 45] as const;

export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const UI_LOCALES = ['ru'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE: UiLocale = 'ru';

export const POINTS = { correct: 10, almost: 7, incorrect: 0 } as const;
export const LESSON_PASS_PERCENT = 70;
export const TEST_PASS_PERCENT = 70;
