import { MAX_FIX_GAP_MS, type Ride, type RidePoint } from "../domain/ride";
import { loadPointJournal, savePointJournal, saveRide } from "./storage";
import { emptyRecording, type RecordingSnapshot } from "./storage-types";

export type { RecordingSnapshot } from "./storage-types";

const DRAFT_KEY = "recording-web-draft";
const FOREGROUND_ONLY =
  "Browser recording works only while this tab is visible. Use the iOS or Android app for background and automatic capture.";
type WebDraft = {
  version: 1;
  snapshot: RecordingSnapshot;
  segment: number;
  lastTimestamp: number;
};
let draft: WebDraft = {
  version: 1,
  snapshot: emptyRecording(),
  segment: 0,
  lastTimestamp: 0,
};
let hydrated = false;
let operations: Promise<void> = Promise.resolve();
let watchId: number | null = null;
let visibilityListenerAdded = false;
const listeners = new Set<(snapshot: RecordingSnapshot) => void>();

function emit() {
  for (const listener of listeners) listener({ ...draft.snapshot });
}

async function persist() {
  await savePointJournal(
    DRAFT_KEY,
    { ...draft, snapshot: { ...draft.snapshot, points: [] } },
    draft.snapshot.points,
    `${draft.snapshot.vehicleId}-${draft.snapshot.startedAt ?? "idle"}`,
  );
  emit();
}

async function hydrate() {
  if (hydrated) return;
  const journal = await loadPointJournal<WebDraft>(DRAFT_KEY);
  const saved = journal?.metadata;
  if (saved) {
    if (
      saved.version !== 1 ||
      !saved.snapshot ||
      !Array.isArray(saved.snapshot.points)
    )
      throw new Error(
        "The recording draft could not be restored. Its data has been preserved.",
      );
    draft = {
      ...saved,
      snapshot: { ...saved.snapshot, automatic: false, lean: null },
    };
    if (journal?.points) draft.snapshot.points = journal.points;
    if (draft.snapshot.status === "recording") {
      draft.snapshot = {
        ...draft.snapshot,
        status: "paused",
        error:
          "Your draft was recovered. Resume when ready; browser recording stops when the page closes.",
      };
      await persist();
    }
  }
  hydrated = true;
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

function gpsError(error: GeolocationPositionError): string {
  if (error.code === 1)
    return "Location access was denied. Allow precise location for this site in browser settings, then try again.";
  if (error.code === 3) return "GPS timed out. Move outdoors and try again.";
  return "Location is unavailable. Check that device location is on and try outdoors.";
}

function stopWatch() {
  if (watchId !== null && typeof navigator !== "undefined")
    navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

async function acceptPosition(position: GeolocationPosition) {
  return enqueue(async () => {
    if (draft.snapshot.status !== "recording") return;
    const { coords, timestamp } = position;
    if (
      timestamp <= draft.lastTimestamp ||
      timestamp < (draft.snapshot.startedAt ?? 0) ||
      timestamp > Date.now() + 60000 ||
      coords.accuracy > 50 ||
      !Number.isFinite(coords.latitude) ||
      !Number.isFinite(coords.longitude)
    )
      return;
    const previousPoint = draft.snapshot.points.at(-1);
    if (previousPoint && timestamp - previousPoint.timestamp > MAX_FIX_GAP_MS)
      draft.segment += 1;
    const point: RidePoint = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      speed: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
      heading:
        coords.heading !== null && coords.heading >= 0 ? coords.heading : null,
      lean: null,
      segment: draft.segment,
    };
    draft.lastTimestamp = timestamp;
    draft.snapshot = {
      ...draft.snapshot,
      points: [...draft.snapshot.points, point],
    };
    if (draft.snapshot.points.length >= 50000) {
      stopWatch();
      draft.snapshot = {
        ...draft.snapshot,
        status: "paused",
        error:
          "This ride reached the 50,000-fix recording limit. Save it and start another ride to continue.",
      };
    }
    await persist();
  });
}

function addVisibilityListener() {
  if (visibilityListenerAdded || typeof document === "undefined") return;
  visibilityListenerAdded = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    void enqueue(async () => {
      if (draft.snapshot.status !== "recording") return;
      stopWatch();
      draft.snapshot = {
        ...draft.snapshot,
        status: "paused",
        error:
          "Recording paused because the browser tab was hidden. Resume when this tab is visible, or use the native app for background rides.",
      };
      await persist();
    }).catch(() => undefined);
  });
}

