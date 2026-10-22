const PUNCTUATION = /[.,!?;:¡¿"«»„“”()\[\]…–—\-]/g;
const APOSTROPHES = /[’‘`´ʼ]/g;

const LOWERCASE_LOCALE: Record<string, string> = { tr: 'tr', kk: 'kk', de: 'de', es: 'es', en: 'en', ru: 'ru' };

const EN_CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\b(he|she|it|that|what|there|who)'s\b/g, '$1 is'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'],
  [/\b(i|you|he|she|we|they)'ll\b/g, '$1 will'],
  [/\b(i|you|he|she|we|they)'d\b/g, '$1 would'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\b(is|are|was|were|do|does|did|has|have|had|would|could|should|must)n't\b/g, '$1 not'],
];

/** Language-specific letters a learner may replace with a plain-keyboard lookalike. */
const KAZAKH_FOLD: Record<string, string> = { ә: 'а', ғ: 'г', қ: 'к', ң: 'н', ө: 'о', ұ: 'у', ү: 'у', һ: 'х', і: 'и' };
const TURKISH_FOLD: Record<string, string> = { ı: 'i', ş: 's', ç: 'c', ğ: 'g', ö: 'o', ü: 'u' };

function lower(text: string, lang: string): string {
  return text.toLocaleLowerCase(LOWERCASE_LOCALE[lang] ?? 'en');
}

/**
 * Strict comparison key: case, punctuation and spacing are ignored, but every
 * letter matters. German umlaut spellings (ae/oe/ue/ss) and English contractions
 * are treated as equivalent because both are standard orthography.
 */
export function strictKey(text: string, lang: string): string {
  let s = lower(text.normalize('NFC'), lang).replace(APOSTROPHES, "'");
  if (lang === 'en') for (const [re, rep] of EN_CONTRACTIONS) s = s.replace(re, rep);
  if (lang === 'de') s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  if (lang === 'ru') s = s.replace(/ё/g, 'е');
  return s.replace(PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
}

/** Loose key: additionally ignores diacritics, apostrophes and language-specific letters. */
export function looseKey(text: string, lang: string): string {
  let s = strictKey(text, lang).replace(/'/g, '');
  if (lang === 'kk') s = s.replace(/[әғқңөұүһі]/g, (c) => KAZAKH_FOLD[c] ?? c);
  if (lang === 'tr') s = s.replace(/[ışçğöü]/g, (c) => TURKISH_FOLD[c] ?? c);
  return s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Optimal string alignment distance (Levenshtein with adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[m]![n]!;
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

/**
 * A single-letter slip inside one long word. Differences in the last two letters
 * are never forgiven: in the supported languages endings usually carry grammar
 * (agreement, case, person), so they are real mistakes rather than typos.
 */
export function isMinorTypo(given: string, expected: string): boolean {
  const g = given.split(' ');
  const e = expected.split(' ');
  if (g.length !== e.length) return false;
  const diffs = g.map((tok, i) => [tok, e[i]!] as const).filter(([a, b]) => a !== b);
  if (diffs.length !== 1) return false;
  const [a, b] = diffs[0]!;
  if (Math.min(a.length, b.length) < 5) return false;
  if (a.slice(-2) !== b.slice(-2)) return false;
  return editDistance(a, b) === 1;
}

export type TextMatch =
  | { verdict: 'correct'; matched: string }
  | { verdict: 'almost'; matched: string; reason: 'diacritics' | 'kazakh_letters' | 'typo' }
  | { verdict: 'incorrect' };

export function matchText(given: string, accepted: readonly string[], lang: string): TextMatch {
  const gStrict = strictKey(given, lang);
  if (!gStrict) return { verdict: 'incorrect' };
  for (const candidate of accepted) {
    if (strictKey(candidate, lang) === gStrict) return { verdict: 'correct', matched: candidate };
  }
  const gLoose = looseKey(given, lang);
  for (const candidate of accepted) {
    if (looseKey(candidate, lang) === gLoose) {
      return { verdict: 'almost', matched: candidate, reason: lang === 'kk' ? 'kazakh_letters' : 'diacritics' };
    }
  }
  for (const candidate of accepted) {
    if (isMinorTypo(gStrict, strictKey(candidate, lang))) return { verdict: 'almost', matched: candidate, reason: 'typo' };
  }
  return { verdict: 'incorrect' };
}

/** Deterministic PRNG so shuffled options stay stable for a given attempt item. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const rand = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
