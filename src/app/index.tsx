import React, { useMemo, useState } from "react";
import { View, ScrollView, Pressable, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Page, PageHeading } from "../components/Shell";
import {
  Txt,
  Icon,
  Row,
  Button,
  Card,
  Tag,
  SectionTitle,
  Empty,
  IconButton,
} from "../components/ui";
import { RideRow } from "../components/RideRow";
import RouteMap from "../components/RouteMap";
import { ridingOverview } from "../domain/overview";
import { useApp } from "../state/AppContext";
import {
  colors as c,
  fonts as f,
  formatDistance,
  formatDuration,
} from "../theme";
export default function Home() {
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 1180,
    { prefs, rides, updateRide, notify, busy } = useApp(),
    [period, setPeriod] = useState<"week" | "all">("week"),
    [now] = useState(() => Date.now());
  const {
    all: summary,
    week: recent,
    start: monday,
  } = useMemo(() => ridingOverview(rides, now), [rides, now]);
  const selected = period === "week" ? recent : summary;
  const total = selected.reduce((s, r) => s + r.stats.distanceKm, 0),
    time = selected.reduce((s, r) => s + r.stats.movingSeconds, 0),
    weekKm = recent.reduce((s, r) => s + r.stats.distanceKm, 0),
    progress = Math.min(1, weekKm / prefs.weeklyGoalKm);
  const latest = summary[0];
  const bars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      label: d.toLocaleDateString("en", { weekday: "narrow" }),
      km: summary
        .filter(
          (r) =>
            r.ride.startedAt >= d.getTime() &&
            r.ride.startedAt < nextDay.getTime(),
        )
        .reduce((s, r) => s + r.stats.distanceKm, 0),
    };
  });
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Page>
        <PageHeading
          eyebrow="THE RIDER'S DASHBOARD"
          title="Every ride has a story."
          subtitle="Find your next road. Remember every turn."
          action={
            <Button
              title="Start a ride"
              icon="add"
              onPress={() => router.navigate("/record")}
            />
          }
        />
        <View
          style={{
            flexDirection: width < 620 * fontScale ? "column" : "row",
            alignItems: width < 620 * fontScale ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Txt variant="heading" style={{ flexShrink: 1 }}>
            Your riding, at a glance
          </Txt>
          <View
            accessibilityRole="tablist"
            accessibilityLabel="Riding summary period"
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              width: width < 620 * fontScale ? "100%" : 280 * fontScale,
              maxWidth: "100%",
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 12,
              padding: 4,
              gap: 4,
            }}
          >
            {(["week", "all"] as const).map((p) => (
              <Pressable
                key={p}
                accessibilityRole="tab"
                aria-selected={period === p}
                accessibilityState={{ selected: period === p }}
                onPress={() => setPeriod(p)}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  minHeight: 48,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  justifyContent: "center",
                  backgroundColor: period === p ? c.lime : "transparent",
                  borderRadius: 8,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Txt
                  color={period === p ? c.ink : c.muted}
                  style={{
                    fontSize: 14,
                    fontFamily: f.bold,
                    textAlign: "center",
                  }}
                >
                  {p === "week" ? "This week" : "All time"}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
        <Txt
          variant="small"
          color={c.muted}
          style={{ minHeight: 36 * fontScale }}
        >
          {period === "week"
            ? "Totals from rides started this week, Monday to Sunday."
            : "Totals from every ride saved in your logbook."}{" "}
          The latest ride and weekly goal below stay separate.
        </Txt>
        <Row
          style={{
            gap: 14,
            alignItems: "stretch",
            flexWrap: width < 580 ? "wrap" : "nowrap",
          }}
        >
          {[
            {
              label: "DISTANCE COVERED",
              value: formatDistance(total, prefs.units),
              unit: prefs.units,
              icon: "navigate-outline",
              note: "Every kilometre tells a story",
              values: bars.map((b) => b.km),
            },
            {
              label: "MOVING TIME",
              value: formatDuration(time),
              unit: "",
              icon: "time-outline",
              note: "Time well spent outside",
              values: bars.map((b) => b.km / 45),
            },
            {
              label: "RIDES TO REMEMBER",
              value: String(selected.length).padStart(2, "0"),
              unit: "rides",
              icon: "trail-sign-outline",
              note: "Your own collection of escapes",
              values: bars.map((b) => (b.km ? 1 : 0)),
            },
          ].map((stat, i) => (
            <Card
              key={stat.label}
              style={{
                flex: 1,
                minWidth: width < 580 ? (i === 2 ? "100%" : 140) : 0,
                padding: 20,
              }}
            >
              <Row style={{ justifyContent: "space-between", gap: 4 }}>
                <Txt
                  variant="label"
                  color={c.muted}
                  style={{ fontSize: 9, letterSpacing: 1 }}
                >
                  {stat.label}
                </Txt>
                <Icon name={stat.icon as any} size={17} color={c.lime} />
              </Row>
              <Row style={{ alignItems: "baseline", marginTop: 14, gap: 6 }}>
                <Txt
                  variant="metric"
                  style={{ fontSize: width < 500 ? 28 : 34 }}
                >
                  {stat.value}
                </Txt>
                <Txt variant="small" color={c.muted}>
                  {stat.unit}
                </Txt>
              </Row>
              {width > 600 && (
                <Txt variant="small" color={c.faint} style={{ marginTop: 6 }}>
                  {stat.note}
                </Txt>
              )}
            </Card>
          ))}
        </Row>
        <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
          <View style={{ flex: wide ? 1.8 : undefined, minWidth: 0 }}>
            <SectionTitle
              title="Your latest escape"
              action="All rides"
              onPress={() => router.navigate("/rides")}
            />
            {latest ? (
              <Card>
                <View style={{ position: "relative" }}>
                  <RouteMap points={latest.ride.points} height={285} />
                  <View style={{ position: "absolute", top: 16, left: 16 }}>
                    <Tag icon="radio-button-on-outline" color={c.lime}>
                      RECORDED RIDE
                    </Tag>
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      bottom: 20,
                      left: 20,
                      right: 20,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Replay latest ride"
                      onPress={() => router.push(`/ride/${latest.ride.id}`)}
                      style={({ pressed }) => ({
                        backgroundColor: "#111C17EF",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 32,
                          backgroundColor: c.lime,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name="play" size={14} color={c.ink} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt style={{ fontFamily: f.bold, fontSize: 13 }}>
                          Relive the ride
                        </Txt>
                        <Txt variant="small" color={c.muted}>
                          Every bend, all over again
                        </Txt>
                      </View>
                      <Icon name="arrow-forward" color={c.lime} size={18} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ padding: 20 }}>
                  <Row
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt variant="heading">{latest.ride.name}</Txt>
                      <Txt
                        variant="small"
                        color={c.muted}
                        style={{ marginTop: 5 }}
                      >
                        {new Date(latest.ride.startedAt).toLocaleDateString(
                          "en",
                          { weekday: "long", month: "short", day: "numeric" },
                        )}{" "}
                        ·{" "}
                        {prefs.vehicles.find(
                          (bike) => bike.id === latest.ride.vehicleId,
                        )?.name ?? "Your ride"}
                      </Txt>
                    </View>
                    <IconButton
                      icon={
                        latest.ride.isFavorite ? "bookmark" : "bookmark-outline"
                      }
                      label={
                        latest.ride.isFavorite
                          ? "Unfavourite latest ride"
                          : "Favourite latest ride"
                      }
                      active={latest.ride.isFavorite}
                      disabled={busy}
                      onPress={() =>
                        void updateRide({
                          ...latest.ride,
                          isFavorite: !latest.ride.isFavorite,
                        }).catch((e) => notify(e.message))
                      }
                    />
                  </Row>
                  <Row
                    style={{
                      marginTop: 22,
                      paddingTop: 18,
                      borderTopWidth: 1,
                      borderColor: c.line,
                      justifyContent: "space-between",
                    }}
                  >
                    {[
                      {
                        v: formatDistance(latest.stats.distanceKm, prefs.units),
                        u: prefs.units,
                        l: "Distance",
                      },
                      {
                        v: formatDuration(latest.stats.movingSeconds),
                        u: "",
                        l: "Moving time",
                      },
                      {
                        v: Math.round(latest.stats.elevationGainM),
                        u: "m",
                        l: "Elevation gain",
                      },
                    ].map((s) => (
                      <View key={s.l}>
                        <Row style={{ alignItems: "baseline", gap: 4 }}>
                          <Txt style={{ fontSize: 20, fontFamily: f.display }}>
                            {s.v}
                          </Txt>
                          <Txt variant="small" color={c.muted}>
                            {s.u}
                          </Txt>
                        </Row>
                        <Txt variant="small" color={c.faint}>
                          {s.l}
                        </Txt>
                      </View>
                    ))}
                  </Row>
                </View>
              </Card>
            ) : (
              <Empty
                icon="navigate-outline"
                title="Your first story awaits"
                body="Tap Start recording before you set off. Your route, time and memories will be waiting here when you return."
                action="Start recording"
                onPress={() => router.navigate("/record")}
              />
            )}
          </View>
          <View style={{ flex: wide ? 1 : undefined, gap: 20, minWidth: 0 }}>
            <SectionTitle title="Keep the good miles coming" />
            <Card style={{ padding: 22, marginTop: -20 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt style={{ fontFamily: f.bold }}>Your weekly goal</Txt>
                <Icon name="flag-outline" color={c.lime} />
              </Row>
              <Row style={{ alignItems: "baseline", marginTop: 14, gap: 6 }}>
                <Txt variant="metric">
                  {formatDistance(weekKm, prefs.units)}
                </Txt>
                <Txt color={c.muted}>
                  / {formatDistance(prefs.weeklyGoalKm, prefs.units, 0)}{" "}
                  {prefs.units}
                </Txt>
              </Row>
              <View
                style={{
                  height: 5,
                  backgroundColor: c.line,
                  borderRadius: 5,
                  marginTop: 12,
                }}
              >
                <View
                  style={{
                    height: 5,
                    backgroundColor: c.lime,
                    width: `${progress * 100}%`,
                    borderRadius: 5,
                  }}
                />
              </View>
              <Txt variant="small" color={c.muted} style={{ marginTop: 10 }}>
                {progress >= 1
                  ? "Goal complete. Enjoy the journey."
                  : `${formatDistance(Math.max(0, prefs.weeklyGoalKm - weekKm), prefs.units, 0)} ${prefs.units} to your weekly goal`}
              </Txt>
              <View
                style={{
                  flexDirection: "row",
                  height: 83,
                  gap: 12,
                  marginTop: 16,
                }}
              >
                {bars.map((b, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <View
                      accessibilityLabel={`${b.label}: ${formatDistance(b.km, prefs.units)} ${prefs.units}`}
                      style={{
                        width: "100%",
                        maxWidth: 26,
                        height: Math.max(
                          4,
                          (b.km / Math.max(...bars.map((b) => b.km), 1)) * 52,
                        ),
                        backgroundColor: b.km
                          ? i === 6
                            ? c.lime
                            : "#536D45"
                          : c.line,
                        borderRadius: 4,
                      }}
                    />
                    <Txt style={{ fontSize: 10 }} color={c.faint}>
                      {b.label}
                    </Txt>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate("/settings")}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  alignSelf: "flex-start",
                  marginTop: 8,
                }}
              >
                <Txt variant="small" color={c.lime}>
                  Adjust your goal ↗
                </Txt>
              </Pressable>
            </Card>
            <Card style={{ padding: 22, backgroundColor: "#19221B" }}>
              <Row style={{ gap: 12 }}>
                <View
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: "#2B3824",
                  }}
                >
                  <Icon name="radio-outline" color={c.lime} size={24} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: f.bold }}>
                    Just you and the road.
                  </Txt>
                  <Txt variant="small" color={c.muted}>
                    Let the app remember the ride.
                  </Txt>
                </View>
              </Row>
              <Txt
                style={{ fontSize: 13, lineHeight: 20, marginVertical: 15 }}
                color={c.muted}
              >
                Set up automatic capture on your phone, then focus on what’s
                ahead.
              </Txt>
              <Button
                title="Set up ride capture"
                kind="secondary"
                icon="arrow-forward"
                small
                onPress={() => router.navigate("/record")}
              />
            </Card>
          </View>
        </View>
        <View>
          <SectionTitle
            title="From your logbook"
            action="View logbook"
            onPress={() => router.navigate("/rides")}
          />
          {rides.length ? (
            <Card>
              {rides.slice(1, 4).length ? (
                rides
                  .slice(1, 4)
                  .map((ride) => (
                    <RideRow key={ride.id} ride={ride} units={prefs.units} />
                  ))
              ) : (
                <RideRow ride={rides[0]} units={prefs.units} />
              )}
            </Card>
          ) : (
            <Txt color={c.muted}>Your next ride belongs here.</Txt>
          )}
        </View>
        <Row style={{ justifyContent: "center", marginTop: 4, gap: 7 }}>
          <Icon name="leaf-outline" size={14} color={c.faint} />
          <Txt variant="small" color={c.faint}>
            It’s about the ride. Not the race.
          </Txt>
        </Row>
      </Page>
    </ScrollView>
  );
}
