import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { DeviceMotion, type DeviceMotionMeasurement } from "expo-sensors";
import { AppState, Platform } from "react-native";
import {
  advanceCapture,
  createCaptureState,
  setCaptureEnabled,
  type CaptureState,
} from "../domain/capture";
import { MAX_FIX_GAP_MS, type Ride, type RidePoint } from "../domain/ride";
import { loadPointJournal, savePointJournal, saveRide } from "./storage";
import { emptyRecording, type RecordingSnapshot } from "./storage-types";

export type { RecordingSnapshot } from "./storage-types";

const TASK = "apexmoto-location-v1";
const DRAFT_KEY = "recording-draft";
const MAX_RECORDING_POINTS = 50000;
const FOREGROUND_ONLY =
  "Foreground recording only. Keep the app open; background recording needs Always location access and an installed development or production build.";
type Draft = {
  version: 1;
  snapshot: RecordingSnapshot;
  capture: CaptureState;
  mode: "manual" | "auto";
  segment: number;
  lastTimestamp: number;
  pendingAutomatic?: { vehicleId: string; requestedAt: number };
};
let draft: Draft = {
  version: 1,
  snapshot: emptyRecording(),
  capture: createCaptureState(),
  mode: "manual",
  segment: 0,
  lastTimestamp: 0,
};
let hydrated = false;
let restoreAttempted = false;
let operations: Promise<void> = Promise.resolve();
let foreground: Location.LocationSubscription | null = null;
let backgroundProfile: "discovery" | "ride" | null = null;
let motionSubscription: { remove(): void } | null = null;
let motion: DeviceMotionMeasurement | null = null;
let motionReceivedAt = 0;
let leanBaseline: number | null = null;
let lastMotionEmit = 0;
const listeners = new Set<(snapshot: RecordingSnapshot) => void>();

function emit() {
  // Immutable point arrays let screens memoize expensive route/chart work.
  for (const listener of listeners) listener({ ...draft.snapshot });
}

async function hydrate() {
  if (hydrated) return;
  const journal = await loadPointJournal<Draft>(DRAFT_KEY);
  const saved = journal?.metadata;
  if (saved) {
    if (
      saved.version !== 1 ||
      !saved.snapshot ||
      !Array.isArray(saved.snapshot.points) ||
      !saved.capture
    ) {
      throw new Error(
        "The recording draft could not be restored. Its data has been preserved.",
      );
    }
    draft = { ...saved, snapshot: { ...saved.snapshot, lean: null } };
    if (journal?.points) {
      if (draft.mode === "auto") {
        draft.capture = { ...draft.capture, points: journal.points };
        if (draft.snapshot.status === "recording")
          draft.snapshot.points = journal.points;
      } else draft.snapshot.points = journal.points;
    }
    if (
      draft.snapshot.status === "recording" &&
      draft.snapshot.points.length >= MAX_RECORDING_POINTS
    ) {
      draft.snapshot = {
        ...draft.snapshot,
        status: "paused",
        error:
          "This ride reached the 50,000-fix recording limit. Save it before continuing.",
      };
      draft.mode = "manual";
      draft.capture = createCaptureState(false);
    }
  }
  hydrated = true;
}

