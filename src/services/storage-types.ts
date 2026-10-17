import type { RidePoint } from "../domain/ride";

export interface RecordingSnapshot {
  status: "idle" | "armed" | "recording" | "paused";
  points: RidePoint[];
  startedAt: number | null;
  vehicleId: string;
  automatic: boolean;
  error: string | null;
  /** Calibrated mounted-phone tilt estimate in degrees; unavailable is always null. */
  lean: number | null;
}

export const emptyRecording = (): RecordingSnapshot => ({
  status: "idle",
  points: [],
  startedAt: null,
  vehicleId: "",
  automatic: false,
  error: null,
  lean: null,
});
