import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints';
import { Button, EmptyState, ErrorState, PageLoader, TextInput, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useLanguageName } from '../../lib/queries';

export function AdminUsers() {
  const i18n = useI18n();
  const { t } = i18n;
  const languageName = useLanguageName();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const deferred = useDeferredValue(q);
  const users = useQuery({ queryKey: ['admin', 'users', deferred, page], queryFn: () => adminApi.users({ q: deferred || undefined, page }), placeholderData: (p) => p });
  useTitle('admin.nav.users');
  if (users.isLoading) return <PageLoader />;
  if (users.error) return <ErrorState error={users.error} onRetry={() => users.refetch()} />;
  const data = users.data!;
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const date = (d: string | null) => (d ? i18n.date(d, { day: 'numeric', month: 'short', year: 'numeric' }) : t('admin.users.never'));

  return (
    <>
      <header className="page-head">
        <h1>{t('admin.users.title')}</h1>
      </header>
      <div className="filters">
        <TextInput type="search" placeholder={t('admin.users.search')} aria-label={t('admin.users.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {data.items.length === 0 ? (
        <EmptyState title={t('vocabulary.emptySearch')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('profile.name')}</th>
                <th>{t('admin.users.role')}</th>
                <th>{t('admin.users.languages')}</th>
                <th>{t('admin.users.lessons')}</th>
                <th>{t('admin.users.registered')}</th>
                <th>{t('admin.users.lastActive')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => {
                return (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      <div className="caption">{u.email}</div>
                    </td>
                    <td>{t(`admin.users.roles.${u.role}`)}</td>
                    <td className="small">{u.languages.map(languageName).join(', ') || '—'}</td>
                    <td>{u.lessonsCompleted}</td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{date(u.createdAt)}</td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{date(u.lastActiveAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
  );
}
