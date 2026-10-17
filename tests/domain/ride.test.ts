import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceMeters, filterRidePoints, removePrivateZones, summarizeRide, thinPoints, trimRideForPrivacy } from '../../src/domain/ride';
import { point, ride } from './fixtures';

test('known one kilometre track has accurate distance, speed, elapsed time and lean remains unavailable', () => {
  const points = Array.from({ length: 21 }, (_, i) => point(i * 50, i * 5));
  const result = summarizeRide(ride(points));
  assert.ok(Math.abs(result.distanceKm - 1) < 0.001);
  assert.equal(result.movingSeconds, 100);
  assert.equal(result.durationSeconds, 100);
  assert.ok(Math.abs(result.averageSpeedKmh - 36) < 0.01);
  assert.equal(result.stoppedSeconds, 0);
  assert.equal(result.maxLeanLeft, null);
  assert.equal(result.maxLeanRight, null);
  assert.equal(result.smoothness, 100);
});

test('bad accuracy, malformed fixes, out-of-order fixes and teleports do not contaminate distance', () => {
  const points = [point(0, 0), point(10, 1), point(15, 1), point(10_000, 2), point(20, 2),
    point(25, 2.5, { accuracy: 100 }), point(30, 3), point(35, 3.5, { latitude: NaN }),
    point(36, 3.6, { altitude: Infinity }), point(37, 3.7, { speed: -1 }), point(40, 4)];
  assert.deepEqual(filterRidePoints(points).map(p => Math.round(p.longitude * 111_195.08)), [0, 10, 20, 30, 40]);
  assert.ok(Math.abs(summarizeRide(ride(points)).distanceKm - 0.04) < 0.001);
});

test('pause segments and telemetry gaps never add a straight bridge or movement time', () => {
  const points = [point(0, 0), point(100, 10), point(10_000, 20, { segment: 1 }), point(10_100, 30, { segment: 1 }), point(20_000, 90, { segment: 1 }), point(20_100, 100, { segment: 1 })];
  const filtered = filterRidePoints(points);
  assert.deepEqual(filtered.map(p => p.segment), [0, 0, 1, 1, 2, 2]);
  const summary = summarizeRide(ride(points));
  assert.ok(Math.abs(summary.distanceKm - 0.3) < 0.001);
  assert.equal(summary.movingSeconds, 30);
  assert.equal(summary.stoppedSeconds, 70);
});

test('stationary GPS drift does not create a ride or false elevation gain', () => {
  const points = Array.from({ length: 15 }, (_, i) => point(i % 2 === 0 ? 0 : 2, i, { speed: 0, accuracy: 8, altitude: 100 + (i % 2) }));
  const summary = summarizeRide(ride(points));
  assert.equal(summary.distanceKm, 0);
  assert.equal(summary.movingSeconds, 0);
  assert.equal(summary.elevationGainM, 0);
});

test('elevation deadband rejects noise and signed calibrated lean is kept', () => {
  const summary = summarizeRide(ride([point(0, 0, { altitude: 100, lean: -20 }), point(50, 5, { altitude: 101 }), point(100, 10, { altitude: 104, lean: 31 }), point(150, 15, { altitude: 103 }), point(200, 20, { altitude: 108 })]));
  assert.equal(summary.elevationGainM, 8);
  assert.equal(summary.maxLeanLeft, 20);
  assert.equal(summary.maxLeanRight, 31);
  assert.equal(summary.smoothness, null);
});

test('empty and single-point rides have finite zero metrics', () => {
  assert.equal(summarizeRide(ride([])).distanceKm, 0);
  assert.equal(summarizeRide(ride([point(0, 0)])).averageSpeedKmh, 0);
});

test('haversine takes the short edge across the international date line', () => {
  const result = distanceMeters({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 });
  assert.ok(result > 220 && result < 225);
});

test('privacy trims conservatively at both ends without mutating original or connecting private zones', () => {
  const original = ride(Array.from({ length: 21 }, (_, i) => point(i * 100, i * 10)));
  const trimmed = trimRideForPrivacy(original);
  assert.ok(distanceMeters(original.points[0], trimmed.points[0]) >= 300);
  assert.ok(distanceMeters(original.points[20], trimmed.points[trimmed.points.length - 1]) >= 300);
  assert.equal(original.points.length, 21);
  assert.equal(trimRideForPrivacy(ride(original.points.slice(0, 5))).points.length, 0);
  const zone = { latitude: 0, longitude: 1_000 / 111_195.08, radiusM: 120 };
  const hidden = removePrivateZones(original.points, [zone]);
  assert.ok(hidden.every(p => distanceMeters(p, zone) > 120));
  const before = hidden.find(p => Math.abs(p.longitude * 111_195.08 - 800) < 1)!;
  const after = hidden.find(p => Math.abs(p.longitude * 111_195.08 - 1200) < 1)!;
  assert.notEqual(before.segment, after.segment);
});

test('privacy breaks an edge passing through a zone even when both fixes are outside', () => {
  const hidden = removePrivateZones([point(0, 0), point(400, 10)], [{ latitude: 0, longitude: 200 / 111_195.08, radiusM: 50 }]);
  assert.equal(hidden.length, 2);
  assert.notEqual(hidden[0].segment, hidden[1].segment);
  assert.throws(() => trimRideForPrivacy(ride([]), -1), /non-negative/);
});

test('a continuous ninety-degree bend counts once', () => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 18;
    return point(0, i * 5, { latitude: (Math.sin(angle) * 150) / 111_195.08, longitude: (Math.cos(angle) * 150) / 111_195.08 });
  });
  assert.equal(summarizeRide(ride(points)).corners, 1);
});

test('map sampler respects its budget, preserves both endpoints and every segment break', () => {
  const points = Array.from({ length: 1_000 }, (_, i) => point(i * 10, i, { segment: Math.floor(i / 250) }));
  const sampled = thinPoints(points, 120);
  assert.equal(sampled.length, 120);
  assert.equal(sampled[0].timestamp, points[0].timestamp);
  assert.equal(sampled[sampled.length - 1].timestamp, points[999].timestamp);
  for (const index of [249, 250, 499, 500, 749, 750]) assert.ok(sampled.some(p => p.timestamp === points[index].timestamp));
  assert.deepEqual([...new Set(sampled.map(p => p.segment))], [0, 1, 2, 3]);
  assert.equal(points[999].segment, 3);
});

test('map sampler remains bounded even with more segments than its budget can preserve', () => {
  const points = Array.from({ length: 20 }, (_, i) => point(i * 10, i, { segment: Math.floor(i / 2) }));
  const sampled = thinPoints(points, 5);
  assert.ok(sampled.length <= 5);
  assert.equal(sampled[0].timestamp, points[0].timestamp);
  assert.equal(sampled[sampled.length - 1].timestamp, points[19].timestamp);
  for (let i = 1; i < sampled.length; i += 1) {
    if (sampled[i].timestamp - sampled[i - 1].timestamp > 1_000) assert.notEqual(sampled[i].segment, sampled[i - 1].segment);
  }
  assert.deepEqual(thinPoints([], 2), []);
  assert.throws(() => thinPoints(points, 1), /at least two/);
});

test('map sampler preserves a prominent bend in a dense trace', () => {
  const points = Array.from({ length: 101 }, (_, i) => point(i * 10, i, { latitude: i === 50 ? 0.0001 : 0 }));
  assert.ok(thinPoints(points, 10).some(p => p.latitude === 0.0001));
});
