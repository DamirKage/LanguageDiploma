import { useI18n } from '../../i18n';
import { setTheme, THEMES, useTheme, type ThemeName } from '../../lib/theme';

function Swatch({ theme }: { theme: ThemeName }) {
  return (
    <span className={`theme-swatch theme-swatch--${theme}`} aria-hidden>
      <span />
      <span />
    </span>
  );
}

/** Full picker with descriptions, for the profile page. */
export function ThemePicker() {
  const { t } = useI18n();
  const current = useTheme();
  return (
    <fieldset className="theme-picker">
      <legend className="visually-hidden">{t('theme.label')}</legend>
      {THEMES.map((theme) => (
        <label key={theme} className="theme-option">
          <input type="radio" name="theme" value={theme} checked={current === theme} onChange={() => setTheme(theme)} />
          <Swatch theme={theme} />
          <span className="theme-option__text">
            <span className="theme-option__name">{t(`theme.${theme}`)}</span>
            <span className="theme-option__hint">{t(`theme.${theme}Hint`)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Compact row of swatches for the sidebar and public headers. */
export function ThemeSwitch() {
  const { t } = useI18n();
  const current = useTheme();
  return (
    <div className="theme-switch" role="radiogroup" aria-label={t('theme.label')}>
      {THEMES.map((theme) => (
        <button
          key={theme}
          type="button"
          role="radio"
          aria-checked={current === theme}
          className="theme-switch__item"
          title={t(`theme.${theme}`)}
          aria-label={t(`theme.${theme}`)}
          onClick={() => setTheme(theme)}
        >
          <Swatch theme={theme} />
        </button>
      ))}
    </div>
  );
}
