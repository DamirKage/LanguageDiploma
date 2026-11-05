import { useEffect, useRef, useState } from 'react';
import { Mic, Play, Square } from 'lucide-react';
import { Button } from '../../../components/ui';
import { useI18n } from '../../../i18n';

/**
 * "Listen and repeat": the learner records themselves and compares the recording with the
 * model by ear. Works in any browser with a microphone, also for languages that speech
 * recognition does not support. Nothing is uploaded: the recording stays in the browser.
 */
export function SelfRecorder() {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'recording' | 'ready' | 'denied'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => () => {
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (!supported) return null;

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
        });
        setState('ready');
      };
      recorder.current = rec;
      rec.start();
      setState('recording');
      setTimeout(() => rec.state === 'recording' && rec.stop(), 8000);
    } catch {
      setState('denied');
    }
  }

  return (
    <div className="self-recorder">
      <p className="small">{t('player.repeatTitle')}</p>
      <div className="row" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
        {state === 'recording' ? (
          <Button size="sm" onClick={() => recorder.current?.stop()}>
            <Square size={14} aria-hidden />
            {t('player.repeatStop')}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void start()}>
            <Mic size={14} aria-hidden />
            {state === 'ready' ? t('player.repeatAgain') : t('player.repeatRecord')}
          </Button>
        )}
        {url && state === 'ready' ? (
          <Button size="sm" variant="ghost" onClick={() => void new Audio(url).play()}>
            <Play size={14} aria-hidden />
            {t('player.repeatMine')}
          </Button>
        ) : null}
      </div>
      {state === 'denied' ? <p className="caption">{t('player.repeatDenied')}</p> : <p className="caption">{t('player.repeatHint')}</p>}
    </div>
  );
}
