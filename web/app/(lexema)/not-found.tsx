// Every lexema.fyi address no page answers (#791): the markup is
// `@/components/dictionary/PageNotFound.tsx`, in Italian, under the site's
// header; the layout adds the footer. Without it vinext drew its own English
// 404 in this layout.
import { PageNotFound } from "@/components/dictionary/PageNotFound";
import { SITE_NAME } from "@/lib/dictionary/params.ts";
import { PAGE_NOT_FOUND } from "@/lib/dictionary/siteText.ts";

export const metadata = { title: `${PAGE_NOT_FOUND} — ${SITE_NAME}` };

export default function NotFound() {
  return <PageNotFound />;
}
