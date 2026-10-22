import { useCallback, useEffect, useRef, useState } from 'react';

/** Voices load asynchronously in most browsers; this hook re-renders when they arrive. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [],
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

export function findVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const lang = locale.toLowerCase();
  const base = lang.split('-')[0];
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(`${base}-`) || v.lang.toLowerCase() === base) ??
    null
  );
}

/**
 * Plays an uploaded recording when available, otherwise uses the browser's speech
 * synthesis. `available` is false when neither source can play this language.
 */
export function useSpeaker(locale: string) {
  const voices = useVoices();
  const voice = findVoice(voices, locale);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(
    (text: string, options: { audioUrl?: string | null; rate?: number } = {}) => {
      if (options.audioUrl) {
        audioRef.current?.pause();
        const audio = new Audio(options.audioUrl);
        audio.playbackRate = options.rate ?? 1;
        audioRef.current = audio;
        setSpeaking(true);
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => setSpeaking(false);
        void audio.play().catch(() => setSpeaking(false));
        return;
      }
      if (!voice || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = options.rate ?? 0.95;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [voice],
  );

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return { speak, speaking, available: !!voice, voice };
}

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type RecognitionStatus = 'idle' | 'listening' | 'done' | 'unsupported' | 'denied' | 'error';

/** Experimental speech recognition through the Web Speech API (Chromium, Safari). */
export function useRecognition(locale: string) {
  const supported = !!getRecognitionCtor();
  const [status, setStatus] = useState<RecognitionStatus>(supported ? 'idle' : 'unsupported');
  const [transcript, setTranscript] = useState('');
  const recRef = useRef<Recognition | null>(null);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.lang = locale;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    rec.onresult = (e) => {
      const alternatives = Array.from(e.results[0] ?? []);
      setTranscript(alternatives[0]?.transcript ?? '');
      setStatus('done');
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setStatus('denied');
      else if (e.error === 'language-not-supported') setStatus('unsupported');
      else if (e.error === 'no-speech') setStatus('idle');
      else setStatus('error');
    };
    rec.onend = () => setStatus((s) => (s === 'listening' ? 'idle' : s));
    recRef.current = rec;
    setTranscript('');
    setStatus('listening');
    try {
      rec.start();
    } catch {
      setStatus('error');
    }
  }, [locale]);

  const stop = useCallback(() => recRef.current?.stop(), []);
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, status, transcript, start, stop, reset: () => setTranscript('') };
}
