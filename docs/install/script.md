# PowerShell installer

This fork ships for Windows 10/11 only. The PowerShell installer is the scripted
way to install VoiceStudio. You can also download the
`VoiceStudio-…-win-x64.exe` installer (or `…-win-arm64.exe` on a Snapdragon/ARM PC)
from [Releases](https://github.com/debpalash/VoiceStudio/releases).

Use the `.ps1` URL:

```powershell
irm https://voicestudio.sh/install.ps1 | iex
$env:VOICESTUDIO_VERSION='X.Y.Z'; irm https://voicestudio.sh/install.ps1 | iex
# Clear a previous version override before selecting main:
Remove-Item Env:VOICESTUDIO_VERSION -ErrorAction SilentlyContinue
$env:VOICESTUDIO_INSTALL_MODE='main'; irm https://voicestudio.sh/install.ps1 | iex
```

- With no override, the script installs the latest stable release.
- `VOICESTUDIO_VERSION` installs a published version, with or without a `v` prefix.
- `VOICESTUDIO_INSTALL_MODE='main'` builds from `main` (see [Building main](#building-main)).

On ARM64 Windows the script installs the native ARM64 build and falls back to the
x64 build when a release has none. The script builds an NSIS installer, opens its
setup wizard, and waits for completion. Environment overrides persist in the
terminal; remove them to return to latest-release mode.

## Release installation

The installer resolves the latest GitHub release, downloads the Windows installer,
and verifies it against that release's `SHA256SUMS.txt`. Missing packages, missing
checksums, and checksum mismatches stop installation. The frozen `latest.json`
Tauri updater feed is not used. Releases without a Windows package cannot be
installed through this script.

Quit VoiceStudio completely before installing over it. The installer refuses to
replace a running app.

Current builds also read archived setup configuration for custom data and model
folders and portable storage; explicit launch environment overrides still win. No
files are moved or copied. The existing app is replaced only after staging
succeeds. User settings, projects, model downloads, and backend environments are
not removed. Downgrades may not read data created by newer versions; back up
important projects first.

## Uninstall

Quit VoiceStudio, then run:

```powershell
Remove-Item Env:VOICESTUDIO_VERSION -ErrorAction SilentlyContinue
$env:VOICESTUDIO_INSTALL_MODE='uninstall'; irm https://voicestudio.sh/install.ps1 | iex
```

The uninstaller skips archived Tauri registry entries and opens one verified
Electron uninstall wizard. Use `-Silent` for unattended install or uninstall (for
example, in CI); interactive setup is the default. Uninstalling preserves
settings, projects, backend environments, and models. To delete app data, use
VoiceStudio's in-app data-removal confirmation **before** uninstalling. The
uninstaller does not guess custom storage locations or delete shared model caches.

## Building main

Install Git, Node.js 22 or newer, Bun (the version pinned in root
`package.json`), stable Rust and Cargo, and the Visual Studio C++ build tools. On
ARM64 Windows, also install the ARM64 build tools.

Each run clones `main` into a temporary directory, prints its commit, installs
locked Bun dependencies, packages Electron and its Rust native helper, and
installs the result. It never updates or resets an existing source checkout.
Temporary files are removed on success or failure. Local packages are unsigned,
so Windows SmartScreen prompts may apply. No publishing occurs.

Open the installed app to configure its local Python backend and choose models.
The script does not start a development server or download model weights.

## Installer tests

The PowerShell flow test is `electron/tests/powershell-installer.ps1`. These tests mock downloads
and setup execution in temporary directories; they do not install an app or
download models. A real Windows install and first-run smoke test are separate
checks in the Electron release workflow.
