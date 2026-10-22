import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../../api/endpoints';
import { Button, Dialog, ErrorState, errorMessage, Field, LanguageMark, PageLoader, TextInput, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { ValidationErrors } from './LessonEditor';
import { stripMeta, type AdminLanguage } from './types';

function LanguageDialog({ language, onClose }: { language: AdminLanguage | null; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminLanguage>(
    language ?? { id: '', code: '', name: { ru: '' }, nativeName: '', ttsLocale: '', specialChars: [], order: 10, isPublished: false },
  );
  const set = (patch: Partial<AdminLanguage>) => setForm({ ...form, ...patch });
  const save = useMutation({
    mutationFn: () => (language ? adminApi.update('languages', language.code, stripMeta(form, ['code'])) : adminApi.create('languages', stripMeta(form))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'languages'] });
      void queryClient.invalidateQueries({ queryKey: ['languages'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      title={language ? form.name.ru : t('admin.languages.newLanguage')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <Field label={t('admin.languages.code')}>{(p) => <TextInput {...p} value={form.code} disabled={!!language} maxLength={3} onChange={(e) => set({ code: e.target.value.toLowerCase() })} />}</Field>
          <Field label={t('admin.languages.ttsLocale')}>{(p) => <TextInput {...p} value={form.ttsLocale} placeholder="it-IT" onChange={(e) => set({ ttsLocale: e.target.value })} />}</Field>
          <Field label={t('admin.languages.name')}>{(p) => <TextInput {...p} value={form.name.ru} onChange={(e) => set({ name: { ru: e.target.value } })} />}</Field>
          <Field label={t('admin.languages.nativeName')}>{(p) => <TextInput {...p} value={form.nativeName} onChange={(e) => set({ nativeName: e.target.value })} />}</Field>
        </div>
        <Field label={t('admin.languages.specialChars')}>
          {(p) => <TextInput {...p} value={form.specialChars.join(' ')} onChange={(e) => set({ specialChars: e.target.value.split(' ').filter(Boolean) })} />}
        </Field>
        <Field label={t('admin.content.order')}>{(p) => <TextInput {...p} type="number" value={form.order} onChange={(e) => set({ order: Number(e.target.value) })} />}</Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />
          {t('common.published')}
        </label>
        <ValidationErrors error={save.error} />
      </div>
    </Dialog>
  );
}

export function AdminLanguages() {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const queryClient = useQueryClient();
  const languages = useQuery({ queryKey: ['admin', 'languages'], queryFn: () => adminApi.list<AdminLanguage[]>('languages') });
  const [editing, setEditing] = useState<AdminLanguage | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (code: string) => adminApi.remove('languages', code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'languages'] }),
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  useTitle('admin.nav.languages');
  if (languages.isLoading) return <PageLoader />;
  if (languages.error) return <ErrorState error={languages.error} />;
  return (
    <>
      <header className="page-head spread">
        <h1>{t('admin.languages.title')}</h1>
        <Button variant="primary" onClick={() => setEditing('new')}>
          <Plus size={14} aria-hidden />
          {t('admin.languages.newLanguage')}
        </Button>
      </header>
      <ul className="lang-list">
        {languages.data!.map((l) => (
          <li key={l.code} className="lang-list__row">
            <LanguageMark code={l.code} size="lg" />
            <div className="stack" style={{ '--gap': '2px', flex: 1 } as React.CSSProperties}>
              <span className="lang-list__name">
                {l.name.ru} · <span className="target">{l.nativeName}</span>
              </span>
              <span className="caption">
                {l.ttsLocale} · {l.specialChars.join(' ')}
              </span>
            </div>
            <span className={`tag ${l.isPublished ? 'tag--ok' : ''}`}>{l.isPublished ? t('common.published') : t('common.hidden')}</span>
            <Button size="sm" variant="ghost" icon aria-label={t('common.edit')} onClick={() => setEditing(l)}>
              <Pencil size={14} />
            </Button>
            <Button size="sm" variant="ghost" icon aria-label={t('common.delete')} onClick={() => window.confirm(t('admin.content.confirmDelete', { title: l.name.ru })) && remove.mutate(l.code)}>
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      {editing ? <LanguageDialog language={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
