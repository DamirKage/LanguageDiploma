import {
  POINTS,
  localize,
  type AnswerFeedback,
  type ErrorCategory,
  type Exercise,
  type ExerciseAnswer,
  type Verdict,
} from '@linguapath/shared';
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
    case 'listen':
      return ex.answers[0]!;
    case 'speak':
      return ex.text;
    case 'error_spot':
      return ex.tokens.map((t, i) => (i === ex.errorIndex ? ex.correction : t)).join(' ');
    case 'cloze_text':
      return fillGaps(ex.text, ex.gaps.map((g) => g.answer));
    case 'chat':
      return ex.turns.map((t) => t.options[t.correctIndex]!).join(' / ');
    case 'categorize':
      return ex.categories
        .map((c, i) => `${localize(c, locale)}: ${ex.items.filter((it) => it.category === i).map((it) => it.text).join(', ')}`)
        .join('; ');
    case 'reading':
      return ex.questions.map((q) => localize(q.options[q.correctIndex], locale)).join(' / ');
    case 'writing':
      return ex.modelAnswer;
  }
}

/** Replaces `{0}`, `{1}`, … in a cloze text; `___` for gaps without a value. */
export function fillGaps(text: string, values: Array<string | undefined>): string {
  return text.replace(/\{(\d+)\}/g, (_, n: string) => values[Number(n)] || '___');
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
}

/**
 * Whether a construction occurs in a free text. A form starting with "-" is a suffix and may stand inside a word
 * (agglutinative languages); any other form has to start at a word boundary.
 */
export function containsForm(text: string, form: string, language: string): boolean {
  const hay = ` ${looseKey(text, language)} `;
  if (form.startsWith('-')) return hay.includes(looseKey(form.slice(1), language));
  return hay.includes(` ${looseKey(form, language)}`);
}

/** Several parts answered at once: all right, all but a small share right, or not. */
function partsVerdict(correct: number, total: number): Verdict {
  if (correct === total) return 'correct';
  return total >= 3 && correct / total >= 0.66 ? 'almost' : 'incorrect';
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
    case 'listen':
      return ex.audioText;
    case 'dialogue':
      return ex.lines.map((l) => l.text ?? '…').join(' / ');
    case 'speak':
      return ex.text;
    case 'error_spot':
      return ex.tokens.join(' ');
    case 'cloze_text':
      return fillGaps(ex.text, []);
    case 'chat':
      return ex.turns.map((t) => t.message).join(' / ');
    case 'categorize':
      return ex.items.map((it) => it.text).join(', ');
    case 'reading':
      return ex.title ?? ex.passage[0]?.text ?? '';
    case 'writing':
      return localize(ex.task, locale);
  }
}

