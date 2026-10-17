/** Positions use WGS84 degrees, timestamps are epoch milliseconds, speed is m/s. */
export interface RidePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number | null;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
  /** Signed, calibrated lean degrees: negative left; positive right. Never inferred from GPS. */
  lean?: number | null;
  /** Different segments must never be joined across a pause or missing telemetry. */
  segment?: number;
}

export interface Ride {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  points: RidePoint[];
  vehicleId: string;
  source: "gps" | "demo" | "import";
  /** File provenance; missing on rides saved by earlier app versions. */
  importFormat?: "gpx" | "tcx";
  importWarnings?: string[];
  notes: string;
  isFavorite: boolean;
}

export interface RideSummary {
  distanceKm: number;
  movingSeconds: number;
  durationSeconds: number;
  stoppedSeconds: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainM: number;
  maxLeanLeft: number | null;
  maxLeanRight: number | null;
  corners: number;
  /** GPS-derived consistency indicator, not a safety assessment. */
  smoothness: number | null;
}

export interface FixFilterOptions {
  maxAccuracyM?: number;
  maxSpeedKmh?: number;
  maxGapMs?: number;
}

export interface PrivateZone {
  latitude: number;
  longitude: number;
  radiusM: number;
}

export const MAX_FIX_GAP_MS = 30_000;
const EARTH_RADIUS_M = 6_371_008.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;
const finiteOrNull = (value: number | null | undefined) =>
  value == null || Number.isFinite(value);
const wrapLongitude = (value: number) => ((value + 540) % 360) - 180;

export function distanceMeters(
  a: Pick<RidePoint, "latitude" | "longitude">,
  b: Pick<RidePoint, "latitude" | "longitude">,
): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(wrapLongitude(b.longitude - a.longitude));
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function isValidRidePoint(point: RidePoint): boolean {
  return (
    point != null &&
    typeof point === "object" &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180 &&
    Number.isFinite(point.timestamp) &&
    point.timestamp >= 0 &&
    point.timestamp <= 8_640_000_000_000_000 &&
    finiteOrNull(point.speed) &&
    (point.speed == null || point.speed >= 0) &&
    finiteOrNull(point.altitude) &&
    finiteOrNull(point.accuracy) &&
    (point.accuracy == null || point.accuracy >= 0) &&
    finiteOrNull(point.heading) &&
    (point.heading == null || (point.heading >= 0 && point.heading <= 360)) &&
    finiteOrNull(point.lean) &&
    (point.lean == null || Math.abs(point.lean) <= 90) &&
    (point.segment == null ||
      (Number.isSafeInteger(point.segment) && point.segment >= 0))
  );
}

/** Keeps input order; never sorts fixes, invents positions, or mutates caller data. */
export function filterRidePoints(
  points: readonly RidePoint[],
  options: FixFilterOptions = {},
): RidePoint[] {
  const maxAccuracy = options.maxAccuracyM ?? 50;
  const maxSpeed = options.maxSpeedKmh ?? 250;
  const maxGap = options.maxGapMs ?? MAX_FIX_GAP_MS;
  const clean: RidePoint[] = [];
  let segment = 0;
  let previousSourceSegment: number | undefined;
  for (const point of points) {
    if (
      !isValidRidePoint(point) ||
      (point.accuracy != null && point.accuracy > maxAccuracy) ||
      (point.speed != null && point.speed * 3.6 > maxSpeed)
    )
      continue;
    const previous = clean[clean.length - 1];
    const sourceSegment = point.segment ?? 0;
    if (previous) {
      const elapsed = point.timestamp - previous.timestamp;
      if (elapsed <= 0) continue;
      const disconnected =
        sourceSegment !== previousSourceSegment || elapsed > maxGap;
      if (
        !disconnected &&
        (distanceMeters(previous, point) / elapsed) * 3_600 > maxSpeed
      )
        continue;
      if (disconnected) segment += 1;
    }
    clean.push({ ...point, segment });
    previousSourceSegment = sourceSegment;
  }
  return clean;
}

