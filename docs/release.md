# Historical Android release and device-testing guide

These records describe the original private development project. They are retained as historical engineering documentation, not newly verified results for this public source snapshot. Original GitHub Actions/release links are omitted because they are not public evidence. The externally hosted APK is an earlier test binary, not a release built from this showcase. See [publication scope](publication.md).

Candidate: Apex Moto 1.0.0. Package: `com.apexmoto.app`. Expo SDK 57 / React Native 0.86.3. This is a standalone internal test release, with field testing still required before a store launch.

## Historical download — Android build 5

[Download APK](https://expo.dev/artifacts/eas/UGNY96V_dMev3rHSRR2G7D6oPZZWS2YPBC1OWu8wuE8.apk) · GitHub release (historical development record) · [Build provenance](releases/android-v1-build5.json) · [Audit fixes](audits/2026-10-16-remediation.md)

Build 5 is 160,690,172 bytes and uses the same package and signing certificate as the previous APK. Install it over the existing app; uninstalling removes local ride data. Source commit: `b5ae5579a2b17a1911f4220279542d8633833319`; subsequent commits refine tests and documentation.

SHA-256: `171d1affe9d6c487e367a5b77bc282188fb31f9d2772c23e15e4b47f0704ebcd`.

Verified: lint/typecheck, 77 regressions, Expo Doctor 21/21, web plus iOS/Android exports, signed native compilation, matching update certificate, APK integrity/fonts/permissions and Android 12 smoke test (historical development record). The emulator used a 375 × 812 viewport with 1.15 font scale. It passed GPS start/background/pause/resume/save, keyboard-open first Save tap, favourites, 1× replay, restoring the saved screen after process loss, stable units-card bounds, period explanations and recorded routes in Explore. The crash buffer was empty. Earlier runs exposed test-coordinate errors involving the keyboard, interactive map and offscreen text; the assertions were retained and the same APK passed after those test interactions were corrected.

Physical Realme retest: sensor calibration while parked, automatic permission setup, switching to Google Maps and back, and a longer outdoor ride with the screen locked. These remain distinct from emulator evidence. The Google Maps-return cause is unconfirmed; cold-start recovery is a mitigation. See the remediation record for all 22 findings.

The published GitHub asset verification (historical development record) also passed checksum, APK signing and native GPS permission checks after upload.

## Earlier build 4 changes

- Build 4 fixes the missing native permission for persisted GPS jobs, waits for the Android activity to resume before service startup, and removes the Always-access requirement from manual Android recording. See the [crash investigation](gps-startup-fix.md).
- Removed import entry points and the document-picker dependency; kept GPX/postcard export and previously saved imported rides.
- Removed demo activities, demo mode and the untouched default motorcycle. An upgrade preserves edited motorcycles, service/fuel history and bikes linked to real rides.
- Polished first-use home/logbook/garage/recording states, mobile header targets and growing-text layouts.
- Replaced native Google/Apple map integration with MapLibre + OpenFreeMap. No map key is needed. Map failure shows the stored outline with retry.
- Linked EAS to the owner's existing Expo account and configured standalone APK preview builds with incrementing version codes.
- Fixed the Explore return button for route details opened directly or reloaded without navigation history.

## Historical build 4 verification — 16 October 2026

| Check | Result |
| --- | --- |
| TypeScript | Passed. |
| Lint | Passed with no errors or warnings after the recording fix. |
| Automated regressions | 71 passed: 55 domain + 16 mocked recording/storage. Includes Android manual/automatic permission requirements and waiting for the activity to resume. |
| Expo doctor | 21/21 passed. |
| Native JS/assets | iOS and Android Hermes exports passed. These exports alone do not establish native compilation. |
| Web export | Passed. |
| Android 12 signed-APK recording smoke test | Passed (historical development record): fresh install, while-in-use permission, synthetic GPS, foreground service, 10 seconds backgrounded, pause/resume, finish and save. Empty native crash buffer. |
| Browser UI | Reviewed at 375 × 812, 812 × 375 and 1280 × 720. Empty first-use states, Explore card sizing, category filter, route save/reload/unsave, units persistence and garage validation passed. Direct-route return bug reproduced, fixed and retested. |
| Dependency audit | 20 high affected-package entries from two upstream tooling advisories; no critical findings. See [assessment](security.md). |
| Physical Android/iPhone GPS, locked-screen recording, battery, sensors and screen readers | Pending device testing. No attached Android device has been controlled in this workspace. |
| Store submission / signed iPhone build | Not performed. |

The signed APK and inspection record are available below. GitHub CI (historical development record) passed all checks and both web/native exports for the recording fix, including the generated Android manifest regression check.

## Download — Android build 4

[Download the standalone APK](https://expo.dev/artifacts/eas/0cTR1KQKRYC0t__tWK1qxtuGzeNFkYzcMGXi0ZPh0PU.apk) · GitHub release (historical development record) · [Successful EAS build](https://expo.dev/accounts/shubhamsharma173/projects/apex-moto/builds/1c10e778-b99e-47ed-af17-14b51ed5c69b)

- App: Apex Moto 1.0.0, Android versionCode 4, package `com.apexmoto.app`.
- File: `apex-moto-v1.0.0-build4.apk`, 161,152,615 bytes (153.7 MiB).
- Minimum Android API 24 (Android 7.0); target API 36. Universal APK: arm64-v8a, armeabi-v7a, x86 and x86_64.
- EAS release compilation/signing succeeded. Local inspection verified the package/version, non-debuggable manifest, embedded JS bundle, all five UI fonts plus Ionicons by hash, native MapLibre libraries, expected location permissions, and ZIP CRC integrity.
- App source corresponds to `f510661f4141472d6ac4034c1b4c0f220b579a50`. Later commits contain testing and release documentation.
- Published-asset verification (historical development record) passed its SHA-256, Android APK signature and native GPS permission checks. The signing certificate matches build 3, allowing an in-place update. The [build 4 inspection record](releases/android-v1-build4.json) retains the evidence; build 3 has the reported GPS startup defect and is superseded.

SHA-256:

```text
0a2dcb717074280fe9952ae86c15b0870b4ffb05f003cc201401dbfcd264b196
```

The manifest also contains dependency-provided legacy storage permissions (through API 32), overlay and activity-recognition declarations. No overlay settings flow, Fitbit connection or Google Health connection is implemented. Review and minimize unused declarations before store distribution; declaration alone is not a user grant.

## Build and install

EAS project: [shubhamsharma173/apex-moto](https://expo.dev/accounts/shubhamsharma173/projects/apex-moto), ID `724402ea-a490-49cb-ade6-6f6b4b54dbd1`.

```sh
npm ci
npm run check
npx expo-doctor
npm run build
npm run build:native
npx eas-cli@latest build --platform android --profile preview
```

The preview profile produces a signed release APK with its JS/assets embedded, not a development client. EAS manages the Android signing key; keep it to sign compatible updates. Do not commit credentials. Native maps use the MapLibre config plugin and OpenFreeMap dark tiles; no environment variables or map API keys are required.

Download the resulting APK on an Android phone and open it. If Android asks, allow installation from that browser/files app for this install. Open **Apex Moto** from the launcher. It must open with the computer and Expo Go off. This APK does not install on iPhone.

The standalone Android app has separate storage from Expo Go and the browser. Its first installation starts empty; those other environments' records are not automatically transferred. The preservation migration applies when updating the same installation/storage namespace. No import or cloud transfer is available in v1.

For iOS internal distribution, use an Apple Developer membership, register the device with `npx eas-cli@latest device:create`, then `npx eas-cli@latest build --platform ios --profile preview`. A new device requires updated provisioning. The development profile is for debugging against Metro; the production profile is for a future store candidate. [EAS APK guide](https://docs.expo.dev/build-reference/apk/) · [Internal distribution](https://docs.expo.dev/build/internal-distribution/)

## First device test

Use a safe short trip; operate the phone only while parked. Record the phone model, Android version and app build with failures. Keep personal tracks out of public bug reports.

1. Fresh install: home totals are zero; logbook and garage are empty; no demo or import controls. Visit all tabs and Explore cards without granting location.
2. Add your motorcycle, set units and weekly goal, save a route, then close/reopen. Confirm those choices persist.
3. Start manual recording outdoors. Exercise permission denial first, then grant precise foreground location. On Android, manual recording uses a visible location foreground service and does not require Always access; automatic capture requires it. On iOS, enable background access when offered. Verify recording status and notification.
4. Record for 5–10 minutes with the screen locked; pause/resume and finish while parked. Inspect route, distance, time, pause gaps and replay. Relaunch and confirm the saved ride remains.
5. Disable network temporarily: recording should retain GPS fixes; unavailable basemap should show the route outline. Reconnect and retry the map.
6. Export GPX/postcard with endpoint protection. Check the file in a viewer; a very short protected route must not expose untrimmed endpoints.
7. After the manual flow passes, test opt-in automatic capture, stopping/parking, low battery settings, permission revocation and interrupted-app recovery. Android force-stop can prevent further recording; do not assume an app can bypass OS termination.
8. Check large text, landscape, TalkBack and a long ride. Measure one-hour battery use on the actual device; browser smoothness is not evidence of native frame rate or battery life.

## Scope and release gates

The APK is for testing the native recording/maps/sharing integration. Passing mocks, web review and native compilation does not verify real GPS or manufacturer background restrictions. Follow [SDLC gates](SDLC.md) before store distribution. No OTA update service is configured: native/config changes require a new binary. Local records have no cloud backup; export important rides before clearing data or uninstalling. Prefer an in-place, identically signed update to preserve app storage.

Current captures are browser evidence at phone size. Historical screenshots with demo/import UI are retained only as previous-preview records; they are not the current product.
