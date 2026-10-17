import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  Platform,
  useWindowDimensions,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { Page, PageHeading } from "../components/Shell";
import { Txt, Icon, Row, Button, Card, Tag, Chip } from "../components/ui";
import { Dialog } from "../components/Dialog";
import RouteMap from "../components/RouteMap";
import {
  subscribeRecording,
  getRecordingSnapshot,
  startRecording,
  pauseRecording,
  resumeRecording,
  finishRecording,
  discardRecording,
  setAutomaticCapture,
  calibrateLean,
  RecordingSnapshot,
} from "../services/recording";
import { Ride, filterRidePoints, summarizeRide } from "../domain/ride";
import { useApp } from "../state/AppContext";
import {
  colors as c,
  fonts as f,
  formatDistance,
  formatClock,
  distance,
} from "../theme";
const blank: RecordingSnapshot = {
  status: "idle",
  points: [],
  startedAt: null,
  vehicleId: "",
  automatic: false,
  error: null,
  lean: null,
};
export default function Record() {
  const { width, fontScale } = useWindowDimensions(),
    { prefs, updatePrefs, refreshRides, notify } = useApp();
  const [snapshot, setSnapshot] = useState<RecordingSnapshot>(blank),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<
      "start" | "auto" | "finish" | "discard" | null
    >(null),
    [clock, setClock] = useState(() => Date.now()),
    [hydrating, setHydrating] = useState(true),
    [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    const off = subscribeRecording(setSnapshot);
    getRecordingSnapshot()
      .then(setSnapshot)
      .catch((e) => notify(e.message))
      .finally(() => setHydrating(false));
    return off;
  }, [notify]);
  useEffect(() => {
    if (snapshot.status !== "recording") return;
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, [snapshot.status]);
  const points = useMemo(
    () => filterRidePoints(snapshot.points),
    [snapshot.points],
  );
  const ride: Ride = useMemo(
    () => ({
      id: "draft",
      name: "Current ride",
      points,
      startedAt: snapshot.startedAt ?? 0,
      endedAt: points.at(-1)?.timestamp ?? snapshot.startedAt ?? 0,
      vehicleId: snapshot.vehicleId,
      source: "gps",
      notes: "",
      isFavorite: false,
    }),
    [points, snapshot.startedAt, snapshot.vehicleId],
  );
  const stats = useMemo(() => summarizeRide(ride), [ride]);
  const p = points.at(-1),
    active = snapshot.status === "recording" || snapshot.status === "paused";
  const elapsed = snapshot.startedAt
    ? Math.max(
        0,
        ((snapshot.status === "recording" ? clock : ride.endedAt) -
          snapshot.startedAt) /
          1000,
      )
    : 0;
  const currentSpeed =
    p && clock - p.timestamp < 15000 && snapshot.status === "recording"
      ? (p.speed ?? 0) * 3.6
      : 0;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      setDialog(null);
    } catch (e) {
      setActionError((e as Error).message);
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    const saved = await finishRecording();
    await refreshRides();
    if (saved) {
      router.push(`/ride/${saved.id}`);
    } else notify("No ride was saved. Start moving to collect a route.");
  };
  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Page>
          <PageHeading
            eyebrow="FOCUS ON THE ROAD"
            title={
              snapshot.status === "recording"
                ? "The story is unfolding."
                : snapshot.status === "paused"
                  ? "A good moment to pause."
                  : snapshot.status === "armed"
                    ? "Ready when you are."
                    : "Let’s go somewhere."
            }
            subtitle={
              snapshot.status === "armed"
                ? "Automatic capture is waiting for sustained movement."
                : "Set things up while parked. Put the phone away when riding."
            }
            action={
              <Tag
                icon={
                  snapshot.status === "recording"
                    ? "radio-button-on"
                    : "shield-checkmark-outline"
                }
                color={snapshot.status === "recording" ? c.lime : c.muted}
              >
                {snapshot.status === "recording"
                  ? "RECORDING"
                  : snapshot.status === "paused"
                    ? "PAUSED"
                    : snapshot.status === "armed"
                      ? "ARMED"
                      : "READY TO RIDE"}
              </Tag>
            }
          />
          <Card style={{ padding: 16, gap: 12 }}>
            {snapshot.automatic && !active && (
              <Txt color={c.muted}>
                Automatic capture is waiting for movement. Starting a manual
                ride turns automatic capture off.
              </Txt>
            )}
            {!active ? (
              <Button
                title={
                  hydrating
                    ? "Restoring recorder…"
                    : snapshot.automatic
                      ? "Start a manual ride"
                      : "Start recording"
                }
                icon="radio-button-on-outline"
                loading={busy || hydrating}
                disabled={hydrating}
                onPress={() => setDialog("start")}
              />
            ) : (
              <Row style={{ flexWrap: "wrap", alignItems: "stretch", gap: 12 }}>
                <Button
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 160 * fontScale,
                  }}
                  title={snapshot.status === "paused" ? "Resume" : "Pause"}
                  icon={snapshot.status === "paused" ? "play" : "pause"}
                  kind="secondary"
                  disabled={busy}
                  onPress={() =>
                    void run(
                      snapshot.status === "paused"
                        ? resumeRecording
                        : pauseRecording,
                    )
                  }
                />
                <Button
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 160 * fontScale,
                  }}
                  title="Finish ride"
                  icon="stop"
                  disabled={busy}
                  onPress={() => setDialog("finish")}
                />
              </Row>
            )}
          </Card>
          {(actionError || snapshot.error) && (
            <Card style={{ padding: 18, borderColor: c.orange }}>
              <Txt accessibilityRole="alert" color={c.orange}>
                {actionError || snapshot.error}
              </Txt>
            </Card>
          )}
          {active && (
            <View
              style={{
                flexDirection: width >= 1150 ? "row" : "column",
                gap: 24,
              }}
            >
              <View
                style={{ flex: width >= 1150 ? 1.6 : undefined, minWidth: 0 }}
              >
                <Card>
                  {points.length ? (
                    <RouteMap
                      points={points}
                      markerIndex={points.length - 1}
                      interactive
                      height={350}
                    />
                  ) : (
                    <View
                      style={{
                        height: 300,
                        backgroundColor: c.map,
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 30,
                        gap: 15,
                      }}
                    >
                      <View
                        style={{
                          height: 90,
                          width: 90,
                          borderRadius: 90,
                          borderWidth: 1,
                          borderColor: c.line,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            height: 60,
                            width: 60,
                            borderRadius: 60,
                            backgroundColor: c.limeDim,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon
                            name="navigate-outline"
                            size={28}
                            color={c.lime}
                          />
                        </View>
                      </View>
                      <Txt variant="heading">
                        {active
                          ? "Finding your place in the world…"
                          : "Your road starts here."}
                      </Txt>
                      <Txt
                        color={c.muted}
                        style={{
                          textAlign: "center",
                          fontSize: 13,
                          maxWidth: 300,
                        }}
                      >
                        {active
                          ? "An accurate GPS fix will draw your route here."
                          : "Location is only requested when you start recording or enable automatic capture."}
                      </Txt>
                    </View>
                  )}
                  <View
                    style={{
                      padding: 18,
                      borderTopWidth: 1,
                      borderColor: c.line,
                    }}
                  >
                    <Row
                      style={{
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      <Row>
                        <Icon
                          name="locate-outline"
                          size={16}
                          color={p ? c.green : c.muted}
                        />
                        <Txt variant="small" color={c.muted}>
                          {p
                            ? `Last fix ±${Math.round(p.accuracy ?? 0)} m`
                            : "GPS waiting"}
                        </Txt>
                      </Row>
                      <Tag icon="lock-closed-outline">Saved on this device</Tag>
                    </Row>
                  </View>
                </Card>
              </View>
              <Card
                style={{
                  flex: width >= 1150 ? 1 : undefined,
                  padding: 24,
                  gap: 20,
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="label" color={c.muted}>
                    RIDE COCKPIT
                  </Txt>
                  <Icon name="speedometer-outline" color={c.lime} />
                </Row>
                <View style={{ alignItems: "center", paddingVertical: 14 }}>
                  <Txt
                    style={{
                      fontFamily: f.displayBold,
                      fontSize: 80,
                      lineHeight: 88,
                      letterSpacing: -5,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {Math.round(distance(currentSpeed, prefs.units))}
                  </Txt>
                  <Txt variant="label" color={c.muted}>
                    {prefs.units}/h · CURRENT SPEED
                  </Txt>
                </View>
                <Row
                  style={{
                    justifyContent: "space-between",
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: c.line,
                    paddingVertical: 20,
                  }}
                >
                  <View>
                    <Txt variant="label" color={c.muted}>
                      DISTANCE
                    </Txt>
                    <Txt variant="heading" style={{ marginTop: 7 }}>
                      {formatDistance(stats.distanceKm, prefs.units)}{" "}
                      {prefs.units}
                    </Txt>
                  </View>
                  <View>
                    <Txt variant="label" color={c.muted}>
                      ELAPSED
                    </Txt>
                    <Txt
                      variant="heading"
                      style={{ marginTop: 7, fontVariant: ["tabular-nums"] }}
                    >
                      {formatClock(elapsed)}
                    </Txt>
                  </View>
                </Row>
                <Row style={{ justifyContent: "space-between" }}>
                  <View>
                    <Txt variant="label" color={c.muted}>
                      PHONE LEAN
                    </Txt>
                    <Txt variant="heading" style={{ marginTop: 7 }}>
                      {snapshot.lean == null
                        ? "—"
                        : `${Math.abs(snapshot.lean)}° ${snapshot.lean < 0 ? "L" : "R"}`}
                    </Txt>
                  </View>
                  <Button
                    title="Set upright"
                    kind="secondary"
                    small
                    disabled={!active || Platform.OS === "web" || busy}
                    onPress={() =>
                      void run(async () => {
                        await calibrateLean();
                        notify(
                          "Upright position set. Keep the phone fixed in its mount.",
                        );
                      })
                    }
                  />
                </Row>
                <Txt variant="small" color={c.faint}>
                  Mounted-phone estimate. Calibrate in portrait while
                  stationary. Unavailable without a supported sensor.
                </Txt>
                {active && (
                  <Button
                    title="Discard this ride"
                    kind="ghost"
                    disabled={busy}
                    onPress={() => setDialog("discard")}
                  />
                )}
              </Card>
            </View>
          )}
          {!active && (
            <Card style={{ padding: 24, gap: 18 }}>
              <Row style={{ justifyContent: "space-between", gap: 16 }}>
                <Row style={{ gap: 14, flex: 1 }}>
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: c.limeDim,
                    }}
                  >
                    <Icon name="radio-outline" size={26} color={c.lime} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="heading">Automatic capture</Txt>
                    <Txt
                      variant="small"
                      color={c.muted}
                      style={{ marginTop: 4 }}
                    >
                      Start moving. Park up. Find your story waiting.
                    </Txt>
                  </View>
                </Row>
                <Switch
                  accessibilityLabel="Automatic ride capture"
                  value={snapshot.automatic}
                  disabled={busy || hydrating || Platform.OS === "web"}
                  trackColor={{ false: c.line, true: "#566F36" }}
                  thumbColor={snapshot.automatic ? c.lime : c.muted}
                  onValueChange={(v) =>
                    v
                      ? setDialog("auto")
                      : void run(() =>
                          setAutomaticCapture(false, prefs.selectedVehicleId),
                        )
                  }
                />
              </Row>
              <Txt color={c.muted} style={{ fontSize: 13 }}>
                Detects sustained movement and saves after a three-minute stop.
                Short trips under 500 m are discarded.{" "}
                {Platform.OS === "web"
                  ? "Available in the Android and iOS app; this browser supports foreground manual recording."
                  : "Needs background location permission. Some devices limit recording after force-quit or battery optimisation."}
              </Txt>
            </Card>
          )}
          {!active && (
            <View>
              <Txt variant="heading" style={{ marginBottom: 14 }}>
                Choose your motorcycle
              </Txt>
              <Row style={{ flexWrap: "wrap" }}>
                {!prefs.vehicles.length && (
                  <View style={{ gap: 12 }}>
                    <Txt color={c.muted}>
                      You can record now and assign a motorcycle later.
                    </Txt>
                    <Button
                      title="Add your motorcycle"
                      kind="secondary"
                      icon="add"
                      onPress={() => router.navigate("/garage")}
                    />
                  </View>
                )}
                {prefs.vehicles.map((v) => (
                  <Chip
                    key={v.id}
                    label={v.name}
                    selected={prefs.selectedVehicleId === v.id}
                    onPress={() =>
                      void updatePrefs({ selectedVehicleId: v.id }).catch((e) =>
                        notify(e.message),
                      )
                    }
                  />
                ))}
              </Row>
            </View>
          )}
          <Card style={{ padding: 22, gap: 12 }}>
            <Row>
              <Icon name="checkmark-circle-outline" color={c.green} />
              <Txt style={{ fontFamily: f.bold }}>
                A moment before you leave
              </Txt>
            </Row>
            <Txt color={c.muted} style={{ fontSize: 13 }}>
              Check tyres, fuel and gear. Secure your phone. Set your route
              before setting off. This app records journeys; it does not monitor
              your safety or contact emergency services.
            </Txt>
          </Card>
        </Page>
      </ScrollView>
      <Dialog
        visible={dialog === "start" || dialog === "auto"}
        title={
          dialog === "auto" ? "Set up automatic capture" : "Ready to record?"
        }
        onClose={() => !busy && setDialog(null)}
      >
        <View style={{ gap: 18 }}>
          <Txt color={c.muted}>
            {Platform.OS === "web"
              ? "Your browser will ask for your location. Keep this tab visible and your screen awake; recording pauses when the tab is hidden."
              : Platform.OS === "android" && dialog === "start"
                ? "Allow precise location while using the app. A recording notification keeps this ride active when your screen is locked. Tap Finish ride when you are done."
                : "Apex Moto will ask for location access. Allow background / Always access to keep capturing with the screen locked. On Android, background access may open Settings. You can record manually if you decline it."}
          </Txt>
          {dialog === "auto" && (
            <Txt color={c.muted}>
              Automatic capture may also detect car journeys. Review your
              logbook afterwards. You can turn it off at any time.
            </Txt>
          )}
          <Txt variant="small" color={c.green}>
            No account required. Your route stays on this device.
          </Txt>
          <Button
            title={
              dialog === "auto" ? "Enable automatic capture" : "Start with GPS"
            }
            icon="navigate-outline"
            loading={busy}
            onPress={() =>
              void run(async () => {
                if (dialog === "auto") {
                  await setAutomaticCapture(true, prefs.selectedVehicleId);
                } else {
                  if (snapshot.automatic)
                    await setAutomaticCapture(false, prefs.selectedVehicleId);
                  await startRecording(prefs.selectedVehicleId);
                }
              })
            }
          />
        </View>
      </Dialog>
      <Dialog
        visible={dialog === "finish"}
        title="A ride worth keeping."
        onClose={() => !busy && setDialog(null)}
      >
        <View style={{ gap: 18 }}>
          <Txt color={c.muted}>
            Save {formatDistance(stats.distanceKm, prefs.units)} {prefs.units}{" "}
            to your personal logbook. You can name your ride and add notes next.
          </Txt>
          <Button
            title="Save ride"
            icon="checkmark"
            loading={busy}
            onPress={() => void run(finish)}
          />
          <Button
            title="Keep riding"
            kind="secondary"
            onPress={() => setDialog(null)}
          />
        </View>
      </Dialog>
      <Dialog
        visible={dialog === "discard"}
        title="Discard this recording?"
        onClose={() => !busy && setDialog(null)}
      >
        <View style={{ gap: 18 }}>
          <Txt color={c.muted}>
            This unsaved recording will be removed. Your saved rides are kept.
          </Txt>
          <Button
            title="Discard recording"
            kind="danger"
            loading={busy}
            onPress={() => void run(discardRecording)}
          />
          <Button
            title="Keep this ride"
            kind="secondary"
            onPress={() => setDialog(null)}
          />
        </View>
      </Dialog>
    </>
  );
}
