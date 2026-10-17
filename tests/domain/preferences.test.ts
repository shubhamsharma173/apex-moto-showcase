import assert from "node:assert/strict";
import test from "node:test";
import {
  initialPreferences,
  migratePreferences,
  type Vehicle,
} from "../../src/domain/preferences";
import { ride } from "./fixtures";

const placeholder = (): Vehicle => ({
  id: "bike-1",
  name: "My motorcycle",
  model: "Add your make & model",
  year: "",
  odometerKm: 0,
  serviceDueKm: 5000,
  services: [],
  fuel: [],
});

test("new installations start with an empty garage and no demo flag", () => {
  const result = migratePreferences({}, []);
  assert.deepEqual(result, initialPreferences);
  assert.deepEqual(result.vehicles, []);
  assert.equal("demo" in result, false);
});

test("preview migration drops only the unused untouched placeholder and demo flag", () => {
  const stored = {
    demo: true,
    vehicles: [placeholder()],
    selectedVehicleId: "bike-1",
  };
  const result = migratePreferences(stored, [ride([], { source: "demo" })]);
  assert.deepEqual(result.vehicles, []);
  assert.equal(result.selectedVehicleId, "");
  assert.equal("demo" in result, false);
  assert.equal(stored.vehicles.length, 1);
  assert.equal(stored.demo, true);
});

test("preview migration preserves edited bikes, service history and bikes linked to real rides", () => {
  for (const bike of [
    { ...placeholder(), name: "My actual bike" },
    { ...placeholder(), odometerKm: 130 },
    {
      ...placeholder(),
      services: [{ id: "service", date: 1, kind: "Oil", odometerKm: 1 }],
    },
    {
      ...placeholder(),
      fuel: [{ id: "fuel", date: 1, liters: 3, cost: 300, odometerKm: 1 }],
    },
  ])
    assert.deepEqual(migratePreferences({ vehicles: [bike] }, []).vehicles, [
      bike,
    ]);
  for (const source of ["gps", "import"] as const) {
    const bike = placeholder();
    const result = migratePreferences(
      { vehicles: [bike], selectedVehicleId: "bike-1" },
      [ride([], { source })],
    );
    assert.deepEqual(result.vehicles, [bike]);
    assert.equal(result.selectedVehicleId, "bike-1");
  }
});

test("migration preserves personal preferences and repairs a missing selected motorcycle", () => {
  const bike = { ...placeholder(), id: "personal", name: "Weekend bike" };
  const result = migratePreferences(
    {
      name: "Alex",
      units: "mi",
      privacyTrim: false,
      weeklyGoalKm: 75,
      savedRoutes: ["lavasa", "my-route"],
      vehicles: [bike],
      selectedVehicleId: "gone",
    },
    [],
  );
  assert.equal(result.selectedVehicleId, "personal");
  assert.equal(result.name, "Alex");
  assert.equal(result.units, "mi");
  assert.equal(result.privacyTrim, false);
  assert.equal(result.weeklyGoalKm, 75);
  assert.deepEqual(result.savedRoutes, ["my-route"]);
});
