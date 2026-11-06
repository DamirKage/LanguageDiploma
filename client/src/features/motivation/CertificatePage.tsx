import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Printer, ShieldCheck } from 'lucide-react';
import { motivationApi } from '../../api/endpoints';
import { Button, ErrorState, PageLoader, useTitle, useToast } from '../../components/ui';
import { Brand } from '../../components/layout/AppShell';
import { useI18n } from '../../i18n';
import { qk } from '../../lib/queries';

/**
 * Public certificate page. Anyone with the link or the code can check it; it shows the name, level, course and
 * results, never the email. "Print" produces an A4 sheet (or a PDF through the browser's print dialog).
 */
export default function CertificatePage() {
  const { code = '' } = useParams<{ code: string }>();
  const i18n = useI18n();
  const { t, plural } = i18n;
  const toast = useToast();
  const cert = useQuery({ queryKey: qk.certificate(code), queryFn: () => motivationApi.certificate(code), retry: false });
  useTitle(null, cert.data ? t('certificate.pageTitle', { level: cert.data.level, name: cert.data.name }) : t('certificate.title'));

  if (cert.isLoading) return <PageLoader />;
  if (cert.error || !cert.data) {
    return (
      <main className="certificate-page">
        <h1>{t('certificate.notFound')}</h1>
        <ErrorState error={cert.error ?? new Error('not_found')} />
        <p className="caption">
          <Link to="/">LinguaPath</Link>
        </p>
      </main>
    );
  }
  const c = cert.data;
  const url = `${window.location.origin}/certificate/${c.code}`;
  const issued = i18n.date(new Date(c.issuedAt), { day: 'numeric', month: 'long', year: 'numeric' });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('certificate.copied'));
    } catch {
      toast(url);
    }
  };

  return (
    <main className="certificate-page">
      <div className="certificate-page__actions no-print">
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          {t('certificate.print')}
        </Button>
        <Button onClick={copy}>
          <Copy size={16} aria-hidden />
          {t('certificate.copy')}
        </Button>
      </div>

      <article className="certificate" aria-labelledby="certificate-name">
        <header className="certificate__head">
          <Brand />
          <span className="certificate__verified">
            <ShieldCheck size={16} aria-hidden />
            {t('certificate.verified')}
          </span>
        </header>

        <p className="certificate__kind">{t('certificate.title')}</p>
        <p className="certificate__lead">{t('certificate.lead', { level: c.level })}</p>
        <h1 id="certificate-name" className="certificate__name">
          {c.name}
        </h1>
        <p className="certificate__course">
          {t('certificate.course', { language: c.languageName })} · <strong>{t(`levels.${c.level}`)}</strong>
        </p>

        <dl className="certificate__stats">
          <div>
            <dt>{t('certificate.stats.lessons')}</dt>
            <dd>{c.stats.lessons}</dd>
          </div>
          <div>
            <dt>{t('certificate.stats.average')}</dt>
            <dd>{c.stats.averagePercent}%</dd>
          </div>
          {c.stats.moduleTests ? (
            <div>
              <dt>{t('certificate.stats.tests')}</dt>
              <dd>{c.stats.moduleTests}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('certificate.stats.words')}</dt>
            <dd>{c.stats.words}</dd>
          </div>
          <div>
            <dt>{t('certificate.stats.time')}</dt>
            <dd>{plural('common.minutes', c.stats.minutes)}</dd>
          </div>
          <div>
            <dt>{t('certificate.stats.days')}</dt>
            <dd>{c.stats.activeDays}</dd>
          </div>
        </dl>

        <footer className="certificate__foot">
          <div>
            <p className="caption">{t('certificate.issued')}</p>
            <p>{issued}</p>
          </div>
          <div>
            <p className="caption">{t('certificate.code')}</p>
            <p className="certificate__code">{c.code}</p>
          </div>
          <div className="certificate__check">
            <p className="caption">{t('certificate.check')}</p>
            <p className="small">{url.replace(/^https?:\/\//, '')}</p>
          </div>
        </footer>
        <p className="certificate__note caption">{t('certificate.note')}</p>
      </article>
    </main>
  );
}
