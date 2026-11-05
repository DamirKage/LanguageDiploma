import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Brand } from '../../components/layout/AppShell';
import { ThemeSwitch } from '../../components/theme/ThemePicker';
import { SpeakButton } from '../lesson/SpeakButton';
import { Decoder } from '../../components/motion/Decoder';
import { RouteLine } from '../../components/motion/RouteLine';
import { useSpotlight } from '../../lib/motion';
import { useSpeaker } from '../../lib/speech';
import { buttonClass, LanguageMark, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useLanguages } from '../../lib/queries';

const PRINCIPLES = ['why', 'placement', 'voices', 'mistakes', 'memory', 'time', 'honest'] as const;

/** A greeting with a prepared recording, so a visitor can hear each voice before signing up. */
const SAMPLE: Record<string, { text: string; locale: string }> = {
  kk: { text: 'Сәлеметсіз бе!', locale: 'kk-KZ' },
  en: { text: 'Good evening!', locale: 'en-US' },
  tr: { text: 'Günaydın!', locale: 'tr-TR' },
  de: { text: 'Guten Tag!', locale: 'de-DE' },
  es: { text: 'Buenos días.', locale: 'es-ES' },
};

const HELLO_ORDER = ['kk', 'en', 'tr', 'de', 'es'] as const;

/** The greeting decodes into each course language in turn; a click plays it in the course voice. */
function HelloLine() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const code = HELLO_ORDER[index]!;
  const { speak } = useSpeaker(SAMPLE[code]!.locale);
  const phrases = useMemo(() => HELLO_ORDER.map((c) => SAMPLE[c]!.text), []);
  return (
    <p className="landing__hello">
      <button type="button" onClick={() => speak(SAMPLE[code]!.text)} title={t('common.listen')}>
        <Decoder phrases={phrases} onChange={setIndex} />
      </button>
      <span className="small muted">{t(`languages.${code}`)}</span>
    </p>
  );
}

export function LandingPage() {
  const { t, plural } = useI18n();
  const { data: languages } = useLanguages();
  const spotlight = useSpotlight<HTMLUListElement>();
  useTitle(null, t('app.tagline'));

  return (
    <div className="public">
      <header className="public__head">
        <Brand />
        <div className="row">
          <ThemeSwitch />
          <Link to="/login" className={buttonClass({ variant: 'ghost' })}>
            {t('auth.toLogin')}
          </Link>
        </div>
      </header>
      <main className="public__main landing" id="main">
        <section className="landing__hero">
          <div className="stack" style={{ '--gap': 'var(--s6)' } as React.CSSProperties}>
            <h1 className="landing__title">{t('landing.title')}</h1>
            <p className="landing__lead">{t('landing.lead')}</p>
            <HelloLine />
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
              <li style={{ '--i': 0 } as React.CSSProperties}>{t('recommendation.reason.low_topic_accuracy', { topic: 'mein / meine', accuracy: 45, answers: plural('common.answers', 11) })}</li>
              <li style={{ '--i': 1 } as React.CSSProperties}>{t('recommendation.reason.declining_trend', { topic: 'mein / meine', from: 80, to: 40 })}</li>
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
          <RouteLine labels={(languages ?? []).map((l) => l.code.toUpperCase())} />
          <ul className="landing__languages spotlight" ref={spotlight}>
            {(languages ?? []).map((lang) => (
              <li key={lang.code}>
                <LanguageMark code={lang.code} size="lg" />
                {SAMPLE[lang.code] ? <SpeakButton text={SAMPLE[lang.code]!.text} locale={SAMPLE[lang.code]!.locale} size="sm" recordingOnly /> : null}
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
