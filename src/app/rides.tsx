import React, { useMemo, useState } from "react";
import { View, FlatList, TextInput, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { PageHeading } from "../components/Shell";
import { Txt, Icon, Row, Button, Chip, Empty } from "../components/ui";
import { RideRow } from "../components/RideRow";
import { useApp } from "../state/AppContext";
import { colors as c, fonts as f } from "../theme";
export default function Rides() {
  const { width } = useWindowDimensions(),
    { rides, prefs } = useApp(),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("All rides");
  const hasFilters = !!q.trim() || filter === "Favourites";
  const list = useMemo(
    () =>
      rides.filter(
        (r) =>
          (filter !== "Favourites" || r.isFavorite) &&
          r.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [q, filter, rides],
  );
  return (
    <>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        contentContainerStyle={{
          padding: width >= 1000 ? 32 : 20,
          paddingBottom: 36,
          maxWidth: 1500,
          width: "100%",
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View style={{ gap: 24, marginBottom: 24 }}>
            <PageHeading
              eyebrow="YOUR MILES, YOUR MEMORIES"
              title="The ride log."
              subtitle={
                rides.length
                  ? `${rides.length} ${rides.length === 1 ? "ride" : "rides"}. Every one, yours.`
                  : "A home for the roads you’ve travelled."
              }
              action={
                <Button
                  title="Record a ride"
                  icon="radio-button-on-outline"
                  kind="secondary"
                  onPress={() => router.navigate("/record")}
                />
              }
            />
            {!!rides.length && (
              <>
                <Row
                  style={{
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor: c.line,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                  }}
                >
                  <Icon name="search-outline" />
                  <TextInput
                    accessibilityLabel="Search your rides"
                    value={q}
                    onChangeText={setQ}
                    placeholder="Find a ride in your logbook…"
                    placeholderTextColor={c.faint}
                    style={{
                      flex: 1,
                      minHeight: 54,
                      fontSize: 14,
                      fontFamily: f.regular,
                      color: c.text,
                    }}
                  />
                </Row>
                <Row>
                  {["All rides", "Favourites"].map((t) => (
                    <Chip
                      label={t}
                      selected={filter === t}
                      key={t}
                      onPress={() => setFilter(t)}
                    />
                  ))}
                </Row>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: c.surface }}>
            <RideRow ride={item} units={prefs.units} />
          </View>
        )}
        ListEmptyComponent={
          <Empty
            icon="trail-sign-outline"
            title={
              hasFilters ? "No rides here yet" : "A blank page. An open road."
            }
            body={
              hasFilters
                ? "Try another name, or show all your rides. You can favourite a ride from its detail page."
                : "Record your first ride. Your route, notes and replay will be waiting here when you return."
            }
            action={hasFilters ? "Show all rides" : "Start a ride"}
            onPress={() => {
              if (hasFilters) {
                setQ("");
                setFilter("All rides");
              } else router.navigate("/record");
            }}
          />
        }
        ListFooterComponent={
          <Txt
            variant="small"
            color={c.faint}
            style={{ textAlign: "center", marginTop: 24 }}
          >
            Your full-resolution routes are stored on this device.
          </Txt>
        }
      />
    </>
  );
}
