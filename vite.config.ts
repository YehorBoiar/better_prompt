import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@components": path.resolve(__dirname, "./src/components"),
    },
  },
  server: {
    allowedHosts: [
      "localhost",
      "nonreflected-triatomically-tony.ngrok-free.dev",
      "brynlee-indiscretionary-unforgetfully.ngrok-free.dev",
      "6a45-138-195-55-205.ngrok-free.app",
    ],
  },
});
