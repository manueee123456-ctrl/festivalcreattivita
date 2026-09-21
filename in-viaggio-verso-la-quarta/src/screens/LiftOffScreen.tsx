import { useEffect } from "react";
import { images } from "../images";
import { playWhoosh } from "../audio";
import { Scene } from "../components/Scene";
import { CssBalloon, FloatingBalloons } from "../components/Decor";
import { BigButton, LevelRibbon, Portrait } from "../components/UI";

export function LiftOffScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    playWhoosh();
    const t = window.setTimeout(onDone, 5200);
    return () => window.clearTimeout(t);
    // Avvia il decollo una sola volta all'ingresso della schermata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Scene bg={images.cloudsSky}>
      <FloatingBalloons />
      <LevelRibbon subtitle="Decollo!" title="La casa si alza in volo" />
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <div className="anim-lift relative mx-auto w-full max-w-3xl">
          <img
            src={images.houseFlying}
            alt="La casetta gialla sollevata dai palloncini"
            className="w-full rounded-[2rem] border-[6px] border-[#3d1f0a] shadow-[0_12px_0_#3d1f0a]"
          />
          <div className="absolute -top-8 left-8">
            <CssBalloon color="#e63946" size={46} inflate />
          </div>
          <div className="absolute -top-4 left-24">
            <CssBalloon color="#ffd166" size={38} inflate />
          </div>
          <div className="absolute -top-10 right-16">
            <CssBalloon color="#3a86ff" size={50} inflate />
          </div>
        </div>
        <p className="font-display mt-8 text-center text-3xl text-white drop-shadow-[0_3px_0_#3d1f0a] md:text-5xl">
          Verso le Cascate Paradiso!
        </p>
        <BigButton color="yellow" className="mt-6" onClick={onDone}>
          Voliamo!
        </BigButton>
      </div>
    </Scene>
  );
}

export function LandingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    playWhoosh();
    const t = window.setTimeout(onDone, 4800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Scene bg={images.paradiseFalls}>
      <FloatingBalloons />
      <LevelRibbon subtitle="Atterraggio morbido" title="Le Cime dell’Avventura" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Portrait who="carl" size="lg" />
          <Portrait who="russell" size="lg" />
          <Portrait who="dug" />
        </div>
        <p className="font-display max-w-3xl text-center text-3xl text-white drop-shadow-[0_3px_0_#3d1f0a] md:text-5xl">
          Siamo arrivati! È il momento del Rituale degli Esploratori Esperti.
        </p>
        <BigButton color="green" onClick={onDone}>
          Siamo pronti!
        </BigButton>
      </div>
    </Scene>
  );
}
