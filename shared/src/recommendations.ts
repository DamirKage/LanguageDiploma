import type { ErrorCategory } from './constants';

export const RECOMMENDATION_TYPES = [
  'placement',
  'review',
  'resume',
  'next_lesson',
  'weak_topic',
  'retry_lesson',
  'module_test',
  'topic_refresh',
  'level_up',
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

/**
 * Machine-readable explanation of why an activity was recommended.
 * The client turns `code` + `params` into a sentence in the interface language.
 */
export type RecommendationReason =
  | { code: 'no_placement' }
  | { code: 'reviews_due'; params: { count: number } }
  | { code: 'reviews_overdue'; params: { count: number; days: number } }
  | { code: 'low_retention'; params: { retention: number } }
  | { code: 'resume_attempt'; params: { answered: number; total: number } }
  | { code: 'next_in_path'; params: { level: string } }
  | { code: 'prerequisites_met' }
  | { code: 'low_topic_accuracy'; params: { topic: string; accuracy: number; answers: number } }
  | { code: 'declining_trend'; params: { topic: string; from: number; to: number } }
  | { code: 'recurring_error'; params: { category: ErrorCategory; count: number } }
  | { code: 'low_lesson_score'; params: { percent: number } }
  | { code: 'module_ready'; params: { lessons: number } }
  | { code: 'not_practiced_recently'; params: { topic: string; days: number } }
  | { code: 'level_complete'; params: { level: string; next: string } }
  | { code: 'goal_match'; params: { goal: string } }
  | { code: 'fits_time'; params: { minutes: number } }
  | { code: 'returning_after_break'; params: { days: number } }
  | { code: 'high_recent_accuracy'; params: { accuracy: number } }
  | { code: 'low_recent_accuracy'; params: { accuracy: number } };

export interface RecommendationTarget {
  lessonId?: string;
  lessonTitle?: string;
  testId?: string;
  moduleTitle?: string;
  topic?: string;
  attemptId?: string;
  level?: string;
  reviewCount?: number;
}

export interface Recommendation {
  /** Deterministic identifier of the recommended activity, e.g. `weak_topic:articles`. */
  key: string;
  type: RecommendationType;
  score: number;
  estimatedMinutes: number;
  target: RecommendationTarget;
  reasons: RecommendationReason[];
  /** Feature values that produced the score, kept for transparency and evaluation. */
  features: Record<string, number>;
}

export type DifficultyAdjustment = 'easier' | 'same' | 'harder';

export interface RecommendationResult {
  engineVersion: string;
  generatedAt: string;
  language: string;
  targetDifficulty: 1 | 2 | 3;
  difficultyAdjustment: DifficultyAdjustment;
  difficultyReason?: RecommendationReason;
  items: Recommendation[];
}

export interface StudyPlan {
  date: string;
  budgetMinutes: number;
  plannedMinutes: number;
  items: Array<Recommendation & { done: boolean }>;
  upcoming: Array<{ lessonId: string; title: string; level: string; moduleTitle: string }>;
}
