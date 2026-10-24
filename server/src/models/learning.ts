import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CEFR_LEVELS, ERROR_CATEGORIES, EXERCISE_TYPES, SKILLS } from '@linguapath/shared';

const verdicts = ['correct', 'almost', 'incorrect', 'skipped'];

const attemptItemSchema = new Schema(
  {
    /** Snapshot of the exercise at the time the attempt started, so later edits do not rewrite history. */
    exercise: { type: Schema.Types.Mixed, required: true },
    sourceLesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null },
    level: { type: String, enum: [...CEFR_LEVELS, null], default: null },
    isRetry: { type: Boolean, default: false },
    /** Shuffle seed so the learner sees the same option order after reloading. */
    seed: { type: Number, required: true },
    answer: { type: Schema.Types.Mixed, default: null },
    verdict: { type: String, enum: [...verdicts, null], default: null },
    points: { type: Number, default: 0 },
    timeMs: { type: Number, default: 0 },
    answeredAt: { type: Date, default: null },
  },
  { _id: false },
);

const attemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['lesson', 'test', 'practice', 'placement'], required: true },
    language: { type: String, required: true },
    level: { type: String, enum: [...CEFR_LEVELS, null], default: null },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null },
    test: { type: Schema.Types.ObjectId, ref: 'Test', default: null },
    title: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    feedbackMode: { type: String, enum: ['immediate', 'deferred'], default: 'immediate' },
    position: { type: Number, default: 0 },
    items: { type: [attemptItemSchema], default: [] },
    practiceTopic: { type: String, default: null },
    recommendationKey: { type: String, default: null },
    placement: {
      currentLevel: { type: String, enum: [...CEFR_LEVELS, null], default: null },
      estimatedLevel: { type: String, enum: [...CEFR_LEVELS, null], default: null },
      finished: { type: Boolean, default: false },
    },
    result: {
      percent: Number,
      points: Number,
      maxPoints: Number,
      correct: Number,
      almost: Number,
      incorrect: Number,
      skipped: Number,
      total: Number,
      passed: Boolean,
      wordsAdded: Number,
    },
    startedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0 },
  },
  { timestamps: true },
);
attemptSchema.index({ user: 1, status: 1, kind: 1, lesson: 1 });
attemptSchema.index({ user: 1, language: 1, completedAt: -1 });
attemptSchema.index({ test: 1, status: 1 });

export const Attempt = model('Attempt', attemptSchema);
export type AttemptData = InferSchemaType<typeof attemptSchema>;
export type AttemptDocument = HydratedDocument<AttemptData>;

/** One row per answered exercise; the single source for accuracy and error analytics. */
const answerEventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    language: { type: String, required: true },
    attempt: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
    attemptKind: { type: String, required: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null },
    exerciseKey: { type: String, required: true },
    type: { type: String, enum: EXERCISE_TYPES, required: true },
    skill: { type: String, enum: SKILLS, required: true },
    topic: { type: String, required: true },
    category: { type: String, enum: ERROR_CATEGORIES, required: true },
    difficulty: { type: Number, default: 1 },
    verdict: { type: String, enum: verdicts, required: true },
    isRetry: { type: Boolean, default: false },
    prompt: { type: String, default: '' },
    given: { type: String, default: '' },
    expected: { type: String, default: '' },
    timeMs: { type: Number, default: 0 },
    at: { type: Date, required: true },
  },
  { timestamps: false },
);
answerEventSchema.index({ user: 1, language: 1, at: -1 });
answerEventSchema.index({ user: 1, language: 1, topic: 1, at: -1 });
answerEventSchema.index({ language: 1, exerciseKey: 1 });

export const AnswerEvent = model('AnswerEvent', answerEventSchema);

const lessonProgressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    language: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    bestPercent: { type: Number, default: null },
    lastPercent: { type: Number, default: null },
    attempts: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
  },
  { timestamps: true },
);
lessonProgressSchema.index({ user: 1, lesson: 1 }, { unique: true });
lessonProgressSchema.index({ user: 1, language: 1 });
export const LessonProgress = model('LessonProgress', lessonProgressSchema);

const reviewItemSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    word: { type: Schema.Types.ObjectId, ref: 'Word', required: true },
    language: { type: String, required: true },
    easeFactor: { type: Number, default: 2.5 },
    intervalDays: { type: Number, default: 0 },
    repetitions: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    dueAt: { type: Date, required: true },
    lastReviewedAt: { type: Date, default: null },
    introducedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);
reviewItemSchema.index({ user: 1, word: 1 }, { unique: true });
reviewItemSchema.index({ user: 1, language: 1, dueAt: 1 });
export const ReviewItem = model('ReviewItem', reviewItemSchema);

const reviewLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  word: { type: Schema.Types.ObjectId, ref: 'Word', required: true },
  language: { type: String, required: true },
  at: { type: Date, required: true },
  mode: { type: String, enum: ['flip', 'typed', 'choice'], required: true },
  quality: { type: Number, min: 0, max: 5, required: true },
  verdict: { type: String, enum: verdicts, required: true },
  prevIntervalDays: Number,
  newIntervalDays: Number,
  prevEase: Number,
  newEase: Number,
  overdueDays: Number,
  timeMs: { type: Number, default: 0 },
});
reviewLogSchema.index({ user: 1, language: 1, at: -1 });
export const ReviewLog = model('ReviewLog', reviewLogSchema);

const recommendationSnapshotSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    language: { type: String, required: true },
    engineVersion: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    targetDifficulty: { type: Number, required: true },
    difficultyAdjustment: { type: String, required: true },
    difficultyReason: { type: Schema.Types.Mixed, default: null },
    items: { type: [Schema.Types.Mixed], default: [] },
    followedKeys: { type: [String], default: [] },
  },
  { timestamps: false },
);
recommendationSnapshotSchema.index({ user: 1, language: 1, generatedAt: -1 });
export const RecommendationSnapshot = model('RecommendationSnapshot', recommendationSnapshotSchema);

const dictionaryCacheSchema = new Schema({
  key: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
});
dictionaryCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });
export const DictionaryCache = model('DictionaryCache', dictionaryCacheSchema);

/** The plan generated for a learner's local calendar day, kept stable through the day. */
const dailyPlanSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    language: { type: String, required: true },
    date: { type: String, required: true },
    budgetMinutes: { type: Number, required: true },
    items: { type: [Schema.Types.Mixed], default: [] },
    engineVersion: { type: String, required: true },
  },
  { timestamps: true },
);
dailyPlanSchema.index({ user: 1, language: 1, date: 1 }, { unique: true });
export const DailyPlan = model('DailyPlan', dailyPlanSchema);
