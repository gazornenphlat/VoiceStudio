// OmniVoice GGUF runtime (`omnivoice-tts`) packaged into the installers (#2780).
//
// Release workflows download the binary that build-omnivoice-tts.yml built for
// the runner's platform into build/omnivoice-tts/, and the installer ships that
// directory as resources/bin/. The backend runs from resources/, so its lookup
// (`<root>/bin/omnivoice-tts-<slug>` in backend/engines/omnivoice_gguf/backend.py)
// finds it there unchanged.
//
// The backend verifies every file against bin/checksums.sha256. Code signing
// rewrites the files it signs, so the manifest is recomputed after signing:
// in afterPack, once electron-builder has signed the .exe while copying it.
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const OMNIVOICE_TTS_STAGING_DIR = resolve(here, 'build/omnivoice-tts');
export const OMNIVOICE_TTS_RESOURCE_DIR = 'bin';
export const OMNIVOICE_TTS_MANIFEST = 'checksums.sha256';

/**
 * Binary slug the backend's `_platform_slug()` resolves on this installer
 * target, or null when the target has no bundled runtime. Windows on ARM runs
 * the emulated x64 Python runtime, which asks for the x64 binary.
 */
export function omnivoiceTtsSlug(platform, arch) {
  if (platform === 'win32' && (arch === 'x64' || arch === 'arm64')) return 'windows-x86_64';
  return null;
}

export function omnivoiceTtsBinaryName(slug) {
  return `omnivoice-tts-${slug}${slug.startsWith('windows') ? '.exe' : ''}`;
}

function stagedFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile());
}

/** extraResources entry for a staged runtime; empty when nothing was staged. */
export function omnivoiceTtsResources(dir = OMNIVOICE_TTS_STAGING_DIR) {
  const files = stagedFiles(dir);
  return files.some((name) => name.startsWith('omnivoice-tts-')) &&
    files.includes(OMNIVOICE_TTS_MANIFEST)
    ? [{ from: dir, to: OMNIVOICE_TTS_RESOURCE_DIR, filter: ['**/*'] }]
    : [];
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Parse `<hex>  [*]<name>` lines into a name → digest map. */
export function readManifest(path) {
  const entries = new Map();
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (!match) throw new Error(`Malformed ${OMNIVOICE_TTS_MANIFEST} line: ${line}`);
    entries.set(match[2].trim(), match[1].toLowerCase());
  }
  return entries;
}

/** Recompute every manifest entry from the files as they will ship. */
export function rewriteManifest(binDir) {
  const manifest = join(binDir, OMNIVOICE_TTS_MANIFEST);
  const names = [...readManifest(manifest).keys()].sort();
  const lines = names.map((name) => {
    const file = join(binDir, name);
    if (!existsSync(file))
      throw new Error(`${OMNIVOICE_TTS_MANIFEST} lists a missing file: ${name}`);
    return `${sha256File(file)}  ${name}\n`;
  });
  writeFileSync(manifest, lines.join(''));
}

/** Files the manifest lists whose bytes no longer match it. */
export function manifestMismatches(binDir) {
  const mismatches = [];
  for (const [name, digest] of readManifest(join(binDir, OMNIVOICE_TTS_MANIFEST))) {
    const file = join(binDir, name);
    if (!existsSync(file) || sha256File(file) !== digest) mismatches.push(name);
  }
  return mismatches;
}

function packagedBinDir(context) {
  return join(context.packager.getResourcesDir(context.appOutDir), OMNIVOICE_TTS_RESOURCE_DIR);
}

/**
 * afterPack: refresh the manifest. electron-builder has already signed the
 * runtime's .exe while copying extraResources (when a certificate is
 * configured), so the manifest must describe the signed bytes.
 */
export function finalizeOmnivoiceTts(context) {
  const binDir = packagedBinDir(context);
  if (!existsSync(join(binDir, OMNIVOICE_TTS_MANIFEST))) return;
  rewriteManifest(binDir);
}
