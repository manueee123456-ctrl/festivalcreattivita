import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./balloon-journey.css";
import { useMotionPreference } from "./MotionPreference";

type Travel = (changeScene: () => void, destination: string) => boolean;
type Phase = "idle" | "departing" | "arriving";
const JourneyContext = createContext<Travel | null>(null);

// The scene changes while the clouds cover it, not when a CSS animation happens
// to finish. This also works in background tabs and with reduced motion enabled.
const DEPARTURE_MS = 800;
const ARRIVAL_MS = 900;

export function useBalloonJourney() {
  const travel = useContext(JourneyContext);
  if (!travel) throw new Error("BalloonJourney must wrap the adventure");
  return travel;
}

export function BalloonJourney({ children }: { children: ReactNode }) {
  const { reduced } = useMotionPreference();
  const [flight, setFlight] = useState({
    phase: "idle" as Phase,
    destination: "",
    id: 0,
  });
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const screen = useRef<HTMLDivElement>(null);
  const hasTravelled = useRef(false);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    busy.current = false;
  }, []);

  const travel = useCallback<Travel>((changeScene, destination) => {
    // A synchronous guard also catches double taps before React re-renders.
    if (busy.current) return false;
    busy.current = true;
    hasTravelled.current = true;
    const departure = reduced ? 80 : DEPARTURE_MS;
    const arrival = reduced ? 100 : ARRIVAL_MS;

    setFlight((previous) => ({
      phase: "departing",
      destination,
      id: previous.id + 1,
    }));

    timers.current = [
      window.setTimeout(() => {
        changeScene();
        window.scrollTo({ top: 0, behavior: "instant" });
        setFlight((previous) => ({ ...previous, phase: "arriving" }));
      }, departure),
      window.setTimeout(() => {
        busy.current = false;
        timers.current = [];
        setFlight((previous) => ({ ...previous, phase: "idle" }));
      }, departure + arrival),
    ];
    return true;
  }, [reduced]);

  useEffect(() => {
    if (flight.phase !== "idle" || !hasTravelled.current) return;
    // Return keyboard/screen-reader users to the new question after unlocking it.
    const heading = screen.current?.querySelector<HTMLElement>("h3")
      ?? screen.current?.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [flight.phase]);

  const travelling = flight.phase !== "idle";
  const timing = {
    "--journey-departure": `${DEPARTURE_MS}ms`,
    "--journey-arrival": `${ARRIVAL_MS}ms`,
    "--journey-duration": `${DEPARTURE_MS + ARRIVAL_MS}ms`,
  } as CSSProperties;

  return (
    <JourneyContext.Provider value={travel}>
      <div className={`balloon-journey${reduced ? " journey-reduced" : ""}`} data-motion={reduced ? "reduced" : "full"} style={timing}>
        <div
          ref={screen}
          className="journey-screen"
          data-phase={flight.phase}
          inert={travelling}
          aria-busy={travelling}
        >
          {children}
        </div>
        {travelling && <FlightLayer key={flight.id} destination={flight.destination} />}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {travelling ? flight.destination : ""}
        </p>
      </div>
    </JourneyContext.Provider>
  );
}

const sideBalloons = [
  { color: "#e63946", left: 5, size: 88, drift: -45, delay: 0, tilt: -14 },
  { color: "#ffd166", left: 20, size: 58, drift: 30, delay: 130, tilt: 9 },
  { color: "#3a86ff", left: 88, size: 100, drift: 45, delay: 50, tilt: 12 },
  { color: "#9b5de5", left: 74, size: 66, drift: -35, delay: 180, tilt: -8 },
  { color: "#ff6b9d", left: 97, size: 52, drift: -30, delay: 260, tilt: 16 },
  { color: "#2a9d8f", left: 35, size: 42, drift: -50, delay: 80, tilt: -10 },
  { color: "#f77f00", left: 59, size: 46, drift: 65, delay: 230, tilt: 10 },
  { color: "#ffd166", left: 2, size: 48, drift: 35, delay: 310, tilt: 8 },
];

const bouquet = [
  { x: 83, y: 136, rx: 42, color: "#2a9d8f", tilt: -23 },
  { x: 305, y: 135, rx: 45, color: "#3a86ff", tilt: 22 },
  { x: 124, y: 84, rx: 48, color: "#e63946", tilt: -15 },
  { x: 268, y: 77, rx: 47, color: "#9b5de5", tilt: 14 },
  { x: 195, y: 64, rx: 48, color: "#ffd166", tilt: 0 },
  { x: 161, y: 153, rx: 48, color: "#ff6b9d", tilt: -8 },
  { x: 240, y: 160, rx: 46, color: "#f77f00", tilt: 10 },
];

