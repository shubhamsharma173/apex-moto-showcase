import React, { useMemo, useState, useEffect, useRef, memo } from "react";
import { View, StyleSheet } from "react-native";
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { routeFeatures, endpointFeatures, routeBounds } from "../domain/map";
import type { RouteMapProps } from "./RouteMap.types";
import { RouteShape } from "./RouteShape";
import { Button, Txt, IconButton } from "./ui";
import { colors as c } from "../theme";

const padding = { top: 48, left: 40, bottom: 48, right: 40 };

function NativeRouteMap({
  points,
  markerIndex,
  interactive = false,
  tilted = false,
  height = 300,
}: RouteMapProps) {
  const camera = useRef<CameraRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const data = useMemo(() => routeFeatures(points), [points]);
  const ends = useMemo(() => endpointFeatures(points), [points]);
  const bounds = useMemo(() => routeBounds(points), [points]);
  const current = points[markerIndex ?? -1];
  const marker = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: current
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "Point" as const,
                coordinates: [current.longitude, current.latitude],
              },
            },
          ]
        : [],
    }),
    [current],
  );
  useEffect(() => {
    if (loaded && bounds)
      camera.current?.fitBounds(bounds, {
        padding,
        duration: 0,
      });
  }, [bounds, loaded]);
  useEffect(() => {
    if (loaded)
      void camera.current
        ?.setStop({ pitch: tilted ? 48 : 0, duration: 0 })
        .catch(() => undefined);
  }, [loaded, tilted]);
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setFailed(true), 15000);
    return () => clearTimeout(timer);
  }, [loaded, attempt]);
  return (
    <View style={{ height, backgroundColor: c.map, overflow: "hidden" }}>
      <Map
        key={attempt}
        style={StyleSheet.absoluteFill}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        androidView="texture"
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        touchRotate={interactive}
        touchPitch={interactive}
        attribution
        compass={interactive}
        logo={false}
        attributionPosition={{ bottom: 8, left: 8 }}
        compassPosition={{ top: 12, right: 12 }}
        onDidFinishLoadingMap={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onDidFailLoadingMap={() => setFailed(true)}
      >
        <Camera
          ref={camera}
          initialViewState={
            bounds
              ? { bounds, padding, pitch: tilted ? 48 : 0 }
              : { center: [78, 22], zoom: 4 }
          }
          maxZoom={18}
        />
        <GeoJSONSource id="ride-route" data={data}>
          <Layer
            id="ride-halo"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": c.bg, "line-width": 8, "line-opacity": 0.7 }}
          />
          <Layer
            id="ride-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": ["get", "color"], "line-width": 4 }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="ride-ends" data={ends}>
          <Layer
            id="ride-endpoints"
            type="circle"
            paint={{
              "circle-radius": 5,
              "circle-color": ["get", "color"],
              "circle-stroke-color": c.bg,
              "circle-stroke-width": 2,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="ride-position" data={marker}>
          <Layer
            id="ride-position-dot"
            type="circle"
            paint={{
              "circle-radius": 8,
              "circle-color": c.lime,
              "circle-stroke-color": c.ink,
              "circle-stroke-width": 3,
            }}
          />
        </GeoJSONSource>
      </Map>
      {interactive && loaded && bounds && (
        <View style={{ position: "absolute", top: 56, right: 12 }}>
          <IconButton
            icon="scan-outline"
            label="Fit entire route"
            onPress={() =>
              camera.current?.fitBounds(bounds, {
                padding,
                duration: 0,
                pitch: tilted ? 48 : 0,
              })
            }
          />
        </View>
      )}
      {(!loaded || failed) && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.map }]}
          pointerEvents={failed ? "auto" : "none"}
        >
          <RouteShape points={points} markerIndex={markerIndex} grid />
          <View
            style={{
              position: "absolute",
              bottom: 10,
              left: 12,
              right: 12,
              alignItems: "center",
              gap: 8,
            }}
          >
            <Txt variant="small" color={c.muted}>
              {failed
                ? "Map unavailable · route outline shown"
                : "Loading map…"}
            </Txt>
            {failed && (
              <Button
                title="Retry map"
                small
                kind="secondary"
                onPress={() => {
                  setLoaded(false);
                  setFailed(false);
                  setAttempt((value) => value + 1);
                }}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default memo(NativeRouteMap);
