import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/tempo-keeper/" : "/",
  plugins: [react(), tailwindcss()],
  staged: {
    "*": "vp check --fix",
  },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
  fmt: { ignorePatterns: ["src copy/**"] },
  lint: {
    ignorePatterns: ["src copy/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
