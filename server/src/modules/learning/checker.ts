import {
  POINTS,
  localize,
  type AnswerFeedback,
  type ErrorCategory,
  type Exercise,
  type ExerciseAnswer,
  type Verdict,
} from '@slog/shared';
import { looseKey, matchText, similarity, strictKey } from '../../lib/text';

export interface CheckResult {
  verdict: Verdict;
  points: number;
  /** Category recorded for analytics; only meaningful when the verdict is not `correct`. */
  category: ErrorCategory;
  feedback: AnswerFeedback;
  given: string;
}

const SPEAK_CORRECT = 0.85;
const SPEAK_ALMOST = 0.6;

export function expectedAnswer(ex: Exercise, locale = 'ru'): string {
  switch (ex.type) {
    case 'choice':
      return localize(ex.options[ex.correctIndex], locale);
    case 'dialogue':
      return ex.options[ex.correctIndex]!;
    case 'fill_blank':
      return ex.sentence.replace('___', ex.answers[0]!);
    case 'translate':
      return ex.direction === 'to_target' ? ex.answers![0]! : (ex.answersUi![locale] ?? ex.answersUi!.ru)[0]!;
    case 'order':
      return ex.tokens.join(' ');
    case 'match':
      return ex.pairs.map((p) => `${p.left} — ${localize(p.right, locale)}`).join('; ');
    case 'listen':
      return ex.answers[0]!;
    case 'speak':
      return ex.text;
  }
}

export function promptText(ex: Exercise, locale = 'ru'): string {
  switch (ex.type) {
    case 'choice':
      return [localize(ex.question, locale), ex.target].filter(Boolean).join(' — ');
    case 'fill_blank':
      return ex.sentence;
    case 'translate':
      return localize(ex.source, locale);
    case 'order':
      return localize(ex.translation, locale);
    case 'match':
      return ex.pairs.map((p) => p.left).join(', ');
    case 'listen':
      return ex.audioText;
    case 'dialogue':
      return ex.lines.map((l) => l.text ?? '…').join(' / ');
    case 'speak':
      return ex.text;
  }
}

function describeGiven(answer: ExerciseAnswer): string {
  switch (answer.type) {
    case 'choice':
    case 'dialogue':
      return answer.option;
    case 'listen':
      return answer.skipped ? '' : answer.text;
    case 'fill_blank':
    case 'translate':
      return answer.text;
    case 'order':
      return answer.tokens.join(' ');
    case 'match':
      return answer.pairs.map((p) => `${p.left} — ${p.right}`).join('; ');
    case 'speak':
      return answer.skipped ? '' : answer.transcript;
  }
}

function byVerdict(verdict: Verdict, ex: Exercise, almostCategory: ErrorCategory = 'spelling'): { points: number; category: ErrorCategory } {
  if (verdict === 'correct') return { points: POINTS.correct, category: ex.errorCategory };
  if (verdict === 'almost') return { points: POINTS.almost, category: almostCategory };
  return { points: 0, category: ex.errorCategory };
}

/**
 * Checks an answer against an exercise. `language` is the target language code and
 * drives normalisation rules (Turkish dotless i, Kazakh letters, German umlauts…).
 */
export function checkAnswer(ex: Exercise, answer: ExerciseAnswer, language: string, locale = 'ru'): CheckResult {
  if (answer.type !== ex.type) throw new Error('answer_mismatch');
  const expected = expectedAnswer(ex, locale);
  const explanation = localize(ex.explanation, locale);
  const given = describeGiven(answer);
  let verdict: Verdict = 'incorrect';
  let note: AnswerFeedback['note'];
  let almostCategory: ErrorCategory = 'spelling';

  switch (ex.type) {
    case 'choice': {
      const a = answer as Extract<ExerciseAnswer, { type: 'choice' }>;
      const lang = ex.optionsIn === 'ui' ? locale : language;
      verdict = strictKey(a.option, lang) === strictKey(expected, lang) ? 'correct' : 'incorrect';
      break;
    }
    case 'dialogue': {
      const a = answer as Extract<ExerciseAnswer, { type: 'dialogue' }>;
      verdict = strictKey(a.option, language) === strictKey(expected, language) ? 'correct' : 'incorrect';
      break;
    }
    case 'fill_blank':
    case 'listen': {
      if (answer.type === 'listen' && answer.skipped) {
        verdict = 'skipped';
        break;
      }
      const text = (answer as { text: string }).text;
      const m = matchText(text, ex.answers, language);
      if (ex.type === 'fill_blank' && ex.options) {
        verdict = m.verdict === 'correct' ? 'correct' : 'incorrect';
      } else {
        verdict = m.verdict;
        if (m.verdict === 'almost') note = { code: m.reason, detail: m.matched };
      }
      break;
    }
    case 'translate': {
      const text = (answer as { text: string }).text;
      const accepted = ex.direction === 'to_target' ? ex.answers! : (ex.answersUi![locale] ?? ex.answersUi!.ru);
      const m = matchText(text, accepted, ex.direction === 'to_target' ? language : locale);
      verdict = m.verdict;
      if (m.verdict === 'almost') note = { code: m.reason, detail: m.matched };
      if (m.verdict === 'correct' && strictKey(m.matched, language) !== strictKey(accepted[0]!, language)) {
        note = { code: 'alternative', detail: accepted[0] };
      }
      break;
    }
    case 'order': {
      const tokens = (answer as { tokens: string[] }).tokens;
      const given = strictKey(tokens.join(' '), language);
      const sequences = [ex.tokens, ...(ex.alternatives ?? [])];
      verdict = sequences.some((seq) => strictKey(seq.join(' '), language) === given) ? 'correct' : 'incorrect';
      break;
    }
    case 'match': {
      const pairs = (answer as { pairs: Array<{ left: string; right: string }> }).pairs;
      const expectedPairs = new Map(ex.pairs.map((p) => [strictKey(p.left, language), strictKey(localize(p.right, locale), locale)]));
      const correctCount = pairs.filter((p) => expectedPairs.get(strictKey(p.left, language)) === strictKey(p.right, locale)).length;
      verdict = pairs.length === ex.pairs.length && correctCount === ex.pairs.length ? 'correct' : 'incorrect';
      break;
    }
    case 'speak': {
      const a = answer as Extract<ExerciseAnswer, { type: 'speak' }>;
      if (a.skipped) {
        verdict = 'skipped';
        break;
      }
      const score = similarity(looseKey(a.transcript, language), looseKey(ex.text, language));
      verdict = score >= SPEAK_CORRECT ? 'correct' : score >= SPEAK_ALMOST ? 'almost' : 'incorrect';
      almostCategory = 'pronunciation';
      break;
    }
  }

  const { points, category } = verdict === 'skipped' ? { points: 0, category: ex.errorCategory } : byVerdict(verdict, ex, almostCategory);
  return { verdict, points, category, given, feedback: { verdict, expected, explanation, ...(note ? { note } : {}) } };
}
