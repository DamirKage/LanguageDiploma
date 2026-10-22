import { Volume2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSpeaker } from '../../lib/speech';

/** Plays a word or phrase; hidden when neither a recording nor a browser voice is available. */
export function SpeakButton({
  text,
  locale,
  audioUrl,
  size = 'md',
  rate,
}: {
  text: string;
  locale: string;
  audioUrl?: string | null;
  size?: 'sm' | 'md';
  rate?: number;
}) {
  const { t } = useI18n();
  const { speak, speaking, available } = useSpeaker(locale);
  if (!available && !audioUrl) return null;
  return (
    <button
      type="button"
      className={`btn btn--ghost btn--icon ${size === 'sm' ? 'btn--sm' : ''} speak-btn`}
      data-speaking={speaking || undefined}
      onClick={() => speak(text, { audioUrl, rate })}
      aria-label={`${t('common.listen')}: ${text}`}
      title={t('common.listen')}
    >
      <Volume2 size={size === 'sm' ? 16 : 20} aria-hidden />
    </button>
  );
}
