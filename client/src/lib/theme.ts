import { useSyncExternalStore } from 'react';

export const THEMES = ['night', 'day', 'paper', 'system'] as const;
export type ThemeName = (typeof THEMES)[number];

const STORAGE_KEY = 'linguapath.theme';
const DEFAULT_THEME: ThemeName = 'night';
const listeners = new Set<() => void>();

function read(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (THEMES as readonly string[]).includes(stored)) return stored as ThemeName;
  } catch {
    /* storage unavailable: fall back to the default theme */
  }
  return DEFAULT_THEME;
}

let current = read();

export function applyTheme(theme: ThemeName = current) {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: ThemeName) {
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* the choice still applies for this visit */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => current);
}

/** Notifies when the rendered colors may have changed: theme choice or OS color scheme. */
export function onColorsChange(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  listeners.add(callback);
  return () => {
    media.removeEventListener('change', callback);
    listeners.delete(callback);
  };
}
