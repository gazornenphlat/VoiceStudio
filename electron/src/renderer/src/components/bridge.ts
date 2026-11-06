/** The preload contract, reached through the global augmentation in src/preload/index.d.ts. */
export type VoiceStudioBridge = Window['voicestudio'];

/** The preload bridge, or null outside Electron (vitest, a plain browser tab). */
export function getBridge(): VoiceStudioBridge | null {
  if (typeof window === 'undefined') return null;
  return 'voicestudio' in window && window.voicestudio ? window.voicestudio : null;
}

export function appVersion(): string {
  return getBridge()?.app.version ?? __APP_VERSION__;
}

/** The Windows build never runs on macOS, so macOS-only layout branches are unreachable. */
export function isMac(): boolean {
  return false;
}

export type PlatformFamily = 'windows' | 'linux';

/** Which OS design language native-feeling UI should follow; browser tabs fall back to the user agent. */
export function platformFamily(): PlatformFamily {
  const platform =
    getBridge()?.app.platform ?? (typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent);
  if (platform === 'win32' || /win/i.test(platform)) return 'windows';
  return 'linux';
}
