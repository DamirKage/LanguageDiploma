import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { CefrLevel, Recommendation } from '@slog/shared';
import { learningApi, meApi } from '../../api/endpoints';
import { errorMessage, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS } from '../../lib/queries';

/** Starts the activity behind a recommendation and opens it. */
export function useStartActivity(language: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const i18n = useI18n();

  return useMutation({
    mutationFn: async (item: Recommendation) => {
      const key = item.key;
      switch (item.type) {
        case 'placement':
          return { attempt: await learningApi.startPlacement(language) };
        case 'review':
          return { route: '/review/session' };
        case 'resume':
          return { route: `/learn/${item.target.attemptId}` };
        case 'next_lesson':
        case 'retry_lesson':
          return { attempt: await learningApi.startLesson(item.target.lessonId!, key) };
        case 'module_test':
          return { attempt: await learningApi.startTest(item.target.testId!, key) };
        case 'weak_topic':
        case 'topic_refresh':
          return { attempt: await learningApi.startPractice(language, item.target.topic, key) };
        case 'level_up': {
          const level = (item.target.level as CefrLevel | undefined) ?? null;
          if (level) await meApi.setLevel(language, level);
          return { route: '/path', message: i18n.t('recommendation.levelUpDone', { level: level ?? '' }) };
        }
      }
    },
    onSuccess: (result) => {
      if (!result) return;
      if (result.message) {
        toast(result.message);
        for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
      }
      if ('attempt' in result && result.attempt) navigate(`/learn/${result.attempt.id}`);
      else if (result.route) navigate(result.route);
    },
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
}
