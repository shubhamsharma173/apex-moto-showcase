import assert from "node:assert/strict";
import test from "node:test";
import {
  routeFeatures,
  endpointFeatures,
  routeBounds,
} from "../../src/domain/map";
import { point } from "./fixtures";

test("native map handles empty and single-fix recordings without invalid lines", () => {
  assert.deepEqual(routeFeatures([]).features, []);
  assert.deepEqual(endpointFeatures([]).features, []);
  assert.equal(routeBounds([]), undefined);
  assert.deepEqual(routeFeatures([point(0, 0)]).features, []);
  assert.deepEqual(routeBounds([point(0, 0)]), [-0.001, -0.001, 0.001, 0.001]);
});

test("native GeoJSON preserves pauses and long GPS gaps", () => {
  const points = [
    point(0, 0),
    point(100, 10),
    point(500, 20, { segment: 1 }),
    point(600, 30, { segment: 1 }),
    point(1000, 90, { segment: 1 }),
    point(1100, 100, { segment: 1 }),
  ];
  const lines = routeFeatures(points).features;
  assert.equal(lines.length, 3);
  assert.deepEqual(
    lines.map((line) => line.geometry.coordinates),
    [
      [points[0], points[1]],
      [points[2], points[3]],
      [points[4], points[5]],
    ].map((pair) => pair.map((p) => [p.longitude, p.latitude])),
  );
  const ends = endpointFeatures(points).features;
  assert.deepEqual(
    ends.map((end) => end.geometry.coordinates),
    [points[0], points[5]].map((p) => [p.longitude, p.latitude]),
  );
});

test("native map bounds keep a dateline crossing local rather than fitting the whole planet", () => {
  for (const longitudes of [
    [179.9, -179.9],
    [-179.9, 179.9],
  ]) {
    const bounds = routeBounds(
      longitudes.map((longitude, i) => point(0, i, { longitude })),
    )!;
    assert.ok(Math.abs(bounds[2] - bounds[0] - 0.202) < 0.000001);
  }
});

test("native route geometry stays within the 600 vertex budget on long rides", () => {
  const points = Array.from({ length: 10_000 }, (_, i) =>
    point(i * 10, i, { speed: i % 2 ? 20 : 5 }),
  );
  const data = routeFeatures(points);
  assert.ok(
    data.features.reduce(
      (count, line) => count + line.geometry.coordinates.length,
      0,
    ) <= 600,
  );
});
