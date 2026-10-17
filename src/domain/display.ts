import { filterRidePoints, RidePoint, thinPoints } from "./ride";

export const SPEED_COLORS = {
  unknown: "#7E9185",
  under30: "#73D9D2",
  from30To60: "#D4F779",
  from60: "#FFBA7A",
} as const;

export interface SpeedDisplaySegment {
  points: RidePoint[];
  color: string;
}

export type TelemetryMetric = "speed" | "elevation" | "lean";
export interface TelemetrySample {
  x: number;
  y: number | null;
}

/** Measured speed in m/s. Colors describe ranges, never riding quality. */
export function speedColor(speedMps: number | null): string {
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps < 0)
    return SPEED_COLORS.unknown;
  const kmh = speedMps * 3.6;
  return kmh < 30
    ? SPEED_COLORS.under30
    : kmh < 60
      ? SPEED_COLORS.from30To60
      : SPEED_COLORS.from60;
}

function groupSpeedEdges(points: RidePoint[]): SpeedDisplaySegment[] {
  const result: SpeedDisplaySegment[] = [];
  for (let start = 0; start < points.length;) {
    let end = start + 1;
    while (end < points.length && points[end].segment === points[start].segment)
      end += 1;
    if (end - start === 1)
      result.push({
        points: [points[start]],
        color: speedColor(points[start].speed),
      });
    for (let index = start + 1; index < end; index += 1) {
      // A retained fix describes the edge arriving there. Never infer missing speed.
      const color = speedColor(points[index].speed);
      const current = index > start + 1 ? result[result.length - 1] : undefined;
      if (current?.color === color) current.points.push(points[index]);
      else {
        result.push({ points: [points[index - 1], points[index]], color });
      }
    }
    start = end;
  }
  return result;
}

/**
 * Bounded map geometry. Includes duplicated color-boundary vertices in the budget;
 * at most maxVertices references and maxVertices / 2 multi-point paths are returned.
 * Pause segments and GPS gaps remain disconnected. When every source segment cannot
 * fit, thinPoints retains outer endpoints and larger segments without joining gaps.
 * Singleton results preserve isolated endpoints; skip them when creating LineStrings.
 * Full fixes remain the source for statistics/export and replay timing.
 */
export function buildSpeedSegments(
  points: readonly RidePoint[],
  maxVertices = 600,
): SpeedDisplaySegment[] {
  if (!Number.isSafeInteger(maxVertices) || maxVertices < 2)
    throw new Error(
      "A display vertex limit must be an integer of at least two.",
    );
  let result = groupSpeedEdges(thinPoints(points, maxVertices));
  const cost = result.reduce(
    (total, segment) => total + segment.points.length,
    0,
  );
  if (cost > maxVertices) {
    // In the worst case every edge has a different color and needs two vertices.
    // Resample the full input: re-filtering already thinned timestamps creates false gaps.
    result = groupSpeedEdges(
      thinPoints(points, Math.floor(maxVertices / 2) + 1),
    );
  }
  return result;
}

function telemetryValue(
  point: RidePoint,
  metric: TelemetryMetric,
): number | null {
  const value =
    metric === "speed"
      ? point.speed
      : metric === "elevation"
        ? point.altitude
        : point.lean;
  return value == null || !Number.isFinite(value)
    ? null
    : metric === "speed"
      ? value * 3.6
      : value;
}

/**
 * Chart samples use real elapsed-time fractions (0..1), km/h, metres or signed lean
 * degrees. A null y is a required line break, including across paused GPS segments.
 * Downsampling can drop detail, but cannot draw across an original missing interval.
 * With a two-sample budget and an interior gap, the final y becomes null because
 * retaining both values plus a gap would exceed the budget. Input is never mutated.
 */
export function sampleTelemetry(
  points: readonly RidePoint[],
  metric: TelemetryMetric,
  max = 160,
): TelemetrySample[] {
  if (!Number.isSafeInteger(max) || max < 2)
    throw new Error(
      "A telemetry sample limit must be an integer of at least two.",
    );
  const clean = filterRidePoints(points);
  if (!clean.length) return [];
  const firstTime = clean[0].timestamp;
  const duration = clean[clean.length - 1].timestamp - firstTime;
  const samples: TelemetrySample[] = [];
  for (let index = 0; index < clean.length; index += 1) {
    const point = clean[index];
    const previous = clean[index - 1];
    if (previous && point.segment !== previous.segment) {
      samples.push({
        x:
          duration > 0
            ? ((point.timestamp + previous.timestamp) / 2 - firstTime) /
              duration
            : 0,
        y: null,
      });
    }
    samples.push({
      x: duration > 0 ? (point.timestamp - firstTime) / duration : 0,
      y: telemetryValue(point, metric),
    });
  }
  if (samples.length <= max) return samples;

  // Constant-time gap checks keep sampling linear in fixes plus the output budget.
  const nextMissing: number[] = new Array(samples.length + 1);
  nextMissing[samples.length] = samples.length;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    nextMissing[index] =
      samples[index].y == null ? index : nextMissing[index + 1];
  }
  const select = (count: number): TelemetrySample[] => {
    const selected: TelemetrySample[] = [];
    let previous = -1;
    for (let sample = 0; sample < count; sample += 1) {
      const index = Math.floor((sample * (samples.length - 1)) / (count - 1));
      const missing =
        previous >= 0 ? nextMissing[previous + 1] : samples.length;
      if (
        previous >= 0 &&
        samples[previous].y != null &&
        samples[index].y != null &&
        missing < index
      )
        selected.push(samples[missing]);
      selected.push(samples[index]);
      previous = index;
    }
    return selected;
  };
  const selected = select(max);
  if (selected.length <= max) return selected;
  if (max === 2)
    return [samples[0], { ...samples[samples.length - 1], y: null }];
  return select(Math.floor((max + 1) / 2));
}
