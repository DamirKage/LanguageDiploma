import { describe, expect, it } from 'vitest';
import { parseWiktionary } from '../../src/integrations/dictionary';

describe('parseWiktionary', () => {
  it('keeps only the requested language section and strips HTML', () => {
    const data = {
      de: [
        {
          partOfSpeech: 'Noun',
          definitions: [
            { definition: '<a href="/wiki/house">house</a>, home', examples: ['<i>Das Haus</i> ist groß.'] },
            { definition: '' },
          ],
        },
      ],
      en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'unrelated' }] }],
    };
    expect(parseWiktionary(data, 'de')).toEqual([
      { partOfSpeech: 'Noun', definitions: [{ text: 'house, home', examples: ['Das Haus ist groß.'] }] },
    ]);
  });

  it('returns an empty list when the language is missing', () => {
    expect(parseWiktionary({ en: [] }, 'kk')).toEqual([]);
  });
});
