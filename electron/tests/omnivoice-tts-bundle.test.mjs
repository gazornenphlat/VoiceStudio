import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  OMNIVOICE_TTS_MANIFEST,
  finalizeOmnivoiceTts,
  manifestMismatches,
  omnivoiceTtsBinaryName,
  omnivoiceTtsResources,
  omnivoiceTtsSlug,
  rewriteManifest,
  sha256File,
} from '../omnivoice-tts-bundle.mjs';

function stage(files) {
  const dir = mkdtempSync(join(tmpdir(), 'omnivoice-tts-'));
  const lines = [];
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
    lines.push(`${sha256File(join(dir, name))}  ${name}\n`);
  }
  writeFileSync(join(dir, OMNIVOICE_TTS_MANIFEST), lines.join(''));
  return dir;
}

test('maps each Windows installer target to the slug the backend resolves (#2780)', () => {
  assert.equal(omnivoiceTtsSlug('win32', 'x64'), 'windows-x86_64');
  // Windows on ARM runs the emulated x64 Python runtime.
  assert.equal(omnivoiceTtsSlug('win32', 'arm64'), 'windows-x86_64');
  assert.equal(omnivoiceTtsBinaryName('windows-x86_64'), 'omnivoice-tts-windows-x86_64.exe');
});

test('packages a staged runtime under resources/bin and nothing otherwise', () => {
  assert.deepEqual(omnivoiceTtsResources(join(tmpdir(), 'missing-omnivoice-tts')), []);
  const dir = stage({ 'omnivoice-tts-windows-x86_64.exe': 'rt', 'ggml.dll': 'lib' });
  assert.deepEqual(omnivoiceTtsResources(dir), [{ from: dir, to: 'bin', filter: ['**/*'] }]);
});

test('refreshes the manifest after signing changes the shipped bytes', () => {
  const dir = stage({ 'omnivoice-tts-windows-x86_64.exe': 'unsigned', 'ggml.dll': 'lib' });
  writeFileSync(join(dir, 'omnivoice-tts-windows-x86_64.exe'), 'signed');
  assert.deepEqual(manifestMismatches(dir), ['omnivoice-tts-windows-x86_64.exe']);
  rewriteManifest(dir);
  assert.deepEqual(manifestMismatches(dir), []);
  assert.match(readFileSync(join(dir, OMNIVOICE_TTS_MANIFEST), 'utf8'), /^[0-9a-f]{64} {2}ggml\.dll\n/m);
});

test('refuses a manifest that lists a file the package lacks', () => {
  const dir = stage({ 'omnivoice-tts-windows-x86_64.exe': 'rt' });
  writeFileSync(
    join(dir, OMNIVOICE_TTS_MANIFEST),
    `${'0'.repeat(64)}  omnivoice-tts-windows-x86_64.exe\n${'1'.repeat(64)}  ggml.dll\n`,
  );
  assert.throws(() => rewriteManifest(dir), /missing file: ggml\.dll/);
});

test('afterPack rewrites the packaged manifest to match the bytes it ships', () => {
  const resources = mkdtempSync(join(tmpdir(), 'resources-'));
  const bin = join(resources, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'omnivoice-tts-windows-x86_64.exe'), 'rt');
  writeFileSync(join(bin, OMNIVOICE_TTS_MANIFEST), `${'0'.repeat(64)}  omnivoice-tts-windows-x86_64.exe\n`);
  finalizeOmnivoiceTts({
    electronPlatformName: 'win32',
    appOutDir: resources,
    packager: { getResourcesDir: () => resources },
  });
  assert.deepEqual(manifestMismatches(bin), []);
});
