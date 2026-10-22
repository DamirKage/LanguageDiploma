import { DEFAULT_UI_LOCALE } from './constants';

/** Text written in an interface language, keyed by locale. `ru` is always present. */
export type LocalizedText = { ru: string } & Partial<Record<string, string>>;

export function localize(text: LocalizedText | string | undefined | null, locale: string = DEFAULT_UI_LOCALE): string {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  return text[locale] ?? text[DEFAULT_UI_LOCALE] ?? '';
}

export function ru(text: string): LocalizedText {
  return { ru: text };
}
