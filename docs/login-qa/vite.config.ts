import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve("docs/login-qa"),
  plugins: [react()],
  publicDir: path.resolve("public"),
  resolve: {
    alias: [
      {
        find: "@/contexts/AuthContext",
        replacement: path.resolve("docs/login-qa/mock-auth.ts"),
      },
      { find: "@", replacement: path.resolve("src") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true,
    fs: { allow: [path.resolve(".")] },
  },
});
