import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.json",
  clean: true,
  outDir: "dist",
  noExternal: [/./],
});
