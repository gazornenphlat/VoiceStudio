import type { App } from 'electron';
import { PRODUCT_NAME } from '../../../config/app-config.mjs';

export const DESKTOP_APP_NAME = PRODUCT_NAME;

/** Set before Electron creates the native application menu. */
export function installAppIdentity(application: Pick<App, 'setName'>): void {
  application.setName(DESKTOP_APP_NAME);
}
