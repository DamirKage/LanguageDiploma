import { describe, expect, it } from 'vitest';
import type { Exercise } from '@linguapath/shared';
import { checkAnswer } from '../../src/modules/learning/checker';
import { toPublicExercise } from '../../src/modules/learning/presenter';

const base = { skill: 'grammar', topic: 'to_be', errorCategory: 'grammar', difficulty: 1, explanation: { ru: 'Пояснение' } } as const;

const choice: Exercise = {
  ...base,
  key: 'c1',
  type: 'choice',
  question: { ru: 'Вопрос' },
  optionsIn: 'target',
  options: ['bin', 'bist', 'ist'],
  correctIndex: 0,
};
const choiceUi: Exercise = {
  ...base,
  key: 'c2',
  type: 'choice',
  question: { ru: 'Что означает?' },
  target: 'dreiundsechzig',
  optionsIn: 'ui',
  options: [{ ru: '63' }, { ru: '36' }],
  correctIndex: 0,
};
const fill: Exercise = { ...base, key: 'f1', type: 'fill_blank', sentence: 'Ich ___ Student.', answers: ['bin'] };
const fillWithOptions: Exercise = { ...fill, key: 'f2', options: ['bin', 'bist'] };
const translateTo: Exercise = { ...base, key: 't1', type: 'translate', direction: 'to_target', source: { ru: 'Я студент.' }, answers: ['Ich bin Student.'] };
const translateBack: Exercise = { ...base, key: 't2', type: 'translate', direction: 'to_ui', source: 'Wir wohnen in Berlin.', answersUi: { ru: ['Мы живём в Берлине'] } };
const order: Exercise = { ...base, key: 'o1', type: 'order', tokens: ['Ich', 'komme', 'aus', 'Almaty'], translation: { ru: 'Я из Алматы.' }, alternatives: [['Aus', 'Almaty', 'komme', 'ich']] };
const match: Exercise = { ...base, key: 'm1', type: 'match', pairs: [{ left: 'ich', right: { ru: 'я' } }, { left: 'du', right: { ru: 'ты' } }] };
const speak: Exercise = { ...base, key: 's1', type: 'speak', errorCategory: 'pronunciation', text: 'Guten Tag', translation: { ru: 'Добрый день' } };
const listen: Exercise = { ...base, key: 'l1', type: 'listen', audioText: 'Guten Abend', mode: 'type', answers: ['Guten Abend'] };
const dialogue: Exercise = {
  ...base,
  key: 'd1',
  type: 'dialogue',
  lines: [
    { speaker: 'A', text: 'Wie heißen Sie?' },
    { speaker: 'B', text: null },
  ],
  options: ['Ich heiße Anna.', 'Tschüss!'],
  correctIndex: 0,
};

