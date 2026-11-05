import { localize, type Exercise, type ExerciseAnswer } from '@linguapath/shared';

/**
 * Produces a correct or deliberately wrong answer for an exercise. Used to build
 * the demonstration history and in automated tests of the learning flow.
 */
export function simulateAnswer(ex: Exercise, correct: boolean): ExerciseAnswer {
  switch (ex.type) {
    case 'choice': {
      const options = ex.options.map((o) => localize(o));
      const wrong = options.find((_, i) => i !== ex.correctIndex)!;
      return { type: 'choice', option: correct ? options[ex.correctIndex]! : wrong };
    }
    case 'dialogue':
      return { type: 'dialogue', option: correct ? ex.options[ex.correctIndex]! : ex.options.find((_, i) => i !== ex.correctIndex)! };
    case 'fill_blank': {
      const wrong = ex.options?.find((o) => !ex.answers.includes(o)) ?? 'xyz';
      return { type: 'fill_blank', text: correct ? ex.answers[0]! : wrong };
    }
    case 'translate':
      return { type: 'translate', text: correct ? (ex.direction === 'to_target' ? ex.answers![0]! : ex.answersUi!.ru[0]!) : 'не знаю' };
    case 'order':
      return { type: 'order', tokens: correct ? ex.tokens : [...ex.tokens].reverse() };
    case 'listen': {
      const wrong = ex.options?.find((o) => !ex.answers.includes(o)) ?? 'xyz';
      return { type: 'listen', text: correct ? ex.answers[0]! : wrong };
    }
    case 'speak':
      return { type: 'speak', transcript: correct ? ex.text : 'abc' };
    case 'error_spot':
      return { type: 'error_spot', index: correct ? ex.errorIndex : (ex.errorIndex + 1) % ex.tokens.length };
    case 'cloze_text':
      return { type: 'cloze_text', choices: ex.gaps.map((g) => (correct ? g.answer : (g.options.find((o) => o !== g.answer) ?? 'xyz'))) };
    case 'chat':
      return { type: 'chat', replies: ex.turns.map((t) => (correct ? t.options[t.correctIndex]! : t.options.find((_, i) => i !== t.correctIndex)!)) };
    case 'categorize':
      return {
        type: 'categorize',
        placement: ex.items.map((it) => ({ text: it.text, category: correct ? it.category : (it.category + 1) % ex.categories.length })),
      };
    case 'reading':
      return {
        type: 'reading',
        choices: ex.questions.map((q) => localize(q.options[correct ? q.correctIndex : (q.correctIndex + 1) % q.options.length], 'ru')),
      };
    case 'writing':
      return { type: 'writing', text: correct ? ex.modelAnswer : 'abc' };
  }
}
