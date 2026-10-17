import { RidePoint } from "../domain/ride";
export interface RouteMapProps {
  points: RidePoint[];
  markerIndex?: number;
  interactive?: boolean;
  tilted?: boolean;
  height?: number;
}
