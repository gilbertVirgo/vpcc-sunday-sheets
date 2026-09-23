import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 5173 is taken by the auth hub in local dev.
  server: { port: 5174, strictPort: true },
});
