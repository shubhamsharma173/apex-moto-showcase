# Publication scope and verification

This is a clean public source snapshot prepared on 18 October 2026 from development commit `a281eb5a83667a864ffa8088d8f7046ae9f5fa1a`, with documentation edits for publication. It does not include the original Git history or private device-recording evidence.

## Included and omitted

Application source, domain/adapter tests, synthetic fixtures, configuration, MIT license, third-party attribution and substantive engineering documentation are preserved. The device audit is replaced by a technical summary without private-video links or personal records. Earlier demo screenshots are historical previews, not the current product. The README uses current empty-state/unit screenshots.

The unused source asset `assets/sahyadri-road.png` is omitted because it contains embedded provenance metadata and has no tracked source/documentation reference. Its removal does not change application code. No credentials or signing private keys are intentionally included; project/build IDs, binary hashes and public certificate fingerprints are identifiers rather than signing secrets.

## Verification boundaries

The publication pass inspected source and the fetched history, reviewed all 16 documentation screenshots, removed private evidence links and checked the exported file set and relative documentation links. It did not run application code, install dependencies, rebuild the app or execute tests. Historical result tables describe earlier development checks and must not be read as new successful showcase checks.

The linked Expo APK is a historical test binary. Its contents and signing were not independently re-audited during publication. It is not a store release. Source export for iOS does not establish a signed, device-tested iOS app.

## Automation

- `.github/workflows/ci.yml` validates pushes to main and pull requests. It installs dependencies, runs type/lint/tests, Expo Doctor, config checks and web/native JavaScript exports; it does not request a paid EAS cloud build. It uses no repository API secrets.
- `verify-android-apk.yml` runs only when a release is published and expects an APK plus checksum in that release. No release assets are included in this source snapshot. Its built-in GitHub token is read-only; its expected public signing fingerprint belongs to the original test builds.
- `android-recording-smoke.yml` is manual. It needs either a compatible release APK or an explicit allowed Expo artifact URL and uses Android emulator runner time. The default historical release tag does not exist in a newly created showcase until an appropriate release is deliberately added. It uses the built-in read-only GitHub token, not an account secret.

Do not present these workflow definitions as passing runs until they have actually completed in the public repository. EAS cloud builds and API/service use outside these workflows require their own authorized configuration and can consume service quotas. The source keeps its original EAS project identifiers for provenance; contributors need their own project/signing setup.