async function persist() {
  const points =
    draft.mode === "auto" ? draft.capture.points : draft.snapshot.points;
  const generation = `${draft.snapshot.vehicleId}-${draft.snapshot.startedAt ?? draft.capture.startedAt ?? "idle"}`;
  await savePointJournal(
    DRAFT_KEY,
    {
      ...draft,
      snapshot: { ...draft.snapshot, points: [], lean: null },
      capture: { ...draft.capture, points: [] },
    },
    points,
    generation,
  );
  emit();
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(async () => {
    try {
      await hydrate();
      return await operation();
    } catch (error) {
      draft.snapshot = {
        ...draft.snapshot,
        error:
          error instanceof Error
            ? error.message
            : "Recording could not be updated. Please try again.",
      };
      emit();
      throw error;
    }
  });
  operations = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function currentLean(): number | null {
  if (
    leanBaseline === null ||
    !motion ||
    !Number.isFinite(motion.rotation?.gamma) ||
    motion.orientation !== 0 ||
    Date.now() - motionReceivedAt > 3000
  )
    return null;
  // Fused device orientation is preferable to raw acceleration during cornering.
  // This is a phone-mount estimate, not a validated vehicle lean sensor.
  const angle = (motion.rotation.gamma * 180) / Math.PI - leanBaseline;
  const normalized = ((angle + 540) % 360) - 180;
  return Number.isFinite(normalized) && Math.abs(normalized) <= 90
    ? Math.round(normalized)
    : null;
}

async function startMotion(requestPermission: boolean) {
  if (motionSubscription) return;
  if (!(await DeviceMotion.isAvailableAsync())) {
    if (requestPermission)
      throw new Error(
        "This device does not provide a motion sensor. Lean is unavailable.",
      );
    return;
  }
  const permission = requestPermission
    ? await DeviceMotion.requestPermissionsAsync()
    : await DeviceMotion.getPermissionsAsync();
  if (!permission.granted) {
    if (requestPermission)
      throw new Error(
        "Motion access was denied. Enable it in Settings to calibrate your mount.",
      );
    return;
  }
  DeviceMotion.setUpdateInterval(100);
  motionSubscription = DeviceMotion.addListener((measurement) => {
    motion = measurement;
    motionReceivedAt = Date.now();
    const lean = currentLean();
    if (Date.now() - lastMotionEmit >= 500 && lean !== draft.snapshot.lean) {
      lastMotionEmit = Date.now();
      draft.snapshot = { ...draft.snapshot, lean };
      emit();
    }
  });
}

function stopMotion() {
  motionSubscription?.remove();
  motionSubscription = null;
  motion = null;
  motionReceivedAt = 0;
  draft.snapshot = { ...draft.snapshot, lean: null };
}

async function stopTransport() {
  foreground?.remove();
  foreground = null;
  stopMotion();
  if (
    (await TaskManager.isAvailableAsync()) &&
    (await Location.hasStartedLocationUpdatesAsync(TASK))
  ) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
  backgroundProfile = null;
}

async function configureBackground(discovery: boolean) {
  const profile = discovery ? "discovery" : "ride";
  if (
    profile === backgroundProfile &&
    (await Location.hasStartedLocationUpdatesAsync(TASK))
  )
    return;
  // Android evaluates FGS eligibility when the service starts. A permission
  // Settings activity may have resolved its promise before our activity resumes.
  await waitForActiveApp();
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: discovery ? Location.Accuracy.Balanced : Location.Accuracy.High,
    timeInterval: discovery ? 10000 : 2000,
    // Stationary fixes confirm the parking timer; a distance threshold can suppress them.
    distanceInterval: 0,
    deferredUpdatesInterval: discovery ? 10000 : 5000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: discovery
        ? "Automatic ride capture is armed"
        : "Ride recording is active",
      notificationBody:
        "Location is being used for your rides. Open the app to pause or stop.",
      notificationColor: "#C7F26A",
      killServiceOnDestroy: true,
    },
  });
  backgroundProfile = profile;
}

async function waitForActiveApp(): Promise<void> {
  if (Platform.OS !== "android" || AppState.currentState === "active") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(
        new Error("Return to Apex Moto and tap Start or Resume to record."),
      );
    }, 5000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    });
    // Close the gap between the first state check and installing the listener.
    if (AppState.currentState === "active") {
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    }
  });
}

