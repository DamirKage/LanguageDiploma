import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { CEFR_LEVELS, type CefrLevel } from '@slog/shared';
import { adminApi } from '../../api/endpoints';
import { Alert, Button, buttonClass, Dialog, EmptyState, ErrorState, errorMessage, Field, PageLoader, Select, Textarea, TextInput, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import type { AdminCourse, AdminLanguage, AdminLesson, AdminModule } from './types';

type EditTarget =
  | { kind: 'course'; item?: AdminCourse }
  | { kind: 'module'; item?: AdminModule; course: AdminCourse };

function EntityDialog({ target, language, onClose }: { target: EditTarget; language: string; onClose: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(target.item?.title.ru ?? '');
  const [description, setDescription] = useState(target.item?.description.ru ?? '');
  const [level, setLevel] = useState<CefrLevel>(target.kind === 'course' ? (target.item?.level ?? 'A1') : 'A1');
  const [order, setOrder] = useState(target.kind === 'module' ? (target.item?.order ?? 1) : 0);
  const [isPublished, setPublished] = useState(target.item?.isPublished ?? false);
  const save = useMutation({
    mutationFn: async () => {
      const common = { title: { ru: title }, description: { ru: description }, isPublished };
      if (target.kind === 'course') {
        return target.item ? adminApi.update('courses', target.item.id, common) : adminApi.create('courses', { ...common, language, level });
      }
      return target.item
        ? adminApi.update('modules', target.item.id, { ...common, order })
        : adminApi.create('modules', { ...common, order, course: target.course.id });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      title={target.kind === 'course' ? t('admin.content.newCourse') : t('admin.content.newModule')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={!title.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {target.kind === 'course' && !target.item ? (
          <Field label={t('admin.content.level')}>
            {(p) => (
              <Select {...p} value={level} onChange={(e) => setLevel(e.target.value as CefrLevel)}>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`levels.${l}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label={t('admin.content.title')}>{(p) => <TextInput {...p} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label={t('admin.content.description')}>{(p) => <Textarea {...p} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        {target.kind === 'module' ? (
          <Field label={t('admin.content.order')}>{(p) => <TextInput {...p} type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value))} />}</Field>
        ) : null}
        <label className="checkbox">
          <input type="checkbox" checked={isPublished} onChange={(e) => setPublished(e.target.checked)} />
          {t('common.published')}
        </label>
        {save.error ? <Alert tone="bad">{errorMessage(save.error, i18n)}</Alert> : null}
      </div>
    </Dialog>
  );
}

function ModuleBlock({ module, course, onEdit }: { module: AdminModule; course: AdminCourse; onEdit: (t: EditTarget) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const queryClient = useQueryClient();
  const lessons = useQuery({ queryKey: ['admin', 'lessons', module.id], queryFn: () => adminApi.list<AdminLesson[]>('lessons', { module: module.id }) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin'] });
  const publish = useMutation({ mutationFn: (l: AdminLesson) => adminApi.publishLesson(l.id, !l.isPublished), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: ({ resource, id }: { resource: string; id: string }) => adminApi.remove(resource, id),
    onSuccess: refresh,
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  const confirmDelete = (resource: string, id: string, title: string) => {
    if (window.confirm(t('admin.content.confirmDelete', { title }))) remove.mutate({ resource, id });
  };

  return (
    <div className="admin-module">
      <div className="spread">
        <div className="row" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
          <h4>
            {module.order}. {module.title.ru}
          </h4>
          <span className={`tag ${module.isPublished ? 'tag--ok' : ''}`}>{module.isPublished ? t('common.published') : t('common.hidden')}</span>
        </div>
        <div className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
          <Link to={`/admin/content/lessons/new?module=${module.id}&language=${module.language}`} className={buttonClass({ size: 'sm' })}>
            <Plus size={14} aria-hidden />
            {t('admin.content.newLesson')}
          </Link>
          <Button size="sm" variant="ghost" icon aria-label={t('common.edit')} onClick={() => onEdit({ kind: 'module', item: module, course })}>
            <Pencil size={14} />
          </Button>
          <Button size="sm" variant="ghost" icon aria-label={t('common.delete')} onClick={() => confirmDelete('modules', module.id, module.title.ru)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {lessons.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {lessons.data.map((lesson) => (
                <tr key={lesson.id}>
                  <td className="muted">{lesson.order}</td>
                  <td style={{ width: '100%' }}>
                    <Link to={`/admin/content/lessons/${lesson.id}`}>{lesson.title.ru}</Link>
                    <div className="caption">
                      <code>{lesson.key}</code> · {t('admin.content.exercisesCount', { n: lesson.exerciseCount ?? 0 })}
                    </div>
                  </td>
                  <td>
                    <Button size="sm" onClick={() => publish.mutate(lesson)}>
                      {lesson.isPublished ? t('admin.content.unpublish') : t('admin.content.publish')}
                    </Button>
                  </td>
                  <td>
                    <Button size="sm" variant="ghost" icon aria-label={t('common.delete')} onClick={() => confirmDelete('lessons', lesson.id, lesson.title.ru)}>
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small muted">{t('admin.content.noLessons')}</p>
      )}
    </div>
  );
}

function CourseBlock({ course, onEdit }: { course: AdminCourse; onEdit: (t: EditTarget) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const queryClient = useQueryClient();
  const modules = useQuery({ queryKey: ['admin', 'modules', course.id], queryFn: () => adminApi.list<AdminModule[]>('modules', { course: course.id }) });
  const remove = useMutation({
    mutationFn: () => adminApi.remove('courses', course.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  return (
    <section className="admin-course">
      <div className="spread admin-course__head">
        <div className="row" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
          <span className="level-badge">{course.level}</span>
          <h3>{course.title.ru}</h3>
          <span className={`tag ${course.isPublished ? 'tag--ok' : ''}`}>{course.isPublished ? t('common.published') : t('common.hidden')}</span>
        </div>
        <div className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
          <Button size="sm" onClick={() => onEdit({ kind: 'module', course })}>
            <Plus size={14} aria-hidden />
            {t('admin.content.newModule')}
          </Button>
          <Button size="sm" variant="ghost" icon aria-label={t('common.edit')} onClick={() => onEdit({ kind: 'course', item: course })}>
            <Pencil size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon
            aria-label={t('common.delete')}
            onClick={() => window.confirm(t('admin.content.confirmDelete', { title: course.title.ru })) && remove.mutate()}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {modules.data?.length ? (
        modules.data.map((m) => <ModuleBlock key={m.id} module={m} course={course} onEdit={onEdit} />)
      ) : (
        <p className="small muted">{t('admin.content.noModules')}</p>
      )}
    </section>
  );
}

export function AdminContent() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const languages = useQuery({ queryKey: ['admin', 'languages'], queryFn: () => adminApi.list<AdminLanguage[]>('languages') });
  const language = params.get('language') ?? languages.data?.[0]?.code ?? '';
  const courses = useQuery({ queryKey: ['admin', 'courses', language], queryFn: () => adminApi.list<AdminCourse[]>('courses', { language }), enabled: !!language });
  const [editing, setEditing] = useState<EditTarget | null>(null);
  useTitle('admin.nav.content');

  if (languages.isLoading) return <PageLoader />;
  if (languages.error) return <ErrorState error={languages.error} onRetry={() => languages.refetch()} />;

  return (
    <>
      <header className="page-head">
        <h1>{t('admin.nav.content')}</h1>
      </header>
      <div className="filters">
        <Select value={language} onChange={(e) => setParams({ language: e.target.value })} aria-label={t('admin.content.chooseLanguage')}>
          {languages.data!.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name.ru} ({l.nativeName})
            </option>
          ))}
        </Select>
        <Button onClick={() => setEditing({ kind: 'course' })}>
          <Plus size={14} aria-hidden />
          {t('admin.content.newCourse')}
        </Button>
      </div>
      {courses.isLoading ? (
        <PageLoader />
      ) : courses.data?.length ? (
        courses.data.map((course) => <CourseBlock key={course.id} course={course} onEdit={setEditing} />)
      ) : (
        <EmptyState title={t('admin.content.noCourses')} />
      )}
      {editing ? <EntityDialog target={editing} language={language} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
