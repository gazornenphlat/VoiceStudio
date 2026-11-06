import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const source = { resize: vi.fn() };
  return { source, createFromPath: vi.fn(() => source) };
});
vi.mock('electron', () => ({ nativeImage: { createFromPath: mocks.createFromPath } }));
import { createTrayIcon } from './tray-icon';

it.each(['32x32.png', 'tray-recording.png'])('loads %s unchanged for the Windows tray', (file) => {
  mocks.createFromPath.mockClear();
  mocks.source.resize.mockClear();
  expect(createTrayIcon(file)).toBe(mocks.source);
  expect(mocks.createFromPath).toHaveBeenCalledWith(file);
  expect(mocks.source.resize).not.toHaveBeenCalled();
});
