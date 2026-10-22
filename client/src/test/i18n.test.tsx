import { describe, expect, it } from 'vitest';
import { createTranslator } from '../i18n';
import { ru } from '../i18n/locales/ru';
import { reasonText, recommendationTitle } from '../features/today/recommendationText';

const i18n = createTranslator('ru');
const helpers = { topicTitle: (k: string) => ({ possessive: 'Притяжательные формы' })[k] ?? k };

describe('translator', () => {
  it('interpolates parameters', () => {
    expect(i18n.t('today.greeting.morning', { name: 'Алия' })).toBe('Доброе утро, Алия');
  });

  it('applies Russian plural rules', () => {
    expect(i18n.plural('common.words', 1)).toBe('1 слово');
    expect(i18n.plural('common.words', 3)).toBe('3 слова');
    expect(i18n.plural('common.words', 5)).toBe('5 слов');
    expect(i18n.plural('common.words', 21)).toBe('21 слово');
    expect(i18n.plural('common.words', 112)).toBe('112 слов');
  });

  it('falls back for unknown dynamic keys', () => {
    expect(i18n.tx('languages.it', 'Итальянский')).toBe('Итальянский');
    expect(i18n.tx('languages.kk', 'x')).toBe('Казахский');
  });

  it('contains no Latin-only interface strings in the Russian dictionary', () => {
    const allowed = /^(?:[^A-Za-z]*|.*(?:CEFR|SM-2|Wiktionary|MP3|OGG|WAV|WebM|PNG|JPEG|WebP|ISO 639-1|A1|A2|B1|B2|demo@slog\.local|SlogDemo2026|de-a1-weather|Enter|mein|meine|Das ist).*)$/;
    const offenders: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        const text = node.replace(/\{\w+\}/g, '');
        if (/[A-Za-z]{3,}/.test(text) && !allowed.test(text)) offenders.push(`${path}: ${node}`);
      } else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
    };
    walk(ru, 'ru');
    expect(offenders).toEqual([]);
  });
});

describe('recommendation text', () => {
  it('renders reasons as Russian sentences with correct plurals', () => {
    expect(reasonText({ code: 'low_topic_accuracy', params: { topic: 'possessive', accuracy: 45, answers: 11 } }, i18n, helpers)).toBe(
      'Точность по теме «Притяжательные формы» — 45% (11 ответов).',
    );
    expect(reasonText({ code: 'reviews_due', params: { count: 2 } }, i18n, helpers)).toBe('Сегодня пора повторить 2 слова.');
    expect(reasonText({ code: 'recurring_error', params: { category: 'word_order', count: 4 } }, i18n, helpers)).toContain('«Порядок слов»: 4 ошибки');
  });

  it('builds titles from targets', () => {
    expect(
      recommendationTitle({ key: 'review', type: 'review', score: 1, estimatedMinutes: 3, target: { reviewCount: 5 }, reasons: [], features: {} }, i18n, helpers),
    ).toBe('Повторить 5 слов');
  });
});