describe('checkAnswer', () => {
  it('checks multiple choice in the target language', () => {
    expect(checkAnswer(choice, { type: 'choice', option: 'bin' }, 'de').verdict).toBe('correct');
    const wrong = checkAnswer(choice, { type: 'choice', option: 'ist' }, 'de');
    expect(wrong).toMatchObject({ verdict: 'incorrect', points: 0, category: 'grammar' });
    expect(wrong.feedback.expected).toBe('bin');
  });

  it('checks multiple choice with interface-language options', () => {
    expect(checkAnswer(choiceUi, { type: 'choice', option: '63' }, 'de').verdict).toBe('correct');
  });

  it('awards partial points for spelling slips in typed answers and records a spelling error', () => {
    const r = checkAnswer(translateTo, { type: 'translate', text: 'ich bin student' }, 'de');
    expect(r.verdict).toBe('correct');
    const typo = checkAnswer({ ...translateTo, answers: ['Ich brauche eine Fahrkarte'] }, { type: 'translate', text: 'Ich brauche eine Fahrkrate' }, 'de');
    expect(typo).toMatchObject({ verdict: 'almost', points: 7, category: 'spelling' });
    expect(typo.feedback.note?.code).toBe('typo');
  });

  it('does not accept near-misses when the gap is chosen from options', () => {
    expect(checkAnswer(fillWithOptions, { type: 'fill_blank', text: 'bist' }, 'de').verdict).toBe('incorrect');
    expect(checkAnswer(fill, { type: 'fill_blank', text: 'bin' }, 'de').feedback.expected).toBe('Ich bin Student.');
  });

  it('checks translations into the interface language with ё folding', () => {
    expect(checkAnswer(translateBack, { type: 'translate', text: 'мы живем в берлине' }, 'de').verdict).toBe('correct');
  });

  it('accepts alternative word orders when listed', () => {
    expect(checkAnswer(order, { type: 'order', tokens: ['Ich', 'komme', 'aus', 'Almaty'] }, 'de').verdict).toBe('correct');
    expect(checkAnswer(order, { type: 'order', tokens: ['Aus', 'Almaty', 'komme', 'ich'] }, 'de').verdict).toBe('correct');
    const wrong = checkAnswer(order, { type: 'order', tokens: ['Ich', 'aus', 'komme', 'Almaty'] }, 'de');
    expect(wrong.verdict).toBe('incorrect');
  });

  it('requires all pairs to be matched correctly', () => {
    expect(checkAnswer(match, { type: 'match', pairs: [{ left: 'ich', right: 'я' }, { left: 'du', right: 'ты' }] }, 'de').verdict).toBe('correct');
    expect(checkAnswer(match, { type: 'match', pairs: [{ left: 'ich', right: 'ты' }, { left: 'du', right: 'я' }] }, 'de').verdict).toBe('incorrect');
    expect(checkAnswer(match, { type: 'match', pairs: [{ left: 'ich', right: 'я' }] }, 'de').verdict).toBe('incorrect');
  });

  it('grades speech by similarity and supports skipping', () => {
    expect(checkAnswer(speak, { type: 'speak', transcript: 'guten tag' }, 'de').verdict).toBe('correct');
    expect(checkAnswer(speak, { type: 'speak', transcript: 'guten tak' }, 'de').verdict).toBe('correct');
    expect(checkAnswer(speak, { type: 'speak', transcript: 'gute tak' }, 'de')).toMatchObject({ verdict: 'almost', category: 'pronunciation' });
    expect(checkAnswer(speak, { type: 'speak', transcript: '', skipped: true }, 'de')).toMatchObject({ verdict: 'skipped', points: 0 });
  });

  it('supports skipped listening when speech synthesis is unavailable', () => {
    expect(checkAnswer(listen, { type: 'listen', text: '', skipped: true }, 'kk').verdict).toBe('skipped');
    expect(checkAnswer(listen, { type: 'listen', text: 'guten abend' }, 'de').verdict).toBe('correct');
  });

  it('checks dialogue replies', () => {
    expect(checkAnswer(dialogue, { type: 'dialogue', option: 'Ich heiße Anna.' }, 'de').verdict).toBe('correct');
  });

  it('rejects an answer of a different exercise type', () => {
    expect(() => checkAnswer(choice, { type: 'fill_blank', text: 'bin' }, 'de')).toThrow();
  });
});

describe('toPublicExercise', () => {
  it('never exposes the correct answer fields', () => {
    for (const ex of [choice, fill, translateTo, translateBack, order, match, dialogue]) {
      const view = toPublicExercise(ex, 7) as unknown as Record<string, unknown>;
      expect(view).not.toHaveProperty('answers');
      expect(view).not.toHaveProperty('answersUi');
      expect(view).not.toHaveProperty('correctIndex');
      expect(view).not.toHaveProperty('tokens');
      expect(view).not.toHaveProperty('pairs');
      expect(view).not.toHaveProperty('explanation');
    }
  });

  it('shuffles options deterministically and keeps all of them', () => {
    const a = toPublicExercise(choice, 11);
    const b = toPublicExercise(choice, 11);
    expect(a).toEqual(b);
    expect((a as { options: string[] }).options.sort()).toEqual(['bin', 'bist', 'ist']);
  });
});
