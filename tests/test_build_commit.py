"""The build commit that bug reports carry next to the app version."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

from core import version

_REPO = Path(__file__).resolve().parents[1]
SHA = "0123456789abcdef0123456789abcdef01234567"


def _fresh(monkeypatch, env: str | None = None):
    version.build_commit.cache_clear()
    if env is None:
        monkeypatch.delenv("OMNIVOICE_BUILD_COMMIT", raising=False)
    else:
        monkeypatch.setenv("OMNIVOICE_BUILD_COMMIT", env)


def test_environment_commit_is_shortened_and_lowercased(monkeypatch):
    _fresh(monkeypatch, "  ABCDEF1234567890  ")
    assert version.build_commit() == "abcdef123"


def test_values_that_are_not_commit_ids_never_reach_a_report(monkeypatch, tmp_path):
    # a tree without .git, so only the environment can supply a value
    monkeypatch.setattr(version, "__file__", str(tmp_path / "a" / "b" / "version.py"))
    for junk in ("main; rm -rf /", "HEAD", "abc", "../../etc"):
        _fresh(monkeypatch, junk)
        assert version.build_commit() == "unknown"


def test_a_source_checkout_reads_its_own_head(monkeypatch):
    _fresh(monkeypatch)
    assert re.fullmatch(r"[0-9a-f]{9}|unknown", version.build_commit())