function FlightLayer({ destination }: { destination: string }) {
  return (
    <div className="journey-flight" aria-hidden="true">
      <div className="journey-sky" />
      <svg className="journey-cloud journey-cloud-far" viewBox="0 0 1200 400" preserveAspectRatio="none">
        <path fill="#e9f8ff" d="M0 170C20 100 75 80 135 105C160 25 265 25 300 110C350 85 425 105 440 165C460 95 540 70 595 105C620 25 725 25 765 115C825 80 905 100 925 160C960 65 1065 55 1105 135C1155 90 1200 120 1200 170V400H0Z" />
      </svg>
      <svg className="journey-cloud journey-cloud-near" viewBox="0 0 1200 400" preserveAspectRatio="none">
        <path fill="#fff" d="M0 175C5 115 65 90 110 115C145 25 250 25 280 120C335 90 390 120 400 175C425 105 480 90 525 115C555 25 665 25 700 120C755 90 815 120 825 175C855 85 950 75 990 130C1025 30 1140 30 1170 130C1200 110 1220 145 1200 175V400H0Z" />
      </svg>

      {sideBalloons.map((balloon, i) => (
        <div
          className={`journey-free-balloon${balloon.left > 30 && balloon.left < 70 ? " journey-balloon-back" : ""}`}
          key={i}
          style={{
            "--balloon-color": balloon.color,
            "--drift": `${balloon.drift}px`,
            "--tilt": `${balloon.tilt}deg`,
            "--delay": `${balloon.delay}ms`,
            "--balloon-size": `${balloon.size}px`,
            left: `${balloon.left}%`,
          } as CSSProperties}
        >
          <div className="journey-balloon-body" />
          <svg className="journey-string" viewBox="0 0 50 100">
            <path d="M25 0C5 28 46 55 25 100" fill="none" stroke="#5c3317" strokeWidth="1.6" />
          </svg>
        </div>
      ))}

      {Array.from({ length: 14 }, (_, i) => (
        <span
          className="journey-sparkle"
          key={i}
          style={{
            left: `${7 + (i * 29) % 88}%`,
            top: `${25 + (i * 17) % 60}%`,
            "--delay": `${(i % 5) * 70}ms`,
            "--star-size": `${10 + (i % 3) * 5}px`,
          } as CSSProperties}
        />
      ))}

      <div className="journey-carrier">
        <div className="journey-carrier-flight">
          <svg className="journey-bouquet" viewBox="0 0 400 335">
            <g fill="none" stroke="#5c3317" strokeWidth="1.5" opacity=".65">
              {bouquet.map((balloon, i) => {
                const angle = balloon.tilt * Math.PI / 180;
                const knot = balloon.rx * 1.15 + 10;
                const x = balloon.x - Math.sin(angle) * knot;
                const y = balloon.y + Math.cos(angle) * knot;
                return <path key={i} d={`M${x} ${y} Q${x} 270 ${i % 2 ? 264 : 136} 337`} />;
              })}
            </g>
            {bouquet.map((balloon, i) => (
              <g key={i} transform={`translate(${balloon.x} ${balloon.y}) rotate(${balloon.tilt})`}>
                <ellipse cx="3" cy="5" rx={balloon.rx} ry={balloon.rx * 1.19} fill="#3d1f0a" opacity=".12" />
                <ellipse rx={balloon.rx} ry={balloon.rx * 1.19} fill={balloon.color} stroke="#3d1f0a" strokeWidth="2.3" />
                <path d={`M${balloon.rx * .66} ${-balloon.rx * .56} Q${balloon.rx * 1.15} ${balloon.rx * .56} 0 ${balloon.rx * 1.12} Q${balloon.rx * 1.4} ${balloon.rx * .5} ${balloon.rx * .66} ${-balloon.rx * .56}`} fill="#3d1f0a" opacity=".14" />
                <ellipse cx={-balloon.rx * .35} cy={-balloon.rx * .48} rx={balloon.rx * .17} ry={balloon.rx * .34} fill="white" opacity=".5" transform="rotate(25)" />
                <circle cx={-balloon.rx * .47} cy={balloon.rx * .1} r="3" fill="white" opacity=".38" />
                <path d={`M0 ${balloon.rx * 1.15}l-6 10h12Z`} fill={balloon.color} stroke="#3d1f0a" strokeWidth="1.5" strokeLinejoin="round" />
              </g>
            ))}
          </svg>
          <div className="journey-ticket">
            <span className="journey-ticket-eyebrow">✦ Si vola! ✦</span>
            <span className="journey-ticket-title">{destination}</span>
            <span className="journey-ticket-trail">Un palloncino, una nuova avventura</span>
          </div>
        </div>
      </div>
    </div>
  );
}
