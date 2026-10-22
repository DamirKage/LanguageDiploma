import { config } from '../config';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { DictionaryCache } from '../models/learning';

export interface DictionaryEntry {
  partOfSpeech: string;
  definitions: Array<{ text: string; examples: string[] }>;
}

export interface DictionaryLookup {
  term: string;
  language: string;
  source: 'wiktionary';
  sourceUrl: string;
  definitionsLanguage: 'en';
  entries: DictionaryEntry[];
  cached: boolean;
}

interface WiktionaryDefinition {
  definition?: string;
  examples?: string[];
}
type WiktionaryResponse = Record<string, Array<{ partOfSpeech?: string; definitions?: WiktionaryDefinition[] }>>;

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export function parseWiktionary(data: WiktionaryResponse, language: string): DictionaryEntry[] {
  return (data[language] ?? [])
    .map((section) => ({
      partOfSpeech: section.partOfSpeech ?? '',
      definitions: (section.definitions ?? [])
        .map((d) => ({ text: stripHtml(d.definition ?? ''), examples: (d.examples ?? []).map(stripHtml).filter(Boolean).slice(0, 2) }))
        .filter((d) => d.text)
        .slice(0, 5),
    }))
    .filter((s) => s.definitions.length > 0);
}

/**
 * Looks a word up in the English Wiktionary REST API, which covers all five
 * supported languages (definitions are written in English). Results, including
 * "not found", are cached for a week to stay well within the public API's limits.
 */
export async function lookupWord(language: string, term: string, fetchImpl: typeof fetch = fetch): Promise<DictionaryLookup> {
  const sourceUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(term)}`;
  const key = `${language}:${term.toLowerCase()}`;
  const cached = await DictionaryCache.findOne({ key }).lean();
  if (cached) return { ...(cached.data as Omit<DictionaryLookup, 'cached'>), cached: true };
  if (!config.dictionaryEnabled) throw new AppError(503, 'dictionary_unavailable');

  let entries: DictionaryEntry[] = [];
  try {
    const response = await fetchImpl(`${config.dictionaryApiUrl}/${encodeURIComponent(term)}`, {
      headers: { 'User-Agent': 'SlogLearningPlatform/1.0 (educational project)', Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) entries = [];
    else if (!response.ok) throw new Error(`HTTP ${response.status}`);
    else entries = parseWiktionary((await response.json()) as WiktionaryResponse, language);
  } catch (err) {
    logger.warn({ err: (err as Error).message, term, language }, 'Dictionary lookup failed');
    throw new AppError(503, 'dictionary_unavailable');
  }

  const result = { term, language, source: 'wiktionary' as const, sourceUrl, definitionsLanguage: 'en' as const, entries };
  await DictionaryCache.updateOne({ key }, { $set: { data: result, fetchedAt: new Date() } }, { upsert: true });
  return { ...result, cached: false };
}
