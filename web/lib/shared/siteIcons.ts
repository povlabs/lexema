// The site icon (#383): board I1, option A in lexema-design.pen (`W22dA`), a
// cream Spectral "L" on the dark surface in a rounded square. Both sites'
// layouts hand these to vinext's metadata, which writes the `<link>` tags.
//
// The files are static assets in web/public, so Cloudflare answers them before
// the Worker runs (web/wrangler.jsonc, `assets`), on every host: lexema.fyi,
// developers.lexema.fyi and api.lexema.fyi alike. The touch icon is a full
// square with no transparent corners, since iOS rounds it itself; the others
// keep the board's rounded corners.

import type { Metadata } from "vinext/shims/metadata";

/** Each icon file, as its path on every host. */
export const ICON_PATH = {
  /** 16, 32 and 48 px in one file, for the browser tab and anything that asks for /favicon.ico. */
  favicon: "/favicon.ico",
  /** 32 px. */
  icon: "/icon.png",
  /** 180 px, full square. */
  appleTouch: "/apple-touch-icon.png",
  /** 192 and 512 px, for the web manifest; the email header shows the 192 at 32 px (src/email/send.ts). */
  icon192: "/icon-192.png",
  icon512: "/icon-512.png",
  manifest: "/site.webmanifest",
} as const;

/** The metadata both layouts carry: the tab icons, the touch icon and the web manifest. */
export const SITE_ICON_METADATA: Metadata = {
  icons: {
    icon: [
      { url: ICON_PATH.favicon, sizes: "16x16 32x32 48x48" },
      { url: ICON_PATH.icon, type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: ICON_PATH.appleTouch, sizes: "180x180" }],
  },
  manifest: ICON_PATH.manifest,
};
