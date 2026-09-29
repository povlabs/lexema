// The pages of developers.lexema.fyi/docs (board 31, Huey's ruling on #177):
// one page per sidebar item, in the sidebar's order. A guide page is one of a
// closed set; an endpoint page exists for every endpoint of the unit map, so
// none goes without a page and no page names an endpoint the API lacks.
//
// Everything a page's URL, its place in the sidebar and its Previous / Next
// depend on is read here; the markup is DeveloperDocs.tsx.

import type { Endpoint } from "@lexema/api/units.ts";
import { ENDPOINT_REFERENCE, ENDPOINTS_IN_ORDER } from "./apiReference.ts";

/** Where the docs live on the developer site. */
export const DOCS_PATH = "/docs";

/** The docs' groups, as the sidebar names them. */
export type DocsGroupName = "Getting started" | "Endpoints" | "Reference";

/** The pages that are not an endpoint's: each has its own slug, the introduction none. */
const GUIDES = {
  introduction: { slug: undefined, group: "Getting started", label: "Introduction", title: "The Lexema API" },
  authentication: { slug: "authentication", group: "Getting started", label: "Authentication", title: "Authentication" },
  "units-and-limits": { slug: "units-and-limits", group: "Getting started", label: "Units and limits", title: "Units and limits" },
  errors: { slug: "errors", group: "Getting started", label: "Errors", title: "Errors" },
  "grammar-values": { slug: "grammar-values", group: "Reference", label: "Grammar values", title: "Grammar values" },
  attribution: { slug: "attribution", group: "Reference", label: "Attribution", title: "Attribution" },
} as const satisfies Record<string, { slug: string | undefined; group: DocsGroupName; label: string; title: string }>;

export type Guide = keyof typeof GUIDES;

/** One page of the docs: a guide, or an endpoint's reference. */
export type DocsPage = { kind: "guide"; guide: Guide } | { kind: "endpoint"; endpoint: Endpoint };

/** An endpoint's slug: `lookup-batch` for `lookup/batch`. */
const endpointSlug = (endpoint: Endpoint): string => endpoint.replace("/", "-");

/** Every page, in the sidebar's order. */
export const DOCS_PAGES: readonly DocsPage[] = [
  ...(["introduction", "authentication", "units-and-limits", "errors"] as const).map((guide): DocsPage => ({ kind: "guide", guide })),
  ...ENDPOINTS_IN_ORDER.map((endpoint): DocsPage => ({ kind: "endpoint", endpoint })),
  ...(["grammar-values", "attribution"] as const).map((guide): DocsPage => ({ kind: "guide", guide })),
];

/** The page's slug under `/docs`, or undefined for the introduction, which is `/docs` itself. */
export const slugOf = (page: DocsPage): string | undefined =>
  page.kind === "guide" ? GUIDES[page.guide].slug : endpointSlug(page.endpoint);

/** The page's path on the developer site. */
export const pathOf = (page: DocsPage): string => {
  const slug = slugOf(page);
  return slug === undefined ? DOCS_PATH : `${DOCS_PATH}/${slug}`;
};

/** An endpoint page's path: `/docs/lookup-batch` for `lookup/batch`. */
export const endpointPath = (endpoint: Endpoint): string => pathOf({ kind: "endpoint", endpoint });

export const groupOf = (page: DocsPage): DocsGroupName => (page.kind === "guide" ? GUIDES[page.guide].group : "Endpoints");

/** What the sidebar calls the page: an endpoint by its path under `/v1/`. */
export const labelOf = (page: DocsPage): string => (page.kind === "guide" ? GUIDES[page.guide].label : page.endpoint);

/** The page's heading, and what Previous / Next call it. */
export const titleOf = (page: DocsPage): string =>
  page.kind === "guide" ? GUIDES[page.guide].title : ENDPOINT_REFERENCE[page.endpoint].title;

/** The page a slug names; undefined for any slug that is no page's. */
export const pageAt = (slug: string): DocsPage | undefined => DOCS_PAGES.find((page) => slugOf(page) === slug);

/** The pages before and after this one, in the sidebar's order. */
export function neighboursOf(page: DocsPage): { previous?: DocsPage; next?: DocsPage } {
  const at = DOCS_PAGES.findIndex((each) => pathOf(each) === pathOf(page));
  return { previous: DOCS_PAGES[at - 1], next: DOCS_PAGES[at + 1] };
}

/** Whether two values name the same page. */
export const samePage = (a: DocsPage, b: DocsPage): boolean => pathOf(a) === pathOf(b);
