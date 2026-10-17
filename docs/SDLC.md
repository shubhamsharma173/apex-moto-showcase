# SDLC and release plan

Apex Moto v1 is an independently implemented Expo application for iOS and Android, with a browser preview. A successful web build is not evidence that native background recording, battery life or device smoothness have passed. This document is the release process; build instructions and the current verification baseline are in [release.md](release.md).

## Lifecycle and deliverables

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| Discover | [Evidence ledger](research.md) | Target identified; observations, claims and unknowns separated. |
| Define | [PRD](PRD.md) | Prioritized requirements, acceptance criteria and deferred parity recorded. |
| Design | Original mobile interface, design tokens, [architecture](architecture.md) | Core flows cover permission denial, empty data, persistence failure and small screens. |
| Implement | Typed routes, domain engine, platform adapters, local persistence | Domain calculations independently testable; no credentials or personal traces in source. |
| Verify | Static checks, domain tests, export/build checks, UI review | Automated checks pass; failures and native test gaps disclosed. |
| Release | Tagged source, EAS profiles, signed native candidates | Device matrix below passes; signing and store requirements complete. |
| Operate | Issue triage, backup/export guidance, versioned migrations | Regressions reproducible with synthetic traces; private locations excluded from issue reports. |

## Development workflow

1. Read `package.json` and the matching versioned Expo docs before using Expo/React Native APIs. Current baseline is SDK 57. Add compatible packages through `npx expo install`.
2. Change one coherent feature; update requirement IDs and data migrations alongside behavior.
3. Run lint, TypeScript, domain tests and Expo diagnostics. Review dependency/config changes before committing.
4. Exercise the affected flow in the web preview and on relevant native platforms. Review layout at 360, 390 and 430 px widths plus desktop preview; check safe areas and enlarged text.
5. Record exact command, date, environment and outcome in release notes. A pending device check remains pending.

Typical repository checks (use the actual scripts from `package.json`):

```sh
npx expo lint
npx tsc --noEmit
npm test
npx expo-doctor
npx expo export --platform web
```

`.github/workflows/ci.yml` runs install, typecheck/lint/tests, Expo doctor and web/native asset exports on pushes to `main` and pull requests, using Node 22 on Ubuntu. It retains the web export artifact for seven days. Workflow configuration is present; a successful hosted run must be verified separately. Local validation used Node 24.18.0, so the CI runtime is another environment to check.

## Acceptance and test strategy

| Layer | Required evidence |
| --- | --- |
| Pure telemetry | Known-distance fixture; invalid/duplicate timestamps; bad accuracy; jump rejection; paused/gapped samples; zero-length track; elevation noise; unit conversion. |
| Capture state | Armed → recording → stopped/save; transient stops; minimum ride; out-of-order fixes; disable/cancel; resumed movement; persisted recovery. |
| Export and migration | GPX round-trip and privacy trimming; empty first install; removal of untouched placeholder motorcycles; retention of edited bikes and saved GPS/imported rides. Legacy parser tests remain, but import is outside v1. |
| Persistence | Relaunch restores settings/rides/saved routes; individual deletion/history clearing survives relaunch; storage failure is visible and never falsely reported as a save. |
| UI | Tabs and back behavior; route search/filter/save; record/pause/resume/finish; replay scrubbing; garage/service changes; metric/imperial; missing-data states. |
| Accessibility | VoiceOver and TalkBack labels/order; visible focus on web; contrast; large touch targets; 200% font-size inspection; reduced-motion setting. |
| Native recording | Real devices, screen locked, app backgrounded, permissions changed, signal lost/recovered, power saving, interrupted capture, termination/restart. |

## Measurable quality targets

These are acceptance targets until device measurements exist, not measured claims.

