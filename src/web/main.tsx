import React from "react";
import { createRoot } from "react-dom/client";
import LoginPage from "../pages/options/Options";
import "../assets/styles/tailwind.css";

const container = document.getElementById("web-root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <LoginPage />
    </React.StrictMode>
  );
}
