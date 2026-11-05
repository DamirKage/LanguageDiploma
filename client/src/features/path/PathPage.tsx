import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2 } from 'lucide-react';
import { TEST_PASS_PERCENT, type PathLessonDTO, type PathModuleDTO } from '@linguapath/shared';
import { catalogApi, learningApi, meApi } from '../../api/endpoints';
import { Button, ErrorState, errorMessage, PageLoader, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, qk, useActiveLanguage, useTopics } from '../../lib/queries';

function LessonRow({ lesson, index }: { lesson: PathLessonDTO; index: number }) {
  const { t, plural } = useI18n();
  const { topicTitle } = useTopics();
  return (
    <tr data-status={lesson.status} style={{ '--i': index } as React.CSSProperties}>
      <td className="syllabus__num">{index}</td>
      <td>
        <Link to={`/lessons/${lesson.id}`} className="syllabus__title">
          {lesson.title}
        </Link>
        <div className="caption">{lesson.objective}</div>
      </td>
      <td className="small">{topicTitle(lesson.topic)}</td>
      <td className="small syllabus__nowrap">
        {t('common.minutesShort', { n: lesson.estimatedMinutes })} · {plural('common.exercises', lesson.exerciseCount)}
      </td>
      <td className="small syllabus__nowrap">{t(`path.status.${lesson.status}`)}</td>
      <td className="small syllabus__nowrap">
        {lesson.bestPercent !== null ? <span className={lesson.bestPercent >= TEST_PASS_PERCENT ? 'text-ok' : 'text-warn'}>{lesson.bestPercent}%</span> : '—'}
        {lesson.attempts > 0 ? <div className="caption">{plural('path.attempts', lesson.attempts)}</div> : null}
      </td>
    </tr>
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
    <tr className="syllabus__test">
      <td className="syllabus__num">
        <FileCheck2 size={16} aria-label={t('path.moduleTest')} />
      </td>
      <td colSpan={3}>
        <span className="syllabus__title">{t('path.moduleTest')}</span>
        <div className="caption">{t('path.moduleTestHint')}</div>
      </td>
      <td className="small syllabus__nowrap">{bestPercent === null ? t('path.testNotTaken') : passed ? t('path.testPassedShort') : t('path.testFailedShort')}</td>
      <td className="small syllabus__nowrap">
        {bestPercent !== null ? `${bestPercent}%` : null}
        <div>
          <Button size="sm" onClick={() => start.mutate()} loading={start.isPending}>
            {t('recommendation.action.module_test')}
          </Button>
        </div>
      </td>
    </tr>
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
              <div className="table-wrap">
                <table className="table syllabus">
                  <thead>
                    <tr>
                      <th className="syllabus__num">№</th>
                      <th>{t('path.col.lesson')}</th>
                      <th>{t('path.col.topic')}</th>
                      <th>{t('path.col.volume')}</th>
                      <th>{t('path.col.status')}</th>
                      <th>{t('path.col.result')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {module.lessons.map((lesson, i) => (
                      <LessonRow key={lesson.id} lesson={lesson} index={i + 1} />
                    ))}
                    <ModuleTestRow module={module} />
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
