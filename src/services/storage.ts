import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Ride, RidePoint } from "../domain/ride";

const PREFIX = "@apexmoto/v1/";
const RIDE_PREFIX = `${PREFIX}rides/`;
let writes: Promise<void> = Promise.resolve();

/** All local mutations share a queue; a rejected write does not poison later writes. */
function write<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation, operation);
  writes = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getValue<T>(key: string, fallback: T): Promise<T> {
  await writes;
  const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      "Local data could not be read. Your saved data has been left intact.",
    );
  }
}

export function setValue<T>(key: string, value: T): Promise<void> {
  return write(() =>
    AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value)),
  );
}

export function removeValue(key: string): Promise<void> {
  return write(() => AsyncStorage.removeItem(`${PREFIX}${key}`));
}

/** One key per ride avoids a growing read/modify/write index and lost-update races. */
export async function loadRides(): Promise<Ride[]> {
  await writes;
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) =>
      key.startsWith(RIDE_PREFIX) &&
      !key.slice(RIDE_PREFIX.length).includes("/"),
  );
  if (keys.length === 0) return [];
  const rides = await Promise.all(
    keys.map(async (key) => {
      const journal = await loadPointJournal<Ride>(key.slice(PREFIX.length));
      if (!journal)
        throw new Error(
          "A saved ride is missing. Please try loading your journal again.",
        );
      const ride: unknown = journal.metadata;
      if (
        !ride ||
        typeof ride !== "object" ||
        !("id" in ride) ||
        !("points" in ride) ||
        typeof ride.id !== "string" ||
        !Array.isArray(ride.points)
      ) {
        throw new Error(
          "A saved ride could not be read. Its original data has been preserved.",
        );
      }
      return {
        ...(ride as Ride),
        points: journal.points ?? (ride as Ride).points,
      };
    }),
  );
  return rides.sort((a, b) => b.startedAt - a.startedAt);
}

export function saveRide(ride: Ride): Promise<void> {
  if (!ride.id || !Array.isArray(ride.points))
    return Promise.reject(new Error("Invalid ride."));
  // A fresh generation allows route edits as well as metadata edits. Each value
  // remains bounded below Android's per-row AsyncStorage read limit on long rides.
  const generation = `${ride.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return savePointJournal(
    `rides/${encodeURIComponent(ride.id)}`,
    { ...ride, points: [] },
    ride.points,
    generation,
  );
}

export function deleteRide(id: string): Promise<void> {
  return write(async () => {
    const key = `${RIDE_PREFIX}${encodeURIComponent(id)}`;
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (item) => item === key || item.startsWith(`${key}/points/`),
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
  });
}

const POINTS_PER_CHUNK = 256;
const journalsNeedingCleanup = new Set<string>();
interface PointJournal<T> {
  schema: "point-journal-v1";
  metadata: T;
  generation: string;
  pointCount: number;
}

/** The small draft metadata is committed after its point chunks, like a journal head. */
export async function loadPointJournal<T>(
  key: string,
): Promise<{ metadata: T; points: RidePoint[] | null } | null> {
  const stored = await getValue<PointJournal<T> | T | null>(key, null);
  if (stored === null) return null;
  if (
    typeof stored !== "object" ||
    !("schema" in stored) ||
    stored.schema !== "point-journal-v1"
  ) {
    // Migrate early v1 drafts without discarding a user's existing recording.
    return { metadata: stored as T, points: null };
  }
  const journal = stored as PointJournal<T>;
  if (
    !Number.isSafeInteger(journal.pointCount) ||
    journal.pointCount < 0 ||
    journal.pointCount > 50000
  )
    throw new Error(
      "The recording journal is invalid. Its data has been preserved.",
    );
  const keys = Array.from(
    { length: Math.ceil(journal.pointCount / POINTS_PER_CHUNK) },
    (_, index) =>
      `${PREFIX}${key}/points/${encodeURIComponent(journal.generation)}/${index}`,
  );
  const entries = keys.length ? await AsyncStorage.multiGet(keys) : [];
  const points = entries
    .flatMap(([, raw]) => {
      if (!raw)
        throw new Error(
          "A recording point chunk is missing. The draft has been preserved.",
        );
      const chunk: unknown = JSON.parse(raw);
      if (!Array.isArray(chunk))
        throw new Error(
          "A recording point chunk is invalid. The draft has been preserved.",
        );
      return chunk as RidePoint[];
    })
    .slice(0, journal.pointCount);
  if (points.length !== journal.pointCount)
    throw new Error(
      "The recording journal is incomplete. The draft has been preserved.",
    );
  return { metadata: journal.metadata, points };
}

/** Writes only the current 256-fix tail, never stringifies a whole long ride per fix. */
export function savePointJournal<T>(
  key: string,
  metadata: T,
  points: readonly RidePoint[],
  generation: string,
): Promise<void> {
  return write(async () => {
    const journalKey = `${PREFIX}${key}`;
    const previousRaw = await AsyncStorage.getItem(journalKey);
    const previous = previousRaw
      ? (JSON.parse(previousRaw) as Partial<PointJournal<T>>)
      : null;
    const sameGeneration =
      previous?.schema === "point-journal-v1" &&
      previous.generation === generation &&
      typeof previous.pointCount === "number" &&
      previous.pointCount <= points.length;
    const from = sameGeneration ? previous!.pointCount! : 0;
    const chunkPrefix = `${journalKey}/points/${encodeURIComponent(generation)}/`;
    for (
      let index = Math.floor(from / POINTS_PER_CHUNK);
      index * POINTS_PER_CHUNK < points.length;
      index += 1
    ) {
      if (from === points.length) break;
      const chunk = points.slice(
        index * POINTS_PER_CHUNK,
        (index + 1) * POINTS_PER_CHUNK,
      );
      await AsyncStorage.setItem(
        `${chunkPrefix}${index}`,
        JSON.stringify(chunk),
      );
    }
    const journal: PointJournal<T> = {
      schema: "point-journal-v1",
      metadata,
      generation,
      pointCount: points.length,
    };
    await AsyncStorage.setItem(journalKey, JSON.stringify(journal));
    if (!sameGeneration || journalsNeedingCleanup.has(key)) {
      // Old generations become unreachable only after the new journal head is durable.
      // A cleanup failure must not report an already-committed draft as unsaved.
      // Retry on the next checkpoint, or the next generation after an app restart.
      try {
        const staleKeys = (await AsyncStorage.getAllKeys()).filter(
          (item) =>
            item.startsWith(`${journalKey}/points/`) &&
            !item.startsWith(chunkPrefix),
        );
        if (staleKeys.length) await AsyncStorage.multiRemove(staleKeys);
        journalsNeedingCleanup.delete(key);
      } catch {
        journalsNeedingCleanup.add(key);
      }
    }
  });
}