async function startTransport(
  prompt: boolean,
  requireBackground: boolean,
  discovery = draft.mode === "auto" && draft.capture.phase === "armed",
) {
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error(
      "Location services are off. Turn on location in your device settings.",
    );
  const permission = prompt
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Location permission is required to record. Enable precise location in Settings and try again.",
    );
  const supported =
    (await TaskManager.isAvailableAsync()) &&
    (await Location.isBackgroundLocationAvailableAsync());
  let background =
    supported && (await Location.getBackgroundPermissionsAsync()).granted;
  // A user-started Android location FGS needs while-in-use permission, not
  // Always. Avoid bouncing manual Start through Settings just before binding it.
  const androidManual = Platform.OS === "android" && !requireBackground;
  if (supported && !background && prompt && !androidManual)
    background = (await Location.requestBackgroundPermissionsAsync()).granted;
  if (requireBackground && !background) {
    throw new Error(
      "Automatic capture needs Always location access and an installed development or production build. Enable background location in Settings, then try again.",
    );
  }
  if (background || (supported && androidManual)) {
    // A single background task also delivers foreground fixes, avoiding two GPS streams.
    await configureBackground(discovery);
    foreground?.remove();
    foreground = null;
    draft.snapshot = { ...draft.snapshot, error: null };
  } else {
    if (!foreground) {
      foreground = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (location) => {
          void acceptLocations([location]).catch(() => undefined);
        },
        (reason) => {
          void enqueue(async () => {
            draft.snapshot = {
              ...draft.snapshot,
              error: `GPS update failed: ${reason}`,
            };
            await persist();
          }).catch(() => undefined);
        },
      );
    }
    draft.snapshot = { ...draft.snapshot, error: FOREGROUND_ONLY };
  }
  if (leanBaseline !== null) await startMotion(false);
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pointFromLocation(
  location: Location.LocationObject,
): RidePoint | null {
  const { coords, timestamp } = location;
  if (
    !Number.isFinite(coords.latitude) ||
    !Number.isFinite(coords.longitude) ||
    Math.abs(coords.latitude) > 90 ||
    Math.abs(coords.longitude) > 180 ||
    !Number.isFinite(timestamp) ||
    timestamp <= draft.lastTimestamp ||
    timestamp > Date.now() + 60000 ||
    (coords.accuracy !== null && coords.accuracy > 50)
  )
    return null;
  const speed = finite(coords.speed);
  const heading = finite(coords.heading);
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    timestamp,
    speed: speed !== null && speed >= 0 ? speed : null,
    accuracy: finite(coords.accuracy),
    altitude: finite(coords.altitude),
    heading: heading !== null && heading >= 0 ? heading : null,
    lean: Math.abs(Date.now() - timestamp) < 3000 ? currentLean() : null,
    segment: draft.segment,
  };
}

function makeRide(
  points: RidePoint[],
  startedAt: number,
  endedAt: number,
): Ride {
  return {
    // Stable identity makes a retried save after process death idempotent.
    id: `gps-${startedAt}-${draft.snapshot.vehicleId}`,
    name: `${new Date(startedAt).getHours() < 12 ? "Morning" : new Date(startedAt).getHours() < 17 ? "Afternoon" : "Evening"} ride`,
    startedAt,
    endedAt,
    points,
    vehicleId: draft.snapshot.vehicleId,
    source: "gps",
    notes: "",
    isFavorite: false,
  };
}

