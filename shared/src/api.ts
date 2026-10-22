import type { CefrLevel, ErrorCategory, ExerciseType, LearningGoal, Role, Skill } from './constants';
import type { AnswerFeedback, PublicExerciseView, Verdict } from './content';
import type { Recommendation } from './recommendations';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; code: string; message: string }>;
  };
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  uiLocale: string;
  timezone: string;
  dailyMinutes: number;
  goals: LearningGoal[];
  activeLanguage: string | null;
  onboarded: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
  expiresIn: number;
}

export interface EnrollmentDTO {
  language: string;
  level: CefrLevel;
  placementLevel: CefrLevel | null;
  placementAt: string | null;
  startedAt: string;
  lastActivityAt: string | null;
}

export interface LanguageDTO {
  code: string;
  name: string;
  nativeName: string;
  ttsLocale: string;
  specialChars: string[];
  levels: CefrLevel[];
  lessonCount: number;
  isPublished: boolean;
}

export interface TopicDTO {
  key: string;
  title: string;
  kind: 'grammar' | 'vocabulary' | 'communication';
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface PathLessonDTO {
  id: string;
  key: string;
  title: string;
  objective: string;
  topic: string;
  estimatedMinutes: number;
  exerciseCount: number;
  status: LessonStatus;
  bestPercent: number | null;
  attempts: number;
  resumeAttemptId: string | null;
  testId: string | null;
}

export interface PathModuleDTO {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: PathLessonDTO[];
  test: { id: string; title: string; bestPercent: number | null; passed: boolean } | null;
}

export interface PathLevelDTO {
  level: CefrLevel;
  courseId: string;
  title: string;
  description: string;
  modules: PathModuleDTO[];
  completedLessons: number;
  totalLessons: number;
}

export interface LearningPathDTO {
  language: string;
  currentLevel: CefrLevel | null;
  levels: PathLevelDTO[];
}

export interface WordDTO {
  id: string;
  language: string;
  term: string;
  translation: string;
  partOfSpeech: string;
  gender?: string | null;
  example: string;
  exampleTranslation: string;
  topic: string;
  level: CefrLevel;
  audioUrl?: string | null;
  imageUrl?: string | null;
}

export type SrsState = 'new' | 'learning' | 'review' | 'mastered' | 'leech';

export interface VocabularyItemDTO extends WordDTO {
  srs: {
    state: SrsState;
    dueAt: string;
    intervalDays: number;
    repetitions: number;
    lapses: number;
    easeFactor: number;
  } | null;
}

export interface TheoryBlockDTO {
  title: string;
  body: string;
  examples: Array<{ target: string; translation: string }>;
}

export interface LessonDetailDTO {
  id: string;
  key: string;
  language: string;
  level: CefrLevel;
  title: string;
  objective: string;
  topic: string;
  moduleTitle: string;
  estimatedMinutes: number;
  exerciseCount: number;
  theory: TheoryBlockDTO[];
  words: WordDTO[];
  status: LessonStatus;
  bestPercent: number | null;
  resumeAttemptId: string | null;
  testId: string | null;
}

export type AttemptKind = 'lesson' | 'test' | 'practice' | 'placement';

export interface AttemptStateDTO {
  id: string;
  kind: AttemptKind;
  title: string;
  language: string;
  level: CefrLevel | null;
  status: 'in_progress' | 'completed';
  feedbackMode: 'immediate' | 'deferred';
  position: number;
  total: number;
  answered: number;
  current: (PublicExerciseView & { itemIndex: number; isRetry: boolean }) | null;
  lessonId: string | null;
}

export interface AnswerResultDTO {
  feedback: AnswerFeedback | null;
  state: AttemptStateDTO;
}

export interface TopicResult {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export interface AttemptReviewItem {
  itemIndex: number;
  type: ExerciseType;
  topic: string;
  prompt: string;
  given: string;
  expected: string;
  verdict: Verdict;
  explanation: string;
}

export interface AttemptSummaryDTO {
  id: string;
  kind: AttemptKind;
  title: string;
  language: string;
  level: CefrLevel | null;
  lessonId: string | null;
  testId: string | null;
  completedAt: string;
  percent: number;
  points: number;
  maxPoints: number;
  correct: number;
  almost: number;
  incorrect: number;
  skipped: number;
  total: number;
  durationSec: number;
  passed: boolean;
  byTopic: TopicResult[];
  byCategory: Array<{ category: ErrorCategory; count: number }>;
  strengths: string[];
  weaknesses: string[];
  wordsAdded: number;
  review: AttemptReviewItem[];
  placement?: {
    estimatedLevel: CefrLevel;
    perLevel: Array<{ level: CefrLevel; correct: number; total: number }>;
  };
  next: Recommendation | null;
}

export interface AttemptHistoryItemDTO {
  id: string;
  kind: AttemptKind;
  title: string;
  language: string;
  level: CefrLevel | null;
  percent: number;
  points: number;
  passed: boolean;
  completedAt: string;
  durationSec: number;
}

export type ReviewMode = 'choice' | 'typed' | 'flip';

export interface ReviewCardDTO {
  wordId: string;
  term: string;
  translation: string;
  partOfSpeech: string;
  gender?: string | null;
  example: string;
  exampleTranslation: string;
  audioUrl?: string | null;
  mode: ReviewMode;
  options?: string[];
  state: SrsState;
  isNew: boolean;
}

export interface ReviewQueueDTO {
  language: string;
  dueCount: number;
  newCount: number;
  cards: ReviewCardDTO[];
}

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type ReviewAnswer =
  | { mode: 'flip'; grade: ReviewGrade }
  | { mode: 'typed'; text: string; timeMs?: number }
  | { mode: 'choice'; option: string; timeMs?: number };

export interface ReviewAnswerResultDTO {
  verdict: Verdict;
  quality: number;
  expected: string;
  nextDueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface ProgressOverviewDTO {
  language: string;
  level: CefrLevel | null;
  lessons: { completed: number; total: number; inLevel: { completed: number; total: number } };
  words: { learned: number; inReview: number; mastered: number; dueToday: number };
  tests: { taken: number; passed: number; averagePercent: number | null };
  accuracy: { overall: number | null; last7Days: number | null; answers: number };
  rhythm: { activeDaysLast28: number; minutesLast7: number; lastActiveAt: string | null; daysSinceLastActivity: number | null };
}

export interface TimelinePointDTO {
  date: string;
  answers: number;
  correct: number;
  accuracy: number | null;
  minutes: number;
  reviews: number;
}

export interface TopicAnalyticsDTO {
  topic: string;
  answers: number;
  accuracy: number;
  recentAccuracy: number | null;
  previousAccuracy: number | null;
  lastPracticedAt: string | null;
  enoughData: boolean;
}

export interface ErrorAnalyticsDTO {
  byCategory: Array<{ category: ErrorCategory; errors: number; answers: number; rate: number }>;
  byExerciseType: Array<{ type: ExerciseType; errors: number; answers: number; rate: number }>;
  bySkill: Array<{ skill: Skill; errors: number; answers: number; rate: number }>;
  recent: Array<{
    at: string;
    topic: string;
    category: ErrorCategory;
    type: ExerciseType;
    prompt: string;
    given: string;
    expected: string;
  }>;
}

export interface SrsAnalyticsDTO {
  dueToday: number;
  overdue: number;
  forecast: Array<{ date: string; count: number }>;
  retention30d: number | null;
  reviews30d: number;
  states: Record<SrsState, number>;
  leeches: Array<{ wordId: string; term: string; translation: string; lapses: number }>;
}

export interface ActivityItemDTO {
  id: string;
  type: string;
  at: string;
  language: string;
  title: string;
  percent: number | null;
  durationSec: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminStatsDTO {
  users: { total: number; active7d: number; active30d: number; newLast30d: number };
  enrollmentsByLanguage: Array<{ language: string; count: number }>;
  completionsByDay: Array<{ date: string; lessons: number; tests: number; reviews: number }>;
  averageScoreByLanguageLevel: Array<{ language: string; level: string; averagePercent: number; attempts: number }>;
  hardestTopics: Array<{ language: string; topic: string; accuracy: number; answers: number; learners: number }>;
  hardestExercises: Array<{ key: string; lessonTitle: string; accuracy: number; answers: number }>;
  content: { languages: number; courses: number; lessons: number; words: number; tests: number };
}

export interface AdminUserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  isBlocked: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  languages: string[];
  lessonsCompleted: number;
}
