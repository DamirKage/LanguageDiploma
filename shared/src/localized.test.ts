import { describe, expect, it } from 'vitest';
import { localize } from './localized';
import { levelIndex, nextLevel } from './constants';

describe('shared helpers', () => {
  it('localizes text with a Russian fallback', () => {
    expect(localize({ ru: 'Привет', kk: 'Сәлем' }, 'kk')).toBe('Сәлем');
    expect(localize({ ru: 'Привет' }, 'en')).toBe('Привет');
    expect(localize('plain')).toBe('plain');
    expect(localize(undefined)).toBe('');
  });
  it('navigates CEFR levels', () => {
    expect(levelIndex('B1')).toBe(2);
    expect(nextLevel('A2')).toBe('B1');
    expect(nextLevel('B2')).toBeNull();
  });
});