function bearing(a: RidePoint, b: RidePoint): number {
  const lon = radians(wrapLongitude(b.longitude - a.longitude));
  const latA = radians(a.latitude);
  const latB = radians(b.latitude);
  return (
    (Math.atan2(
      Math.sin(lon) * Math.cos(latB),
      Math.cos(latA) * Math.sin(latB) -
        Math.sin(latA) * Math.cos(latB) * Math.cos(lon),
    ) *
      180) /
    Math.PI
  );
}

/** Suppresses small stationary GPS drift when both devices report a stopped bike. */
function travelledDistance(a: RidePoint, b: RidePoint): number {
  const distance = distanceMeters(a, b);
  const stopped =
    a.speed != null && b.speed != null && a.speed < 0.84 && b.speed < 0.84;
  const deadband = Math.min(12, Math.max(3, a.accuracy ?? 3, b.accuracy ?? 3));
  return stopped && distance < deadband ? 0 : distance;
}

export function summarizeRide(ride: Ride): RideSummary {
  const points = filterRidePoints(ride.points);
  let distanceM = 0;
  let movingSeconds = 0;
  let maxSpeedKmh = 0;
  let elevationGainM = 0;
  let maxLeanLeft: number | null = null;
  let maxLeanRight: number | null = null;
  let corners = 0;
  let turn = 0;
  let turnCounted = false;
  let previousBearing: number | null = null;
  let previousSpeed: number | null = null;
  let elevationAnchor: number | null = null;
  let accelerationSum = 0;
  let accelerationCount = 0;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (point.speed != null)
      maxSpeedKmh = Math.max(maxSpeedKmh, point.speed * 3.6);
    if (point.lean != null) {
      maxLeanLeft = Math.max(maxLeanLeft ?? 0, -point.lean, 0);
      maxLeanRight = Math.max(maxLeanRight ?? 0, point.lean, 0);
    }
    const previous = points[i - 1];
    if (!previous || point.segment !== previous.segment) {
      previousBearing = null;
      previousSpeed = null;
      elevationAnchor = point.altitude;
      turn = 0;
      turnCounted = false;
      continue;
    }
    const seconds = (point.timestamp - previous.timestamp) / 1_000;
    const distance = travelledDistance(previous, point);
    const derivedSpeed = distance / seconds;
    const speed = point.speed ?? derivedSpeed;
    distanceM += distance;
    if (distance > 0 && (derivedSpeed >= 3 / 3.6 || speed >= 3 / 3.6))
      movingSeconds += seconds;
    maxSpeedKmh = Math.max(maxSpeedKmh, derivedSpeed * 3.6);
    if (previousSpeed != null && seconds <= 10) {
      accelerationSum += Math.abs(speed - previousSpeed) / seconds;
      accelerationCount += 1;
    }
    previousSpeed = speed;
    if (point.altitude != null) {
      if (elevationAnchor == null) elevationAnchor = point.altitude;
      const elevationChange = point.altitude - elevationAnchor;
      if (Math.abs(elevationChange) >= 3) {
        if (elevationChange > 0) elevationGainM += elevationChange;
        elevationAnchor = point.altitude;
      }
    }
    if (distance >= 5) {
      const direction = bearing(previous, point);
      if (previousBearing != null) {
        const delta = wrapLongitude(direction - previousBearing);
        if (
          Math.abs(delta) < 4 ||
          Math.abs(delta) > 120 ||
          (turn !== 0 && Math.sign(turn) !== Math.sign(delta))
        ) {
          turn = 0;
          turnCounted = false;
        }
        if (Math.abs(delta) >= 4 && Math.abs(delta) <= 120) {
          turn += delta;
          if (!turnCounted && Math.abs(turn) >= 35) {
            corners += 1;
            turnCounted = true;
          }
        }
      }
      previousBearing = direction;
    }
  }
  const pointDuration =
    points.length > 1
      ? (points[points.length - 1].timestamp - points[0].timestamp) / 1_000
      : 0;
  const declaredDuration =
    Number.isFinite(ride.startedAt) && Number.isFinite(ride.endedAt)
      ? Math.max(0, (ride.endedAt - ride.startedAt) / 1_000)
      : 0;
  const durationSeconds = Math.max(
    pointDuration,
    declaredDuration,
    movingSeconds,
  );
  return {
    distanceKm: distanceM / 1_000,
    movingSeconds,
    durationSeconds,
    stoppedSeconds: Math.max(0, durationSeconds - movingSeconds),
    averageSpeedKmh: movingSeconds > 0 ? (distanceM / movingSeconds) * 3.6 : 0,
    maxSpeedKmh,
    elevationGainM,
    maxLeanLeft,
    maxLeanRight,
    corners,
    smoothness:
      accelerationCount >= 10
        ? Math.round(
            Math.max(
              0,
              Math.min(100, 100 - (accelerationSum / accelerationCount) * 20),
            ),
          )
        : null,
  };
}