async function acceptLocations(locations: Location.LocationObject[]) {
  return enqueue(async () => {
    if (draft.snapshot.status === "idle" || draft.snapshot.status === "paused")
      return;
    let changed = false;
    let needsAccurateFix = false;
    for (const location of [...locations].sort(
      (a, b) => a.timestamp - b.timestamp,
    )) {
      const point = pointFromLocation(location);
      if (!point) {
        // Balanced discovery can report a coarse moving fix. Upgrade accuracy before
        // feeding the reducer; never put a coarse fix into the saved route.
        if (
          draft.mode === "auto" &&
          draft.capture.phase === "armed" &&
          location.timestamp > draft.lastTimestamp &&
          location.timestamp > Date.now() - 30000 &&
          (location.coords.speed ?? 0) >= 15 / 3.6 &&
          (location.coords.accuracy ?? 0) > 50
        )
          needsAccurateFix = true;
        continue;
      }
      // Ignore delayed fixes from a previous recording or a paused interval.
      if (
        draft.mode === "manual" &&
        draft.snapshot.startedAt !== null &&
        point.timestamp < draft.snapshot.startedAt
      )
        continue;
      draft.lastTimestamp = point.timestamp;
      changed = true;
      if (draft.mode === "auto") {
        const result = advanceCapture(draft.capture, point);
        if (result.event?.type === "finished") {
          await saveRide(
            makeRide(
              result.event.points,
              result.event.startedAt,
              result.event.endedAt,
            ),
          );
        }
        draft.capture = result.state;
        const active =
          result.state.phase === "recording" || result.state.phase === "parked";
        draft.snapshot = {
          ...draft.snapshot,
          status: active ? "recording" : "armed",
          points: active ? result.state.points : [],
          startedAt: active ? result.state.startedAt : null,
          lean: currentLean(),
        };
      } else {
        const previousPoint = draft.snapshot.points.at(-1);
        if (
          previousPoint &&
          point.timestamp - previousPoint.timestamp > MAX_FIX_GAP_MS
        ) {
          draft.segment += 1;
          point.segment = draft.segment;
        }
        draft.snapshot = {
          ...draft.snapshot,
          points: [...draft.snapshot.points, point],
          lean: currentLean(),
        };
        if (draft.snapshot.points.length >= MAX_RECORDING_POINTS) {
          draft.snapshot = {
            ...draft.snapshot,
            status: "paused",
            error:
              "This ride reached the 50,000-fix recording limit. Save it and start another ride to continue.",
          };
          await stopTransport();
          break;
        }
      }
    }
    if (changed) await persist();
    if (draft.mode === "auto" && (changed || needsAccurateFix)) {
      await configureBackground(
        draft.capture.phase === "armed" && !needsAccurateFix,
      );
    }
  });
}

// Must be registered at module scope so Expo can run it without mounting React.
if (!TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    TASK,
    async ({ data, error }) => {
      if (error) {
        await enqueue(async () => {
          draft.snapshot = {
            ...draft.snapshot,
            error: `Background GPS: ${error.message}`,
          };
          await persist();
        }).catch(() => undefined);
        return;
      }
      if (data?.locations)
        await acceptLocations(data.locations).catch(() => undefined);
    },
  );
}

export function subscribeRecording(
  listener: (snapshot: RecordingSnapshot) => void,
): () => void {
  listeners.add(listener);
  void getRecordingSnapshot()
    .then((snapshot) => {
      if (listeners.has(listener)) listener(snapshot);
    })
    .catch(() => undefined);
  return () => {
    listeners.delete(listener);
  };
}

export function getRecordingSnapshot(): Promise<RecordingSnapshot> {
  return enqueue(async () => {
    if (!restoreAttempted) {
      restoreAttempted = true;
      if (draft.pendingAutomatic) {
        const pending = draft.pendingAutomatic;
        try {
          if (Date.now() - pending.requestedAt > 15 * 60_000)
            throw new Error(
              "Automatic setup was interrupted. Enable capture again when you are ready.",
            );
          // Resume an explicit opt-in after Android recreates the app in Settings.
          // Never prompt or start tracking unless the required access is now granted.
          await applyAutomaticCapture(true, pending.vehicleId, false);
        } catch (error) {
          draft.pendingAutomatic = undefined;
          draft.snapshot = {
            ...draft.snapshot,
            error:
              error instanceof Error
                ? error.message
                : "Automatic setup could not finish. Try again.",
          };
          await persist();
        }
      }
      if (
        draft.snapshot.status === "recording" ||
        draft.snapshot.status === "armed"
      ) {
        try {
          await startTransport(false, draft.mode === "auto");
        } catch (error) {
          draft.snapshot = {
            ...draft.snapshot,
            status: draft.snapshot.points.length ? "paused" : "idle",
            automatic: false,
            error:
              error instanceof Error
                ? error.message
                : "Recording needs to be resumed.",
          };
          draft.mode = "manual";
          draft.segment =
            draft.snapshot.points.at(-1)?.segment ?? draft.segment;
          draft.capture = createCaptureState(false);
          await persist();
        }
      }
    }
    return { ...draft.snapshot };
  });
}

