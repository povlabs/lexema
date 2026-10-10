// The Licence page's text (#139, frames 33 and 33m), with no database in it.
//
// This page carries the whole credit ADR 0009 asks for, which every result's
// small Source link leans on. The words are Huey's, approved on 2026-10-04
// (https://github.com/povlabs/lexema/issues/139#issuecomment-5978972736), and
// are kept exactly in meaning, in Italian since #791: the same claims, none
// added or dropped. Only the release in section 5 is filled in, from the value
// `licence/page.tsx` hands in. Sections 1, 3, 4, 5 and 7 carry the ids the old
// `/attribution` page's sections had, so a link to one of them still lands on
// the section that replaced it.

import { ExternalLink } from "@/components/shared/ExternalLink";
import { LEGAL_ITEMS, LEGAL_PARAGRAPH, LEGAL_UNBROKEN, LINK } from "@/components/shared/styles.ts";
import type { ServedRelease } from "@lexema/source/servedRelease.ts";
import { dayIn, LegalItem } from "@/components/shared/LegalPage";
import { LEGAL_TITLE } from "@/lib/dictionary/siteText.ts";
import { DictionaryLegalPage, KICKER } from "./DictionaryLegalPage";

const LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const LICENCE_TEXT_URL = "https://creativecommons.org/licenses/by-sa/4.0/legalcode";

/** A dump's `YYYY-MM-DD` date, as a reader would say it. */
const DAY = dayIn("it-IT");

/** The whole page, over the release the dictionary serves. */
export function Licence({ release }: { release: ServedRelease }) {
  return (
    <DictionaryLegalPage
      kicker={KICKER}
      title={LEGAL_TITLE.licence}
      effective="2026-10-04"
      lede="Questa pagina stabilisce le condizioni alle quali il contenuto lessicale pubblicato su Lexema può essere riutilizzato e cita le fonti da cui deriva."
      sections={[
        {
          id: "licence",
          title: "Licenza",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Le definizioni e gli altri contenuti lessicali derivati dalle fonti indicate di seguito sono resi
              disponibili con la licenza{" "}
              <ExternalLink language="it" className={LINK} href={LICENCE_URL}>
                Creative Commons Attribuzione - Condividi allo stesso modo 4.0 Internazionale (CC BY-SA 4.0)
              </ExternalLink>
              .
            </p>
          ),
        },
        {
          id: "reuse",
          title: "Riutilizzo",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>In base a tale licenza puoi:</p>
              <ul className={LEGAL_ITEMS}>
                <LegalItem mark="a">copiare e ridistribuire il contenuto con qualsiasi mezzo o formato;</LegalItem>
                <LegalItem mark="b">
                  adattarlo, trasformarlo e basarti su di esso, per qualsiasi fine, anche commerciale;
                </LegalItem>
              </ul>
              <p className={LEGAL_PARAGRAPH}>
                a condizione di attribuire adeguatamente la paternità, fornire un link alla licenza, indicare le
                eventuali modifiche apportate e distribuire i tuoi contributi con la stessa licenza.
              </p>
            </>
          ),
        },
        {
          id: "where",
          title: "Fonti",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>
                Il contenuto deriva dal{" "}
                <ExternalLink language="it" className={LINK} href="https://it.wiktionary.org/">
                  Wikizionario
                </ExternalLink>{" "}
                (il Wiktionary in italiano), un progetto della{" "}
                <ExternalLink language="it" className={LINK} href="https://wikimediafoundation.org/">
                  Wikimedia Foundation
                </ExternalLink>{" "}
                scritto da collaboratori volontari. La maggior parte delle voci proviene dall’estrazione pubblicata
                da{" "}
                <ExternalLink language="it" className={LINK} href="https://kaikki.org/itwiktionary/">
                  kaikki.org
                </ExternalLink>
                , prodotta con{" "}
                <ExternalLink language="it" className={LINK} href="https://github.com/tatuylonen/wiktextract">
                  wiktextract
                </ExternalLink>{" "}
                da Tatu Ylonen. Dove quell’estrazione non è riuscita a leggere una pagina, Lexema legge la voce dal
                testo della pagina stessa nel{" "}
                <ExternalLink language="it" className={LINK} href={release.dump.url}>
                  dump di Wikimedia
                </ExternalLink>
                .
              </p>
              <p className={LEGAL_PARAGRAPH}>
                Gli autori di ogni voce sono registrati nella cronologia delle versioni della sua pagina del
                Wikizionario. Ogni voce di Lexema rimanda a quella pagina.
              </p>
            </>
          ),
        },
        {
          id: "changed",
          title: "Modifiche",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Lexema ha adattato il materiale di origine: è ristrutturato e indicizzato per la ricerca, alcune
              informazioni grammaticali sono aggiunte secondo regole, alcune formulazioni sono rese uniformi e singoli
              errori sono corretti. Lexema non scrive né genera definizioni.
            </p>
          ),
        },
        {
          id: "version",
          title: "Versione dei dati",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Il contenuto è aggiornato alla release <span className={LEGAL_UNBROKEN}>{release.release}</span>,
              pubblicata da kaikki.org e costruita a partire dal dump del Wikizionario del{" "}
              <span className={LEGAL_UNBROKEN}>{DAY.format(new Date(release.dump.date))}</span>.
            </p>
          ),
        },
        {
          id: "disclaimer",
          title: "Esclusione di garanzie",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Il contenuto è fornito &laquo;così com’è&raquo;, senza garanzie di alcun tipo, come stabilito nella{" "}
              <ExternalLink language="it" className={LINK} href={LICENCE_TEXT_URL}>
                sezione 5 della licenza
              </ExternalLink>
              . Lexema non garantisce che il contenuto sia accurato, completo o adatto a uno scopo particolare.
            </p>
          ),
        },
        {
          id: "trademarks",
          title: "Marchi",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Wikipedia, Wiktionary, Wikizionario e Wikimedia sono marchi registrati della Wikimedia Foundation, Inc.
              Lexema non è affiliato alla Wikimedia Foundation, né approvato o sponsorizzato da essa.
            </p>
          ),
        },
      ]}
    />
  );
}
