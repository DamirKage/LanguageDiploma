import type { LocalizedText } from '@linguapath/shared';

/** The few interface strings the server has to store in generated records (attempt titles). */
const TEXTS = {
  practiceMixed: { ru: 'Практика по слабым местам' },
  practiceTopic: { ru: 'Практика: {topic}' },
} satisfies Record<string, LocalizedText>;

export function serverText(key: keyof typeof TEXTS, params: Record<string, LocalizedText> = {}): LocalizedText {
  const template: LocalizedText = TEXTS[key];
  const out: Record<string, string> = {};
  for (const [locale, text] of Object.entries(template)) {
    if (text === undefined) continue;
    out[locale] = text.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = params[name];
      return value ? (value[locale] ?? value.ru) : '';
    });
  }
  return out as LocalizedText;
}
