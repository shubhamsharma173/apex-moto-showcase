import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { AppState } from "react-native";
import { Ride } from "../domain/ride";
import {
  initialPreferences,
  migratePreferences,
  Preferences,
} from "../domain/preferences";
import {
  getValue,
  setValue,
  loadRides,
  saveRide,
  deleteRide,
} from "../services/storage";
import { subscribeRecording } from "../services/recording";
export type { Preferences, Vehicle } from "../domain/preferences";
interface Context {
  prefs: Preferences;
  rides: Ride[];
  realRides: Ride[];
  ready: boolean;
  toast: string | null;
  notify: (s: string) => void;
  dismissToast: () => void;
  updatePrefs: (p: Partial<Preferences>) => Promise<void>;
  updateRide: (ride: Ride) => Promise<void>;
  removeRide: (id: string) => Promise<void>;
  refreshRides: () => Promise<void>;
  busy: boolean;
}
const ctx = createContext<Context>(null!);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState(initialPreferences),
    [realRides, setRides] = useState<Ride[]>([]),
    [ready, setReady] = useState(false),
    [toast, setToast] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const prefRef = useRef(prefs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefQueue = useRef<Promise<void>>(Promise.resolve());
  const notify = useCallback((s: string) => {
    setToast(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);
  const refreshRides = useCallback(async () => {
    try {
      setRides((await loadRides()).filter((ride) => ride.source !== "demo"));
    } catch (e) {
      notify((e as Error).message);
    }
  }, [notify]);
  useEffect(() => {
    let previous = "idle";
    return subscribeRecording((s) => {
      if (previous === "recording" && s.status === "armed") {
        void refreshRides();
        notify(
          "Automatic capture finished. Check your logbook; very short trips are discarded.",
        );
      }
      previous = s.status;
    });
  }, [refreshRides, notify]);
  useEffect(() => {
    let alive = true;
    Promise.all([
      getValue<Partial<Preferences>>("preferences", {}),
      loadRides(),
    ])
      .then(([p, r]) => {
        if (!alive) return;
        const next = migratePreferences(p, r);
        prefRef.current = next;
        setPrefs(next);
        setRides(r.filter((ride) => ride.source !== "demo"));
      })
      .catch((e) => notify(e.message))
      .finally(() => {
        if (alive) setReady(true);
      });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshRides();
    });
    return () => {
      alive = false;
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notify, refreshRides]);
  const updatePrefs = useCallback((p: Partial<Preferences>) => {
    const task = prefQueue.current.then(async () => {
      const next = { ...prefRef.current, ...p };
      await setValue("preferences", next);
      prefRef.current = next;
      setPrefs(next);
    });
    prefQueue.current = task.catch(() => {});
    return task;
  }, []);
  const updateRide = useCallback(
    async (ride: Ride) => {
      setBusy(true);
      try {
        await saveRide(ride);
        await refreshRides();
      } finally {
        setBusy(false);
      }
    },
    [refreshRides],
  );
  const removeRide = useCallback(
    async (id: string) => {
      await deleteRide(id);
      await refreshRides();
    },
    [refreshRides],
  );
  return (
    <ctx.Provider
      value={{
        prefs,
        rides: realRides,
        realRides,
        ready,
        toast,
        notify,
        dismissToast,
        updatePrefs,
        updateRide,
        removeRide,
        refreshRides,
        busy,
      }}
    >
      {children}
    </ctx.Provider>
  );
}
export const useApp = () => useContext(ctx);
