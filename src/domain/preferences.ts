import type { Ride } from "./ride";
import type { Units } from "../theme";

export interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: string;
  odometerKm: number;
  serviceDueKm: number;
  services: { id: string; date: number; kind: string; odometerKm: number }[];
  fuel: {
    id: string;
    date: number;
    liters: number;
    cost: number;
    odometerKm: number;
  }[];
}

export interface Preferences {
  units: Units;
  weeklyGoalKm: number;
  privacyTrim: boolean;
  name: string;
  savedRoutes: string[];
  vehicles: Vehicle[];
  selectedVehicleId: string;
}

export const initialPreferences: Preferences = {
  units: "km",
  weeklyGoalKm: 250,
  privacyTrim: true,
  name: "Rider",
  savedRoutes: [],
  vehicles: [],
  selectedVehicleId: "",
};

/** Upgrade the preview without removing edited motorcycles or their ride history. */
export function migratePreferences(
  stored: Partial<Preferences>,
  rides: readonly Ride[],
): Preferences {
  const next = { ...initialPreferences, ...stored };
  delete (next as Preferences & { demo?: boolean }).demo;
  next.savedRoutes = (
    Array.isArray(next.savedRoutes) ? next.savedRoutes : []
  ).filter((id) => !["lavasa", "mulshi", "panshet"].includes(id));
  next.vehicles = (Array.isArray(next.vehicles) ? next.vehicles : []).filter(
    (bike) => {
      const untouchedPlaceholder =
        bike.id === "bike-1" &&
        bike.name === "My motorcycle" &&
        bike.model === "Add your make & model" &&
        bike.year === "" &&
        bike.odometerKm === 0 &&
        bike.serviceDueKm === 5000 &&
        bike.services.length === 0 &&
        bike.fuel.length === 0;
      return (
        !untouchedPlaceholder ||
        rides.some(
          (ride) => ride.source !== "demo" && ride.vehicleId === bike.id,
        )
      );
    },
  );
  if (!next.vehicles.some((bike) => bike.id === next.selectedVehicleId))
    next.selectedVehicleId = next.vehicles[0]?.id ?? "";
  return next;
}
