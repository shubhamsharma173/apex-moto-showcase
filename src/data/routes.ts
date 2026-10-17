import { RidePoint } from "../domain/ride";
export interface ScenicRoute {
  id: string;
  name: string;
  region: string;
  category: string;
  description: string;
  tags: string[];
  stops: string[];
  elevation: number;
  distanceKm: number;
  durationSeconds: number;
  shape: number[][];
}
// The preview catalogue is retired. Keep old deep links safe without shipping sample roads.
export const scenicRoutes: ScenicRoute[] = [];
export function routePoints(route: ScenicRoute): RidePoint[] {
  return route.shape.map(([longitude, latitude], i) => ({
    latitude,
    longitude,
    timestamp: i * 10000,
    speed: null,
    altitude: null,
    accuracy: 5,
    heading: null,
    segment: 0,
  }));
}
