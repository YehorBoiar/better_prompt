import React from "react";
import { createRoot } from "react-dom/client";
import "@assets/styles/tailwind.css";
import Tap from "./Tap";

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Tap root element");
  const root = createRoot(rootContainer);
  root.render(<Tap />);
}

init();
