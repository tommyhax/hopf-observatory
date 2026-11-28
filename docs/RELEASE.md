# Release preparation and evidence provenance

`v0.1.0-review.3` is the second substantive external-review snapshot. The first
two tags identify the same source snapshot; `.2` corrected asset delivery.
The [release notes](RELEASE_NOTES.md) describe that snapshot's solver evaluation.
Work since then, including the higher-precision and closed-form diagnostics, is
summarized in [REVIEW.md](../REVIEW.md) and Section 11 of the technical note.
Earlier editions of revised documents that recorded evidence hashed are
preserved under `research/provenance/` for verification.

## Offline verification

From a checkout or the extracted supplemental ZIP, with Python 3.12 or later:

```sh
python3 scripts/verify-release.py
# In the extracted release, require and verify every shipped file hash:
python3 scripts/verify-release.py --require-manifest
# In a full Git checkout, also compare the documentary snapshots to Git:
python3 scripts/verify-release.py --history
```

This read-only gate needs no GPU, network or scientific Python packages. It
checks the original 153 source/input hashes, all 65 frozen baseline hashes,
algebraic/Algorithm 1010 recorded hashes and source snapshots, the traversal
manifest, lossless images, raw timing effects and correctness reports. The
historical adoption verifier runs in a temporary copy, with its original
document versions, and its regenerated decision must match byte for byte.
No historical analysis program or tracked output is changed.

Provenance has three distinct scopes:

- **Numerical sources and evidence:** executable sources, inputs, raw captures,
  analyses, images, rejected pilots, controls and historical manifests remain
  unchanged and must match their recorded hashes.
- **Historical documentary hashes:** `final/results/{decision,validation}.json`
  and `traversal/results/preservation.json` name the manuscript at
  `48c5166d22b0755ef25f8c31fc37fef4173e85c1`. Its `PAPER.md`, `paper/main.tex`
  and `paper/manuscript.pdf` are shipped verbatim under
  `research/provenance/48c5166d22b0755ef25f8c31fc37fef4173e85c1/` solely to
  verify those records offline. The same directory preserves
  `web/technical-note.html` from that revision, matching the original hash in
  the grazing diagnostic's frozen manifest. The gate uses these snapshots for
  historical hash checks and restores them into the temporary adoption-verifier
  copy. Current manuscript and technical-note editions can therefore evolve
  without changing the recorded evidence. Other hashed historical reports
  remain at their original paths.
- **New release provenance:** the root `MANIFEST.json` inside the archive hashes
  the current consolidated documents, current generated manuscript, historical
  snapshots and all other packaged files. It records the full source commit,
  source tree and commit time. It does not claim that current prose matches old
  documentary hashes. When revising an edition covered by historical evidence,
  copy its last committed version to `research/provenance/<commit>/<path>`
  (`git show <commit>:<path>`). `scripts/verify-release.py` registers every
  archived edition automatically and accepts a recorded document hash that
  matches any archived edition or the current file; `--history` checks each
  edition against its Git blob. The recorded-source checker
  `research/check-evidence.py` also uses the archived browser note for its
  historical browser-integration report. Never refresh a frozen evidence hash
  to match new prose. Run the offline gate after rebuilding documents.
- **Experiment-local verifiers:** each diagnostic directory's own `verify.py`
  or `--verify-only` analysis checks the working tree as it was when that
  experiment was committed. After later source or document revisions, run it
  from a checkout of that commit (for example `git worktree add`).
- **Superseded trial records:** a few results files record trial runs whose
  sources were revised afterwards. `TRIAL_RECORDS` in
  `scripts/verify-release.py` maps each to the trial directory holding the exact
  earlier sources.

Historical `release/*` distribution files are optional local checks. If present,
their bytes must match the old preservation records; if absent, the verifier
lists them as **not checked**, without failing numerical verification. They
are not shipped again inside this release, and a fresh clone normally lacks
them. This is different from a missing numerical input, which fails the gate.

