import type { CefrLevel, Exercise, LocalizedText } from '@slog/shared';

export interface AdminLanguage {
  id: string;
  code: string;
  name: LocalizedText;
  nativeName: string;
  ttsLocale: string;
  specialChars: string[];
  order: number;
  isPublished: boolean;
}

export interface AdminCourse {
  id: string;
  language: string;
  level: CefrLevel;
  title: LocalizedText;
  description: LocalizedText;
  isPublished: boolean;
}

export interface AdminModule {
  id: string;
  course: string;
  language: string;
  level: CefrLevel;
  title: LocalizedText;
  description: LocalizedText;
  order: number;
  isPublished: boolean;
}

export interface AdminTheoryBlock {
  title: LocalizedText;
  body: LocalizedText;
  examples?: Array<{ target: string; translation: LocalizedText }>;
}

export interface AdminLesson {
  id: string;
  key: string;
  module: string;
  language: string;
  level: CefrLevel;
  title: LocalizedText;
  objective: LocalizedText;
  topic: string;
  order: number;
  estimatedMinutes: number;
  prerequisites: string[];
  theory: AdminTheoryBlock[];
  words: string[];
  exercises: Exercise[];
  isPublished: boolean;
  exerciseCount?: number;
}

export interface AdminWord {
  id: string;
  language: string;
  term: string;
  translation: LocalizedText;
  partOfSpeech: string;
  gender: string | null;
  example: string;
  exampleTranslation: LocalizedText;
  topic: string;
  level: CefrLevel;
  audioUrl: string | null;
  imageUrl: string | null;
  isPublished: boolean;
}

export interface AdminTest {
  id: string;
  kind: 'placement' | 'module' | 'lesson';
  language: string;
  level: CefrLevel | null;
  module: string | null;
  lesson: string | null;
  title: LocalizedText;
  passPercent: number;
  exercises: Exercise[];
  isPublished: boolean;
  exerciseCount?: number;
}

/** Removes server-managed fields before sending a document back. */
export function stripMeta<T extends object>(doc: T, extra: string[] = []): Record<string, unknown> {
  const omit = new Set(['id', '_id', '__v', 'createdAt', 'updatedAt', 'exerciseCount', ...extra]);
  return Object.fromEntries(Object.entries(doc).filter(([k]) => !omit.has(k)));
}
