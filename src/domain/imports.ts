import type { Ride } from "./ride";

/** Recognize the same GPS track without overwriting a rider's edited name/notes. */
export function findDuplicateRide(
  candidate: Ride,
  existing: readonly Ride[],
): Ride | undefined {
  return existing.find(
    (ride) =>
      ride.source !== "demo" &&
      ride.startedAt === candidate.startedAt &&
      ride.endedAt === candidate.endedAt &&
      ride.points.length === candidate.points.length &&
      ride.points.every((point, index) => {
        const other = candidate.points[index];
        return (
          point.timestamp === other.timestamp &&
          point.latitude === other.latitude &&
          point.longitude === other.longitude
        );
      }),
  );
}
