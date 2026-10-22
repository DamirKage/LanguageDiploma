import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Trash2, Upload } from 'lucide-react';
import { adminApi } from '../../api/endpoints';
import { Button, EmptyState, errorMessage, PageLoader, Spinner, useTitle, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';

export function AdminMedia() {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const queryClient = useQueryClient();
  const media = useQuery({ queryKey: ['admin', 'media'], queryFn: adminApi.media });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'media'] });
  const upload = useMutation({
    mutationFn: (file: File) => adminApi.upload(file),
    onSuccess: () => {
      toast(t('admin.media.uploaded'));
      refresh();
    },
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  const remove = useMutation({ mutationFn: (name: string) => adminApi.remove('media', name), onSuccess: refresh });
  useTitle('admin.nav.media');

  return (
    <>
      <header className="page-head">
        <h1>{t('admin.media.title')}</h1>
        <p className="page-head__lead">{t('admin.media.lead')}</p>
      </header>
      <div>
        <label className="btn btn--primary">
          {upload.isPending ? <Spinner /> : <Upload size={16} aria-hidden />}
          {t('admin.media.upload')}
          <input type="file" className="visually-hidden" accept="audio/*,image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </label>
      </div>
      {media.isLoading ? (
        <PageLoader />
      ) : !media.data?.length ? (
        <EmptyState title={t('admin.media.empty')} />
      ) : (
        <ul className="media-grid">
          {media.data.map((file) => (
            <li key={file.name} className="media-grid__item">
              {/\.(png|jpe?g|webp)$/.test(file.name) ? <img src={file.url} alt="" loading="lazy" /> : <audio controls src={file.url} preload="none" />}
              <code className="caption">{file.url}</code>
              <span className="caption">
                {t('admin.media.size', { n: Math.round(file.size / 1024) })} · {i18n.date(file.uploadedAt, { day: 'numeric', month: 'short' })}
              </span>
              <div className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(file.url);
                    toast(t('admin.media.copied'));
                  }}
                >
                  <Copy size={14} aria-hidden />
                  {t('admin.media.copy')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon
                  aria-label={t('common.delete')}
                  onClick={() => window.confirm(t('admin.content.confirmDelete', { title: file.name })) && remove.mutate(file.name)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
