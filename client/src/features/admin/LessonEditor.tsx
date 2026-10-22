import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import type { Paginated } from '@slog/shared';
import { ApiError } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import { Alert, Button, ErrorState, errorMessage, Field, PageLoader, Section, Select, Textarea, TextInput, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useTopics } from '../../lib/queries';
import { ExerciseListEditor } from './ExerciseEditor';
import { stripMeta, type AdminLesson, type AdminTheoryBlock, type AdminWord } from './types';

const emptyLesson = (module: string, language: string): AdminLesson => ({
  id: '',
  key: '',
  module,
  language,
  level: 'A1',
  title: { ru: '' },
  objective: { ru: '' },
  topic: 'greetings',
  order: 1,
  estimatedMinutes: 10,
  prerequisites: [],
  theory: [],
  words: [],
  exercises: [],
  isPublished: false,
});

export function ValidationErrors({ error }: { error: unknown }) {
  const i18n = useI18n();
  if (!error) return null;
  return (
    <Alert tone="bad">
      <p>{error instanceof ApiError && error.code === 'validation_failed' ? i18n.t('admin.lessonEditor.validation') : errorMessage(error, i18n)}</p>
      {error instanceof ApiError && error.details.length ? (
        <ul className="plain-list">
          {error.details.slice(0, 12).map((d, i) => (
            <li key={i}>
              <code>{d.path.replace(/^body\./, '')}</code> — {d.message}
            </li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}

function TheoryEditor({ blocks, onChange }: { blocks: AdminTheoryBlock[]; onChange: (b: AdminTheoryBlock[]) => void }) {
  const { t } = useI18n();
  const update = (i: number, patch: Partial<AdminTheoryBlock>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="stack">
      {blocks.map((block, i) => (
        <fieldset key={i} className="exercise-editor">
          <legend className="exercise-editor__legend">
            <span>{i + 1}</span>
            <Button variant="ghost" size="sm" icon aria-label={t('common.delete')} onClick={() => onChange(blocks.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </Button>
          </legend>
          <Field label={t('admin.lessonEditor.theoryTitle')}>{(p) => <TextInput {...p} value={block.title.ru} onChange={(e) => update(i, { title: { ru: e.target.value } })} />}</Field>
          <Field label={t('admin.lessonEditor.theoryBody')}>{(p) => <Textarea {...p} rows={4} value={block.body.ru} onChange={(e) => update(i, { body: { ru: e.target.value } })} />}</Field>
          <Field label={t('admin.lessonEditor.examples')}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={(block.examples ?? []).map((ex) => `${ex.target} | ${ex.translation.ru}`).join('\n')}
                onChange={(e) =>
                  update(i, {
                    examples: e.target.value
                      .split('\n')
                      .filter((l) => l.trim())
                      .map((line) => {
                        const [target = '', translation = ''] = line.split('|');
                        return { target: target.trim(), translation: { ru: translation.trim() } };
                      }),
                  })
                }
              />
            )}
          </Field>
        </fieldset>
      ))}
      <div>
        <Button onClick={() => onChange([...blocks, { title: { ru: '' }, body: { ru: '' }, examples: [] }])}>
          <Plus size={14} aria-hidden />
          {t('admin.lessonEditor.addTheory')}
        </Button>
      </div>
    </div>
  );
}

function WordPicker({ language, selected, onChange }: { language: string; selected: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const search = useQuery({
    queryKey: ['admin', 'words', language, q],
    queryFn: () => adminApi.list<Paginated<AdminWord>>('words', { language, q: q || undefined, pageSize: 100 }),
    enabled: !!language,
  });
  const all = search.data?.items ?? [];
  const selectedWords = useQuery({
    queryKey: ['admin', 'words', language, 'all'],
    queryFn: () => adminApi.list<Paginated<AdminWord>>('words', { language, pageSize: 100 }),
    enabled: !!language,
  });
  const byId = new Map([...(selectedWords.data?.items ?? []), ...all].map((w) => [w.id, w]));
  return (
    <div className="stack">
      <p className="caption">{t('admin.lessonEditor.wordsHint')}</p>
      <ul className="chip-list">
        {selected.map((id) => (
          <li key={id} className="tag">
            <span className="target">{byId.get(id)?.term ?? id}</span>
            <button type="button" className="btn btn--ghost btn--icon btn--sm" style={{ width: 20, minHeight: 20 }} aria-label={t('common.delete')} onClick={() => onChange(selected.filter((x) => x !== id))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <TextInput type="search" placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
      {q ? (
        <ul className="chip-list">
          {all
            .filter((w) => !selected.includes(w.id))
            .slice(0, 20)
            .map((w) => (
              <li key={w.id}>
                <Button size="sm" onClick={() => onChange([...selected, w.id])}>
                  <Plus size={12} aria-hidden />
                  <span className="target">{w.term}</span> — {w.translation.ru}
                </Button>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LessonEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const i18n = useI18n();
  const { t } = i18n;
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: topics, topicTitle } = useTopics();
  const isNew = !id;
  const existing = useQuery({ queryKey: ['admin', 'lesson', id], queryFn: () => adminApi.get<AdminLesson>('lessons', id!), enabled: !isNew });
  const [lesson, setLesson] = useState<AdminLesson | null>(isNew ? emptyLesson(params.get('module') ?? '', params.get('language') ?? '') : null);
  useEffect(() => {
    if (existing.data) setLesson(existing.data);
  }, [existing.data]);
  useTitle(isNew ? 'admin.lessonEditor.titleNew' : 'admin.lessonEditor.titleEdit');

  const save = useMutation({
    mutationFn: async () => {
      const body = stripMeta(lesson!, ['language', 'level', 'course']);
      return isNew ? adminApi.create<AdminLesson>('lessons', body) : adminApi.replace<AdminLesson>('lessons', id!, body);
    },
    onSuccess: (saved) => {
      toast(t('admin.lessonEditor.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      if (isNew) navigate(`/admin/content/lessons/${saved.id}`, { replace: true });
      else setLesson(saved);
    },
  });

  if (!isNew && existing.isLoading) return <PageLoader />;
  if (existing.error) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  if (!lesson) return <PageLoader />;
  const set = (patch: Partial<AdminLesson>) => setLesson({ ...lesson, ...patch });

  return (
    <>
      <Link to={`/admin/content?language=${lesson.language}`} className="back-link">
        <ArrowLeft size={16} aria-hidden />
        {t('admin.nav.content')}
      </Link>
      <header className="page-head">
        <h1>{isNew ? t('admin.lessonEditor.titleNew') : lesson.title.ru}</h1>
      </header>
      <form
        className="stack"
        style={{ '--gap': 'var(--s8)' } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Section title={t('admin.content.title')}>
          <div className="form-grid">
            <Field label={t('admin.content.title')}>{(p) => <TextInput {...p} value={lesson.title.ru} onChange={(e) => set({ title: { ru: e.target.value } })} />}</Field>
            <Field label={t('admin.lessonEditor.key')} hint={t('admin.lessonEditor.keyHint')}>
              {(p) => <TextInput {...p} value={lesson.key} onChange={(e) => set({ key: e.target.value })} />}
            </Field>
            <Field label={t('admin.lessonEditor.topic')}>
              {(p) => (
                <Select {...p} value={lesson.topic} onChange={(e) => set({ topic: e.target.value })}>
                  {(topics ?? []).map((tp) => (
                    <option key={tp.key} value={tp.key}>
                      {topicTitle(tp.key)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('admin.lessonEditor.minutes')}>
              {(p) => <TextInput {...p} type="number" min={1} max={90} value={lesson.estimatedMinutes} onChange={(e) => set({ estimatedMinutes: Number(e.target.value) })} />}
            </Field>
            <Field label={t('admin.content.order')}>{(p) => <TextInput {...p} type="number" min={0} value={lesson.order} onChange={(e) => set({ order: Number(e.target.value) })} />}</Field>
          </div>
          <Field label={t('admin.lessonEditor.objective')}>{(p) => <Textarea {...p} rows={2} value={lesson.objective.ru} onChange={(e) => set({ objective: { ru: e.target.value } })} />}</Field>
          <label className="checkbox">
            <input type="checkbox" checked={lesson.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />
            {t('admin.lessonEditor.published')}
          </label>
        </Section>

        <Section title={t('admin.lessonEditor.theory')}>
          <TheoryEditor blocks={lesson.theory} onChange={(theory) => set({ theory })} />
        </Section>

        <Section title={t('admin.lessonEditor.words')}>
          <WordPicker language={lesson.language} selected={lesson.words} onChange={(words) => set({ words })} />
        </Section>

        <Section title={t('admin.lessonEditor.exercises')}>
          <ExerciseListEditor exercises={lesson.exercises} onChange={(exercises) => set({ exercises })} keyPrefix={lesson.key || 'lesson'} defaultTopic={lesson.topic} />
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
