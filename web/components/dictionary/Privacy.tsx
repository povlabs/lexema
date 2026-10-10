// The Privacy notice (#139, frames 34 and 34m).
//
// The words are Huey's, approved on 2026-10-04
// (https://github.com/povlabs/lexema/issues/139#issuecomment-5978972736), and
// are kept exactly in meaning, in Italian since #791: the same claims, none
// added or dropped. What section 4 says about retention is what the code does
// since #570: a report's visitor code is erased an hour after it is sent
// (worker/dictionary/reportSweep.ts), and its note when it is answered
// (`pnpm run report answer`).

import { LEGAL_ADDRESS, LEGAL_ITEMS, LEGAL_PARAGRAPH, LEGAL_UNBROKEN, LINK } from "@/components/shared/styles.ts";
import { PRIVACY_EMAIL } from "@/components/shared/contact.ts";
import { LegalItem } from "@/components/shared/LegalPage";
import { LEGAL_TITLE } from "@/lib/dictionary/siteText.ts";
import { DictionaryLegalPage, KICKER } from "./DictionaryLegalPage";

export function Privacy() {
  return (
    <DictionaryLegalPage
      kicker={KICKER}
      title={LEGAL_TITLE.privacy}
      effective="2026-10-04"
      lede="Questa informativa spiega quali informazioni Lexema tratta quando usi lexema.fyi, perché e per quanto tempo."
      sections={[
        {
          id: "information",
          title: "Informazioni che trattiamo",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>
                Lexema non ha account utente e non usa pubblicità, strumenti di analisi né cookie di tracciamento.
                Trattiamo soltanto:
              </p>
              <ul className={LEGAL_ITEMS}>
                <LegalItem mark="a">
                  il tuo indirizzo IP, in modo transitorio, per limitare il numero di richieste che un singolo
                  visitatore può fare. Non viene conservato;
                </LegalItem>
                <LegalItem mark="b">
                  quando segnali un errore o suggerisci una correzione: la voce, l’opzione che hai scelto,
                  l’eventuale nota che scrivi e, per un’ora, un codice <span className={LEGAL_UNBROKEN}>non reversibile</span> derivato dal tuo
                  indirizzo IP, usato solo per limitare il numero di segnalazioni all’ora.
                </LegalItem>
              </ul>
            </>
          ),
        },
        {
          id: "purpose",
          title: "Finalità e base giuridica",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Trattiamo queste informazioni per far funzionare il servizio, proteggerlo dagli abusi ed esaminare gli
              errori segnalati. La base giuridica è il nostro legittimo interesse a offrire un dizionario affidabile
              (articolo 6, paragrafo 1, lettera f, del GDPR).
            </p>
          ),
        },
        {
          id: "providers",
          title: "Fornitori di servizi",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Lexema è ospitato da Cloudflare, Inc., che tratta le richieste per nostro conto e può conservare log di
              sicurezza di breve durata. I moduli di segnalazione sono protetti da Cloudflare Turnstile. Non vendiamo
              né condividiamo informazioni con nessun altro.
            </p>
          ),
        },
        {
          id: "retention",
          title: "Conservazione",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              I conteggi delle richieste scadono entro pochi minuti. Il codice derivato dal tuo indirizzo IP viene
              cancellato un’ora dopo l’invio di una segnalazione. Le segnalazioni stesse sono conservate come
              registro delle correzioni al dizionario; l’eventuale nota che hai scritto viene cancellata non appena la
              segnalazione è risolta.
            </p>
          ),
        },
        {
          id: "rights",
          title: "I tuoi diritti",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Poiché Lexema non conserva il tuo indirizzo IP né alcun account, in genere non possiamo collegare a te
              le informazioni conservate. Finché una segnalazione non è risolta, puoi chiederci di rimuovere una nota
              che hai scritto, usando l’indirizzo qui sotto. Hai anche il diritto di proporre reclamo alla tua
              autorità per la protezione dei dati.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Modifiche",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Possiamo aggiornare questa informativa. La data di entrata in vigore indicata sopra mostra quando è
              cambiata l’ultima volta.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contatti",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>Per qualsiasi domanda su questa informativa, scrivi a:</p>
              <p className={LEGAL_ADDRESS}>
                <a className={LINK} href={`mailto:${PRIVACY_EMAIL}`}>
                  {PRIVACY_EMAIL}
                </a>
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
