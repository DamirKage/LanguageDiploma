import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { catalogApi, learningApi } from '../../api/endpoints';
import { Button, ErrorState, errorMessage, PageLoader, Section, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { qk, useLanguages } from '../../lib/queries';
import { SpeakButton } from './SpeakButton';
import { WordMeta } from '../vocabulary/WordMeta';

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const i18n = useI18n();
  const { t, plural } = i18n;
  const navigate = useNavigate();
  const toast = useToast();
  const { data: languages } = useLanguages();
  const lesson = useQuery({ queryKey: qk.lesson(lessonId!), queryFn: () => catalogApi.lesson(lessonId!) });
  useTitle(null, lesson.data?.title);

  const start = useMutation({
    mutationFn: (kind: 'lesson' | 'test') => (kind === 'lesson' ? learningApi.startLesson(lessonId!) : learningApi.startTest(lesson.data!.testId!)),
    onSuccess: (attempt) => navigate(`/learn/${attempt.id}`),
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });

  if (lesson.isLoading) return <PageLoader />;
  if (lesson.error) return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  const data = lesson.data!;
  const ttsLocale = languages?.find((l) => l.code === data.language)?.ttsLocale ?? data.language;
  const actionLabel = data.status === 'completed' ? t('lesson.again') : data.resumeAttemptId ? t('lesson.resume') : t('lesson.start');

  return (
    <>
      <Link to="/path" className="back-link">
        <ArrowLeft size={16} aria-hidden />
        {t('path.title')}
      </Link>
      <header className="page-head lesson-head">
        <p className="eyebrow">
          {data.level} · {data.moduleTitle}
        </p>
        <h1>{data.title}</h1>
        <p className="small muted">
          {t('lesson.meta', { minutes: plural('common.minutes', data.estimatedMinutes), exercises: plural('common.exercises', data.exerciseCount) })}
          {data.bestPercent !== null ? ` · ${t('lesson.best', { n: data.bestPercent })}` : ''}
        </p>
        <div className="lesson-objective">
          <p className="eyebrow">{t('lesson.objective')}</p>
          <p>{data.objective}</p>
        </div>
        <div className="row">
          <Button variant="primary" size="lg" onClick={() => start.mutate('lesson')} loading={start.isPending && start.variables === 'lesson'}>
            {actionLabel}
            <ArrowRight size={18} aria-hidden />
          </Button>
          {data.testId && data.status === 'completed' ? (
            <Button size="lg" onClick={() => start.mutate('test')} loading={start.isPending && start.variables === 'test'} title={t('lesson.lessonTestHint')}>
              {t('lesson.lessonTest')}
            </Button>
          ) : null}
        </div>
      </header>

      {data.theory.length > 0 ? (
        <Section title={t('lesson.theory')}>
          <div className="theory">
            {data.theory.map((block, i) => (
              <article key={i} className="theory__block">
                <h3>{block.title}</h3>
                <p>{block.body}</p>
                {block.examples.length > 0 ? (
                  <ul className="examples">
                    {block.examples.map((ex, j) => (
                      <li key={j}>
                        <span className="row" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
                          <SpeakButton text={ex.target} locale={ttsLocale} size="sm" />
                          <span className="target examples__target">{ex.target}</span>
                        </span>
                        <span className="muted small">{ex.translation}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      {data.words.length > 0 ? (
        <Section title={t('lesson.words')} aside={<span className="small muted">{plural('common.words', data.words.length)}</span>}>
          <ul className="word-list">
            {data.words.map((word) => (
              <li key={word.id} className="word-row">
                <SpeakButton text={word.term} audioUrl={word.audioUrl} locale={ttsLocale} size="sm" />
                <div className="word-row__main">
                  <span className="target word-row__term">{word.term}</span>
                  <WordMeta word={word} />
                </div>
                <div className="word-row__translation">
                  <span>{word.translation}</span>
                  {word.example ? (
                    <span className="small muted">
                      <span className="target">{word.example}</span> — {word.exampleTranslation}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
