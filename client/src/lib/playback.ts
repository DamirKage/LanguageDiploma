import { useSyncExternalStore } from 'react';
import { audioKey } from '@linguapath/shared';

/**
 * What is being pronounced right now, shared by every component on the page: the text
 * highlights itself word by word while it plays, and visualizers follow the real signal.
 */
interface PlaybackState {
  key: string | null;
  /** 0…1 position inside the phrase. */
  progress: number;
}

let state: PlaybackState = { key: null, progress: 0 };
const listeners = new Set<() => void>();
let frame = 0;
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;

function set(next: PlaybackState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Playback position of `text`, or null when something else (or nothing) is playing. */
export function usePlaybackOf(text: string): number | null {
  return useSyncExternalStore(subscribe, () => (state.key === audioKey(text) ? state.progress : null));
}

export function useIsPlaying(): boolean {
  return useSyncExternalStore(subscribe, () => state.key !== null);
}

/** The analyser of the recording that is playing, when the browser allows routing audio through it. */
export function currentAnalyser(): AnalyserNode | null {
  return state.key ? analyser : null;
}

function routeThroughAnalyser(audio: HTMLAudioElement) {
  try {
    context ??= new AudioContext();
    // A suspended context would silence the element, so only route audio once it is running.
    if (context.state !== 'running') {
      void context.resume();
      analyser = null;
      return;
    }
    const source = context.createMediaElementSource(audio);
    analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyser.connect(context.destination);
  } catch {
    analyser = null;
  }
}

export const playback = {
  startRecording(text: string, audio: HTMLAudioElement) {
    cancelAnimationFrame(frame);
    routeThroughAnalyser(audio);
    const key = audioKey(text);
    set({ key, progress: 0 });
    const tick = () => {
      if (state.key !== key) return;
      if (audio.duration > 0) set({ key, progress: Math.min(1, audio.currentTime / audio.duration) });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  },
  startSynthesis(text: string) {
    cancelAnimationFrame(frame);
    analyser = null;
    set({ key: audioKey(text), progress: 0 });
  },
  /** Speech synthesis reports word boundaries as character offsets. */
  boundary(text: string, charIndex: number) {
    if (state.key === audioKey(text)) set({ key: state.key, progress: charIndex / Math.max(1, text.length) });
  },
  stop() {
    cancelAnimationFrame(frame);
    if (state.key) set({ key: null, progress: 0 });
  },
};