/** UI must explain Always/background access before this user-initiated action. */
export function startRecording(vehicleId: string): Promise<void> {
  return enqueue(async () => {
    if (
      draft.snapshot.status === "recording" ||
      draft.snapshot.status === "paused"
    )
      throw new Error(
        "Finish or discard your current ride before starting another.",
      );
    const previous = draft;
    draft = {
      ...draft,
      snapshot: {
        ...emptyRecording(),
        status: "recording",
        startedAt: Date.now(),
        vehicleId,
        automatic: draft.snapshot.automatic,
      },
      mode: "manual",
      segment: 0,
      lastTimestamp: Date.now(),
      capture: createCaptureState(false),
    };
    try {
      await startTransport(true, false);
      await persist();
    } catch (error) {
      // A failed draft write must not leave an undisclosed GPS service running.
      await stopTransport().catch(() => undefined);
      draft = previous;
      if (previous.snapshot.status === "armed")
        await startTransport(false, true).catch(() => undefined);
      throw error;
    }
  });
}

export function pauseRecording(): Promise<Ride | null> {
  return enqueue(async () => {
    if (draft.snapshot.status !== "recording") return null;
    draft.snapshot = { ...draft.snapshot, status: "paused", lean: null };
    // A manual pause takes over an automatically detected ride.
    draft.mode = "manual";
    draft.segment = draft.snapshot.points.at(-1)?.segment ?? draft.segment;
    draft.capture = createCaptureState(false);
    await persist();
    await stopTransport();
    return null;
  });
}

export function resumeRecording(): Promise<Ride | null> {
  return enqueue(async () => {
    if (draft.snapshot.status !== "paused") return null;
    if (draft.snapshot.points.length >= MAX_RECORDING_POINTS)
      throw new Error(
        "Save this ride before continuing; its 50,000-fix recording limit has been reached.",
      );
    await startTransport(true, false);
    draft.segment += 1;
    draft.lastTimestamp = Date.now();
    draft.snapshot = { ...draft.snapshot, status: "recording" };
    await persist();
    return null;
  });
}

async function clearDraft() {
  const automatic = draft.snapshot.automatic;
  const vehicleId = draft.snapshot.vehicleId;
  await stopTransport();
  leanBaseline = null;
  draft = {
    version: 1,
    snapshot: {
      ...emptyRecording(),
      status: automatic ? "armed" : "idle",
      automatic,
      vehicleId,
    },
    capture: createCaptureState(automatic),
    mode: automatic ? "auto" : "manual",
    segment: 0,
    lastTimestamp: Date.now(),
  };
  await persist();
  if (automatic) {
    try {
      await startTransport(false, true);
    } catch (error) {
      draft.snapshot = {
        ...draft.snapshot,
        status: "idle",
        automatic: false,
        error:
          error instanceof Error
            ? error.message
            : "Automatic capture could not restart.",
      };
      draft.capture = createCaptureState(false);
    }
    await persist();
  }
}

export function finishRecording(): Promise<Ride | null> {
  return enqueue(async () => {
    if (
      draft.snapshot.status !== "recording" &&
      draft.snapshot.status !== "paused"
    )
      return null;
    if (draft.snapshot.points.length < 2 || draft.snapshot.startedAt === null)
      throw new Error(
        "Waiting for a GPS route. Record at least two accurate location fixes, or discard this ride.",
      );
    const ride = makeRide(
      draft.snapshot.points,
      draft.snapshot.startedAt,
      draft.snapshot.points.at(-1)!.timestamp,
    );
    await saveRide(ride);
    await clearDraft();
    return ride;
  });
}

export function discardRecording(): Promise<void> {
  return enqueue(clearDraft);
}

/** Opt-in only. The caller explains battery use and background access first. */
export function setAutomaticCapture(
  enabled: boolean,
  vehicleId: string,
): Promise<void> {
  return enqueue(async () => {
    try {
      if (enabled) {
        draft.pendingAutomatic = { vehicleId, requestedAt: Date.now() };
        await persist();
      }
      await applyAutomaticCapture(enabled, vehicleId, true);
    } catch (error) {
      draft.pendingAutomatic = undefined;
      await persist();
      throw error;
    }
  });
}

