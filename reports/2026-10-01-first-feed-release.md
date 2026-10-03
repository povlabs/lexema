# The first feed release: new words and real fixes from it-78385b62

Measured 2026-10-01 for [#377](https://github.com/povlabs/lexema/issues/377),
on a laptop. Huey's rule: Lexema is a simple dictionary, so take from the
September file what clearly helps a reader and skip the rest. The rule is
`feed-selection/v1` ([src/update/selection.ts](../src/update/selection.ts)).
`pnpm run update:select` sorted every change of the diff by it, and
`pnpm run update:apply --ids` applied the 268 it takes, through the apply of
[#18](https://github.com/povlabs/lexema/issues/18)
([the runbook](../docs/UPDATE_THE_DICTIONARY.md)).

## What was read

| | |
|---|---|
| Master | `it-0c432803`: a copy of the full local dev state, `.data/full-state`, after `pnpm run hide:records` hid its 23 records in another language ([#390](https://github.com/povlabs/lexema/pull/390)) |
| Later release | `it-78385b62`, the September file of [the diff report](2026-10-01-update-diff-september.md) |
| Pages for the language rule | `itwiktionary-20260901-pages-articles.xml.bz2`, 71,291,038 bytes, SHA-1 `c72d2411b1de9df8e8b3d62af0efa24862c59f68` as Wikimedia publishes it: the dump the September build log names |
| Ids taken | [2026-10-01-first-feed-selection.ids](2026-10-01-first-feed-selection.ids), 268 |

The diff found what [the diff report](2026-10-01-update-diff-september.md)
found: 259 new words, 693 changed senses, 538,858 other changes, 33 lost
words, 1,299 ambiguous groups and 18,147 unchanged records.

The rule judged every new and changed record with the language rule of
[#29](https://github.com/povlabs/lexema/issues/29) on the September pages. It
found none of them in another language, and none of them would replace a
hidden record, so those two buckets are empty.

## The local apply

`pnpm run update:apply` printed `applied 268 change(s) from it-78385b62 to
it-0c432803` after reading the master back. It wrote 268 records, 54 of them
replacing a record, with these rows, all under `it-78385b62`:

| Table | Rows |
|---|---:|
| source_record | 268 |
| source_record_json | 268 |
| lookup_form | 1,616 |
| form_of_edge | 75 |
| sense | 347 |
| sense_gloss | 347 |
| sense_label | 138 |
| grammar_claim | 5,871 |
| accent_fold | 15 |
| typo_key | 1,926 |

Every applied row names the release it came from: `source_record.release_id`
is `it-78385b62` on all 268 records, and `applied_change` holds 268 rows, 214
`new` and 54 `changed`, each naming `it-78385b62`. The release's
`source_release` row is `partial`, from dump `itwiktionary-20260901`
(`recorded`), retrieved 2026-10-01T15:02:07Z.

The first try of this apply failed before writing anything: D1 refused a read
of the nearby indexes as too long (`SQLITE_TOOBIG`, over 100 KB), and the
INSERT of 268 stored lines, 200 to a statement, would have been refused too.
The apply now splits both by bytes (`boundedInserts` and `inRuns` in
[src/update/apply.ts](../src/update/apply.ts)).

## The word pages

The Worker built from this branch, on port 8797, served the applied copy with
`LEXEMA_RELEASE=it-0c432803`. Each page answered 200. The line is the one
`lookup` answers for the reading.

| Word | Change | The page shows | Line |
|---|---|---|---|
| antifurto | new noun, beside our adjective | *Sostantivo · maschile, singolare*: "apparecchio adibito a rendere meno possibile un furto", its forms, etymology and the synonym *allarme* | `it-78385b62:462516` |
| acqua tonica | new | *Locuzione nominale · femminile*: "(gastronomia) bibita analcolica composta da acqua addizionata ad anidride carbonica, zucchero e aromi naturali" | `it-78385b62:1345` |
| allografo | new noun and adjective | the noun's three definitions and the adjective's one, with their forms | `it-78385b62:801658`, `:801659` |
| -zione | new | *Suffisso*: "suffisso per formare nomi da verbi", with its examples | `it-78385b62:800542` |
| aggressive | new | *Aggettivo, forma flessa · femminile, plurale*: "femminile plurale di aggressivo", with the forms of *aggressivo* | `it-78385b62:3800` |
| adorno | fills-gloss | the adjective: "provvisto di ornamenti", where ours was the "definizione mancante" placeholder | `it-78385b62:219187` |
| canasta | fills-gloss | "(giochi) gioco di carte", where ours was the placeholder | `it-78385b62:602570` |
| bignè | fills-gloss | "(gastronomia) dolci di pasta choux, …", where ours was the placeholder | `it-78385b62:601510` |
| baciare | fills-gloss | sense 2, "avere un effetto positivo su qualcuno o qualcosa, in modo breve o delicato", where ours was the placeholder | `it-78385b62:3089` |
| grumo | adds-sense | a second sense, "coagulo di sangue" | `it-78385b62:495418` |

## The apply to the shared dictionary

No agent ran it. For Huey, from the repository root, with the September file
at hand (`it-78385b62`, its SHA-256 in
[the diff report](2026-10-01-update-diff-september.md)):

```sh
pnpm --dir web exec wrangler d1 time-travel info lexema-dictionary
SEED_REMOTE=lexema-dictionary pnpm run update:apply <path to the September it-extract.jsonl.gz> --ids reports/2026-10-01-first-feed-selection.ids
```

Keep the bookmark the first prints; the runbook says how to go back with it.
The apply runs the diff again, and refuses, writing nothing, if any id is not
a change the shared dictionary shows.

On the local copy the apply's SQL changed 12,590 rows. Counted with every
index entry it can touch, the most D1 can bill is 38,969 rows written: the
rows written to each table, times one plus its indexes (`pragma_index_list`).
That is 0.08% of the 50 million rows written a month Workers Paid includes, so
it costs nothing; past the included rows it would be $0.04, at $1.00 a
million ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)).
The diff the apply runs first reads the master's 560,357 records and the lines
of about 540,000 of them: around 1.1 million of the 25 billion rows read a
month included.

## The selection

Rule `feed-selection/v1` (src/update/selection.ts) over it-78385b62 against the master it-0c432803;
the language rule read itwiktionary-20260901, the dump it-78385b62 was built from.

| Group | Bucket | Count |
|---|---|---:|
| Applied | new-word | 214 |
| Applied | fills-gloss | 32 |
| Applied | adds-sense | 22 |
| Applied | **total** | **268** |
| Skipped, new or changed senses | no-real-gloss | 46 |
| Skipped, new or changed senses | form-of-target-missing | 5 |
| Skipped, new or changed senses | glosses-same | 370 |
| Skipped, new or changed senses | formatting-only | 11 |
| Skipped, new or changed senses | rewording | 246 |
| Skipped, new or changed senses | fewer-senses | 5 |
| Skipped, new or changed senses | no-new-gloss | 1 |
| Skipped, new or changed senses | **total** | **684** |
| Skipped | senses the same (other fields changed) | 538858 |
| Skipped | lost word, kept | 33 |
| Skipped | ambiguous group, more unmatched later records than ours | 5 |
| Skipped | ambiguous group, more of our unmatched records than later ones | 0 |
| Skipped | ambiguous group, as many on each side, two or more | 1294 |
| Unchanged | | 18147 |

## Applied

### new-word (214)

A new Italian word with a real gloss. The first 10 by word:

| Id | Word | Part of speech | Later |
|---|---|---|---|
| new-d13ccae74c9d | -iera | suffix | 1. si aggiunge ai sostantivi per formare altri sostantivi concreti |
| new-418646f92b1e | -zione | suffix | 1. suffisso per formare nomi da verbi |
| new-951bfdadc86b | a richiesta | adv_phrase | 1. per manifesta voglia |
| new-49b9ef1b1054 | abbinata | adj | 1. femminile di abbinato |
| new-d72ffe5fa716 | abbinata | verb | 1. participio passato femminile di abbinare |
| new-bdcafdd700d9 | acqua tonica | phrase | 1. bibita analcolica composta da acqua addizionata ad anidride carbonica… |
| new-3b67c65cf8d3 | adempienti | adj | 1. plurale di adempiente |
| new-54ed1c03c563 | aggressive | adj | 1. femminile plurale di aggressivo |
| new-3feb6aae7766 | allografo | adj | 1. scritto da una persona diversa da chi lo sottoscrive |
| new-a2f59bcbb1f5 | allografo | noun | 1. modo diverso per rappresentare lo stesso fonema, ad es. ⟨c⟩ e ⟨ch⟩ pe…<br>2. modo diverso per scrivere la stessa parola<br>3. documento scritto da una persona diversa da chi lo sottoscrive |

### fills-gloss (32)

Ours shows no real gloss, or a placeholder or headword-line sense, and the later record a real one. The first 10 by word:

| Id | Word | Part of speech | Ours | Later |
|---|---|---|---|---|
| chg-f914a14f184b | -genesi | suffix | 1. definizione mancante; se vuoi, aggiungila tu | 1. seconda parte di lemmi formati da due parole accostate, particolarmen… |
| chg-f542ddcc81b1 | adorno | adj | 1. definizione mancante; se vuoi, aggiungila tu | 1. provvisto di ornamenti |
| chg-b722d7b37d69 | baciare | verb | 1. accostare le labbra su qualcuno o qualcosa per esprimere amore, affet…<br>2. definizione mancante; se vuoi, aggiungila tu | 1. accostare le labbra su qualcuno o qualcosa per esprimere amore, affet…<br>2. avere un effetto positivo su qualcuno o qualcosa, in modo breve o del… |
| chg-81bb58b7b49a | banderuola | noun | 1. definizione mancante; se vuoi, aggiungila tu<br>2. Persona che cambia facilmente idea a seconda delle convenienze | 1. bandierina metallica sul tetto di un edificio che indica la direzione…<br>2. persona che cambia facilmente idea a seconda delle convenienze |
| chg-111756b35842 | bignè | noun | 1. definizione mancante; se vuoi, aggiungila tu | 1. dolci di pasta choux, solitamente grandi quanto un pugno, cavi all’in… |
| chg-cb61915d011c | cananeo | adj | 1. definizione mancante; se vuoi, aggiungila tu | 1. che è attinente ai Cananei |
| chg-89742cf07824 | canasta | noun | 1. definizione mancante; se vuoi, aggiungila tu | 1. gioco di carte |
| chg-bc7a9e5c4cbf | carminio | noun | 1. definizione mancante; se vuoi, aggiungila tu | 1. colorante rosso naturale |
| chg-4431111ade51 | commuoversi | verb | 1. definizione mancante; se vuoi, aggiungila tu | 1. commozione mista a gioia sino a suscitare pianto e lacrime o singhioz… |
| chg-4b9dbce9153f | distillato | noun | 1. definizione mancante; se vuoi, aggiungila tu | 1. la frazione che, durante la distillazione, è stata vaporizzata e poi …<br>2. acquavite |

### adds-sense (22)

The later record has more real senses, one of them a gloss we do not have. The first 10 by word:

| Id | Word | Part of speech | Ours | Later |
|---|---|---|---|---|
| chg-719f8db26ebb | aristocrazia | noun | 1. forma di governo dove il potere supremo è nelle mani di poche persone… | 1. forma di governo dove il potere supremo è nelle mani di poche persone…<br>2. classe privilegiata per discendenza<br>3. superiorità intellettuale o morale<br>(+1 more) |
| chg-671244243223 | beghina | noun | 1. donna seguace di un movimento spirituale e caritativo sorto nell'XII … | 1. donna seguace di un movimento spirituale e caritativo sorto nell'XII …<br>2. donna che esibisce superficialmente e solo formalmente religiosità; b… |
| chg-5e7203197062 | camper | noun | 1. più correttamente autocaravan è un mezzo di trasporto, classificato d… | 1. più correttamente autocaravan è un mezzo di trasporto, classificato d…<br>2. un Camper Van di lusso conferisce a questo mezzo un Design futuristic… |
| chg-aa4efde12d7e | centrale | noun | 1. impianto di produzione e raccolta di beni e servizi da cui parte la d… | 1. impianto di produzione e raccolta di beni e servizi da cui parte la d…<br>2. centro di smistamento |
| chg-6f0b5dda3e59 | cucina | noun | 1. insieme di pratiche e tradizioni legate alla cottura (e più in genera…<br>2. luogo o stanza adibito/a al cucinare<br>3. attrezzatura a fornelli per cucinare i cibi | 1. insieme di pratiche e tradizioni legate alla cottura (e più in genera…<br>2. luogo o stanza adibito/a al cucinare<br>3. fornello<br>(+1 more) |
| chg-f6d9da14cdd4 | deprimente | adj | 1. che provoca debolezza | 1. (di individuo) che suscita avvilimento a chi lo sente o chi le sta ac…<br>2. che fa cadere le braccia<br>3. (di farmaco) che ha un effetto sedativo sul sistema nervoso |
| chg-ef8c8bf05160 | donatore | noun | 1. chi dona<br>2. specie chimica in grado di donare elettroni ad un'altra specie chimic… | 1. chi dona<br>2. persona dal cui corpo viene prelevato un organo o un tessuto a scopo …<br>3. specie chimica in grado di donare elettroni ad un'altra specie chimic… |
| chg-aef5500baf0c | grumo | noun | 1. piccolo accumulo di materia | 1. piccolo accumulo di materia<br>2. coagulo di sangue |
| chg-ecd05a1dc1d2 | inerente | adj | 1. che riguarda qualcosa | 1. che è insito in qualcosa<br>2. che si riferisce |
| chg-b6d933196529 | legno | noun | 1. materiale ricavato dal fusto delle piante ed utilizzato per fabbricar…<br>2. pezzo, bastone di legno<br>3. imbarcazione costruita in legno<br>(+1 more) | 1. materiale ricavato dal fusto delle piante ed utilizzato per fabbricar…<br>2. pezzo, bastone di legno<br>3. imbarcazione costruita in legno<br>(+2 more) |

## Skipped

### no-real-gloss (46)

No sense of the later record has a real gloss. The first 10 by word:

| Id | Word | Part of speech | Later |
|---|---|---|---|
| new-1d36859c4978 | a sbalzi | adv_phrase | 1. definizione mancante; se vuoi, aggiungila tu |
| new-dcb2c77794cd | aerotrasportato | adj | 1. definizione mancante; se vuoi, aggiungila tu |
| new-ec479f18844b | asserragliarsi | verb | 1. definizione mancante; se vuoi, aggiungila tu |
| new-f222a7164647 | assoggettamento | noun | 1. definizione mancante; se vuoi, aggiungila tu |
| new-1f45adfdabcd | biancore | noun | 1. definizione mancante; se vuoi, aggiungila tu |
| new-5bcc8bb52385 | brigidino | noun | 1. definizione mancante; se vuoi, aggiungila tu |
| new-f504e6c04c6d | castellano | noun | 1. definizione mancante; se vuoi, aggiungila tu |
| new-f8e38cc7f3d6 | cicatrizzante | adj | 1. definizione mancante; se vuoi, aggiungila tu |
| new-1d683ec8ecad | ciclostilato | adj | 1. definizione mancante; se vuoi, aggiungila tu |
| new-8e85ac1a0d4b | ciclostilato | noun | 1. definizione mancante; se vuoi, aggiungila tu |

### form-of-target-missing (5)

A form-of whose target no Italian headword of the dictionary or of this selection has.

| Id | Word | Part of speech | Later |
|---|---|---|---|
| new-ac4c5f7d47b7 | cirnechi | noun | 1. plurale di cirneco |
| new-a5d39a7d4579 | flati | noun | 1. plurale di flato |
| new-7fba7c05bd14 | pornovendette | noun | 1. plurale di pornovendetta |
| new-b2ac30bf912f | ricucita | verb | 1. participio passato femminile di ricucire |
| new-593d1ec7156e | spinoni | noun | 1. plurale di spinone |

### glosses-same (370)

The real glosses are the same; only examples, tags or links differ. The first 10 by word:

| Id | Word | Part of speech | Ours | Later |
|---|---|---|---|---|
| chg-f93f7b88942a | 1 | noun | 1. l'ora successiva alla mezzanotte; l'uso in cifre è quasi esclusivamen…<br>2. l'ora successiva a mezzogiorno, raramente scritta in cifre; vedi una,… | 1. l'ora successiva alla mezzanotte; l'uso in cifre è quasi esclusivamen…<br>2. l'ora successiva a mezzogiorno, raramente scritta in cifre; vedi una,… |
| chg-da53a358cc72 | a | prep | 1. indica stato in luogo<br>2. indica moto a luogo<br>3. indica il tempo in cui si verifica un'azione<br>(+9 more) | 1. indica stato in luogo<br>2. indica moto a luogo<br>3. indica il tempo in cui si verifica un'azione<br>(+9 more) |
| chg-d93a8a7f79d8 | abbacchiatura | noun | 1. operazione, azione o effetto dell'abbacchiare | 1. operazione, azione o effetto dell'abbacchiare |
| chg-57054738bd1c | abbaione | noun | 1. chi abbaia<br>2. scherno | 1. chi abbaia<br>2. scherno |
| chg-ce99db37e7b6 | abbambinare | verb | 1. trasportare pesi spostandoli alternativamente sui diversi spigoli. | 1. trasportare pesi spostandoli alternativamente sui diversi spigoli. |
| chg-c6a71a3abae2 | abbandonare | verb | 1. lasciare cose o persone per sempre, o con l'intenzione che sia defini…<br>2. lasciare una persona senza aiuto o protezione, in balia di se stessi<br>3. rinunciare ad un progetto o a un'azione<br>(+12 more) | 1. lasciare cose o persone per sempre, o con l'intenzione che sia defini…<br>2. lasciare una persona senza aiuto o protezione, in balia di se stessi<br>3. rinunciare ad un progetto o a un'azione<br>(+12 more) |
| chg-b6eff523b080 | abbandono | noun | 1. l'atto dell'abbandonare<br>2. il lasciare definitivamente qualcosa, qualcuno<br>3. trascuratezza<br>(+15 more) | 1. l'atto dell'abbandonare<br>2. il lasciare definitivamente qualcosa, qualcuno<br>3. trascuratezza<br>(+15 more) |
| chg-c0e66847fe76 | abbassano | verb | 1. terza persona plurale dell'indicativo presente di abbassare | 1. terza persona plurale dell'indicativo presente di abbassare |
| chg-3c8a8c9c7acc | abbiccì | noun | 1. l'alfabeto e le lettere che lo formano<br>2. la base di una materia<br>3. le prime nozioni basilari della lingua<br>(+1 more) | 1. l'alfabeto e le lettere che lo formano<br>2. la base di una materia<br>3. le prime nozioni basilari della lingua<br>(+1 more) |
| chg-3aa5acdc9aa9 | abbonimento | noun | 1. trattamento atto a migliorare la qualità o il rendimento<br>2. pulizia effettuata nelle botti nuove per il vino per eliminare le sos…<br>3. negli oleifici, pulizia dei filtri effettuata prima e dopo la produzi…<br>(+1 more) | 1. trattamento atto a migliorare la qualità o il rendimento<br>2. pulizia effettuata nelle botti nuove per il vino per eliminare le sos…<br>3. negli oleifici, pulizia dei filtri effettuata prima e dopo la produzi…<br>(+1 more) |

### formatting-only (11)

The real glosses differ only in case, punctuation, spacing or order. The first 10 by word:

| Id | Word | Part of speech | Ours | Later |
|---|---|---|---|---|
| chg-a4bd5f6493d2 | anticodone | noun | 1. sequenza dell'RNA di trasferimento con cui viene riconosciuto un codo… | 1. sequenza dell'RNA di trasferimento con cui viene riconosciuto un codo… |
| chg-94e0190f1e34 | atomismo | noun | 1. insieme di concezioni scientifiche e filosofiche, nate in Grecia nel … | 1. insieme di concezioni scientifiche e filosofiche nate in Grecia nel s… |
| chg-616c19f28a3d | codone | noun | 1. sequenza specifica di tre nucleotidi lungo l'RNA messaggero che codif… | 1. sequenza specifica di tre nucleotidi lungo l'RNA messaggero, che codi… |
| chg-eb9c79981b2d | fovea | noun | 1. Parte centrale della retina,dove sono presenti i coni | 1. parte centrale della retina, dove sono presenti i coni |
| chg-c75801b75622 | giardia | noun | 1. genere di protozoi flagellati che comprende varie specie parassite de… | 1. genere di protozoi flagellati che comprende varie specie parassite de… |
| chg-330d590f6b39 | grossista | noun | 1. chi compra merci e prodotti in grandi quantità da un'azienda produttr… | 1. chi compra merci e prodotti in grandi quantità da un'azienda produttr… |
| chg-e0778df5615c | meccanica del continuo | phrase | 1. ramo della meccanica che studia le proprietà teoriche e pratiche del … | 1. ramo della meccanica che studia le proprietà teoriche e pratiche del … |
| chg-1acaedb82586 | PET | abbrev | 1. Polietilene tereftalato : materia plastica adatta al contatto aliment… | 1. Polietilene tereftalato: materia plastica adatta al contatto alimenta… |
| chg-0699d083dcb8 | reazione chimica | phrase | 1. trasformazione di materia dove una o più specie chimiche dette reagen… | 1. trasformazione di materia dove una o più specie chimiche, dette reage… |
| chg-ea00bddc6646 | skipper | noun | 1. su una barca a vela è colui che ne comanda le manovre, non necessaria… | 1. su una barca a vela è colui che ne comanda le manovre, non necessaria… |

### rewording (246)

As many real senses, other wording. The first 10 by word:

| Id | Word | Part of speech | Ours | Later |
|---|---|---|---|---|
| chg-982d6352949f | abbordabile | adj | 1. che può essere abbordato<br>2. di oggetto dal prezzo accessibile | 1. che può essere abbordato<br>2. che è accessibile |
| chg-f5e2657bfc8b | accentrare | verb | 1. portare verso un luogo unico, riunire;<br>2. (diritto) riunire i poteri in un solo organo; | 1. portare verso un luogo unico, riunire;<br>2. riunire i poteri in un solo organo; |
| chg-68a8b1126fe4 | accompagnando | verb | 1. gerundio di accompagnare | 1. gerundio presente di accompagnare |
| chg-897fac1e5d55 | acido grasso | phrase | 1. acido organico a catena alifatica i cui termini superiori si ritrovan… | 1. biomolecola solubile in solventi apolari ma non in acqua, formata dal… |
| chg-92c65247487f | adagio | noun | 1. motto di saggezza popolare<br>2. tempo musicale di andamento molto moderato, meno lento di un largo ma… | 1. motto di saggezza popolare<br>2. tempo musicale di andamento molto moderato, più veloce di un largo ma… |
| chg-ca22ed055f18 | aereo a reazione | phrase | 1. aeroplano dotato di motore a reazione | 1. aeroplano provvisto di motore a reazione |
| chg-5249defc1053 | aerolinea | noun | 1. impresa col compito di trasportare merci e passeggeri in volo con aer… | 1. impresa con l'obiettivo di trasportare merci e passeggeri in volo con… |
| chg-5280ba7b0e7f | aerotecnico | noun | 1. chi produce e ripara le parti meccaniche di un aeromobile | 1. chi progetta e realizza professionalmente parti elettriche e meccanic… |
| chg-622d4f3b5a5e | agente di cambio | phrase | 1. figura professionale della finanza privata, tipica degli anni ottanta… | 1. figura professionale della finanza privata, tipica degli anni ottanta… |
| chg-871cb7215f6a | agglutinante | adj | 1. che unisce mediante il glutine<br>2. che tiene due superfici fortemente adese l'una all'altra<br>3. (di) anticorpo che fa aderire due cellule a scopo diagnostico<br>(+1 more) | 1. che unisce mediante il glutine<br>2. che tiene due superfici fortemente adese l'una all'altra<br>3. (di) anticorpo che fa aderire due cellule a scopo diagnostico<br>(+1 more) |

### fewer-senses (5)

Fewer real senses than ours; nothing is removed.

| Id | Word | Part of speech | Ours | Later |
|---|---|---|---|---|
| chg-8e926e2b4bc3 | civetta | noun | 1. uccello notturno; la sua classificazione scientifica è Athene noctua …<br>2. locandina<br>3. figura araldica convenzionale in cui l'uccello è rappresentato, di no… | 1. uccello notturno; la sua classificazione scientifica è Athene noctua …<br>2. definizione mancante; se vuoi, aggiungila tu<br>3. figura araldica convenzionale in cui l'uccello è rappresentato, di no… |
| chg-a2b0feb09b76 | gastronomia | noun | 1. arte e tecnica di preparare cibi e pietanze<br>2. settore gastronomico<br>3. bottega dove e si vendono cibi già cucinati o cotti | 1. arte e tecnica di preparare cibi e pietanze<br>2. bottega dove e si vendono cibi già cucinati o cotti |
| chg-369a547491ab | gay | adj | 1. detto di persona di orientamento sessuale omosessuale<br>2. che tratta tematiche a sfondo omosessuale<br>3. che riguarda l'omosessualità, ovvero l'amore fra persone dello stesso…<br>(+1 more) | 1. omosessuale, in particolare in senso non dispregiativo |
| chg-c4c0d8b11eb4 | gay | noun | 1. detto di persona omosessuale<br>2. (per estensione) maschio omosessuale | 1. detto di persona omosessuale |
| chg-cf58bc2999c2 | logografo | noun | 1. nell'antica Grecia, storico che presentava in prosa i miti narrati da…<br>2. nell'antica Grecia, chi scriveva orazioni a pagamento, soprattutto di…<br>3. (per estensione) avvocato | 1. nell'antica Grecia, storico che presentava in prosa i miti narrati da… |

### no-new-gloss (1)

More real senses, every one a gloss we already have.

| Id | Word | Part of speech | Ours | Later |
|---|---|---|---|---|
| chg-06bfbb1d145d | bozza | noun | 1. sasso che si protende da un muro<br>2. lieve sporgenza<br>3. prima scrittura, di un disegno, o altro che ha portato ad un risultat… | 1. sasso che si protende da un muro<br>2. lieve sporgenza<br>3. prima scrittura, di un disegno, o altro che ha portato ad un risultat…<br>(+1 more) |

### Senses the same (538858)

Another field changed and no sense did, so no meaning changed. The first 10 by word:

| Id | Word | Part of speech | Fields that differ | Our line | Later line |
|---|---|---|---|---|---|
| chg-8614ac8dbb35 | -a | suffix | etymology_links | it-0c432803:39613 | it-78385b62:39889 |
| chg-8c2801f301e2 | -accio | suffix | etymology_links | it-0c432803:550721 | it-78385b62:551208 |
| chg-024211f626a4 | -aceo | suffix | etymology_links | it-0c432803:550072 | it-78385b62:550559 |
| chg-ae73ebb055ee | -aio | suffix | etymology_links | it-0c432803:106787 | it-78385b62:107122 |
| chg-88829e94fe53 | -algia | suffix | etymology_links | it-0c432803:549135 | it-78385b62:549622 |
| chg-7c7acf5345bb | -alo | suffix | etymology_links | it-0c432803:550737 | it-78385b62:551224 |
| chg-2487a80ae43d | -andria | suffix | etymology_links | it-0c432803:550960 | it-78385b62:551448 |
| chg-9e530c943c92 | -andro | suffix | etymology_links | it-0c432803:550080 | it-78385b62:550567 |
| chg-5665509fa159 | -arca | suffix | etymology_links | it-0c432803:459400 | it-78385b62:459875 |
| chg-61b5a95fe455 | -archia | suffix | etymology_links | it-0c432803:549044 | it-78385b62:549531 |

### Lost words, kept

Every one of them. Ours stay as they are.

| Id | Word | Part of speech | Our line |
|---|---|---|---|
| lost-43c808fd62df | arancio giallastro | noun | it-0c432803:298 |
| lost-5e8f30ced91b | Audrey | name | it-0c432803:627689 |
| lost-0ab9b1e0855d | bianco crema | noun | it-0c432803:17024 |
| lost-de7cfcf005cd | bianco perla | noun | it-0c432803:16884 |
| lost-614f9dd049da | blu cobalto | noun | it-0c432803:16938 |
| lost-5a6b8bcab0b3 | blu colomba | noun | it-0c432803:16939 |
| lost-96dd675d0a27 | blu genziana | noun | it-0c432803:16935 |
| lost-6f5cf0a81fb1 | colpo d'occhio | phrase | it-0c432803:622223 |
| lost-821d6575c513 | componente elettronico | phrase | it-0c432803:453223 |
| lost-7be88152fc95 | composizione architettonica | phrase | it-0c432803:417120 |
| lost-fa5970e9eee5 | DEF | phrase | it-0c432803:458034 |
| lost-e08e2d9865be | extreme | adj | it-0c432803:557507 |
| lost-dbc1533c3441 | extreme | noun | it-0c432803:557508 |
| lost-d50d8a88433a | giallo limone | noun | it-0c432803:16883 |
| lost-0e1848fa0528 | giallo navone | noun | it-0c432803:16890 |
| lost-f29c5e0df4ce | giallo oro | noun | it-0c432803:16880 |
| lost-77191126b162 | giallo scopa | noun | it-0c432803:16894 |
| lost-730cebe1d050 | grigio agata | noun | it-0c432803:17002 |
| lost-46f6db14b402 | grigio cemento | noun | it-0c432803:16998 |
| lost-c28db166a9bd | grigio pietra | noun | it-0c432803:16995 |
| lost-4305cc408290 | grigio traffico b | noun | it-0c432803:17006 |
| lost-7ac1e6e7bb92 | marrone castagna | noun | it-0c432803:17018 |
| lost-595b0de49e8e | nero grafite | noun | it-0c432803:17029 |
| lost-d32b158bf61a | progettazione architettonica | phrase | it-0c432803:404202 |
| lost-f5889e23048c | rosso corallo | noun | it-0c432803:16914 |
| lost-d12b133eb1a8 | rosso fragola | noun | it-0c432803:16917 |
| lost-c01c0910a637 | rosso pomodoro | noun | it-0c432803:16911 |
| lost-d8c1183b2773 | rosso vino | noun | it-0c432803:127 |
| lost-300cee0eb336 | tutto d'un pezzo | phrase | it-0c432803:622827 |
| lost-208c88eccd9e | verde abete | noun | it-0c432803:16952 |
| lost-34d272e5a98f | verde cromo | noun | it-0c432803:16962 |
| lost-160bb1474196 | verde oliva | noun | it-0c432803:419 |
| lost-ca40865f6c99 | verde pino | noun | it-0c432803:16968 |

### Ambiguous: more unmatched later records than ours (5)

| Word | Part of speech | Our lines | Later lines |
|---|---|---|---|
| fluido | adj | it-0c432803:49824 | it-78385b62:50108, it-78385b62:50110 |
| impedimento | noun | it-0c432803:50227 | it-78385b62:50512, it-78385b62:50513 |
| paritario | adj | it-0c432803:486087 | it-78385b62:486570, it-78385b62:486571 |
| torneo | noun | it-0c432803:131196 | it-78385b62:131557, it-78385b62:131558 |
| tumulto | noun | it-0c432803:416719 | it-78385b62:417177, it-78385b62:417178 |

### Ambiguous: as many on each side, two or more (1294)

The first 10 by word:

| Word | Part of speech | Our lines | Later lines |
|---|---|---|---|
| abbacchiare | verb | it-0c432803:31594, it-0c432803:31595 | it-78385b62:31862, it-78385b62:31863 |
| abbagliare | verb | it-0c432803:33614, it-0c432803:33615 | it-78385b62:33884, it-78385b62:33885 |
| abbaglio | noun | it-0c432803:32167, it-0c432803:32168 | it-78385b62:32436, it-78385b62:32437 |
| abbaiare | verb | it-0c432803:33616, it-0c432803:33617 | it-78385b62:33886, it-78385b62:33887 |
| abbaio | noun | it-0c432803:32171, it-0c432803:32172 | it-78385b62:32440, it-78385b62:32441 |
| abbandonati | verb | it-0c432803:64598, it-0c432803:64599 | it-78385b62:64905, it-78385b62:64906 |
| abbarbagliare | verb | it-0c432803:46084, it-0c432803:46085 | it-78385b62:46365, it-78385b62:46366 |
| abbarcare | verb | it-0c432803:46109, it-0c432803:46110 | it-78385b62:46390, it-78385b62:46391 |
| abbassarsi | verb | it-0c432803:24265, it-0c432803:24266 | it-78385b62:24493, it-78385b62:24494 |
| abbioccare | verb | it-0c432803:79117, it-0c432803:79118 | it-78385b62:79437, it-78385b62:79438 |
