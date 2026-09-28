import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig } from "vite";
import { withoutHeldBack } from "./worker/heldBack.ts";

export default defineConfig({
  plugins: [
    // This order is the one the spike proved on vinext, and it is load-bearing:
    // reports/2026-09-21-base-ui-tailwind-on-vinext.md ran `tailwindcss()`
    // first, then vinext, then the Cloudflare environment.
    tailwindcss(),
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      // The routes the build writes for `wrangler deploy`, minus the hosts
      // held back until the developer site is ready (worker/heldBack.ts).
      // Changed in place: a returned `routes` would be added to the list, not
      // replace it.
      config: (worker) => {
        if (worker.routes) worker.routes = withoutHeldBack(worker.routes);
      },
    }),
  ],
  resolve: {
    alias: {
      // The lookup layer lives at the repository root, beside the importer that
      // produces the data it reads. Aliased rather than copied: two copies of a
      // query layer drift apart, which is the whole reason it has a single
      // driver-agnostic interface.
      "@lexema/lookup": fileURLToPath(new URL("../src/lookup", import.meta.url)),
      "@lexema/italian": fileURLToPath(new URL("../src/italian", import.meta.url)),
      "@lexema/source": fileURLToPath(new URL("../src/source", import.meta.url)),
      "@lexema/api": fileURLToPath(new URL("../src/api", import.meta.url)),
    },
  },
});
