import type { Types } from 'mongoose';
import type { Exercise } from '@linguapath/shared';
import { Course, CourseModule, Language, Lesson, Test, Topic, Word } from '../models/content';
import { exerciseSchema } from '../modules/content/schemas';
import { finalizeExercise, ru, type LanguageSpec } from './builders';
import { english } from './content/en';
import { german } from './content/de';
import { kazakh } from './content/kk';
import { spanish } from './content/es';
import { turkish } from './content/tr';
import { TOPICS } from './topics';

export const LANGUAGES: LanguageSpec[] = [kazakh, english, turkish, german, spanish];

/** Number of exercises taken from each lesson for the module test and the lesson test. */
const MODULE_TEST_PER_LESSON = 3;
const LESSON_TEST_SIZE = 5;

function validate(exercise: Exercise, context: string): Exercise {
  const result = exerciseSchema.safeParse(exercise);
  if (!result.success) {
    throw new Error(`Invalid exercise ${exercise.key} in ${context}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return exercise;
}

/** Spreads selected exercises across types and avoids speaking tasks, which may be unsupported. */
function pickForTest(exercises: Exercise[], count: number): Exercise[] {
  const eligible = exercises.filter((e) => e.type !== 'speak' && e.type !== 'listen');
  const byType = new Map<string, Exercise[]>();
  for (const e of eligible) byType.set(e.type, [...(byType.get(e.type) ?? []), e]);
  const picked: Exercise[] = [];
  while (picked.length < count && [...byType.values()].some((l) => l.length)) {
    for (const list of byType.values()) {
      const next = list.shift();
      if (next && picked.length < count) picked.push(next);
    }
  }
  return picked;
}

export function buildLessonExercises(spec: LanguageSpec) {
  const out = new Map<string, Exercise[]>();
  for (const course of spec.courses) {
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        out.set(
          lesson.key,
          lesson.exercises.map((draft, i) => validate(finalizeExercise(draft, `${lesson.key}-${i + 1}`, lesson.topic), lesson.key)),
        );
      }
    }
  }
  return out;
}

export async function seedTopics() {
  for (const t of TOPICS) {
    await Topic.updateOne({ key: t.key }, { $set: { title: ru(t.title), kind: t.kind } }, { upsert: true });
  }
}

/** Idempotent: content is matched by stable keys so user progress keeps pointing at the same documents. */
export async function seedLanguage(spec: LanguageSpec) {
  await Language.updateOne(
    { code: spec.code },
    { $set: { name: ru(spec.name), nativeName: spec.nativeName, ttsLocale: spec.ttsLocale, specialChars: spec.specialChars, order: spec.order, isPublished: true } },
    { upsert: true },
  );
  const lessonExercises = buildLessonExercises(spec);
  let previousLesson: Types.ObjectId | null = null;

  for (const courseSpec of spec.courses) {
    const course = await Course.findOneAndUpdate(
      { language: spec.code, level: courseSpec.level },
      { $set: { title: ru(courseSpec.title), description: ru(courseSpec.description), isPublished: true } },
      { upsert: true, returnDocument: 'after' },
    );
    for (const [moduleIndex, moduleSpec] of courseSpec.modules.entries()) {
      const mod = await CourseModule.findOneAndUpdate(
        { course: course._id, order: moduleIndex + 1 },
        {
          $set: {
            language: spec.code,
            level: courseSpec.level,
            title: ru(moduleSpec.title),
            description: ru(moduleSpec.description),
            isPublished: true,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
      const moduleExercises: Exercise[] = [];
      for (const [lessonIndex, lessonSpec] of moduleSpec.lessons.entries()) {
        const wordIds: Types.ObjectId[] = [];
        for (const [term, translation, partOfSpeech, example, exampleTranslation, gender] of lessonSpec.words) {
          const word = await Word.findOneAndUpdate(
            { language: spec.code, term },
            {
              $set: {
                translation: ru(translation),
                partOfSpeech,
                gender: gender ?? null,
                example,
                exampleTranslation: ru(exampleTranslation),
                topic: lessonSpec.topic,
                level: courseSpec.level,
                isPublished: true,
              },
            },
            { upsert: true, returnDocument: 'after' },
          );
          wordIds.push(word._id);
        }
        const exercises = lessonExercises.get(lessonSpec.key)!;
        const lesson: { _id: Types.ObjectId } = await Lesson.findOneAndUpdate(
          { key: lessonSpec.key },
          {
            $set: {
              module: mod._id,
              course: course._id,
              language: spec.code,
              level: courseSpec.level,
              title: ru(lessonSpec.title),
              objective: ru(lessonSpec.objective),
              topic: lessonSpec.topic,
              order: lessonIndex + 1,
              estimatedMinutes: lessonSpec.minutes,
              prerequisites: previousLesson ? [previousLesson] : [],
              theory: lessonSpec.theory.map((b) => ({
                title: ru(b.title),
                body: ru(b.body),
                examples: (b.examples ?? []).map(([target, translation]) => ({ target, translation: ru(translation) })),
              })),
              words: wordIds,
              exercises,
              isPublished: true,
            },
          },
          { upsert: true, returnDocument: 'after' },
        );
        previousLesson = lesson._id;
        moduleExercises.push(...pickForTest(exercises, MODULE_TEST_PER_LESSON));

        await Test.updateOne(
          { kind: 'lesson', lesson: lesson._id },
          {
            $set: {
              language: spec.code,
              level: courseSpec.level,
              module: mod._id,
              title: ru(`Контрольный тест: ${lessonSpec.title}`),
              passPercent: 70,
              exercises: pickForTest(exercises, LESSON_TEST_SIZE).map((e) => ({ ...e, key: `${e.key}-lt` })),
              isPublished: true,
            },
          },
          { upsert: true },
        );
      }
      await Test.updateOne(
        { kind: 'module', module: mod._id },
        {
          $set: {
            language: spec.code,
            level: courseSpec.level,
            title: ru(`Итоговый тест модуля «${moduleSpec.title}»`),
            passPercent: 70,
            exercises: moduleExercises.map((e) => ({ ...e, key: `${e.key}-mt` })),
            isPublished: true,
          },
        },
        { upsert: true },
      );
    }
  }

  const placement = spec.placement.map((item, i) =>
    validate({ ...finalizeExercise(item.exercise, `${spec.code}-placement-${i + 1}`, 'placement'), level: item.level }, `${spec.code} placement`),
  );
  await Test.updateOne(
    { kind: 'placement', language: spec.code },
    { $set: { title: ru('Входное тестирование'), passPercent: 70, exercises: placement, isPublished: true, level: null } },
    { upsert: true },
  );
}

export async function seedContent() {
  await seedTopics();
  for (const spec of LANGUAGES) await seedLanguage(spec);
}
