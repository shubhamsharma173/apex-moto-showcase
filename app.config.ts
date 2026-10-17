import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Apex Moto",
  slug: "apex-moto",
  owner: "shubhamsharma173",
  extra: { eas: { projectId: "724402ea-a490-49cb-ade6-6f6b4b54dbd1" } },
  scheme: "apexmoto",
  version: "1.0.0",
  orientation: "default",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.apexmoto.app",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.apexmoto.app",
    // Expo TaskManager schedules persisted GPS delivery jobs. Android kills the
    // broadcast receiver on the first fix if this normal permission is absent.
    permissions: ["android.permission.RECEIVE_BOOT_COMPLETED"],
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#0B100F",
    },
    predictiveBackGestureEnabled: true,
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
    name: "Apex Moto",
    description: "Your open road. Capture, relive and plan motorcycle rides.",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-image",
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0B100F",
        image: "./assets/icon.png",
        imageWidth: 112,
      },
    ],
    "./plugins/with-storage-limit",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Apex Moto records your rides, even when your phone is locked. Location stays on this device unless you export it.",
        locationWhenInUsePermission:
          "Apex Moto uses your location to record your ride after you tap Start.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-sensors",
      {
        motionPermission:
          "Allow Apex Moto to estimate phone lean while a ride is recording. Calibrate only while stationary.",
      },
    ],
    "@maplibre/maplibre-react-native",
  ],
  experiments: { typedRoutes: false },
};
export default config;
