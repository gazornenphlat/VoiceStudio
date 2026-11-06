import { nativeImage } from 'electron';

/** Loads the Windows tray image at its own size; the shell scales it. */
export function createTrayIcon(path: string) {
  return nativeImage.createFromPath(path);
}
