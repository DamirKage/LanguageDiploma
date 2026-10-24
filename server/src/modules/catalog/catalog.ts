import { CEFR_LEVELS, type CefrLevel, type Exercise, type LocalizedText } from '@linguapath/shared';
import { Course, CourseModule, Lesson, Test } from '../../models/content';

export interface CatalogData {
  courses: Array<{ id: string; level: CefrLevel; title: LocalizedText; description: LocalizedText }>;
  modules: Array<{ id: string; courseId: string; level: CefrLevel; title: LocalizedText; description: LocalizedText; order: number }>;
  lessons: Array<{
    id: string;
    key: string;
    moduleId: string;
    courseId: string;
    level: CefrLevel;
    title: LocalizedText;
    objective: LocalizedText;
    topic: string;
    order: number;
    pathIndex: number;
    estimatedMinutes: number;
    exerciseCount: number;
    exerciseTopics: string[];
    prerequisites: string[];
    wordCount: number;
  }>;
  tests: Array<{ id: string; kind: 'module' | 'lesson'; moduleId: string | null; lessonId: string | null; title: LocalizedText; exerciseCount: number; passPercent: number }>;
}

/** Published structure of one language, ordered as the recommended learning path. */
export async function loadCatalog(language: string): Promise<CatalogData> {
  const [courses, modules, lessons, tests] = await Promise.all([
    Course.find({ language, isPublished: true }).lean(),
    CourseModule.find({ language, isPublished: true }).sort({ order: 1 }).lean(),
    Lesson.find({ language, isPublished: true }).select('-theory').sort({ order: 1 }).lean(),
    Test.find({ language, isPublished: true, kind: { $in: ['module', 'lesson'] } }).select('kind module lesson title exercises passPercent').lean(),
  ]);
  const courseLevel = new Map(courses.map((c) => [String(c._id), c.level as CefrLevel]));
  const publishedModules = modules.filter((m) => courseLevel.has(String(m.course)));
  const moduleIndex = new Map(publishedModules.map((m) => [String(m._id), m]));
  const levelRank = (l: CefrLevel) => CEFR_LEVELS.indexOf(l);

  const visibleLessons = lessons
    .filter((l) => moduleIndex.has(String(l.module)))
    .sort((a, b) => {
      const ma = moduleIndex.get(String(a.module))!;
      const mb = moduleIndex.get(String(b.module))!;
      return levelRank(a.level as CefrLevel) - levelRank(b.level as CefrLevel) || ma.order - mb.order || a.order - b.order;
    });

  return {
    courses: courses
      .sort((a, b) => levelRank(a.level as CefrLevel) - levelRank(b.level as CefrLevel))
      .map((c) => ({ id: String(c._id), level: c.level as CefrLevel, title: c.title as LocalizedText, description: c.description as LocalizedText })),
    modules: publishedModules.map((m) => ({
      id: String(m._id),
      courseId: String(m.course),
      level: m.level as CefrLevel,
      title: m.title as LocalizedText,
      description: m.description as LocalizedText,
      order: m.order,
    })),
    lessons: visibleLessons.map((l, i) => {
      const exercises = l.exercises as Exercise[];
      return {
        id: String(l._id),
        key: l.key,
        moduleId: String(l.module),
        courseId: String(l.course),
        level: l.level as CefrLevel,
        title: l.title as LocalizedText,
        objective: l.objective as LocalizedText,
        topic: l.topic,
        order: l.order,
        pathIndex: i,
        estimatedMinutes: l.estimatedMinutes,
        exerciseCount: exercises.length,
        exerciseTopics: [...new Set(exercises.map((e) => e.topic))],
        prerequisites: (l.prerequisites ?? []).map(String),
        wordCount: (l.words ?? []).length,
      };
    }),
    tests: tests.map((t) => ({
      id: String(t._id),
      kind: t.kind as 'module' | 'lesson',
      moduleId: t.module ? String(t.module) : null,
      lessonId: t.lesson ? String(t.lesson) : null,
      title: t.title as LocalizedText,
      exerciseCount: (t.exercises as unknown[]).length,
      passPercent: t.passPercent,
    })),
  };
}
