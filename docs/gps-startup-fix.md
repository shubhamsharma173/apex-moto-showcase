# Android GPS startup crash — October 2026

This is a historical development record. Its earlier test results were not rerun for this public source snapshot; private Actions links have been omitted.

## Report and evidence

The Android v1 test build (version code 3) closed after the rider granted location access. The supplied recording shows the failure after returning from “Allow all the time” settings and repeated failures on reopening. The reported device is a Realme Narzo 30 (RMX2156), Android 12, 4 GB RAM.

Inspection of the shipped APK found no `android.permission.RECEIVE_BOOT_COMPLETED`. The installed `expo-task-manager@57.0.21` creates persisted JobScheduler jobs in `TaskManagerUtils.createJobInfo()`. `expo-location@57.0.21` schedules those jobs when the first GPS fix arrives. Neither dependency declares the required permission. The native broadcast path catches `IllegalStateException`, but Android 12 throws `IllegalArgumentException` for this missing permission; a JavaScript catch around starting the recorder cannot protect it.

The original signed build 3 reproduced the crash and restart loop in an Android 12/API 31 emulator: baseline run (historical development record). The native crash buffer recorded two process failures with the same stack:

```text
Unable to start receiver expo.modules.taskManager.TaskBroadcastReceiver:
java.lang.IllegalArgumentException: Error: requested job be persisted without holding RECEIVE_BOOT_COMPLETED permission.
  at android.app.JobSchedulerImpl.schedule(JobSchedulerImpl.java:47)
  at expo.modules.taskManager.TaskManagerUtils.updateOrScheduleJob(TaskManagerUtils.java:155)
  at expo.modules.location.taskConsumers.LocationTaskConsumer.maybeReportDeferredLocations(LocationTaskConsumer.kt:305)
```

References: [Android JobInfo.Builder.setPersisted](https://developer.android.com/reference/android/app/job/JobInfo.Builder#setPersisted(boolean)) and [Expo issue 48935](https://github.com/expo/expo/issues/48935).

## Change

- Declare the normal boot-completed permission through `app.config.ts`, so CNG includes it in the Android manifest. It does not add a runtime permission prompt.
- Manual recording on Android uses the visible location foreground service with while-in-use permission. Always permission remains required for automatic capture; iOS permission behavior is retained.
- Wait for the Android activity to resume before requesting service startup when a permission/settings screen has left it inactive. If it does not return, show a retry message instead of attempting startup in the background.
- Keep the package ID and signing key so the fixed APK can update the existing installation.

## Regression checks

- Three recording-service tests cover manual Android recording without Always access, waiting for activity resume, and automatic capture still requiring background permission.
- `scripts/verify-native-config.mjs` checks the Expo-generated manifest in CI.
- Release verification inspects the actual APK permission table as well as its SHA-256 and Android signature.
- `android-recording-smoke.yml` installs the signed APK on an isolated emulator and exercises permission grants, synthetic GPS delivery, background survival, pause/resume and save. It retains screenshots and native logs for diagnosis. No personal ride data is used.

## Validation status

Local typecheck, lint and all 71 tests pass. Expo Doctor passes all 21 checks. Generated configuration and the actual signed APK contain the required permission. EAS build `1c10e778-b99e-47ed-af17-14b51ed5c69b` produced Android versionCode 4 from application source `f510661`.

Published APK verification (historical development record) passed its checksum, Android signature and native permission checks. Its signing certificate matches build 3, so an in-place update can preserve local data. The [inspection record](releases/android-v1-build4.json) records the artifact hash and certificate.

The build 4 Android 12/API 31 recording run (historical development record) passed: fresh install, precise while-in-use permission, synthetic GPS delivery, recording controls, 10 seconds in the background, return to the app, pause/resume, finish and save. The saved ride detail displayed its synthetic route. The native crash buffer was empty, and `dumpsys activity services` confirmed the location service had `isForeground=true`.

Earlier test attempts stopped on shell UI-dump failures caused by the live screen; they are not counted as passes. The successful run uses UiAutomator2 with idle waiting disabled and fresh hierarchy reads. The APK itself is unchanged between these test attempts.

The physical Realme device has not been controlled from this workspace; a short outdoor ride and locked-screen battery testing still require the owner's device.
