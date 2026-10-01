import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // This order is the one the spike proved on vinext, and it is load-bearing:
    // reports/2026-09-21-base-ui-tailwind-on-vinext.md ran `tailwindcss()`
    // first, then vinext, then the Cloudflare environment.
    tailwindcss(),
    vinext({
      nextConfig: {
        // #337: every User-Agent gets the title and meta tags in <head>, not streamed after the footer; the page already waits for its lookup (#115), so streaming them gains nothing.
        htmlLimitedBots: /.*/,
      },
    }),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } }),
  ],
  resolve: {
    alias: {
      // `@/…` is web/ itself, so an import names where a file lives
      // (`@/components/dictionary/Word`) instead of how far up it is.
      "@": dirname(fileURLToPath(import.meta.url)),
      // The lookup layer lives at the repository root, beside the importer that
      // produces the data it reads. Aliased rather than copied: two copies of a
      // query layer drift apart, which is the whole reason it has a single
      // driver-agnostic interface.
      "@lexema/lookup": fileURLToPath(new URL("../src/lookup", import.meta.url)),
      "@lexema/italian": fileURLToPath(new URL("../src/italian", import.meta.url)),
      "@lexema/source": fileURLToPath(new URL("../src/source", import.meta.url)),
      "@lexema/api": fileURLToPath(new URL("../src/api", import.meta.url)),
      "@lexema/accounts": fileURLToPath(new URL("../src/accounts", import.meta.url)),
      "@lexema/db": fileURLToPath(new URL("../src/db", import.meta.url)),
      "@lexema/billing": fileURLToPath(new URL("../src/billing", import.meta.url)),
      "@lexema/email": fileURLToPath(new URL("../src/email", import.meta.url)),
      "@lexema/log": fileURLToPath(new URL("../src/log", import.meta.url)),
    },
  },
});
