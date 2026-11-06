"""The uninstall script's opt-in `app_uninstalled` ping — the contract, pinned.

- Sent ONLY when the user opted in: consent is read from the SAME prefs store
  the app writes (`prefs.json: analytics_enabled`), AND the backend-written
  `analytics_info.json` must exist (the backend only writes it while analytics
  is enabled and removes it on opt-out — its presence is itself consent-gated).
- Content-free: app version, OS name, random per-install id. Nothing else.
- Best-effort: 2s timeout, silent failure, never blocks the uninstall.
- Honest: exactly one console line when it sends; silence when not opted in.
- Never on dry-run: the ping lives behind the -Yes gate.

PowerShell isn't runnable on every dev/CI platform, so uninstall.ps1 is pinned
by static contract checks against the same requirements.
"""
from __future__ import annotations

import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PS1 = os.path.join(REPO, "scripts", "uninstall.ps1")


# ── uninstall.ps1: static contract checks (PowerShell isn't runnable here) ──


def _ps1_source() -> str:
    with open(PS1, encoding="utf-8") as f:
        return f.read()


def test_ps1_ping_is_consent_gated_and_best_effort():
    src = _ps1_source()
    # Consent gate: prefs.json's analytics_enabled AND the backend-written info file.
    assert "analytics_info.json" in src
    assert "prefs.json" in src
    assert re.search(r"analytics_enabled\s+-eq\s+\$true", src)
    # Best-effort: 2s timeout inside a try/catch.
    assert "-TimeoutSec 2" in src
    assert "try {" in src and "} catch {" in src
    # Honest single line, matching the bash script's wording.
    assert "Sending anonymous uninstall ping (you opted in to analytics)." in src
    # The ping only runs on an actual delete (-Yes) — after the dry-run exit.
    assert src.index("exit 0") < src.index("app_uninstalled")


def test_ps1_carries_no_baked_token():
    """The script is generic: the token comes from the backend-written info
    file, never from a literal in the repo (the secret scanner would agree)."""
    with open(PS1, encoding="utf-8") as f:
        src = f.read()
    assert not re.search(r"phc_[A-Za-z0-9]{16,}", src), PS1


def test_shipped_powershell_scripts_with_non_ascii_carry_a_utf8_bom():
    """A BOM-less UTF-8 .ps1 is decoded with the ANSI code page by Windows
    PowerShell 5.1 — still the default shell on Windows 10/11.

    `uninstall.ps1` prints em-dashes in `Write-Host` output ("Model cache
    (Hugging Face weights — SHARED …)"), so without a BOM the user running the
    uninstaller sees mojibake in the very messages that explain what is about
    to be deleted. Pinned rather than left to review: the BOM is invisible in a
    diff, so an editor that "helpfully" strips it would go unnoticed until a
    Windows user reported garbled output (CodeRabbit, #1399).

    Scoped to `scripts/` — the vendored trees under `research/` are not ours.
    """
    scripts_dir = os.path.join(REPO, "scripts")
    offenders = []
    for name in sorted(os.listdir(scripts_dir)):
        if not name.endswith(".ps1"):
            continue
        raw = open(os.path.join(scripts_dir, name), "rb").read()
        if raw.startswith(b"\xef\xbb\xbf"):
            continue
        if any(ord(ch) > 127 for ch in raw.decode("utf-8")):
            offenders.append(name)
    assert not offenders, (
        f"these shipped PowerShell scripts contain non-ASCII text but have no "
        f"UTF-8 BOM, so Windows PowerShell 5.1 will mis-decode them: {offenders}"
    )
