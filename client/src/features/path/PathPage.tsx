import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleDot, FileCheck2 } from 'lucide-react';
import type { PathLessonDTO, PathModuleDTO } from '@slog/shared';
import { catalogApi, learningApi, meApi } from '../../api/endpoints';
import { Button, ErrorState, errorMessage, PageLoader, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, qk, useActiveLanguage, useTopics } from '../../lib/queries';

function LessonRow({ lesson }: { lesson: PathLessonDTO }) {
  const { t, plural } = useI18n();
  const { topicTitle } = useTopics();
  return (
    <li className="route__stop" data-status={lesson.status}>
      <span className="route__marker" aria-hidden>
        {lesson.status === 'completed' ? <Check size={14} /> : lesson.status === 'in_progress' ? <CircleDot size={14} /> : null}
      </span>
      <Link to={`/lessons/${lesson.id}`} className="route__link">
        <span className="route__title">{lesson.title}</span>
        <span className="route__meta">
          {topicTitle(lesson.topic)} · {t('common.minutesShort', { n: lesson.estimatedMinutes })} · {plural('common.exercises', lesson.exerciseCount)}
        </span>
      </Link>
      <span className="route__status">
        {lesson.status === 'completed' && lesson.bestPercent !== null ? (
          <span className={`tag ${lesson.bestPercent >= 70 ? 'tag--ok' : 'tag--warn'}`}>{lesson.bestPercent}%</span>
        ) : (
          <span className="tag">{t(`path.status.${lesson.status}`)}</span>
        )}
      </span>
    </li>
  );
}

function ModuleTestRow({ module }: { module: PathModuleDTO }) {
  const i18n = useI18n();
  const { t } = i18n;
  const navigate = useNavigate();
  const toast = useToast();
  const start = useMutation({
    mutationFn: () => learningApi.startTest(module.test!.id),
    onSuccess: (attempt) => navigate(`/learn/${attempt.id}`),
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  if (!module.test) return null;
  const { bestPercent, passed } = module.test;
  return (
    <li className="route__stop route__stop--test" data-status={passed ? 'completed' : 'not_started'}>
      <span className="route__marker" aria-hidden>
        <FileCheck2 size={14} />
      </span>
      <div className="route__link">
        <span className="route__title">{t('path.moduleTest')}</span>
        <span className="route__meta">
          {bestPercent === null ? t('path.testNotTaken') : passed ? t('path.testPassed', { n: bestPercent }) : t('path.testFailed', { n: bestPercent })}
        </span>
      </div>
      <Button size="sm" onClick={() => start.mutate()} loading={start.isPending}>
        {t('recommendation.action.module_test')}
      </Button>
    </li>
  );
}

export default function PathPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const { code, name } = useActiveLanguage();
  const queryClient = useQueryClient();
  const toast = useToast();
  useTitle('path.title');
  const path = useQuery({ queryKey: qk.path(code ?? ''), queryFn: () => catalogApi.path(code!), enabled: !!code });
  const setLevel = useMutation({
    mutationFn: (level: Parameters<typeof meApi.setLevel>[1]) => meApi.setLevel(code!, level),
    onSuccess: () => {
      toast(t('path.levelChanged'));
      for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  if (path.isLoading || !code) return <PageLoader />;
  if (path.error) return <ErrorState error={path.error} onRetry={() => path.refetch()} />;
  const data = path.data!;

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{name}</p>
        <h1>{t('path.title')}</h1>
        <p className="page-head__lead">{t('path.lead')}</p>
      </header>

      <nav className="level-tabs" aria-label={t('common.level')}>
        {data.levels.map((level) => (
          <a key={level.level} href={`#level-${level.level}`} className="level-tabs__item" aria-current={level.level === data.currentLevel ? 'true' : undefined}>
            <span className="level-tabs__code">{level.level}</span>
            <span className="small muted">{t('path.lessonsDone', { done: level.completedLessons, total: level.totalLessons })}</span>
          </a>
        ))}
      </nav>

      {data.levels.map((level) => (
        <section key={level.level} id={`level-${level.level}`} className="level" aria-labelledby={`level-title-${level.level}`}>
          <header className="level__head">
            <div className="stack" style={{ '--gap': 'var(--s1)' } as React.CSSProperties}>
              <p className="eyebrow">
                {t(`levels.${level.level}`)}
                {level.level === data.currentLevel ? ` · ${t('path.current')}` : ''}
              </p>
              <h2 id={`level-title-${level.level}`} className="level__title">
                {level.title}
              </h2>
              <p className="muted small">{level.description}</p>
            </div>
            {level.level !== data.currentLevel ? (
              <Button size="sm" variant="ghost" onClick={() => setLevel.mutate(level.level)} loading={setLevel.isPending && setLevel.variables === level.level}>
                {t('path.setLevel')}
              </Button>
            ) : null}
          </header>
          {level.modules.map((module) => (
            <div key={module.id} className="module">
              <h3 className="module__title">{module.title}</h3>
              {module.description ? <p className="small muted">{module.description}</p> : null}
              <ol className="route">
                {module.lessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} />
                ))}
                <ModuleTestRow module={module} />
              </ol>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
