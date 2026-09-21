import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { images } from "../images";
import { badgeColors } from "../data";

export function BigButton({
  children,
  onClick,
  color = "red",
  disabled = false,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: "red" | "yellow" | "green" | "blue" | "orange" | "cream";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const tones: Record<string, string> = {
    red: "bg-[#e63946] text-white",
    yellow: "bg-[#ffd166] text-[#2b1810]",
    green: "bg-[#2a9d8f] text-white",
    blue: "bg-[#3a86ff] text-white",
    orange: "bg-[#f77f00] text-white",
    cream: "bg-[#fff6dc] text-[#2b1810]",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "pressable font-display rounded-[2rem] border-[5px] border-[#3d1f0a] px-8 py-5 text-2xl font-semibold leading-tight md:text-3xl",
        tones[color],
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StoryCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("story-card rounded-[2.2rem] p-5 md:p-8", className)}>{children}</div>
  );
}

const portraitSrc = {
  carl: images.carl,
  russell: images.russell,
  ellie: images.ellie,
  dug: images.dug,
  kevin: images.kevin,
};

const portraitAlt = {
  carl: "Carl Fredricksen",
  russell: "Russell",
  ellie: "Ellie da bambina",
  dug: "Dug il cane",
  kevin: "Kevin l’uccello",
};

export function Portrait({
  who,
  size = "md",
}: {
  who: keyof typeof portraitSrc;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "h-36 w-36 md:h-44 md:w-44" : size === "sm" ? "h-20 w-20" : "h-28 w-28 md:h-32 md:w-32";
  return (
    <img
      src={portraitSrc[who]}
      alt={portraitAlt[who]}
      className={cn(
        dim,
        "rounded-full border-[5px] border-[#3d1f0a] object-cover shadow-[0_6px_0_#3d1f0a]",
      )}
    />
  );
}

export function BalloonMeter({ filled }: { filled: number }) {
  const colors = ["#e63946", "#ffd166", "#3a86ff", "#f77f00", "#9b5de5"];
  return (
    <div className="flex items-end justify-center gap-2" aria-label={`${filled} palloncini su 5`}>
      {colors.map((c, i) => (
        <div key={c} className="flex flex-col items-center">
          <div
            className={cn("relative", i === filled - 1 && "anim-inflate")}
            style={{ width: 48, height: 58 }}
          >
            <div
              className="balloon h-full w-full"
              style={{
                background: i < filled ? c : "rgba(255,255,255,0.35)",
                border: i < filled ? "none" : "3px dashed #3d1f0a",
                boxShadow: i < filled ? undefined : "none",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LevelRibbon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="wood-sign mx-auto max-w-3xl rounded-[1.6rem] px-6 py-3 text-center">
      <p className="font-display text-lg font-semibold text-[#fff6dc] md:text-xl">{subtitle}</p>
      <h2 className="font-display text-3xl font-semibold leading-tight text-white md:text-4xl">{title}</h2>
    </div>
  );
}

export function ExplorerBadge({
  fill = "#ffd166",
  ring = "#e63946",
  ribbon = "#3a86ff",
  name = "Esploratore",
  size = 220,
}: {
  fill?: string;
  ring?: string;
  ribbon?: string;
  name?: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 220 260" width={size} height={size * 1.18} role="img" aria-label="Distintivo di Esploratore Esperto">
      <defs>
        <filter id="badgeShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter="url(#badgeShadow)">
        <path d="M70 188 L110 248 L150 188 Z" fill={ribbon} stroke="#3d1f0a" strokeWidth="5" />
        <path d="M90 198 L110 228 L130 198 Z" fill="#fff6dc" stroke="#3d1f0a" strokeWidth="3" />
        <circle cx="110" cy="110" r="100" fill={ring} stroke="#3d1f0a" strokeWidth="6" />
        <circle cx="110" cy="110" r="78" fill={fill} stroke="#3d1f0a" strokeWidth="5" />
        <circle cx="110" cy="110" r="68" fill="none" stroke="#3d1f0a" strokeWidth="2" strokeDasharray="6 6" />
        <g transform="translate(70,58)">
          <ellipse cx="40" cy="22" rx="16" ry="20" fill="#e63946" stroke="#3d1f0a" strokeWidth="3" />
          <ellipse cx="58" cy="18" rx="14" ry="18" fill="#3a86ff" stroke="#3d1f0a" strokeWidth="3" />
          <ellipse cx="24" cy="18" rx="13" ry="17" fill="#ffd166" stroke="#3d1f0a" strokeWidth="3" />
          <rect x="28" y="48" width="28" height="22" rx="3" fill="#f4d35e" stroke="#3d1f0a" strokeWidth="3" />
          <rect x="38" y="58" width="8" height="10" fill="#3d1f0a" />
          <line x1="40" y1="42" x2="40" y2="48" stroke="#3d1f0a" strokeWidth="2" />
          <line x1="58" y1="36" x2="44" y2="48" stroke="#3d1f0a" strokeWidth="2" />
          <line x1="24" y1="35" x2="36" y2="48" stroke="#3d1f0a" strokeWidth="2" />
        </g>
        <path d="M40 148 Q110 178 180 148" fill="none" stroke="#3d1f0a" strokeWidth="3" />
      </g>
      <text
        x="110"
        y="168"
        textAnchor="middle"
        fontFamily="Fredoka, Nunito, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="#3d1f0a"
      >
        ESPLORATORE ESPERTO
      </text>
      <text
        x="110"
        y="182"
        textAnchor="middle"
        fontFamily="Fredoka, Nunito, sans-serif"
        fontSize="13"
        fontWeight="700"
        fill="#3d1f0a"
      >
        {name.slice(0, 16).toUpperCase()}
      </text>
    </svg>
  );
}

export function ColorSwatches({
  onPick,
  selected,
}: {
  onPick: (value: string) => void;
  selected?: string;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {badgeColors.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={c.label}
          onClick={() => onPick(c.value)}
          className={cn(
            "h-16 w-16 rounded-full border-[5px] border-[#3d1f0a] pressable md:h-20 md:w-20",
            selected === c.value && "ring-4 ring-offset-2 ring-[#2b1810]",
          )}
          style={{ background: c.value }}
        />
      ))}
    </div>
  );
}

export function StarRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex justify-center gap-2 md:gap-4" role="radiogroup" aria-label="Voto da 1 a 5 stelline">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} stellin${n === 1 ? "a" : "e"}`}
          onClick={() => onChange(n)}
          className={cn(
            "pressable flex h-16 w-16 items-center justify-center rounded-2xl border-[5px] border-[#3d1f0a] text-4xl md:h-20 md:w-20 md:text-5xl",
            n <= value ? "bg-[#ffd166]" : "bg-[#fff6dc]",
          )}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}
