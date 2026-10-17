import React, { useMemo } from "react";
import { View, ScrollView, Linking, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Page, PageHeading } from "../../components/Shell";
import { Txt, Row, Button, Card, Empty } from "../../components/ui";
import RouteMap from "../../components/RouteMap";
import { scenicRoutes, routePoints } from "../../data/routes";
import { useApp } from "../../state/AppContext";
import { colors as c, fonts as f, formatDistance } from "../../theme";
export default function RouteDetail() {
  const { fontScale } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>(),
    route = scenicRoutes.find((r) => r.id === id),
    { prefs, updatePrefs, notify } = useApp();
  const points = useMemo(() => (route ? routePoints(route) : []), [route]);
  if (!route)
    return (
      <Page>
        <Empty
          icon="compass-outline"
          title="Route not found"
          body="This route is not in the local collection."
          action="Explore routes"
          onPress={() => router.replace("/explore")}
        />
      </Page>
    );
  const saved = prefs.savedRoutes.includes(route.id);
  const save = async () => {
    try {
      await updatePrefs({
        savedRoutes: saved
          ? prefs.savedRoutes.filter((x) => x !== id)
          : [...prefs.savedRoutes, id],
      });
      notify(
        saved
          ? "Route removed from saved."
          : "Route geometry and stops saved for offline viewing.",
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const directions = async () => {
    const first = route.shape[0],
      last = route.shape.at(-1)!;
    try {
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&origin=${first[1]},${first[0]}&destination=${last[1]},${last[0]}&travelmode=driving`,
      );
    } catch {
      notify("Could not open maps. Try again when connected.");
    }
  };
  return (
    <ScrollView>
      <Page>
        <Row>
          <Button
            title="Explore routes"
            icon="arrow-back"
            kind="ghost"
            onPress={() => router.navigate("/explore")}
          />
        </Row>
        <PageHeading
          eyebrow={route.region.toUpperCase()}
          title={route.name}
          subtitle={route.description}
          action={
            <Button
              title={saved ? "Saved for later" : "Save this route"}
              icon={saved ? "bookmark" : "bookmark-outline"}
              kind={saved ? "secondary" : "primary"}
              onPress={() => void save()}
            />
          }
        />
        <Card>
          <RouteMap points={points} interactive height={380} />
        </Card>
        <Row style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          {[
            {
              l: "DISTANCE",
              v: `${formatDistance(route.distanceKm, prefs.units)}\u00a0${prefs.units}`,
            },
            {
              l: "ESTIMATED RIDE",
              v: `${Math.ceil(route.durationSeconds / 60)}\u00a0min`,
            },
            { l: "THE MOOD", v: route.category },
          ].map((m) => (
            <Card
              key={m.l}
              style={{
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: 150 * fontScale,
                padding: 22,
              }}
            >
              <Txt variant="label" color={c.muted}>
                {m.l}
              </Txt>
              <Txt variant="heading" style={{ marginTop: 10 }}>
                {m.v}
              </Txt>
            </Card>
          ))}
        </Row>
        <Card style={{ padding: 24 }}>
          <Txt variant="heading">Good places to pause</Txt>
          {route.stops.map((stop, i) => (
            <Row key={stop} style={{ paddingTop: 24, gap: 16 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 34,
                  backgroundColor: c.limeDim,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt color={c.lime} style={{ fontFamily: f.bold }}>
                  {i + 1}
                </Txt>
              </View>
              <View>
                <Txt>{stop}</Txt>
                <Txt variant="small" color={c.muted}>
                  {i === 0
                    ? "Your starting point"
                    : i === route.stops.length - 1
                      ? "Put the stand down. Take it in."
                      : "A moment along the way"}
                </Txt>
              </View>
            </Row>
          ))}
        </Card>
        <Card style={{ padding: 24, gap: 14 }}>
          <Txt variant="heading">Make it your next story.</Txt>
          <Txt color={c.muted}>
            Open directions to the route’s destination in your maps app, or
            start a recording here. Your maps app may choose a different path.
          </Txt>
          <Row style={{ flexWrap: "wrap" }}>
            <Button
              title="Open directions"
              icon="open-outline"
              onPress={() => void directions()}
            />
            <Button
              title="Record a ride"
              icon="radio-button-on-outline"
              kind="secondary"
              onPress={() => router.push("/record")}
            />
          </Row>
          <Txt variant="small" color={c.faint}>
            Preview route, not turn-by-turn navigation. Verify access and
            conditions.
          </Txt>
        </Card>
      </Page>
    </ScrollView>
  );
}
