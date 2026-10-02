// Which of the three sites a request is for, read off its host (#159, #164).
//
// One Worker answers three hosts. `lexema.fyi` is the dictionary, as it was.
// `api.lexema.fyi` is the JSON API under `/v1/` and nothing else. The developer
// site at `developers.lexema.fyi` is an App Router route group of its own,
// `app/(developers)/developer-site/`: its requests are rewritten onto that
// segment before vinext sees them, and the segment is a 404 on every other host.
//
// `destinationOf` is the whole decision, a pure function of the URL, so it is
// tested without a Worker; `byHost` only carries it out.
//
// In local development the hosts are `localhost`, `developers.localhost` and
// `api.localhost`. A `.localhost` name always resolves to this machine, and
// the live Worker is reached only through its custom domains
// (web/wrangler.jsonc), so those names are never answered in production.
//
// A Preview (ADR 0018) answers the same three sites on preview-only hosts:
// `<name>.preview.lexema.fyi`, `<name>.developers-preview.lexema.fyi` and
// `<name>.api-preview.lexema.fyi`, where `<name>` is the Preview's name or, for
// one deployment, `<deployment-id>-<name>` (Cloudflare, "Previews, custom
// domains"). Those domains are routes that serve Previews only
// (web/wrangler.jsonc), so production is never asked for them.
//
// The pages link the three sites to each other, and those links follow the
// host a request came in on (#266): a Preview's pages name its sibling hosts,
// under the same `<name>` label, so following one stays on that Preview. Every
// other host, live and local alike, names the live sites.
//
// One local-only route: Google refuses a redirect URI on `developers.localhost`,
// since a subdomain's top-level domain must be a public suffix, but accepts
// `localhost`. So locally Google's callback is on `localhost`, which relays
// the browser to the developer site with the same query (#185).

import { API_PREFIX } from "@lexema/api/calls.ts";
import type { FetchHandler } from "./rateLimit.ts";

/** The sites one Worker serves, each on its own host. */
export type Site = "lexema" | "developers" | "api";

/** Each site's address, as the pages of one request name it. */
export type SiteOrigins = Readonly<Record<Site, string>>;

/** Each site's live address. */
export const ORIGIN: SiteOrigins = {
  lexema: "https://lexema.fyi",
  developers: "https://developers.lexema.fyi",
  api: "https://api.lexema.fyi",
};

/** What each site's host puts in front of the domain. */
const SUBDOMAIN: Readonly<Record<Site, string>> = { lexema: "", developers: "developers.", api: "api." };

/**
 * Each site's preview-only domain. A Preview answers one DNS label below it:
 * its name, or `<deployment-id>-<name>` for one deployment.
 */
export const PREVIEW_DOMAIN: Readonly<Record<Site, string>> = {
  lexema: "preview.lexema.fyi",
  developers: "developers-preview.lexema.fyi",
  api: "api-preview.lexema.fyi",
};

/** One DNS label: what a Preview's name, with or without its deployment id, is. */
const PREVIEW_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** The domain local development answers under. */
const LOCAL_DOMAIN = "localhost";
/** The live domain, and the local one. */
const DOMAINS = ["lexema.fyi", LOCAL_DOMAIN] as const;

/** The path Google sends the browser back to after sign-in. */
const GOOGLE_CALLBACK_PATH = "/sign-in/google/callback";

/**
 * The segment the developer site's pages live under, inside the App Router.
 * Only a `developers` host reaches it; no public URL names it.
 */
export const DEVELOPERS_SEGMENT = "developer-site";

/**
 * Where the API lived on `lexema.fyi` before it moved to its own host. It is
 * gone, not moved: a request there is a 404, with no redirect (#159, #164).
 */
const RETIRED_API_SEGMENTS = ["api", "v1"] as const;

/** Where a request goes. Each arm carries exactly what answering it needs. */
export type Destination =
  /** A `lexema.fyi` page or route, handed on exactly as it came. */
  | { to: "site" }
  /** A developer-site page, at this path inside the App Router. */
  | { to: "developers"; path: string }
  /** The JSON API, handed on exactly as it came. */
  | { to: "api" }
  /** Local Google sign-in only: the browser is sent on to `location`. */
  | { to: "relay"; location: string }
  /** Nothing is here: answered as the named site answers a missing path. */
  | { to: "not-found"; site: "lexema" | "api" };

const SITES = Object.keys(SUBDOMAIN) as Site[];

/** A Preview host, read: the label naming the Preview, and which of its sites it is. */
interface PreviewHost {
  label: string;
  site: Site;
}

/** The Preview a host belongs to, or none for a host that is not one. */
function previewOf(hostname: string): PreviewHost | undefined {
  const dot = hostname.indexOf(".");
  const label = hostname.slice(0, dot);
  if (dot < 0 || !PREVIEW_LABEL.test(label)) return undefined;
  const domain = hostname.slice(dot + 1);
  const site = SITES.find((candidate) => PREVIEW_DOMAIN[candidate] === domain);
  return site === undefined ? undefined : { label, site };
}

/** The site a Preview host names, or none for a host that is not one. */
const previewSiteOf = (hostname: string): Site | undefined => previewOf(hostname)?.site;

/**
 * The three sites' addresses as a page asked on `hostname` names them (#266).
 * On a Preview they are its siblings, under the same label; on any other host
 * they are the live ones.
 */
