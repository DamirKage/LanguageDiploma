import type {
  AdminStatsDTO,
  AdminUserDTO,
  AnswerResultDTO,
  AttemptHistoryItemDTO,
  AttemptStateDTO,
  AttemptSummaryDTO,
  AuthResponse,
  CefrLevel,
  EnrollmentDTO,
  ErrorAnalyticsDTO,
  ExerciseAnswer,
  LanguageDTO,
  LearningGoal,
  LearningPathDTO,
  LessonDetailDTO,
  Paginated,
  ProgressOverviewDTO,
  RecommendationResult,
  ReviewAnswer,
  ReviewAnswerResultDTO,
  ReviewQueueDTO,
  SrsAnalyticsDTO,
  StudyPlan,
  TimelinePointDTO,
  TopicAnalyticsDTO,
  TopicDTO,
  UserDTO,
  VocabularyItemDTO,
} from '@linguapath/shared';
import { api } from './client';

export const authApi = {
  login: (data: { email: string; password: string }) => api<AuthResponse>({ method: 'POST', url: '/auth/login', data }),
  register: (data: { email: string; password: string; name: string; timezone?: string }) =>
    api<AuthResponse>({ method: 'POST', url: '/auth/register', data }),
  logout: () => api<void>({ method: 'POST', url: '/auth/logout', headers: { 'X-Requested-With': 'linguapath' } }),
  forgot: (email: string) => api<{ ok: true; devResetUrl?: string }>({ method: 'POST', url: '/auth/forgot-password', data: { email } }),
  reset: (token: string, password: string) => api<{ ok: true }>({ method: 'POST', url: '/auth/reset-password', data: { token, password } }),
};

export interface ProfilePatch {
  name?: string;
  timezone?: string;
  dailyMinutes?: number;
  goals?: LearningGoal[];
  activeLanguage?: string;
  onboarded?: true;
}

