import { useEffect, useRef, useState } from "react";
import { images } from "../images";
import { correctMessages, level1Questions, wrongMessages } from "../data";
import { playCorrect, playPop, playWrong } from "../audio";
import { Scene } from "../components/Scene";
import { BalloonMeter, LevelRibbon, Portrait, StoryCard } from "../components/UI";
import { cn } from "../utils/cn";

export function Level1Screen({
  questionIndex,
  balloons,
  onCorrect,
}: {
  questionIndex: number;
  balloons: number;
  onCorrect: () => void;
}) {
  const q = level1Questions[questionIndex];
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "wrong" | "right">("idle");
  const busy = useRef(false);
  const feedbackTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setPicked(null);
    setStatus("idle");
    busy.current = false;
    return () => window.clearTimeout(feedbackTimer.current);
  }, [questionIndex]);

  function choose(id: "A" | "B" | "C", correct: boolean) {
    if (busy.current || status === "right") return;
    setPicked(id);
    if (correct) {
      busy.current = true;
      playCorrect();
      playPop();
      setStatus("right");
      // Keep the answer readable, then let the balloon journey carry it away.
      feedbackTimer.current = window.setTimeout(onCorrect, 780);
    } else {
      busy.current = true;
      playWrong();
      setStatus("wrong");
      feedbackTimer.current = window.setTimeout(() => {
        busy.current = false;
        setStatus("idle");
        setPicked(null);
      }, 1100);
    }
  }

  return (
    <Scene bg={images.houseGround}>
      <LevelRibbon subtitle="Livello 1" title="Il Portale dei Ricordi" />
      <div className="mt-4">
        <BalloonMeter filled={status === "right" ? balloons + 1 : balloons} />
        <p className="mt-2 text-center text-lg text-white drop-shadow-[0_2px_0_#3d1f0a] md:text-xl">
          Palloncini: {status === "right" ? balloons + 1 : balloons} su 5 — ogni risposta giusta ne
          gonfia uno!
        </p>
      </div>

      <div className="mx-auto mt-5 flex w-full max-w-4xl flex-1 flex-col">
        <StoryCard className={cn("anim-pop", status === "wrong" && "anim-shake")}>
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
            {q.portraits.map((p) => (
              <Portrait key={p} who={p} />
            ))}
          </div>
          <p className="mb-2 text-center text-lg text-[#8b5a2b] md:text-xl">{q.helper}</p>
          <h3 className="font-display text-center text-2xl leading-snug text-[#2b1810] md:text-4xl">
            {q.question}
          </h3>

          <div className="mt-6 flex flex-col gap-3">
            {q.options.map((opt) => {
              const isPicked = picked === opt.id;
              const showRight = status === "right" && opt.correct;
              const showWrong = status === "wrong" && isPicked;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => choose(opt.id, opt.correct)}
                  disabled={status !== "idle"}
                  aria-pressed={isPicked}
                  className={cn(
                    "pressable flex min-h-[72px] items-center gap-4 rounded-[1.6rem] border-[5px] border-[#3d1f0a] px-4 py-5 text-left text-xl md:min-h-[84px] md:px-5 md:text-2xl",
                    showRight && "bg-[#2a9d8f] text-white",
                    showWrong && "bg-[#e63946] text-white",
                    !showRight && !showWrong && "bg-white text-[#2b1810]",
                  )}
                >
                  <span className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[4px] border-[#3d1f0a] bg-[#ffd166] text-2xl text-[#2b1810]">
                    {opt.id}
                  </span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>

          <div role="status" aria-live="polite" aria-atomic="true">
            {status === "right" && (
              <p className="font-display mt-5 text-center text-2xl text-[#2a9d8f] md:text-3xl">
                {correctMessages[questionIndex]}
              </p>
            )}
            {status === "wrong" && (
              <p className="font-display mt-5 text-center text-2xl text-[#e63946] md:text-3xl">
                {wrongMessages[questionIndex % wrongMessages.length]}
              </p>
            )}
          </div>
        </StoryCard>

        <div className="mt-4 flex items-center justify-center gap-3">
          <Portrait who="russell" size="sm" />
          <p className="story-card max-w-md rounded-[1.4rem] px-4 py-3 text-lg md:text-xl">
            Russell dice: «Tocca la risposta giusta, esploratore!»
          </p>
        </div>
      </div>
    </Scene>
  );
}
