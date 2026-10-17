import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSpeedSegments, sampleTelemetry, SPEED_COLORS, speedColor } from '../../src/domain/display';
import { point } from './fixtures';

test('speed ranges have inclusive boundaries and unknown speed stays gray', () => {
  assert.equal(speedColor(null), SPEED_COLORS.unknown);
  assert.equal(speedColor(NaN), SPEED_COLORS.unknown);
  assert.equal(speedColor(-1), SPEED_COLORS.unknown);
  assert.equal(speedColor(0), SPEED_COLORS.under30);
  assert.equal(speedColor(30 / 3.6 - 0.001), SPEED_COLORS.under30);
  assert.equal(speedColor(30 / 3.6), SPEED_COLORS.from30To60);
  assert.equal(speedColor(60 / 3.6 - 0.001), SPEED_COLORS.from30To60);
  assert.equal(speedColor(60 / 3.6), SPEED_COLORS.from60);
});

test('equal adjacent speed bins share a path and color boundaries share a fix', () => {
  const points = [point(0, 0, { speed: 3 }), point(10, 1, { speed: 3 }), point(20, 2, { speed: 5 }), point(30, 3, { speed: 12 }), point(40, 4, { speed: 20 }), point(50, 5, { speed: null })];
  const groups = buildSpeedSegments(points);
  assert.deepEqual(groups.map(group => group.color), [SPEED_COLORS.under30, SPEED_COLORS.from30To60, SPEED_COLORS.from60, SPEED_COLORS.unknown]);
  assert.deepEqual(groups.map(group => group.points.length), [3, 2, 2, 2]);
  for (let index = 1; index < groups.length; index += 1) assert.equal(groups[index - 1].points.at(-1)?.timestamp, groups[index].points[0].timestamp);
  assert.equal(groups[0].points[0].timestamp, points[0].timestamp);
  assert.equal(groups.at(-1)?.points.at(-1)?.timestamp, points.at(-1)?.timestamp);
});

test('same-colored paths never bridge explicit pause segments or long missing-fix gaps', () => {
  const points = [point(0, 0), point(100, 10), point(500, 20, { segment: 1 }), point(600, 30, { segment: 1 }), point(1000, 90, { segment: 1 }), point(1100, 100, { segment: 1 })];
  const groups = buildSpeedSegments(points);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map(group => group.points.length), [2, 2, 2]);
  assert.deepEqual(groups.map(group => group.points[0].segment), [0, 1, 2]);
});

test('alternating speed colors cannot exceed the combined vertex budget', () => {
  const points = Array.from({ length: 10_000 }, (_, i) => point(i * 10, i, { speed: i % 2 ? 20 : 5 }));
  for (const budget of [2, 3, 17, 60, 600]) {
    const groups = buildSpeedSegments(points, budget);
    const cost = groups.reduce((total, group) => total + group.points.length, 0);
    assert.ok(cost <= budget, `${cost} vertices exceed budget ${budget}`);
    assert.equal(groups[0].points[0].timestamp, points[0].timestamp);
    assert.equal(groups.at(-1)?.points.at(-1)?.timestamp, points.at(-1)?.timestamp);
    assert.ok(groups.every(group => group.points.every(p => p.segment === group.points[0].segment)));
  }
  assert.equal(points[0].segment, undefined);
});

test('many disconnected and singleton segments remain bounded without fabricated links', () => {
  const points = Array.from({ length: 101 }, (_, i) => point(i * 10, i, { segment: i }));
  const groups = buildSpeedSegments(points, 20);
  assert.ok(groups.reduce((total, group) => total + group.points.length, 0) <= 20);
  assert.ok(groups.every(group => group.points.length === 1));
  assert.equal(groups[0].points[0].timestamp, points[0].timestamp);
  assert.equal(groups.at(-1)?.points[0].timestamp, points.at(-1)?.timestamp);
  assert.deepEqual(buildSpeedSegments([]), []);
  assert.throws(() => buildSpeedSegments(points, 1), /at least two/);
});

test('telemetry x follows elapsed time and values use km/h, metres and signed degrees', () => {
  const points = [point(0, 0, { speed: 5, altitude: 100, lean: -20 }), point(100, 10, { speed: 10, altitude: 105, lean: null }), point(400, 40, { speed: 15, altitude: null, lean: 30 })];
  assert.deepEqual(sampleTelemetry(points, 'speed'), [{ x: 0, y: 18 }, { x: 0.25, y: 36 }, { x: 1, y: 54 }]);
  assert.deepEqual(sampleTelemetry(points, 'elevation').map(sample => sample.y), [100, 105, null]);
  assert.deepEqual(sampleTelemetry(points, 'lean').map(sample => sample.y), [-20, null, 30]);
});

test('telemetry inserts a null break across explicit segments and telemetry outages', () => {
  const points = [point(0, 0), point(100, 10), point(200, 20, { segment: 1 }), point(300, 30, { segment: 1 }), point(600, 100, { segment: 1 })];
  const samples = sampleTelemetry(points, 'speed');
  assert.deepEqual(samples.filter(sample => sample.y === null).map(sample => sample.x), [0.15, 0.65]);
  assert.equal(samples[0].x, 0);
  assert.equal(samples.at(-1)?.x, 1);
});

test('downsampled telemetry stays bounded and never draws through a missing-value interval', () => {
  const points = Array.from({ length: 1_000 }, (_, i) => point(i * 10, i, { altitude: i >= 400 && i <= 450 ? null : 100 + i }));
  for (const budget of [2, 3, 17, 160]) {
    const samples = sampleTelemetry(points, 'elevation', budget);
    assert.ok(samples.length <= budget);
    assert.equal(samples[0].x, 0);
    assert.equal(samples.at(-1)?.x, 1);
    assert.ok(samples.some(sample => sample.y == null));
    for (let i = 1; i < samples.length; i += 1) {
      const previous = samples[i - 1];
      const current = samples[i];
      if (previous.y != null && current.y != null) assert.ok(!(previous.x < 400 / 999 && current.x > 450 / 999));
    }
  }
});

test('many missing intervals cannot exceed the chart budget or silently become continuous', () => {
  const points = Array.from({ length: 200 }, (_, i) => point(i * 10, i, { lean: i % 2 ? null : 10 }));
  const samples = sampleTelemetry(points, 'lean', 30);
  assert.ok(samples.length <= 30);
  for (let i = 1; i < samples.length; i += 1) assert.ok(samples[i].y == null || samples[i - 1].y == null);
  assert.deepEqual(sampleTelemetry([], 'speed'), []);
  assert.deepEqual(sampleTelemetry([point(0, 0, { speed: null })], 'speed'), [{ x: 0, y: null }]);
  assert.throws(() => sampleTelemetry(points, 'speed', 1), /at least two/);
});
