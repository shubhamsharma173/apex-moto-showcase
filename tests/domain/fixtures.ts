import { Ride, RidePoint } from '../../src/domain/ride';

export const START = Date.UTC(2026, 9, 15, 8);

/** Approximate eastward motion at the equator; one degree is about 111,195 m. */
export function point(meters: number, seconds: number, overrides: Partial<RidePoint> = {}): RidePoint {
  return { latitude: 0, longitude: meters / 111_195.08, timestamp: START + seconds * 1_000, speed: 10, altitude: 100, accuracy: 3, heading: 90, ...overrides };
}

export function ride(points: RidePoint[], overrides: Partial<Ride> = {}): Ride {
  return { id: 'test-ride', name: 'River & ridge <loop>', startedAt: points[0]?.timestamp ?? START, endedAt: points[points.length - 1]?.timestamp ?? START, points, vehicleId: 'bike-1', source: 'gps', notes: '', isFavorite: false, ...overrides };
}
