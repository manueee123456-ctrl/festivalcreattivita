const BALLOONS: Array<{
  color: string;
  left: string;
  top: string;
  size: number;
  delay: string;
  duration: string;
}> = [
  { color: "#e63946", left: "3%", top: "8%", size: 54, delay: "0s", duration: "4.2s" },
  { color: "#ffd166", left: "12%", top: "22%", size: 40, delay: "0.4s", duration: "5s" },
  { color: "#3a86ff", left: "88%", top: "10%", size: 58, delay: "0.2s", duration: "4.6s" },
  { color: "#9b5de5", left: "78%", top: "28%", size: 36, delay: "0.8s", duration: "5.4s" },
  { color: "#ff6b9d", left: "94%", top: "40%", size: 44, delay: "0.1s", duration: "4.8s" },
  { color: "#f77f00", left: "6%", top: "48%", size: 32, delay: "1s", duration: "5.2s" },
  { color: "#2a9d8f", left: "84%", top: "62%", size: 38, delay: "0.6s", duration: "4.4s" },
  { color: "#e63946", left: "18%", top: "70%", size: 28, delay: "1.2s", duration: "5.6s" },
];

export function CssBalloon({
  color,
  size = 48,
  className = "",
  inflate = false,
}: {
  color: string;
  size?: number;
  className?: string;
  inflate?: boolean;
}) {
  return (
    <div
      className={`relative ${inflate ? "anim-inflate" : ""} ${className}`}
      style={{ width: size, height: size * 1.2 }}
    >
      <div className="balloon h-full w-full" style={{ background: color }} />
      <span className="balloon-string" />
    </div>
  );
}

export function FloatingBalloons() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {BALLOONS.map((b, i) => (
        <div
          key={i}
          className="absolute anim-float"
          style={{
            left: b.left,
            top: b.top,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        >
          <CssBalloon color={b.color} size={b.size} />
        </div>
      ))}
    </div>
  );
}

export function BurstBalloons() {
  const bits = [
    { color: "#e63946", x: -40 },
    { color: "#ffd166", x: -10 },
    { color: "#3a86ff", x: 20 },
    { color: "#9b5de5", x: 50 },
    { color: "#ff6b9d", x: -60 },
    { color: "#f77f00", x: 70 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <div
          key={i}
          className="absolute bottom-1/3 left-1/2 anim-burst"
          style={{ marginLeft: b.x, animationDelay: `${i * 0.05}s` }}
        >
          <CssBalloon color={b.color} size={22} />
        </div>
      ))}
    </div>
  );
}

export function CloudBand() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden opacity-80" aria-hidden>
      <svg className="h-full w-[200%] anim-float-slow" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path
          fill="rgba(255,255,255,0.85)"
          d="M0,80 C80,80 80,40 160,40 C220,40 230,70 300,70 C360,70 370,30 460,30 C560,30 560,75 650,75 C720,75 740,35 820,35 C900,35 910,80 1000,80 C1080,80 1100,50 1200,50 L1200,120 L0,120 Z"
        />
      </svg>
    </div>
  );
}
