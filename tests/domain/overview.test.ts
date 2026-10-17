import assert from "node:assert/strict";
import test from "node:test";
import { ridingOverview } from "../../src/domain/overview";
import { ride, point } from "./fixtures";

test("weekly summary uses local Monday boundaries while all-time keeps older rides", () => {
  const monday = +new Date(2026, 9, 12);
  const nextMonday = +new Date(2026, 9, 19);
  const rides = [monday - 1, monday, nextMonday - 1, nextMonday].map(
    (startedAt, i) => ride([], { id: String(i), startedAt }),
  );
  const result = ridingOverview(rides, +new Date(2026, 9, 18, 12));
  assert.equal(+result.start, monday);
  assert.equal(+result.end, nextMonday);
  assert.deepEqual(
    result.week.map((x) => x.ride.id),
    ["1", "2"],
  );
  assert.equal(result.all.length, 4);
});

test("period totals use saved rides, preserve small distances, and do not mutate them", () => {
  const current = ride([point(0, 0), point(100, 10), point(200, 20)], {
    id: "current",
  });
  const old = ride(
    Array.from({ length: 11 }, (_, i) => point(i * 100, i * 10)),
    { id: "old", startedAt: +new Date(2026, 8, 1) },
  );
  const before = JSON.stringify([current, old]);
  const result = ridingOverview([current, old], +new Date(2026, 9, 16));
  assert.equal(result.week.length, 1);
  assert.ok(result.week[0].stats.distanceKm > 0.19);
  assert.ok(result.week[0].stats.distanceKm < 0.21);
  assert.ok(result.all.reduce((n, x) => n + x.stats.distanceKm, 0) > 1.19);
  assert.equal(JSON.stringify([current, old]), before);
  assert.deepEqual(ridingOverview([], Date.now()).all, []);
});
