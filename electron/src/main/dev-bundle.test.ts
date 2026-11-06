import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// This is a Node launcher shared with the package script, so it intentionally
// remains plain ESM rather than being compiled into Electron's main process.
import {
  launchElectronVite,
  // @ts-expect-error JavaScript launcher has no separate declaration file.
} from '../../scripts/dev.mjs';

it('watches main and preload changes so renderer updates cannot leave stale browser IPC running', () => {
  const spawn = vi.fn(() => ({ on: vi.fn() }));
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  try {
    launchElectronVite(['--', '--disable-gpu-compositing'], spawn, () => '/electron/dist/electron');
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      [
        expect.stringContaining('electron-vite'),
        'dev',
        '--watch',
        '--',
        '--disable-gpu-compositing',
      ],
      expect.objectContaining({ stdio: 'inherit' }),
    );
  } finally {
    Object.defineProperty(process, 'platform', platform);
  }
});

describe('built-app launches (bun run start / preview)', () => {
  it('routes every Electron-launching package script through the resolving launcher', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const { scripts } = manifest;
    const direct = Object.entries(scripts).filter(([, command]) =>
      /electron-vite\s+(dev|preview)\b/.test(command),
    );
    expect(direct).toEqual([]);
    expect(scripts.start).toBe('node scripts/dev.mjs preview');
    expect(scripts.preview).toBe('node scripts/dev.mjs preview');
  });

  it('previews the built app with a resolved binary and without watching', () => {
    const spawn = vi.fn(() => ({ on: vi.fn() }));
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const previousExecutable = process.env.ELECTRON_EXEC_PATH;
    const previousRunAsNode = process.env.ELECTRON_RUN_AS_NODE;
    delete process.env.ELECTRON_EXEC_PATH;
    process.env.ELECTRON_RUN_AS_NODE = '1';
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      launchElectronVite(
        ['preview', '--', '--disable-gpu'],
        spawn,
        () => '/electron/dist/electron',
      );
      const [, args, options] = spawn.mock.calls[0] as unknown as [
        string,
        string[],
        { env: NodeJS.ProcessEnv },
      ];
      expect(args.slice(1)).toEqual(['preview', '--', '--disable-gpu']);
      expect(options.env.ELECTRON_EXEC_PATH).toBe('/electron/dist/electron');
      // An inherited ELECTRON_RUN_AS_NODE would start the app as plain Node.
      expect(options.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE');
      expect(process.env.ELECTRON_RUN_AS_NODE).toBe('1');
    } finally {
      Object.defineProperty(process, 'platform', platform);
      if (previousExecutable === undefined) delete process.env.ELECTRON_EXEC_PATH;
      else process.env.ELECTRON_EXEC_PATH = previousExecutable;
      if (previousRunAsNode === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
      else process.env.ELECTRON_RUN_AS_NODE = previousRunAsNode;
    }
  });
});

describe('Electron binary resolution', () => {
  it.each(['linux', 'win32'])('resolves Electron before launching on %s', (platformName) => {
    const events: string[] = [];
    const spawn = vi.fn(() => {
      events.push('launch');
      return { on: vi.fn() };
    });
    const resolveElectron = vi.fn(() => {
      events.push('resolve');
      return '/electron/dist/electron';
    });
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const previousExecutable = process.env.ELECTRON_EXEC_PATH;
    delete process.env.ELECTRON_EXEC_PATH;
    Object.defineProperty(process, 'platform', { value: platformName, configurable: true });
    try {
      launchElectronVite([], spawn, resolveElectron);
      expect(events).toEqual(['resolve', 'launch']);
      expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ ELECTRON_EXEC_PATH: '/electron/dist/electron' }),
        }),
      );
      expect(process.env.ELECTRON_EXEC_PATH).toBeUndefined();
    } finally {
      Object.defineProperty(process, 'platform', platform);
      if (previousExecutable === undefined) delete process.env.ELECTRON_EXEC_PATH;
      else process.env.ELECTRON_EXEC_PATH = previousExecutable;
    }
  });

  it('preserves an explicit executable override without downloading Electron', () => {
    const spawn = vi.fn(() => ({ on: vi.fn() }));
    const resolveElectron = vi.fn(() => {
      throw new Error('must not download');
    });
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const previousExecutable = process.env.ELECTRON_EXEC_PATH;
    process.env.ELECTRON_EXEC_PATH = '/custom/electron';
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      launchElectronVite([], spawn, resolveElectron);
      expect(resolveElectron).not.toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ ELECTRON_EXEC_PATH: '/custom/electron' }),
        }),
      );
    } finally {
      Object.defineProperty(process, 'platform', platform);
      if (previousExecutable === undefined) delete process.env.ELECTRON_EXEC_PATH;
      else process.env.ELECTRON_EXEC_PATH = previousExecutable;
    }
  });

  it('does not launch Vite when binary resolution fails', () => {
    const spawn = vi.fn(() => ({ on: vi.fn() }));
    const failure = new Error('Electron binary download failed');
    const resolveElectron = () => {
      throw failure;
    };
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const previousExecutable = process.env.ELECTRON_EXEC_PATH;
    delete process.env.ELECTRON_EXEC_PATH;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      expect(() => launchElectronVite([], spawn, resolveElectron)).toThrow(failure);
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', platform);
      if (previousExecutable === undefined) delete process.env.ELECTRON_EXEC_PATH;
      else process.env.ELECTRON_EXEC_PATH = previousExecutable;
    }
  });
});

it('reports asynchronous Vite spawn failure and removes signal forwarding', () => {
  const child = new EventEmitter();
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const previousExitCode = process.exitCode;
  const previousSignals = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) =>
    process.listenerCount(signal),
  );
  const report = vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  try {
    launchElectronVite(
      [],
      () => child,
      () => '/electron/dist/electron',
    );
    child.emit('error', new Error('spawn EACCES'));
    expect(process.exitCode).toBe(1);
    expect(report).toHaveBeenCalledWith(expect.stringContaining('spawn EACCES'));
    expect(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => process.listenerCount(signal))).toEqual(
      previousSignals,
    );
  } finally {
    process.exitCode = previousExitCode;
    Object.defineProperty(process, 'platform', platform);
    report.mockRestore();
  }
});
