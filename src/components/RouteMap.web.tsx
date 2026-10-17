import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import * as maplibregl from "maplibre-gl";
import { Map as GLMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RouteMapProps } from "./RouteMap.types";
import { RouteShape } from "./RouteShape";
import { Txt } from "./ui";
import { colors as c } from "../theme";
import { RidePoint } from "../domain/ride";
import { buildSpeedSegments } from "../domain/display";
import "../map.css";

maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

function lines(points: RidePoint[]) {
  const groups = buildSpeedSegments(points);
  return {
    type: "FeatureCollection" as const,
    features: groups
      .filter((g) => g.points.length > 1)
      .map((group) => ({
        type: "Feature" as const,
        properties: { color: group.color },
        geometry: {
          type: "LineString" as const,
          coordinates: group.points.map((p) => [p.longitude, p.latitude]),
        },
      })),
  };
}
function bounds(points: RidePoint[]) {
  const b = new maplibregl.LngLatBounds();
  points.forEach((p) => b.extend([p.longitude, p.latitude]));
  return b;
}
export default function RouteMap({
  points,
  markerIndex,
  interactive = false,
  tilted = false,
  height = 300,
}: RouteMapProps) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    latest = useRef(points),
    marker = useRef<maplibregl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    latest.current = points;
  }, [points]);
  useEffect(() => {
    if (!container.current) return;
    let resize: ResizeObserver | undefined;
    try {
      const m = new maplibregl.Map({
        container: container.current,
        center: points.length
          ? [points[0].longitude, points[0].latitude]
          : [73.65, 18.46],
        zoom: 10,
        pitch: tilted ? 48 : 0,
        interactive,
        attributionControl: { compact: true },
        renderWorldCopies: false,
        canvasContextAttributes: { antialias: true },
        style: "https://tiles.openfreemap.org/styles/liberty",
      });
      map.current = m;
      m.on("load", () => {
        m.addSource("route", {
          type: "geojson",
          data: lines(latest.current),
          lineMetrics: true,
        });
        m.addLayer({
          id: "route-halo",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-width": 12,
            "line-color": c.lime,
            "line-opacity": 0.13,
            "line-blur": 4,
          },
        });
        m.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-width": 3.5, "line-color": ["get", "color"] },
        });
        m.addSource("ends", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: latest.current.length
              ? [latest.current[0], latest.current.at(-1)!].map((p, i) => ({
                  type: "Feature",
                  properties: { color: i ? c.text : c.green },
                  geometry: {
                    type: "Point",
                    coordinates: [p.longitude, p.latitude],
                  },
                }))
              : [],
          },
        });
        m.addLayer({
          id: "end-markers",
          type: "circle",
          source: "ends",
          paint: {
            "circle-radius": 5,
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": c.bg,
          },
        });
        if (latest.current.length > 1)
          m.fitBounds(bounds(latest.current), {
            padding: 48,
            duration: 0,
            maxZoom: 15,
          });
        setLoaded(true);
      });
      m.on("error", () => {
        if (!m.isStyleLoaded()) setFailed(true);
      });
      m.on("idle", () => setFailed(false));
      if (interactive)
        m.addControl(
          new maplibregl.NavigationControl({ showCompass: true }),
          "top-right",
        );
      resize = new ResizeObserver(() => {
        m.resize();
        if (m.isStyleLoaded() && latest.current.length > 1)
          m.fitBounds(bounds(latest.current), {
            padding: 48,
            duration: 0,
            maxZoom: 15,
          });
      });
      resize.observe(container.current);
    } catch {
      // The external WebGL API can fail synchronously; render the offline fallback.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
    }
    return () => {
      resize?.disconnect();
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
    };
    // A map is mounted once; data and camera updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    (m.getSource("route") as GeoJSONSource)?.setData(lines(points));
    if (points.length > 1)
      m.fitBounds(bounds(points), { padding: 48, duration: 0, maxZoom: 15 });
    (m.getSource("ends") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: points.length
        ? [points[0], points.at(-1)!].map((p, i) => ({
            type: "Feature",
            properties: { color: i ? c.text : c.green },
            geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
          }))
        : [],
    });
  }, [points, loaded]);
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    m.setPitch(tilted ? 48 : 0);
  }, [tilted, loaded]);
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const p = points[markerIndex ?? -1];
    if (!p) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;background:#d4f779;border:3px solid #182014;border-radius:50%;box-shadow:0 0 0 7px #d4f77930;";
      marker.current = new maplibregl.Marker({ element: el })
        .setLngLat([p.longitude, p.latitude])
        .addTo(m);
    } else marker.current.setLngLat([p.longitude, p.latitude]);
  }, [points, markerIndex, loaded]);
  return (
    <View style={{ height, backgroundColor: c.map, overflow: "hidden" }}>
      <View style={StyleSheet.absoluteFill}>
        <RouteShape points={points} markerIndex={markerIndex} grid />
      </View>
      <div
        ref={container}
        aria-label="Ride route map"
        role="img"
        style={{
          position: "absolute",
          inset: 0,
          opacity: loaded && !failed ? 1 : 0,
        }}
      />
      {(!loaded || failed) && (
        <View style={{ position: "absolute", bottom: 10, right: 12 }}>
          <Txt variant="small" color={c.muted}>
            {failed ? "Route outline · map unavailable" : "Loading map…"}
          </Txt>
        </View>
      )}
    </View>
  );
}
