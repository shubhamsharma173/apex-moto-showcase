import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Inspect Expo's generated manifest, including config-plugin modifications.
// TaskManager's persisted GPS jobs fail natively without the boot permission;
// JS tests that mock startLocationUpdatesAsync cannot catch that failure.
const config = JSON.parse(
  execFileSync(process.execPath, ["node_modules/expo/bin/cli", "config", "--type", "introspect", "--json"],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }),
);
const manifest = config._internal.modResults.android.manifest.manifest;
const permissions = new Set(manifest["uses-permission"].map((entry) => entry.$["android:name"]));
for (const permission of [
  "RECEIVE_BOOT_COMPLETED",
  "ACCESS_FINE_LOCATION",
  "ACCESS_BACKGROUND_LOCATION",
  "FOREGROUND_SERVICE",
  "FOREGROUND_SERVICE_LOCATION",
]) {
  assert.ok(permissions.has(`android.permission.${permission}`), `Generated Android manifest is missing ${permission}`);
}
assert.equal(config.android.package, "com.apexmoto.app", "Keep the installed app's package identity");
console.log("Native GPS configuration verified: persisted jobs, location permissions and package identity");
