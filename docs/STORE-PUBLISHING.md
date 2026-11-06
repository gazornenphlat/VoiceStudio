# Store publishing

The shared publishing foundation keeps identity, disclosures, distribution
policy, assets and artifact provenance consistent. It does not publish or
reserve listings.

Microsoft Store is the only store channel in this Windows-only fork. Use its
runbook for packaging and submission. Start changes from freshly fetched
`origin/main`.

## Canonical inputs

- `store/metadata.json`: product identity, listing copy, requirements,
  permissions and store categories.
- `store/privacy.json`: local data and network transmission disclosures.
- `store/compliance.json`: bundled and downloaded component review ledger.
- `store/assets.json`: canonical icon and screenshot sources.
- `config/distributions.mjs`: immutable runtime policy per distribution.

Run the shared checks before any packaging work:

```bash
node scripts/validate_store_foundation.mjs --distribution=microsoft-store
```

A failure is a submission blocker, not a reason to weaken the shared policy.

## Microsoft Store handoff

| Worker | Target | Starting package | Update owner | First blocking work |
| --- | --- | --- | --- | --- |
| Windows | `microsoft-store` | Signed NSIS EXE | VoiceStudio | Run the signed package workflow, reserve Partner Center identity, submit privately and complete certification |

The packaging and submission handoff is implemented in
`.github/workflows/microsoft-store.yml`. Operating steps and pending owner work
are in [`store/microsoft-store.md`](store/microsoft-store.md).

The Store reuses the signed installer and updater contract. Each worker owns
only its package configuration, platform CI, store-specific assets and
submission runbook. Changes to shared identity, privacy, capabilities or
compliance records must update the canonical files rather than being copied
into a platform-only document. Electron remains the only UI and desktop shell;
no Tauri path may be restored.

## Artifact and release contract

Packaging workflows write `store-artifact-manifest-<platform>-<arch>.json`
beside the installer. It records the source version and commit, distribution
policy, compliance-manifest digest, artifact sizes and SHA-256 digests. The
Store worker must generate it with its explicit distribution target and add the
Authenticode verification result before submission.

Use the same lifecycle:

`built -> validated -> submitted -> approved -> scheduled -> published -> verified`

Only the owner supplies or authorizes store accounts, legal agreements,
payment/tax details, signing credentials, age ratings and final publication.
Never bump the application version, submit an artifact or publish a listing
without that approval. The Store channel becomes a maintained release channel
only after its first verified production publication.

## Open foundation blockers

- Record the exact bundled `uv` binary digest and upstream notices.
- Resolve the locked Python/runtime redistribution ledger before bundling it.
- Keep default model weights outside store packages unless every model license
  is separately approved.
