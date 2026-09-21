import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { BalloonJourney } from "./components/BalloonJourney";
import { MotionProvider } from "./components/MotionPreference";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionProvider>
      <BalloonJourney>
        <App />
      </BalloonJourney>
    </MotionProvider>
  </StrictMode>
);
