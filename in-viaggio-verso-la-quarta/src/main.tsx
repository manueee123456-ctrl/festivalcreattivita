import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { BalloonJourney } from "./components/BalloonJourney";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BalloonJourney>
      <App />
    </BalloonJourney>
  </StrictMode>
);
