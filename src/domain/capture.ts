import {
  distanceMeters,
  isValidRidePoint,
  MAX_FIX_GAP_MS,
  RidePoint,
} from "./ride";

export type CapturePhase =
  "disabled" | "armed" | "candidate" | "recording" | "parked";

export interface CaptureState {
  phase: CapturePhase;
  points: RidePoint[];
  preRoll: RidePoint[];
  candidateStartedAt: number | null;
  startedAt: number | null;
  parkedAt: number | null;
  lastPoint: RidePoint | null;
  segment: number;
}

export interface CaptureConfig {
  startSpeedKmh?: number;
  startDurationMs?: number;
  parkSpeedKmh?: number;
  parkDurationMs?: number;
  minimumDistanceM?: number;
  maxGapMs?: number;
  preRollMs?: number;
  maxPreRollPoints?: number;
  maxRecordingPoints?: number;
}

export type CaptureEvent =
  | { type: "started" }
  | {
      type: "finished";
      points: RidePoint[];
      startedAt: number;
      endedAt: number;
      reason: "parked" | "capacity";
    }
  | { type: "discarded"; distanceKm: number; reason: "parked" | "capacity" };

export interface CaptureResult {
  state: CaptureState;
  event: CaptureEvent | null;
}

export function createCaptureState(enabled = false): CaptureState {
  return {
    phase: enabled ? "armed" : "disabled",
    points: [],
    preRoll: [],
    candidateStartedAt: null,
    startedAt: null,
    parkedAt: null,
    lastPoint: null,
    segment: 0,
  };
}

/** Disabling cancels the in-progress candidate/ride; the caller owns explicit manual saving. */
export function setCaptureEnabled(
  _state: CaptureState,
  enabled: boolean,
): CaptureState {
  return createCaptureState(enabled);
}

function travelled(points: readonly RidePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].segment === points[i - 1].segment)
      total += distanceMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Pure reducer: feed ordered fixes in epoch milliseconds; persist returned state between deliveries. */
export function advanceCapture(
  state: CaptureState,
  input: RidePoint,
  config: CaptureConfig = {},
): CaptureResult {
  const c = {
    startSpeedKmh: 15,
    startDurationMs: 15_000,
    parkSpeedKmh: 3,
    parkDurationMs: 180_000,
    minimumDistanceM: 500,
    maxGapMs: MAX_FIX_GAP_MS,
    preRollMs: 10_000,
    maxPreRollPoints: 30,
    maxRecordingPoints: 50_000,
    ...config,
  };
  if (
    Object.values(c).some((value) => !Number.isFinite(value) || value <= 0) ||
    !Number.isInteger(c.maxPreRollPoints) ||
    !Number.isInteger(c.maxRecordingPoints) ||
    c.parkSpeedKmh >= c.startSpeedKmh
  )
    throw new Error("Invalid automatic capture configuration.");
  if (
    state.phase === "disabled" ||
    !isValidRidePoint(input) ||
    (input.accuracy != null && input.accuracy > 50) ||
    (input.speed != null && input.speed * 3.6 > 250)
  )
    return { state, event: null };
  const elapsed = state.lastPoint
    ? input.timestamp - state.lastPoint.timestamp
    : 0;
  if (state.lastPoint && elapsed <= 0) return { state, event: null };
  const longGap = state.lastPoint != null && elapsed > c.maxGapMs;
  const derivedSpeedKmh =
    state.lastPoint && !longGap
      ? (distanceMeters(state.lastPoint, input) / elapsed) * 3_600
      : null;
  if (derivedSpeedKmh != null && derivedSpeedKmh > 250)
    return { state, event: null };
  const speedKmh = input.speed == null ? derivedSpeedKmh : input.speed * 3.6;
  const segment = state.segment + (longGap ? 1 : 0);
  const point = { ...input, segment };
  let next: CaptureState = {
    ...state,
    segment,
    lastPoint: point,
    preRoll: [...(longGap ? [] : state.preRoll), point]
      .filter((item) => point.timestamp - item.timestamp <= c.preRollMs)
      .slice(-c.maxPreRollPoints),
  };
  if (longGap && next.phase === "candidate") {
    next = {
      ...next,
      phase: "armed",
      points: [],
      candidateStartedAt: null,
      startedAt: null,
    };
  }
  if (longGap && next.phase === "parked")
    next = { ...next, phase: "recording", parkedAt: null };

  if (next.phase === "armed") {
    if (speedKmh != null && speedKmh >= c.startSpeedKmh) {
      next = {
        ...next,
        phase: "candidate",
        points: [...next.preRoll],
        candidateStartedAt: point.timestamp,
        startedAt: next.preRoll[0].timestamp,
      };
    }
    return { state: next, event: null };
  }
  if (next.phase === "candidate") {
    if (speedKmh == null || speedKmh < c.startSpeedKmh) {
      return {
        state: {
          ...next,
          phase: "armed",
          points: [],
          candidateStartedAt: null,
          startedAt: null,
        },
        event: null,
      };
    }
    next = { ...next, points: [...next.points, point] };
    if (
      point.timestamp - (next.candidateStartedAt ?? point.timestamp) >=
      c.startDurationMs
    ) {
      return {
        state: { ...next, phase: "recording", candidateStartedAt: null },
        event: { type: "started" },
      };
    }
    // Dense sensor streams cannot grow an unconfirmed candidate without a bound.
    if (next.points.length > c.maxRecordingPoints)
      next = {
        ...next,
        points: next.points.slice(-c.maxRecordingPoints),
        startedAt:
          next.points[next.points.length - c.maxRecordingPoints].timestamp,
      };
    return { state: next, event: null };
  }

  next = { ...next, points: [...next.points, point] };
  if (speedKmh != null && speedKmh <= c.parkSpeedKmh) {
    if (next.phase !== "parked")
      next = { ...next, phase: "parked", parkedAt: point.timestamp };
  } else {
    next = { ...next, phase: "recording", parkedAt: null };
  }
  const parkedLongEnough =
    next.phase === "parked" &&
    next.parkedAt != null &&
    point.timestamp - next.parkedAt >= c.parkDurationMs;
  const atCapacity = next.points.length >= c.maxRecordingPoints;
  if (!parkedLongEnough && !atCapacity) return { state: next, event: null };
  const reason = parkedLongEnough ? "parked" : "capacity";
  const endedAt = parkedLongEnough ? next.parkedAt! : point.timestamp;
  // Keep the arrival fix, without counting the three-minute parking confirmation as riding.
  const points = next.points.filter((item) => item.timestamp <= endedAt);
  const distance = travelled(points);
  const reset: CaptureState = {
    ...createCaptureState(true),
    lastPoint: point,
    segment,
    preRoll: [point],
  };
  const event: CaptureEvent =
    distance < c.minimumDistanceM
      ? { type: "discarded", distanceKm: distance / 1_000, reason }
      : {
          type: "finished",
          points,
          startedAt: points[0]?.timestamp ?? endedAt,
          endedAt,
          reason,
        };
  return { state: reset, event };
}
