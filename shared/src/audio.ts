/** Voice of a recorded phrase: the main narrator, or the second voice used for the other speaker in dialogues. */
export type AudioVoice = 'A' | 'B';

/** Key of a phrase in a language's audio manifest; the same text always maps to the same recording. */
export function audioKey(text: string, voice: AudioVoice = 'A'): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return voice === 'B' ? `B|${normalized}` : normalized;
}

/** Recording file name for each manifest key, per language: `/audio/<language>/<file>`. */
export type AudioManifest = Record<string, string>;
