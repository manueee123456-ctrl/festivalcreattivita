import { useState } from "react";
import { images } from "../images";
import { CARL_INSIGHT } from "../data";
import { playCorrect } from "../audio";
import { Scene } from "../components/Scene";
import { BigButton, LevelRibbon, Portrait, StoryCard } from "../components/UI";

export function OpenScreen({
  background,
  ribbonSub,
  ribbonTitle,
  question,
  helper,
  placeholder,
  portraits,
  minChars = 8,
  reveal,
  onSubmit,
}: {
  background: string;
  ribbonSub: string;
  ribbonTitle: string;
  question: string;
  helper: string;
  placeholder: string;
  portraits?: Array<"carl" | "russell" | "ellie" | "dug" | "kevin">;
  minChars?: number;
  reveal?: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [showReveal, setShowReveal] = useState(false);

  function send() {
    if (text.trim().length < minChars) return;
    playCorrect();
    if (reveal) {
      setShowReveal(true);
    } else {
      onSubmit(text.trim());
    }
  }

  return (
    <Scene bg={background}>
      <LevelRibbon subtitle={ribbonSub} title={ribbonTitle} />
      <div className="mx-auto mt-5 flex w-full max-w-4xl flex-1 flex-col">
        <StoryCard className="anim-pop">
          {portraits && portraits.length > 0 && (
            <div className="mb-4 flex justify-center gap-3">
              {portraits.map((p) => (
                <Portrait key={p} who={p} />
              ))}
            </div>
          )}
          <p className="mb-2 text-center text-lg text-[#8b5a2b] md:text-xl">{helper}</p>
          <h3 className="font-display text-center text-2xl leading-snug md:text-4xl">{question}</h3>
          {!showReveal ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                rows={5}
                className="mt-5 w-full resize-none rounded-[1.4rem] border-[5px] border-[#3d1f0a] bg-white px-4 py-4 text-xl leading-snug text-[#2b1810] placeholder:text-[#b08968] md:text-2xl"
              />
              <div className="mt-5 flex justify-center">
                <BigButton color="orange" onClick={send} disabled={text.trim().length < minChars}>
                  Ho scritto, avanti!
                </BigButton>
              </div>
            </>
          ) : (
            <div className="mt-5">
              <p className="rounded-[1.4rem] border-[5px] border-[#3d1f0a] bg-[#fff1c9] p-4 text-xl leading-snug md:text-2xl">
                {reveal}
              </p>
              <div className="mt-5 flex justify-center">
                <BigButton color="green" onClick={() => onSubmit(text.trim())}>
                  Ho capito, andiamo!
                </BigButton>
              </div>
            </div>
          )}
        </StoryCard>
      </div>
    </Scene>
  );
}

export function MapQuestion({ onSubmit }: { onSubmit: (text: string) => void }) {
  return (
    <OpenScreen
      background={images.houseFlying}
      ribbonSub="Livello 2 · La Prova della Mappa"
      ribbonTitle="Dove voliamo?"
      portraits={["carl", "russell"]}
      helper="Usa le tue parole, come un vero esploratore."
      question="Dove è diretto il viaggio di Carl e Russell? Com’è questo posto?"
      placeholder="Le Cascate Paradiso sono..."
      onSubmit={onSubmit}
    />
  );
}

export function AdventureQuestion({ onSubmit }: { onSubmit: (text: string) => void }) {
  return (
    <OpenScreen
      background={images.houseFlying}
      ribbonSub="Livello 2 · La Prova dell’Avventura"
      ribbonTitle="Che cosa capisce Carl?"
      portraits={["carl"]}
      helper="Pensa alla fine della storia, al cuore di Carl."
      question="Come si risolve la storia? Che cosa capisce Carl alla fine di tutte le sue avventure?"
      placeholder="Carl capisce che..."
      reveal={CARL_INSIGHT}
      onSubmit={onSubmit}
    />
  );
}

export function ShareQuestion({
  kind,
  onSubmit,
}: {
  kind: "favorite" | "emotion";
  onSubmit: (text: string) => void;
}) {
  const favorite = kind === "favorite";
  return (
    <OpenScreen
      background={images.paradiseFalls}
      ribbonSub="Rituale degli Esploratori Esperti"
      ribbonTitle={favorite ? "La scena più bella" : "La scena più emozionante"}
      portraits={["russell", "ellie"]}
      helper="Dillo anche a voce alta, poi scrivilo qui. Serve a dare voce a tutti."
      question={
        favorite
          ? "Qual è stata la scena che ti è piaciuta di più? Perché?"
          : "Qual è stata la scena che ti ha fatto più emozionare o rattristare?"
      }
      placeholder={favorite ? "La scena che ho amato è..." : "Mi ha emozionato quando..."}
      minChars={6}
      onSubmit={onSubmit}
    />
  );
}
