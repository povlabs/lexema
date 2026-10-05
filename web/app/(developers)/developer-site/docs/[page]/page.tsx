// developers.lexema.fyi/docs/<page> (#166): every docs page but the
// introduction, one per sidebar item (docsPages.ts). The wiring only; the
// markup is `@/components/developers/DeveloperDocs.tsx`. It reads the session,
// when there is one, for the account menu (#190), and nothing else from D1. A
// slug that is no page's is a 404.
import { notFound } from "next/navigation";
import { DeveloperDocs } from "@/components/developers/DeveloperDocs";
import { signedInVisitor } from "@/lib/developers/visitor.ts";
import { developerSignUp } from "@/lib/developers/signUp.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";
import { DOCS_PAGES, pageAt, slugOf, titleOf } from "@/lib/developers/docsPages.ts";

interface PageProps {
  params: Promise<{ page: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS_PAGES.flatMap((page) => {
    const slug = slugOf(page);
    return slug === undefined ? [] : [{ page: slug }];
  });
}

export async function generateMetadata({ params }: PageProps) {
  const page = pageAt((await params).page);
  return { title: page === undefined ? "Docs — Lexema API" : `${titleOf(page)} — Lexema API` };
}

export default async function Page({ params }: PageProps) {
  const page = pageAt((await params).page);
  if (page === undefined) notFound();
  return <DeveloperDocs page={page} signedIn={await signedInVisitor()} signUp={developerSignUp()} origins={await siteOrigins()} />;
}