async function startWatch() {
  if (typeof navigator === "undefined" || !navigator.geolocation)
    throw new Error(
      "This browser does not support location recording. Use the iOS or Android app.",
    );
  if (typeof window !== "undefined" && !window.isSecureContext)
    throw new Error(
      "Browser GPS requires HTTPS or localhost. Open a secure app URL to record.",
    );
  if (typeof document !== "undefined" && document.visibilityState === "hidden")
    throw new Error("Keep this browser tab visible to record.");
  // Wait for permission and the first fix before reporting successful recording.
  const initial = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(gpsError(error))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
  stopWatch();
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      void acceptPosition(position).catch(() => undefined);
    },
    (error) => {
      void enqueue(async () => {
        if (error.code === 1) {
          stopWatch();
          draft.snapshot = { ...draft.snapshot, status: "paused" };
        }
        draft.snapshot = { ...draft.snapshot, error: gpsError(error) };
        await persist();
      }).catch(() => undefined);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
  addVisibilityListener();
  void acceptPosition(initial).catch(() => undefined);
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
  return enqueue(async () => ({ ...draft.snapshot }));
}

export function startRecording(vehicleId: string): Promise<void> {
  return enqueue(async () => {
    if (
      draft.snapshot.status === "recording" ||
      draft.snapshot.status === "paused"
    )
      throw new Error(
        "Finish or discard the current ride before starting another.",
      );
    const previous = draft;
    draft = {
      version: 1,
      snapshot: {
        ...emptyRecording(),
        status: "recording",
        vehicleId,
        startedAt: Date.now(),
        error: FOREGROUND_ONLY,
      },
      segment: 0,
      lastTimestamp: Date.now(),
    };
    try {
      await startWatch();
      await persist();
    } catch (error) {
      stopWatch();
      draft = previous;
      throw error;
    }
  });
}

export function pauseRecording(): Promise<Ride | null> {
  return enqueue(async () => {
    if (draft.snapshot.status !== "recording") return null;
    stopWatch();
    draft.snapshot = { ...draft.snapshot, status: "paused" };
    await persist();
    return null;
  });
}

export function resumeRecording(): Promise<Ride | null> {
  return enqueue(async () => {
    if (draft.snapshot.status !== "paused") return null;
    if (draft.snapshot.points.length >= 50000)
      throw new Error(
        "Save this ride before continuing; its 50,000-fix recording limit has been reached.",
      );
    draft.lastTimestamp = Date.now();
    await startWatch();
    draft.segment += 1;
    draft.snapshot = {
      ...draft.snapshot,
      status: "recording",
      error: FOREGROUND_ONLY,
    };
    await persist();
    return null;
  });
}

export function finishRecording(): Promise<Ride | null> {
  return enqueue(async () => {
    if (
      draft.snapshot.status !== "recording" &&
      draft.snapshot.status !== "paused"
    )
      return null;
    const { startedAt, points, vehicleId } = draft.snapshot;
    if (startedAt === null || points.length < 2)
      throw new Error(
        "Waiting for a GPS route. Record at least two accurate location fixes, or discard this ride.",
      );
    const hour = new Date(startedAt).getHours();
    const ride: Ride = {
      id: `gps-${startedAt}-${vehicleId}`,
      name: `${hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"} ride`,
      startedAt,
      endedAt: points.at(-1)!.timestamp,
      points,
      vehicleId,
      source: "gps",
      notes: "",
      isFavorite: false,
    };
    await saveRide(ride);
    stopWatch();
    draft = {
      version: 1,
      snapshot: { ...emptyRecording(), vehicleId },
      segment: 0,
      lastTimestamp: Date.now(),
    };
    await persist();
    return ride;
  });
}

export function discardRecording(): Promise<void> {
  return enqueue(async () => {
    stopWatch();
    draft = {
      version: 1,
      snapshot: { ...emptyRecording(), vehicleId: draft.snapshot.vehicleId },
      segment: 0,
      lastTimestamp: Date.now(),
    };
    await persist();
  });
}

export function setAutomaticCapture(
  enabled: boolean,
  _vehicleId: string,
): Promise<void> {
  return enqueue(async () => {
    if (enabled)
      throw new Error(
        "Automatic capture is available in the installed iOS and Android app. Browsers cannot record reliable background rides.",
      );
    draft.snapshot = { ...draft.snapshot, automatic: false };
    await persist();
  });
}

export function calibrateLean(): Promise<void> {
  return enqueue(async () => {
    throw new Error(
      "Mount calibration requires the native iOS or Android app and a device motion sensor. Lean is unavailable in the browser.",
    );
  });
}
