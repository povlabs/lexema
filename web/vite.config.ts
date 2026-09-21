import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } }),
  ],
  resolve: {
    alias: {
      // The lookup layer lives at the repository root, beside the importer that
      // produces the data it reads. Aliased rather than copied: two copies of a
      // query layer drift apart, which is the whole reason it has a single
      // driver-agnostic interface.
      "@lexema/lookup": fileURLToPath(new URL("../src/lookup", import.meta.url)),
      "@lexema/italian": fileURLToPath(new URL("../src/italian", import.meta.url)),
    },
  },
});
