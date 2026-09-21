import { useState } from "react";
import { images } from "../images";
import { INTRO_TEXT } from "../data";
import { Scene } from "../components/Scene";
import { FloatingBalloons } from "../components/Decor";
import { BigButton, Portrait, StoryCard } from "../components/UI";
import { unlockAudio } from "../audio";

export function IntroScreen({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <Scene bg={images.houseGround}>
      <FloatingBalloons />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
        <div className="wood-sign anim-pop w-full max-w-4xl rounded-[2rem] px-6 py-5 text-center md:px-10">
          <p className="font-display text-xl font-semibold text-[#fff1c9] md:text-2xl">
            Operazione Esploratori Esperti
          </p>
          <h1 className="font-display mt-1 text-4xl font-semibold leading-tight text-white md:text-6xl">
            In Viaggio verso la Quarta
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Portrait who="carl" size="sm" />
          <Portrait who="russell" size="sm" />
          <Portrait who="ellie" size="sm" />
          <Portrait who="dug" size="sm" />
          <Portrait who="kevin" size="sm" />
        </div>

        <StoryCard className="anim-pop w-full max-w-3xl">
          <p className="text-center text-xl leading-snug text-[#2b1810] md:text-2xl">
            {INTRO_TEXT}
          </p>
        </StoryCard>

        <label className="flex w-full max-w-xl flex-col gap-2 text-center">
          <span className="font-display text-2xl text-white drop-shadow-[0_2px_0_#3d1f0a] md:text-3xl">
            Come ti chiami, esploratore?
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Il tuo nome"
            maxLength={18}
            autoComplete="off"
            autoCapitalize="words"
            className="story-card rounded-[1.6rem] border-[5px] px-5 py-4 text-center text-2xl text-[#2b1810] placeholder:text-[#8b5a2b] md:text-3xl"
          />
        </label>

        <BigButton
          color="red"
          className="anim-pulse mt-2"
          onClick={() => {
            unlockAudio();
            onStart(name.trim() || "Esploratore");
          }}
        >
          Allacciate i vostri palloncini!
        </BigButton>
      </div>
    </Scene>
  );
}
