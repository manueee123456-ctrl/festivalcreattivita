import { useEffect, useState } from "react";
import { images } from "../images";
import { FINAL_QUOTE } from "../data";
import { playFanfare, playStar } from "../audio";
import { Scene } from "../components/Scene";
import { FloatingBalloons } from "../components/Decor";
import {
  BigButton,
  ColorSwatches,
  ExplorerBadge,
  LevelRibbon,
  Portrait,
  StarRow,
  StoryCard,
} from "../components/UI";
import { cn } from "../utils/cn";

export function VoteScreen({ onSubmit }: { onSubmit: (stars: number) => void }) {
  const [stars, setStars] = useState(0);

  function pick(n: number) {
    setStars(n);
    playStar();
  }

  return (
    <Scene bg={images.paradiseFalls}>
      <LevelRibbon subtitle="Rituale degli Esploratori Esperti" title="Il mio voto al film" />
      <div className="mx-auto mt-6 flex w-full max-w-3xl flex-1 flex-col items-center">
        <StoryCard className="anim-pop w-full text-center">
          <div className="mb-4 flex justify-center gap-3">
            <Portrait who="carl" />
            <Portrait who="russell" />
          </div>
          <h3 className="font-display text-3xl md:text-4xl">Colora da 1 a 5 stelline</h3>
          <p className="mt-2 text-xl md:text-2xl">Quanto ti è piaciuto il film Up?</p>
          <div className="mt-8">
            <StarRow value={stars} onChange={pick} />
          </div>
          <p className="mt-5 font-display text-2xl text-[#8b5a2b]">
            {stars === 0 ? "Tocca le stelline!" : `${stars} stellin${stars === 1 ? "a" : "e"}!`}
          </p>
          <div className="mt-6 flex justify-center">
            <BigButton color="yellow" disabled={stars === 0} onClick={() => onSubmit(stars)}>
              Confermo il mio voto
            </BigButton>
          </div>
        </StoryCard>
      </div>
    </Scene>
  );
}

export function PromiseScreen({
  name,
  onSubmit,
}: {
  name: string;
  onSubmit: (data: { promise: string; fill: string; ring: string; ribbon: string }) => void;
}) {
  const [promise, setPromise] = useState("");
  const [part, setPart] = useState<"fill" | "ring" | "ribbon">("fill");
  const [fill, setFill] = useState("#ffd166");
  const [ring, setRing] = useState("#e63946");
  const [ribbon, setRibbon] = useState("#3a86ff");

  function paint(color: string) {
    if (part === "fill") setFill(color);
    if (part === "ring") setRing(color);
    if (part === "ribbon") setRibbon(color);
  }

  return (
    <Scene bg={images.paradiseFalls}>
      <LevelRibbon subtitle="Rituale degli Esploratori Esperti" title="La Promessa e il Distintivo" />
      <div className="mx-auto mt-4 grid w-full max-w-5xl flex-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <StoryCard>
          <h3 className="font-display text-center text-2xl md:text-3xl">
            Scrivi la tua promessa per quest’anno
          </h3>
          <p className="mt-2 text-center text-lg md:text-xl">
            Esempio: «Prometto di essere gentile con chi è triste» oppure «Prometto di impegnarmi in
            matematica».
          </p>
          <textarea
            value={promise}
            onChange={(e) => setPromise(e.target.value)}
            placeholder="Prometto di..."
            rows={4}
            className="mt-4 w-full resize-none rounded-[1.4rem] border-[5px] border-[#3d1f0a] bg-white px-4 py-4 text-xl md:text-2xl"
          />
        </StoryCard>

        <StoryCard className="flex flex-col items-center">
          <h3 className="font-display text-center text-2xl md:text-3xl">Colora il distintivo</h3>
          <div className="my-3 anim-float-slow">
            <ExplorerBadge fill={fill} ring={ring} ribbon={ribbon} name={name} size={200} />
          </div>
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            {(
              [
                ["fill", "Sfondo"],
                ["ring", "Bordo"],
                ["ribbon", "Nastro"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPart(id)}
                className={cn(
                  "rounded-full border-[4px] border-[#3d1f0a] px-4 py-2 text-lg md:text-xl",
                  part === id ? "bg-[#ffd166]" : "bg-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <ColorSwatches
            selected={part === "fill" ? fill : part === "ring" ? ring : ribbon}
            onPick={paint}
          />
        </StoryCard>
      </div>
      <div className="mt-5 flex justify-center">
        <BigButton
          color="red"
          disabled={promise.trim().length < 8}
          onClick={() => onSubmit({ promise: promise.trim(), fill, ring, ribbon })}
        >
          Consegnami il distintivo!
        </BigButton>
      </div>
    </Scene>
  );
}

export function ConclusionScreen({
  name,
  stars,
  promise,
  fill,
  ring,
  ribbon,
  onRestart,
}: {
  name: string;
  stars: number;
  promise: string;
  fill: string;
  ring: string;
  ribbon: string;
  onRestart: () => void;
}) {
  useEffect(() => {
    playFanfare();
  }, []);

  return (
    <Scene bg={images.celebration}>
      <FloatingBalloons />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-5 py-4">
        <div className="wood-sign anim-pop w-full rounded-[2rem] px-6 py-5 text-center">
          <p className="font-display text-xl text-[#fff1c9] md:text-2xl">Missione compiuta</p>
          <h2 className="font-display text-3xl text-white md:text-5xl">
            Congratulazioni, {name}!
          </h2>
        </div>

        <StoryCard className="anim-pop w-full text-center">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Portrait who="carl" size="lg" />
            <ExplorerBadge fill={fill} ring={ring} ribbon={ribbon} name={name} size={180} />
            <Portrait who="russell" size="lg" />
          </div>
          <p className="font-display mt-5 text-2xl md:text-3xl">
            Avete superato tutte le prove. Siete ora degli «Esploratori Esperti di Quarta».
          </p>
          <p className="mt-4 rounded-[1.4rem] border-[5px] border-[#3d1f0a] bg-[#fff1c9] px-4 py-4 text-xl leading-snug md:text-2xl">
            La tua promessa: «{promise}»
          </p>
          <p className="mt-3 text-2xl">
            Il tuo voto: {"★".repeat(stars)}
            {"☆".repeat(5 - stars)}
          </p>
          <blockquote className="font-display mt-5 text-2xl leading-snug text-[#5c3317] md:text-3xl">
            Ricordate la promessa più importante:
            <br />«{FINAL_QUOTE}»
          </blockquote>
        </StoryCard>

        <BigButton color="yellow" onClick={onRestart}>
          Ricomincia l’avventura
        </BigButton>
      </div>
    </Scene>
  );
}
