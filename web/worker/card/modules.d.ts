// The two kinds of file the card imports that TypeScript cannot type itself.

/** A `.bin` file, bundled by @cloudflare/vite-plugin as a Data module: its bytes. */
declare module "*.bin" {
  const bytes: ArrayBuffer;
  export default bytes;
}

/** A file imported with Vite's `?raw`: its text. */
declare module "*?raw" {
  const text: string;
  export default text;
}
