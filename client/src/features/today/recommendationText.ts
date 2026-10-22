import type { Recommendation, RecommendationReason } from '@slog/shared';
import type { Translator } from '../../i18n';

type Helpers = { topicTitle: (key: string) => string; languageName?: (code: string) => string };

/** Turns a machine-readable reason into a sentence in the interface language. */
export function reasonText(reason: RecommendationReason, i18n: Translator, helpers: Helpers): string {
  const { t, plural } = i18n;
  const key = `recommendation.reason.${reason.code}` as const;
  if (!('params' in reason)) return t(key);
  const p = reason.params as Record<string, string | number>;
  const params: Record<string, string | number> = { ...p };
  if (typeof p.topic === 'string') params.topic = helpers.topicTitle(p.topic);
  if (reason.code === 'reviews_due') params.count = plural('common.words', reason.params.count);
  if (reason.code === 'reviews_overdue') {
    params.count = plural('common.words', reason.params.count);
    params.days = plural('common.days', reason.params.days);
  }
  if (reason.code === 'low_topic_accuracy') params.answers = plural('common.answers', reason.params.answers);
  if (reason.code === 'recurring_error') {
    params.category = t(`errorCategories.${reason.params.category}`);
    params.count = plural('common.mistakes', reason.params.count);
  }
  if (reason.code === 'module_ready') params.lessons = plural('common.lessons', reason.params.lessons);
  if (reason.code === 'not_practiced_recently' || reason.code === 'returning_after_break') params.days = plural('common.days', reason.params.days);
  if (reason.code === 'goal_match') params.goal = i18n.tx(`goals.${reason.params.goal}`, reason.params.goal).toLowerCase();
  return t(key, params);
}

export function recommendationTitle(item: Recommendation, i18n: Translator, helpers: Helpers): string {
  const { t, plural } = i18n;
  const target = item.target;
  switch (item.type) {
    case 'review':
      return t('recommendation.title.review', { count: plural('common.words', target.reviewCount ?? 0) });
    case 'weak_topic':
    case 'topic_refresh':
      return t(`recommendation.title.${item.type}`, { topic: helpers.topicTitle(target.topic ?? '') });
    case 'module_test':
      return t('recommendation.title.module_test', { title: target.moduleTitle ?? '' });
    case 'level_up':
      return t('recommendation.title.level_up', { level: target.level ?? '' });
    case 'placement':
      return t('recommendation.title.placement');
    default:
      return t(`recommendation.title.${item.type}`, { title: target.lessonTitle ?? '' });
  }
}
