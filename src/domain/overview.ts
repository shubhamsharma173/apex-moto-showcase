import { summarizeRide, type Ride } from "./ride";

/** Local calendar week, including Monday and excluding the next Monday. */
export function ridingOverview(rides: readonly Ride[], now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const summary = rides.map((ride) => ({ ride, stats: summarizeRide(ride) }));
  const week = summary.filter(
    ({ ride }) => ride.startedAt >= +start && ride.startedAt < +end,
  );
  return { start, end, all: summary, week };
}
