import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Preference = "system" | "full" | "reduced";
type MotionSettings = {
  preference: Preference;
  reduced: boolean;
  setPreference: (preference: Preference) => void;
};
const STORAGE_KEY = "viaggio-quarta:motion";
const QUERY = "(prefers-reduced-motion: reduce)";
const MotionContext = createContext<MotionSettings | null>(null);

function subscribe(listener: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function savedPreference(): Preference {
  // Storage may be unavailable for file:// documents or embedded previews.
  // It is optional: the switch must still work without it.
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "full" || value === "reduced") return value;
  } catch { /* Keep the system preference; never block the adventure. */ }
  return "system";
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const systemReduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  const [preference, updatePreference] = useState<Preference>(savedPreference);
  const setPreference = useCallback((value: Preference) => {
    updatePreference(value);
    try {
      if (value === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, value);
    } catch { /* A local file can always keep this choice in memory. */ }
  }, []);
  const reduced = preference === "system" ? systemReduced : preference === "reduced";
  const settings = useMemo(() => ({ preference, reduced, setPreference }), [preference, reduced, setPreference]);

  return <MotionContext.Provider value={settings}>{children}</MotionContext.Provider>;
}

export function useMotionPreference() {
  const settings = useContext(MotionContext);
  if (!settings) throw new Error("MotionProvider must wrap the adventure");
  return settings;
}

export function MotionControl() {
  const { preference, reduced, setPreference } = useMotionPreference();
  return (
    <div className="motion-control">
      <button
        type="button"
        role="switch"
        aria-label="Animazioni con palloncini"
        aria-checked={!reduced}
        aria-describedby={reduced ? "motion-help" : undefined}
        className="motion-toggle"
        onClick={() => setPreference(reduced ? "full" : "reduced")}
      >
        <span aria-hidden="true">🎈</span>
        <span>{reduced ? "Attiva i palloncini" : "Palloncini attivi"}</span>
        <span className="motion-toggle-track" aria-hidden="true"><span /></span>
      </button>
      {reduced && (
        <p id="motion-help" className="motion-help">
          {preference === "system"
            ? "Il dispositivo richiede meno movimento. Puoi attivare il volo da qui."
            : "Movimento ridotto: le domande cambiano senza il volo."}
        </p>
      )}
      {preference !== "system" && (
        <button type="button" className="motion-reset" onClick={() => setPreference("system")}>
          Usa impostazioni del dispositivo
        </button>
      )}
    </div>
  );
}
