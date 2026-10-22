import { Link } from 'react-router-dom';
import { Brand } from '../../components/layout/AppShell';
import { buttonClass, EmptyState, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';

export function NotFoundPage() {
  const { t } = useI18n();
  useTitle('notFound.title');
  return (
    <div className="public">
      <header className="public__head">
        <Brand />
      </header>
      <main className="public__main" id="main">
        <EmptyState
          title={t('notFound.title')}
          lead={t('notFound.lead')}
          action={
            <Link to="/" className={buttonClass({ variant: 'primary' })}>
              {t('notFound.home')}
            </Link>
          }
        />
      </main>
    </div>
  );
}
