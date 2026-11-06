/**
 * Mirrors an allowlisted appearance or language choice to the main process, which
 * restores it on the next launch. The local write stays authoritative for this session.
 */
export function mirrorUiPreference(key: string, value: string | null): void {
  try {
    void window.voicestudio?.uiPreferences?.set(key, value).catch(() => {});
  } catch {
    /* The bridge is absent outside the desktop shell. */
  }
}
