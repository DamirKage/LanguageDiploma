import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Brand } from '../../components/layout/AppShell';
import { buttonClass, LanguageMark, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useLanguages } from '../../lib/queries';

const PRINCIPLES = ['why', 'mistakes', 'memory', 'time', 'honest'] as const;

export function LandingPage() {
  const { t, plural } = useI18n();
  const { data: languages } = useLanguages();
  useTitle(null, t('app.tagline'));

  return (
    <div className="public">
      <header className="public__head">
        <Brand />
        <Link to="/login" className={buttonClass({ variant: 'ghost' })}>
          {t('auth.toLogin')}
        </Link>
      </header>
      <main className="public__main landing" id="main">
        <section className="landing__hero">
          <div className="stack" style={{ '--gap': 'var(--s6)' } as React.CSSProperties}>
            <h1 className="landing__title">{t('landing.title')}</h1>
            <p className="landing__lead">{t('landing.lead')}</p>
            <div className="row">
              <Link to="/register" className={buttonClass({ variant: 'primary', size: 'lg' })}>
                {t('landing.ctaStart')}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link to="/login" className={buttonClass({ size: 'lg' })}>
                {t('landing.ctaLogin')}
              </Link>
            </div>
            <p className="caption">{t('landing.demoNote')}</p>
          </div>
          <figure className="landing__specimen" aria-label={t('recommendation.type.weak_topic')}>
            <p className="eyebrow">{t('recommendation.type.weak_topic')}</p>
            <p className="landing__specimen-title">{t('recommendation.title.weak_topic', { topic: 'mein / meine' })}</p>
            <ul className="reason-list">
              <li>{t('recommendation.reason.low_topic_accuracy', { topic: 'mein / meine', accuracy: 45, answers: plural('common.answers', 11) })}</li>
              <li>{t('recommendation.reason.declining_trend', { topic: 'mein / meine', from: 80, to: 40 })}</li>
            </ul>
            <p className="landing__specimen-target target">
              Das ist <mark>meine</mark> Mutter.
            </p>
          </figure>
        </section>

        <section className="landing__section">
          <div className="landing__section-head">
            <h2>{t('landing.languagesTitle')}</h2>
            <p className="muted">{t('landing.languagesLead')}</p>
          </div>
          <ul className="landing__languages">
            {(languages ?? []).map((lang) => (
              <li key={lang.code}>
                <LanguageMark code={lang.code} size="lg" />
                <div>
                  <p className="landing__lang-native target">{lang.nativeName}</p>
                  <p className="muted small">
                    {lang.name} · {lang.levels.join(' · ')} · {plural('common.lessons', lang.lessonCount)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing__section">
          <div className="landing__section-head">
            <h2>{t('landing.principlesTitle')}</h2>
          </div>
          <ol className="landing__principles">
            {PRINCIPLES.map((key, i) => (
              <li key={key}>
                <span className="landing__num" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{t(`landing.principles.${key}.title`)}</h3>
                  <p className="muted">{t(`landing.principles.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