For fuller offline reanalysis, install `research/requirements.txt` and run the
existing analyzers in a **disposable copy**. For example, from the checkout:

```sh
scratch=$(mktemp -d)
git archive HEAD | tar -x -C "$scratch"
(cd "$scratch" && python3 research/diagnostics/algorithm1010/traversal/analyze.py)
```

Use the pinned scientific Python interpreter instead of `python3` when needed.
Compare regenerated JSON with the committed files; figure bytes can depend on
font/rendering-library versions. The traversal analyzer checks timing blocks,
shader identity, uniform equality and all image metrics. Other writing programs
include `research/reference.py`, `research/analyze*.py`, the grazing/algebraic
analyzers, Algorithm 1010 `analyze.py` and `final/analyze-pixels.py`. Do not run
these in the preserved checkout just to update hashes. The historical
`final/verify-results.py` also writes `decision.json`; use the gate above.

## Repeating hardware captures

Offline review is distinct from repeating the controlled capture. The traversal
runner checks **renderer, vendor, WebGL version and browser user agent** against
the accepted capture. The browser adapter explicitly launches Chrome with
`--use-angle=metal` and rejects software rendering. The recorded stack is Apple
M3 Pro / Chrome 157 / WebGL2 / ANGLE Metal; a changed browser or backend is
expected to be rejected. See the exact strings in the recorded
`final/results/webgl-benchmark.json` hardware object. Run capture commands from
the historical reports only in a disposable copy on that expected stack, with
no competing GPU work. No portable benchmarking mode is provided or required.
The bounded Playwright integration tests instead use SwiftShader and do not
reproduce hardware timings. This release pass does not run hardware benchmarks.

## Build and package committed source

```sh
python3 scripts/build-paper.py --pdf
npm run format:check
npm test
python3 scripts/verify-release.py --history
npm run build:site
npm run test:browser
# Commit intended documents, generated manuscript and release tooling first.
python3 scripts/package-release.py --version v0.1.0-review.3 --source HEAD
```

The packager reads Git objects, never uncommitted or untracked inputs. It writes
`release/<version>/` by default; `--output` selects an isolated verification
destination. The directory contains `manuscript.pdf`, `technical-note.pdf`, the
supplemental ZIP, `MANIFEST.json`, `SHA256SUMS.txt` and `RELEASE_NOTES.md`.
Checksums cover both delivered PDFs and the ZIP. Previous release archives,
local environments, caches and temporary build products are excluded.

ZIP entries use sorted paths, a fixed timestamp, Git executable bits and stored
bytes (no compressor-version dependence). Repeating the same committed source
and version produces identical bytes. An existing destination is accepted only
if every delivered file is identical; different content is refused. A new source
revision requires a new version or a separate temporary verification destination.
The new manifest excludes its own hash to avoid a self-reference; the archive's
external checksum covers it.

Extract the ZIP into a new directory, run the gate with `--require-manifest`, and
run `shasum -a 256 -c SHA256SUMS.txt` in the release directory. For a deterministic
check, package the same source/version with a fresh `--output` and compare all
six outputs. Assemble Pages with `npm run build:site` in a checkout/extraction
of that same source; `_site/paper.pdf` must equal the delivered manuscript.

## Publication remains separate

No push, new tag, public release or Pages deployment is part of local preparation.
After authorization, recheck that the version is unused, push the prepared
commit, create and push `v0.1.0-review.3` pointing to that exact commit, and create
a prerelease titled **Second external review snapshot — solver evaluation
complete** using `RELEASE_NOTES.md`. Upload the two PDFs, supplemental ZIP,
`SHA256SUMS.txt` and `MANIFEST.json`; verify the downloaded asset hashes.

Run the manual **Deploy GitHub Pages** workflow only with the default branch at
that same source commit. Confirm the deployed `paper.pdf` hash equals the
release manuscript. Leave the existing tags and old release assets unchanged.
This external-review package is not a journal submission or acceptance.
