import { spawnSync } from 'node:child_process';
import './locale-encoding.mjs';
import config from '../electron-builder.config.mjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import {
  OMNIVOICE_TTS_MANIFEST,
  OMNIVOICE_TTS_RESOURCE_DIR,
  manifestMismatches,
  omnivoiceTtsBinaryName,
  omnivoiceTtsSlug,
  readManifest,
} from '../omnivoice-tts-bundle.mjs';
import { APP_ID, PRODUCT_NAME } from '../../config/app-config.mjs';
import { DISTRIBUTION_PROFILE, DISTRIBUTION_TARGET } from '../../config/distributions.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installerProcessesTest = spawnSync(
  process.execPath,
  ['--test', resolve(root, 'tests/windows-installer-processes.test.mjs')],
  { encoding: 'utf8' },
);
assert.equal(
  installerProcessesTest.status,
  0,
  installerProcessesTest.stdout + installerProcessesTest.stderr,
);
const distributionIdentityTest = spawnSync(
  process.execPath,
  ['--test', resolve(root, 'tests/distribution-identity.test.mjs')],
  { encoding: 'utf8' },
);
assert.equal(
  distributionIdentityTest.status,
  0,
  distributionIdentityTest.stdout + distributionIdentityTest.stderr,
);
const require = createRequire(import.meta.url);
const artifactRequested = process.argv.includes('--artifact');
const artifactArch = process.env.VOICESTUDIO_RUST_TARGET?.startsWith('aarch64')
  ? 'arm64'
  : process.env.VOICESTUDIO_RUST_TARGET?.startsWith('x86_64')
    ? 'x64'
    : process.arch;
const artifactCandidates =
  artifactArch === 'arm64'
    ? ['release/win-arm64-unpacked', 'release/win-unpacked']
    : ['release/win-unpacked'];
const artifactRoot = resolve(
  root,
  artifactCandidates.find((candidate) => existsSync(resolve(root, candidate))) ??
    artifactCandidates[0],
);
const artifactResources = resolve(artifactRoot, 'resources');
const artifactExecutable = resolve(artifactRoot, `${PRODUCT_NAME}.exe`);

