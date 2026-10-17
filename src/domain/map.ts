import type { FeatureCollection, LineString, Point } from "geojson";
import { buildSpeedSegments } from "./display";
import type { RidePoint } from "./ride";
import { colors } from "../theme";

/** Bounded route geometry that never bridges a pause or missing GPS section. */
export function routeFeatures(
  points: readonly RidePoint[],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: buildSpeedSegments(points)
      .filter((group) => group.points.length > 1)
      .map((group) => ({
        type: "Feature",
        properties: { color: group.color },
        geometry: {
          type: "LineString",
          coordinates: group.points.map((p) => [p.longitude, p.latitude]),
        },
      })),
  };
}

export function endpointFeatures(
  points: readonly RidePoint[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.length
      ? [points[0], points.at(-1)!].map((point, index) => ({
          type: "Feature",
          properties: { color: index ? colors.text : colors.green },
          geometry: {
            type: "Point",
            coordinates: [point.longitude, point.latitude],
          },
        }))
      : [],
  };
}

export function routeBounds(
  points: readonly RidePoint[],
): [number, number, number, number] | undefined {
  if (!points.length) return undefined;
  const origin = points[0].longitude;
  let west = origin,
    east = origin,
    south = points[0].latitude,
    north = south;
  for (const point of points) {
    const longitude = origin + ((point.longitude - origin + 540) % 360) - 180;
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, point.latitude);
    north = Math.max(north, point.latitude);
  }
  return [west - 0.001, south - 0.001, east + 0.001, north + 0.001];
}
