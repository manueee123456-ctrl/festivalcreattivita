import { useCallback, useState } from "react";
import { level1Questions, type Step } from "./data";
import { useBalloonJourney } from "./components/BalloonJourney";
import { IntroScreen } from "./screens/IntroScreen";
import { Level1Screen } from "./screens/Level1Screen";
import { LandingScreen, LiftOffScreen } from "./screens/LiftOffScreen";
import { SortScreen } from "./screens/SortScreen";
import { AdventureQuestion, MapQuestion, ShareQuestion } from "./screens/OpenScreen";
import { ConclusionScreen, PromiseScreen, VoteScreen } from "./screens/FinaleScreens";

type Save = {
  name: string;
  map: string;
  adventure: string;
  favorite: string;
  emotion: string;
  stars: number;
  promise: string;
  fill: string;
  ring: string;
  ribbon: string;
};

const emptySave = (): Save => ({
  name: "Esploratore",
  map: "",
  adventure: "",
  favorite: "",
  emotion: "",
  stars: 0,
  promise: "",
  fill: "#ffd166",
  ring: "#e63946",
  ribbon: "#3a86ff",
});

const destinations: Record<Step, string> = {
  intro: "Una nuova avventura!",
  level1: "Domanda 1 di 5",
  liftoff: "Si decolla!",
  level2sort: "La Prova dei Pesi",
  level2map: "La Prova della Mappa",
  level2adventure: "L’avventura continua",
  landing: "Eccoci alle cascate!",
  shareFavorite: "La scena più bella",
  shareEmotion: "Le tue emozioni",
  vote: "Il tuo voto al film",
  promise: "La tua promessa",
  conclusion: "Missione compiuta!",
};

export default function App() {
  const travel = useBalloonJourney();
  const [step, setStep] = useState<Step>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [balloons, setBalloons] = useState(0);
  const [save, setSave] = useState<Save>(emptySave);

  const go = useCallback((s: Step) => {
    travel(() => setStep(s), destinations[s]);
  }, [travel]);

  function handleCorrect() {
    const last = questionIndex === level1Questions.length - 1;
    travel(() => {
      setBalloons((count) => count + 1);
      if (last) {
        setStep("liftoff");
      } else {
        setQuestionIndex((i) => i + 1);
      }
    }, last ? destinations.liftoff : `Domanda ${questionIndex + 2} di ${level1Questions.length}`);
  }

  if (step === "intro") {
    return (
      <IntroScreen
        onStart={(name) => {
          setSave((s) => ({ ...s, name }));
          go("level1");
        }}
      />
    );
  }

  if (step === "level1") {
    return (
      <Level1Screen
        questionIndex={questionIndex}
        balloons={balloons}
        onCorrect={handleCorrect}
      />
    );
  }

  if (step === "liftoff") {
    return <LiftOffScreen onDone={() => go("level2sort")} />;
  }

  if (step === "level2sort") {
    return <SortScreen onDone={() => go("level2map")} />;
  }

  if (step === "level2map") {
    return (
      <MapQuestion
        onSubmit={(text) => {
          setSave((s) => ({ ...s, map: text }));
          go("level2adventure");
        }}
      />
    );
  }

  if (step === "level2adventure") {
    return (
      <AdventureQuestion
        onSubmit={(text) => {
          setSave((s) => ({ ...s, adventure: text }));
          go("landing");
        }}
      />
    );
  }

  if (step === "landing") {
    return <LandingScreen onDone={() => go("shareFavorite")} />;
  }

  if (step === "shareFavorite") {
    return (
      <ShareQuestion
        key={step}
        kind="favorite"
        onSubmit={(text) => {
          setSave((s) => ({ ...s, favorite: text }));
          go("shareEmotion");
        }}
      />
    );
  }

  if (step === "shareEmotion") {
    return (
      <ShareQuestion
        key={step}
        kind="emotion"
        onSubmit={(text) => {
          setSave((s) => ({ ...s, emotion: text }));
          go("vote");
        }}
      />
    );
  }

  if (step === "vote") {
    return (
      <VoteScreen
        onSubmit={(stars) => {
          setSave((s) => ({ ...s, stars }));
          go("promise");
        }}
      />
    );
  }

  if (step === "promise") {
    return (
      <PromiseScreen
        name={save.name}
        onSubmit={({ promise, fill, ring, ribbon }) => {
          setSave((s) => ({ ...s, promise, fill, ring, ribbon }));
          go("conclusion");
        }}
      />
    );
  }

  return (
    <ConclusionScreen
      name={save.name}
      stars={save.stars}
      promise={save.promise}
      fill={save.fill}
      ring={save.ring}
      ribbon={save.ribbon}
      onRestart={() => {
        travel(() => {
          setSave(emptySave());
          setQuestionIndex(0);
          setBalloons(0);
          setStep("intro");
        }, destinations.intro);
      }}
    />
  );
}
