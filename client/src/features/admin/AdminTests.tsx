import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { adminApi } from '../../api/endpoints';
import { Button, EmptyState, ErrorState, Field, PageLoader, Section, Select, TextInput, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { ExerciseListEditor } from './ExerciseEditor';
import { ValidationErrors } from './LessonEditor';
import { stripMeta, type AdminLanguage, type AdminTest } from './types';

export function AdminTests() {
  const { t } = useI18n();
  const languages = useQuery({ queryKey: ['admin', 'languages'], queryFn: () => adminApi.list<AdminLanguage[]>('languages') });
  const [language, setLanguage] = useState('');
  const lang = language || languages.data?.[0]?.code || '';
  const tests = useQuery({ queryKey: ['admin', 'tests', lang], queryFn: () => adminApi.list<AdminTest[]>('tests', { language: lang }), enabled: !!lang });
  useTitle('admin.nav.tests');
  return (
    <>
      <header className="page-head">
        <h1>{t('admin.tests.title')}</h1>
      </header>
      <div className="filters">
        <Select value={lang} onChange={(e) => setLanguage(e.target.value)} aria-label={t('common.language')}>
          {(languages.data ?? []).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name.ru}
            </option>
          ))}
        </Select>
      </div>
      {tests.isLoading ? (
        <PageLoader />
      ) : !tests.data?.length ? (
        <EmptyState title={t('admin.dashboard.empty')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {tests.data.map((test) => (
                <tr key={test.id}>
                  <td>
                    <span className="tag">{t(`admin.tests.kind.${test.kind}`)}</span>
                  </td>
                  <td>{test.level ?? '—'}</td>
                  <td style={{ width: '100%' }}>
                    <Link to={`/admin/tests/${test.id}`}>{test.title.ru}</Link>
                  </td>
                  <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                    {t('admin.tests.exercises', { n: test.exerciseCount ?? 0 })}
                  </td>
                  <td>
                    <span className={`tag ${test.isPublished ? 'tag--ok' : ''}`}>{test.isPublished ? t('common.published') : t('common.hidden')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function TestEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'test', id], queryFn: () => adminApi.get<AdminTest>('tests', id!) });
  const [test, setTest] = useState<AdminTest | null>(null);
  useEffect(() => {
    if (query.data) setTest(query.data);
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => adminApi.replace<AdminTest>('tests', id!, stripMeta(test!)),
    onSuccess: (saved) => {
      setTest(saved);
      toast(t('admin.tests.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] });
    },
  });
  useTitle('admin.nav.tests');
  if (query.isLoading || !test) return query.error ? <ErrorState error={query.error} /> : <PageLoader />;
  const set = (patch: Partial<AdminTest>) => setTest({ ...test, ...patch });

  return (
    <>
      <Link to="/admin/tests" className="back-link">
        <ArrowLeft size={16} aria-hidden />
        {t('admin.tests.title')}
      </Link>
      <header className="page-head">
        <p className="eyebrow">{t(`admin.tests.kind.${test.kind}`)}</p>
        <h1>{test.title.ru}</h1>
      </header>
      <form
        className="stack"
        style={{ '--gap': 'var(--s8)' } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="form-grid">
          <Field label={t('admin.content.title')}>{(p) => <TextInput {...p} value={test.title.ru} onChange={(e) => set({ title: { ru: e.target.value } })} />}</Field>
          <Field label={t('admin.tests.passPercent')}>
            {(p) => <TextInput {...p} type="number" min={1} max={100} value={test.passPercent} onChange={(e) => set({ passPercent: Number(e.target.value) })} />}
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={test.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />
          {t('common.published')}
        </label>
        <Section title={t('admin.lessonEditor.exercises')}>
          {test.kind === 'placement' ? <p className="caption">{t('admin.tests.placementLevelHint')}</p> : null}
          <ExerciseListEditor
            exercises={test.exercises}
            onChange={(exercises) => set({ exercises })}
            keyPrefix={`${test.language}-${test.kind}-${test.id.slice(-4)}`}
            defaultTopic={test.exercises[0]?.topic ?? 'greetings'}
            showLevel={test.kind === 'placement'}
          />
        </Section>
        <ValidationErrors error={save.error} />
        <div className="sticky-actions">
          <Button type="submit" variant="primary" size="lg" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </>
  );
}