async function applyAutomaticCapture(
  enabled: boolean,
  vehicleId: string,
  prompt: boolean,
) {
  const previous = { ...draft, pendingAutomatic: undefined };
  const hasRide =
    draft.snapshot.status === "recording" || draft.snapshot.status === "paused";
  if (enabled) await startTransport(prompt, true, !hasRide);
  draft.snapshot = {
    ...draft.snapshot,
    automatic: enabled,
    vehicleId: hasRide ? draft.snapshot.vehicleId : vehicleId,
    error: null,
  };
  if (!hasRide) {
    draft.mode = enabled ? "auto" : "manual";
    draft.snapshot = {
      ...draft.snapshot,
      status: enabled ? "armed" : "idle",
      points: [],
      startedAt: null,
    };
    draft.capture = setCaptureEnabled(draft.capture, enabled);
    draft.lastTimestamp = Date.now();
    if (!enabled) await stopTransport();
  } else if (!enabled && draft.mode === "auto") {
    // Keep the in-progress route; switching the toggle never deletes a ride.
    draft.mode = "manual";
    draft.segment = draft.snapshot.points.at(-1)?.segment ?? draft.segment;
    draft.capture = createCaptureState(false);
  }
  if (draft.snapshot.status === "paused") await stopTransport();
  draft.pendingAutomatic = undefined;
  try {
    await persist();
  } catch (error) {
    await stopTransport().catch(() => undefined);
    draft = previous;
    if (
      previous.snapshot.status === "recording" ||
      previous.snapshot.status === "armed"
    ) {
      await startTransport(false, previous.mode === "auto").catch(() => {
        draft.snapshot = {
          ...draft.snapshot,
          status: hasRide ? "paused" : "idle",
          automatic: false,
        };
      });
    }
    throw error;
  }
}

export function calibrateLean(): Promise<void> {
  return enqueue(async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Start a GPS recording before calibrating. Park the bike upright with the phone fixed in its mount.",
      );
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "A stationary GPS fix was not available. Park outdoors and try calibration again.",
              ),
            ),
          15000,
        );
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
    if (
      location.coords.speed === null ||
      location.coords.speed < 0 ||
      location.coords.speed > 0.8 ||
      (location.coords.accuracy ?? Infinity) > 25
    ) {
      throw new Error(
        "Calibration needs an accurate, stationary GPS fix. Park outdoors and keep the bike upright.",
      );
    }
    try {
      await startMotion(true);
      // Read a short stationary sample, not one frame affected by touching the phone.
      const samples: number[] = [];
      let lastSampleAt = 0;
      for (let index = 0; index < 30 && samples.length < 12; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (
          !motion ||
          Date.now() - motionReceivedAt > 500 ||
          motionReceivedAt === lastSampleAt ||
          !Number.isFinite(motion.rotation?.gamma)
        )
          continue;
        const acceleration = motion.acceleration;
        if (
          !acceleration ||
          ![acceleration.x, acceleration.y, acceleration.z].every(
            Number.isFinite,
          ) ||
          Math.hypot(acceleration.x, acceleration.y, acceleration.z) > 0.5
        )
          continue;
        if (motion.orientation !== 0)
          throw new Error(
            "Lock the phone in portrait orientation before calibrating your mount.",
          );
        const angle = (motion.rotation.gamma * 180) / Math.PI;
        if (Number.isFinite(angle)) {
          samples.push(angle);
          lastSampleAt = motionReceivedAt;
        }
      }
      if (samples.length < 8 || Math.max(...samples) - Math.min(...samples) > 3)
        throw new Error(
          samples.length < 8
            ? "Reliable orientation data is not available yet. Keep the phone still and try again. GPS recording is unaffected."
            : "The phone moved during calibration. Keep the bike upright and the mount still, then try again.",
        );
      leanBaseline =
        samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
      draft.snapshot = { ...draft.snapshot, lean: 0 };
    } finally {
      if (
        leanBaseline === null ||
        draft.snapshot.status === "idle" ||
        draft.snapshot.status === "paused"
      )
        stopMotion();
    }
    emit();
  });
}
