import type { WordDTO } from '@linguapath/shared';
import { useI18n } from '../../i18n';

export function WordMeta({ word }: { word: Pick<WordDTO, 'partOfSpeech' | 'gender'> }) {
  const i18n = useI18n();
  const parts = [i18n.tx(`partsOfSpeech.${word.partOfSpeech}`, word.partOfSpeech)];
  if (word.gender) parts.push(i18n.tx(`genders.${word.gender}`, word.gender));
  return <span className="caption">{parts.join(' · ')}</span>;
}
