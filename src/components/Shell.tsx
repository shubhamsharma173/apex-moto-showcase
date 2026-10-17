import React, { useEffect, useRef } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Slot, usePathname, useRootNavigationState, router } from "expo-router";
import { getInitialURL } from "expo-linking";
import { getValue, setValue } from "../services/storage";
import { Brand } from "./Brand";
import { Txt, Icon, Row, Button, IconButton, IconName } from "./ui";
import { colors as c, fonts as f } from "../theme";
import { useApp } from "../state/AppContext";
const nav: { title: string; icon: IconName; path: string }[] = [
  { title: "Overview", icon: "grid-outline", path: "/" },
  { title: "Explore routes", icon: "compass-outline", path: "/explore" },
  { title: "Ride log", icon: "trail-sign-outline", path: "/rides" },
  { title: "My garage", icon: "bicycle-outline", path: "/garage" },
];
export function Shell() {
  const { width, height } = useWindowDimensions(),
    insets = useSafeAreaInsets(),
    path = usePathname(),
    { prefs, toast, dismissToast } = useApp();
  const navigation = useRootNavigationState();
  const restored = useRef(false);
  const latestPath = useRef(path);
  useEffect(() => {
    latestPath.current = path;
  }, [path]);
  useEffect(() => {
    if (Platform.OS === "web" || !navigation?.key) return;
    if (restored.current) {
      void setValue("last-screen", path).catch(() => undefined);
      return;
    }
    let alive = true;
    void Promise.all([getValue<string>("last-screen", "/"), getInitialURL()])
      .then(([last, url]) => {
        if (!alive) return;
        restored.current = true;
        const valid =
          [
            "/",
            "/record",
            "/rides",
            "/garage",
            "/settings",
            "/explore",
          ].includes(last) || /^\/ride\/[^/]+$/.test(last);
        if (
          !url &&
          path === "/" &&
          latestPath.current === path &&
          valid &&
          last !== "/"
        )
          router.replace(last as any);
        else
          void setValue("last-screen", latestPath.current).catch(
            () => undefined,
          );
      })
      .catch(() => {
        restored.current = true;
      });
    return () => {
      alive = false;
    };
  }, [navigation?.key, path]);
  const desktop = width >= 1000;
  const active = (p: string) =>
    p === "/"
      ? path === "/"
      : path.startsWith(p) || (p === "/rides" && path.startsWith("/ride/"));
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {desktop && (
        <ScrollView style={s.sidebar} contentContainerStyle={s.sidebarContent}>
          <Brand />
          <Txt
            variant="label"
            color={c.faint}
            style={{ marginTop: 45, marginBottom: 16, marginLeft: 12 }}
          >
            YOUR OPEN ROAD
          </Txt>
          {nav.map((n) => (
            <Pressable
              key={n.path}
              accessibilityRole="link"
              accessibilityState={{ selected: active(n.path) }}
              onPress={() => router.navigate(n.path as any)}
              style={({ pressed }) => [
                s.nav,
                {
                  backgroundColor: active(n.path) ? c.limeDim : "transparent",
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Icon
                name={n.icon}
                size={21}
                color={active(n.path) ? c.lime : c.muted}
              />
              <Txt
                style={{
                  fontFamily: active(n.path) ? f.bold : f.medium,
                  fontSize: 14,
                }}
                color={active(n.path) ? c.lime : c.muted}
              >
                {n.title}
              </Txt>
              {active(n.path) && <View style={s.dot} />}
            </Pressable>
          ))}
          <View style={{ marginTop: 24 }}>
            <Button
              title="Start a ride"
              icon="radio-button-on-outline"
              onPress={() => router.navigate("/record")}
            />
          </View>
          <View style={{ flex: 1 }} />
          {height >= 800 && (
            <View style={s.sidebarNote}>
              <Icon name="leaf-outline" color={c.lime} />
              <Txt
                style={{ fontFamily: f.medium, fontSize: 14, marginTop: 10 }}
              >
                Good roads. Better rides.
              </Txt>
              <Txt variant="small" color={c.muted} style={{ marginTop: 6 }}>
                Take the long way. Make it yours.
              </Txt>
              <View
                style={{
                  height: 1,
                  backgroundColor: c.line,
                  marginVertical: 16,
                }}
              />
              <Row>
                <View
                  style={[s.dot, { marginLeft: 0, backgroundColor: c.green }]}
                />
                <Txt variant="small" color={c.muted}>
                  Your data stays on your device
                </Txt>
              </Row>
            </View>
          )}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.navigate("/settings")}
            style={s.profile}
          >
            <View style={s.avatar}>
              <Txt color={c.lime} style={{ fontFamily: f.bold }}>
                {prefs.name.slice(0, 1).toUpperCase()}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontFamily: f.bold, fontSize: 13 }}>
                {prefs.name}
              </Txt>
              <Txt variant="small" color={c.muted}>
                Personal space
              </Txt>
            </View>
            <Icon name="settings-outline" size={19} />
          </Pressable>
        </ScrollView>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={[s.topbar, { paddingHorizontal: desktop ? 36 : 20 }]}>
          {desktop ? (
            <Row>
              <Icon name="sunny-outline" size={17} color={c.lime} />
              <Txt variant="small" color={c.muted}>
                A good day to take the long way.
              </Txt>
            </Row>
          ) : (
            <Brand />
          )}
          <Row style={{ gap: 12 }}>
            {desktop ? (
              <Txt variant="small" color={c.muted}>
                {new Date().toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Txt>
            ) : (
              <IconButton
                icon="settings-outline"
                label="Settings"
                onPress={() => router.navigate("/settings")}
                style={{
                  borderWidth: 0,
                  width: 48,
                  height: 48,
                  backgroundColor: "transparent",
                }}
              />
            )}
          </Row>
        </View>
        <View style={{ flex: 1, minHeight: 0 }}>
          <Slot />
        </View>
        {toast && (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{
              backgroundColor: c.raised,
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderTopWidth: 1,
              borderColor: c.line,
            }}
          >
            <Txt style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{toast}</Txt>
            <IconButton
              icon="close"
              label="Dismiss message"
              onPress={dismissToast}
            />
          </View>
        )}
        {!desktop && (
          <View
            style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]}
          >
            {[
              { title: "Home", icon: "grid-outline", path: "/" },
              { title: "Explore", icon: "compass-outline", path: "/explore" },
              {
                title: "Ride",
                icon: "radio-button-on-outline",
                path: "/record",
              },
              { title: "Logbook", icon: "trail-sign-outline", path: "/rides" },
              { title: "Garage", icon: "bicycle-outline", path: "/garage" },
            ].map((n) => (
              <Pressable
                key={n.path}
                onPress={() => router.navigate(n.path as any)}
                accessibilityRole="link"
                accessibilityState={{ selected: active(n.path) }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 56,
                  opacity: pressed ? 0.6 : 1,
                  gap: 4,
                })}
              >
                <View style={n.path === "/record" ? s.recordIcon : undefined}>
                  <Icon
                    name={n.icon as IconName}
                    size={23}
                    color={
                      n.path === "/record"
                        ? c.ink
                        : active(n.path)
                          ? c.lime
                          : c.muted
                    }
                  />
                </View>
                <Txt
                  style={{ fontSize: 10, fontFamily: f.medium }}
                  color={active(n.path) ? c.lime : c.muted}
                >
                  {n.title}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
export function Page({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  return (
    <View
      style={{
        width: "100%",
        maxWidth: 1500,
        alignSelf: "center",
        padding: width >= 1000 ? 32 : 20,
        gap: 24,
      }}
    >
      {children}
    </View>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  return (
    <Row
      style={{
        justifyContent: "space-between",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <Txt variant="label" color={c.lime} style={{ marginBottom: 8 }}>
          {eyebrow}
        </Txt>
        <Txt
          variant="title"
          style={{
            fontSize: width < 500 ? 28 : 34,
            lineHeight: width < 500 ? 36 : 43,
          }}
        >
          {title}
        </Txt>
        {subtitle && (
          <Txt color={c.muted} style={{ marginTop: 8, fontSize: 14 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      {action}
    </Row>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, flexDirection: "row" },
  sidebar: {
    width: 220,
    flexGrow: 0,
    borderRightWidth: 1,
    borderColor: c.line,
    backgroundColor: c.bg,
  },
  sidebarContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 28,
  },
  nav: {
    minHeight: 50,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: c.lime,
    marginLeft: "auto",
  },
  sidebarNote: {
    padding: 14,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    marginVertical: 24,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: c.line,
    minHeight: 64,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 34,
    backgroundColor: c.limeDim,
    alignItems: "center",
    justifyContent: "center",
  },
  topbar: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  bottom: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderColor: c.line,
    paddingTop: 5,
  },
  recordIcon: {
    backgroundColor: c.lime,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 12,
  },
  toast: {
    position: "absolute",
    right: 18,
    backgroundColor: "#243129",
    borderWidth: 1,
    borderColor: "#556A51",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 100,
  },
});
