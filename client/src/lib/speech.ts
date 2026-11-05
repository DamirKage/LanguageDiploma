import { useCallback, useEffect, useRef, useState } from 'react';
import { audioKey, type AudioManifest, type AudioVoice } from '@linguapath/shared';
import { playback } from './playback';

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

const manifests = new Map<string, Promise<AudioManifest>>();
const loaded = new Map<string, AudioManifest>();

function loadManifest(language: string): Promise<AudioManifest> {
  let pending = manifests.get(language);
  if (!pending) {
    pending = fetch(`/audio/${language}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : {}))
      .catch(() => ({}))
      .then((m) => {
        loaded.set(language, m);
        return m;
      });
    manifests.set(language, pending);
  }
  return pending;
}

/** Recordings prepared for the curriculum (neural voices, generated ahead of time; see tools/audio). */
export function useAudioManifest(language: string): AudioManifest | null {
  const [manifest, setManifest] = useState<AudioManifest | null>(() => loaded.get(language) ?? null);
  useEffect(() => {
    let live = true;
    void loadManifest(language).then((m) => live && setManifest(m));
    return () => {
      live = false;
    };
  }, [language]);
  return manifest;
}

export interface SpeakOptions {
  audioUrl?: string | null;
  rate?: number;
  /** Second voice for the other speaker in a dialogue. */
  speaker?: AudioVoice;
  onEnd?: () => void;
}

/**
 * Plays, in order of preference: a recording uploaded by the administrator, the prepared
 * recording of the phrase, or the browser's speech synthesis.
 */
export function useSpeaker(locale: string) {
  const language = locale.split('-')[0]!.toLowerCase();
  const manifest = useAudioManifest(language);
  const voices = useVoices();
  const voice = findVoice(voices, locale);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const recording = useCallback(
    (text: string, speaker: AudioVoice = 'A') => {
      const file = manifest?.[audioKey(text, speaker)];
      return file ? `/audio/${language}/${file}` : null;
    },
    [manifest, language],
  );

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      const finish = () => {
        setSpeaking(false);
        playback.stop();
        options.onEnd?.();
      };
      const fail = () => {
        setSpeaking(false);
        playback.stop();
      };
      const url = options.audioUrl || recording(text, options.speaker);
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      if (url) {
        const audio = new Audio(url);
        audio.playbackRate = options.rate ?? 1;
        audioRef.current = audio;
        setSpeaking(true);
        audio.onended = finish;
        audio.onerror = fail;
        playback.startRecording(text, audio);
        void audio.play().catch(fail);
        return;
      }
      if (!voice || !('speechSynthesis' in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = (options.rate ?? 1) * 0.95;
      utterance.onend = finish;
      utterance.onerror = fail;
      utterance.onboundary = (e) => playback.boundary(text, e.charIndex);
      playback.startSynthesis(text);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [voice, recording],
  );

  /** Plays phrases one after another, e.g. the lines of a dialogue with two voices. */
  const speakSequence = useCallback(
    (lines: Array<{ text: string; speaker?: AudioVoice }>) => {
      const play = (i: number) => {
        const line = lines[i];
        if (line) speak(line.text, { speaker: line.speaker, onEnd: () => setTimeout(() => play(i + 1), 250) });
      };
      play(0);
    },
    [speak],
  );

  useEffect(
    () => () => {
      if (audioRef.current && !audioRef.current.paused) playback.stop();
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return {
    speak,
    speakSequence,
    speaking,
    /** A recording exists for this phrase. */
    hasRecording: (text: string, speaker?: AudioVoice) => !!recording(text, speaker),
    /** The phrase can be played: a recording exists or the browser has a voice for the language. */
    canSpeak: (text: string) => !!recording(text) || !!voice,
    voice,
  };
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
