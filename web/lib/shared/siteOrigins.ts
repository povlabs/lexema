// The three sites' addresses as the page being rendered names them (#266):
// read off the request's host, so a Preview's pages link its own sibling hosts
// (worker/hosts.ts, `originsOf`). The pages read this once and hand it down.
import { headers } from "next/headers";
import { originsOf, type SiteOrigins } from "@/worker/hosts.ts";

/** A `Host` header's name without its port; none is no host, which names the live sites. */
export const hostnameOf = (host: string | null): string => (host ?? "").split(":")[0];

/** The sites' addresses for this request's host. */
export async function siteOrigins(): Promise<SiteOrigins> {
  return originsOf(hostnameOf((await headers()).get("host")));
}