- On a midrange physical Android phone and a supported iPhone: interactive cold start within 3 seconds in release mode; ordinary actions acknowledge within 100 ms.
- Core lists and replay target 60 Hz with no repeated stalls over 100 ms; review a 10,000-point trace and 500-ride log. Rendering should simplify geometry without corrupting stored samples.
- A 60-minute outdoor ride should not lose its saved record; compare distance against an independent recorder and investigate error above 5% on an open-sky route.
- Record idle/background and riding battery consumption over one hour, report device/OS/settings and establish a budget from measurements. Do not advertise negligible drain before this exists.
- No unrecoverable save error, privacy leak or recording corruption in the release candidate. All critical defects block release; lesser known issues receive a documented workaround.

## Native release gates

| Gate | Required before claiming completion |
| --- | --- |
| G1 — source | Lint, typecheck, tests, dependency diagnosis, web export and review pass. |
| G2 — native packaging | EAS Android and iOS builds succeed using the intended app IDs and correct native permissions. |
| G3 — field beta | At least one physical iPhone and two Android vendors pass permission, background, recovery, long-ride and battery scenarios. |
| G4 — privacy/accessibility | Export and deletion verified; public privacy URL and store disclosures match actual behavior; screen-reader review passes. |
| G5 — distribution | Developer accounts/signing ready; store metadata, screenshots, review explanations and policy review complete; approved binaries distributed. |

Use development builds for native feature testing. Background location is governed by OS permissions and lifecycle restrictions, and iOS background location is unavailable in Expo Go. [Expo SDK 57 location](https://docs.expo.dev/versions/v57.0.0/sdk/location/)

The project uses Continuous Native Generation: configure native behavior through app configuration/plugins. Generated `ios/` and `android/` trees are not hand-maintained. EAS commands and profiles should be reviewed from the repository's release instructions; this document does not assert that a signed build or store submission has occurred.

## Risk register

| Risk | Severity | Mitigation / owner | Release impact |
| --- | --- | --- | --- |
| OS suspends or terminates background capture | High | Platform adapter + device matrix; clear recording status; manual fallback / engineering | Blocks automatic-capture reliability claims. |
| GPS noise creates false speed or distance | High | Accuracy/jump/timestamp filtering; fixtures and open-sky comparison / telemetry | Blocks trustworthy ride totals. |
| Lean estimate mistaken for measured bank angle | High | Explicit estimate label; reject poor data; no coaching or safety score / product | Must remain visible at point of use. |
| Rider distraction | High | Simple controls; analysis after parking; no speed competitions / design | Review cockpit before beta. |
| Precise locations exposed by exports or backups | High | Local defaults, endpoint trim, export disclosure, deletion / security | Blocks release if disclosure or trim is wrong. |
| Local data loss / unbounded storage growth | High | Durable writes, failure states, export, retention/migration plan / engineering | Stress and recovery test required. |
| Route geometry mistaken for safe navigation | High | Label personal past routes; no live-road assertions or routing guarantee / product | No navigation/safety marketing. |
| Long tracks cause UI jank | Medium | Simplified render geometry and bounded work / engineering | Profile before performance claims. |
| Store permission review rejects background scope | Medium | Contextual consent, accurate purpose text, reviewer demo / release owner | Requires policy and native review. |
| Source claims change or conflict | Medium | Dated evidence ledger, independent implementation / product | Do not claim exact parity. |
| Upstream tooling dependency advisories | High | Track the exact audit and affected execution paths; keep dev server local and use trusted project inputs / engineering | Review unresolved exposure before distributing a release candidate; do not claim zero findings. |

## Maintenance and next releases

Keep location reports out of public issues. Reproduce defects with generated fixtures and record app/OS version, permission state and recording mode. Prioritize data loss and privacy defects first. Schema changes need migration tests and export compatibility. Native configuration changes require a new binary; validate update compatibility before any OTA rollout.

Later milestones: authenticated sync and backups; consent-based temporary sharing; licensed navigation/offline map data; validated sensor telemetry; richer share media/widgets. Each requires its own threat review, acceptance tests and operating costs. None is implied by a local v1 screen.
