import React from "react";
import { View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { RouteMapProps } from "./RouteMap.types";
import { RouteShape } from "./RouteShape";
import { Txt } from "./ui";
import { colors as c } from "../theme";

export default function RouteMap(props: RouteMapProps) {
  // The standalone app includes MapLibre; Expo Go does not include this module.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return (
      <View style={{ height: props.height ?? 300, backgroundColor: c.map }}>
        <RouteShape
          points={props.points}
          markerIndex={props.markerIndex}
          grid
        />
        <Txt variant="small" color={c.muted} style={{ padding: 12 }}>
          Route outline · interactive maps in the installed app
        </Txt>
      </View>
    );
  }
  // A static import would load an unavailable native module inside Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NativeRouteMap = require("./NativeRouteMap")
    .default as React.ComponentType<RouteMapProps>;
  return <NativeRouteMap {...props} />;
}
