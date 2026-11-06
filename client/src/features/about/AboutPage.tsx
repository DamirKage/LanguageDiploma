import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Brand } from '../../components/layout/AppShell';
import { ThemeSwitch } from '../../components/theme/ThemePicker';
import { buttonClass, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { TEAM } from './team';

/** Figures of the current catalogue; updated together with the content (see docs/architecture.md). */
const FIGURES = { languages: 5, lessons: 105, tasks: 1289, types: 13, words: 759, recordings: 5170 };

const VOICES: Array<[language: string, voices: string, licence: string]> = [
  ['Казахский', 'ISSAI KazakhTTS2', 'CC BY 4.0, Институт умных систем и искусственного интеллекта (ISSAI), Назарбаев Университет'],
  ['Английский', 'LJ Speech, LibriTTS-R', 'общественное достояние, CC BY 4.0'],
  ['Турецкий', 'fettah, fahrettin', 'CC0'],
  ['Немецкий', 'Thorsten, Kerstin', 'CC0'],
  ['Испанский', 'SHarvard', 'CC BY 3.0, Эдинбургский университет'],
];

const SOURCES = [
  'Cepeda N. J. и др. Distributed practice in verbal recall tasks: A review and quantitative synthesis // Psychological Bulletin. 2006. Т. 132, № 3.',
  'Roediger H. L., Karpicke J. D. Test-enhanced learning: Taking memory tests improves long-term retention // Psychological Science. 2006. Т. 17, № 3.',
  'Krashen S. Principles and Practice in Second Language Acquisition. Oxford: Pergamon, 1982.',
  'Council of Europe. Common European Framework of Reference for Languages: Companion Volume. Strasbourg, 2020.',
  'Woźniak P. A. Optimization of learning (алгоритм SM-2). Познань, 1990.',
];

export default function AboutPage() {
  const { t } = useI18n();
  const { status } = useAuth();
  useTitle('about.title');
  const steps = ['placement', 'plan', 'lesson', 'review', 'tests', 'certificate'] as const;
  const methods = ['spacing', 'retrieval', 'input', 'cefr', 'adaptive'] as const;

  return (
    <div className="public">
      <header className="public__head">
        <Brand />
        <div className="row">
          <ThemeSwitch />
          {status === 'authenticated' ? (
            <Link to="/today" className={buttonClass({ variant: 'ghost' })}>
              {t('about.toApp')}
            </Link>
          ) : (
            <Link to="/register" className={buttonClass({ variant: 'primary' })}>
              {t('about.start')}
            </Link>
          )}
        </div>
      </header>

      <main id="main" className="about">
        <section className="about__hero">
          <p className="eyebrow">{t('about.eyebrow')}</p>
          <h1>{t('about.headline')}</h1>
          <p className="about__lead">{t('about.lead')}</p>
          <dl className="about__figures">
            {Object.entries(FIGURES).map(([key, value]) => (
              <div key={key}>
                <dd>{value.toLocaleString('ru-RU')}</dd>
                <dt>{t(`about.figures.${key as keyof typeof FIGURES}`)}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="about__section">
          <h2>{t('about.how.title')}</h2>
          <ol className="about__steps">
            {steps.map((key, i) => (
              <li key={key} style={{ '--i': i } as React.CSSProperties}>
                <span className="landing__num" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{t(`about.how.${key}.title`)}</h3>
                  <p className="muted">{t(`about.how.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="about__section">
          <h2>{t('about.method.title')}</h2>
          <ul className="about__cards">
            {methods.map((key) => (
              <li key={key}>
                <h3>{t(`about.method.${key}.title`)}</h3>
                <p className="muted">{t(`about.method.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="about__section about__honest">
          <h2>{t('about.helps.title')}</h2>
          <div className="about__columns">
            <div>
              <h3>{t('about.helps.yesTitle')}</h3>
              <ul>
                <li>{t('about.helps.yes1')}</li>
                <li>{t('about.helps.yes2')}</li>
                <li>{t('about.helps.yes3')}</li>
              </ul>
            </div>
            <div>
              <h3>{t('about.helps.noTitle')}</h3>
              <ul>
                <li>{t('about.helps.no1')}</li>
                <li>{t('about.helps.no2')}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about__section">
          <h2>{t('about.motivation.title')}</h2>
          <p>{t('about.motivation.body')}</p>
          <h3>{t('about.cert.title')}</h3>
          <p>{t('about.cert.body')}</p>
          <p className="caption">{t('about.cert.note')}</p>
        </section>

        <section className="about__section">
          <h2>{t('about.privacy.title')}</h2>
          <ul className="about__list">
            <li>{t('about.privacy.stored')}</li>
            <li>{t('about.privacy.noThirdParty')}</li>
            <li>{t('about.privacy.voice')}</li>
            <li>{t('about.privacy.delete')}</li>
          </ul>
        </section>

        <section className="about__section">
          <h2>{t('about.voices.title')}</h2>
          <p className="muted">{t('about.voices.lead')}</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('about.voices.language')}</th>
                  <th>{t('about.voices.voices')}</th>
                  <th>{t('about.voices.licence')}</th>
                </tr>
              </thead>
              <tbody>
                {VOICES.map(([language, voices, licence]) => (
                  <tr key={language}>
                    <td>{language}</td>
                    <td>{voices}</td>
                    <td className="small">{licence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="about__section">
          <h2>{t('about.sources.title')}</h2>
          <ol className="about__sources small">
            {SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <section className="about__section">
          <h2>{t('about.project.title')}</h2>
          <p>{t('about.project.body')}</p>
          {TEAM.length ? (
            <ul className="about__team">
              {TEAM.map((m) => (
                <li key={m.name}>
                  <strong>{m.name}</strong>
                  <span className="muted"> — {m.role}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <p className="about__cta">
          {status === 'authenticated' ? (
            <Link to="/today" className={buttonClass({ variant: 'primary', size: 'lg' })}>
              {t('about.toApp')}
            </Link>
          ) : (
            <Link to="/register" className={buttonClass({ variant: 'primary', size: 'lg' })}>
              {t('about.start')}
            </Link>
          )}
        </p>
      </main>
    </div>
  );
}
