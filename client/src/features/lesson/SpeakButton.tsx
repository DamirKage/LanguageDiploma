import { useRef } from 'react';
import { Volume2 } from 'lucide-react';
import type { AudioVoice } from '@linguapath/shared';
import { useI18n } from '../../i18n';
import { useSpeaker } from '../../lib/speech';

/** A second press within a few seconds repeats the phrase slowly. */
const SLOW_REPEAT_MS = 4000;

/**
 * Plays a word or phrase. Hidden when nothing can play it; with `recordingOnly` it is shown
 * only for prepared recordings (used where the text may be in the interface language).
 */
export function SpeakButton({
  text,
  locale,
  audioUrl,
  size = 'md',
  speaker,
  recordingOnly = false,
}: {
  text: string;
  locale: string;
  audioUrl?: string | null;
  size?: 'sm' | 'md';
  speaker?: AudioVoice;
  recordingOnly?: boolean;
}) {
  const { t } = useI18n();
  const { speak, speaking, canSpeak, hasRecording } = useSpeaker(locale);
  const lastPlayed = useRef(0);
  if (!audioUrl && !(recordingOnly ? hasRecording(text, speaker) : canSpeak(text))) return null;
  return (
    <button
      type="button"
      className={`btn btn--ghost btn--icon ${size === 'sm' ? 'btn--sm' : ''} speak-btn`}
      data-speaking={speaking || undefined}
      onClick={() => {
        const slow = Date.now() - lastPlayed.current < SLOW_REPEAT_MS;
        lastPlayed.current = slow ? 0 : Date.now();
        speak(text, { audioUrl, speaker, rate: slow ? 0.7 : 1 });
      }}
      aria-label={`${t('common.listen')}: ${text}`}
      title={t('common.listenHint')}
    >
      <Volume2 size={size === 'sm' ? 16 : 20} aria-hidden />
    </button>
  );
}
