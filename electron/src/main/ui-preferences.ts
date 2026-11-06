import { ipcMain } from 'electron';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Appearance and language choices live in localStorage for the renderer, but the
 * profile's localStorage is not reliably written to disk. This store mirrors the
 * allowlisted keys into a JSON file so they survive restarts. The preload restores
 * them before the page runs.
 */
export const UI_PREFERENCE_STORE_KEYS = [
  'voicestudio.theme.v2',
  'voicestudio.theme',
  'voicestudio.appearance',
  'voicestudio.locale',
] as const;

export type UiPreferenceKey = (typeof UI_PREFERENCE_STORE_KEYS)[number];

const ALLOWED = new Set<string>(UI_PREFERENCE_STORE_KEYS);
const MAX_VALUE_LENGTH = 4_096;

function isUiPreferenceKey(key: unknown): key is UiPreferenceKey {
  return typeof key === 'string' && ALLOWED.has(key);
}

function readStore(path: string): Partial<Record<UiPreferenceKey, string>> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const store: Partial<Record<UiPreferenceKey, string>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isUiPreferenceKey(key) && typeof value === 'string' && value.length <= MAX_VALUE_LENGTH) {
        store[key] = value;
      }
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(path: string, store: Partial<Record<UiPreferenceKey, string>>): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, JSON.stringify(store, null, 2));
  renameSync(temp, path);
}

/** Registers the synchronous load and the write channel. Call once, before any window loads. */
export function registerUiPreferences(path: string): void {
  let store = readStore(path);
  // Synchronous so the preload can restore values before the page's own scripts run.
  ipcMain.on('ui-prefs:load', (event) => {
    event.returnValue = store;
  });
  ipcMain.handle('ui-prefs:set', (_event, key: unknown, value: unknown) => {
    if (!isUiPreferenceKey(key)) throw new Error('Unknown UI preference key');
    const next = { ...store };
    if (value === null) {
      delete next[key];
    } else if (typeof value === 'string' && value.length <= MAX_VALUE_LENGTH) {
      next[key] = value;
    } else {
      throw new Error('Invalid UI preference value');
    }
    writeStore(path, next);
    store = next;
  });
}
