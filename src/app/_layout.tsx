import React, { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { AppProvider, useApp } from "../state/AppContext";
import { Shell } from "../components/Shell";
import { colors as c } from "../theme";
import "../services/recording";
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
function ReadyApp() {
  const { ready } = useApp();
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return ready ? (
    <Shell />
  ) : (
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: c.bg }}>
      <ActivityIndicator color={c.lime} />
    </View>
  );
}
export default function Layout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center" }}
      >
        <ActivityIndicator color={c.lime} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <ReadyApp />
      </AppProvider>
    </SafeAreaProvider>
  );
}
