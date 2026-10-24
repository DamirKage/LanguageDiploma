import type { LearningGoal, RecommendationType } from '@linguapath/shared';

/**
 * Weights of the scoring model. Every candidate activity receives
 *   score = prior[type] + Σ weight[f] · feature[f] − fatigue
 * where each feature is normalised to [0, 1]. Changing these numbers changes the
 * ranking without touching the engine code; the evaluation script reports how.
 */
export interface EngineConfig {
  weights: {
    need: number;
    urgency: number;
    progress: number;
    momentum: number;
    trend: number;
    goal: number;
    fatigue: number;
  };
  prior: Record<RecommendationType, number>;
  thresholds: {
    /** Answers on a topic before its accuracy is trusted. */
    minEvidence: number;
    /** Number of most recent answers that define a topic's current accuracy. */
    recentWindow: number;
    /** Smoothed accuracy below which a topic is considered weak. */
    weakAccuracy: number;
    /** Prior accuracy and its pseudo-count for Bayesian smoothing. */
    priorAccuracy: number;
    priorStrength: number;
    retryLessonBelow: number;
    refreshAfterDays: number;
    highAccuracy: number;
    lowAccuracy: number;
    /** Drop (in percentage points) between topic sessions that counts as a declining trend. */
    trendDrop: number;
    returningAfterDays: number;
    maxItems: number;
  };
  perTypeLimit: Partial<Record<RecommendationType, number>>;
  goalTopics: Record<LearningGoal, { topics?: string[]; kinds?: Array<'grammar' | 'vocabulary' | 'communication'> }>;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  weights: { need: 1.0, urgency: 0.9, progress: 0.7, momentum: 0.8, trend: 0.35, goal: 0.15, fatigue: 0.08 },
  prior: {
    placement: 1.5,
    resume: 0.3,
    review: 0.15,
    next_lesson: 0.2,
    weak_topic: 0.1,
    retry_lesson: 0.05,
    module_test: 0.15,
    topic_refresh: 0,
    level_up: 0.3,
  },
  thresholds: {
    minEvidence: 4,
    recentWindow: 12,
    weakAccuracy: 0.7,
    priorAccuracy: 0.75,
    priorStrength: 3,
    retryLessonBelow: 70,
    refreshAfterDays: 10,
    highAccuracy: 0.85,
    lowAccuracy: 0.6,
    trendDrop: 15,
    returningAfterDays: 4,
    maxItems: 6,
  },
  perTypeLimit: { weak_topic: 2, retry_lesson: 1, topic_refresh: 1, next_lesson: 1, module_test: 1, resume: 2 },
  goalTopics: {
    travel: { topics: ['travel', 'food', 'numbers', 'greetings', 'introductions'] },
    conversation: { kinds: ['communication'] },
    work: { topics: ['introductions', 'opinions', 'numbers', 'hypotheticals', 'past_events'] },
    study: { kinds: ['grammar'] },
    culture: { topics: ['family', 'daily_life', 'past_events', 'food'] },
    exam: { kinds: ['grammar', 'vocabulary'] },
  },
};
