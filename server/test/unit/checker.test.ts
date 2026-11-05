import { describe, expect, it } from 'vitest';
import type { Exercise } from '@linguapath/shared';
import { categorize, chat, cloze, errorSpot, finalizeExercise, reading, writing } from '../../src/seed/builders';
import { checkAnswer, containsForm, countWords, expectedAnswer } from '../../src/modules/learning/checker';
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

  it('grades speech by similarity and supports skipping', () => {
    expect(checkAnswer(speak, { type: 'speak', transcript: 'guten tag' }, 'de').verdict).toBe('correct');
    expect(checkAnswer(speak, { type: 'speak', transcript: 'guten tak' }, 'de').verdict).toBe('correct');
    expect(checkAnswer(speak, { type: 'speak', transcript: 'gute tak' }, 'de')).toMatchObject({ verdict: 'almost', category: 'pronunciation' });
    expect(checkAnswer(speak, { type: 'speak', transcript: '', skipped: true }, 'de')).toMatchObject({ verdict: 'skipped', points: 0 });
  });

  it('checks the written alternative of a speaking task strictly', () => {
    expect(checkAnswer(speak, { type: 'speak', transcript: 'Guten Tag', typed: true }, 'de').verdict).toBe('correct');
    expect(checkAnswer(speak, { type: 'speak', transcript: 'Gutten Tag', typed: true }, 'de').verdict).toBe('almost');
    expect(checkAnswer(speak, { type: 'speak', transcript: 'Hallo', typed: true }, 'de').verdict).toBe('incorrect');
  });

  it('supports skipped listening when speech synthesis is unavailable', () => {
    expect(checkAnswer(listen, { type: 'listen', text: '', skipped: true }, 'kk').verdict).toBe('skipped');
    expect(checkAnswer(listen, { type: 'listen', text: 'guten abend' }, 'de').verdict).toBe('correct');
  });

  it('checks dialogue replies', () => {
    expect(checkAnswer(dialogue, { type: 'dialogue', option: 'Ich heiße Anna.' }, 'de').verdict).toBe('correct');
  });

  it('checks the new interactive types and gives partial credit for multi-part answers', () => {
    const spot = finalizeExercise(errorSpot('Gestern habe ich ins Kino gegangen.', 'habe', 'bin', 'gehen → sein'), 'e1', 'past_tense');
    expect(checkAnswer(spot, { type: 'error_spot', index: 1 }, 'de').verdict).toBe('correct');
    expect(checkAnswer(spot, { type: 'error_spot', index: 0 }, 'de').verdict).toBe('incorrect');
    expect(expectedAnswer(spot)).toBe('Gestern bin ich ins Kino gegangen.');

    const text = finalizeExercise(cloze('Ich [bin|habe] müde, [weil|dass] ich spät [geschlafen|schlafe] habe.', '…'), 'c1', 'conjunctions');
    expect(checkAnswer(text, { type: 'cloze_text', choices: ['bin', 'weil', 'geschlafen'] }, 'de').verdict).toBe('correct');
    expect(checkAnswer(text, { type: 'cloze_text', choices: ['bin', 'weil', 'schlafe'] }, 'de')).toMatchObject({ verdict: 'almost', points: 7 });
    expect(checkAnswer(text, { type: 'cloze_text', choices: ['habe', 'dass', 'schlafe'] }, 'de').verdict).toBe('incorrect');
    expect(expectedAnswer(text)).toBe('Ich bin müde, weil ich spät geschlafen habe.');

    const talk = finalizeExercise(
      chat([['Hallo!', 'Привет!', ['Hallo!', 'Tschüss!'], 0], ['Wie geht’s?', 'Как дела?', ['Gut, danke.', 'Ich heiße Anna.'], 0]], '…'),
      'h1',
      'greetings',
    );
    expect(checkAnswer(talk, { type: 'chat', replies: ['Hallo!', 'Gut, danke.'] }, 'de').verdict).toBe('correct');
    expect(checkAnswer(talk, { type: 'chat', replies: ['Hallo!', 'Ich heiße Anna.'] }, 'de').verdict).toBe('incorrect');

    const sort = finalizeExercise(categorize(['der', 'die'], [['Tisch', 0], ['Lampe', 1], ['Stuhl', 0], ['Tür', 1]], '…'), 'g1', 'articles');
    const right = [{ text: 'Tisch', category: 0 }, { text: 'Lampe', category: 1 }, { text: 'Stuhl', category: 0 }, { text: 'Tür', category: 1 }];
    expect(checkAnswer(sort, { type: 'categorize', placement: right }, 'de').verdict).toBe('correct');
    expect(checkAnswer(sort, { type: 'categorize', placement: [...right.slice(0, 3), { text: 'Tür', category: 0 }] }, 'de').verdict).toBe('almost');
    const half = checkAnswer(sort, { type: 'categorize', placement: [right[0]!, right[1]!, { text: 'Stuhl', category: 1 }, { text: 'Tür', category: 0 }] }, 'de');
    expect(half.verdict).toBe('incorrect');
    expect(half.points).toBe(5);
    for (const ex of [spot, text, talk, sort]) {
      const view = toPublicExercise(ex, 3) as unknown as Record<string, unknown>;
      expect(JSON.stringify(view)).not.toMatch(/errorIndex|correction|correctIndex|"answer"|"category"/);
    }
  });

  it('checks reading questions part by part and hides nothing the learner needs', () => {
    const text = finalizeExercise(
      reading(
        {
          passage: ['Anna wohnt in Berlin.', 'Sie arbeitet in einer Bäckerei.'],
          translation: 'Анна живёт в Берлине. Она работает в пекарне.',
          questions: [
            ['Где живёт Анна?', ['в Берлине', 'в Мюнхене', 'в Вене'], 0],
            ['Где она работает?', ['в банке', 'в пекарне'], 1],
            ['Wer arbeitet in der Bäckerei?', ['Anna', 'Paul'], 0, true],
          ],
        },
        '…',
      ),
      'r1',
      'work',
    );
    expect(text.skill).toBe('reading');
    const all = checkAnswer(text, { type: 'reading', choices: ['в Берлине', 'в пекарне', 'Anna'] }, 'de');
    expect(all.verdict).toBe('correct');
    expect(all.feedback.translation).toContain('Анна');
    const two = checkAnswer(text, { type: 'reading', choices: ['в Берлине', 'в банке', 'Anna'] }, 'de');
    expect(two.feedback.parts).toEqual([true, false, true]);
    expect(two.verdict).toBe('almost');
    const view = toPublicExercise(text, 1) as unknown as { passage: unknown[]; questions: Array<{ options: string[] }> };
    expect(view.passage).toHaveLength(2);
    expect(JSON.stringify(view)).not.toMatch(/correctIndex|translation/);
    expect(finalizeExercise(reading({ mode: 'listen', passage: [['A', 'Hallo!'], ['B', 'Hi!']], questions: [['?', ['a', 'b'], 0]] }, '…'), 'r2', 'x').skill).toBe('listening');
  });

  it('checks free writing for length and required constructions and returns the model answer with a checklist', () => {
    const task = finalizeExercise(
      writing(
        {
          task: 'Напишите, что вы делали вчера.',
          minWords: 8,
          required: [
            ['Perfekt', ['habe', 'bin']],
            ['Слово-связка', ['dann', 'danach']],
          ],
          model: 'Gestern habe ich lange geschlafen. Dann bin ich ins Kino gegangen.',
          checklist: ['Глагол на втором месте', 'Причастие в конце'],
        },
        '…',
      ),
      'w1',
      'past_tense',
    );
    const good = checkAnswer(task, { type: 'writing', text: 'Am Morgen habe ich gefrühstückt und danach bin ich gelaufen.' }, 'de');
    expect(good.verdict).toBe('correct');
    expect(good.feedback.expected).toContain('Gestern');
    expect(good.feedback.checklist).toHaveLength(2);
    const short = checkAnswer(task, { type: 'writing', text: 'Ich habe gegessen.' }, 'de');
    expect(short.feedback.parts).toEqual([false, true, false]);
    expect(short.verdict).toBe('incorrect');
    expect(short.points).toBe(3);
    expect(containsForm('Мен кітап оқыдым', '-дым', 'kk')).toBe(true);
    expect(containsForm('Ich wohne hier', 'ohne', 'de')).toBe(false);
    expect(countWords('Hallo,  wie geht – es?')).toBe(4);
  });

  it('rejects an answer of a different exercise type', () => {
    expect(() => checkAnswer(choice, { type: 'fill_blank', text: 'bin' }, 'de')).toThrow();
  });
});

describe('toPublicExercise', () => {
  it('never exposes the correct answer fields', () => {
    for (const ex of [choice, fill, translateTo, translateBack, order, dialogue, speak]) {
      const view = toPublicExercise(ex, 7) as unknown as Record<string, unknown>;
      expect(view).not.toHaveProperty('answers');
      expect(view).not.toHaveProperty('answersUi');
      expect(view).not.toHaveProperty('correctIndex');
      expect(view).not.toHaveProperty('tokens');
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