export function originsOf(hostname: string): SiteOrigins {
  const preview = previewOf(hostname);
  if (preview === undefined) return ORIGIN;
  const sibling = (site: Site) => `https://${preview.label}.${PREVIEW_DOMAIN[site]}`;
  return { lexema: sibling("lexema"), developers: sibling("developers"), api: sibling("api") };
}

/** Whether a host is a Preview's developer site: `<name>.developers-preview.lexema.fyi`. */
export const isDeveloperPreviewHost = (hostname: string): boolean => previewSiteOf(hostname) === "developers";

/** The site a URL's host names. Any other host is the dictionary's. */
export function siteOf(url: URL): Site {
  for (const domain of DOMAINS) {
    for (const site of SITES) {
      if (url.hostname === `${SUBDOMAIN[site]}${domain}`) return site;
    }
  }
  return previewSiteOf(url.hostname) ?? "lexema";
}

/**
 * Whether a URL is exactly `path` on the developer site's host, live, local or
 * a Preview's. worker/stripeWebhook.ts reads its route this way, in front of
 * `byHost`; any other spelling or host goes where `destinationOf` sends it.
 */
export const isDeveloperSitePath = (url: URL, path: string): boolean => siteOf(url) === "developers" && url.pathname === path;

/** This URL's origin with the host of `site` on the local domain, keeping the port. */
function localOrigin(url: URL, site: Site): string {
  const origin = new URL(url.origin);
  origin.hostname = `${SUBDOMAIN[site]}${LOCAL_DOMAIN}`;
  return origin.origin;
}

/**
 * The redirect URI Google sends the browser back to, for a sign-in started at
 * this developer-site URL. Live it is the developer site's own; locally it is
 * on `localhost`, whose relay hands the callback on to `developers.localhost`.
 */
export function googleCallbackUri(url: URL): string {
  const local = url.hostname === `${SUBDOMAIN.developers}${LOCAL_DOMAIN}`;
  return `${local ? localOrigin(url, "lexema") : url.origin}${GOOGLE_CALLBACK_PATH}`;
}

/**
 * A path's segments as vinext routes on them: each percent-decoded, empty and
 * `.` segments dropped, `..` removing the one before. Read this way, no
 * spelling of a path (`/developer%2Dsite`, `//x/../developer-site`) reaches a
 * route the plain spelling would not.
 */
function segmentsOf(pathname: string): string[] {
  const segments: string[] = [];
  for (const raw of pathname.split("/")) {
    let segment = raw;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      // Malformed: vinext refuses it with a 400, so it routes nowhere.
    }
    if (segment === "" || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments;
}

/** The App Router path a developer-site path is served from. */
function developersPath(segments: string[]): string {
  if (segments.length === 0) return `/${DEVELOPERS_SEGMENT}`;
  // The root page's RSC request: `/.rsc` is `/` with the suffix.
  if (segments.length === 1 && segments[0] === ".rsc") return `/${DEVELOPERS_SEGMENT}.rsc`;
  return `/${[DEVELOPERS_SEGMENT, ...segments].map(encodeURIComponent).join("/")}`;
}

/** Where a request for this URL goes. */
export function destinationOf(url: URL): Destination {
  switch (siteOf(url)) {
    case "api":
      return url.pathname.startsWith(API_PREFIX) ? { to: "api" } : { to: "not-found", site: "api" };
    case "developers":
      return { to: "developers", path: developersPath(segmentsOf(url.pathname)) };
    case "lexema": {
      const segments = segmentsOf(url.pathname);
      if (RETIRED_API_SEGMENTS.every((segment, i) => segments[i] === segment)) return { to: "not-found", site: "lexema" };
      if (url.hostname === LOCAL_DOMAIN && `/${segments.join("/")}` === GOOGLE_CALLBACK_PATH) {
        return { to: "relay", location: `${localOrigin(url, "developers")}${GOOGLE_CALLBACK_PATH}${url.search}` };
      }
      const [first = ""] = segments;
      const segment = first.endsWith(".rsc") ? first.slice(0, -".rsc".length) : first;
      return segment === DEVELOPERS_SEGMENT ? { to: "not-found", site: "lexema" } : { to: "site" };
    }
  }
}

/** How the Worker answers each kind of destination it does not answer itself. */
export interface SiteHandlers<E> {
  /** The App Router behind the per-visitor limits: `lexema.fyi` and the developer site. */
  app: FetchHandler<E>;
  /** The JSON API. */
  api: FetchHandler<E>;
  /** The API's answer to a path it has no endpoint at. */
  apiNotFound: (url: URL) => Response;
}

/** Send every request where `destinationOf` says it goes. */
export function byHost<E>(handlers: SiteHandlers<E>): FetchHandler<E> {
  return async (request, env, ctx) => {
    const url = new URL(request.url);
    const destination = destinationOf(url);
    switch (destination.to) {
      case "site":
        return handlers.app(request, env, ctx);
      case "developers":
        return handlers.app(new Request(new URL(`${destination.path}${url.search}`, url), request), env, ctx);
      case "api":
        return handlers.api(request, env, ctx);
      case "relay":
        return new Response(null, { status: 302, headers: { location: destination.location, "cache-control": "no-store" } });
      case "not-found":
        return destination.site === "api"
          ? handlers.apiNotFound(url)
          : new Response("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  };
}
