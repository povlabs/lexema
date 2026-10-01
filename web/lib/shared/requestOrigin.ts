// The origin a page was asked on, read off its request headers, for the few
// tags that must name an absolute URL (a link preview's `og:image`).
//
// Cloudflare sends `x-forwarded-proto` on every request it hands a Worker.
// Local development may not, and serves plain HTTP on `localhost` and its
// subdomains, so a host there with no header is `http`; anything else is
// `https`, the only scheme the live and Preview hosts answer.

const LOCAL = /^(?:[a-z0-9-]+\.)*localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/i;

export function requestOrigin(headers: Pick<Headers, "get">): string {
  const host = headers.get("host") ?? "lexema.fyi";
  const forwarded = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwarded === "http" || forwarded === "https" ? forwarded : LOCAL.test(host) ? "http" : "https";
  return `${protocol}://${host}`;
}
