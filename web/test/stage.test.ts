// The stage (ADR 0018): `LEXEMA_STAGE` parsed into a closed type, and what a
// stage adds to every response the Worker gives.

import assert from "node:assert/strict";
import { test } from "node:test";
import { apiNotFound } from "@/worker/api/handler.ts";
import { byHost } from "@/worker/hosts.ts";
import { parseStage, withStage, type Stage } from "@/worker/stage.ts";

test("LEXEMA_STAGE is local, preview or production, and anything else refuses", () => {
  assert.equal(parseStage("local"), "local");
  assert.equal(parseStage("preview"), "preview");
  assert.equal(parseStage("production"), "production");
  for (const value of [undefined, "", "Preview", " preview", "staging", "prod", 1, null]) {
    assert.throws(() => parseStage(value), /LEXEMA_STAGE must be one of local, preview, production/, String(value));
  }
});

/** The Worker's outer layers on `stage`, over an app that answers each path its own way. */
function worker(stage: Stage) {
  const fetch = withStage<object>(
    stage,
    byHost<object>({
      app: async (request) => {
        const { pathname } = new URL(request.url);
        // A redirect's headers are immutable, as a fetched or asset response's are.
        if (pathname === "/moved") return Response.redirect("https://lexema.fyi/", 302);
        return new Response("<p>page</p>", { status: 200, headers: { "content-type": "text/html", "set-cookie": "visitor=1" } });
      },
      api: async () => Response.json({ ok: true }),
      apiNotFound,
    }),
  );
  return (url: string) => fetch(new Request(url), {}, {} as ExecutionContext);
}

const URLS = [
  "https://branch.preview.lexema.fyi/?q=casa",
  "https://branch.preview.lexema.fyi/moved",
  "https://branch.preview.lexema.fyi/api/v1/lookup",
  "https://branch.developers-preview.lexema.fyi/docs",
  "https://branch.api-preview.lexema.fyi/v1/lookup?q=sale",
  "https://branch.api-preview.lexema.fyi/",
];

test("every response on the preview stage carries X-Robots-Tag: noindex, and keeps the rest of itself", async () => {
  const send = worker("preview");
  for (const url of URLS) {
    const response = await send(url);
    assert.equal(response.headers.get("x-robots-tag"), "noindex", url);
  }
  const page = await send(URLS[0]);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("content-type"), "text/html");
  assert.equal(page.headers.get("set-cookie"), "visitor=1");
  assert.equal(await page.text(), "<p>page</p>");
  const moved = await send(URLS[1]);
  assert.equal(moved.status, 302);
  assert.equal(moved.headers.get("location"), "https://lexema.fyi/");
  assert.equal((await send(URLS[5])).status, 404);
});

test("a production or local response carries no X-Robots-Tag", async () => {
  for (const [stage, origin] of [
    ["production", "https://lexema.fyi"],
    ["production", "https://api.lexema.fyi"],
    ["local", "http://localhost:8790"],
  ] as const) {
    const send = worker(stage);
    for (const path of ["/?q=casa", "/moved", "/v1/lookup?q=sale", "/"]) {
      const response = await send(`${origin}${path}`);
      assert.equal(response.headers.get("x-robots-tag"), null, `${stage} ${origin}${path}`);
    }
  }
});
