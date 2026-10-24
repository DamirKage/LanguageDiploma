import { useQuery } from '@tanstack/react-query';
import type { LanguageDTO } from '@linguapath/shared';
import { catalogApi, meApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';

export const qk = {
  languages: ['languages'] as const,
  topics: ['topics'] as const,
  enrollments: ['enrollments'] as const,
  path: (lang: string) => ['path', lang] as const,
  lesson: (id: string) => ['lesson', id] as const,
  plan: (lang: string) => ['plan', lang] as const,
  recommendations: (lang: string) => ['recommendations', lang] as const,
  reviewQueue: (lang: string, mode: string) => ['reviews', lang, mode] as const,
  vocabulary: (lang: string, params: object) => ['vocabulary', lang, params] as const,
  analytics: (lang: string, part: string) => ['analytics', lang, part] as const,
  history: (lang: string, page: number) => ['history', lang, page] as const,
};

/** Query keys whose data changes after any learning activity. */
export const LEARNING_KEYS = [['plan'], ['recommendations'], ['path'], ['analytics'], ['reviews'], ['vocabulary'], ['history'], ['enrollments'], ['lesson']];

export function useLanguages() {
  return useQuery({ queryKey: qk.languages, queryFn: catalogApi.languages, staleTime: 10 * 60_000 });
}

export function useTopics() {
  const query = useQuery({ queryKey: qk.topics, queryFn: catalogApi.topics, staleTime: 30 * 60_000 });
  const titles = new Map((query.data ?? []).map((t) => [t.key, t.title]));
  return { ...query, topicTitle: (key: string) => titles.get(key) ?? key };
}

export function useEnrollments() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.enrollments, queryFn: meApi.enrollments, enabled: status === 'authenticated' });
}

/** The language the learner is currently studying, with its metadata. */
export function useActiveLanguage(): { code: string | null; language: LanguageDTO | null; name: string } {
  const { user } = useAuth();
  const { data: languages } = useLanguages();
  const i18n = useI18n();
  const code = user?.activeLanguage ?? null;
  const language = languages?.find((l) => l.code === code) ?? null;
  return { code, language, name: code ? i18n.tx(`languages.${code}`, language?.name ?? code) : '' };
}

export function useLanguageName() {
  const i18n = useI18n();
  const { data: languages } = useLanguages();
  return (code: string) => i18n.tx(`languages.${code}`, languages?.find((l) => l.code === code)?.name ?? code);
}
