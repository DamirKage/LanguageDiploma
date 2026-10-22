import { describe, expect, it } from 'vitest';
import { editDistance, isMinorTypo, looseKey, matchText, shuffle, strictKey } from '../../src/lib/text';

describe('strictKey', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(strictKey('  Hallo,   ich bin Anna! ', 'de')).toBe('hallo ich bin anna');
    expect(strictKey('¿Cómo estás?', 'es')).toBe('cómo estás');
  });

  it('applies Turkish casing rules for dotted and dotless i', () => {
    expect(strictKey('İstanbul', 'tr')).toBe('istanbul');
    expect(strictKey('IRMAK', 'tr')).toBe('ırmak');
  });

  it('treats German umlaut transcriptions and ß/ss as equal', () => {
    expect(strictKey('Straße', 'de')).toBe(strictKey('Strasse', 'de'));
    expect(strictKey('Mädchen', 'de')).toBe(strictKey('Maedchen', 'de'));
  });

  it('expands English contractions', () => {
    expect(strictKey("I'm from Kazakhstan", 'en')).toBe(strictKey('I am from Kazakhstan', 'en'));
    expect(strictKey('She didn’t come', 'en')).toBe(strictKey('She did not come', 'en'));
  });

  it('normalises ё in Russian answers', () => {
    expect(strictKey('Ёлка', 'ru')).toBe('елка');
  });
});

describe('looseKey', () => {
  it('folds Kazakh letters to their Russian-keyboard lookalikes', () => {
    expect(looseKey('Сәлеметсіз бе', 'kk')).toBe(looseKey('Салеметсиз бе', 'kk'));
  });
  it('folds Spanish accents', () => {
    expect(looseKey('estación', 'es')).toBe('estacion');
  });
});

describe('matchText', () => {
  it('accepts any of several correct answers', () => {
    expect(matchText('Hallo, ich bin Anna', ['Hallo, ich heiße Anna.', 'Hallo, ich bin Anna.'], 'de').verdict).toBe('correct');
  });

  it('marks missing diacritics as almost correct', () => {
    const r = matchText('Como estas', ['¿Cómo estás?'], 'es');
    expect(r).toMatchObject({ verdict: 'almost', reason: 'diacritics' });
  });

  it('marks Kazakh text typed with Russian letters as almost correct with a specific hint', () => {
    const r = matchText('Салеметсиз бе', ['Сәлеметсіз бе'], 'kk');
    expect(r).toMatchObject({ verdict: 'almost', reason: 'kazakh_letters' });
  });

  it('forgives a single slip inside a long word', () => {
    expect(matchText('Ich brauche eine Fahrkrate', ['Ich brauche eine Fahrkarte'], 'de')).toMatchObject({ verdict: 'almost', reason: 'typo' });
  });

  it('does not forgive wrong grammatical endings', () => {
    expect(matchText('du spielt', ['du spielst'], 'de').verdict).toBe('incorrect');
    expect(matchText('Ich sehe der Mann', ['Ich sehe den Mann'], 'de').verdict).toBe('incorrect');
  });

  it('rejects empty answers', () => {
    expect(matchText('   ', ['bin'], 'de').verdict).toBe('incorrect');
  });
});

describe('helpers', () => {
  it('computes edit distance with transpositions', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('ab', 'ba')).toBe(1);
  });

  it('isMinorTypo requires a single differing long token', () => {
    expect(isMinorTypo('restuarant', 'restaurant')).toBe(true);
    expect(isMinorTypo('bin', 'bist')).toBe(false);
  });

  it('shuffles deterministically by seed without losing items', () => {
    const a = shuffle([1, 2, 3, 4, 5], 42);
    expect(shuffle([1, 2, 3, 4, 5], 42)).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