function describeGiven(answer: ExerciseAnswer, ex: Exercise, locale: string): string {
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
    case 'speak':
      return answer.skipped ? '' : answer.transcript;
    case 'error_spot':
      return ex.type === 'error_spot' ? (ex.tokens[answer.index] ?? '') : '';
    case 'cloze_text':
      return answer.choices.join(', ');
    case 'chat':
      return answer.replies.join(' / ');
    case 'categorize':
      return ex.type === 'categorize'
        ? answer.placement.map((p) => `${p.text} → ${localize(ex.categories[p.category] ?? '', locale)}`).join('; ')
        : '';
    case 'reading':
      return answer.choices.join(' / ');
    case 'writing':
      return answer.text;
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
  const given = describeGiven(answer, ex, locale);
  let verdict: Verdict = 'incorrect';
  let note: AnswerFeedback['note'];
  let almostCategory: ErrorCategory = 'spelling';
  let parts: boolean[] | undefined;

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
    case 'speak': {
      const a = answer as Extract<ExerciseAnswer, { type: 'speak' }>;
      if (a.skipped) {
        verdict = 'skipped';
        break;
      }
      if (a.typed) {
        // Alternative task when speech recognition is unavailable: the learner writes the phrase from memory.
        const m = matchText(a.transcript, [ex.text], language);
        verdict = m.verdict;
        if (m.verdict === 'almost') note = { code: m.reason, detail: m.matched };
        break;
      }
      const score = similarity(looseKey(a.transcript, language), looseKey(ex.text, language));
      verdict = score >= SPEAK_CORRECT ? 'correct' : score >= SPEAK_ALMOST ? 'almost' : 'incorrect';
      almostCategory = 'pronunciation';
      break;
    }
  }

  switch (ex.type) {
    case 'error_spot': {
      verdict = (answer as Extract<ExerciseAnswer, { type: 'error_spot' }>).index === ex.errorIndex ? 'correct' : 'incorrect';
      parts = ex.tokens.map((_, i) => i !== ex.errorIndex);
      break;
    }
    case 'cloze_text': {
      const choices = (answer as Extract<ExerciseAnswer, { type: 'cloze_text' }>).choices;
      parts = ex.gaps.map((g, i) => choices[i] !== undefined && strictKey(choices[i]!, language) === strictKey(g.answer, language));
      verdict = partsVerdict(parts.filter(Boolean).length, ex.gaps.length);
      almostCategory = ex.errorCategory;
      break;
    }
    case 'chat': {
      const replies = (answer as Extract<ExerciseAnswer, { type: 'chat' }>).replies;
      parts = ex.turns.map((t, i) => replies[i] !== undefined && strictKey(replies[i]!, language) === strictKey(t.options[t.correctIndex]!, language));
      verdict = partsVerdict(parts.filter(Boolean).length, ex.turns.length);
      almostCategory = ex.errorCategory;
      break;
    }
    case 'categorize': {
      const placement = (answer as Extract<ExerciseAnswer, { type: 'categorize' }>).placement;
      parts = placement.map((p) => ex.items.some((it) => strictKey(p.text, language) === strictKey(it.text, language) && p.category === it.category));
      const right = parts.filter(Boolean).length;
      verdict = partsVerdict(placement.length === ex.items.length ? right : Math.min(right, ex.items.length - 1), ex.items.length);
      almostCategory = ex.errorCategory;
      break;
    }
    case 'reading': {
      const choices = (answer as Extract<ExerciseAnswer, { type: 'reading' }>).choices;
      parts = ex.questions.map((q, i) => choices[i] !== undefined && strictKey(choices[i]!, language) === strictKey(localize(q.options[q.correctIndex], locale), language));
      verdict = partsVerdict(parts.filter(Boolean).length, ex.questions.length);
      almostCategory = ex.errorCategory;
      break;
    }
    case 'writing': {
      const text = (answer as Extract<ExerciseAnswer, { type: 'writing' }>).text;
      const words = countWords(text);
      const lengthOk = words >= ex.minWords && (!ex.maxWords || words <= Math.ceil(ex.maxWords * 1.25));
      parts = [lengthOk, ...ex.required.map((r) => words >= 3 && r.forms.some((f) => containsForm(text, f, language)))];
      verdict = partsVerdict(parts.filter(Boolean).length, parts.length);
      almostCategory = ex.errorCategory;
      break;
    }
    default:
      break;
  }

  const { points: base, category } = verdict === 'skipped' ? { points: 0, category: ex.errorCategory } : byVerdict(verdict, ex, almostCategory);
  // Multi-part tasks (gaps, chat turns, groups) earn a share of the points even when the verdict is "incorrect":
  // 4 of 8 items sorted correctly is not the same as none.
  const share = parts && parts.length ? parts.filter(Boolean).length / parts.length : 0;
  const points = verdict === 'incorrect' && share > 0 ? Math.floor(POINTS.correct * share) : base;
  const extra: Pick<AnswerFeedback, 'checklist' | 'translation'> = {};
  if (ex.type === 'writing') {
    extra.checklist = ex.checklist.map((c) => localize(c, locale));
    if (ex.modelTranslation) extra.translation = localize(ex.modelTranslation, locale);
  }
  if (ex.type === 'reading' && ex.translation) extra.translation = localize(ex.translation, locale);
  return { verdict, points, category, given, feedback: { verdict, expected, explanation, ...(note ? { note } : {}), ...(parts ? { parts } : {}), ...extra } };
}