function validateZones(zones: readonly PrivateZone[]): void {
  if (zones.length > 100) throw new Error("Use at most 100 privacy zones.");
  for (const zone of zones) {
    if (
      !Number.isFinite(zone.latitude) ||
      Math.abs(zone.latitude) > 90 ||
      !Number.isFinite(zone.longitude) ||
      Math.abs(zone.longitude) > 180 ||
      !Number.isFinite(zone.radiusM) ||
      zone.radiusM <= 0
    )
      throw new Error("Invalid privacy zone.");
  }
}

function crossesZone(a: RidePoint, b: RidePoint, zone: PrivateZone): boolean {
  // Local tangent-plane projection is sufficient for short, filtered GPS edges.
  const scale = Math.cos(radians(zone.latitude));
  const ax =
    radians(wrapLongitude(a.longitude - zone.longitude)) *
    EARTH_RADIUS_M *
    scale;
  const ay = radians(a.latitude - zone.latitude) * EARTH_RADIUS_M;
  const bx =
    radians(wrapLongitude(b.longitude - zone.longitude)) *
    EARTH_RADIUS_M *
    scale;
  const by = radians(b.latitude - zone.latitude) * EARTH_RADIUS_M;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy) <= zone.radiusM;
}

/** Removes private positions and splits any remaining line that crosses a zone. */
export function removePrivateZones(
  points: readonly RidePoint[],
  zones: readonly PrivateZone[],
): RidePoint[] {
  validateZones(zones);
  const clean = filterRidePoints(points);
  const result: RidePoint[] = [];
  let segment = 0;
  let removed = false;
  let lastOriginalSegment: number | undefined;
  for (const point of clean) {
    if (zones.some((zone) => distanceMeters(point, zone) <= zone.radiusM)) {
      removed = true;
      continue;
    }
    const previous = result[result.length - 1];
    if (
      previous &&
      (removed ||
        point.segment !== lastOriginalSegment ||
        zones.some((zone) => crossesZone(previous, point, zone)))
    )
      segment += 1;
    result.push({ ...point, segment });
    lastOriginalSegment = point.segment;
    removed = false;
  }
  return result;
}

/** Conservatively drops whole fixes; short rides can become empty. Input stays intact. */
export function trimRideForPrivacy(
  ride: Ride,
  trimMeters = 300,
  zones: readonly PrivateZone[] = [],
): Ride {
  if (!Number.isFinite(trimMeters) || trimMeters < 0)
    throw new Error("Privacy trim distance must be non-negative.");
  const clean = filterRidePoints(ride.points);
  const cumulative: number[] = [];
  let total = 0;
  clean.forEach((point, index) => {
    const previous = clean[index - 1];
    if (previous && previous.segment === point.segment)
      total += distanceMeters(previous, point);
    cumulative.push(total);
  });
  const trimmed = clean.filter(
    (_, index) =>
      cumulative[index] >= trimMeters &&
      total - cumulative[index] >= trimMeters,
  );
  const points = removePrivateZones(trimmed, zones);
  return {
    ...ride,
    points,
    startedAt: points[0]?.timestamp ?? ride.startedAt,
    endedAt: points[points.length - 1]?.timestamp ?? ride.startedAt,
  };
}

