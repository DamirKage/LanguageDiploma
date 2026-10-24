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
    case 'match': {
      const rights = ex.pairs.map((p) => localize(p.right));
      const shifted = correct ? rights : [...rights.slice(1), rights[0]!];
      return { type: 'match', pairs: ex.pairs.map((p, i) => ({ left: p.left, right: shifted[i]! })) };
    }
    case 'listen': {
      const wrong = ex.options?.find((o) => !ex.answers.includes(o)) ?? 'xyz';
      return { type: 'listen', text: correct ? ex.answers[0]! : wrong };
    }
    case 'speak':
      return { type: 'speak', transcript: correct ? ex.text : 'abc' };
  }
}
