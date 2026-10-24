import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { CEFR_LEVELS, type CefrLevel, type Paginated } from '@linguapath/shared';
import { adminApi, catalogApi } from '../../api/endpoints';
import { Alert, Button, Dialog, EmptyState, errorMessage, Field, PageLoader, Select, Spinner, TextInput, useTitle, useToast } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { useTopics } from '../../lib/queries';
import { ValidationErrors } from './LessonEditor';
import { stripMeta, type AdminLanguage, type AdminWord } from './types';

const PARTS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'phrase', 'numeral', 'preposition', 'conjunction', 'interjection', 'other'];

function UploadButton({ accept, onUploaded }: { accept: string; onUploaded: (url: string) => void }) {
  const i18n = useI18n();
  const toast = useToast();
  const upload = useMutation({
    mutationFn: (file: File) => adminApi.upload(file),
    onSuccess: (r) => onUploaded(r.url),
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  return (
    <label className="btn btn--sm">
      {upload.isPending ? <Spinner /> : <Upload size={14} aria-hidden />}
      {i18n.t('admin.words.upload')}
      <input type="file" accept={accept} className="visually-hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
    </label>
  );
}

function DictionaryHint({ language, term }: { language: string; term: string }) {
  const i18n = useI18n();
  const lookup = useMutation({ mutationFn: () => catalogApi.lookup(language, term) });
  return (
    <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
      <div>
        <Button size="sm" variant="ghost" onClick={() => lookup.mutate()} disabled={!term} loading={lookup.isPending}>
          {i18n.t('admin.words.lookup')}
        </Button>
      </div>
      {lookup.error ? <Alert tone="warn">{errorMessage(lookup.error, i18n)}</Alert> : null}
      {lookup.data ? (
        lookup.data.entries.length ? (
          <ul className="plain-list small" lang="en">
            {lookup.data.entries.flatMap((e) => e.definitions.slice(0, 2).map((d, i) => <li key={`${e.partOfSpeech}-${i}`}>({e.partOfSpeech}) {d.text}</li>))}
          </ul>
        ) : (
          <p className="small muted">{i18n.t('vocabulary.lookupEmpty')}</p>
        )
      ) : null}
    </div>
  );
}

function WordDialog({ word, language, onClose }: { word: AdminWord | null; language: string; onClose: () => void }) {
  const { t } = useI18n();
  const { data: topics, topicTitle } = useTopics();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminWord>(
    word ?? {
      id: '',
      language,
      term: '',
      translation: { ru: '' },
      partOfSpeech: 'noun',
      gender: null,
      example: '',
      exampleTranslation: { ru: '' },
      topic: topics?.[0]?.key ?? 'greetings',
      level: 'A1',
      audioUrl: null,
      imageUrl: null,
      isPublished: true,
    },
  );
  const set = (patch: Partial<AdminWord>) => setForm({ ...form, ...patch });
  const save = useMutation({
    mutationFn: () => (word ? adminApi.update('words', word.id, stripMeta(form, ['language'])) : adminApi.create('words', stripMeta(form))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'words'] });
      onClose();
    },
  });
  const label = (k: string) => t(`admin.words.${k}` as MessageKey);
  return (
    <Dialog
      open
      wide
      title={word ? label('editWord') : label('newWord')}
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
          <Field label={label('term')}>{(p) => <TextInput {...p} className="input--target" value={form.term} onChange={(e) => set({ term: e.target.value })} />}</Field>
          <Field label={label('translation')}>{(p) => <TextInput {...p} value={form.translation.ru} onChange={(e) => set({ translation: { ru: e.target.value } })} />}</Field>
          <Field label={label('partOfSpeech')}>
            {(p) => (
              <Select {...p} value={form.partOfSpeech} onChange={(e) => set({ partOfSpeech: e.target.value })}>
                {PARTS.map((part) => (
                  <option key={part} value={part}>
                    {t(`partsOfSpeech.${part}` as MessageKey)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={label('gender')}>
            {(p) => (
              <Select {...p} value={form.gender ?? ''} onChange={(e) => set({ gender: e.target.value || null })}>
                <option value="">{label('noGender')}</option>
                {(['m', 'f', 'n', 'mf'] as const).map((g) => (
                  <option key={g} value={g}>
                    {t(`genders.${g}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={label('topic')}>
            {(p) => (
              <Select {...p} value={form.topic} onChange={(e) => set({ topic: e.target.value })}>
                {(topics ?? []).map((tp) => (
                  <option key={tp.key} value={tp.key}>
                    {topicTitle(tp.key)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={label('level')}>
            {(p) => (
              <Select {...p} value={form.level} onChange={(e) => set({ level: e.target.value as CefrLevel })}>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={label('example')}>{(p) => <TextInput {...p} className="input--target" value={form.example} onChange={(e) => set({ example: e.target.value })} />}</Field>
        <Field label={label('exampleTranslation')}>{(p) => <TextInput {...p} value={form.exampleTranslation.ru} onChange={(e) => set({ exampleTranslation: { ru: e.target.value } })} />}</Field>
        <div className="form-grid">
          <Field label={label('audio')}>
            {(p) => (
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <TextInput {...p} value={form.audioUrl ?? ''} onChange={(e) => set({ audioUrl: e.target.value || null })} />
                <UploadButton accept="audio/*" onUploaded={(url) => set({ audioUrl: url })} />
              </div>
            )}
          </Field>
          <Field label={label('image')}>
            {(p) => (
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <TextInput {...p} value={form.imageUrl ?? ''} onChange={(e) => set({ imageUrl: e.target.value || null })} />
                <UploadButton accept="image/png,image/jpeg,image/webp" onUploaded={(url) => set({ imageUrl: url })} />
              </div>
            )}
          </Field>
        </div>
        {form.audioUrl ? <audio controls src={form.audioUrl} style={{ width: '100%' }} /> : null}
        {form.imageUrl ? <img src={form.imageUrl} alt={form.term} style={{ maxHeight: 120, borderRadius: 8 }} /> : null}
        <label className="checkbox">
          <input type="checkbox" checked={form.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />
          {t('common.published')}
        </label>
        <DictionaryHint language={form.language} term={form.term} />
        <ValidationErrors error={save.error} />
      </div>
    </Dialog>
  );
}

export function AdminWords() {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const queryClient = useQueryClient();
  const { topicTitle } = useTopics();
  const languages = useQuery({ queryKey: ['admin', 'languages'], queryFn: () => adminApi.list<AdminLanguage[]>('languages') });
  const [language, setLanguage] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminWord | 'new' | null>(null);
  const lang = language || languages.data?.[0]?.code || '';
  const words = useQuery({
    queryKey: ['admin', 'words', lang, q, page],
    queryFn: () => adminApi.list<Paginated<AdminWord>>('words', { language: lang, q: q || undefined, page, pageSize: 30 }),
    enabled: !!lang,
    placeholderData: (p) => p,
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.remove('words', id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'words'] }),
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  useTitle('admin.nav.words');
  const totalPages = words.data ? Math.max(1, Math.ceil(words.data.total / words.data.pageSize)) : 1;

  return (
    <>
      <header className="page-head">
        <h1>{t('admin.words.title')}</h1>
      </header>
      <div className="filters">
        <Select value={lang} onChange={(e) => { setLanguage(e.target.value); setPage(1); }} aria-label={t('common.language')}>
          {(languages.data ?? []).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name.ru}
            </option>
          ))}
        </Select>
        <TextInput type="search" placeholder={t('common.search')} aria-label={t('common.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Button variant="primary" onClick={() => setEditing('new')}>
          <Plus size={14} aria-hidden />
          {t('admin.words.newWord')}
        </Button>
      </div>
      {words.isLoading ? (
        <PageLoader />
      ) : !words.data?.items.length ? (
        <EmptyState title={t('admin.words.empty')} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.words.term')}</th>
                  <th>{t('admin.words.translation')}</th>
                  <th>{t('admin.words.topic')}</th>
                  <th>{t('admin.words.level')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {words.data.items.map((w) => (
                  <tr key={w.id}>
                    <td className="target">{w.term}</td>
                    <td>{w.translation.ru}</td>
                    <td className="small muted">{topicTitle(w.topic)}</td>
                    <td>{w.level}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Button size="sm" variant="ghost" icon aria-label={t('common.edit')} onClick={() => setEditing(w)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon
                        aria-label={t('common.delete')}
                        onClick={() => window.confirm(t('admin.content.confirmDelete', { title: w.term })) && remove.mutate(w.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common.prev')}
            </Button>
            <span className="small muted">{t('common.page', { page, total: totalPages })}</span>
            <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('common.nextPage')}
            </Button>
          </div>
        </>
      )}
      {editing ? <WordDialog word={editing === 'new' ? null : editing} language={lang} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
