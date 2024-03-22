import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts"],
  splitting: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  outDir: "dist",
  format: ["esm"],
});
