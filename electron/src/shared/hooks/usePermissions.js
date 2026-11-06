/**
 * usePermissions — live OS-permission status (microphone) for the SetupWizard
 * system check and Settings → Permissions.
 *
 * Probes once on mount and re-probes on every window focus — the polished
 * pattern: the user clicks "Open Settings", flips the toggle in the OS pane,
 * and the status chip is already green when they come back. `recheck` is
 * also exposed for an explicit button.
 *
 * Outside the Tauri shell `available` is false and the probes are skipped
 * entirely (mic stays 'unknown') so browser/dev mounts
 * no-op gracefully.
 */
import { useCallback, useEffect, useState } from 'react';
import { checkMicrophone, inTauri } from '../utils/permissions';

export default function usePermissions() {
  const available = inTauri();
  const [mic, setMic] = useState('unknown'); // granted | denied | prompt | unknown

  const recheck = useCallback(async () => {
    if (!available) return;
    setMic(await checkMicrophone());
  }, [available]);

  useEffect(() => {
    if (!available) return undefined;
    recheck();
    // Returning from System Settings refocuses the app window — refresh so
    // a just-flipped grant shows up without hunting for a Recheck button.
    const onFocus = () => recheck();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [available, recheck]);

  return { available, mic, recheck };
}
