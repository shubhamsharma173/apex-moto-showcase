import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  ScrollView,
  useWindowDimensions,
  AccessibilityInfo,
  AppState,
  Switch,
} from "react-native";
import Slider from "@react-native-community/slider";
import { router, useLocalSearchParams } from "expo-router";
import { Page, PageHeading } from "../../components/Shell";
import {
  Txt,
  Icon,
  Row,
  Button,
  Card,
  Tag,
  Empty,
  IconButton,
  Chip,
  Field,
} from "../../components/ui";
import { Dialog } from "../../components/Dialog";
import { RouteShape } from "../../components/RouteShape";
import { TelemetryChart } from "../../components/TelemetryChart";
import { sampleTelemetry, SPEED_COLORS } from "../../domain/display";
import RouteMap from "../../components/RouteMap";
import {
  summarizeRide,
  filterRidePoints,
  trimRideForPrivacy,
} from "../../domain/ride";
import { shareCard, shareGpx, sharePng } from "../../services/files";
import { useApp } from "../../state/AppContext";
import {
  colors as c,
  fonts as f,
  formatDistance,
  formatDuration,
  formatClock,
  distance,
} from "../../theme";
export default function RideRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RideDetail key={id} id={id} />;
}
function RideDetail({ id }: { id: string }) {
  const postcard = useRef<View>(null);
  const { width } = useWindowDimensions(),
    { rides, realRides, prefs, updateRide, removeRide, notify } = useApp();
  const ride =
    rides.find((r) => r.id === id) ?? realRides.find((r) => r.id === id);
  const [playing, setPlaying] = useState(false),
    [cursor, setCursor] = useState(0),
    [rate, setRate] = useState(1),
    [tilted, setTilted] = useState(false),
    [chart, setChart] = useState<"speed" | "elevation" | "lean">("speed"),
    [dialog, setDialog] = useState<"share" | "edit" | "delete" | null>(null),
    [privateEnds, setPrivateEnds] = useState(prefs.privacyTrim),
    [name, setName] = useState(ride?.name ?? ""),
    [notes, setNotes] = useState(ride?.notes ?? ""),
    [vehicle, setVehicle] = useState(
      ride?.vehicleId ?? prefs.selectedVehicleId,
    ),
    [busy, setBusy] = useState(false),
    [reduced, setReduced] = useState(false),
    [error, setError] = useState("");
  const points = useMemo(
    () => filterRidePoints(ride?.points ?? []),
    [ride?.points],
  );
  const stats = useMemo(() => (ride ? summarizeRide(ride) : null), [ride]);
  const duration =
    points.length > 1
      ? (points.at(-1)!.timestamp - points[0].timestamp) / 1000
      : 0;
  const skipSeconds = duration < 120 ? 5 : 30;
  useEffect(() => {
    const changeMotion = (v: boolean) => {
      setReduced(v);
      if (v) setPlaying(false);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(changeMotion);
    const listener = AccessibilityInfo.addEventListener(
        "reduceMotionChanged",
        changeMotion,
      ),
      sub = AppState.addEventListener("change", (s) => {
        if (s !== "active") setPlaying(false);
      });
    return () => {
      listener.remove();
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!playing || reduced) return;
    const timer = setInterval(
      () =>
        setCursor((t) => {
          if (t + rate * 0.2 >= duration) {
            setPlaying(false);
            return duration;
          }
          return t + rate * 0.2;
        }),
      200,
    );
    return () => clearInterval(timer);
  }, [playing, rate, duration, reduced]);
  let idx = 0;
  if (points.length) {
    let lo = 0,
      hi = points.length - 1,
      target = points[0].timestamp + cursor * 1000;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (points[mid].timestamp <= target) lo = mid;
      else hi = mid - 1;
    }
    idx = lo;
  }
  const current = points[idx],
    previous = points[Math.max(0, idx - 1)],
    dt =
      current && previous ? (current.timestamp - previous.timestamp) / 1000 : 0;
  const force =
    dt > 0 &&
    current?.speed != null &&
    previous?.speed != null &&
    current.segment === previous.segment
      ? (current.speed - previous.speed) / dt / 9.80665
      : null;
  const heading = current?.heading ?? null;
  const lean = current?.lean;
  const chartValues = useMemo(
    () =>
      sampleTelemetry(points, chart).map((p) => ({
        ...p,
        y: p.y != null && chart === "speed" ? distance(p.y, prefs.units) : p.y,
      })),
    [points, chart, prefs.units],
  );
  const shareRide = useMemo(
    () => (ride ? (privateEnds ? trimRideForPrivacy(ride, 300) : ride) : null),
    [ride, privateEnds],
  );
  if (!ride || !stats)
    return (
      <Page>
        <Empty
          icon="trail-sign-outline"
          title="Ride not found"
          body="This ride may have been removed or belongs to another device."
          action="Back to logbook"
          onPress={() => router.replace("/rides")}
        />
      </Page>
    );
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggleFavorite = async () => {
    try {
      await updateRide({ ...ride, isFavorite: !ride.isFavorite });
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const save = async () => {
    if (!name.trim()) {
      setError("Give this ride a name.");
      return;
    }
    await updateRide({
      ...ride,
      name: name.trim().slice(0, 100),
      notes: notes.slice(0, 2000),
      vehicleId: vehicle,
    });
    setDialog(null);
    notify("Ride details saved.");
  };
  const speed = distance((current?.speed ?? 0) * 3.6, prefs.units);
  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Page>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <Button
              title="Ride log"
              kind="ghost"
              icon="arrow-back"
              onPress={() => router.replace("/rides")}
            />
            <Row>
              <IconButton
                label={ride.isFavorite ? "Remove favourite" : "Favourite ride"}
                icon={ride.isFavorite ? "bookmark" : "bookmark-outline"}
                active={ride.isFavorite}
                onPress={() => void toggleFavorite()}
              />
              <IconButton
                label="Edit ride"
                icon="create-outline"
                onPress={() => {
                  setName(ride.name);
                  setNotes(ride.notes);
                  setVehicle(ride.vehicleId);
                  setError("");
                  setDialog("edit");
                }}
              />
              <Button
                title="Share ride"
                kind="secondary"
                small
                icon="share-outline"
                onPress={() => {
                  setPlaying(false);
                  setPrivateEnds(prefs.privacyTrim);
                  setError("");
                  setDialog("share");
                }}
              />
            </Row>
          </Row>
          <PageHeading
            eyebrow={
              ride.source === "import"
                ? "YOUR SAVED RIDE"
                : "YOUR RIDE, REMEMBERED"
            }
            title={ride.name}
            subtitle={`${new Date(ride.startedAt).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })} · ${new Date(ride.startedAt).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })} · ${prefs.vehicles.find((v) => v.id === ride.vehicleId)?.name ?? "Motorcycle"}`}
          />
          {ride.source === "import" && ride.importWarnings?.length ? (
            <Card style={{ padding: 18, gap: 8 }}>
              <Txt variant="heading">About this import</Txt>
              {ride.importWarnings.map((warning) => (
                <Txt key={warning} variant="small" color={c.muted}>
                  {warning}
                </Txt>
              ))}
            </Card>
          ) : null}
          <View
            style={{ flexDirection: width >= 1120 ? "row" : "column", gap: 22 }}
          >
            <View
              style={{ flex: width >= 1120 ? 1.9 : undefined, minWidth: 0 }}
            >
              <Card>
                <View>
                  <RouteMap
                    points={points}
                    markerIndex={idx}
                    interactive
                    tilted={tilted}
                    height={width < 500 ? 320 : 420}
                  />
                  <View style={{ position: "absolute", top: 16, left: 16 }}>
                    <Tag icon="play-circle-outline" color={c.lime}>
                      RIDE REPLAY
                    </Tag>
                  </View>
                  <View style={{ position: "absolute", bottom: 34, right: 16 }}>
                    <Button
                      title={tilted ? "2D map" : "Tilt map"}
                      icon="layers-outline"
                      kind="secondary"
                      small
                      onPress={() => setTilted((v) => !v)}
                    />
                  </View>
                </View>
                <View
                  style={{
                    padding: 20,
                    borderTopWidth: 1,
                    borderColor: c.line,
                    gap: 12,
                  }}
                >
                  <Row style={{ flexWrap: "wrap", gap: 12 }}>
                    {[
                      {
                        color: SPEED_COLORS.under30,
                        text: `<${Math.round(distance(30, prefs.units))}`,
                      },
                      {
                        color: SPEED_COLORS.from30To60,
                        text: `${Math.round(distance(30, prefs.units))}–${Math.round(distance(60, prefs.units))}`,
                      },
                      {
                        color: SPEED_COLORS.from60,
                        text: `≥${Math.round(distance(60, prefs.units))} ${prefs.units}/h`,
                      },
                    ].map((item) => (
                      <Row key={item.color} style={{ gap: 5 }}>
                        <View
                          style={{
                            height: 3,
                            width: 14,
                            backgroundColor: item.color,
                          }}
                        />
                        <Txt variant="small" color={c.muted}>
                          {item.text}
                        </Txt>
                      </Row>
                    ))}
                  </Row>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Row>
                      <IconButton
                        icon={playing ? "pause" : "play"}
                        label={playing ? "Pause replay" : "Play replay"}
                        active
                        onPress={() => {
                          if (reduced) {
                            notify(
                              "Reduced motion is on. Use the timeline or step buttons to explore this ride.",
                            );
                            return;
                          }
                          if (cursor >= duration) setCursor(0);
                          setPlaying((v) => !v);
                        }}
                        disabled={!points.length}
                      />
                      <View>
                        <Txt style={{ fontFamily: f.bold, fontSize: 13 }}>
                          Back in the moment
                        </Txt>
                        <Txt variant="small" color={c.muted}>
                          {formatClock(cursor)} / {formatClock(duration)}
                        </Txt>
                      </View>
                    </Row>
                    <Button
                      title={`${rate}×`}
                      kind="secondary"
                      small
                      onPress={() =>
                        setRate((r) => {
                          const speeds = [1, 2, 4, 8, 16, 32, 64];
                          return speeds[
                            (speeds.indexOf(r) + 1) % speeds.length
                          ];
                        })
                      }
                    />
                  </Row>
                  <Slider
                    accessibilityLabel="Ride replay timeline"
                    accessibilityValue={{
                      min: 0,
                      max: Math.round(duration),
                      now: Math.round(cursor),
                      text: formatClock(cursor),
                    }}
                    minimumValue={0}
                    maximumValue={Math.max(1, duration)}
                    value={cursor}
                    onSlidingStart={() => setPlaying(false)}
                    onValueChange={setCursor}
                    minimumTrackTintColor={c.lime}
                    maximumTrackTintColor={c.line}
                    thumbTintColor={c.lime}
                    style={{ width: "100%", height: 40 }}
                  />
                  <Row style={{ justifyContent: "space-between" }}>
                    <Button
                      title={`−${skipSeconds} seconds`}
                      icon="play-back-outline"
                      kind="ghost"
                      small
                      onPress={() => {
                        setPlaying(false);
                        setCursor((v) => Math.max(0, v - skipSeconds));
                      }}
                    />
                    <Button
                      title={`+${skipSeconds} seconds`}
                      icon="play-forward-outline"
                      kind="ghost"
                      small
                      onPress={() => {
                        setPlaying(false);
                        setCursor((v) => Math.min(duration, v + skipSeconds));
                      }}
                    />
                  </Row>
                </View>
              </Card>
            </View>
            <Card
              style={{
                flex: width >= 1120 ? 1 : undefined,
                padding: 24,
                gap: 18,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <Txt variant="label" color={c.muted}>
                  IN THIS MOMENT
                </Txt>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    backgroundColor: c.lime,
                    borderRadius: 7,
                  }}
                />
              </Row>
              <Row
                style={{
                  alignItems: "baseline",
                  justifyContent: "center",
                  marginTop: 10,
                }}
              >
                <Txt
                  style={{
                    fontFamily: f.displayBold,
                    fontSize: 68,
                    lineHeight: 80,
                    letterSpacing: -3,
                  }}
                >
                  {current?.speed == null ? "—" : Math.round(speed)}
                </Txt>
                <Txt color={c.muted}>{prefs.units}/h</Txt>
              </Row>
              <Txt
                variant="small"
                color={c.muted}
                style={{ textAlign: "center", marginTop: -12 }}
              >
                {current?.speed == null
                  ? "GPS speed not recorded"
                  : "GPS speed"}
              </Txt>
              <View style={{ height: 1, backgroundColor: c.line }} />
              <Row style={{ justifyContent: "space-between" }}>
                <View>
                  <Txt variant="label" color={c.muted}>
                    LEAN
                  </Txt>
                  <Txt variant="metric" style={{ fontSize: 29 }}>
                    {lean == null ? "—" : `${Math.abs(lean).toFixed(0)}°`}
                  </Txt>
                  <Txt variant="small" color={c.faint}>
                    {lean == null
                      ? "Not measured"
                      : lean < 0
                        ? "Left · phone estimate"
                        : "Right · phone estimate"}
                  </Txt>
                </View>
                <View
                  style={{
                    width: 100,
                    height: 90,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      bottom: 12,
                      width: 100,
                      height: 1,
                      backgroundColor: c.line,
                    }}
                  />
                  <View
                    style={{
                      width: 10,
                      height: 65,
                      borderRadius: 8,
                      opacity: lean == null ? 0 : 1,
                      backgroundColor: c.lime,
                      transform: [{ rotate: `${lean ?? 0}deg` }],
                      borderWidth: 2,
                      borderColor: c.bg,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 6,
                      width: 12,
                      height: 12,
                      borderRadius: 12,
                      backgroundColor: c.text,
                    }}
                  />
                </View>
              </Row>
              <View style={{ height: 1, backgroundColor: c.line }} />
              <Row style={{ justifyContent: "space-between" }}>
                <View>
                  <Txt variant="label" color={c.muted}>
                    ACCELERATION
                  </Txt>
                  <Txt variant="heading" style={{ marginTop: 8 }}>
                    {force == null ? "—" : `${force.toFixed(2)} g`}
                  </Txt>
                </View>
                <View>
                  <Txt variant="label" color={c.muted}>
                    HEADING
                  </Txt>
                  <Txt variant="heading" style={{ marginTop: 8 }}>
                    {heading == null ? "—" : `${Math.round(heading)}°`}
                  </Txt>
                </View>
              </Row>
              <Txt variant="small" color={c.faint}>
                GPS-derived acceleration. Lean uses a calibrated mounted phone
                when available; it is not a vehicle-grade measurement.
              </Txt>
              <View
                style={{
                  backgroundColor: c.limeDim,
                  borderRadius: 12,
                  padding: 14,
                  marginTop: "auto",
                }}
              >
                <Row>
                  <Icon name="leaf-outline" size={18} color={c.lime} />
                  <Txt variant="small" color={c.lime}>
                    Enjoy the corners. Forget the rankings.
                  </Txt>
                </Row>
              </View>
            </Card>
          </View>
          <Row style={{ flexWrap: "wrap", gap: 12 }}>
            {[
              {
                l: "DISTANCE",
                v: formatDistance(stats.distanceKm, prefs.units),
                u: prefs.units,
                icon: "navigate-outline",
              },
              {
                l: "MOVING TIME",
                v: formatDuration(stats.movingSeconds),
                u: "",
                icon: "time-outline",
              },
              {
                l: "AVERAGE SPEED",
                v: Math.round(distance(stats.averageSpeedKmh, prefs.units)),
                u: `${prefs.units}/h`,
                icon: "speedometer-outline",
              },
              {
                l: "ELEVATION GAIN",
                v: Math.round(stats.elevationGainM),
                u: "m",
                icon: "trending-up-outline",
              },
            ].map((m) => (
              <Card
                key={m.l}
                style={{
                  flex: 1,
                  minWidth: width < 500 ? "44%" : 170,
                  padding: 20,
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="label" color={c.muted} style={{ fontSize: 9 }}>
                    {m.l}
                  </Txt>
                  <Icon name={m.icon as any} color={c.lime} size={16} />
                </Row>
                <Row style={{ alignItems: "baseline", marginTop: 13, gap: 5 }}>
                  <Txt variant="heading" style={{ fontSize: 24 }}>
                    {m.v}
                  </Txt>
                  <Txt variant="small" color={c.muted}>
                    {m.u}
                  </Txt>
                </Row>
              </Card>
            ))}
          </Row>
          <Card style={{ padding: 24 }}>
            <Row
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              <View>
                <Txt variant="heading">The shape of your ride</Txt>
                <Txt variant="small" color={c.muted} style={{ marginTop: 5 }}>
                  Scrub the replay timeline to explore each moment.
                </Txt>
              </View>
              <Row style={{ flexWrap: "wrap" }}>
                {(["speed", "elevation", "lean"] as const).map((t) => (
                  <Chip
                    label={t.charAt(0).toUpperCase() + t.slice(1)}
                    selected={chart === t}
                    onPress={() => setChart(t)}
                    key={t}
                  />
                ))}
              </Row>
            </Row>
            {!chartValues.some((sample) => sample.y != null) ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <Txt color={c.muted}>No {chart} measurements on this ride.</Txt>
                <Txt variant="small" color={c.faint}>
                  {chart === "lean"
                    ? "Calibrate a fixed phone mount before your next recording."
                    : "This value was not recorded in the source data."}
                </Txt>
              </View>
            ) : (
              <View>
                <Txt
                  variant="small"
                  color={c.lime}
                  style={{ marginBottom: 12 }}
                >
                  {chart === "speed"
                    ? current?.speed == null
                      ? "Not recorded"
                      : `${Math.round(speed)} ${prefs.units}/h`
                    : chart === "elevation"
                      ? current?.altitude == null
                        ? "Not recorded"
                        : `${Math.round(current.altitude)} m`
                      : current?.lean == null
                        ? "Not recorded"
                        : `${current.lean.toFixed(0)}°`}{" "}
                  at {formatClock(cursor)}
                </Txt>
                <View style={{ position: "relative" }}>
                  <TelemetryChart
                    cursor={cursor}
                    duration={duration}
                    unit={
                      chart === "speed"
                        ? `${prefs.units}/h`
                        : chart === "lean"
                          ? "°"
                          : "m"
                    }
                    samples={chartValues}
                    height={140}
                    color={
                      chart === "elevation"
                        ? c.cyan
                        : chart === "lean"
                          ? c.orange
                          : c.lime
                    }
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: `${duration ? (cursor / duration) * 100 : 0}%`,
                      height: "100%",
                      width: 1,
                      backgroundColor: c.text,
                      opacity: 0.5,
                    }}
                  />
                </View>
                <Row style={{ justifyContent: "space-between", marginTop: 12 }}>
                  <Txt variant="small" color={c.faint}>
                    START
                  </Txt>
                  <Txt variant="small" color={c.faint}>
                    {chart === "speed"
                      ? "GPS SPEED"
                      : chart === "elevation"
                        ? "GPS ALTITUDE"
                        : "PHONE LEAN"}
                  </Txt>
                  <Txt variant="small" color={c.faint}>
                    FINISH
                  </Txt>
                </Row>
              </View>
            )}
          </Card>
          <Row style={{ gap: 16, flexWrap: "wrap" }}>
            <Card style={{ flex: 1, minWidth: 250, padding: 24 }}>
              <Txt variant="heading">A little more detail</Txt>
              {[
                {
                  l: "Top speed",
                  v: `${Math.round(distance(stats.maxSpeedKmh, prefs.units))} ${prefs.units}/h`,
                },
                { l: "Stopped time", v: formatDuration(stats.stoppedSeconds) },
                { l: "Detected turns", v: String(stats.corners) },
                {
                  l: "Maximum left / right lean",
                  v:
                    stats.maxLeanLeft == null
                      ? "Not measured"
                      : `${Math.round(stats.maxLeanLeft)}° / ${Math.round(stats.maxLeanRight ?? 0)}°`,
                },
              ].map((m) => (
                <Row
                  key={m.l}
                  style={{
                    justifyContent: "space-between",
                    paddingTop: 18,
                    gap: 10,
                  }}
                >
                  <Txt variant="small" color={c.muted}>
                    {m.l}
                  </Txt>
                  <Txt variant="small" style={{ fontFamily: f.bold }}>
                    {m.v}
                  </Txt>
                </Row>
              ))}
              <Txt variant="small" color={c.faint} style={{ marginTop: 18 }}>
                Turn counts and elevation are GPS estimates.
              </Txt>
            </Card>
            <Card style={{ flex: 1, minWidth: 250, padding: 24, gap: 12 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt variant="heading">Notes from the road</Txt>
                <Icon name="create-outline" color={c.lime} />
              </Row>
              <Txt color={c.muted}>
                {ride.notes ||
                  "A favourite stop, a road to revisit, a moment to remember. Add a note to make this ride yours."}
              </Txt>
              <Button
                title="Edit ride details"
                kind="secondary"
                small
                onPress={() => {
                  setName(ride.name);
                  setNotes(ride.notes);
                  setVehicle(ride.vehicleId);
                  setError("");
                  setDialog("edit");
                }}
              />
            </Card>
          </Row>
          <Button
            title="Delete this ride"
            icon="trash-outline"
            kind="ghost"
            onPress={() => {
              setError("");
              setDialog("delete");
            }}
          />
        </Page>
      </ScrollView>
      <Dialog
        visible={dialog === "share"}
        title="A ride worth sharing."
        onClose={() => !busy && setDialog(null)}
      >
        <View style={{ gap: 18 }}>
          <View
            ref={postcard}
            collapsable={false}
            style={{
              backgroundColor: c.bg,
              padding: 20,
              aspectRatio: 0.8,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Txt variant="label" color={c.lime}>
              APEX MOTO
            </Txt>
            <Txt variant="heading" style={{ marginTop: 12 }}>
              {ride.name}
            </Txt>
            <Txt variant="small" color={c.muted}>
              {new Date(ride.startedAt).toLocaleDateString()}
            </Txt>
            <View style={{ flex: 1, minHeight: 80 }}>
              <RouteShape points={shareRide?.points ?? []} />
            </View>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt>
                {formatDistance(
                  summarizeRide(shareRide!).distanceKm,
                  prefs.units,
                )}{" "}
                {prefs.units}
              </Txt>
              <Txt color={c.muted}>
                {formatDuration(summarizeRide(shareRide!).movingSeconds)}
              </Txt>
            </Row>
            {privateEnds && (
              <Txt variant="small" color={c.faint} style={{ marginTop: 8 }}>
                Shared portion · start and finish hidden
              </Txt>
            )}
          </View>
          <Row style={{ justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontFamily: f.bold }}>
                Hide the start and finish
              </Txt>
              <Txt variant="small" color={c.muted}>
                Remove the first and last 300 metres.
              </Txt>
            </View>
            <Switch
              accessibilityLabel="Hide start and finish for sharing"
              value={privateEnds}
              onValueChange={setPrivateEnds}
              trackColor={{ false: c.line, true: "#566F36" }}
              thumbColor={privateEnds ? c.lime : c.muted}
            />
          </Row>
          {!privateEnds && (
            <Txt variant="small" color={c.orange}>
              Your full route may reveal private places.
            </Txt>
          )}
          {!!error && (
            <Txt accessibilityRole="alert" color={c.red}>
              {error}
            </Txt>
          )}
          <Button
            title="Export postcard · PNG"
            icon="image-outline"
            loading={busy}
            onPress={() =>
              void run(async () => {
                await sharePng(ride, prefs.units, privateEnds, postcard);
                notify("Postcard exported.");
              })
            }
          />
          <Button
            title="Export postcard · SVG"
            icon="image-outline"
            kind="secondary"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await shareCard(ride, prefs.units, privateEnds);
                notify("Postcard exported.");
              })
            }
          />
          <Button
            title="Export GPX track"
            icon="download-outline"
            kind="secondary"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await shareGpx(ride, privateEnds);
                notify("GPX track exported.");
              })
            }
          />
          <Txt variant="small" color={c.faint}>
            Review the preview before sharing. Exported files stay outside the
            app’s privacy controls.
          </Txt>
        </View>
      </Dialog>
      <Dialog
        visible={dialog === "edit"}
        title="Make this ride yours."
        onClose={() => !busy && setDialog(null)}
      >
        <Field label="Ride name" value={name} onChangeText={setName} />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Txt variant="small" color={c.muted} style={{ marginBottom: 8 }}>
          Motorcycle
        </Txt>
        <Row style={{ flexWrap: "wrap", marginBottom: 20 }}>
          <Chip
            label="Unassigned"
            selected={!vehicle}
            onPress={() => setVehicle("")}
          />
          {prefs.vehicles.map((v) => (
            <Chip
              key={v.id}
              label={v.name}
              selected={vehicle === v.id}
              onPress={() => setVehicle(v.id)}
            />
          ))}
        </Row>
        {!prefs.vehicles.length && (
          <Txt variant="small" color={c.muted} style={{ marginBottom: 16 }}>
            No motorcycles yet. You can save this ride unassigned and add a
            motorcycle in Garage later.
          </Txt>
        )}
        {!!error && (
          <Txt
            accessibilityRole="alert"
            color={c.red}
            style={{ marginBottom: 12 }}
          >
            {error}
          </Txt>
        )}
        <Button
          title="Save changes"
          loading={busy}
          onPress={() => void run(save)}
        />
      </Dialog>
      <Dialog
        visible={dialog === "delete"}
        title="Remove this ride?"
        onClose={() => !busy && setDialog(null)}
      >
        <View style={{ gap: 18 }}>
          <Txt color={c.muted}>
            This removes the ride from this device. Export a copy first if you
            want to keep it.
          </Txt>
          {!!error && (
            <Txt accessibilityRole="alert" color={c.red}>
              {error}
            </Txt>
          )}
          <Button
            title="Delete ride"
            icon="trash-outline"
            kind="danger"
            loading={busy}
            onPress={() =>
              void run(async () => {
                await removeRide(ride.id);
                router.replace("/rides");
                notify("Ride removed.");
              })
            }
          />
          <Button
            title="Keep ride"
            kind="secondary"
            onPress={() => setDialog(null)}
          />
        </View>
      </Dialog>
    </>
  );
}