const electronPackage = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
assert.match(electronPackage.author?.email ?? '', /@/, 'Package declares a maintainer email');
assert.equal(config.productName, PRODUCT_NAME, 'Builder uses the central product name');
assert.equal(config.appId, APP_ID, 'Builder uses the registered identity for the selected distribution');
const storeLabel = { 'microsoft-store': 'MicrosoftStore-' }[DISTRIBUTION_TARGET];
assert.equal(
  config.artifactName,
  `${PRODUCT_NAME}-${storeLabel ?? ''}\${version}-\${os}-\${arch}.\${ext}`,
  'Direct downloads are VoiceStudio-<version>-<os>-<arch>; store packages stay labelled',
);
assert.equal(
  config.extraMetadata.voicestudioDistribution,
  DISTRIBUTION_TARGET,
  'Package records its immutable distribution identity',
);
assert.equal(
  config.extraMetadata.voicestudioUpdateOwner,
  DISTRIBUTION_PROFILE.applicationUpdates,
  'Package records who owns application updates',
);
if (DISTRIBUTION_TARGET === 'microsoft-store') {
  assert.equal(
    config.extraMetadata.author.name,
    'Yupcha Softwares Private Limited',
    'Microsoft Store uninstall metadata uses the legal publisher',
  );
} else {
  assert.equal(
    config.extraMetadata.author,
    undefined,
    'Direct package author metadata is unchanged',
  );
}
const project = readFileSync(resolve(root, '../pyproject.toml'), 'utf8');
const readme = project.match(/^readme\s*=\s*"([^"]+)"/m)?.[1];
assert(readme, 'Python project declares a README');
for (const resource of [
  readme,
  'LICENSE',
  'LICENSE-NOTICE.md',
  'electron/T3CODE-LICENSE.txt',
  'pyproject.toml',
  'uv.lock',
  'backend',
  'omnivoice',
  'config/app.json',
]) {
  const entry = config.extraResources.find((item) => item.to === resource);
  assert(entry && existsSync(resolve(root, entry.from)), 'Required resource: ' + resource);
  if (artifactRequested)
    assert(existsSync(resolve(artifactResources, resource)), 'Packaged resource: ' + resource);
}
// #2599: LAN devices load the web UI from the backend, which serves this
// build from the app's resources. Without it they only get an error page.
const webUi = config.extraResources.find((item) => item.to === 'frontend/dist');
assert(webUi, 'Required resource: frontend/dist (web UI for LAN sharing)');
for (const [label, dir] of [
  ['Built', resolve(root, webUi.from)],
  ...(artifactRequested ? [['Packaged', resolve(artifactResources, webUi.to)]] : []),
]) {
  const index = resolve(dir, 'index.html');
  assert(existsSync(index), `${label} web UI entry (run build:web first): ${index}`);
  const html = readFileSync(index, 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)) {
    assert(existsSync(resolve(dir, asset)), `${label} web UI asset: ${asset}`);
  }
}
const bundledUvSource = config.extraResources.find((item) => /^tools\/uv(?:\.exe)?$/.test(item.to));
if (process.env.VOICESTUDIO_RUST_TARGET || process.env.VOICESTUDIO_BUNDLED_UV) {
  assert(bundledUvSource, 'Release builds package the pinned uv executable');
  assert(existsSync(bundledUvSource.from), 'Bundled uv source exists');
}
if (artifactRequested && bundledUvSource) {
  assert(existsSync(resolve(artifactResources, bundledUvSource.to)), 'Packaged uv executable');
}
// #2780: release and rehearsal builds ship the OmniVoice GGUF runtime where
// the backend looks for it (resources/bin/omnivoice-tts-<slug>). The workflow
// names the slug it staged; it must be the one this target's backend resolves.
const omnivoiceTtsPlatform = process.env.VOICESTUDIO_OMNIVOICE_TTS_PLATFORM;
if (omnivoiceTtsPlatform) {
  assert.equal(
    omnivoiceTtsPlatform,
    omnivoiceTtsSlug(process.platform, artifactArch),
    'Staged GGUF runtime matches the backend slug for this target',
  );
  const runtime = config.extraResources.find((item) => item.to === OMNIVOICE_TTS_RESOURCE_DIR);
  assert(runtime, 'Release builds package the OmniVoice GGUF runtime');
  const binary = omnivoiceTtsBinaryName(omnivoiceTtsPlatform);
  const dirs = [['Staged', runtime.from]];
  if (artifactRequested) {
    dirs.push(['Packaged', resolve(artifactResources, OMNIVOICE_TTS_RESOURCE_DIR)]);
  }
  for (const [label, dir] of dirs) {
    const file = resolve(dir, binary);
    assert(existsSync(file) && statSync(file).size > 0, `${label} GGUF runtime: ${binary}`);
    assert(
      readManifest(resolve(dir, OMNIVOICE_TTS_MANIFEST)).has(binary),
      `${label} ${OMNIVOICE_TTS_MANIFEST} covers ${binary}`,
    );
    assert.deepEqual(manifestMismatches(dir), [], `${label} GGUF runtime matches its manifest`);
  }
}
assert.equal(
  config.extraMetadata.version,
  JSON.parse(readFileSync(resolve(root, '../package.json'))).version,
);
assert.equal(config.win.icon, 'build/icons/icon.ico', 'Windows uses the shared VoiceStudio icon');
assert(existsSync(resolve(root, 'build/icons/icon.ico')), 'Windows VoiceStudio icon exists');
for (const icon of [
  'brand/icon.png',
  'brand/icon.ico',
  'brand/32x32.png',
  'brand/tray-recording.png',
  'brand/trayTemplate.png',
  'brand/trayRecordingTemplate.png',
]) {
  const entry = config.extraResources.find((item) => item.to === icon);
  assert(entry && existsSync(resolve(root, entry.from)), `Runtime icon: ${icon}`);
  if (artifactRequested) {
    assert(existsSync(resolve(artifactResources, icon)), `Packaged runtime icon: ${icon}`);
  }
}
assert.equal(typeof config.afterPack, 'function', 'Native helper must be built before signing');
// electron-builder UNIONS an explicit per-target `arch` with the --x64/--arm64
// CLI flag, so `--win --arm64` over `{ target: 'nsis', arch: ['x64'] }` also
// packages x64, and its native helper needs a toolchain the runner lacks. The
// CLI matrix alone picks the architecture; the default is the host's.
for (const target of [config.win.target ?? []].flat()) {
  assert(
    typeof target === 'string' || target.arch === undefined,
    `win target ${target.target} must not pin arch; CLI flags choose it`,
  );
}
if (artifactRequested) {
  assert(existsSync(artifactExecutable), 'Packaged VoiceStudio executable');
  assert(
    existsSync(
      resolve(artifactResources, 'native', 'voicestudio-desktop-bridge.exe'),
    ),
    'Packaged native dictation helper',
  );
}

const hostIsNode = /^node(?:\.exe)?$/i.test(basename(process.execPath));
const syntaxRuntime = hostIsNode ? process.execPath : require('electron');
for (const entry of ['out/main/index.js', 'out/preload/index.mjs']) {
  const check = spawnSync(syntaxRuntime, ['--check', resolve(root, entry)], {
    encoding: 'utf8',
    env: hostIsNode ? process.env : { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  assert.equal(check.status, 0, `Built entry must parse: ${entry}\n${check.stderr}`);
}

const rendererHtml = readFileSync(resolve(root, 'out/renderer/index.html'), 'utf8');
const earlyCapture = rendererHtml.indexOf('early-error-capture.js');
const rendererModule = rendererHtml.search(/<script[^>]+type="module"/);
assert(earlyCapture >= 0, 'Renderer packages the early error capture');
assert(
  rendererModule < 0 || earlyCapture < rendererModule,
  'Early error capture loads before the renderer module graph',
);
assert(
  existsSync(resolve(root, 'out/renderer/early-error-capture.js')),
  'Early error capture is a standalone classic script',
);

console.log(
  `PASS: built entry syntax, Python and web UI resource contract, app version source${artifactRequested ? ' and Windows artifact' : ''}`,
);
