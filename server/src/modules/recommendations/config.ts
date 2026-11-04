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
    /** Accuracy the `need` feature is measured from (need = 0 at and above it). */
    needCeiling: number;
    /** Width of the accuracy range over which `need` grows from 0 to 1. */
    needRange: number;
  };
  /**
   * Assumed forgetting curve: an estimate of a topic's mastery decays towards
   * `floor` with the given half-life once `graceDays` have passed since practice.
   * The engine only sees answers, so a topic that was fine weeks ago is treated
   * as possibly forgotten instead of as still mastered.
   */
  forgetting: { halfLifeDays: number; graceDays: number; floor: number };
  /**
   * Mastery gating of new material: the `progress` feature of the next lesson is
   * reduced by `remedialGate × need` of the weakest detected topic, so a clearly
   * weak topic is consolidated before new material, a mildly weak one is not.
   */
  remedialGate: number;
  /**
   * Progression pressure: after `graceDays` without a newly completed lesson the
   * next lesson gains urgency, reaching the maximum after `fullDays`.
   */
  progression: { graceDays: number; fullDays: number };
  /** Daily-plan composition (see plan.ts). */
  plan: {
    /** Share of the daily budget that reviews may take. */
    reviewShare: number;
    /** How many activities of a remedial type fit in one day. */
    remedialLimit: Partial<Record<RecommendationType, number>>;
  };
  perTypeLimit: Partial<Record<RecommendationType, number>>;
  goalTopics: Record<LearningGoal, { topics?: string[]; kinds?: Array<'grammar' | 'vocabulary' | 'communication'> }>;
}

/** Average time of one flashcard review, minutes. */
export const REVIEW_MINUTES_PER_CARD = 0.3;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  weights: { need: 1.0, urgency: 0.9, progress: 0.7, momentum: 0.8, trend: 0.35, goal: 0.15, fatigue: 0.08 },
  prior: {
    placement: 1.5,
    resume: 0.3,
    review: 0.15,
    next_lesson: 0.2,
    weak_topic: 0.15,
    retry_lesson: 0.05,
    module_test: 0.15,
    topic_refresh: 0.15,
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
    needCeiling: 0.85,
    needRange: 0.4,
  },
  forgetting: { halfLifeDays: 7, graceDays: 1, floor: 0.4 },
  remedialGate: 0.6,
  progression: { graceDays: 2, fullDays: 7 },
  plan: { reviewShare: 0.5, remedialLimit: { weak_topic: 2, topic_refresh: 2, retry_lesson: 1 } },
  perTypeLimit: { weak_topic: 2, retry_lesson: 1, topic_refresh: 2, next_lesson: 1, module_test: 1, resume: 2 },
  goalTopics: {
    travel: { topics: ['travel', 'food', 'numbers', 'greetings', 'introductions'] },
    conversation: { kinds: ['communication'] },
    work: { topics: ['introductions', 'opinions', 'numbers', 'hypotheticals', 'past_events'] },
    study: { kinds: ['grammar'] },
    culture: { topics: ['family', 'daily_life', 'past_events', 'food'] },
    exam: { kinds: ['grammar', 'vocabulary'] },
  },
};
