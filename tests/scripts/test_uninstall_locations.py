"""The uninstall script must find the Electron app's folders, not only the
retired Tauri ones.

The Electron shell keeps its managed Python runtime, window state, logs and
updater cache under its VoiceStudio app folder (app.getPath('userData'),
electron/src/main/backend.ts). A script that only knew the Tauri identifier
left gigabytes behind on every Electron uninstall.

uninstall.ps1 is pinned by static checks because PowerShell is not available
on every CI platform.
"""
from __future__ import annotations

import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PS1 = os.path.join(REPO, "scripts", "uninstall.ps1")


def test_ps1_no_longer_cites_the_removed_tauri_backend():
    with open(PS1, encoding="utf-8-sig") as handle:
        assert "src-tauri" not in handle.read()


def test_ps1_targets_electron_folders_and_its_uninstaller():
    with open(PS1, encoding="utf-8-sig") as handle:
        text = handle.read()
    assert "$electronAppName = 'VoiceStudio'" in text
    assert "Join-Path $appData $electronAppName" in text
    assert "$electronUpdaterCache = 'voicestudio-electron-updater'" in text
    assert "runtime-location.json" in text and "$location.owned -eq $true" in text
    assert "(Join-Path $root 'project') -PathType Container" in text
    assert "'Uninstall VoiceStudio.exe'" in text
    # App removal is refused before cleanup when the caller is elevated.
    # Behavioral coverage lives in test_uninstall_elevation.py.
    assert "if ($Yes -and $isElevated)" in text
    assert "without administrator rights" in text
    assert "Test-AdminOnlyWritable" not in text
    # The legacy Tauri cleanup stays.
    assert "$legacyIdentifier = 'com.debpalash.omnivoice-studio'" in text
