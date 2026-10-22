import type { CefrLevel, ErrorCategory, ExerciseType, LanguageCode, Skill } from './constants';
import type { LocalizedText } from './localized';

interface ExerciseBase {
  /** Stable key, unique across the whole catalogue (e.g. `de-a1-greetings-3`). */
  key: string;
  type: ExerciseType;
  skill: Skill;
  topic: string;
  /** Category recorded when the learner answers incorrectly. */
  errorCategory: ErrorCategory;
  difficulty: 1 | 2 | 3;
  instruction?: LocalizedText;
  explanation: LocalizedText;
  /** Terms (in the target language) this exercise practises. */
  wordRefs?: string[];
  /** CEFR level of the item; set only in placement tests. */
  level?: CefrLevel;
}

export interface ChoiceExercise extends ExerciseBase {
  type: 'choice';
  question: LocalizedText;
  /** Optional snippet in the target language shown with the question. */
  target?: string;
  optionsIn: 'target' | 'ui';
  options: Array<string | LocalizedText>;
  correctIndex: number;
}

export interface FillBlankExercise extends ExerciseBase {
  type: 'fill_blank';
  /** Target-language sentence with `___` marking the gap. */
  sentence: string;
  translation?: LocalizedText;
  answers: string[];
  /** When present the learner picks from these instead of typing. */
  options?: string[];
}

export interface TranslateExercise extends ExerciseBase {
  type: 'translate';
  direction: 'to_target' | 'to_ui';
  /** Source text: UI-language text for `to_target`, target-language text for `to_ui`. */
  source: LocalizedText | string;
  /** Accepted answers in the target language (`to_target`). */
  answers?: string[];
  /** Accepted answers in the interface language (`to_ui`). */
  answersUi?: Partial<Record<string, string[]>> & { ru: string[] };
}

export interface OrderExercise extends ExerciseBase {
  type: 'order';
  tokens: string[];
  distractors?: string[];
  translation: LocalizedText;
  alternatives?: string[][];
}

export interface MatchExercise extends ExerciseBase {
  type: 'match';
  pairs: Array<{ left: string; right: LocalizedText }>;
}

export interface ListenExercise extends ExerciseBase {
  type: 'listen';
  audioText: string;
  audioUrl?: string;
  mode: 'type' | 'choice';
  options?: string[];
  answers: string[];
  translation?: LocalizedText;
}

export interface DialogueExercise extends ExerciseBase {
  type: 'dialogue';
  context?: LocalizedText;
  lines: Array<{ speaker: 'A' | 'B'; text: string | null; translation?: LocalizedText }>;
  options: string[];
  correctIndex: number;
}

export interface SpeakExercise extends ExerciseBase {
  type: 'speak';
  text: string;
  translation: LocalizedText;
}

export type Exercise =
  | ChoiceExercise
  | FillBlankExercise
  | TranslateExercise
  | OrderExercise
  | MatchExercise
  | ListenExercise
  | DialogueExercise
  | SpeakExercise;

/** Answer payloads sent by the client, one per exercise type. */
export type ExerciseAnswer =
  | { type: 'choice'; option: string }
  | { type: 'fill_blank'; text: string }
  | { type: 'translate'; text: string }
  | { type: 'order'; tokens: string[] }
  | { type: 'match'; pairs: Array<{ left: string; right: string }> }
  | { type: 'listen'; text: string; skipped?: boolean }
  | { type: 'dialogue'; option: string }
  | { type: 'speak'; transcript: string; skipped?: boolean };

/** Exercise as delivered to the learner: no answers, options already shuffled. */
export type PublicExercise =
  | (Pick<ChoiceExercise, 'type' | 'question' | 'target' | 'optionsIn'> & { options: string[] })
  | (Pick<FillBlankExercise, 'type' | 'sentence' | 'translation'> & { options?: string[] })
  | (Pick<TranslateExercise, 'type' | 'direction'> & { source: string; tiles?: string[] })
  | (Pick<OrderExercise, 'type' | 'translation'> & { tiles: string[] })
  | { type: 'match'; left: string[]; right: string[] }
  | (Pick<ListenExercise, 'type' | 'audioText' | 'audioUrl' | 'mode'> & { options?: string[] })
  | (Pick<DialogueExercise, 'type' | 'context'> & {
      lines: Array<{ speaker: 'A' | 'B'; text: string | null; translation?: string }>;
      options: string[];
    })
  | (Pick<SpeakExercise, 'type' | 'text' | 'translation'>);

export type PublicExerciseView = PublicExercise & {
  key: string;
  skill: Skill;
  topic: string;
  instruction: string;
  translationText?: string;
};

export type Verdict = 'correct' | 'almost' | 'incorrect' | 'skipped';

export interface AnswerFeedback {
  verdict: Verdict;
  /** Canonical answer rendered for display. */
  expected: string;
  explanation: string;
  /** Extra hint, e.g. about diacritics in an otherwise correct answer. */
  note?: { code: 'diacritics' | 'typo' | 'kazakh_letters' | 'alternative'; detail?: string };
}

export interface TheoryBlock {
  title: LocalizedText;
  body: LocalizedText;
  examples?: Array<{ target: string; translation: LocalizedText }>;
}

export interface LessonCatalogItem {
  id: string;
  key: string;
  title: string;
  objective: string;
  topic: string;
  level: CefrLevel;
  moduleId: string;
  courseId: string;
  language: LanguageCode;
  order: number;
  estimatedMinutes: number;
  exerciseCount: number;
  wordCount: number;
}
