import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenText, ExternalLink } from 'lucide-react';
import type { SrsState, VocabularyItemDTO } from '@slog/shared';
import { catalogApi } from '../../api/endpoints';
import { Alert, Button, EmptyState, ErrorState, errorMessage, PageLoader, Select, Spinner, TextInput, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { qk, useActiveLanguage, useTopics } from '../../lib/queries';
import { SpeakButton } from '../lesson/SpeakButton';
import { WordMeta } from './WordMeta';

const STATES: SrsState[] = ['new', 'learning', 'review', 'mastered', 'leech'];
const STATE_TONE: Record<SrsState, string> = { new: 'tag--accent', learning: 'tag--warn', review: '', mastered: 'tag--ok', leech: 'tag--bad' };

function Lookup({ language, term }: { language: string; term: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const query = useQuery({ queryKey: ['lookup', language, term], queryFn: () => catalogApi.lookup(language, term.replace(/^(der|die|das|el|la|los|las)\s+/i, '')), staleTime: Infinity, retry: false });
  if (query.isLoading) return <Spinner />;
  if (query.error) return <Alert tone="warn">{errorMessage(query.error, i18n)}</Alert>;
  const data = query.data!;
  return (
    <div className="lookup">
      <p className="caption">{t('vocabulary.lookupLead')}</p>
      {data.entries.length === 0 ? (
        <p className="small muted">{t('vocabulary.lookupEmpty')}</p>
      ) : (
        data.entries.map((entry, i) => (
          <div key={i} className="stack" style={{ '--gap': '4px' } as React.CSSProperties}>
            <p className="eyebrow" lang="en">
              {entry.partOfSpeech}
            </p>
            <ol className="lookup__defs" lang="en">
              {entry.definitions.map((d, j) => (
                <li key={j}>{d.text}</li>
              ))}
            </ol>
          </div>
        ))
      )}
      <a href={data.sourceUrl} target="_blank" rel="noreferrer noopener" className="small">
        {t('vocabulary.lookupSource')} <ExternalLink size={12} style={{ display: 'inline' }} aria-hidden />
      </a>
    </div>
  );
}

function WordRow({ word, ttsLocale }: { word: VocabularyItemDTO; ttsLocale: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  return (
    <li className="word-row">
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
        {open ? <Lookup language={word.language} term={word.term} /> : null}
      </div>
      <div className="word-row__state">
        {word.srs ? (
          <>
            <span className={`tag ${STATE_TONE[word.srs.state]}`}>{t(`srsStates.${word.srs.state}`)}</span>
            <span className="caption">{t('vocabulary.due', { date: i18n.date(word.srs.dueAt, { day: 'numeric', month: 'short' }) })}</span>
          </>
        ) : (
          <span className="caption">{t('vocabulary.notInReview')}</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <BookOpenText size={14} aria-hidden />
          {t('vocabulary.lookup')}
        </Button>
      </div>
    </li>
  );
}

export default function VocabularyPage() {
  const { t } = useI18n();
  const { code, language, name } = useActiveLanguage();
  const { data: topics, topicTitle } = useTopics();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [topic, setTopic] = useState('');
  const deferredQ = useDeferredValue(q);
  const params = { scope, q: deferredQ || undefined, state: state || undefined, topic: topic || undefined };
  const words = useQuery({ queryKey: qk.vocabulary(code ?? '', params), queryFn: () => catalogApi.vocabulary(code!, params), enabled: !!code, placeholderData: (prev) => prev });
  useTitle('vocabulary.title');

  const usedTopics = new Set((words.data ?? []).map((w) => w.topic));

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{name}</p>
        <h1>{t('vocabulary.title')}</h1>
        <p className="page-head__lead">{t('vocabulary.lead')}</p>
      </header>
      <div className="filters">
        <div className="seg" role="group">
          <button aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
            {t('vocabulary.scopeMine')}
          </button>
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            {t('vocabulary.scopeAll')}
          </button>
        </div>
        <TextInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('vocabulary.searchPlaceholder')} aria-label={t('common.search')} />
        <Select value={state} onChange={(e) => setState(e.target.value)} aria-label={t('vocabulary.stateFilter')}>
          <option value="">{t('vocabulary.stateFilter')}: {t('common.all').toLowerCase()}</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {t(`srsStates.${s}`)}
            </option>
          ))}
        </Select>
        <Select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t('vocabulary.topicFilter')}>
          <option value="">{t('vocabulary.topicFilter')}: {t('common.all').toLowerCase()}</option>
          {(topics ?? [])
            .filter((tp) => usedTopics.has(tp.key) || tp.key === topic)
            .map((tp) => (
              <option key={tp.key} value={tp.key}>
                {topicTitle(tp.key)}
              </option>
            ))}
        </Select>
      </div>
      {words.isLoading ? (
        <PageLoader />
      ) : words.error ? (
        <ErrorState error={words.error} onRetry={() => words.refetch()} />
      ) : words.data!.length === 0 ? (
        <EmptyState title={q || state || topic ? t('vocabulary.emptySearch') : t('vocabulary.empty')} />
      ) : (
        <ul className="word-list">
          {words.data!.map((word) => (
            <WordRow key={word.id} word={word} ttsLocale={language?.ttsLocale ?? code ?? ''} />
          ))}
        </ul>
      )}
    </>
  );
}
