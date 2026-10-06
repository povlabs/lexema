// The two entry points of React's flight renderer the word-page weight test
// uses (rscFlight.tsx, rscPage.ts). The package ships no types; these are the
// signatures it is called with here, read from its 19.3 source.

declare module "react-server-dom-webpack/server.edge" {
  import type { ReactNode } from "react";
  export function renderToReadableStream(
    model: ReactNode,
    webpackMap: unknown,
    options?: { onError?: (error: unknown) => void },
  ): ReadableStream<Uint8Array>;
}

declare module "react-server-dom-webpack/client.edge" {
  export function createFromReadableStream<T>(
    stream: ReadableStream<Uint8Array>,
    options: { serverConsumerManifest: { moduleMap: unknown; serverModuleMap: unknown; moduleLoading: unknown } },
  ): Promise<T>;
}