export const meApi = {
  get: () => api<UserDTO>({ url: '/me' }),
  update: (data: ProfilePatch) => api<UserDTO>({ method: 'PATCH', url: '/me', data }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<AuthResponse>({ method: 'PATCH', url: '/me/password', data: { currentPassword, newPassword } }),
  deleteAccount: (password: string) => api<void>({ method: 'DELETE', url: '/me', data: { password } }),
  enrollments: () => api<EnrollmentDTO[]>({ url: '/me/enrollments' }),
  enroll: (language: string, level?: CefrLevel) => api<EnrollmentDTO>({ method: 'POST', url: '/me/enrollments', data: { language, level } }),
  setLevel: (language: string, level: CefrLevel) => api<EnrollmentDTO>({ method: 'PATCH', url: `/me/enrollments/${language}`, data: { level } }),
  history: (params: { language?: string; page?: number; pageSize?: number }) =>
    api<Paginated<AttemptHistoryItemDTO>>({ url: '/me/attempts', params }),
};

export const catalogApi = {
  languages: () => api<LanguageDTO[]>({ url: '/languages' }),
  topics: () => api<TopicDTO[]>({ url: '/topics' }),
  path: (language: string) => api<LearningPathDTO>({ url: `/languages/${language}/path` }),
  lesson: (id: string) => api<LessonDetailDTO>({ url: `/lessons/${id}` }),
  vocabulary: (language: string, params: { scope?: 'mine' | 'all'; q?: string; topic?: string; state?: string }) =>
    api<VocabularyItemDTO[]>({ url: `/languages/${language}/vocabulary`, params }),
  lookup: (language: string, term: string) =>
    api<{ term: string; sourceUrl: string; entries: Array<{ partOfSpeech: string; definitions: Array<{ text: string; examples: string[] }> }> }>({
      url: '/dictionary/lookup',
      params: { language, term },
    }),
};

export const learningApi = {
  startLesson: (lessonId: string, recommendationKey?: string) =>
    api<AttemptStateDTO>({ method: 'POST', url: `/lessons/${lessonId}/attempts`, data: { recommendationKey } }),
  startTest: (testId: string, recommendationKey?: string) =>
    api<AttemptStateDTO>({ method: 'POST', url: `/tests/${testId}/attempts`, data: { recommendationKey } }),
  startPlacement: (language: string) => api<AttemptStateDTO>({ method: 'POST', url: `/placement/${language}/attempts` }),
  skipPlacement: (language: string, level: CefrLevel) => api<{ level: CefrLevel }>({ method: 'POST', url: `/placement/${language}/skip`, data: { level } }),
  startPractice: (language: string, topic?: string, recommendationKey?: string) =>
    api<AttemptStateDTO>({ method: 'POST', url: '/practice/attempts', data: { language, topic, recommendationKey } }),
  attempt: (id: string) => api<AttemptStateDTO>({ url: `/attempts/${id}` }),
  answer: (id: string, itemIndex: number, answer: ExerciseAnswer, timeMs: number) =>
    api<AnswerResultDTO>({ method: 'POST', url: `/attempts/${id}/answers`, data: { itemIndex, answer, timeMs } }),
  complete: (id: string) => api<AttemptSummaryDTO>({ method: 'POST', url: `/attempts/${id}/complete` }),
  summary: (id: string) => api<AttemptSummaryDTO>({ url: `/attempts/${id}/summary` }),
};

export const reviewApi = {
  queue: (language: string, mode: 'auto' | 'flip') => api<ReviewQueueDTO>({ url: `/reviews/${language}/queue`, params: { mode } }),
  answer: (wordId: string, answer: ReviewAnswer) => api<ReviewAnswerResultDTO>({ method: 'POST', url: `/reviews/${wordId}/answer`, data: answer }),
};

export const personalApi = {
  recommendations: (language: string) => api<RecommendationResult>({ url: `/me/recommendations/${language}` }),
  plan: (language: string) => api<StudyPlan>({ url: `/me/plan/${language}` }),
  rebuildPlan: (language: string) => api<StudyPlan>({ method: 'POST', url: `/me/plan/${language}/rebuild` }),
};

export const analyticsApi = {
  overview: (language: string) => api<ProgressOverviewDTO>({ url: `/me/analytics/${language}/overview` }),
  timeline: (language: string, days = 30) => api<TimelinePointDTO[]>({ url: `/me/analytics/${language}/timeline`, params: { days } }),
  topics: (language: string) => api<TopicAnalyticsDTO[]>({ url: `/me/analytics/${language}/topics` }),
  errors: (language: string) => api<ErrorAnalyticsDTO>({ url: `/me/analytics/${language}/errors` }),
  srs: (language: string) => api<SrsAnalyticsDTO>({ url: `/me/analytics/${language}/srs` }),
};

export const adminApi = {
  stats: () => api<AdminStatsDTO>({ url: '/admin/stats' }),
  users: (params: { page?: number; q?: string }) => api<Paginated<AdminUserDTO>>({ url: '/admin/users', params }),
  updateUser: (id: string, data: { role?: 'user' | 'admin'; isBlocked?: boolean }) => api({ method: 'PATCH', url: `/admin/users/${id}`, data }),
  list: <T>(resource: string, params?: Record<string, unknown>) => api<T>({ url: `/admin/${resource}`, params }),
  get: <T>(resource: string, id: string) => api<T>({ url: `/admin/${resource}/${id}` }),
  create: <T>(resource: string, data: unknown) => api<T>({ method: 'POST', url: `/admin/${resource}`, data }),
  update: <T>(resource: string, id: string, data: unknown) => api<T>({ method: 'PATCH', url: `/admin/${resource}/${id}`, data }),
  replace: <T>(resource: string, id: string, data: unknown) => api<T>({ method: 'PUT', url: `/admin/${resource}/${id}`, data }),
  remove: (resource: string, id: string) => api<void>({ method: 'DELETE', url: `/admin/${resource}/${id}` }),
  publishLesson: (id: string, isPublished: boolean) => api({ method: 'PATCH', url: `/admin/lessons/${id}/publication`, data: { isPublished } }),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<{ url: string; mimeType: string; size: number }>({ method: 'POST', url: '/admin/media', data: form });
  },
  media: () => api<Array<{ name: string; url: string; size: number; uploadedAt: string }>>({ url: '/admin/media' }),
};
