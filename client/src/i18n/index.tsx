import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ru, type Messages } from './locales/ru';

/** Registered interface locales. Adding a language means adding a `Messages` object here. */
const LOCALES: Record<string, Messages> = { ru };
export const DEFAULT_LOCALE = 'ru';

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string ? never : { [K in keyof T]: T[K] extends string ? K : T[K] extends PluralForms ? K : K | Join<K, Paths<T[K]>> }[keyof T];
type PluralForms = { one: string; few: string; many: string; other: string };
export type MessageKey = Paths<Messages> & string;
export type Params = Record<string, string | number>;

function lookup(messages: Messages, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages);
}

function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export interface Translator {
  locale: string;
  t: (key: MessageKey, params?: Params) => string;
  /** Picks the plural form for `n` and substitutes `{n}`. */
  plural: (key: MessageKey, n: number, params?: Params) => string;
  has: (key: string) => boolean;
  /** Looks up a dynamic key (e.g. from API data) with a fallback. */
  tx: (key: string, fallback: string, params?: Params) => string;
  number: (n: number, options?: Intl.NumberFormatOptions) => string;
  date: (d: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

export function createTranslator(locale: string): Translator {
  const messages = LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE]!;
  const pluralRules = new Intl.PluralRules(locale);
  const t = (key: MessageKey, params?: Params) => {
    const value = lookup(messages, key);
    return typeof value === 'string' ? interpolate(value, params) : key;
  };
  return {
    locale,
    t,
    plural: (key, n, params) => {
      const forms = lookup(messages, key) as Record<string, string> | undefined;
      if (!forms || typeof forms !== 'object') return String(n);
      const form = forms[pluralRules.select(n)] ?? forms.other ?? '';
      return interpolate(form, { n: new Intl.NumberFormat(locale).format(n), ...params });
    },
    has: (key) => typeof lookup(messages, key) === 'string',
    tx: (key, fallback, params) => {
      const value = lookup(messages, key);
      return typeof value === 'string' ? interpolate(value, params) : fallback;
    },
    number: (n, options) => new Intl.NumberFormat(locale, options).format(n),
    date: (d, options) => new Intl.DateTimeFormat(locale, options ?? { day: 'numeric', month: 'long' }).format(typeof d === 'string' ? new Date(d) : d),
  };
}

const I18nContext = createContext<Translator>(createTranslator(DEFAULT_LOCALE));

export function I18nProvider({ locale = DEFAULT_LOCALE, children }: { locale?: string; children: ReactNode }) {
  const translator = useMemo(() => createTranslator(locale), [locale]);
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export function useI18n(): Translator {
  return useContext(I18nContext);
}
