import { Schema, model } from 'mongoose';
import { CEFR_LEVELS } from '@linguapath/shared';

const localized = { type: Schema.Types.Mixed, required: true };

const languageSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: localized,
    nativeName: { type: String, required: true, trim: true },
    ttsLocale: { type: String, required: true },
    specialChars: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Language = model('Language', languageSchema);

const topicSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: localized,
    kind: { type: String, enum: ['grammar', 'vocabulary', 'communication'], required: true },
  },
  { timestamps: true },
);
export const Topic = model('Topic', topicSchema);

const courseSchema = new Schema(
  {
    language: { type: String, required: true },
    level: { type: String, enum: CEFR_LEVELS, required: true },
    title: localized,
    description: { type: Schema.Types.Mixed, default: { ru: '' } },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);
courseSchema.index({ language: 1, level: 1 }, { unique: true });
export const Course = model('Course', courseSchema);

const moduleSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    language: { type: String, required: true },
    level: { type: String, enum: CEFR_LEVELS, required: true },
    title: localized,
    description: { type: Schema.Types.Mixed, default: { ru: '' } },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);
moduleSchema.index({ language: 1, level: 1, order: 1 });
export const CourseModule = model('Module', moduleSchema);

const lessonSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    language: { type: String, required: true },
    level: { type: String, enum: CEFR_LEVELS, required: true },
    title: localized,
    objective: localized,
    topic: { type: String, required: true },
    order: { type: Number, default: 0 },
    estimatedMinutes: { type: Number, default: 10, min: 1, max: 90 },
    prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }],
    theory: { type: [Schema.Types.Mixed], default: [] },
    words: [{ type: Schema.Types.ObjectId, ref: 'Word' }],
    /** Validated with `exerciseSchema` at the application level. */
    exercises: { type: [Schema.Types.Mixed], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);
lessonSchema.index({ language: 1, level: 1, order: 1 });
lessonSchema.index({ 'exercises.key': 1 });
export const Lesson = model('Lesson', lessonSchema);

const wordSchema = new Schema(
  {
    language: { type: String, required: true },
    term: { type: String, required: true, trim: true },
    translation: localized,
    partOfSpeech: { type: String, default: 'other' },
    gender: { type: String, default: null },
    example: { type: String, default: '' },
    exampleTranslation: { type: Schema.Types.Mixed, default: { ru: '' } },
    topic: { type: String, required: true },
    level: { type: String, enum: CEFR_LEVELS, default: 'A1' },
    audioUrl: { type: String, default: null },
    imageUrl: { type: String, default: null },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);
wordSchema.index({ language: 1, term: 1 }, { unique: true });
wordSchema.index({ language: 1, topic: 1 });
export const Word = model('Word', wordSchema);

const testSchema = new Schema(
  {
    kind: { type: String, enum: ['placement', 'module', 'lesson'], required: true },
    language: { type: String, required: true },
    level: { type: String, enum: [...CEFR_LEVELS, null], default: null },
    module: { type: Schema.Types.ObjectId, ref: 'Module', default: null },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null },
    title: localized,
    passPercent: { type: Number, default: 70, min: 1, max: 100 },
    /** Placement exercises additionally carry a `level` field. */
    exercises: { type: [Schema.Types.Mixed], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);
testSchema.index({ language: 1, kind: 1 });
testSchema.index({ module: 1 });
testSchema.index({ lesson: 1 });
export const Test = model('Test', testSchema);
