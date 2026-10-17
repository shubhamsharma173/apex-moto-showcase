import React, { useMemo } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ride, summarizeRide } from "../domain/ride";
import { RouteShape } from "./RouteShape";
import { Txt, Icon, Row } from "./ui";
import {
  colors as c,
  fonts as f,
  formatDistance,
  formatDuration,
  Units,
} from "../theme";
export function RideRow({ ride, units }: { ride: Ride; units: Units }) {
  const summary = useMemo(() => summarizeRide(ride), [ride]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ride ${ride.name}`}
      onPress={() => router.push(`/ride/${ride.id}`)}
      style={({ pressed }) => ({
        paddingVertical: 16,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderBottomWidth: 1,
        borderColor: c.line,
        backgroundColor: pressed ? c.raised : "transparent",
      })}
    >
      <View
        style={{
          width: 76,
          height: 66,
          backgroundColor: c.bg,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <RouteShape points={ride.points} width={150} height={110} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Txt numberOfLines={1} style={{ fontFamily: f.medium, fontSize: 14 }}>
          {ride.name}
        </Txt>
        <Row style={{ flexWrap: "wrap", gap: 6 }}>
          <Txt variant="small" color={c.muted}>
            {new Date(ride.startedAt).toLocaleDateString("en", {
              month: "short",
              day: "numeric",
            })}
          </Txt>
          <Txt variant="small" color={c.faint}>
            ·
          </Txt>
          <Txt variant="small" color={c.muted}>
            {formatDistance(summary.distanceKm, units)} {units}
          </Txt>
          <Txt variant="small" color={c.faint}>
            ·
          </Txt>
          <Txt variant="small" color={c.muted}>
            {formatDuration(summary.movingSeconds)}
          </Txt>
        </Row>
      </View>
      {ride.isFavorite && <Icon name="bookmark" size={15} color={c.lime} />}
      <Icon name="chevron-forward" size={16} />
    </Pressable>
  );
}