function sampleSegment(points: RidePoint[], count: number): RidePoint[] {
  if (points.length <= count) return points;
  if (count <= 2)
    return count === 1 ? [points[0]] : [points[0], points[points.length - 1]];
  // Largest-triangle buckets retain bends while keeping map work predictable.
  const result = [points[0]];
  const bucketSize = (points.length - 2) / (count - 2);
  let anchor = 0;
  const origin = points[0].longitude;
  const x = (point: RidePoint) => wrapLongitude(point.longitude - origin);
  for (let bucket = 0; bucket < count - 2; bucket += 1) {
    const averageStart = Math.floor((bucket + 1) * bucketSize) + 1;
    const averageEnd = Math.min(
      points.length,
      Math.floor((bucket + 2) * bucketSize) + 1,
    );
    let averageX = 0;
    let averageY = 0;
    for (let index = averageStart; index < averageEnd; index += 1) {
      averageX += x(points[index]);
      averageY += points[index].latitude;
    }
    const averageCount = averageEnd - averageStart;
    averageX /= averageCount;
    averageY /= averageCount;
    const start = Math.floor(bucket * bucketSize) + 1;
    const end = Math.min(
      points.length - 1,
      Math.floor((bucket + 1) * bucketSize) + 1,
    );
    let largestArea = -1;
    let selected = start;
    const anchorX = x(points[anchor]);
    const anchorY = points[anchor].latitude;
    for (let index = start; index < end; index += 1) {
      const area = Math.abs(
        (anchorX - averageX) * (points[index].latitude - anchorY) -
          (anchorX - x(points[index])) * (averageY - anchorY),
      );
      if (area > largestArea) {
        largestArea = area;
        selected = index;
      }
    }
    result.push(points[selected]);
    anchor = selected;
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Map-only sampling; use full fixes for statistics/export. Preserves outer endpoints
 * and segment identifiers. If the limit cannot fit every segment's endpoints, keeps
 * outer endpoints and the largest segments; omitted segments are never bridged.
 */
export function thinPoints(
  points: readonly RidePoint[],
  max = 1_200,
): RidePoint[] {
  if (!Number.isSafeInteger(max) || max < 2)
    throw new Error("A map trace limit must be an integer of at least two.");
  const clean = filterRidePoints(points);
  if (clean.length <= max) return clean;
  const groups: RidePoint[][] = [];
  const starts: number[] = [];
  for (let index = 0; index < clean.length; index += 1) {
    const point = clean[index];
    if (index === 0 || point.segment !== clean[index - 1].segment) {
      groups.push([]);
      starts.push(index);
    }
    groups[groups.length - 1].push(point);
  }
  const minimums = groups.map((group) => Math.min(2, group.length));
  const minimumTotal = minimums.reduce((sum, count) => sum + count, 0);
  if (minimumTotal > max) {
    const kept = new Set([0, clean.length - 1]);
    const ranked = groups
      .map((group, index) => ({ index, length: group.length }))
      .sort((a, b) => b.length - a.length || a.index - b.index);
    for (const group of ranked) {
      const start = starts[group.index];
      const end = start + group.length - 1;
      const needed =
        Number(!kept.has(start)) + Number(start !== end && !kept.has(end));
      if (kept.size + needed <= max) {
        kept.add(start);
        kept.add(end);
      }
    }
    return [...kept].sort((a, b) => a - b).map((index) => clean[index]);
  }
  const extra = max - minimumTotal;
  const available = clean.length - minimumTotal;
  const allocations = groups.map((group, index) => {
    const exact = (extra * (group.length - minimums[index])) / available;
    return {
      index,
      count: minimums[index] + Math.floor(exact),
      remainder: exact % 1,
    };
  });
  let remaining =
    max - allocations.reduce((sum, allocation) => sum + allocation.count, 0);
  for (const allocation of [...allocations].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  )) {
    if (remaining > 0 && allocation.count < groups[allocation.index].length) {
      allocation.count += 1;
      remaining -= 1;
    }
  }
  return groups.flatMap((group, index) =>
    sampleSegment(group, allocations[index].count),
  );
}
