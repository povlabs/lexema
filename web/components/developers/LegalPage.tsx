// developers.lexema.fyi/terms and /privacy (#162, boards 35, 35m, 36 and 36m):
// a legal document in the developer site's chrome, edge to edge as board 35
// draws the bar. The kicker, the title, the effective date and the lede, then
// the numbered sections; on a wide screen a Contents column beside them. The
// text is `legalDocuments.ts`; this file only lays it out.

import type { SignedIn } from "@/lib/developers/signedIn.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { DeveloperPage } from "./DeveloperPage";
import { LegalContents } from "./LegalContents";
import type { Inline, LegalBlock, LegalDocument } from "./legalDocuments";
import {
  LEGAL_ARTICLE,
  LEGAL_BODY,
  LEGAL_CONTENTS,
  LEGAL_CONTENTS_INNER,
  LEGAL_EFFECTIVE,
  LEGAL_HEADING,
  LEGAL_ITEM,
  LEGAL_ITEM_MARK,
  LEGAL_KICKER,
  LEGAL_LEDE,
  LEGAL_LIST,
  LEGAL_MAIL,
  LEGAL_NUMBER,
  LEGAL_PARAGRAPH,
  LEGAL_SECTION,
  LEGAL_SHELL,
  LEGAL_TITLE,
} from "@/components/shared/styles.ts";

/** A list item's letter: (a), (b), (c). */
const letterOf = (index: number): string => `(${String.fromCharCode(97 + index)})`;

function Text({ text }: { text: readonly Inline[] }) {
  return text.map((run, index) =>
    typeof run === "string" ? (
      run
    ) : (
      <a key={index} className={LEGAL_MAIL} href={`mailto:${run.mailto}`}>
        {run.mailto}
      </a>
    ),
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className={LEGAL_PARAGRAPH}>
          <Text text={block.text} />
        </p>
      );
    case "list":
      return (
        <ol className={LEGAL_LIST}>
          {block.items.map((item, index) => (
            <li key={item} className={LEGAL_ITEM}>
              <span className={LEGAL_ITEM_MARK}>{letterOf(index)}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
  }
}

export function LegalPage({ document, signedIn, origins }: { document: LegalDocument; signedIn?: SignedIn; origins: SiteOrigins }) {
  return (
    <DeveloperPage current={document.section} wide signedIn={signedIn} origins={origins}>
      <main className={LEGAL_SHELL}>
        <aside className={LEGAL_CONTENTS}>
          <div className={LEGAL_CONTENTS_INNER}>
            <LegalContents entries={document.parts.map(({ id, heading }) => ({ id, heading }))} />
          </div>
        </aside>
        <article className={LEGAL_ARTICLE}>
          <header>
            <p className={LEGAL_KICKER}>Lexema Developers · Legal</p>
            <h1 className={LEGAL_TITLE}>{document.title}</h1>
            <p className={LEGAL_EFFECTIVE}>Effective {document.effective}</p>
            <p className={LEGAL_LEDE}>{document.lede}</p>
          </header>
          {document.parts.map((part, index) => (
            <section key={part.id} id={part.id} className={LEGAL_SECTION} aria-labelledby={`${part.id}-heading`}>
              <h2 className={LEGAL_HEADING} id={`${part.id}-heading`}>
                <span className={LEGAL_NUMBER}>{index + 1}.</span>
                <span>{part.heading}</span>
              </h2>
              <div className={LEGAL_BODY}>
                {part.blocks.map((block, blockIndex) => (
                  <Block key={blockIndex} block={block} />
                ))}
              </div>
            </section>
          ))}
        </article>
      </main>
    </DeveloperPage>
  );
}
