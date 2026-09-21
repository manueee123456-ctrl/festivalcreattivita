import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { images } from "../images";
import { sortItemColors, sortItems, type SortItem } from "../data";
import { playCorrect, playWrong } from "../audio";
import { Scene } from "../components/Scene";
import { CssBalloon } from "../components/Decor";
import { BigButton, LevelRibbon, StoryCard } from "../components/UI";
import { cn } from "../utils/cn";

type Zone = "sack" | "balloons";
type Place = Zone | "pool";

export function SortScreen({ onDone }: { onDone: () => void }) {
  const shuffled = useMemo(() => [...sortItems].sort(() => Math.random() - 0.5), []);
  const [place, setPlace] = useState<Record<string, Place>>(
    Object.fromEntries(sortItems.map((i) => [i.id, "pool"])),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("Tocca una carta e poi tocca il sacco o i palloncini.");
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);

  const inZone = (zone: Place) => shuffled.filter((i) => place[i.id] === zone);

  function move(id: string, zone: Zone) {
    if (locked) return;
    setPlace((p) => ({ ...p, [id]: zone }));
    setSelected(null);
    setMessage("Bene! Continua a smistare.");
  }

  function onItemClick(id: string) {
    if (locked) return;
    setSelected((s) => {
      const next = s === id ? null : id;
      if (next) setMessage("Ora tocca il sacco (i pesi) oppure i palloncini (gli aiuti)!");
      return next;
    });
  }

  function onZoneClick(zone: Zone) {
    if (selected) move(selected, zone);
  }

  function onDrop(zone: Zone, e: DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) move(id, zone);
  }

  useEffect(() => {
    if (locked) return;
    const remaining = shuffled.filter((i) => place[i.id] === "pool");
    if (remaining.length > 0) return;
    const t = window.setTimeout(() => check(), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, locked]);

  function check() {
    if (lockedRef.current) return;
    const remaining = inZone("pool");
    if (remaining.length > 0) {
      setMessage("Metti tutte le carte nel sacco o nei palloncini!");
      return;
    }
    const wrong = shuffled.filter((i) => place[i.id] !== i.zone);
    if (wrong.length > 0) {
      playWrong();
      setMessage("Qualche cosa non è nel posto giusto. Quelle carte tornano al centro: riprova!");
      setPlace((p) => {
        const n = { ...p };
        wrong.forEach((w) => {
          n[w.id] = "pool";
        });
        return n;
      });
      return;
    }
    playCorrect();
    lockedRef.current = true;
    setLocked(true);
    setMessage("Perfetto! I pesi restano a terra e gli aiuti ci faranno volare.");
    window.setTimeout(onDone, 2200);
  }

  return (
    <Scene bg={images.houseFlying}>
      <LevelRibbon subtitle="Livello 2 · Le Cascate Paradiso" title="La Prova dei Pesi" />
      <StoryCard className="mx-auto mt-4 w-full max-w-4xl">
        <p className="text-center text-xl leading-snug md:text-2xl">
          La casa di Carl è come il nostro cuore. Per spiccare il volo, bisogna lasciare andare i
          pesi e tenere gli aiuti. {message}
        </p>
      </StoryCard>

      <div className="mt-4 grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <DropZone
          title="Sacco — cose da lasciare"
          subtitle="NON voglio portare in Quarta"
          tone="sack"
          onClick={() => onZoneClick("sack")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop("sack", e)}
          active={!!selected}
        >
          {inZone("sack").map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              selected={selected === item.id}
              compact
              onClick={() => onItemClick(item.id)}
            />
          ))}
        </DropZone>

        <DropZone
          title="Palloncini — cose da tenere"
          subtitle="Mi aiuteranno a volare quest’anno"
          tone="balloons"
          onClick={() => onZoneClick("balloons")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop("balloons", e)}
          active={!!selected}
        >
          {inZone("balloons").map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              selected={selected === item.id}
              compact
              onClick={() => onItemClick(item.id)}
            />
          ))}
        </DropZone>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {inZone("pool").map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            selected={selected === item.id}
            onClick={() => onItemClick(item.id)}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-center">
        <BigButton color="green" onClick={check} disabled={locked}>
          Controlla lo smistamento
        </BigButton>
      </div>
    </Scene>
  );
}

function DropZone({
  title,
  subtitle,
  tone,
  children,
  onClick,
  onDragOver,
  onDrop,
  active,
}: {
  title: string;
  subtitle: string;
  tone: Zone;
  children: ReactNode;
  onClick: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  active: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "story-card min-h-[220px] cursor-pointer rounded-[2rem] p-4 text-left",
        active && "ring-4 ring-[#ffd166] ring-offset-2",
        tone === "sack" ? "bg-[#f4e1c1]" : "bg-[#d9f0ff]",
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        {tone === "sack" ? (
          <span className="text-5xl" aria-hidden>
            👜
          </span>
        ) : (
          <div className="flex -space-x-3">
            <CssBalloon color="#e63946" size={28} />
            <CssBalloon color="#ffd166" size={28} />
            <CssBalloon color="#3a86ff" size={28} />
          </div>
        )}
        <div>
          <p className="font-display text-2xl leading-tight md:text-3xl">{title}</p>
          <p className="text-lg text-[#5c3317] md:text-xl">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
      {active && (
        <p className="font-display mt-3 text-center text-xl text-[#5c3317] md:text-2xl">
          Tocca qui per metterla!
        </p>
      )}
    </div>
  );
}

function ItemCard({
  item,
  selected,
  onClick,
  compact = false,
}: {
  item: SortItem;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pressable rounded-[1.3rem] border-[4px] border-[#3d1f0a] px-3 py-3 text-left text-lg leading-tight md:text-xl",
        compact ? "max-w-full" : "min-w-[220px] max-w-sm",
        selected && "ring-4 ring-[#f77f00] ring-offset-2",
      )}
      style={{ background: sortItemColors[item.id] }}
    >
      <span className="mr-2 text-2xl">{item.emoji}</span>
      {item.text}
    </button>
  );
}
