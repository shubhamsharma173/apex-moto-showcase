import React, { useMemo, useState } from "react";
import { View, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Page, PageHeading } from "../components/Shell";
import {
  Txt,
  Icon,
  Row,
  Button,
  Card,
  Chip,
  Empty,
  IconButton,
} from "../components/ui";
import { RouteShape } from "../components/RouteShape";
import { filterRidePoints, summarizeRide, thinPoints } from "../domain/ride";
import { useApp } from "../state/AppContext";
import { colors as c, fonts as f, formatDistance } from "../theme";

export default function Explore() {
  const { rides, prefs, updateRide, notify, busy } = useApp();
  const { fontScale } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [limit, setLimit] = useState(12);
  const matching = useMemo(
    () =>
      rides.filter(
        (r) =>
          r.points.length > 1 &&
          (!saved || r.isFavorite) &&
          r.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [rides, search, saved],
  );
  const routes = useMemo(
    () =>
      matching.slice(0, limit).map((ride) => ({
        ride,
        points: thinPoints(filterRidePoints(ride.points), 200),
        stats: summarizeRide(ride),
      })),
    [matching, limit],
  );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      <Page>
        <PageHeading
          eyebrow="YOUR ROADS"
          title="Worth riding again."
          subtitle="Explore the routes from your own recorded rides. Save your favourites for another day."
        />
        <Row
          style={{
            backgroundColor: c.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.line,
            paddingHorizontal: 16,
          }}
        >
          <Icon name="search-outline" />
          <TextInput
            accessibilityLabel="Search your roads"
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setLimit(12);
            }}
            placeholder="Search your recorded rides"
            placeholderTextColor={c.faint}
            style={{
              flex: 1,
              minWidth: 0,
              color: c.text,
              fontFamily: f.regular,
              fontSize: 15,
              minHeight: 54,
            }}
          />
        </Row>
        <Row style={{ flexWrap: "wrap" }}>
          <Chip
            label="All my roads"
            selected={!saved}
            onPress={() => {
              setSaved(false);
              setLimit(12);
            }}
          />
          <Chip
            label="Favourites"
            selected={saved}
            onPress={() => {
              setSaved(true);
              setLimit(12);
            }}
          />
        </Row>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          {routes.map(({ ride, points, stats }) => (
            <Card
              key={ride.id}
              style={{ flexGrow: 1, flexShrink: 1, flexBasis: 320 * fontScale }}
            >
              <View style={{ height: 180, backgroundColor: c.map }}>
                <RouteShape points={points} grid />
              </View>
              <View style={{ padding: 20, gap: 16 }}>
                <Row style={{ alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="heading">{ride.name}</Txt>
                    <Txt variant="small" color={c.muted}>
                      {new Date(ride.startedAt).toLocaleDateString("en", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Txt>
                  </View>
                  <IconButton
                    icon={ride.isFavorite ? "bookmark" : "bookmark-outline"}
                    active={ride.isFavorite}
                    label={`${ride.isFavorite ? "Unfavourite" : "Favourite"} ${ride.name}`}
                    disabled={busy}
                    onPress={() =>
                      void updateRide({
                        ...ride,
                        isFavorite: !ride.isFavorite,
                      }).catch((e) => notify(e.message))
                    }
                  />
                </Row>
                <Txt color={c.muted}>
                  {formatDistance(stats.distanceKm, prefs.units)} {prefs.units}{" "}
                  · Recorded by you
                </Txt>
                <Button
                  title="View ride & route"
                  kind="secondary"
                  icon="arrow-forward"
                  onPress={() => router.push(`/ride/${ride.id}`)}
                />
              </View>
            </Card>
          ))}
        </View>
        {matching.length > limit && (
          <Button
            title="Show more roads"
            kind="secondary"
            onPress={() => setLimit((value) => value + 12)}
          />
        )}
        {!routes.length && (
          <Empty
            icon="compass-outline"
            title={
              search
                ? "No matching rides"
                : saved
                  ? "Your favourite roads, here"
                  : "Your first road awaits"
            }
            body={
              search
                ? "Try another ride name."
                : saved
                  ? "Bookmark one of your recorded rides to find it here."
                  : "Record a ride to see its route here. Your collection starts with the roads you actually ride."
            }
            action={search || saved ? "Show all my roads" : "Record a ride"}
            onPress={() => {
              if (search || saved) {
                setSearch("");
                setSaved(false);
              } else router.navigate("/record");
            }}
          />
        )}
      </Page>
    </ScrollView>
  );
}
