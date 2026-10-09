# Meaning senses' form_of edges, removed or pointed at the record's base word — 2026-10-09

Issue [#755](https://github.com/povlabs/lexema/issues/755). Release
`it-0c432803`. Rule `it-form-of-meaning-edge/v1`
([src/italian/formOfMeaningEdge.ts](../src/italian/formOfMeaningEdge.ts)), on
Huey's [ruling](https://github.com/povlabs/lexema/issues/755#issuecomment-6076090404)
of 2026-10-09, "yes", recorded in
[ADR 0030](../.decisions/0030-corrections-may-fix-edges-and-cells.md)'s
amendment of that day. Made with `pnpm run measure:form-of-meaning-edge`
([src/import/measureFormOfMeaningEdge.ts](../src/import/measureFormOfMeaningEdge.ts)),
which also writes the pinned evidence the committed list is made from
([src/italian/formOfMeaningEdgeEvidence.ts](../src/italian/formOfMeaningEdgeEvidence.ts)).

## What the rule reads

The extractor tags every sense of a form record as a form, so a sense whose
gloss states a meaning still carries a `form_of` edge, to a word the gloss
merely mentions. `mele`'s senses 1 to 3, "guance, soprattutto nei bambini:",
"natiche o mammelle tondeggianti, ..." and "percosse", name `bambini`,
`tondeggianti` and `percosse`; `scandinava`'s only sense, "relativa alla
Scandinavia", names `Scandinavia`.

The rule reads every sense of an Italian record that declares an edge and
whose first gloss has no form opening (`glossBase`), so rules
`it-form-of-gloss-edge` v1 and v2 never read it: 1726 senses on `it-0c432803`.
A sense is a **meaning sense** when no word of its gloss names a form
(`formTerm`): a word beginning with a form's name ("plurale", "femminile",
"participio", "superlativo", "variante", "verbo", ...), an abbreviation or
pointer word ("pl", "pers", "part", "f", "forma", "vedi", ...), or a
misspelling of a form's name within two edits ("pliurale", "fmminile").
That test keeps out the form glosses v1/v2 miss, such as "terza persona
singolare, modo indicativo, tempo presente del verbo salire" (`sale`), "Plural
form of mattutino" (`mattutini`) and "femminile pluraledi disabitato"
(`disabitate`). It errs toward a form: a meaning gloss that uses such a word,
such as `bambina`'s "essere umano prepubere di sesso femminile", keeps its
edge, and is listed below as `form-gloss` with the word that kept it.

A meaning sense is then corrected, unless another correction already sets its
edge, it declares several edges, its edge already names the record's base
word, or the record's page has no revision in `itwiktionary-20260701`:

- **Pointed at the record's base word** where the record has a real form sense
  naming exactly one base word B (a form opening naming B after "di", an edge
  that is B alone after v2 and the hand entries, and B not the record's own
  word), B's Italian record lists the word, and B's page is in the dump. The
  correction cites the record's page, which shows the form sense's gloss, and
  B's page, which lists the word, and keeps the source's edge verbatim.
- **Removed** otherwise. The correction keeps the source's edge verbatim and
  cites the record's page, which shows the meaning gloss. A lookup reads the
  sense as having no edge.

No record's form senses name more than one base word (`several-bases`: 0). No
meaning sense declares more than one edge (`several-edges`: 0), and none is
already set by another correction (`already-corrected`: 0).

## The count

Removed: **342** edges. Pointed at the record's own base word: **258** edges.
600 senses of 468 records in all. In the shared dictionary, `correct:records`
writes 599 of them, on 467 records, as the pull request plan check counted:
one entry is not written there, and `correct:records` reports why.

The triage estimate on the issue was about 631 senses, 275 of the `mele`
shape. The difference is the rule's exact class: its form words keep out more
form glosses than the triage's keyword filter did, and a base word must be
confirmed by its own table and page before an edge points at it, so 11
`mele`-shaped senses are removed instead (`base-not-confirmed`) and 4 already
name the base word (`names-base`).

Rule `it-form-of-meaning-edge/v1` on `it-0c432803` reads 1726 senses that declare an edge and whose gloss has no form opening. It corrects 600 senses of 468 records: it removes 342 edges and points 258 at the record's own base word. It leaves 1126 senses alone.

| Correction | Senses |
|---|---|
| edges pointed at the record's own base word (`redirected`) | 258 |
| edges removed: the record has no real form sense (`no-form-sense`) | 331 |
| edges removed: the record's form senses name more than one base word (`several-bases`) | 0 |
| edges removed: one base word, but its table does not list the word or its page is not in the dump (`base-not-confirmed`) | 11 |

| Left alone because | Senses |
|---|---|
| a hand entry or rule `it-form-of-gloss-edge` already sets this sense's edge (`already-corrected`) | 0 |
| a word of the gloss names a form (`form-gloss`) | 1122 |
| the sense declares several edges (`several-edges`) | 0 |
| its edge already names the record's base word (`names-base`) | 4 |
| the record's page is not in the dump, so there is no page to cite (`page-not-in-dump`) | 0 |

## Edges pointed at the record's own base word

| Line | Word | POS | Sense | Gloss | Edge it replaces | Edge to | Form sense | Cited pages |
|---|---|---|---|---|---|---|---|---|
| 2257 | `capelli` | noun | 1 | l'insieme dei peli che coprono il cranio umano | `umano` | `capello` | 0 | [capelli](https://it.wiktionary.org/w/index.php?title=capelli&oldid=4069459), [capello](https://it.wiktionary.org/w/index.php?title=capello&oldid=4031166) |
| 2295 | `bambina` | noun | 2 | donna dolce e vezzosa | `vezzosa` | `bambino` | 0 | [bambina](https://it.wiktionary.org/w/index.php?title=bambina&oldid=4008001), [bambino](https://it.wiktionary.org/w/index.php?title=bambino&oldid=4067923) |
| 2295 | `bambina` | noun | 3 | persona buona, onesta, sincera, innocente | `innocente` | `bambino` | 0 | [bambina](https://it.wiktionary.org/w/index.php?title=bambina&oldid=4008001), [bambino](https://it.wiktionary.org/w/index.php?title=bambino&oldid=4067923) |
| 3209 | `pomi` | noun | 1 | mammelle tondeggianti, specialmente riferito a ragazza o giovane donna | `mammelle` | `pomo` | 0 | [pomi](https://it.wiktionary.org/w/index.php?title=pomi&oldid=3432698), [pomo](https://it.wiktionary.org/w/index.php?title=pomo&oldid=4043776) |
| 3348 | `grazie` | noun | 1 | dovuto rispetto e/o sentita e cordiale affezione | `affezione` | `grazia` | 0 | [grazie](https://it.wiktionary.org/w/index.php?title=grazie&oldid=4053075), [grazia](https://it.wiktionary.org/w/index.php?title=grazia&oldid=4047940) |
| 5527 | `guide` | noun | 1 | sergenti d'ala di ogni reparto | `reparto` | `guida` | 0 | [guide](https://it.wiktionary.org/w/index.php?title=guide&oldid=3951294), [guida](https://it.wiktionary.org/w/index.php?title=guida&oldid=4076712) |
| 5527 | `guide` | noun | 2 | compagnia a cavallo di uomini esperti conoscitori di un paese | `esperti` | `guida` | 0 | [guide](https://it.wiktionary.org/w/index.php?title=guide&oldid=3951294), [guida](https://it.wiktionary.org/w/index.php?title=guida&oldid=4076712) |
| 5527 | `guide` | noun | 3 | volontari a cavallo del corpo dei Cacciatori delle Alpi | `Alpi` | `guida` | 0 | [guide](https://it.wiktionary.org/w/index.php?title=guide&oldid=3951294), [guida](https://it.wiktionary.org/w/index.php?title=guida&oldid=4076712) |
| 5527 | `guide` | noun | 4 | cavalleggeri di un reggimento costituito nel 1859 | `reggimento` | `guida` | 0 | [guide](https://it.wiktionary.org/w/index.php?title=guide&oldid=3951294), [guida](https://it.wiktionary.org/w/index.php?title=guida&oldid=4076712) |
| 10076 | `curve` | noun | 1 | rotondità | `rotondità` | `curva` | 0 | [curve](https://it.wiktionary.org/w/index.php?title=curve&oldid=3972644), [curva](https://it.wiktionary.org/w/index.php?title=curva&oldid=4062225) |
| 11165 | `figure` | noun | 1 | dalla lingua inglese, diffuso tra i nerd più esperti ma non soltanto, per esempio anche nei giochi di ruolo con relativi dadi e carte, il termine si riferisce perlopiù a “statuette in plastica, gomma, ecc” raffiguranti qualsiasi personaggio, celebre o meno per i fumetti, i cartoon ovvero i cartoni animati, film, favole e storie varie o leggende, tradizioni differenti… insomma quasi qualunque cosa attinente alla realtà o alla fantasia per quasi qualsiasi “categoria”; in genere sono colorate, talvolta addirittura “fatte a mano”: possono essere “da collezione”, per giocare, i giocattoli ne comprendono “lo stile”, appunto per confronti ludici per “i più grandi”, come “soprammobili”, per moda o “semplice sfizio”. Ve ne sono più pregiate anche “in vetro o cristallo”, in ceramica, metalli vari, ecc. In linea di principio lo sono anche i peluche ed alcuni gadget | `gadget` | `figura` | 0 | [figure](https://it.wiktionary.org/w/index.php?title=figure&oldid=4061467), [figura](https://it.wiktionary.org/w/index.php?title=figura&oldid=4043091) |
| 11630 | `fuse` | adj | 1 | valvola fusibile, fusibile | `fusibile` | `fuso` | 0 | [fuse](https://it.wiktionary.org/w/index.php?title=fuse&oldid=3975315), [fuso](https://it.wiktionary.org/w/index.php?title=fuso&oldid=3978802) |
| 11630 | `fuse` | adj | 2 | spoletta | `spoletta` | `fuso` | 0 | [fuse](https://it.wiktionary.org/w/index.php?title=fuse&oldid=3975315), [fuso](https://it.wiktionary.org/w/index.php?title=fuso&oldid=3978802) |
| 11630 | `fuse` | adj | 3 | miccia | `miccia` | `fuso` | 0 | [fuse](https://it.wiktionary.org/w/index.php?title=fuse&oldid=3975315), [fuso](https://it.wiktionary.org/w/index.php?title=fuso&oldid=3978802) |
| 11631 | `fuse` | verb | 1 | fondere, fondersi | `fondersi` | `fondere` | 0 | [fuse](https://it.wiktionary.org/w/index.php?title=fuse&oldid=3975315), [fondere](https://it.wiktionary.org/w/index.php?title=fondere&oldid=3995506) |
| 11631 | `fuse` | verb | 2 | fondersi, amalgamarsi, unirsi | `unirsi` | `fondere` | 0 | [fuse](https://it.wiktionary.org/w/index.php?title=fuse&oldid=3975315), [fondere](https://it.wiktionary.org/w/index.php?title=fondere&oldid=3995506) |
| 16007 | `strumenti` | noun | 1 | termine utilizzato nei menù di software | `software` | `strumento` | 0 | [strumenti](https://it.wiktionary.org/w/index.php?title=strumenti&oldid=4036268), [strumento](https://it.wiktionary.org/w/index.php?title=strumento&oldid=4210404) |
| 22091 | `signora` | noun | 1 | donna sposata, divorziata o vedova | `vedova` | `signore` | 0 | [signora](https://it.wiktionary.org/w/index.php?title=signora&oldid=3850083), [signore](https://it.wiktionary.org/w/index.php?title=signore&oldid=4001659) |
| 22091 | `signora` | noun | 2 | per la società sportiva italiana Juventus | `Juventus` | `signore` | 0 | [signora](https://it.wiktionary.org/w/index.php?title=signora&oldid=3850083), [signore](https://it.wiktionary.org/w/index.php?title=signore&oldid=4001659) |
| 22469 | `spade` | noun | 1 | spadaccini | `spadaccini` | `spada` | 0 | [spade](https://it.wiktionary.org/w/index.php?title=spade&oldid=3921009), [spada](https://it.wiktionary.org/w/index.php?title=spada&oldid=4040987) |
| 22469 | `spade` | noun | 2 | uno dei quattro semi delle carte da gioco italiane e spagnole | `spagnole` | `spada` | 0 | [spade](https://it.wiktionary.org/w/index.php?title=spade&oldid=3921009), [spada](https://it.wiktionary.org/w/index.php?title=spada&oldid=4040987) |
| 37618 | `azzurri` | adj | 1 | di sportivo che appartiene ad una squadra nazionale dell'Italia | `Italia` | `azzurro` | 0 | [azzurri](https://it.wiktionary.org/w/index.php?title=azzurri&oldid=3869165), [azzurro](https://it.wiktionary.org/w/index.php?title=azzurro&oldid=3986985) |
| 37619 | `azzurri` | noun | 1 | di sportivo che appartiene ad una squadra nazionale dell'Italia | `Italia` | `azzurro` | 0 | [azzurri](https://it.wiktionary.org/w/index.php?title=azzurri&oldid=3869165), [azzurro](https://it.wiktionary.org/w/index.php?title=azzurro&oldid=3986985) |
| 40169 | `palle` | noun | 1 | testicoli | `testicoli` | `palla` | 0 | [palle](https://it.wiktionary.org/w/index.php?title=palle&oldid=4035752), [palla](https://it.wiktionary.org/w/index.php?title=palla&oldid=4070205) |
| 40169 | `palle` | noun | 2 | coraggio | `coraggio` | `palla` | 0 | [palle](https://it.wiktionary.org/w/index.php?title=palle&oldid=4035752), [palla](https://it.wiktionary.org/w/index.php?title=palla&oldid=4070205) |
| 40170 | `coglioni` | noun | 1 | testicoli | `testicoli` | `coglione` | 0 | [coglioni](https://it.wiktionary.org/w/index.php?title=coglioni&oldid=4026612), [coglione](https://it.wiktionary.org/w/index.php?title=coglione&oldid=4248979) |
| 40170 | `coglioni` | noun | 2 | cretini | `cretini` | `coglione` | 0 | [coglioni](https://it.wiktionary.org/w/index.php?title=coglioni&oldid=4026612), [coglione](https://it.wiktionary.org/w/index.php?title=coglione&oldid=4248979) |
| 40512 | `ossa` | noun | 1 | il corpo umano | `umano` | `osso` | 0 | [ossa](https://it.wiktionary.org/w/index.php?title=ossa&oldid=4060306), [osso](https://it.wiktionary.org/w/index.php?title=osso&oldid=4004364) |
| 40512 | `ossa` | noun | 2 | le spoglie mortali | `mortali` | `osso` | 0 | [ossa](https://it.wiktionary.org/w/index.php?title=ossa&oldid=4060306), [osso](https://it.wiktionary.org/w/index.php?title=osso&oldid=4004364) |
| 41337 | `piedi` | noun | 1 | segmento distale dell'arto inferiore del corpo umano | `umano` | `piede` | 0 | [piedi](https://it.wiktionary.org/w/index.php?title=piedi&oldid=4043646), [piede](https://it.wiktionary.org/w/index.php?title=piede&oldid=4076206) |
| 41787 | `sarda` | noun | 0 | pesce marino commestibile diffuso in tutto il Mediterraneo (Sarda sarda) | `Mediterraneo` | `sardo` | 1 | [sarda](https://it.wiktionary.org/w/index.php?title=sarda&oldid=3880201), [sardo](https://it.wiktionary.org/w/index.php?title=sardo&oldid=4067873) |
| 42264 | `mele` | noun | 1 | guance, soprattutto nei bambini: | `bambini` | `mela` | 0 | [mele](https://it.wiktionary.org/w/index.php?title=mele&oldid=3869166), [mela](https://it.wiktionary.org/w/index.php?title=mela&oldid=4023986) |
| 42264 | `mele` | noun | 2 | natiche o mammelle tondeggianti, soprattutto riferito a ragazza o giovane donna | `tondeggianti` | `mela` | 0 | [mele](https://it.wiktionary.org/w/index.php?title=mele&oldid=3869166), [mela](https://it.wiktionary.org/w/index.php?title=mela&oldid=4023986) |
| 42264 | `mele` | noun | 3 | percosse | `percosse` | `mela` | 0 | [mele](https://it.wiktionary.org/w/index.php?title=mele&oldid=3869166), [mela](https://it.wiktionary.org/w/index.php?title=mela&oldid=4023986) |
| 43469 | `scacchi` | noun | 0 | gioco da tavolo di strategia, giocato da due giocatori con 16 pezzi ciascuno (di varia foggia e valore), su una scacchiera composta da 64 caselle, e il cui scopo è fare scacco matto al Re avversario | `scacco matto` | `scacco` | 1 | [scacchi](https://it.wiktionary.org/w/index.php?title=scacchi&oldid=4052142), [scacco](https://it.wiktionary.org/w/index.php?title=scacco&oldid=3934464) |
| 43805 | `chiacchiere` | noun | 1 | dolci di carnevale così chiamati in Lombardia, detti in altre regioni d'Italia cienci, galani ecc. | `galani` | `chiacchiera` | 0 | [chiacchiere](https://it.wiktionary.org/w/index.php?title=chiacchiere&oldid=4067927), [chiacchiera](https://it.wiktionary.org/w/index.php?title=chiacchiera&oldid=4051930) |
| 45446 | `ricorsi` | noun | 1 | mestruazioni | `mestruazioni` | `ricorso` | 0 | [ricorsi](https://it.wiktionary.org/w/index.php?title=ricorsi&oldid=3934881), [ricorso](https://it.wiktionary.org/w/index.php?title=ricorso&oldid=3991899) |
| 45523 | `denari` | noun | 1 | uno dei quattro semi delle carte da gioco italiane e spagnole | `spagnole` | `denaro` | 0 | [denari](https://it.wiktionary.org/w/index.php?title=denari&oldid=3937501), [denaro](https://it.wiktionary.org/w/index.php?title=denaro&oldid=4013299) |
| 46270 | `alimenti` | noun | 1 | sostegno dovuto per legge ad altri | `legge` | `alimento` | 0 | [alimenti](https://it.wiktionary.org/w/index.php?title=alimenti&oldid=3864187), [alimento](https://it.wiktionary.org/w/index.php?title=alimento&oldid=4008617) |
| 47614 | `armi` | noun | 1 | i denti, i becchi, gli artigli degli animali che, in virtù di essi, sono detti armati | `armati` | `arma` | 0 | [armi](https://it.wiktionary.org/w/index.php?title=armi&oldid=3994588), [arma](https://it.wiktionary.org/w/index.php?title=arma&oldid=4003422) |
| 47684 | `asparagi` | noun | 1 | spilungoni | `spilungoni` | `asparago` | 0 | [asparagi](https://it.wiktionary.org/w/index.php?title=asparagi&oldid=4016380), [asparago](https://it.wiktionary.org/w/index.php?title=asparago&oldid=4023410) |
| 48237 | `cerbiatta` | noun | 1 | giovane donna attraente e dai modi eleganti, molto spesso con occhi scuri | `scuri` | `cerbiatto` | 0 | [cerbiatta](https://it.wiktionary.org/w/index.php?title=cerbiatta&oldid=3839723), [cerbiatto](https://it.wiktionary.org/w/index.php?title=cerbiatto&oldid=3893538) |
| 48272 | `chiara` | noun | 0 | albume dell'uovo | `uovo` | `chiaro` | 1 | [chiara](https://it.wiktionary.org/w/index.php?title=chiara&oldid=3974930), [chiaro](https://it.wiktionary.org/w/index.php?title=chiaro&oldid=4042689) |
| 48282 | `chiavi` | noun | 1 | figura araldica convenzionale costituita da una coppia di chiavi, una d'argento e una d'oro, solitamente poste in decusse che sono l'emblema dei Pontefici: in questo caso possono comparire sia sotto la tiara pontificia sia accollate allo scudo | `tiara` | `chiave` | 0 | [chiavi](https://it.wiktionary.org/w/index.php?title=chiavi&oldid=4016958), [chiave](https://it.wiktionary.org/w/index.php?title=chiave&oldid=3954135) |
| 48486 | `combinata` | noun | 0 | nello sci è una gara composta da diverse prove i risultati delle quali, sommati tra di loro, formano la classifica | `classifica` | `combinato` | 1 | [combinata](https://it.wiktionary.org/w/index.php?title=combinata&oldid=3893620), [combinato](https://it.wiktionary.org/w/index.php?title=combinato&oldid=3871477) |
| 48875 | `coppe` | noun | 1 | uno dei quattro semi delle carte da gioco italiane e spagnole | `spagnole` | `coppa` | 0 | [coppe](https://it.wiktionary.org/w/index.php?title=coppe&oldid=3809695), [coppa](https://it.wiktionary.org/w/index.php?title=coppa&oldid=4051365) |
| 49550 | `energie` | noun | 1 | gli individui che personificano intelligenza, inventiva eccetera | `inventiva` | `energia` | 0 | [energie](https://it.wiktionary.org/w/index.php?title=energie&oldid=3867860), [energia](https://it.wiktionary.org/w/index.php?title=energia&oldid=4018991) |
| 51299 | `logica` | adj | 1 | inerente alla logica | `logica` | `logico` | 0 | [logica](https://it.wiktionary.org/w/index.php?title=logica&oldid=4064368), [logico](https://it.wiktionary.org/w/index.php?title=logico&oldid=4041493) |
| 51765 | `microonde` | noun | 1 | forno che usa le microonde | `forno` | `microonda` | 0 | [microonde](https://it.wiktionary.org/w/index.php?title=microonde&oldid=3885747), [microonda](https://it.wiktionary.org/w/index.php?title=microonda&oldid=3885748) |
| 52362 | `poetessa` | noun | 1 | indovina, sibilla | `sibilla` | `poeta` | 0 | [poetessa](https://it.wiktionary.org/w/index.php?title=poetessa&oldid=3964265), [poeta](https://it.wiktionary.org/w/index.php?title=poeta&oldid=3946898) |
| 53156 | `romana` | noun | 1 | tipo di lattuga (lattuga romana) | `lattuga` | `romano` | 0 | [romana](https://it.wiktionary.org/w/index.php?title=romana&oldid=3864747), [romano](https://it.wiktionary.org/w/index.php?title=romano&oldid=4010937) |
| 53156 | `romana` | noun | 2 | mantello in uso nel XVIII secolo a Venezia | `Venezia` | `romano` | 0 | [romana](https://it.wiktionary.org/w/index.php?title=romana&oldid=3864747), [romano](https://it.wiktionary.org/w/index.php?title=romano&oldid=4010937) |
| 53156 | `romana` | noun | 3 | bilancia romana | `bilancia` | `romano` | 0 | [romana](https://it.wiktionary.org/w/index.php?title=romana&oldid=3864747), [romano](https://it.wiktionary.org/w/index.php?title=romano&oldid=4010937) |
| 53325 | `scienziata` | noun | 1 | donna di scienza | `scienza` | `scienziato` | 0 | [scienziata](https://it.wiktionary.org/w/index.php?title=scienziata&oldid=4015222), [scienziato](https://it.wiktionary.org/w/index.php?title=scienziato&oldid=3922785) |
| 54394 | `storica` | noun | 1 | scrittrice di libri storici | `scrittrice` | `storico` | 0 | [storica](https://it.wiktionary.org/w/index.php?title=storica&oldid=4032937), [storico](https://it.wiktionary.org/w/index.php?title=storico&oldid=4056541) |
| 56784 | `cittadina` | noun | 1 | città d'importanza e dimensioni contenute | `contenute` | `cittadino` | 0 | [cittadina](https://it.wiktionary.org/w/index.php?title=cittadina&oldid=3963154), [cittadino](https://it.wiktionary.org/w/index.php?title=cittadino&oldid=3982889) |
| 56929 | `composta` | noun | 1 | concime a base di letame e terra | `terra` | `composto` | 0 | [composta](https://it.wiktionary.org/w/index.php?title=composta&oldid=4000628), [composto](https://it.wiktionary.org/w/index.php?title=composto&oldid=3974754) |
| 56929 | `composta` | noun | 2 | marmellata di frutta mista | `mista` | `composto` | 0 | [composta](https://it.wiktionary.org/w/index.php?title=composta&oldid=4000628), [composto](https://it.wiktionary.org/w/index.php?title=composto&oldid=3974754) |
| 58098 | `gialla` | adj | 1 | altro nome di sigaretta, soprattutto in romanesco, per via del colore della carta intorno al filtro. | `sigaretta` | `giallo` | 0 | [gialla](https://it.wiktionary.org/w/index.php?title=gialla&oldid=3895819), [giallo](https://it.wiktionary.org/w/index.php?title=giallo&oldid=4069570) |
| 59632 | `medie` | noun | 1 | scuola secondaria di primo grado | `grado` | `media` | 0 | [medie](https://it.wiktionary.org/w/index.php?title=medie&oldid=3979292), [media](https://it.wiktionary.org/w/index.php?title=media&oldid=4009868) |
| 59746 | `mondiali` | noun | 1 | il campionato mondiale di calcio | `campionato mondiale di calcio` | `mondiale` | 0 | [mondiali](https://it.wiktionary.org/w/index.php?title=mondiali&oldid=4066935), [mondiale](https://it.wiktionary.org/w/index.php?title=mondiale&oldid=4067090) |
| 62571 | `pere` | noun | 1 | le mammelle della donna, le tette | `tette` | `pera` | 0 | [pere](https://it.wiktionary.org/w/index.php?title=pere&oldid=3930775), [pera](https://it.wiktionary.org/w/index.php?title=pera&oldid=4002402) |
| 62577 | `tette` | noun | 1 | mammelle della donna, con una connotazione tra il volgare e l'affettuoso, esempio: Walter guardava con passione le tette di Alice | `affettuoso` | `tetta` | 0 | [tette](https://it.wiktionary.org/w/index.php?title=tette&oldid=4029995), [tetta](https://it.wiktionary.org/w/index.php?title=tetta&oldid=3896125) |
| 64504 | `catene` | noun | 1 | limiti auto-imposti ma eticamente né accetti né “sani”, cioè di cui non si è totalmente consapevoli perché in essi “immersi” proprio malgrado | `immersi` | `catena` | 0 | [catene](https://it.wiktionary.org/w/index.php?title=catene&oldid=4066518), [catena](https://it.wiktionary.org/w/index.php?title=catena&oldid=4002004) |
| 64504 | `catene` | noun | 2 | schiavitù, storicamente in particolare dei “neri d’Africa”; per questo oggi molti tra essi esibiscono gioielli d’oro, ovvero “grosse collane” a indicare il contrasto di quella rispetto alla loro emancipazione moderna attuale, ciò nel mondo dello spettacolo come nella musica con il rap ed anche tra le star hollywoodiane | `hollywoodiane` | `catena` | 0 | [catene](https://it.wiktionary.org/w/index.php?title=catene&oldid=4066518), [catena](https://it.wiktionary.org/w/index.php?title=catena&oldid=4002004) |
| 64504 | `catene` | noun | 3 | strumentazione per gli pneumatici delle automobili in caso di meteo “avverso” con abbondanti nevicate | `nevicate` | `catena` | 0 | [catene](https://it.wiktionary.org/w/index.php?title=catene&oldid=4066518), [catena](https://it.wiktionary.org/w/index.php?title=catena&oldid=4002004) |
| 65374 | `piaceri` | noun | 1 | tutto quello che dà una o più piacevoli soddisfazioni | `soddisfazioni` | `piacere` | 0 | [piaceri](https://it.wiktionary.org/w/index.php?title=piaceri&oldid=3879006), [piacere](https://it.wiktionary.org/w/index.php?title=piacere&oldid=3981533) |
| 66313 | `fermi` | noun | 1 | un metro diviso un milione di miliardi | `miliardi` | `fermo` | 0 | [fermi](https://it.wiktionary.org/w/index.php?title=fermi&oldid=3933834), [fermo](https://it.wiktionary.org/w/index.php?title=fermo&oldid=4076781) |
| 67305 | `pinne` | noun | 0 | elementi di raccordo tra il padiglione e la coda di una carrozzeria automobilistica, che hanno la prevalente funzione estetica di sottolineare lo slancio della sagoma | `sagoma` | `pinna` | 2 | [pinne](https://it.wiktionary.org/w/index.php?title=pinne&oldid=4013130), [pinna](https://it.wiktionary.org/w/index.php?title=pinna&oldid=4012753) |
| 67305 | `pinne` | noun | 1 | calzature usate dai subacquei per muoversi efficacemente sott'acqua e, più generalmente, per attività sportive acquatiche (tra cui bodysurfing e nuoto) | `nuoto` | `pinna` | 2 | [pinne](https://it.wiktionary.org/w/index.php?title=pinne&oldid=4013130), [pinna](https://it.wiktionary.org/w/index.php?title=pinna&oldid=4012753) |
| 68134 | `genitori` | noun | 1 | padre e madre | `madre` | `genitore` | 0 | [genitori](https://it.wiktionary.org/w/index.php?title=genitori&oldid=4067048), [genitore](https://it.wiktionary.org/w/index.php?title=genitore&oldid=3939136) |
| 68135 | `fumi` | noun | 1 | annebbiamenti mentali | `mentali` | `fumo` | 0 | [fumi](https://it.wiktionary.org/w/index.php?title=fumi&oldid=3859843), [fumo](https://it.wiktionary.org/w/index.php?title=fumo&oldid=4042935) |
| 68145 | `rifiuti` | noun | 1 | residuato inservibile di trattamenti organici | `inservibile` | `rifiuto` | 0 | [rifiuti](https://it.wiktionary.org/w/index.php?title=rifiuti&oldid=4017084), [rifiuto](https://it.wiktionary.org/w/index.php?title=rifiuto&oldid=4046421) |
| 70004 | `muri` | noun | 1 | limiti auto-imposti per pregiudizi o addirittura per esplicito razzismo | `razzismo` | `muro` | 0 | [muri](https://it.wiktionary.org/w/index.php?title=muri&oldid=3801703), [muro](https://it.wiktionary.org/w/index.php?title=muro&oldid=4048170) |
| 70007 | `appartamenti` | noun | 1 | anticamente, nelle proprietà delle casate nobiliari, erano le camere interne rispetto alle sale dei dialoghi o delle riunioni ed alle stanze di convivio | `convivio` | `appartamento` | 0 | [appartamenti](https://it.wiktionary.org/w/index.php?title=appartamenti&oldid=3931387), [appartamento](https://it.wiktionary.org/w/index.php?title=appartamento&oldid=3933439) |
| 70580 | `quadri` | noun | 1 | uno dei semi delle carte da gioco francesi o da poker, di colore rosso e raffigurante dei rombi (♢) | `rombi` | `quadro` | 0 | [quadri](https://it.wiktionary.org/w/index.php?title=quadri&oldid=4070645), [quadro](https://it.wiktionary.org/w/index.php?title=quadro&oldid=4038884) |
| 70926 | `componenti` | noun | 1 | parti di un congegno | `congegno` | `componente` | 0 | [componenti](https://it.wiktionary.org/w/index.php?title=componenti&oldid=3873428), [componente](https://it.wiktionary.org/w/index.php?title=componente&oldid=3967959) |
| 70926 | `componenti` | noun | 2 | coefficienti | `coefficienti` | `componente` | 0 | [componenti](https://it.wiktionary.org/w/index.php?title=componenti&oldid=3873428), [componente](https://it.wiktionary.org/w/index.php?title=componente&oldid=3967959) |
| 73194 | `accompagnatrice` | noun | 1 | comunemente intesa come prostituta, volgarmente "puttana di alto bordo" | `puttana di alto bordo` | `accompagnatore` | 0 | [accompagnatrice](https://it.wiktionary.org/w/index.php?title=accompagnatrice&oldid=4057979), [accompagnatore](https://it.wiktionary.org/w/index.php?title=accompagnatore&oldid=4057886) |
| 73194 | `accompagnatrice` | noun | 2 | nello spettacolo, in politica, nei MEDIA in genere assume ruoli differenti, questo al fine di preservare la privacy, proteggere indirettamente chi viene "gentilmente" appunto salvaguardato, per esempio ancora per la privacy e la sicurezza o l'incolumità della sua famiglia, ecc | `famiglia` | `accompagnatore` | 0 | [accompagnatrice](https://it.wiktionary.org/w/index.php?title=accompagnatrice&oldid=4057979), [accompagnatore](https://it.wiktionary.org/w/index.php?title=accompagnatore&oldid=4057886) |
| 73978 | `dipinti` | adj | 1 | che sono stati abbelliti con disegni colorati | `abbelliti` | `dipinto` | 0 | [dipinti](https://it.wiktionary.org/w/index.php?title=dipinti&oldid=3992517), [dipinto](https://it.wiktionary.org/w/index.php?title=dipinto&oldid=4040757) |
| 74166 | `gonfia` | adj | 1 | presuntuosa | `presuntuosa` | `gonfio` | 0 | [gonfia](https://it.wiktionary.org/w/index.php?title=gonfia&oldid=4033980), [gonfio](https://it.wiktionary.org/w/index.php?title=gonfio&oldid=4033981) |
| 78380 | `cazzi` | noun | 1 | problemi | `problemi` | `cazzo` | 0 | [cazzi](https://it.wiktionary.org/w/index.php?title=cazzi&oldid=4047462), [cazzo](https://it.wiktionary.org/w/index.php?title=cazzo&oldid=4067533) |
| 78380 | `cazzi` | noun | 2 | fatti personali | `fatti` | `cazzo` | 0 | [cazzi](https://it.wiktionary.org/w/index.php?title=cazzi&oldid=4047462), [cazzo](https://it.wiktionary.org/w/index.php?title=cazzo&oldid=4067533) |
| 80380 | `bastoni` | noun | 1 | uno dei quattro semi delle carte da gioco italiane e spagnole | `spagnole` | `bastone` | 0 | [bastoni](https://it.wiktionary.org/w/index.php?title=bastoni&oldid=4016972), [bastone](https://it.wiktionary.org/w/index.php?title=bastone&oldid=4029537) |
| 80681 | `carte` | noun | 0 | carte da gioco, insieme di schede di cartoncino o plastica numerati e con figure, usati per i giochi correlati | `cartoncino` | `carta` | 1 | [carte](https://it.wiktionary.org/w/index.php?title=carte&oldid=3997814), [carta](https://it.wiktionary.org/w/index.php?title=carta&oldid=4055030) |
| 81418 | `spine` | noun | 1 | piante o rami spinosi | `spinosi` | `spina` | 0 | [spine](https://it.wiktionary.org/w/index.php?title=spine&oldid=3962090), [spina](https://it.wiktionary.org/w/index.php?title=spina&oldid=4036309) |
| 81460 | `parolone` | noun | 0 | parola lunga o dal significato forte | `forte` | `parolona` | 1 | [parolone](https://it.wiktionary.org/w/index.php?title=parolone&oldid=3018375), [parolona](https://it.wiktionary.org/w/index.php?title=parolona&oldid=3645642) |
| 83383 | `rettili` | noun | 1 | classe di vertebrati amnioti | `classe` | `rettile` | 0 | [rettili](https://it.wiktionary.org/w/index.php?title=rettili&oldid=3654847), [rettile](https://it.wiktionary.org/w/index.php?title=rettile&oldid=3873715) |
| 84851 | `pampini` | noun | 1 | viti | `viti` | `pampino` | 0 | [pampini](https://it.wiktionary.org/w/index.php?title=pampini&oldid=3983669), [pampino](https://it.wiktionary.org/w/index.php?title=pampino&oldid=3832993) |
| 85426 | `gibboni` | noun | 1 | nome comune di una famiglia di piccole scimmie catarrine antropomorfe appartenenti all'ordine dei Primati; la sua classificazione scientifica è Hylobatidae ( tassonomia) | `Primati` | `gibbone` | 0 | [gibboni](https://it.wiktionary.org/w/index.php?title=gibboni&oldid=4014514), [gibbone](https://it.wiktionary.org/w/index.php?title=gibbone&oldid=3973253) |
| 86329 | `scopamici` | noun | 1 | persona che ha l'abitudine di avere rapporti sessuali con alcuni dei suoi amici | `amici` | `scopamico` | 0 | [scopamici](https://it.wiktionary.org/w/index.php?title=scopamici&oldid=3502152), [scopamico](https://it.wiktionary.org/w/index.php?title=scopamico&oldid=3938455) |
| 88143 | `orizzontali` | adj | 1 | cruciverba | `cruciverba` | `orizzontale` | 0 | [orizzontali](https://it.wiktionary.org/w/index.php?title=orizzontali&oldid=3619150), [orizzontale](https://it.wiktionary.org/w/index.php?title=orizzontale&oldid=3894665) |
| 88814 | `coni` | noun | 1 | molluschi | `molluschi` | `cono` | 0 | [coni](https://it.wiktionary.org/w/index.php?title=coni&oldid=3884093), [cono](https://it.wiktionary.org/w/index.php?title=cono&oldid=4063838) |
| 91374 | `mediterranea` | adj | 1 | dieta mediterranea: quale modello salutare, anche genuino e completo, si riferisce ad un’alimentazione costituita per lo più da “carboidrati non troppo elaborati”, carni cucinate in modo “semplice” e soddisfacente, prodotti molto sani e soprattutto pesce azzurro, esempio l’Italia con un piatto che meglio la rappresenta: “i classici spaghetti con pomodorino fresco, due foglie di basilico ed olio d’oliva”; si ritiene infatti che la salute con una vita senza troppe problematicità la contraddistingua permettendo un’esistenza più “lunga”, questa adatta sia nella prima infanzia sia in “vecchiaia” | `vecchiaia` | `mediterraneo` | 0 | [mediterranea](https://it.wiktionary.org/w/index.php?title=mediterranea&oldid=4049416), [mediterraneo](https://it.wiktionary.org/w/index.php?title=mediterraneo&oldid=4000924) |
| 96426 | `convinzioni` | noun | 1 | complesso dei principi in cui un individuo si identifica | `individuo` | `convinzione` | 0 | [convinzioni](https://it.wiktionary.org/w/index.php?title=convinzioni&oldid=3921669), [convinzione](https://it.wiktionary.org/w/index.php?title=convinzione&oldid=3971593) |
| 97320 | `vermi` | noun | 2 | nella locuzione avere i vermi è sinonimo di teniasi o altra patologia causata da parassiti intestinali | `parassiti` | `verme` | 0 | [vermi](https://it.wiktionary.org/w/index.php?title=vermi&oldid=3963394), [verme](https://it.wiktionary.org/w/index.php?title=verme&oldid=4166679) |
| 98061 | `ferini` | adj | 1 | denti ferini: il primo molare inferiore e il quarto premolare superiore della dentatura dei Carnivori | `Carnivori` | `ferino` | 0 | [ferini](https://it.wiktionary.org/w/index.php?title=ferini&oldid=3786587), [ferino](https://it.wiktionary.org/w/index.php?title=ferino&oldid=3991058) |
| 100054 | `giardiniera` | noun | 1 | mobile che sostiene piante ornamentali | `ornamentali` | `giardiniere` | 0 | [giardiniera](https://it.wiktionary.org/w/index.php?title=giardiniera&oldid=3724879), [giardiniere](https://it.wiktionary.org/w/index.php?title=giardiniere&oldid=3988489) |
| 100054 | `giardiniera` | noun | 2 | insalata di ortaggi lessi e conditi con aceto | `aceto` | `giardiniere` | 0 | [giardiniera](https://it.wiktionary.org/w/index.php?title=giardiniera&oldid=3724879), [giardiniere](https://it.wiktionary.org/w/index.php?title=giardiniere&oldid=3988489) |
| 101627 | `mezzana` | noun | 1 | in un veliero con vele quadre e a tre alberi, è l'albero collocato a poppa | `poppa` | `mezzano` | 0 | [mezzana](https://it.wiktionary.org/w/index.php?title=mezzana&oldid=2998951), [mezzano](https://it.wiktionary.org/w/index.php?title=mezzano&oldid=4057093) |
| 101627 | `mezzana` | noun | 2 | in un veliero con vele di taglio e a due alberi, è l'albero situato in poppa estrema | `estrema` | `mezzano` | 0 | [mezzana](https://it.wiktionary.org/w/index.php?title=mezzana&oldid=2998951), [mezzano](https://it.wiktionary.org/w/index.php?title=mezzano&oldid=4057093) |
| 101627 | `mezzana` | noun | 3 | sull'albero di mezzana, il pennone che sta sotto tutti gli altri | `pennone` | `mezzano` | 0 | [mezzana](https://it.wiktionary.org/w/index.php?title=mezzana&oldid=2998951), [mezzano](https://it.wiktionary.org/w/index.php?title=mezzano&oldid=4057093) |
| 101627 | `mezzana` | noun | 4 | negli alberi di mezzana che portano un'unica vela, si dà questo nome alla vela di taglio | `vela di taglio` | `mezzano` | 0 | [mezzana](https://it.wiktionary.org/w/index.php?title=mezzana&oldid=2998951), [mezzano](https://it.wiktionary.org/w/index.php?title=mezzano&oldid=4057093) |
| 101627 | `mezzana` | noun | 5 | taglio da 44 cm x 60 cm per fogli da stampa | `stampa` | `mezzano` | 0 | [mezzana](https://it.wiktionary.org/w/index.php?title=mezzana&oldid=2998951), [mezzano](https://it.wiktionary.org/w/index.php?title=mezzano&oldid=4057093) |
| 101627 | `mezzana` | noun | 6 | tra le corde di alcuni strumenti musicali, quella centrale | `centrale` | `mezzano` | 0 | [mezzana](https://it.wiktionary.org/w/index.php?title=mezzana&oldid=2998951), [mezzano](https://it.wiktionary.org/w/index.php?title=mezzano&oldid=4057093) |
| 101627 | `mezzana` | noun | 7 | varietà di seta in cui il torto viene realizzato ritorcendo da sinistra a destra due filati | `filati` | `mezzano` | 0 | [mezzana](https://it.wiktionary.org/w/index.php?title=mezzana&oldid=2998951), [mezzano](https://it.wiktionary.org/w/index.php?title=mezzano&oldid=4057093) |
| 102757 | `lettere` | noun | 1 | studi universitari di letteratura | `letteratura` | `lettera` | 0 | [lettere](https://it.wiktionary.org/w/index.php?title=lettere&oldid=4056039), [lettera](https://it.wiktionary.org/w/index.php?title=lettera&oldid=4037625) |
| 106078 | `tosta` | adj | 1 | detto di ragazza o donna così attraente da procurare eccitazione sessuale immediata | `immediata` | `tosto` | 0 | [tosta](https://it.wiktionary.org/w/index.php?title=tosta&oldid=3447742), [tosto](https://it.wiktionary.org/w/index.php?title=tosto&oldid=4062233) |
| 106487 | `erbe` | noun | 1 | piante o flora in genere | `flora` | `erba` | 0 | [erbe](https://it.wiktionary.org/w/index.php?title=erbe&oldid=3955309), [erba](https://it.wiktionary.org/w/index.php?title=erba&oldid=4076999) |
| 107289 | `favoriti` | noun | 1 | basette lunghe tipiche della moda dell'Ottocento | `basette` | `favorito` | 0 | [favoriti](https://it.wiktionary.org/w/index.php?title=favoriti&oldid=4054248), [favorito](https://it.wiktionary.org/w/index.php?title=favorito&oldid=3979329) |
| 108877 | `scientifica` | adj | 1 | che è rigorosa | `rigorosa` | `scientifico` | 0 | [scientifica](https://it.wiktionary.org/w/index.php?title=scientifica&oldid=3974633), [scientifico](https://it.wiktionary.org/w/index.php?title=scientifico&oldid=4006964) |
| 111596 | `fiori` | noun | 1 | uno dei quattro semi delle carte da gioco francesi o da poker, di colore nero e rappresentate un fiore a tre lobi stilizzato (♣) | `poker` | `fiore` | 0 | [fiori](https://it.wiktionary.org/w/index.php?title=fiori&oldid=4070647), [fiore](https://it.wiktionary.org/w/index.php?title=fiore&oldid=4033717) |
| 111634 | `calamari` | noun | 1 | occhiaie | `occhiaie` | `calamaro` | 0 | [calamari](https://it.wiktionary.org/w/index.php?title=calamari&oldid=3811784), [calamaro](https://it.wiktionary.org/w/index.php?title=calamaro&oldid=3969903) |
| 111682 | `pulcini` | noun | 1 | giovani calciatori, al di sotto dei 15 anni, che giocano normalmente nella squadra giovanile di una società di calcio | `calcio` | `pulcino` | 0 | [pulcini](https://it.wiktionary.org/w/index.php?title=pulcini&oldid=3958391), [pulcino](https://it.wiktionary.org/w/index.php?title=pulcino&oldid=3901623) |
| 111791 | `cellule` | noun | 1 | le cellule si dividono in eucariotiche e procariotiche | `procariotiche` | `cellula` | 0 | [cellule](https://it.wiktionary.org/w/index.php?title=cellule&oldid=3960966), [cellula](https://it.wiktionary.org/w/index.php?title=cellula&oldid=4039326) |
| 112047 | `buchi` | noun | 1 | iniezioni di droga | `droga` | `buco` | 0 | [buchi](https://it.wiktionary.org/w/index.php?title=buchi&oldid=3800175), [buco](https://it.wiktionary.org/w/index.php?title=buco&oldid=4043317) |
| 112047 | `buchi` | noun | 2 | bachi | `bachi` | `buco` | 0 | [buchi](https://it.wiktionary.org/w/index.php?title=buchi&oldid=3800175), [buco](https://it.wiktionary.org/w/index.php?title=buco&oldid=4043317) |
| 112121 | `termini` | noun | 1 | parametri entro cui qualcosa viene incluso, descritto, spiegato e/o impiegato | `impiegato` | `termine` | 0 | [termini](https://it.wiktionary.org/w/index.php?title=termini&oldid=3921198), [termine](https://it.wiktionary.org/w/index.php?title=termine&oldid=4007707) |
| 112184 | `sostegni` | noun | 1 | animali, o figure (non umane) che sostengono lo scudo ai fianchi; secondo alcuni, applicando una terminologia più vicina alle forme francesi, il termine si dovrebbe riferire solo alle figure inanimate, mentre per gli animali si dovrebbe preferire il termine supporti e per le figure umane il termine tenenti | `tenenti` | `sostegno` | 0 | [sostegni](https://it.wiktionary.org/w/index.php?title=sostegni&oldid=3868831), [sostegno](https://it.wiktionary.org/w/index.php?title=sostegno&oldid=4014994) |
| 112233 | `misteri` | noun | 1 | culto antico in cui erano previsti riti di iniziazione e pratiche occulte | `iniziazione` | `mistero` | 0 | [misteri](https://it.wiktionary.org/w/index.php?title=misteri&oldid=3802963), [mistero](https://it.wiktionary.org/w/index.php?title=mistero&oldid=4002326) |
| 112536 | `tuffi` | noun | 0 | sport in cui gli atleti, lanciandosi da un trampolino o una piattaforma posti ad una certa altezza sopra una piscina, saltano in acqua eseguendo una serie di acrobazie | `acrobazie` | `tuffo` | 1 | [tuffi](https://it.wiktionary.org/w/index.php?title=tuffi&oldid=4012817), [tuffo](https://it.wiktionary.org/w/index.php?title=tuffo&oldid=4043348) |
| 112684 | `zebre` | noun | 1 | strisce pedonali | `strisce` | `zebra` | 0 | [zebre](https://it.wiktionary.org/w/index.php?title=zebre&oldid=3964518), [zebra](https://it.wiktionary.org/w/index.php?title=zebra&oldid=4051113) |
| 113135 | `gerarchie` | noun | 1 | coloro che rivestomo i gradi più alti | `coloro` | `gerarchia` | 0 | [gerarchie](https://it.wiktionary.org/w/index.php?title=gerarchie&oldid=3408442), [gerarchia](https://it.wiktionary.org/w/index.php?title=gerarchia&oldid=3992678) |
| 113203 | `meli` | noun | 1 | melodie, poesie | `poesie` | `melo` | 0 | [meli](https://it.wiktionary.org/w/index.php?title=meli&oldid=3872585), [melo](https://it.wiktionary.org/w/index.php?title=melo&oldid=4027441) |
| 113231 | `abbracciamenti` | noun | 0 | l'atto di fare l'amore | `amore` | `abbracciamento` | 1 | [abbracciamenti](https://it.wiktionary.org/w/index.php?title=abbracciamenti&oldid=3238079), [abbracciamento](https://it.wiktionary.org/w/index.php?title=abbracciamento&oldid=3366310) |
| 113823 | `tarocchi` | noun | 1 | mazzo di settantotto carte da gioco, formato da cinquantasei carte di quattro semi distinti (arcani minori) numerate dall'asso al dieci e a seguire con fante, cavallo, donna e re, e ventidue carte con figure e allegorie (arcani maggiori), usate soprattutto per la divinazione | `divinazione` | `tarocco` | 0 | [tarocchi](https://it.wiktionary.org/w/index.php?title=tarocchi&oldid=3136811), [tarocco](https://it.wiktionary.org/w/index.php?title=tarocco&oldid=3900241) |
| 113864 | `rinforzi` | noun | 1 | forze armate inviate con lo scopo di sostenere e aiutare | `armate` | `rinforzo` | 0 | [rinforzi](https://it.wiktionary.org/w/index.php?title=rinforzi&oldid=3954271), [rinforzo](https://it.wiktionary.org/w/index.php?title=rinforzo&oldid=3952383) |
| 114064 | `fusti` | noun | 1 | giovani atletici | `atletici` | `fusto` | 0 | [fusti](https://it.wiktionary.org/w/index.php?title=fusti&oldid=4017577), [fusto](https://it.wiktionary.org/w/index.php?title=fusto&oldid=4011759) |
| 114502 | `epigoni` | noun | 1 | figli dei sette principi che perirono mentre combattevano ai piedi delle le mura di Tebe | `perirono` | `epigono` | 0 | [epigoni](https://it.wiktionary.org/w/index.php?title=epigoni&oldid=3787609), [epigono](https://it.wiktionary.org/w/index.php?title=epigono&oldid=3892192) |
| 114502 | `epigoni` | noun | 2 | i figli dei diadochi | `diadochi` | `epigono` | 0 | [epigoni](https://it.wiktionary.org/w/index.php?title=epigoni&oldid=3787609), [epigono](https://it.wiktionary.org/w/index.php?title=epigono&oldid=3892192) |
| 116885 | `sfigata` | noun | 1 | che ha un'aura negativa | `negativa` | `sfigato` | 0 | [sfigata](https://it.wiktionary.org/w/index.php?title=sfigata&oldid=3840974), [sfigato](https://it.wiktionary.org/w/index.php?title=sfigato&oldid=4049185) |
| 122900 | `morbosa` | adj | 1 | particolare aspetto in cui si presenta la morbosità | `morbosità` | `morboso` | 0 | [morbosa](https://it.wiktionary.org/w/index.php?title=morbosa&oldid=3798793), [morboso](https://it.wiktionary.org/w/index.php?title=morboso&oldid=3619212) |
| 123354 | `pneumatici` | noun | 1 | elementi in gomma elastica ottenuta mediante vulcanizzazione, che vengono montati sulle ruote di un veicolo per migliorarne l'aderenza sulla strada, ridurre il rumore e l'impatto con le asperità del terreno | `asperità` | `pneumatico` | 0 | [pneumatici](https://it.wiktionary.org/w/index.php?title=pneumatici&oldid=4076708), [pneumatico](https://it.wiktionary.org/w/index.php?title=pneumatico&oldid=3975595) |
| 130710 | `circoli` | noun | 1 | cerchi concentrici | `cerchi concentrici` | `circolo` | 0 | [circoli](https://it.wiktionary.org/w/index.php?title=circoli&oldid=3856896), [circolo](https://it.wiktionary.org/w/index.php?title=circolo&oldid=4067122) |
| 131147 | `porca` | noun | 1 | ragazza molto attraente o molto disinibita | `disinibita` | `porco` | 0 | [porca](https://it.wiktionary.org/w/index.php?title=porca&oldid=3938260), [porco](https://it.wiktionary.org/w/index.php?title=porco&oldid=4050765) |
| 131147 | `porca` | noun | 2 | nella lavorazione del suolo agrario: striscia di terra rilevata compresa tra due solchi paralleli, lasciata in sopraelevazione allo scopo di agevolare il deflusso dell'acqua piovana | `solchi` | `porco` | 0 | [porca](https://it.wiktionary.org/w/index.php?title=porca&oldid=3938260), [porco](https://it.wiktionary.org/w/index.php?title=porco&oldid=4050765) |
| 137400 | `eroina` | noun | 1 | donna coraggiosa | `donna` | `eroe` | 0 | [eroina](https://it.wiktionary.org/w/index.php?title=eroina&oldid=4019257), [eroe](https://it.wiktionary.org/w/index.php?title=eroe&oldid=4060975) |
| 137546 | `olimpiadi` | noun | 1 | competizioni sportive internazionali quadriennali | `quadriennali` | `olimpiade` | 0 | [olimpiadi](https://it.wiktionary.org/w/index.php?title=olimpiadi&oldid=3427667), [olimpiade](https://it.wiktionary.org/w/index.php?title=olimpiade&oldid=4066982) |
| 139549 | `Boidi` | noun | 1 | gruppo omogeneo di grossi serpenti; la sua classificazione scientifica è Boidae ( tassonomia) | `gruppo` | `boide` | 0 | [Boidi](https://it.wiktionary.org/w/index.php?title=Boidi&oldid=3622042), [boide](https://it.wiktionary.org/w/index.php?title=boide&oldid=3566298) |
| 186135 | `acidificante` | verb | 1 | che rende acido un prodotto | `prodotto` | `acidificare` | 0 | [acidificante](https://it.wiktionary.org/w/index.php?title=acidificante&oldid=3742423), [acidificare](https://it.wiktionary.org/w/index.php?title=acidificare&oldid=3907409) |
| 211856 | `cancelliera` | noun | 1 | chi stende gli atti emanati dal giudice | `giudice` | `cancelliere` | 0 | [cancelliera](https://it.wiktionary.org/w/index.php?title=cancelliera&oldid=3903112), [cancelliere](https://it.wiktionary.org/w/index.php?title=cancelliere&oldid=3990465) |
| 211856 | `cancelliera` | noun | 2 | la presidente del consiglio dei ministri della Germania | `presidente` | `cancelliere` | 0 | [cancelliera](https://it.wiktionary.org/w/index.php?title=cancelliera&oldid=3903112), [cancelliere](https://it.wiktionary.org/w/index.php?title=cancelliere&oldid=3990465) |
| 220287 | `copulante` | verb | 1 | composto aromatico nucleofilo, solitamente un'ammina o un fenolo, che partecipa alla reazione di copulazione | `reazione di copulazione` | `copulare` | 0 | [copulante](https://it.wiktionary.org/w/index.php?title=copulante&oldid=3785975), [copulare](https://it.wiktionary.org/w/index.php?title=copulare&oldid=3935924) |
| 222746 | `limiti` | noun | 1 | limiti della velocità stradale: anche limite di velocità è la vel. max. in km/h entro i quali è giusto e prudente guidare, in genere stabiliti per legge da ogni Stato | `km/h` | `limite` | 0 | [limiti](https://it.wiktionary.org/w/index.php?title=limiti&oldid=4036900), [limite](https://it.wiktionary.org/w/index.php?title=limite&oldid=4009848) |
| 257009 | `intrufolato` | verb | 1 | che si è introdotto in un luogo, anche privato, senza permesso unanime, "senza troppi problemi" | `problemi` | `intrufolare` | 0 | [intrufolato](https://it.wiktionary.org/w/index.php?title=intrufolato&oldid=3415649), [intrufolare](https://it.wiktionary.org/w/index.php?title=intrufolare&oldid=3879935) |
| 257009 | `intrufolato` | verb | 2 | imbucato | `imbucato` | `intrufolare` | 0 | [intrufolato](https://it.wiktionary.org/w/index.php?title=intrufolato&oldid=3415649), [intrufolare](https://it.wiktionary.org/w/index.php?title=intrufolare&oldid=3879935) |
| 371619 | `definito` | verb | 1 | secondo la propria "particolarità" o "natura" | `natura` | `definire` | 0 | [definito](https://it.wiktionary.org/w/index.php?title=definito&oldid=4217053), [definire](https://it.wiktionary.org/w/index.php?title=definire&oldid=4003003) |
| 414071 | `universitaria` | adj | 1 | dell'università | `università` | `universitario` | 0 | [universitaria](https://it.wiktionary.org/w/index.php?title=universitaria&oldid=3449477), [universitario](https://it.wiktionary.org/w/index.php?title=universitario&oldid=3735843) |
| 414072 | `universitaria` | noun | 1 | studentessa dell'università | `università` | `universitario` | 0 | [universitaria](https://it.wiktionary.org/w/index.php?title=universitaria&oldid=3449477), [universitario](https://it.wiktionary.org/w/index.php?title=universitario&oldid=3735843) |
| 416104 | `marrana` | noun | 1 | piccolo corso d'acqua che attraversa il territorio urbano di Roma | `Roma` | `marrano` | 0 | [marrana](https://it.wiktionary.org/w/index.php?title=marrana&oldid=3421968), [marrano](https://it.wiktionary.org/w/index.php?title=marrano&oldid=3975592) |
| 420080 | `bassifondi` | noun | 1 | ceto sociale caratterizzato dall'indigenza, dalla depravazione e dalla delinquenza | `delinquenza` | `bassofondo` | 0 | [bassifondi](https://it.wiktionary.org/w/index.php?title=bassifondi&oldid=3516639), [bassofondo](https://it.wiktionary.org/w/index.php?title=bassofondo&oldid=3633236) |
| 421216 | `scienziati` | noun | 1 | uomini di scienza | `scienza` | `scienziato` | 0 | [scienziati](https://it.wiktionary.org/w/index.php?title=scienziati&oldid=3788074), [scienziato](https://it.wiktionary.org/w/index.php?title=scienziato&oldid=3922785) |
| 421387 | `seduttrice` | noun | 1 | donna in grado di sedurre | `sedurre` | `seduttore` | 0 | [seduttrice](https://it.wiktionary.org/w/index.php?title=seduttrice&oldid=3851711), [seduttore](https://it.wiktionary.org/w/index.php?title=seduttore&oldid=4053511) |
| 422750 | `mocciosa` | adj | 1 | che è sporca di muco | `muco` | `moccioso` | 0 | [mocciosa](https://it.wiktionary.org/w/index.php?title=mocciosa&oldid=3644210), [moccioso](https://it.wiktionary.org/w/index.php?title=moccioso&oldid=4068851) |
| 422868 | `pugilistica` | adj | 1 | che riguarda il pugilato | `pugilato` | `pugilistico` | 0 | [pugilistica](https://it.wiktionary.org/w/index.php?title=pugilistica&oldid=3434760), [pugilistico](https://it.wiktionary.org/w/index.php?title=pugilistico&oldid=4036726) |
| 422891 | `incompetenti` | adj | 1 | che conoscono poco di una determinata materia | `materia` | `incompetente` | 0 | [incompetenti](https://it.wiktionary.org/w/index.php?title=incompetenti&oldid=3958402), [incompetente](https://it.wiktionary.org/w/index.php?title=incompetente&oldid=4056399) |
| 422946 | `centinaia` | noun | 1 | un ragguardevole numero | `numero` | `centinaio` | 0 | [centinaia](https://it.wiktionary.org/w/index.php?title=centinaia&oldid=4076771), [centinaio](https://it.wiktionary.org/w/index.php?title=centinaio&oldid=3904876) |
| 423354 | `bassotti` | adj | 1 | alquanto bassi e tarchiati | `tarchiati` | `bassotto` | 0 | [bassotti](https://it.wiktionary.org/w/index.php?title=bassotti&oldid=3633238), [bassotto](https://it.wiktionary.org/w/index.php?title=bassotto&oldid=3970741) |
| 423459 | `superiori` | noun | 1 | scuole secondarie di secondo grado | `grado` | `superiore` | 0 | [superiori](https://it.wiktionary.org/w/index.php?title=superiori&oldid=3961316), [superiore](https://it.wiktionary.org/w/index.php?title=superiore&oldid=4066659) |
| 423659 | `scarponi` | noun | 1 | scarponi [da] sci: per lo sport sulle “vette innevate”, in montagna soprattutto in inverno, sono necessari per gli sci appunto… e possono essere anche riscaldati per il gelo più intenso, si trovano poi in differenti colori e design secondo la marca di moda scelta; possono essere persino “affittati” cioè noleggiati, ovviamente a pagamento secondo le “tariffe” varie | `tariffe` | `scarpone` | 0 | [scarponi](https://it.wiktionary.org/w/index.php?title=scarponi&oldid=4052005), [scarpone](https://it.wiktionary.org/w/index.php?title=scarpone&oldid=3675232) |
| 425682 | `sorprese` | noun | 1 | cose impreviste | `cose` | `sorpresa` | 0 | [sorprese](https://it.wiktionary.org/w/index.php?title=sorprese&oldid=3999945), [sorpresa](https://it.wiktionary.org/w/index.php?title=sorpresa&oldid=4036819) |
| 427898 | `umani` | adj | 1 | degli uomini | `uomini` | `umano` | 0 | [umani](https://it.wiktionary.org/w/index.php?title=umani&oldid=3921307), [umano](https://it.wiktionary.org/w/index.php?title=umano&oldid=3987955) |
| 432880 | `magli` | noun | 1 | grandi martelli | `martelli` | `maglio` | 0 | [magli](https://it.wiktionary.org/w/index.php?title=magli&oldid=3421091), [maglio](https://it.wiktionary.org/w/index.php?title=maglio&oldid=4050862) |
| 436784 | `vissero` | verb | 1 | i neanderthal vissero nel tardo Pleistocene | `Pleistocene` | `vivere` | 0 | [vissero](https://it.wiktionary.org/w/index.php?title=vissero&oldid=3927622), [vivere](https://it.wiktionary.org/w/index.php?title=vivere&oldid=4041247) |
| 436952 | `scienziate` | noun | 1 | donne di scienza | `scienza` | `scienziato` | 0 | [scienziate](https://it.wiktionary.org/w/index.php?title=scienziate&oldid=3820350), [scienziato](https://it.wiktionary.org/w/index.php?title=scienziato&oldid=3922785) |
| 439413 | `orinatoi` | noun | 1 | luoghi pubblici per orinare | `orinare` | `orinatoio` | 0 | [orinatoi](https://it.wiktionary.org/w/index.php?title=orinatoi&oldid=3905385), [orinatoio](https://it.wiktionary.org/w/index.php?title=orinatoio&oldid=3904864) |
| 441838 | `virtuosi` | adj | 1 | che abbondano in virtù morali | `morali` | `virtuoso` | 0 | [virtuosi](https://it.wiktionary.org/w/index.php?title=virtuosi&oldid=3652612), [virtuoso](https://it.wiktionary.org/w/index.php?title=virtuoso&oldid=4058079) |
| 441842 | `virtuose` | adj | 1 | che abbondano in virtù morali | `morali` | `virtuosa` | 0 | [virtuose](https://it.wiktionary.org/w/index.php?title=virtuose&oldid=3652611), [virtuosa](https://it.wiktionary.org/w/index.php?title=virtuosa&oldid=3652609) |
| 441844 | `pietosi` | adj | 1 | che hanno compassione | `compassione` | `pietoso` | 0 | [pietosi](https://it.wiktionary.org/w/index.php?title=pietosi&oldid=3646104), [pietoso](https://it.wiktionary.org/w/index.php?title=pietoso&oldid=3868496) |
| 441845 | `pietosa` | adj | 1 | che ha compassione | `compassione` | `pietoso` | 0 | [pietosa](https://it.wiktionary.org/w/index.php?title=pietosa&oldid=3646102), [pietoso](https://it.wiktionary.org/w/index.php?title=pietoso&oldid=3868496) |
| 441846 | `pietose` | adj | 1 | che hanno compassione | `compassione` | `pietosa` | 0 | [pietose](https://it.wiktionary.org/w/index.php?title=pietose&oldid=3646103), [pietosa](https://it.wiktionary.org/w/index.php?title=pietosa&oldid=3646102) |
| 441882 | `radiosi` | adj | 1 | che mandano fuori una forte luce | `luce` | `radioso` | 0 | [radiosi](https://it.wiktionary.org/w/index.php?title=radiosi&oldid=3905416), [radioso](https://it.wiktionary.org/w/index.php?title=radioso&oldid=3902382) |
| 441882 | `radiosi` | adj | 2 | che manifestano felicità | `felicità` | `radioso` | 0 | [radiosi](https://it.wiktionary.org/w/index.php?title=radiosi&oldid=3905416), [radioso](https://it.wiktionary.org/w/index.php?title=radioso&oldid=3902382) |
| 442024 | `dotti` | adj | 1 | che hanno una grande cultura | `cultura` | `dotto` | 0 | [dotti](https://it.wiktionary.org/w/index.php?title=dotti&oldid=3905432), [dotto](https://it.wiktionary.org/w/index.php?title=dotto&oldid=3891920) |
| 442026 | `dotte` | adj | 1 | che hanno una grande cultura | `cultura` | `dotta` | 0 | [dotte](https://it.wiktionary.org/w/index.php?title=dotte&oldid=3905433), [dotta](https://it.wiktionary.org/w/index.php?title=dotta&oldid=3921829) |
| 442027 | `dotta` | adj | 1 | che ha una grande cultura | `cultura` | `dotto` | 0 | [dotta](https://it.wiktionary.org/w/index.php?title=dotta&oldid=3921829), [dotto](https://it.wiktionary.org/w/index.php?title=dotto&oldid=3891920) |
| 442031 | `studiosa` | adj | 1 | che si applica nello studio con dedizione | `dedizione` | `studioso` | 0 | [studiosa](https://it.wiktionary.org/w/index.php?title=studiosa&oldid=3905435), [studioso](https://it.wiktionary.org/w/index.php?title=studioso&oldid=3895310) |
| 442033 | `studiosi` | adj | 1 | che si applica nello studio con dedizione | `dedizione` | `studioso` | 0 | [studiosi](https://it.wiktionary.org/w/index.php?title=studiosi&oldid=3930207), [studioso](https://it.wiktionary.org/w/index.php?title=studioso&oldid=3895310) |
| 442035 | `studiose` | adj | 1 | che si applicano nello studio con dedizione | `dedizione` | `studioso` | 0 | [studiose](https://it.wiktionary.org/w/index.php?title=studiose&oldid=3905437), [studioso](https://it.wiktionary.org/w/index.php?title=studioso&oldid=3895310) |
| 442081 | `urgenti` | adj | 1 | che richiedono un rimedio immediato | `immediato` | `urgente` | 0 | [urgenti](https://it.wiktionary.org/w/index.php?title=urgenti&oldid=3466080), [urgente](https://it.wiktionary.org/w/index.php?title=urgente&oldid=3899648) |
| 442081 | `urgenti` | adj | 3 | di lettere, che esigono risposta immediata | `immediata` | `urgente` | 0 | [urgenti](https://it.wiktionary.org/w/index.php?title=urgenti&oldid=3466080), [urgente](https://it.wiktionary.org/w/index.php?title=urgente&oldid=3899648) |
| 442309 | `universitari` | adj | 1 | dell'università | `università` | `universitario` | 0 | [universitari](https://it.wiktionary.org/w/index.php?title=universitari&oldid=3652165), [universitario](https://it.wiktionary.org/w/index.php?title=universitario&oldid=3735843) |
| 442310 | `universitari` | noun | 1 | studentessa dell'università | `università` | `universitario` | 0 | [universitari](https://it.wiktionary.org/w/index.php?title=universitari&oldid=3652165), [universitario](https://it.wiktionary.org/w/index.php?title=universitario&oldid=3735843) |
| 442311 | `universitarie` | adj | 1 | dell'università | `università` | `universitaria` | 0 | [universitarie](https://it.wiktionary.org/w/index.php?title=universitarie&oldid=3652166), [universitaria](https://it.wiktionary.org/w/index.php?title=universitaria&oldid=3449477) |
| 442312 | `universitarie` | noun | 1 | studentessa dell'università | `università` | `universitario` | 0 | [universitarie](https://it.wiktionary.org/w/index.php?title=universitarie&oldid=3652166), [universitario](https://it.wiktionary.org/w/index.php?title=universitario&oldid=3735843) |
| 447109 | `nerboruti` | adj | 1 | che sono muscolosi, forti, dotati di grande forza fisica | `dotati` | `nerboruto` | 0 | [nerboruti](https://it.wiktionary.org/w/index.php?title=nerboruti&oldid=3644688), [nerboruto](https://it.wiktionary.org/w/index.php?title=nerboruto&oldid=4248773) |
| 447110 | `nerboruta` | adj | 1 | che è muscolosa, forte, dotata di grande forza fisica | `dotata` | `nerboruto` | 0 | [nerboruta](https://it.wiktionary.org/w/index.php?title=nerboruta&oldid=3426036), [nerboruto](https://it.wiktionary.org/w/index.php?title=nerboruto&oldid=4248773) |
| 447111 | `nerborute` | adj | 1 | che sono muscolose, forti, dotate di grande forza fisica | `dotate` | `nerboruta` | 0 | [nerborute](https://it.wiktionary.org/w/index.php?title=nerborute&oldid=3644687), [nerboruta](https://it.wiktionary.org/w/index.php?title=nerboruta&oldid=3426036) |
| 447112 | `mingherlini` | adj | 1 | che sono magri | `magri` | `mingherlino` | 0 | [mingherlini](https://it.wiktionary.org/w/index.php?title=mingherlini&oldid=3905530), [mingherlino](https://it.wiktionary.org/w/index.php?title=mingherlino&oldid=4005136) |
| 447113 | `mingherlina` | adj | 1 | che è magra | `magra` | `mingherlino` | 0 | [mingherlina](https://it.wiktionary.org/w/index.php?title=mingherlina&oldid=3905531), [mingherlino](https://it.wiktionary.org/w/index.php?title=mingherlino&oldid=4005136) |
| 447114 | `mingherline` | adj | 1 | che sono magre | `magre` | `mingherlina` | 0 | [mingherline](https://it.wiktionary.org/w/index.php?title=mingherline&oldid=3905532), [mingherlina](https://it.wiktionary.org/w/index.php?title=mingherlina&oldid=3905531) |
| 447187 | `umida` | adj | 1 | leggermente bagnata | `bagnata` | `umido` | 0 | [umida](https://it.wiktionary.org/w/index.php?title=umida&oldid=3905542), [umido](https://it.wiktionary.org/w/index.php?title=umido&oldid=3896459) |
| 447187 | `umida` | adj | 2 | di massa d'aria con una quantità di vapore acqueo superiore alla media | `aria` | `umido` | 0 | [umida](https://it.wiktionary.org/w/index.php?title=umida&oldid=3905542), [umido](https://it.wiktionary.org/w/index.php?title=umido&oldid=3896459) |
| 447188 | `umide` | adj | 1 | leggermente bagnata | `bagnata` | `umida` | 0 | [umide](https://it.wiktionary.org/w/index.php?title=umide&oldid=3905543), [umida](https://it.wiktionary.org/w/index.php?title=umida&oldid=3905542) |
| 447188 | `umide` | adj | 2 | di masse d'aria con una quantità di vapore acqueo superiore alla media | `aria` | `umida` | 0 | [umide](https://it.wiktionary.org/w/index.php?title=umide&oldid=3905543), [umida](https://it.wiktionary.org/w/index.php?title=umida&oldid=3905542) |
| 447511 | `indemoniata` | adj | 1 | che è in preda al demonio | `demonio` | `indemoniato` | 0 | [indemoniata](https://it.wiktionary.org/w/index.php?title=indemoniata&oldid=3413958), [indemoniato](https://it.wiktionary.org/w/index.php?title=indemoniato&oldid=4047715) |
| 447511 | `indemoniata` | adj | 2 | mossa dall'ira | `ira` | `indemoniato` | 0 | [indemoniata](https://it.wiktionary.org/w/index.php?title=indemoniata&oldid=3413958), [indemoniato](https://it.wiktionary.org/w/index.php?title=indemoniato&oldid=4047715) |
| 447514 | `indemoniati` | adj | 1 | che sono in preda al demonio | `demonio` | `indemoniato` | 0 | [indemoniati](https://it.wiktionary.org/w/index.php?title=indemoniati&oldid=3413960), [indemoniato](https://it.wiktionary.org/w/index.php?title=indemoniato&oldid=4047715) |
| 447514 | `indemoniati` | adj | 2 | mossi dall'ira | `ira` | `indemoniato` | 0 | [indemoniati](https://it.wiktionary.org/w/index.php?title=indemoniati&oldid=3413960), [indemoniato](https://it.wiktionary.org/w/index.php?title=indemoniato&oldid=4047715) |
| 447517 | `indemoniate` | adj | 1 | che sono in preda al demonio | `demonio` | `indemoniata` | 0 | [indemoniate](https://it.wiktionary.org/w/index.php?title=indemoniate&oldid=3413959), [indemoniata](https://it.wiktionary.org/w/index.php?title=indemoniata&oldid=3413958) |
| 447517 | `indemoniate` | adj | 2 | mosse dall'ira | `ira` | `indemoniata` | 0 | [indemoniate](https://it.wiktionary.org/w/index.php?title=indemoniate&oldid=3413959), [indemoniata](https://it.wiktionary.org/w/index.php?title=indemoniata&oldid=3413958) |
| 447545 | `scheletriche` | adj | 1 | che hanno a che fare con lo scheletro | `scheletro` | `scheletrica` | 0 | [scheletriche](https://it.wiktionary.org/w/index.php?title=scheletriche&oldid=3837472), [scheletrica](https://it.wiktionary.org/w/index.php?title=scheletrica&oldid=4066660) |
| 447545 | `scheletriche` | adj | 2 | molto magre | `magre` | `scheletrica` | 0 | [scheletriche](https://it.wiktionary.org/w/index.php?title=scheletriche&oldid=3837472), [scheletrica](https://it.wiktionary.org/w/index.php?title=scheletrica&oldid=4066660) |
| 447739 | `grossolana` | adj | 1 | che è fatta in modo poco diligente | `diligente` | `grossolano` | 0 | [grossolana](https://it.wiktionary.org/w/index.php?title=grossolana&oldid=3935298), [grossolano](https://it.wiktionary.org/w/index.php?title=grossolano&oldid=3942157) |
| 447740 | `grossolani` | adj | 1 | che sono fatti in modo poco diligente | `diligente` | `grossolano` | 0 | [grossolani](https://it.wiktionary.org/w/index.php?title=grossolani&oldid=3920117), [grossolano](https://it.wiktionary.org/w/index.php?title=grossolano&oldid=3942157) |
| 447741 | `grossolane` | adj | 1 | che sono state fatte in modo poco diligente | `diligente` | `grossolana` | 0 | [grossolane](https://it.wiktionary.org/w/index.php?title=grossolane&oldid=3905606), [grossolana](https://it.wiktionary.org/w/index.php?title=grossolana&oldid=3935298) |
| 447745 | `scandinave` | adj | 1 | relative alla Scandinavia | `Scandinavia` | `scandinava` | 0 | [scandinave](https://it.wiktionary.org/w/index.php?title=scandinave&oldid=3439605), [scandinava](https://it.wiktionary.org/w/index.php?title=scandinava&oldid=3710732) |
| 447759 | `retrive` | adj | 1 | avverse al progresso | `progresso` | `retriva` | 0 | [retrive](https://it.wiktionary.org/w/index.php?title=retrive&oldid=3437032), [retriva](https://it.wiktionary.org/w/index.php?title=retriva&oldid=3437031) |
| 447783 | `meticcia` | adj | 1 | che è nata da genitori di razze diverse | `nata` | `meticcio` | 0 | [meticcia](https://it.wiktionary.org/w/index.php?title=meticcia&oldid=3905614), [meticcio](https://it.wiktionary.org/w/index.php?title=meticcio&oldid=3974449) |
| 447785 | `meticci` | adj | 1 | che sono nata da genitori di razze diverse | `nata` | `meticcio` | 0 | [meticci](https://it.wiktionary.org/w/index.php?title=meticci&oldid=3643973), [meticcio](https://it.wiktionary.org/w/index.php?title=meticcio&oldid=3974449) |
| 447787 | `meticce` | adj | 1 | che sono nate da genitori di razze diverse | `nate` | `meticcia` | 0 | [meticce](https://it.wiktionary.org/w/index.php?title=meticce&oldid=3643972), [meticcia](https://it.wiktionary.org/w/index.php?title=meticcia&oldid=3905614) |
| 447798 | `disdicevoli` | adj | 1 | che non sono adeguati o adeguate | `adeguate` | `disdicevole` | 0 | [disdicevoli](https://it.wiktionary.org/w/index.php?title=disdicevoli&oldid=3905616), [disdicevole](https://it.wiktionary.org/w/index.php?title=disdicevole&oldid=4006760) |
| 447801 | `indecorosi` | adj | 1 | che non sono adeguati alla dignità di un individuo | `individuo` | `indecoroso` | 0 | [indecorosi](https://it.wiktionary.org/w/index.php?title=indecorosi&oldid=3641336), [indecoroso](https://it.wiktionary.org/w/index.php?title=indecoroso&oldid=4035669) |
| 447802 | `indecorose` | adj | 1 | che non sono adeguate alla dignità di un individuo | `individuo` | `indecorosa` | 0 | [indecorose](https://it.wiktionary.org/w/index.php?title=indecorose&oldid=3641335), [indecorosa](https://it.wiktionary.org/w/index.php?title=indecorosa&oldid=3641334) |
| 447831 | `pancreatica` | adj | 1 | inerente al pancreas | `pancreas` | `pancreatico` | 0 | [pancreatica](https://it.wiktionary.org/w/index.php?title=pancreatica&oldid=3645521), [pancreatico](https://it.wiktionary.org/w/index.php?title=pancreatico&oldid=3984292) |
| 447832 | `pancreatici` | adj | 1 | inerenti al pancreas | `pancreas` | `pancreatico` | 0 | [pancreatici](https://it.wiktionary.org/w/index.php?title=pancreatici&oldid=3645523), [pancreatico](https://it.wiktionary.org/w/index.php?title=pancreatico&oldid=3984292) |
| 447833 | `pancreatiche` | adj | 1 | inerenti al pancreas | `pancreas` | `pancreatico` | 0 | [pancreatiche](https://it.wiktionary.org/w/index.php?title=pancreatiche&oldid=3645522), [pancreatico](https://it.wiktionary.org/w/index.php?title=pancreatico&oldid=3984292) |
| 447841 | `cacciatori` | noun | 1 | persone che, imbracciando armi da fuoco o da tiro, cacciano animali per nutrirsi o per sport | `sport` | `cacciatore` | 0 | [cacciatori](https://it.wiktionary.org/w/index.php?title=cacciatori&oldid=3985037), [cacciatore](https://it.wiktionary.org/w/index.php?title=cacciatore&oldid=3985036) |
| 447842 | `cacciatrici` | noun | 1 | persone che, imbracciando armi da fuoco o da tiro, cacciano animali per nutrirsi o per sport | `sport` | `cacciatrice` | 0 | [cacciatrici](https://it.wiktionary.org/w/index.php?title=cacciatrici&oldid=3633806), [cacciatrice](https://it.wiktionary.org/w/index.php?title=cacciatrice&oldid=3705215) |
| 447843 | `cacciatrice` | noun | 1 | persone che, imbracciando armi da fuoco o da tiro, cacciano animali per nutrirsi o per sport | `sport` | `cacciatore` | 0 | [cacciatrice](https://it.wiktionary.org/w/index.php?title=cacciatrice&oldid=3705215), [cacciatore](https://it.wiktionary.org/w/index.php?title=cacciatore&oldid=3985036) |
| 447901 | `boriose` | adj | 1 | persone che ostentano superbia e arroganza | `arroganza` | `borioso` | 0 | [boriose](https://it.wiktionary.org/w/index.php?title=boriose&oldid=3905624), [borioso](https://it.wiktionary.org/w/index.php?title=borioso&oldid=3971401) |
| 447902 | `boriosi` | adj | 1 | persone che ostentano superbia e arroganza | `arroganza` | `borioso` | 0 | [boriosi](https://it.wiktionary.org/w/index.php?title=boriosi&oldid=3905625), [borioso](https://it.wiktionary.org/w/index.php?title=borioso&oldid=3971401) |
| 448628 | `cunicoli` | adj | 1 | relativi ai conigli | `conigli` | `cunicolo` | 0 | [cunicoli](https://it.wiktionary.org/w/index.php?title=cunicoli&oldid=4155245), [cunicolo](https://it.wiktionary.org/w/index.php?title=cunicolo&oldid=3990694) |
| 448629 | `cunicoli` | noun | 1 | strette gallerie sotterranee ad uso bellico | `bellico` | `cunicolo` | 0 | [cunicoli](https://it.wiktionary.org/w/index.php?title=cunicoli&oldid=4155245), [cunicolo](https://it.wiktionary.org/w/index.php?title=cunicolo&oldid=3990694) |
| 448629 | `cunicoli` | noun | 2 | piccole gallerie usate per l'ingegneria civile | `civile` | `cunicolo` | 0 | [cunicoli](https://it.wiktionary.org/w/index.php?title=cunicoli&oldid=4155245), [cunicolo](https://it.wiktionary.org/w/index.php?title=cunicolo&oldid=3990694) |
| 448629 | `cunicoli` | noun | 3 | tane scavate nel terreno | `tane` | `cunicolo` | 0 | [cunicoli](https://it.wiktionary.org/w/index.php?title=cunicoli&oldid=4155245), [cunicolo](https://it.wiktionary.org/w/index.php?title=cunicolo&oldid=3990694) |
| 449029 | `scopritori` | noun | 1 | coloro che scoprono | `coloro` | `scopritore` | 0 | [scopritori](https://it.wiktionary.org/w/index.php?title=scopritori&oldid=3968133), [scopritore](https://it.wiktionary.org/w/index.php?title=scopritore&oldid=4049948) |
| 450413 | `zoologica` | adj | 1 | inerente alla zoologia | `zoologia` | `zoologico` | 0 | [zoologica](https://it.wiktionary.org/w/index.php?title=zoologica&oldid=3652856), [zoologico](https://it.wiktionary.org/w/index.php?title=zoologico&oldid=3898295) |
| 450414 | `zoologici` | adj | 1 | inerenti alla zoologia | `zoologia` | `zoologico` | 0 | [zoologici](https://it.wiktionary.org/w/index.php?title=zoologici&oldid=3652858), [zoologico](https://it.wiktionary.org/w/index.php?title=zoologico&oldid=3898295) |
| 450415 | `zoologiche` | adj | 1 | inerenti alla zoologia | `zoologia` | `zoologica` | 0 | [zoologiche](https://it.wiktionary.org/w/index.php?title=zoologiche&oldid=3652857), [zoologica](https://it.wiktionary.org/w/index.php?title=zoologica&oldid=3652856) |
| 450534 | `siberiane` | adj | 1 | della Siberia | `Siberia` | `siberiana` | 0 | [siberiane](https://it.wiktionary.org/w/index.php?title=siberiane&oldid=3649747), [siberiana](https://it.wiktionary.org/w/index.php?title=siberiana&oldid=3810233) |
| 450534 | `siberiane` | adj | 2 | di temperature molto basse | `temperature` | `siberiana` | 0 | [siberiane](https://it.wiktionary.org/w/index.php?title=siberiane&oldid=3649747), [siberiana](https://it.wiktionary.org/w/index.php?title=siberiana&oldid=3810233) |
| 450536 | `siberiana` | adj | 1 | della Siberia | `Siberia` | `siberiano` | 0 | [siberiana](https://it.wiktionary.org/w/index.php?title=siberiana&oldid=3810233), [siberiano](https://it.wiktionary.org/w/index.php?title=siberiano&oldid=3895210) |
| 450536 | `siberiana` | adj | 2 | di temperatura molto bassa | `temperatura` | `siberiano` | 0 | [siberiana](https://it.wiktionary.org/w/index.php?title=siberiana&oldid=3810233), [siberiano](https://it.wiktionary.org/w/index.php?title=siberiano&oldid=3895210) |
| 450538 | `siberiani` | adj | 1 | della Siberia | `Siberia` | `siberiano` | 0 | [siberiani](https://it.wiktionary.org/w/index.php?title=siberiani&oldid=3649748), [siberiano](https://it.wiktionary.org/w/index.php?title=siberiano&oldid=3895210) |
| 450548 | `cilene` | adj | 1 | che riguardano il Cile | `Cile` | `cilena` | 0 | [cilene](https://it.wiktionary.org/w/index.php?title=cilene&oldid=3391125), [cilena](https://it.wiktionary.org/w/index.php?title=cilena&oldid=3724404) |
| 450549 | `cilene` | noun | 1 | originarie, residenti in Cile | `Cile` | `cilena` | 0 | [cilene](https://it.wiktionary.org/w/index.php?title=cilene&oldid=3391125), [cilena](https://it.wiktionary.org/w/index.php?title=cilena&oldid=3724404) |
| 450550 | `cileni` | adj | 1 | che riguardano il Cile | `Cile` | `cileno` | 0 | [cileni](https://it.wiktionary.org/w/index.php?title=cileni&oldid=3391126), [cileno](https://it.wiktionary.org/w/index.php?title=cileno&oldid=3957414) |
| 450551 | `cileni` | noun | 1 | originari, residenti in Cile | `Cile` | `cileno` | 0 | [cileni](https://it.wiktionary.org/w/index.php?title=cileni&oldid=3391126), [cileno](https://it.wiktionary.org/w/index.php?title=cileno&oldid=3957414) |
| 450557 | `teoretica` | adj | 1 | che fa parte della teoria | `teoria` | `teoretico` | 0 | [teoretica](https://it.wiktionary.org/w/index.php?title=teoretica&oldid=4037782), [teoretico](https://it.wiktionary.org/w/index.php?title=teoretico&oldid=3668856) |
| 450559 | `teoretici` | adj | 1 | che fanno parte della teoria | `teoria` | `teoretico` | 0 | [teoretici](https://it.wiktionary.org/w/index.php?title=teoretici&oldid=3446649), [teoretico](https://it.wiktionary.org/w/index.php?title=teoretico&oldid=3668856) |
| 450560 | `teoretiche` | adj | 1 | che fanno parte della teoria | `teoria` | `teoretica` | 0 | [teoretiche](https://it.wiktionary.org/w/index.php?title=teoretiche&oldid=3651395), [teoretica](https://it.wiktionary.org/w/index.php?title=teoretica&oldid=4037782) |
| 451413 | `romagnola` | adj | 1 | della Romagna | `Romagna` | `romagnolo` | 0 | [romagnola](https://it.wiktionary.org/w/index.php?title=romagnola&oldid=3837391), [romagnolo](https://it.wiktionary.org/w/index.php?title=romagnolo&oldid=4049162) |
| 451414 | `romagnola` | noun | 1 | residente od originaria della Romagna | `Romagna` | `romagnolo` | 0 | [romagnola](https://it.wiktionary.org/w/index.php?title=romagnola&oldid=3837391), [romagnolo](https://it.wiktionary.org/w/index.php?title=romagnolo&oldid=4049162) |
| 451415 | `romagnole` | adj | 1 | della Romagna | `Romagna` | `romagnolo` | 0 | [romagnole](https://it.wiktionary.org/w/index.php?title=romagnole&oldid=3937754), [romagnolo](https://it.wiktionary.org/w/index.php?title=romagnolo&oldid=4049162) |
| 451416 | `romagnole` | noun | 1 | residenti od originarie della Romagna | `Romagna` | `romagnolo` | 0 | [romagnole](https://it.wiktionary.org/w/index.php?title=romagnole&oldid=3937754), [romagnolo](https://it.wiktionary.org/w/index.php?title=romagnolo&oldid=4049162) |
| 451417 | `romagnoli` | adj | 1 | della Romagna | `Romagna` | `romagnolo` | 0 | [romagnoli](https://it.wiktionary.org/w/index.php?title=romagnoli&oldid=3934433), [romagnolo](https://it.wiktionary.org/w/index.php?title=romagnolo&oldid=4049162) |
| 451418 | `romagnoli` | noun | 1 | residenti od originari della Romagna | `Romagna` | `romagnolo` | 0 | [romagnoli](https://it.wiktionary.org/w/index.php?title=romagnoli&oldid=3934433), [romagnolo](https://it.wiktionary.org/w/index.php?title=romagnolo&oldid=4049162) |
| 453855 | `frotte` | noun | 1 | in grandi quantità, tantissimo | `tantissimo` | `frotta` | 0 | [frotte](https://it.wiktionary.org/w/index.php?title=frotte&oldid=4045472), [frotta](https://it.wiktionary.org/w/index.php?title=frotta&oldid=4045474) |
| 457178 | `veneti` | noun | 0 | nell'antica Roma e a Bisanzio: uno dei gruppi, gli azzurri, di aurighi del circo circensi, citato durante l'impero di Vitellio | `Vitellio` | `veneto` | 1 | [veneti](https://it.wiktionary.org/w/index.php?title=veneti&oldid=4050034), [veneto](https://it.wiktionary.org/w/index.php?title=veneto&oldid=4067825) |
| 465143 | `Viverrini` | noun | 1 | sottofamiglia di mammiferi della famiglia dei Viverridi | `Viverridi` | `viverrino` | 0 | [Viverrini](https://it.wiktionary.org/w/index.php?title=Viverrini&oldid=3473679), [viverrino](https://it.wiktionary.org/w/index.php?title=viverrino&oldid=3652658) |
| 466163 | `diprotodonti` | noun | 1 | marsupiali erbivori di cui fanno parte falangeridi, i macropodidi e i vombati | `vombati` | `diprotodonte` | 0 | [diprotodonti](https://it.wiktionary.org/w/index.php?title=diprotodonti&oldid=3637877), [diprotodonte](https://it.wiktionary.org/w/index.php?title=diprotodonte&oldid=3493780) |
| 516155 | `principati` | noun | 1 | angeli | `angeli` | `principato` | 0 | [principati](https://it.wiktionary.org/w/index.php?title=principati&oldid=3647227), [principato](https://it.wiktionary.org/w/index.php?title=principato&oldid=3923108) |
| 539807 | `cicale` | noun | 1 | chiacchierone | `chiacchierone` | `cicala` | 0 | [cicale](https://it.wiktionary.org/w/index.php?title=cicale&oldid=3865726), [cicala](https://it.wiktionary.org/w/index.php?title=cicala&oldid=4000084) |
| 577008 | `colombi` | noun | 1 | fidanzatini innamorati | `fidanzatini` | `colombo` | 0 | [colombi](https://it.wiktionary.org/w/index.php?title=colombi&oldid=3928915), [colombo](https://it.wiktionary.org/w/index.php?title=colombo&oldid=3928916) |
| 595888 | `bietoloni` | noun | 1 | creduloni | `creduloni` | `bietolone` | 0 | [bietoloni](https://it.wiktionary.org/w/index.php?title=bietoloni&oldid=3867532), [bietolone](https://it.wiktionary.org/w/index.php?title=bietolone&oldid=3867531) |
| 622418 | `vampira` | noun | 1 | donna molto seducente | `seducente` | `vampiro` | 0 | [vampira](https://it.wiktionary.org/w/index.php?title=vampira&oldid=4040448), [vampiro](https://it.wiktionary.org/w/index.php?title=vampiro&oldid=4040500) |

## Edges removed

| Line | Word | POS | Sense | Gloss | Edge it removes | Because | Base words named | Cited page |
|---|---|---|---|---|---|---|---|---|
| 1493 | `capa` | noun | 1 | in un sigaro è il lembo di foglia utilizzata per chiudere una o entrambe le estremità | `estremità` | `no-form-sense` |  | [capa](https://it.wiktionary.org/w/index.php?title=capa&oldid=4248812) |
| 1493 | `capa` | noun | 2 | testa | `testa` | `no-form-sense` |  | [capa](https://it.wiktionary.org/w/index.php?title=capa&oldid=4248812) |
| 1550 | `frattaglie` | noun | 0 | visceri degli animali macellati che si possono mangiare | `visceri` | `no-form-sense` |  | [frattaglie](https://it.wiktionary.org/w/index.php?title=frattaglie&oldid=3860119) |
| 1550 | `frattaglie` | noun | 1 | coacervo di oggetti inutili | `coacervo` | `no-form-sense` |  | [frattaglie](https://it.wiktionary.org/w/index.php?title=frattaglie&oldid=3860119) |
| 2469 | `frutta` | noun | 0 | un insieme di frutti commestibili | `commestibili` | `no-form-sense` |  | [frutta](https://it.wiktionary.org/w/index.php?title=frutta&oldid=4042479) |
| 2469 | `frutta` | noun | 1 | la portata di un pasto in cui si servono frutti; nella tradizione italiana è sempre stata l'ultima portata, ma da qualche tempo si usa servirla prima del dolce | `dolce` | `no-form-sense` |  | [frutta](https://it.wiktionary.org/w/index.php?title=frutta&oldid=4042479) |
| 8179 | `andarsene` | verb | 0 | andare sovrappensiero | `sovrappensiero` | `no-form-sense` |  | [andarsene](https://it.wiktionary.org/w/index.php?title=andarsene&oldid=4047113) |
| 8179 | `andarsene` | verb | 1 | morire | `morire` | `no-form-sense` |  | [andarsene](https://it.wiktionary.org/w/index.php?title=andarsene&oldid=4047113) |
| 8179 | `andarsene` | verb | 2 | abbandonare, lasciare qualcuno | `lasciare` | `no-form-sense` |  | [andarsene](https://it.wiktionary.org/w/index.php?title=andarsene&oldid=4047113) |
| 8179 | `andarsene` | verb | 3 | uscire da un luogo o assentarsi durante un'occasione | `occasione` | `no-form-sense` |  | [andarsene](https://it.wiktionary.org/w/index.php?title=andarsene&oldid=4047113) |
| 22347 | `snort` | verb | 0 | sbuffare con il naso | `sbuffare` | `no-form-sense` |  | [snort](https://it.wiktionary.org/w/index.php?title=snort&oldid=3649969) |
| 22347 | `snort` | verb | 1 | sniffare | `sniffare` | `no-form-sense` |  | [snort](https://it.wiktionary.org/w/index.php?title=snort&oldid=3649969) |
| 29007 | `lupa` | noun | 1 | meretrice, prostituta | `prostituta` | `base-not-confirmed` | `lupo` | [lupa](https://it.wiktionary.org/w/index.php?title=lupa&oldid=4053037) |
| 30774 | `cetaceo` | noun | 0 | nome generico di alcuni mammiferi che hanno l'aspetto di pesci, allattano i cuccioli, hanno sangue a temperatura costante e respirano attraverso i polmoni | `polmoni` | `no-form-sense` |  | [cetaceo](https://it.wiktionary.org/w/index.php?title=cetaceo&oldid=4003374) |
| 31563 | `papera` | noun | 1 | errore involontario commesso parlando: lapsus, inciampo | `inciampo` | `no-form-sense` |  | [papera](https://it.wiktionary.org/w/index.php?title=papera&oldid=3770174) |
| 38000 | `stagioni` | noun | 0 | quattro periodi di tre mesi in cui è suddiviso l'anno: primavera, estate, autunno, inverno | `inverno` | `no-form-sense` |  | [stagioni](https://it.wiktionary.org/w/index.php?title=stagioni&oldid=3855269) |
| 38759 | `estetica` | noun | 0 | ramo della filosofia che si occupa del concetto di bello | `bello` | `no-form-sense` |  | [estetica](https://it.wiktionary.org/w/index.php?title=estetica&oldid=4047353) |
| 38759 | `estetica` | noun | 2 | ciò per cui la complessità di un bene di consumo nel suo insieme è generalmente massimamente apprezzata | `apprezzata` | `no-form-sense` |  | [estetica](https://it.wiktionary.org/w/index.php?title=estetica&oldid=4047353) |
| 38759 | `estetica` | noun | 3 | l'aspetto esterno | `esterno` | `no-form-sense` |  | [estetica](https://it.wiktionary.org/w/index.php?title=estetica&oldid=4047353) |
| 38800 | `starci` | verb | 0 | (italiano meridionale) esserci | `esserci` | `no-form-sense` |  | [starci](https://it.wiktionary.org/w/index.php?title=starci&oldid=3444285) |
| 38800 | `starci` | verb | 2 | acconsentire | `acconsentire` | `no-form-sense` |  | [starci](https://it.wiktionary.org/w/index.php?title=starci&oldid=3444285) |
| 39598 | `punkettone` | noun | 0 | ragazzo che ascolta musica punk | `musica` | `no-form-sense` |  | [punkettone](https://it.wiktionary.org/w/index.php?title=punkettone&oldid=3434852) |
| 39775 | `riferito` | verb | 0 | detto | `detto` | `no-form-sense` |  | [riferito](https://it.wiktionary.org/w/index.php?title=riferito&oldid=4005001) |
| 40167 | `fregarsene` | verb | 0 | curarsi poco di qualcosa o qualcuno, non darsi pena, non preoccuparsi | `pena` | `no-form-sense` |  | [fregarsene](https://it.wiktionary.org/w/index.php?title=fregarsene&oldid=4041757) |
| 40167 | `fregarsene` | verb | 1 | Me ne frego!: motto fascista del passato | `fascista` | `no-form-sense` |  | [fregarsene](https://it.wiktionary.org/w/index.php?title=fregarsene&oldid=4041757) |
| 40171 | `maroni` | noun | 0 | magistrati o sacerdoti dell'Etruria | `Etruria` | `no-form-sense` |  | [maroni](https://it.wiktionary.org/w/index.php?title=maroni&oldid=3854621) |
| 40171 | `maroni` | noun | 1 | testicoli | `testicoli` | `no-form-sense` |  | [maroni](https://it.wiktionary.org/w/index.php?title=maroni&oldid=3854621) |
| 40335 | `basilica` | noun | 0 | vena principale dell'avambraccio | `avambraccio` | `no-form-sense` |  | [basilica](https://it.wiktionary.org/w/index.php?title=basilica&oldid=4050759) |
| 40468 | `fica` | noun | 0 | frutto del fico | `fico` | `no-form-sense` |  | [fica](https://it.wiktionary.org/w/index.php?title=fica&oldid=3981081) |
| 40468 | `fica` | noun | 2 | donna attraente | `attraente` | `no-form-sense` |  | [fica](https://it.wiktionary.org/w/index.php?title=fica&oldid=3981081) |
| 40468 | `fica` | noun | 3 | segno di scherno mostrato con la mano chiusa a pugno ponendo il pollice tra l'indice e il medio | `medio` | `no-form-sense` |  | [fica](https://it.wiktionary.org/w/index.php?title=fica&oldid=3981081) |
| 42040 | `magistrali` | noun | 0 | scuola magistrale o istituto magistrale | `istituto` | `no-form-sense` |  | [magistrali](https://it.wiktionary.org/w/index.php?title=magistrali&oldid=3961461) |
| 42224 | `genti` | noun | 0 | popoli, nazioni | `nazioni` | `no-form-sense` |  | [genti](https://it.wiktionary.org/w/index.php?title=genti&oldid=3892734) |
| 42224 | `genti` | noun | 1 | stirpi, famiglie nel senso largo del termine; le gens dell'antica Roma | `famiglie` | `no-form-sense` |  | [genti](https://it.wiktionary.org/w/index.php?title=genti&oldid=3892734) |
| 42224 | `genti` | noun | 2 | nella letteratura cristiana: coloro che non erano ebrei e in particolare i romani; gentili; | `gentili` | `no-form-sense` |  | [genti](https://it.wiktionary.org/w/index.php?title=genti&oldid=3892734) |
| 42678 | `ori` | noun | 1 | oggetti d'oro | `oggetti` | `no-form-sense` |  | [ori](https://it.wiktionary.org/w/index.php?title=ori&oldid=3428371) |
| 42678 | `ori` | noun | 2 | uno dei quattro semi delle carte da gioco napoletane, specialmente nel gioco della scopa e dello scopone; generalmente negli altri giochi si preferisce "denari" | `denari` | `no-form-sense` |  | [ori](https://it.wiktionary.org/w/index.php?title=ori&oldid=3428371) |
| 42757 | `venir` | verb | 0 | muoversi in direzione dell'interlocutore: venire; | `venire` | `no-form-sense` |  | [venir](https://it.wiktionary.org/w/index.php?title=venir&oldid=3652391) |
| 45751 | `adenoide` | adj | 0 | ipertrofia della tonsilla faringea | `tonsilla` | `no-form-sense` |  | [adenoide](https://it.wiktionary.org/w/index.php?title=adenoide&oldid=3839306) |
| 47293 | `africana` | noun | 0 | donna originaria dell'Africa | `Africa` | `no-form-sense` |  | [africana](https://it.wiktionary.org/w/index.php?title=africana&oldid=3957457) |
| 47877 | `balza` | noun | 0 | luogo ripido e dirupato; paesaggio scosceso e tormentato dalla forte azione erosiva delle idrometeore su rocce tenere; parete subverticale di una montagna o pendio assai erto e impervio | `impervio` | `no-form-sense` |  | [balza](https://it.wiktionary.org/w/index.php?title=balza&oldid=4059899) |
| 47877 | `balza` | noun | 1 | piccolo e stretto ripiano o pianoro che si frappone ai dirupi e agli scoscendimenti montani, come interrompendone la continuità e spezzandone il ritmo; fascia di terreno pianeggiante che cinge tutt'intorno una zona scoscesa | `cinge` | `no-form-sense` |  | [balza](https://it.wiktionary.org/w/index.php?title=balza&oldid=4059899) |
| 47877 | `balza` | noun | 3 | fregio ricamato che fa da cornice a un arazzo, distinguendosene per tessitura | `tessitura` | `no-form-sense` |  | [balza](https://it.wiktionary.org/w/index.php?title=balza&oldid=4059899) |
| 47877 | `balza` | noun | 4 | zoccolo, fascia inferiore dei muri di un locale, che si differenzia dal resto della parete per come è dipinta o rivestita | `rivestita` | `no-form-sense` |  | [balza](https://it.wiktionary.org/w/index.php?title=balza&oldid=4059899) |
| 47877 | `balza` | noun | 5 | fascia di pelo candido sopra lo zoccolo dei cavalli balzani | `balzani` | `no-form-sense` |  | [balza](https://it.wiktionary.org/w/index.php?title=balza&oldid=4059899) |
| 47961 | `biochimico` | adj | 0 | relativo o attinente alla biochimica | `biochimica` | `no-form-sense` |  | [biochimico](https://it.wiktionary.org/w/index.php?title=biochimico&oldid=3893458) |
| 48055 | `cagna` | noun | 1 | donnaccia, donna di facili costumi | `donnaccia` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48055 | `cagna` | noun | 2 | nel gergo teatrale: cantante o attrice da strapazzo, stonata e con poca voce | `cantante` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48055 | `cagna` | noun | 3 | cambiale | `cambiale` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48055 | `cagna` | noun | 4 | bugia, frottola | `frottola` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48055 | `cagna` | noun | 5 | lunga leva con un dente mobile per afferrare i cerchioni riscaldati, adattarli alle ruote dei carri e per montarli | `cerchioni` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48055 | `cagna` | noun | 7 | notidano cinereo | `notidano cinereo` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48055 | `cagna` | noun | 8 | nome comune di alcuni squali delle famiglie Isuridi, quale il mako e lo squalo tonno, Lamnidi, quale lo smeriglio, e Carcarinidi, quale la verdesca | `verdesca` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48055 | `cagna` | noun | 9 | sciarrano, capopiatto | `capopiatto` | `no-form-sense` |  | [cagna](https://it.wiktionary.org/w/index.php?title=cagna&oldid=4075686) |
| 48253 | `cesoie` | noun | 0 | tipo di forbici utilizzate soprattutto nel giardinaggio | `giardinaggio` | `base-not-confirmed` | `cesoia` | [cesoie](https://it.wiktionary.org/w/index.php?title=cesoie&oldid=3893545) |
| 48444 | `cognata` | noun | 0 | sorella di uno dei coniugi | `coniugi` | `no-form-sense` |  | [cognata](https://it.wiktionary.org/w/index.php?title=cognata&oldid=3697010) |
| 48444 | `cognata` | noun | 1 | moglie di uno dei fratelli | `fratelli` | `no-form-sense` |  | [cognata](https://it.wiktionary.org/w/index.php?title=cognata&oldid=3697010) |
| 48631 | `comunicando` | noun | 0 | chi sta per ricevere il sacramento della Comunione | `Comunione` | `no-form-sense` |  | [comunicando](https://it.wiktionary.org/w/index.php?title=comunicando&oldid=4045444) |
| 49241 | `dentata` | noun | 0 | morso | `morso` | `no-form-sense` |  | [dentata](https://it.wiktionary.org/w/index.php?title=dentata&oldid=3396930) |
| 49258 | `rimetterci` | verb | 0 | (familiar) to lose, to ruin | `ruin` | `no-form-sense` |  | [rimetterci](https://it.wiktionary.org/w/index.php?title=rimetterci&oldid=3648399) |
| 49716 | `favorita` | noun | 0 | amante di chi detiene potere | `potere` | `no-form-sense` |  | [favorita](https://it.wiktionary.org/w/index.php?title=favorita&oldid=3960234) |
| 49716 | `favorita` | noun | 1 | squadra che presumibilmente ha maggiori possibilità di vincere | `vincere` | `no-form-sense` |  | [favorita](https://it.wiktionary.org/w/index.php?title=favorita&oldid=3960234) |
| 50002 | `genitali` | noun | 0 | nome comune degli organi genitali, specialmente quelli visibili. | `visibili` | `no-form-sense` |  | [genitali](https://it.wiktionary.org/w/index.php?title=genitali&oldid=3820643) |
| 50076 | `greca` | noun | 0 | tipo di motivo decorativo geometrico, tipico dei palazzi dell'antica Grecia | `palazzi` | `no-form-sense` |  | [greca](https://it.wiktionary.org/w/index.php?title=greca&oldid=3894134) |
| 50626 | `intemperie` | noun | 0 | perturbazione atmosferica come pioggia, neve, grandine e sim. | `grandine` | `no-form-sense` |  | [intemperie](https://it.wiktionary.org/w/index.php?title=intemperie&oldid=4033378) |
| 51769 | `migliore` | adj | 1 | preferibile , seguito da di (complemento di paragone) | `preferibile` | `no-form-sense` |  | [migliore](https://it.wiktionary.org/w/index.php?title=migliore&oldid=4014053) |
| 51769 | `migliore` | adj | 2 | il più preferibile | `preferibile` | `no-form-sense` |  | [migliore](https://it.wiktionary.org/w/index.php?title=migliore&oldid=4014053) |
| 52201 | `passata` | noun | 0 | salsa pronta | `pronta` | `no-form-sense` |  | [passata](https://it.wiktionary.org/w/index.php?title=passata&oldid=3894689) |
| 54498 | `suocera` | noun | 1 | donna che vuole sempre correggere e riprendere | `riprendere` | `no-form-sense` |  | [suocera](https://it.wiktionary.org/w/index.php?title=suocera&oldid=3895324) |
| 54583 | `tavolino` | noun | 1 | (Item of furniture) A small table, an occasional table, a table or a desk. | `desk` | `no-form-sense` |  | [tavolino](https://it.wiktionary.org/w/index.php?title=tavolino&oldid=3828400) |
| 56392 | `balzana` | noun | 0 | macchia dall'aspetto di una striscia bianca che hanno sulle zampe alcuni cavalli | `cavalli` | `no-form-sense` |  | [balzana](https://it.wiktionary.org/w/index.php?title=balzana&oldid=3928196) |
| 56392 | `balzana` | noun | 1 | balzana ( approfondimento) partizione orizzontale a metà, dello scudo, o di pezze e figure: troncato | `troncato` | `no-form-sense` |  | [balzana](https://it.wiktionary.org/w/index.php?title=balzana&oldid=3928196) |
| 56392 | `balzana` | noun | 2 | striscia di tessuto sull'orlo delle vesti o delle tende | `tende` | `no-form-sense` |  | [balzana](https://it.wiktionary.org/w/index.php?title=balzana&oldid=3928196) |
| 60160 | `parche` | noun | 0 | figure mitologiche formate da 3 vecchie tessitrici scorbutiche che stabilivano il destino degli esseri umani tramite la tessitura del filo della vita. | `tessitura` | `no-form-sense` |  | [parche](https://it.wiktionary.org/w/index.php?title=parche&oldid=3975304) |
| 60618 | `regionali` | noun | 0 | treni locali | `locali` | `no-form-sense` |  | [regionali](https://it.wiktionary.org/w/index.php?title=regionali&oldid=3834127) |
| 61840 | `resti` | noun | 0 | spoglie | `spoglie` | `no-form-sense` |  | [resti](https://it.wiktionary.org/w/index.php?title=resti&oldid=4053067) |
| 62176 | `protrettica` | adj | 0 | sollecitativo, esortativo | `esortativo` | `no-form-sense` |  | [protrettica](https://it.wiktionary.org/w/index.php?title=protrettica&oldid=3661873) |
| 63649 | `giumenta` | noun | 1 | cavalla da sella | `sella` | `base-not-confirmed` | `giumento` | [giumenta](https://it.wiktionary.org/w/index.php?title=giumenta&oldid=3896034) |
| 64796 | `matematici` | noun | 0 | studiosi di matematica | `matematica` | `no-form-sense` |  | [matematici](https://it.wiktionary.org/w/index.php?title=matematici&oldid=4013450) |
| 65118 | `strofinata` | noun | 0 | operazione di strofinamento | `strofinamento` | `no-form-sense` |  | [strofinata](https://it.wiktionary.org/w/index.php?title=strofinata&oldid=3792061) |
| 72035 | `corteccia` | noun | 0 | strato esterno che ricopre l'albero | `albero` | `no-form-sense` |  | [corteccia](https://it.wiktionary.org/w/index.php?title=corteccia&oldid=4049374) |
| 72035 | `corteccia` | noun | 2 | aspetto esteriore, superficiale di qualcosa o qualcuno; apparenza, esteriorità | `esteriorità` | `no-form-sense` |  | [corteccia](https://it.wiktionary.org/w/index.php?title=corteccia&oldid=4049374) |
| 72035 | `corteccia` | noun | 3 | parte esterna, parte periferica di un organo | `organo` | `no-form-sense` |  | [corteccia](https://it.wiktionary.org/w/index.php?title=corteccia&oldid=4049374) |
| 72967 | `colatrice` | noun | 0 | macchina utilizzata nel settore della pasticceria per la produzione di biscotti | `biscotti` | `base-not-confirmed` | `colatore` | [colatrice](https://it.wiktionary.org/w/index.php?title=colatrice&oldid=1503809) |
| 74704 | `punzonatrice` | noun | 0 | macchina per punzonare | `macchina` | `no-form-sense` |  | [punzonatrice](https://it.wiktionary.org/w/index.php?title=punzonatrice&oldid=3038733) |
| 80069 | `temporali` | adj | 0 | di poco durata | `durata` | `no-form-sense` |  | [temporali](https://it.wiktionary.org/w/index.php?title=temporali&oldid=3978884) |
| 80069 | `temporali` | adj | 1 | inerenti alle tempie | `tempie` | `no-form-sense` |  | [temporali](https://it.wiktionary.org/w/index.php?title=temporali&oldid=3978884) |
| 81464 | `stradina` | noun | 2 | strada piccola o stretta | `stretta` | `base-not-confirmed` | `stradino` | [stradina](https://it.wiktionary.org/w/index.php?title=stradina&oldid=3739846) |
| 84090 | `paracula` | noun | 1 | prostituta | `prostituta` | `base-not-confirmed` | `paraculo` | [paracula](https://it.wiktionary.org/w/index.php?title=paracula&oldid=3429704) |
| 85535 | `valori` | noun | 1 | quanto di "caro" pertiene gli individui | `pertiene` | `no-form-sense` |  | [valori](https://it.wiktionary.org/w/index.php?title=valori&oldid=4049569) |
| 87612 | `edili` | noun | 0 | lavoratori dell'edilizia | `edilizia` | `no-form-sense` |  | [edili](https://it.wiktionary.org/w/index.php?title=edili&oldid=4046837) |
| 88164 | `pendenti` | noun | 0 | orecchini con ciondoli a goccia | `goccia` | `no-form-sense` |  | [pendenti](https://it.wiktionary.org/w/index.php?title=pendenti&oldid=3877723) |
| 88693 | `avanzi` | noun | 1 | ciò che è avanzato da un pasto | `pasto` | `base-not-confirmed` | `avanzo` | [avanzi](https://it.wiktionary.org/w/index.php?title=avanzi&oldid=3835119) |
| 97036 | `vacca di mare` | noun | 0 | mammifero estinto appartenente all'ordine dei Sirenidi, la sua classificazione scientifica è Hydrodamalis gigas ( tassonomia) | `Sirenidi` | `no-form-sense` |  | [vacca di mare](https://it.wiktionary.org/w/index.php?title=vacca%20di%20mare&oldid=1477103) |
| 99227 | `liuti` | noun | 0 | famiglia di cordofoni secondo la classificazione di Hornbostel-Sachs | `cordofoni` | `no-form-sense` |  | [liuti](https://it.wiktionary.org/w/index.php?title=liuti&oldid=3951810) |
| 99322 | `etere` | noun | 0 | spazio attraverso il quale si propagano le onde elettromagnetiche | `elettromagnetiche` | `no-form-sense` |  | [etere](https://it.wiktionary.org/w/index.php?title=etere&oldid=3793278) |
| 99322 | `etere` | noun | 2 | anche con Einstein, originariamente si teorizzava costituisse le scie delle traiettorie nello spazio | `spazio` | `no-form-sense` |  | [etere](https://it.wiktionary.org/w/index.php?title=etere&oldid=3793278) |
| 99322 | `etere` | noun | 3 | nell'esoterismo alchemico concerne l'archetipo del silicio | `silicio` | `no-form-sense` |  | [etere](https://it.wiktionary.org/w/index.php?title=etere&oldid=3793278) |
| 99322 | `etere` | noun | 4 | allusione a qualcosa che dona calma e/o euforia, quindi all'amore per quanto concerne i sentimenti | `sentimenti` | `no-form-sense` |  | [etere](https://it.wiktionary.org/w/index.php?title=etere&oldid=3793278) |
| 99322 | `etere` | noun | 5 | via etere: soprattutto con riferimento ai programmi televisivi, è espressione gergale che intende appunto la messa in onda | `messa in onda` | `no-form-sense` |  | [etere](https://it.wiktionary.org/w/index.php?title=etere&oldid=3793278) |
| 102009 | `regole` | noun | 0 | mestruazioni | `mestruazioni` | `no-form-sense` |  | [regole](https://it.wiktionary.org/w/index.php?title=regole&oldid=4047304) |
| 102548 | `fiumana` | adj | 0 | di fiume | `fiume` | `no-form-sense` |  | [fiumana](https://it.wiktionary.org/w/index.php?title=fiumana&oldid=3959712) |
| 102549 | `fiumana` | adj | 0 | della città di Fiume | `Fiume` | `no-form-sense` |  | [fiumana](https://it.wiktionary.org/w/index.php?title=fiumana&oldid=3959712) |
| 102551 | `fiumana` | noun | 0 | abitante di fiume | `fiume` | `no-form-sense` |  | [fiumana](https://it.wiktionary.org/w/index.php?title=fiumana&oldid=3959712) |
| 102552 | `fiumane` | adj | 0 | fluviali | `fluviali` | `no-form-sense` |  | [fiumane](https://it.wiktionary.org/w/index.php?title=fiumane&oldid=3505339) |
| 102553 | `fiumane` | adj | 0 | di Fiume | `Fiume` | `no-form-sense` |  | [fiumane](https://it.wiktionary.org/w/index.php?title=fiumane&oldid=3505339) |
| 102554 | `fiumane` | noun | 0 | abitante di Fiume | `Fiume` | `no-form-sense` |  | [fiumane](https://it.wiktionary.org/w/index.php?title=fiumane&oldid=3505339) |
| 103170 | `bruscolini` | noun | 1 | cosa da poco, quisquilia | `quisquilia` | `base-not-confirmed` | `bruscolino` | [bruscolini](https://it.wiktionary.org/w/index.php?title=bruscolini&oldid=2854626) |
| 103511 | `lambrecchini` | noun | 0 | svolazzi | `svolazzi` | `no-form-sense` |  | [lambrecchini](https://it.wiktionary.org/w/index.php?title=lambrecchini&oldid=3418598) |
| 103727 | `pa` | noun | 0 | maniera confidenziale con cui ci si rivolge al proprio papà | `papà` | `no-form-sense` |  | [pa](https://it.wiktionary.org/w/index.php?title=pa&oldid=3791008) |
| 103825 | `Oscini` | noun | 0 | uccelli canterini | `canterini` | `no-form-sense` |  | [Oscini](https://it.wiktionary.org/w/index.php?title=Oscini&oldid=3768215) |
| 104971 | `replicante` | verb | 0 | che replica | `replica` | `no-form-sense` |  | [replicante](https://it.wiktionary.org/w/index.php?title=replicante&oldid=3476101) |
| 106464 | `ciglia` | noun | 0 | filamenti del citoplasma | `citoplasma` | `no-form-sense` |  | [ciglia](https://it.wiktionary.org/w/index.php?title=ciglia&oldid=4000677) |
| 107644 | `zombi` | noun | 0 | in alcune credenze popolari del mar dei Caraibi, spirito di origine soprannaturale in grado di far tornare in vita un defunto | `defunto` | `no-form-sense` |  | [zombi](https://it.wiktionary.org/w/index.php?title=zombi&oldid=4035944) |
| 107644 | `zombi` | noun | 1 | nel linguaggio comune, il defunto stesso, tornato in vita ma sottostante agli ordini dello spirito rianimatore | `rianimatore` | `no-form-sense` |  | [zombi](https://it.wiktionary.org/w/index.php?title=zombi&oldid=4035944) |
| 107644 | `zombi` | noun | 2 | persona priva di emozioni e sentimenti | `sentimenti` | `no-form-sense` |  | [zombi](https://it.wiktionary.org/w/index.php?title=zombi&oldid=4035944) |
| 107644 | `zombi` | noun | 3 | tossicodipendente | `tossicodipendente` | `no-form-sense` |  | [zombi](https://it.wiktionary.org/w/index.php?title=zombi&oldid=4035944) |
| 109045 | `vinattiere` | noun | 0 | chi vende vino, oste | `oste` | `no-form-sense` |  | [vinattiere](https://it.wiktionary.org/w/index.php?title=vinattiere&oldid=3652569) |
| 110663 | `patristica` | noun | 0 | studio della storia e delle opere dei membri della Chiesa | `Chiesa` | `no-form-sense` |  | [patristica](https://it.wiktionary.org/w/index.php?title=patristica&oldid=3898940) |
| 110869 | `centrifugo` | adj | 0 | che ha tendenza a spingersi o a spingere lontano dal centro | `centro` | `no-form-sense` |  | [centrifugo](https://it.wiktionary.org/w/index.php?title=centrifugo&oldid=3898979) |
| 110869 | `centrifugo` | adj | 1 | relativo alla forza centrifuga | `centrifuga` | `no-form-sense` |  | [centrifugo](https://it.wiktionary.org/w/index.php?title=centrifugo&oldid=3898979) |
| 112615 | `bisonti` | noun | 0 | famiglia dei Bovidi | `Bovidi` | `no-form-sense` |  | [bisonti](https://it.wiktionary.org/w/index.php?title=bisonti&oldid=4032824) |
| 112625 | `caprioli` | noun | 0 | Cervidi | `Cervidi` | `no-form-sense` |  | [caprioli](https://it.wiktionary.org/w/index.php?title=caprioli&oldid=4003993) |
| 112818 | `Pterosauri` | noun | 0 | ordine di rettili estinti nati nel Triassico superiore, con ossa cave e pneumatiche come quelle dei moderni uccelli e capaci di volare con ali membranose rette dal quarto dito delle estremità superiori | `superiori` | `no-form-sense` |  | [Pterosauri](https://it.wiktionary.org/w/index.php?title=Pterosauri&oldid=4008113) |
| 113985 | `toracico` | adj | 0 | relativo al torace | `torace` | `no-form-sense` |  | [toracico](https://it.wiktionary.org/w/index.php?title=toracico&oldid=3984329) |
| 114033 | `gaffe` | noun | 0 | errore imbarazzante | `imbarazzante` | `no-form-sense` |  | [gaffe](https://it.wiktionary.org/w/index.php?title=gaffe&oldid=4055494) |
| 114103 | `caffettiera` | noun | 0 | macchinetta per il caffè | `macchinetta` | `no-form-sense` |  | [caffettiera](https://it.wiktionary.org/w/index.php?title=caffettiera&oldid=3899295) |
| 114117 | `squamoso` | adj | 0 | ricoperto di squame | `squame` | `no-form-sense` |  | [squamoso](https://it.wiktionary.org/w/index.php?title=squamoso&oldid=3978133) |
| 114305 | `tuffo a candela` | noun | 0 | tuffo eseguito entrando in acqua con i piedi uniti | `acqua` | `no-form-sense` |  | [tuffo a candela](https://it.wiktionary.org/w/index.php?title=tuffo%20a%20candela&oldid=2108071) |
| 114726 | `pavana` | noun | 0 | ballo solenne in voga tra il XVI e il XVIII secolo | `secolo` | `no-form-sense` |  | [pavana](https://it.wiktionary.org/w/index.php?title=pavana&oldid=3899364) |
| 114726 | `pavana` | noun | 1 | la musica per questo ballo | `musica` | `no-form-sense` |  | [pavana](https://it.wiktionary.org/w/index.php?title=pavana&oldid=3899364) |
| 114726 | `pavana` | noun | 2 | gallina padovana | `padovana` | `no-form-sense` |  | [pavana](https://it.wiktionary.org/w/index.php?title=pavana&oldid=3899364) |
| 115037 | `occhiali` | noun | 0 | oggetto composto da due lenti trasparenti fissate ad una montatura composte anche, nella maggior parte dei casi, da due stanghette che si appoggiano sulle orecchie, che funge da correttore dei difetti della vista o da protezione degli occhi da radiazioni solari, abbagliamento e riflessi | `riflessi` | `no-form-sense` |  | [occhiali](https://it.wiktionary.org/w/index.php?title=occhiali&oldid=4017102) |
| 115037 | `occhiali` | noun | 1 | nella dama, posizionamento di una propria dama tra due dame indifese dell'avversario, con il risultato che una delle due dame dell'avversario verrà sicuramente mangiata | `avversario` | `no-form-sense` |  | [occhiali](https://it.wiktionary.org/w/index.php?title=occhiali&oldid=4017102) |
| 115037 | `occhiali` | noun | 2 | nelle partite di calcio, il risultato a reti inviolate, ossia 0 a 0 | `inviolate` | `no-form-sense` |  | [occhiali](https://it.wiktionary.org/w/index.php?title=occhiali&oldid=4017102) |
| 115091 | `schiava` | noun | 0 | sinonimo di vitora preleci | `vitora preleci` | `no-form-sense` |  | [schiava](https://it.wiktionary.org/w/index.php?title=schiava&oldid=4053644) |
| 115976 | `acetarie` | adj | 0 | (di erbe) che si condiscono con l'aceto e si mangiano in insalata | `insalata` | `no-form-sense` |  | [acetarie](https://it.wiktionary.org/w/index.php?title=acetarie&oldid=3465596) |
| 119990 | `gattara` | noun | 0 | donna che accudisce i gatti randagi | `donna` | `no-form-sense` |  | [gattara](https://it.wiktionary.org/w/index.php?title=gattara&oldid=3990599) |
| 120005 | `pornoprofessoressa` | noun | 0 | professoressa che compie atti osceni in classe | `osceni` | `no-form-sense` |  | [pornoprofessoressa](https://it.wiktionary.org/w/index.php?title=pornoprofessoressa&oldid=3432862) |
| 120311 | `stazza` | noun | 0 | grandezza che misura il volume disponibile per il carico in una nave mercantile. L'unità di misura è la tonnellata di stazza che equivale ad un barile da 1.030 litri | `litri` | `no-form-sense` |  | [stazza](https://it.wiktionary.org/w/index.php?title=stazza&oldid=3900094) |
| 123790 | `concordanze` | noun | 1 | uno dei metodi della ricerca induttiva individuati da John Stuart Mill; secondo il metodo delle concordanze, se nella ripetizione di un fenomeno si presenta sempre la stessa caratteristica, questa è da ritenere causa oppure effetto del fenomeno | `effetto` | `no-form-sense` |  | [concordanze](https://it.wiktionary.org/w/index.php?title=concordanze&oldid=3276607) |
| 125394 | `gozzoviglia` | noun | 0 | pranzo ove i partecipanti mangiano e bevono in abbondanza, baldoria | `baldoria` | `no-form-sense` |  | [gozzoviglia](https://it.wiktionary.org/w/index.php?title=gozzoviglia&oldid=3640392) |
| 127301 | `miccino` | noun | 1 | si usa spesso in Toscana nella frase "fare a miccino", inteso come "usare con parsimonia". | `parsimonia` | `no-form-sense` |  | [miccino](https://it.wiktionary.org/w/index.php?title=miccino&oldid=1965095) |
| 135415 | `bufala` | noun | 1 | asserzione non veritiera | `asserzione` | `no-form-sense` |  | [bufala](https://it.wiktionary.org/w/index.php?title=bufala&oldid=3955900) |
| 135831 | `milizie` | noun | 0 | piccolo esercito personale | `esercito` | `no-form-sense` |  | [milizie](https://it.wiktionary.org/w/index.php?title=milizie&oldid=3712682) |
| 138557 | `manette` | noun | 0 | coppia di anelli, tenute insieme da una piccola catena, con cui la polizia chiude i polsi degli arrestati | `polizia` | `no-form-sense` |  | [manette](https://it.wiktionary.org/w/index.php?title=manette&oldid=3960151) |
| 139072 | `cenci` | noun | 0 | dolce tradizionale italiano, del carnevale, detto anche: chiacchiere, galani ecc. | `galani` | `no-form-sense` |  | [cenci](https://it.wiktionary.org/w/index.php?title=cenci&oldid=3273159) |
| 139072 | `cenci` | noun | 1 | dolce tradizionale italiano, del carnevale, detto anche: chiacchiere, galani ecc. | `galani` | `no-form-sense` |  | [cenci](https://it.wiktionary.org/w/index.php?title=cenci&oldid=3273159) |
| 139477 | `petente` | verb | 0 | colui che pone delle richieste | `colui` | `no-form-sense` |  | [petente](https://it.wiktionary.org/w/index.php?title=petente&oldid=3646016) |
| 139780 | `rilasciati` | adj | 0 | lasciati nuovamente | `lasciati` | `no-form-sense` |  | [rilasciati](https://it.wiktionary.org/w/index.php?title=rilasciati&oldid=3902526) |
| 139780 | `rilasciati` | adj | 1 | concessi a qualcuno | `concessi` | `no-form-sense` |  | [rilasciati](https://it.wiktionary.org/w/index.php?title=rilasciati&oldid=3902526) |
| 139780 | `rilasciati` | adj | 2 | rimessi in libertà, liberati | `liberati` | `no-form-sense` |  | [rilasciati](https://it.wiktionary.org/w/index.php?title=rilasciati&oldid=3902526) |
| 139782 | `rilasciate` | adj | 0 | lasciate nuovamente | `lasciate` | `no-form-sense` |  | [rilasciate](https://it.wiktionary.org/w/index.php?title=rilasciate&oldid=3902527) |
| 139782 | `rilasciate` | adj | 1 | concesse a qualcuno | `concesse` | `no-form-sense` |  | [rilasciate](https://it.wiktionary.org/w/index.php?title=rilasciate&oldid=3902527) |
| 139782 | `rilasciate` | adj | 2 | rimesso in libertà, liberate | `liberate` | `no-form-sense` |  | [rilasciate](https://it.wiktionary.org/w/index.php?title=rilasciate&oldid=3902527) |
| 139784 | `rilasciata` | adj | 0 | lasciata nuovamente | `lasciata` | `no-form-sense` |  | [rilasciata](https://it.wiktionary.org/w/index.php?title=rilasciata&oldid=3902528) |
| 139784 | `rilasciata` | adj | 1 | concessa a qualcuno | `concessa` | `no-form-sense` |  | [rilasciata](https://it.wiktionary.org/w/index.php?title=rilasciata&oldid=3902528) |
| 139784 | `rilasciata` | adj | 2 | rimesso in libertà, liberata | `liberata` | `no-form-sense` |  | [rilasciata](https://it.wiktionary.org/w/index.php?title=rilasciata&oldid=3902528) |
| 139851 | `zarina` | noun | 0 | titolo utilizzato per riferirsi alla consorte reale dello zar; imperatrice di Russia | `Russia` | `no-form-sense` |  | [zarina](https://it.wiktionary.org/w/index.php?title=zarina&oldid=3902535) |
| 148069 | `impennata` | noun | 1 | rialzo repentino | `repentino` | `no-form-sense` |  | [impennata](https://it.wiktionary.org/w/index.php?title=impennata&oldid=3981793) |
| 156395 | `balestrino` | noun | 0 | tipo di balestra molto piccola, pensata per lanciare dardi | `dardi` | `no-form-sense` |  | [balestrino](https://it.wiktionary.org/w/index.php?title=balestrino&oldid=3826142) |
| 163088 | `grelle` | noun | 0 | insieme di reti metalliche a maglie strettissime da stendere su una superficie piana | `stendere` | `no-form-sense` |  | [grelle](https://it.wiktionary.org/w/index.php?title=grelle&oldid=3816413) |
| 172342 | `consumi` | noun | 0 | l'insieme di ciò che viene comperato e consumato solitamente dalla popolazione | `insieme` | `no-form-sense` |  | [consumi](https://it.wiktionary.org/w/index.php?title=consumi&oldid=3393444) |
| 180959 | `isolati` | noun | 0 | isole urbanistiche | `isole` | `no-form-sense` |  | [isolati](https://it.wiktionary.org/w/index.php?title=isolati&oldid=3920562) |
| 222790 | `pelati` | noun | 0 | ellissi di pomodori pelati | `pomodori` | `no-form-sense` |  | [pelati](https://it.wiktionary.org/w/index.php?title=pelati&oldid=3919871) |
| 225569 | `australiana` | adj | 0 | riferito all'Australia | `Australia` | `no-form-sense` |  | [australiana](https://it.wiktionary.org/w/index.php?title=australiana&oldid=3967522) |
| 225571 | `australiana` | noun | 0 | abitante dell'Australia | `Australia` | `no-form-sense` |  | [australiana](https://it.wiktionary.org/w/index.php?title=australiana&oldid=3967522) |
| 258413 | `assordante` | adj | 0 | che ha un volume o un'intensità talmente elevati da causare sordità (solitamente utilizzato in senso figurato, come iperbole) | `iperbole` | `no-form-sense` |  | [assordante](https://it.wiktionary.org/w/index.php?title=assordante&oldid=3972167) |
| 290937 | `balbuzie` | noun | 0 | alternanza patologica di ripetizioni involontarie, interruzioni e prolungamenti della voce e del linguaggio | `linguaggio` | `no-form-sense` |  | [balbuzie](https://it.wiktionary.org/w/index.php?title=balbuzie&oldid=3959394) |
| 297779 | `aerotraino` | noun | 0 | il traino di un mezzo aereo da parte di un secondo velivolo | `velivolo` | `no-form-sense` |  | [aerotraino](https://it.wiktionary.org/w/index.php?title=aerotraino&oldid=3834856) |
| 300226 | `etimologizzante` | verb | 1 | : detto di parola per la quale gli etimologisti e i lessicografi riescono a risalire all'etimo o lemma. | `lemma` | `no-form-sense` |  | [etimologizzante](https://it.wiktionary.org/w/index.php?title=etimologizzante&oldid=3941833) |
| 300226 | `etimologizzante` | verb | 2 | : dicesi etimologizzante il tipo software cosiddetto lemmatizzatore (neologismo e inglesismo da lemmatizer) capace di etimologizzare o lemmatizzare un intero dizionario, individuando i lemmi o etimi o lessemi delle parole e quindi catalogando tutte le famiglie etimologiche | `famiglie etimologiche` | `no-form-sense` |  | [etimologizzante](https://it.wiktionary.org/w/index.php?title=etimologizzante&oldid=3941833) |
| 300228 | `etimologizzato` | verb | 1 | : detto di vocaboli per i quali gli etimologisti e i lessicografi sono riusciti a risalire all'etimo o lemma. | `lemma` | `no-form-sense` |  | [etimologizzato](https://it.wiktionary.org/w/index.php?title=etimologizzato&oldid=3941846) |
| 300228 | `etimologizzato` | verb | 2 | : dicesi etimologizzato delle parole o vocaboli sottoposti al tipo di software cosiddetto lemmatizzatore (neologismo e inglesismo da lemmatizer) e che quindi hanno ricevuto la etimologizzazione o lemmatizzazione | `lemmatizzazione` | `no-form-sense` |  | [etimologizzato](https://it.wiktionary.org/w/index.php?title=etimologizzato&oldid=3941846) |
| 300233 | `etimologizzate` | verb | 1 | : detto delle parole per le quali gli etimologisti e i lessicografi sono riusciti a risalire all'etimo o lemma. | `lemma` | `no-form-sense` |  | [etimologizzate](https://it.wiktionary.org/w/index.php?title=etimologizzate&oldid=4124631) |
| 300233 | `etimologizzate` | verb | 2 | : dicesi etimologizzate le parole (mentre etimologizzati i vocaboli) sottoposte al tipo di software cosiddetto lemmatizzatore (neologismo e inglesismo da lemmatizer), parole che quindi hanno ricevuto la etimologizzazione o lemmatizzazione | `lemmatizzazione` | `no-form-sense` |  | [etimologizzate](https://it.wiktionary.org/w/index.php?title=etimologizzate&oldid=4124631) |
| 346768 | `torreggiante` | adj | 0 | che si staglia | `staglia` | `no-form-sense` |  | [torreggiante](https://it.wiktionary.org/w/index.php?title=torreggiante&oldid=3975026) |
| 362392 | `soverchiante` | verb | 1 | di grave peso, quasi oltre la sopportazione | `sopportazione` | `base-not-confirmed` | `soverchiare` | [soverchiante](https://it.wiktionary.org/w/index.php?title=soverchiante&oldid=3955084) |
| 362392 | `soverchiante` | verb | 2 | che non può essere controllato | `controllato` | `base-not-confirmed` | `soverchiare` | [soverchiante](https://it.wiktionary.org/w/index.php?title=soverchiante&oldid=3955084) |
| 379800 | `indebolito` | adj | 0 | che è divenuto debole | `debole` | `no-form-sense` |  | [indebolito](https://it.wiktionary.org/w/index.php?title=indebolito&oldid=3988240) |
| 381199 | `supplente` | adj | 0 | che supplisce a una mancanza | `supplisce` | `no-form-sense` |  | [supplente](https://it.wiktionary.org/w/index.php?title=supplente&oldid=3966613) |
| 381200 | `supplente` | noun | 0 | chi sostituisce provvisoriamente qualcuno nello svolgimento delle sue funzioni | `provvisoriamente` | `no-form-sense` |  | [supplente](https://it.wiktionary.org/w/index.php?title=supplente&oldid=3966613) |
| 412599 | `ruderi` | noun | 0 | luogo e/o costruzione in macerie, spesso in abbandono | `abbandono` | `no-form-sense` |  | [ruderi](https://it.wiktionary.org/w/index.php?title=ruderi&oldid=3953467) |
| 412676 | `orbi` | noun | 1 | individui senza criteri di saggezza | `saggezza` | `no-form-sense` |  | [orbi](https://it.wiktionary.org/w/index.php?title=orbi&oldid=4039283) |
| 413072 | `ferrea` | adj | 0 | di ferro | `ferro` | `no-form-sense` |  | [ferrea](https://it.wiktionary.org/w/index.php?title=ferrea&oldid=3904308) |
| 416228 | `ammonitore` | noun | 0 | colui che ammonisce | `ammonisce` | `no-form-sense` |  | [ammonitore](https://it.wiktionary.org/w/index.php?title=ammonitore&oldid=3258500) |
| 417047 | `centripeto` | adj | 0 | che ha tendenza a raggiungere il centro | `centro` | `no-form-sense` |  | [centripeto](https://it.wiktionary.org/w/index.php?title=centripeto&oldid=3389822) |
| 417047 | `centripeto` | adj | 1 | relativo alla forza centripeta | `centripeta` | `no-form-sense` |  | [centripeto](https://it.wiktionary.org/w/index.php?title=centripeto&oldid=3389822) |
| 419271 | `spartana` | noun | 0 | residente, nativa di Sparta | `nativa` | `no-form-sense` |  | [spartana](https://it.wiktionary.org/w/index.php?title=spartana&oldid=3944533) |
| 419308 | `norvegesi` | noun | 0 | residenti, originari della Norvegia | `Norvegia` | `no-form-sense` |  | [norvegesi](https://it.wiktionary.org/w/index.php?title=norvegesi&oldid=3942691) |
| 419433 | `venerei` | adj | 0 | inerenti a Venere | `Venere` | `no-form-sense` |  | [venerei](https://it.wiktionary.org/w/index.php?title=venerei&oldid=3859547) |
| 419433 | `venerei` | adj | 1 | che riguardano l'amore fisico | `fisico` | `no-form-sense` |  | [venerei](https://it.wiktionary.org/w/index.php?title=venerei&oldid=3859547) |
| 419569 | `espandibile` | adj | 0 | che può subire un aumento di volume in determinate condizioni | `condizioni` | `no-form-sense` |  | [espandibile](https://it.wiktionary.org/w/index.php?title=espandibile&oldid=3402958) |
| 419623 | `instillare` | verb | 0 | tentativo di infondere ideologie, falsità, fantasie spesso nocive o lesive | `lesive` | `no-form-sense` |  | [instillare](https://it.wiktionary.org/w/index.php?title=instillare&oldid=4040621) |
| 419623 | `instillare` | verb | 1 | esercitare potere coercitivo | `coercitivo` | `no-form-sense` |  | [instillare](https://it.wiktionary.org/w/index.php?title=instillare&oldid=4040621) |
| 419623 | `instillare` | verb | 2 | plagiare | `plagiare` | `no-form-sense` |  | [instillare](https://it.wiktionary.org/w/index.php?title=instillare&oldid=4040621) |
| 419623 | `instillare` | verb | 3 | condurre in modo consono verso una o più mete e con più obiettivi unificanti | `unificanti` | `no-form-sense` |  | [instillare](https://it.wiktionary.org/w/index.php?title=instillare&oldid=4040621) |
| 421205 | `assecondare` | verb | 0 | cercare di convincere o dare l'idea che qualcosa, anche se sbagliato, sembri corretto | `corretto` | `no-form-sense` |  | [assecondare](https://it.wiktionary.org/w/index.php?title=assecondare&oldid=4000018) |
| 421205 | `assecondare` | verb | 1 | fingere ipocritamente in merito al comportamento di qualcuno | `comportamento` | `no-form-sense` |  | [assecondare](https://it.wiktionary.org/w/index.php?title=assecondare&oldid=4000018) |
| 421451 | `rallentatore` | adj | 0 | che rallenta | `rallenta` | `no-form-sense` |  | [rallentatore](https://it.wiktionary.org/w/index.php?title=rallentatore&oldid=4057971) |
| 423056 | `sauropodi` | noun | 1 | animali erbivori quadrupedi | `quadrupedi` | `base-not-confirmed` | `sauropode` | [sauropodi](https://it.wiktionary.org/w/index.php?title=sauropodi&oldid=3439331) |
| 423555 | `rullio` | noun | 0 | rullare continuo di tamburo | `tamburo` | `no-form-sense` |  | [rullio](https://it.wiktionary.org/w/index.php?title=rullio&oldid=3438541) |
| 423566 | `marchesa` | noun | 0 | titolare di un marchesato | `marchesato` | `no-form-sense` |  | [marchesa](https://it.wiktionary.org/w/index.php?title=marchesa&oldid=3839778) |
| 425070 | `talari` | noun | 0 | calzature alate del dio Mercurio | `calzature` | `no-form-sense` |  | [talari](https://it.wiktionary.org/w/index.php?title=talari&oldid=3880626) |
| 425305 | `sacrificale` | adj | 0 | inerente a un sacrificio | `sacrificio` | `no-form-sense` |  | [sacrificale](https://it.wiktionary.org/w/index.php?title=sacrificale&oldid=3886692) |
| 429487 | `rinsavire` | verb | 0 | tornar savio, riprendere la ragione | `ragione` | `no-form-sense` |  | [rinsavire](https://it.wiktionary.org/w/index.php?title=rinsavire&oldid=4012441) |
| 429488 | `rinsavire` | verb | 0 | far ritornare savio | `savio` | `no-form-sense` |  | [rinsavire](https://it.wiktionary.org/w/index.php?title=rinsavire&oldid=4012441) |
| 429497 | `venerea` | adj | 0 | inerenti a Venere | `Venere` | `no-form-sense` |  | [venerea](https://it.wiktionary.org/w/index.php?title=venerea&oldid=3963727) |
| 429497 | `venerea` | adj | 1 | che riguarda l'amore fisico | `fisico` | `no-form-sense` |  | [venerea](https://it.wiktionary.org/w/index.php?title=venerea&oldid=3963727) |
| 439314 | `tacitiani` | adj | 0 | di Tacito | `Tacito` | `no-form-sense` |  | [tacitiani](https://it.wiktionary.org/w/index.php?title=tacitiani&oldid=3905379) |
| 439315 | `tacitiane` | adj | 0 | di Tacito | `Tacito` | `no-form-sense` |  | [tacitiane](https://it.wiktionary.org/w/index.php?title=tacitiane&oldid=3905380) |
| 439316 | `tacitiana` | adj | 0 | di Tacito | `Tacito` | `no-form-sense` |  | [tacitiana](https://it.wiktionary.org/w/index.php?title=tacitiana&oldid=3905381) |
| 441840 | `virtuosa` | adj | 1 | che abbonda in virtù morali | `morali` | `no-form-sense` |  | [virtuosa](https://it.wiktionary.org/w/index.php?title=virtuosa&oldid=3652609) |
| 441872 | `napoleonici` | adj | 0 | di Napoleone I Bonaparte o del suo periodo storico | `storico` | `no-form-sense` |  | [napoleonici](https://it.wiktionary.org/w/index.php?title=napoleonici&oldid=3887543) |
| 441873 | `napoleoniche` | adj | 0 | di Napoleone I Bonaparte o del suo periodo storico | `storico` | `no-form-sense` |  | [napoleoniche](https://it.wiktionary.org/w/index.php?title=napoleoniche&oldid=3887542) |
| 441879 | `splendida` | adj | 0 | che ha luminosità molto intensa | `intensa` | `no-form-sense` |  | [splendida](https://it.wiktionary.org/w/index.php?title=splendida&oldid=3979310) |
| 441881 | `radiosa` | adj | 0 | che manda fuori una forte luce | `luce` | `no-form-sense` |  | [radiosa](https://it.wiktionary.org/w/index.php?title=radiosa&oldid=3905415) |
| 441881 | `radiosa` | adj | 1 | che manifesta felicità | `felicità` | `no-form-sense` |  | [radiosa](https://it.wiktionary.org/w/index.php?title=radiosa&oldid=3905415) |
| 441889 | `assoluta` | adj | 0 | che è priva di ogni legame | `legame` | `no-form-sense` |  | [assoluta](https://it.wiktionary.org/w/index.php?title=assoluta&oldid=3867484) |
| 441889 | `assoluta` | adj | 1 | oltre ogni mancanza e/o imperfezione | `imperfezione` | `no-form-sense` |  | [assoluta](https://it.wiktionary.org/w/index.php?title=assoluta&oldid=3867484) |
| 441890 | `assoluti` | adj | 0 | che sono privi di ogni legame | `legame` | `no-form-sense` |  | [assoluti](https://it.wiktionary.org/w/index.php?title=assoluti&oldid=3743689) |
| 441890 | `assoluti` | adj | 1 | oltre ogni mancanza e/o imperfezione | `imperfezione` | `no-form-sense` |  | [assoluti](https://it.wiktionary.org/w/index.php?title=assoluti&oldid=3743689) |
| 446837 | `ontologici` | adj | 0 | che riguardano l'ontologia | `ontologia` | `no-form-sense` |  | [ontologici](https://it.wiktionary.org/w/index.php?title=ontologici&oldid=3905504) |
| 446838 | `ontologica` | adj | 0 | che riguarda l'ontologia | `ontologia` | `no-form-sense` |  | [ontologica](https://it.wiktionary.org/w/index.php?title=ontologica&oldid=3905505) |
| 446839 | `ontologiche` | adj | 0 | che riguardano l'ontologia | `ontologia` | `no-form-sense` |  | [ontologiche](https://it.wiktionary.org/w/index.php?title=ontologiche&oldid=3645119) |
| 446982 | `sportiva` | adj | 0 | che usa fare molto sport | `sport` | `no-form-sense` |  | [sportiva](https://it.wiktionary.org/w/index.php?title=sportiva&oldid=3650478) |
| 446982 | `sportiva` | adj | 1 | che ama lo sport | `ama` | `no-form-sense` |  | [sportiva](https://it.wiktionary.org/w/index.php?title=sportiva&oldid=3650478) |
| 446982 | `sportiva` | adj | 2 | inerente in qualsiasi modo allo sport | `inerente` | `no-form-sense` |  | [sportiva](https://it.wiktionary.org/w/index.php?title=sportiva&oldid=3650478) |
| 446982 | `sportiva` | adj | 4 | che ha un fisico adatto a fare sport | `adatto` | `no-form-sense` |  | [sportiva](https://it.wiktionary.org/w/index.php?title=sportiva&oldid=3650478) |
| 446982 | `sportiva` | adj | 5 | senza rancore, senza intento di umiliare né tradire la fiducia ma pensare ed agire con onestà ed integrità | `integrità` | `no-form-sense` |  | [sportiva](https://it.wiktionary.org/w/index.php?title=sportiva&oldid=3650478) |
| 446987 | `interpretativa` | adj | 0 | che riguarda un'interpretazione | `interpretazione` | `no-form-sense` |  | [interpretativa](https://it.wiktionary.org/w/index.php?title=interpretativa&oldid=3494098) |
| 447401 | `interfederale` | adj | 0 | inerente a due o più federazioni | `federazioni` | `no-form-sense` |  | [interfederale](https://it.wiktionary.org/w/index.php?title=interfederale&oldid=3739739) |
| 447475 | `spietati` | adj | 0 | che sono senza pietà | `pietà` | `no-form-sense` |  | [spietati](https://it.wiktionary.org/w/index.php?title=spietati&oldid=3979574) |
| 447634 | `impastatura` | noun | 0 | messa a punto di un impasto | `impasto` | `no-form-sense` |  | [impastatura](https://it.wiktionary.org/w/index.php?title=impastatura&oldid=3412838) |
| 447742 | `scandinavi` | adj | 0 | relativi alla Scandinavia | `Scandinavia` | `no-form-sense` |  | [scandinavi](https://it.wiktionary.org/w/index.php?title=scandinavi&oldid=3439607) |
| 447743 | `scandinava` | adj | 0 | relativa alla Scandinavia | `Scandinavia` | `no-form-sense` |  | [scandinava](https://it.wiktionary.org/w/index.php?title=scandinava&oldid=3710732) |
| 447761 | `conservatori` | adj | 1 | che sono poco attento al progresso e all'innovazione | `innovazione` | `no-form-sense` |  | [conservatori](https://it.wiktionary.org/w/index.php?title=conservatori&oldid=3990462) |
| 447764 | `conservatrici` | adj | 1 | che sono poco attente al progresso e all'innovazione | `innovazione` | `no-form-sense` |  | [conservatrici](https://it.wiktionary.org/w/index.php?title=conservatrici&oldid=3635441) |
| 447765 | `conservatrici` | noun | 2 | seguaci del conservatorismo | `seguaci` | `no-form-sense` |  | [conservatrici](https://it.wiktionary.org/w/index.php?title=conservatrici&oldid=3635441) |
| 447766 | `conservatrice` | adj | 1 | che è poco attente al progresso e all'innovazione | `innovazione` | `no-form-sense` |  | [conservatrice](https://it.wiktionary.org/w/index.php?title=conservatrice&oldid=3960306) |
| 447767 | `conservatrice` | noun | 2 | seguace del conservatorismo | `seguace` | `no-form-sense` |  | [conservatrice](https://it.wiktionary.org/w/index.php?title=conservatrice&oldid=3960306) |
| 447803 | `indecorosa` | adj | 1 | che non è adeguata alla dignità di un individuo | `individuo` | `no-form-sense` |  | [indecorosa](https://it.wiktionary.org/w/index.php?title=indecorosa&oldid=3641334) |
| 447820 | `antropofaghe` | noun | 0 | coloro che mangiano carne umana | `carne` | `no-form-sense` |  | [antropofaghe](https://it.wiktionary.org/w/index.php?title=antropofaghe&oldid=3627146) |
| 447905 | `spudorata` | adj | 0 | priva di pudore | `pudore` | `no-form-sense` |  | [spudorata](https://it.wiktionary.org/w/index.php?title=spudorata&oldid=3905626) |
| 447906 | `spudorati` | adj | 0 | privi di pudore | `pudore` | `no-form-sense` |  | [spudorati](https://it.wiktionary.org/w/index.php?title=spudorati&oldid=3905627) |
| 449064 | `lotofaga` | adj | 0 | che si nutre di fiori di loto | `loto` | `no-form-sense` |  | [lotofaga](https://it.wiktionary.org/w/index.php?title=lotofaga&oldid=3643224) |
| 449066 | `lotofagi` | adj | 0 | che si nutrono di fiori di loto | `loto` | `no-form-sense` |  | [lotofagi](https://it.wiktionary.org/w/index.php?title=lotofagi&oldid=3643226) |
| 449067 | `lotofagi` | noun | 0 | coloro che si nutrono di fiori di loto | `loto` | `no-form-sense` |  | [lotofagi](https://it.wiktionary.org/w/index.php?title=lotofagi&oldid=3643226) |
| 449068 | `lotofaghe` | adj | 0 | che si nutrono di fiori di loto | `loto` | `no-form-sense` |  | [lotofaghe](https://it.wiktionary.org/w/index.php?title=lotofaghe&oldid=3643225) |
| 449069 | `lotofaghe` | noun | 0 | coloro che si nutrono di fiori di loto | `loto` | `no-form-sense` |  | [lotofaghe](https://it.wiktionary.org/w/index.php?title=lotofaghe&oldid=3643225) |
| 449775 | `cimentarsi` | verb | 0 | iniziare un'azione piena di rischi | `azione` | `no-form-sense` |  | [cimentarsi](https://it.wiktionary.org/w/index.php?title=cimentarsi&oldid=3984036) |
| 450168 | `colorabile` | adj | 0 | che è possibile colorare | `colorare` | `no-form-sense` |  | [colorabile](https://it.wiktionary.org/w/index.php?title=colorabile&oldid=3275613) |
| 450976 | `autoptica` | adj | 0 | che riguarda un'autopsia | `autopsia` | `no-form-sense` |  | [autoptica](https://it.wiktionary.org/w/index.php?title=autoptica&oldid=3632888) |
| 451447 | `migliorabile` | adj | 0 | che è in grado di migliorare | `migliorare` | `no-form-sense` |  | [migliorabile](https://it.wiktionary.org/w/index.php?title=migliorabile&oldid=3311753) |
| 452518 | `corteggiatrice` | noun | 0 | chi lusinga un uomo per avere con lui una relazione amorosa | `uomo` | `no-form-sense` |  | [corteggiatrice](https://it.wiktionary.org/w/index.php?title=corteggiatrice&oldid=3820200) |
| 455573 | `melodrammatica` | adj | 0 | tipico del melodramma | `melodramma` | `no-form-sense` |  | [melodrammatica](https://it.wiktionary.org/w/index.php?title=melodrammatica&oldid=3643844) |
| 455573 | `melodrammatica` | adj | 1 | esagerato e teatrale | `teatrale` | `no-form-sense` |  | [melodrammatica](https://it.wiktionary.org/w/index.php?title=melodrammatica&oldid=3643844) |
| 457531 | `inconcludenza` | noun | 0 | caratteristica di chi, di ciò che non è portato a termine | `caratteristica` | `no-form-sense` |  | [inconcludenza](https://it.wiktionary.org/w/index.php?title=inconcludenza&oldid=3413773) |
| 459093 | `messianica` | adj | 0 | era messianica: è un periodo di redenzione e salvezza individuale, ciascuno secondo la provvidenza propria, e definitivamente collettiva con il principio della costruzione del terzo Tempio di Gerusalemme e con realizzazione di molte altre profezie della Bibbia ebraica a favore del popolo ebraico appunto | `ebraico` | `no-form-sense` |  | [messianica](https://it.wiktionary.org/w/index.php?title=messianica&oldid=4067087) |
| 459203 | `fiumani` | adj | 0 | fluviali | `fluviali` | `no-form-sense` |  | [fiumani](https://it.wiktionary.org/w/index.php?title=fiumani&oldid=3639555) |
| 459204 | `fiumani` | adj | 0 | di Fiume | `Fiume` | `no-form-sense` |  | [fiumani](https://it.wiktionary.org/w/index.php?title=fiumani&oldid=3639555) |
| 459205 | `fiumani` | noun | 0 | abitanti di Fiume | `Fiume` | `no-form-sense` |  | [fiumani](https://it.wiktionary.org/w/index.php?title=fiumani&oldid=3639555) |
| 460035 | `indebitarsi` | verb | 0 | caricarsi di debiti | `debiti` | `no-form-sense` |  | [indebitarsi](https://it.wiktionary.org/w/index.php?title=indebitarsi&oldid=3413922) |
| 460452 | `eurosatellite` | noun | 0 | nel giornalismo, satellite dell'Unione Europea | `giornalismo` | `no-form-sense` |  | [eurosatellite](https://it.wiktionary.org/w/index.php?title=eurosatellite&oldid=3403528) |
| 460500 | `provarci` | verb | 0 | cercare il consenso, quindi intimità con una persona del sesso opposto | `opposto` | `no-form-sense` |  | [provarci](https://it.wiktionary.org/w/index.php?title=provarci&oldid=3506214) |
| 460500 | `provarci` | verb | 1 | cercare di imbrogliare oppure mettere in difficoltà qualcuno | `difficoltà` | `no-form-sense` |  | [provarci](https://it.wiktionary.org/w/index.php?title=provarci&oldid=3506214) |
| 460500 | `provarci` | verb | 2 | cercare di farcela, di riuscire, di avere successo | `successo` | `no-form-sense` |  | [provarci](https://it.wiktionary.org/w/index.php?title=provarci&oldid=3506214) |
| 460500 | `provarci` | verb | 3 | tentare un'impresa sportiva | `sportiva` | `no-form-sense` |  | [provarci](https://it.wiktionary.org/w/index.php?title=provarci&oldid=3506214) |
| 460500 | `provarci` | verb | 4 | cercare di sapere qualcosa, in genere sulla professione di qualcuno parlando a questo stesso | `parlando` | `no-form-sense` |  | [provarci](https://it.wiktionary.org/w/index.php?title=provarci&oldid=3506214) |
| 460500 | `provarci` | verb | 5 | cercare di convincere qualcuno in merito qualcosa da dire o da fare ed in cui si crede pienamente | `pienamente` | `no-form-sense` |  | [provarci](https://it.wiktionary.org/w/index.php?title=provarci&oldid=3506214) |
| 460564 | `cascarci` | verb | 0 | credere a qualcosa poi rivelarsi uno scherzo oppure addirittura un imbroglio, qualcosa di falso o una menzogna | `menzogna` | `no-form-sense` |  | [cascarci](https://it.wiktionary.org/w/index.php?title=cascarci&oldid=3388983) |
| 460564 | `cascarci` | verb | 1 | cedere | `cedere` | `no-form-sense` |  | [cascarci](https://it.wiktionary.org/w/index.php?title=cascarci&oldid=3388983) |
| 460638 | `piantarla` | verb | 0 | invitare qualcuno a desistere da un comportamento indesiderato, talvolta facendo capire che deve andarsene | `andarsene` | `no-form-sense` |  | [piantarla](https://it.wiktionary.org/w/index.php?title=piantarla&oldid=3431503) |
| 460658 | `estense` | noun | 0 | appartenente alla famiglia ducale d'Este | `ducale` | `no-form-sense` |  | [estense](https://it.wiktionary.org/w/index.php?title=estense&oldid=3870335) |
| 463386 | `trisnonna` | noun | 0 | madre del bisnonno o della bisnonna | `bisnonna` | `no-form-sense` |  | [trisnonna](https://it.wiktionary.org/w/index.php?title=trisnonna&oldid=3736929) |
| 463616 | `Invaghiti` | noun | 0 | denominazione dei soci di un’accademia letteraria costituita nel 1562 a Mantova da Cesare Gonzaga | `Cesare Gonzaga` | `no-form-sense` |  | [Invaghiti](https://it.wiktionary.org/w/index.php?title=Invaghiti&oldid=3362147) |
| 464551 | `ammutolirsi` | verb | 0 | zittirsi, tacere improvvisamente | `improvvisamente` | `no-form-sense` |  | [ammutolirsi](https://it.wiktionary.org/w/index.php?title=ammutolirsi&oldid=3838780) |
| 465147 | `Mammiferi` | noun | 0 | classe di vertebrati appartenente al phylum dei Cordati | `Cordati` | `no-form-sense` |  | [Mammiferi](https://it.wiktionary.org/w/index.php?title=Mammiferi&oldid=4008252) |
| 465164 | `Catarrini` | noun | 0 | scimmie dal naso piccolo il cui habitat è l'Asia e l' Africa | `habitat` | `no-form-sense` |  | [Catarrini](https://it.wiktionary.org/w/index.php?title=Catarrini&oldid=3766948) |
| 465718 | `spietate` | adj | 0 | che sono senza pietà | `pietà` | `no-form-sense` |  | [spietate](https://it.wiktionary.org/w/index.php?title=spietate&oldid=3906816) |
| 466173 | `Ratiti` | noun | 0 | uccelli Neorniti che non sanno volare | `Neorniti` | `no-form-sense` |  | [Ratiti](https://it.wiktionary.org/w/index.php?title=Ratiti&oldid=3763487) |
| 504809 | `Moracee` | noun | 0 | famiglia di Dicotiledoni | `Dicotiledoni` | `no-form-sense` |  | [Moracee](https://it.wiktionary.org/w/index.php?title=Moracee&oldid=4024471) |
| 520731 | `marescialla` | noun | 1 | Per lo più scherzoso, moglie di un maresciallo (sottufficiale); anche donna che abbia un comportamento autoritario e burbero: essere una marescialla. | `sottufficiale` | `no-form-sense` |  | [marescialla](https://it.wiktionary.org/w/index.php?title=marescialla&oldid=3866446) |
| 520739 | `questora` | noun | 0 | chi dirige una questura | `questura` | `no-form-sense` |  | [questora](https://it.wiktionary.org/w/index.php?title=questora&oldid=3647732) |
| 536329 | `battezzarsi` | verb | 0 | prendere il battesimo | `battesimo` | `no-form-sense` |  | [battezzarsi](https://it.wiktionary.org/w/index.php?title=battezzarsi&oldid=3621070) |
| 543412 | `Accipitridi` | noun | 0 | uccelli Accipitriformi | `Accipitriformi` | `no-form-sense` |  | [Accipitridi](https://it.wiktionary.org/w/index.php?title=Accipitridi&oldid=4035208) |
| 544507 | `raggiungersi` | verb | 0 | unirsi | `unirsi` | `no-form-sense` |  | [raggiungersi](https://it.wiktionary.org/w/index.php?title=raggiungersi&oldid=3909530) |
| 544657 | `labronici` | noun | 0 | calciatori del Livorno | `Livorno` | `no-form-sense` |  | [labronici](https://it.wiktionary.org/w/index.php?title=labronici&oldid=3669955) |
| 545302 | `informicolito` | verb | 0 | infastidito dal formicolio | `formicolio` | `no-form-sense` |  | [informicolito](https://it.wiktionary.org/w/index.php?title=informicolito&oldid=3672461) |
| 545308 | `estetizzante` | adj | 0 | di chi è un seguace dell’estetismo | `estetismo` | `no-form-sense` |  | [estetizzante](https://it.wiktionary.org/w/index.php?title=estetizzante&oldid=3672481) |
| 546675 | `compartecipe` | noun | 0 | che partecipa ad un avvenimento con altri | `avvenimento` | `no-form-sense` |  | [compartecipe](https://it.wiktionary.org/w/index.php?title=compartecipe&oldid=4032791) |
| 546748 | `Fagacee` | noun | 0 | famiglia di piante dell'ordine delle Fagali | `Fagali` | `no-form-sense` |  | [Fagacee](https://it.wiktionary.org/w/index.php?title=Fagacee&oldid=4020040) |
| 549190 | `settarismo` | noun | 0 | comportamento settario | `settario` | `no-form-sense` |  | [settarismo](https://it.wiktionary.org/w/index.php?title=settarismo&oldid=3686083) |
| 550009 | `estremistico` | adj | 0 | che è caratteristico dell'estremismo | `estremismo` | `no-form-sense` |  | [estremistico](https://it.wiktionary.org/w/index.php?title=estremistico&oldid=3855307) |
| 555769 | `liberatorio` | adj | 0 | che libera da obbligo | `obbligo` | `no-form-sense` |  | [liberatorio](https://it.wiktionary.org/w/index.php?title=liberatorio&oldid=3706956) |
| 555769 | `liberatorio` | adj | 1 | che libera da tensione psicologica | `tensione` | `no-form-sense` |  | [liberatorio](https://it.wiktionary.org/w/index.php?title=liberatorio&oldid=3706956) |
| 560415 | `casertano` | noun | 0 | dialetto italiano meridionale intermedio parlato a Caserta | `parlato` | `no-form-sense` |  | [casertano](https://it.wiktionary.org/w/index.php?title=casertano&oldid=4248010) |
| 576044 | `Sfeniscidi` | noun | 0 | sola famiglia degli Sfenisciformi | `Sfenisciformi` | `no-form-sense` |  | [Sfeniscidi](https://it.wiktionary.org/w/index.php?title=Sfeniscidi&oldid=3884874) |
| 577140 | `Colombidi` | noun | 0 | uccelli appartenenti all'ordine dei Colombiformi; la sua classificazione scientifica è Columbidae ( tassonomia) | `Colombiformi` | `no-form-sense` |  | [Colombidi](https://it.wiktionary.org/w/index.php?title=Colombidi&oldid=3768132) |
| 577310 | `Apodiformi` | noun | 0 | uccelli | `uccelli` | `no-form-sense` |  | [Apodiformi](https://it.wiktionary.org/w/index.php?title=Apodiformi&oldid=3768107) |
| 577312 | `Macrochiri` | noun | 0 | Apodiformi | `Apodiformi` | `no-form-sense` |  | [Macrochiri](https://it.wiktionary.org/w/index.php?title=Macrochiri&oldid=3768188) |
| 577328 | `Lanidi` | noun | 0 | famiglia di uccelli del sottordine dei passeri | `uccelli` | `no-form-sense` |  | [Lanidi](https://it.wiktionary.org/w/index.php?title=Lanidi&oldid=3762051) |
| 577347 | `Neognati` | noun | 0 | uccelli dei Neorniti | `Neorniti` | `no-form-sense` |  | [Neognati](https://it.wiktionary.org/w/index.php?title=Neognati&oldid=3768205) |
| 577532 | `Treschiornitidi` | noun | 0 | uccelli Pelecaniformi | `Pelecaniformi` | `no-form-sense` |  | [Treschiornitidi](https://it.wiktionary.org/w/index.php?title=Treschiornitidi&oldid=3826262) |
| 577580 | `sfenischi` | noun | 0 | genere di pinguini della famiglia degli Sfeniscidi | `Sfeniscidi` | `no-form-sense` |  | [sfenischi](https://it.wiktionary.org/w/index.php?title=sfenischi&oldid=3838800) |
| 578421 | `menure` | noun | 0 | uccelli della famiglia dei Menuridi che comprende l'uccello lira; la sua classificazione scientifica è Menura novaehollandiae ( tassonomia); la sua classificazione scientifica è Menura alberti ( tassonomia) | `Menuridi` | `no-form-sense` |  | [menure](https://it.wiktionary.org/w/index.php?title=menure&oldid=3768870) |
| 579503 | `bisarcavola` | noun | 0 | madre del trisnonno o della trisnonna | `trisnonna` | `no-form-sense` |  | [bisarcavola](https://it.wiktionary.org/w/index.php?title=bisarcavola&oldid=3769797) |
| 584343 | `provviste` | noun | 0 | viveri | `viveri` | `no-form-sense` |  | [provviste](https://it.wiktionary.org/w/index.php?title=provviste&oldid=4060232) |
| 585872 | `staffile` | noun | 1 | frusta formata solitamente da un' unica striscia di cuoio | `frusta` | `no-form-sense` |  | [staffile](https://it.wiktionary.org/w/index.php?title=staffile&oldid=4031426) |
| 588278 | `stuoli` | noun | 0 | reparto composto da guerrieri | `guerrieri` | `no-form-sense` |  | [stuoli](https://it.wiktionary.org/w/index.php?title=stuoli&oldid=3965174) |
| 588627 | `intemperanti` | adj | 0 | chi vive senza regole | `regole` | `no-form-sense` |  | [intemperanti](https://it.wiktionary.org/w/index.php?title=intemperanti&oldid=3810640) |
| 589732 | `svenevoli` | adj | 0 | molto lezioso | `lezioso` | `no-form-sense` |  | [svenevoli](https://it.wiktionary.org/w/index.php?title=svenevoli&oldid=3815645) |
| 590229 | `mancine` | noun | 0 | mano sinistra | `sinistra` | `no-form-sense` |  | [mancine](https://it.wiktionary.org/w/index.php?title=mancine&oldid=3918222) |
| 590964 | `auzzino` | noun | 0 | aguzzino | `aguzzino` | `no-form-sense` |  | [auzzino](https://it.wiktionary.org/w/index.php?title=auzzino&oldid=3835118) |
| 591823 | `ignava` | adj | 0 | con poca dignità, leggero e insulso | `insulso` | `no-form-sense` |  | [ignava](https://it.wiktionary.org/w/index.php?title=ignava&oldid=3879203) |
| 591824 | `ignava` | noun | 0 | individuo poco stimato, con minima profondità e lievissimo valore sentimentale e sociale | `sociale` | `no-form-sense` |  | [ignava](https://it.wiktionary.org/w/index.php?title=ignava&oldid=3879203) |
| 592412 | `rilucente` | adj | 0 | che splende | `splende` | `no-form-sense` |  | [rilucente](https://it.wiktionary.org/w/index.php?title=rilucente&oldid=3918328) |
| 593060 | `dadino` | noun | 0 | minuscolo dado | `dado` | `no-form-sense` |  | [dadino](https://it.wiktionary.org/w/index.php?title=dadino&oldid=3844403) |
| 593457 | `farinacei` | noun | 0 | prodotti con abbondanza di amido | `amido` | `no-form-sense` |  | [farinacei](https://it.wiktionary.org/w/index.php?title=farinacei&oldid=3918361) |
| 597740 | `delatori` | noun | 0 | persona che , venendo meno alla fiducia accordatagli da qualcuno, lo denuncia all'autorità competente per reati da lui perpetrati | `persona` | `no-form-sense` |  | [delatori](https://it.wiktionary.org/w/index.php?title=delatori&oldid=4057030) |
| 597904 | `historie` | noun | 0 | (obsoleto) storie | `storie` | `no-form-sense` |  | [historie](https://it.wiktionary.org/w/index.php?title=historie&oldid=3881796) |
| 599544 | `pauliciani` | noun | 0 | seguaci di una setta cristiana sorta in Siria ed in Armenia verso il 650 e sviluppatasi fin verso l'anno mille, che, rifacendosi a Paolo di Tarso o Paolo di Samosata, negavano sia il Vecchio Testamento sia l'incarnazione di Gesù Cristo | `Cristo` | `no-form-sense` |  | [pauliciani](https://it.wiktionary.org/w/index.php?title=pauliciani&oldid=3918549) |
| 601203 | `squisitezza` | noun | 0 | un bel gesto oppure adeguato comportamento… molto educato, elegante, dignitoso… con cortesia e premura per qualcuno | `premura` | `no-form-sense` |  | [squisitezza](https://it.wiktionary.org/w/index.php?title=squisitezza&oldid=3958304) |
| 601203 | `squisitezza` | noun | 1 | un dono, un regalo | `regalo` | `no-form-sense` |  | [squisitezza](https://it.wiktionary.org/w/index.php?title=squisitezza&oldid=3958304) |
| 601203 | `squisitezza` | noun | 2 | cibo, alimento gradito al palato per la sua ricercatezza, con gusto, sapore, particolarmente piacevole… quasi “goloso” | `goloso` | `no-form-sense` |  | [squisitezza](https://it.wiktionary.org/w/index.php?title=squisitezza&oldid=3958304) |
| 601860 | `castrametazione` | noun | 0 | pianificazione delle misure per la costruzione dell'accampamento, specialmente del castrum romano | `accampamento` | `no-form-sense` |  | [castrametazione](https://it.wiktionary.org/w/index.php?title=castrametazione&oldid=3939992) |
| 602147 | `etimologizzata` | verb | 1 | : detto delle parole per li quali gli etimologisti e i lessicografi sono riusciti a risalire all'etimo o lemma. | `lemma` | `no-form-sense` |  | [etimologizzata](https://it.wiktionary.org/w/index.php?title=etimologizzata&oldid=4124625) |
| 602147 | `etimologizzata` | verb | 2 | : dicesi etimologizzate le parole (mentre etimologizzati i vocaboli) sottoposte al tipo di software cosiddetto lemmatizzatore (neologismo e inglesismo da lemmatizer) e che quindi hanno ricevuto la etimologizzazione o lemmatizzazione | `lemmatizzazione` | `no-form-sense` |  | [etimologizzata](https://it.wiktionary.org/w/index.php?title=etimologizzata&oldid=4124625) |
| 602148 | `etimologizzati` | verb | 1 | : detto dei vocaboli e delle parole per cui gli etimologisti e i lessicografi sono riusciti a risalire all'etimo o lemma. | `lemma` | `no-form-sense` |  | [etimologizzati](https://it.wiktionary.org/w/index.php?title=etimologizzati&oldid=4124635) |
| 602148 | `etimologizzati` | verb | 2 | : dicesi etimologizzati i vocaboli (mentre etimologizzate le parole) sottoposti al tipo di software cosiddetto lemmatizzatore (neologismo e inglesismo da lemmatizer), termini che quindi hanno ricevuto la etimologizzazione o lemmatizzazione | `lemmatizzazione` | `no-form-sense` |  | [etimologizzati](https://it.wiktionary.org/w/index.php?title=etimologizzati&oldid=4124635) |
| 604385 | `cetre` | noun | 0 | famiglia di cordofoni secondo la classificazione di Hornbostel-Sachs | `cordofoni` | `no-form-sense` |  | [cetre](https://it.wiktionary.org/w/index.php?title=cetre&oldid=3951811) |
| 606679 | `finimenti` | noun | 0 | bardatura | `bardatura` | `no-form-sense` |  | [finimenti](https://it.wiktionary.org/w/index.php?title=finimenti&oldid=3972319) |
| 612862 | `Sinapsidi` | noun | 0 | sottoclasse di rettili estinti nati nel tardo Carbonifero, con una sola apertura cranica temporale, da cui discendono direttamente i moderni mammiferi | `mammiferi` | `no-form-sense` |  | [Sinapsidi](https://it.wiktionary.org/w/index.php?title=Sinapsidi&oldid=4037771) |
| 614951 | `Araliacee` | noun | 0 | pianta della classe delle Dicotiledoni | `Dicotiledoni` | `no-form-sense` |  | [Araliacee](https://it.wiktionary.org/w/index.php?title=Araliacee&oldid=4023137) |
| 614952 | `Celastrali` | noun | 0 | ordine di piante della classe delle Dicotiledoni | `Dicotiledoni` | `no-form-sense` |  | [Celastrali](https://it.wiktionary.org/w/index.php?title=Celastrali&oldid=4021823) |
| 615244 | `Combretacee` | noun | 0 | famiglia di piante dell'ordine delle Mirtali | `Mirtali` | `no-form-sense` |  | [Combretacee](https://it.wiktionary.org/w/index.php?title=Combretacee&oldid=4027324) |
| 615247 | `Melastomatacee` | noun | 0 | famiglia di piante della classe delle Dicotiledoni | `Dicotiledoni` | `no-form-sense` |  | [Melastomatacee](https://it.wiktionary.org/w/index.php?title=Melastomatacee&oldid=4021277) |
| 616599 | `Ligustrali` | noun | 0 | ordine di piante del raggruppamento delle Gamopetale | `Gamopetale` | `no-form-sense` |  | [Ligustrali](https://it.wiktionary.org/w/index.php?title=Ligustrali&oldid=4027028) |
| 618597 | `Cistercensi` | noun | 0 | ordine istituito a Cîteaux nel 1098 da san Roberto di Molesme | `san Roberto di Molesme` | `no-form-sense` |  | [Cistercensi](https://it.wiktionary.org/w/index.php?title=Cistercensi&oldid=4032375) |
| 618617 | `Benedettini` | noun | 0 | ordine religioso istituito da san Benedetto da Norcia | `san Benedetto da Norcia` | `no-form-sense` |  | [Benedettini](https://it.wiktionary.org/w/index.php?title=Benedettini&oldid=4076980) |
| 622219 | `orecchiette` | noun | 0 | sorta di pasta della Puglia con l'aspetto di piccoli gnocchetti compressi e incavati | `sorta` | `no-form-sense` |  | [orecchiette](https://it.wiktionary.org/w/index.php?title=orecchiette&oldid=4039370) |
| 625655 | `altarini` | noun | 0 | flirt amorosi | `flirt` | `no-form-sense` |  | [altarini](https://it.wiktionary.org/w/index.php?title=altarini&oldid=4059957) |

## Senses left alone

| Line | Word | POS | Sense | Gloss | Edge | Reason | Form word |
|---|---|---|---|---|---|---|---|
| 100 | `rosa` | verb | 0 | participio passato femminile del verbo rodere | `rodere` | `form-gloss` | `participio` |
| 1324 | `abboccato` | verb | 0 | participio passato del verbo di abboccare | `abboccare` | `form-gloss` | `participio` |
| 1493 | `capa` | noun | 0 | un capo donna, femminile di capo | `capo` | `form-gloss` | `femminile` |
| 1500 | `futuro` | verb | 0 | participio futuro del verbo essere | `essere` | `form-gloss` | `participio` |
| 1873 | `bollito` | verb | 0 | participio passato maschile singolare del verbo bollire | `bollire` | `form-gloss` | `participio` |
| 1899 | `broccato` | verb | 0 | participio passato del verbo broccare | `broccare` | `form-gloss` | `participio` |
| 1909 | `sedano` | verb | 0 | terza persona plurale dell'indicativo presente del verbo sedare | `sedare` | `form-gloss` | `plurale` |
| 2041 | `faccia` | verb | 0 | 1ª persona singolare del congiuntivo presente di fare | `fare` | `form-gloss` | `singolare` |
| 2041 | `faccia` | verb | 1 | 2ª persona singolare del congiuntivo presente di fare | `fare` | `form-gloss` | `singolare` |
| 2041 | `faccia` | verb | 2 | 3ª persona singolare del congiuntivo presente di fare | `fare` | `form-gloss` | `singolare` |
| 2041 | `faccia` | verb | 3 | 3ª persona singolare dell'imperativo di fare | `fare` | `form-gloss` | `singolare` |
| 2041 | `faccia` | verb | 4 | 2ª persona singolare dell'imperativo di fare | `fare` | `form-gloss` | `singolare` |
| 2295 | `bambina` | noun | 1 | essere umano prepubere di sesso femminile | `femminile` | `form-gloss` | `femminile` |
| 2699 | `scanno` | verb | 0 | 1ª persona singolare del presente semplice indicativo di scannare | `scannare` | `form-gloss` | `singolare` |
| 3035 | `gelato` | verb | 0 | participio passato del verbo gelare | `gelare` | `form-gloss` | `participio` |
| 4347 | `cosa` | verb | 0 | indicativo presente, terza persona singolare di cosare | `cosare` | `form-gloss` | `indicativo` |
| 4347 | `cosa` | verb | 1 | imperativo presente, seconda persona singolare di cosare | `cosare` | `form-gloss` | `imperativo` |
| 4975 | `acute` | adj | 0 | plurale da acuta | `acuta` | `form-gloss` | `plurale` |
| 5700 | `arbitrate` | verb | 0 | indicativo presente, seconda persona plurale di arbitrare | `arbitrare` | `form-gloss` | `indicativo` |
| 7006 | `inoculate` | verb | 0 | participio passato (plurale femminile) di inoculare | `inoculare` | `form-gloss` | `participio` |
| 7582 | `studio` | verb | 0 | 1ª persona singolare dell'indicativo presente di studiare | `studiare` | `form-gloss` | `singolare` |
| 8179 | `andarsene` | verb | 4 | con imperativo o comunque in modo molto deciso, significa mandare via qualcuno senza mezzi termini | `senza mezzi termini` | `form-gloss` | `imperativo` |
| 8228 | `appello` | verb | 0 | prima persona singolare del presente indicativo del verbo appellare | `appellare` | `form-gloss` | `singolare` |
| 8331 | `aspetto` | verb | 0 | prima persona singolare dell'indicativo presente del verbo aspettare | `aspettare` | `form-gloss` | `singolare` |
| 8358 | `attacco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di attaccare | `attaccare` | `form-gloss` | `singolare` |
| 8671 | `affisso` | verb | 0 | participio passato maschile del verbo affiggere | `affiggere` | `form-gloss` | `participio` |
| 10201 | `decide` | verb | 0 | terza persona singolare del presente indicativo del verbo decidere | `decidere` | `form-gloss` | `singolare` |
| 10314 | `dissolve` | verb | 0 | 3ᵃ pers sing indicativo presente di dissolvere | `dissolvere` | `form-gloss` | `pers` |
| 10368 | `do` | verb | 0 | prima persona singolare dell’indicativo presente attivo di dare | `dare` | `form-gloss` | `singolare` |
| 11101 | `fate` | verb | 0 | 2ª persona plurale dell'indicativo presente di fare | `fare` | `form-gloss` | `plurale` |
| 11101 | `fate` | verb | 1 | 2ª persona plurale dell'imperativo di fare | `fare` | `form-gloss` | `plurale` |
| 11459 | `formula` | verb | 0 | terza persona singolare dell'indicativo presente del verbo formulare | `formulare` | `form-gloss` | `singolare` |
| 11459 | `formula` | verb | 1 | seconda persona singolare dell'imperativo presente del verbo formulare | `formulare` | `form-gloss` | `singolare` |
| 14254 | `smacco` | verb | 0 | prima persona indicativo singolare presente del verbo smaccare | `smaccare` | `form-gloss` | `indicativo` |
| 15424 | `cima` | verb | 0 | terza persona singolare dell'indicativo presentedi cimare | `cimare` | `form-gloss` | `singolare` |
| 17573 | `girato` | verb | 0 | participio passato maschile singolar di girare | `girare` | `form-gloss` | `participio` |
| 17921 | `allappante` | verb | 0 | participio presente del verbo allappare. | `allappare` | `form-gloss` | `participio` |
| 17968 | `spericolata` | adj | 0 | femminile per spericolato | `spericolato` | `form-gloss` | `femminile` |
| 18176 | `volute` | adj | 0 | femminmile plurale di voluto | `voluto` | `form-gloss` | `femminmile` |
| 20782 | `primitive` | adj | 0 | femmimnile plurale di primitivo | `primitivo` | `form-gloss` | `femmimnile` |
| 21368 | `retina` | noun | 0 | diminutivo di rete | `rete` | `form-gloss` | `diminutivo` |
| 21653 | `sale` | verb | 0 | terza persona singolare, modo indicativo, tempo presente del verbo salire | `salire` | `form-gloss` | `singolare` |
| 21660 | `saliva` | verb | 0 | terza persona singolare, tempo presente del verbo salivare | `salivare` | `form-gloss` | `singolare` |
| 21660 | `saliva` | verb | 1 | terza persona singolare, tempo imperfetto del verbo salire | `salire` | `form-gloss` | `singolare` |
| 22159 | `situate` | verb | 0 | participio passato (plurale femminile) di situare | `situare` | `form-gloss` | `participio` |
| 22590 | `state` | verb | 1 | participio passato femenino plurale di stare | `stare` | `form-gloss` | `participio` |
| 24294 | `caotiche` | adj | 0 | plurale femminile per caotico | `caotico` | `form-gloss` | `plurale` |
| 24301 | `ritener` | verb | 0 | forma apocopata per ritenere | `ritenere` | `form-gloss` | `forma` |
| 24306 | `obbligo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di obbligare | `obbligare` | `form-gloss` | `singolare` |
| 24390 | `filo` | verb | 0 | prima persona singolare dell' indicativo presente del verbo filare | `filare` | `form-gloss` | `singolare` |
| 25577 | `cazzo` | verb | 0 | indicativo presente, prima persona singolare del verbo cazzare | `cazzare` | `form-gloss` | `indicativo` |
| 28744 | `farà` | verb | 0 | 3ª persona singolare dell'indicativo futuro di fare | `fare` | `form-gloss` | `singolare` |
| 30473 | `provenienti` | verb | 0 | participio presente plur di provenire | `provenire` | `form-gloss` | `participio` |
| 30847 | `consonante` | verb | 0 | participio presente del verbo consonare | `consonare` | `form-gloss` | `participio` |
| 31255 | `ubriacone` | noun | 0 | accrescitivo di ubriaco | `ubriaco` | `form-gloss` | `accrescitivo` |
| 31563 | `papera` | noun | 0 | femmina di papero; confidenzialmente anitra, propriamente giovane oca femmina | `anitra` | `form-gloss` | `femmina` |
| 31570 | `chino` | verb | 0 | prima persona singolare dell'indicativo presente del verbo chinare | `chinare` | `form-gloss` | `singolare` |
| 32175 | `abbandono` | verb | 0 | prima persona singolare presente del verbo abbandonare | `abbandonare` | `form-gloss` | `singolare` |
| 32181 | `girone` | noun | 0 | accrescitivo di giro | `giro` | `form-gloss` | `accrescitivo` |
| 32309 | `triangolo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di triangolare | `triangolare` | `form-gloss` | `singolare` |
| 32400 | `fischio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di fischiare | `fischiare` | `form-gloss` | `singolare` |
| 32485 | `siete` | verb | 0 | 2ª persona plurale del presente semplice indicativo di essere | `essere` | `form-gloss` | `plurale` |
| 33317 | `scusa` | verb | 0 | terza persona singolare presente del verbo scusare | `scusare` | `form-gloss` | `singolare` |
| 33979 | `richiamo` | verb | 0 | prima persona singolare dell'indicativo presente del verbo richiamare | `richiamare` | `form-gloss` | `singolare` |
| 34028 | `rimorso` | verb | 0 | participio passato del verbo rimordere | `rimordere` | `form-gloss` | `participio` |
| 34139 | `degni` | noun | 0 | meritevoli, plurale di degno | `degno` | `form-gloss` | `plurale` |
| 34316 | `stupida` | noun | 0 | femminile di [[sinonimo di Veronica Ortu, accallonada, scimpra] | `femminile` | `form-gloss` | `femminile` |
| 37574 | `mostro` | verb | 0 | 1ª persona singolare del presente semplice indicativo di mostrare | `mostrare` | `form-gloss` | `singolare` |
| 37660 | `abitante` | verb | 0 | participio presente del verbo abitare | `abitare` | `form-gloss` | `participio` |
| 37985 | `dai` | verb | 0 | seconda persona singolare dell'indicativo presente del verbo dare | `dare` | `form-gloss` | `singolare` |
| 38759 | `estetica` | noun | 1 | possibilmente obiettivo, è una sorta di parametro di una percezione o un'appercezione dei sensi ovvero comunemente definito "gusto", soprattutto quello considerato a disposizione della vista | `vista` | `form-gloss` | `definito` |
| 38793 | `sorriso` | verb | 0 | participio passato del verbo sorridere | `sorridere` | `form-gloss` | `participio` |
| 38834 | `sgorbia` | verb | 0 | terza persona singolare presente del verbo sgorbiare | `sgorbiare` | `form-gloss` | `singolare` |
| 39030 | `comunicante` | verb | 0 | paricipio presente di comunicare | `comunicare` | `form-gloss` | `paricipio` |
| 39147 | `accorso` | verb | 0 | participio passato del verbo accorrere | `accorrere` | `form-gloss` | `participio` |
| 39771 | `appagato` | verb | 0 | participio passato del verbo appagare | `appagare` | `form-gloss` | `participio` |
| 40128 | `feci` | verb | 0 | prima persona singolare, indicativo passato remoto di fare | `fare` | `form-gloss` | `singolare` |
| 40270 | `coglione` | noun | 0 | (specie al plurale) testicolo | `testicolo` | `form-gloss` | `plurale` |
| 40347 | `doglie` | noun | 1 | dolori del parto consistenti in forti contrazioni dell'utero e degli altri muscoli coinvolti, finalizzati all'espulsione del nascituro. Il periodo precedente il parto caratterizzato da tali dolori viene detto travaglio | `travaglio` | `form-gloss` | `contrazioni` |
| 40382 | `abito` | verb | 0 | prima persona singolare dell'indicativo presente del verbo abitare | `abitare` | `form-gloss` | `singolare` |
| 40401 | `nota` | verb | 0 | seconda persona singolare del presente indicativo del verbo notare | `notare` | `form-gloss` | `singolare` |
| 40401 | `nota` | verb | 1 | seconda persona singolare dell'imperativo del verbo notare | `notare` | `form-gloss` | `singolare` |
| 40468 | `fica` | noun | 1 | organo genitale femminile, vulva | `vulva` | `form-gloss` | `femminile` |
| 40852 | `zigrinato` | verb | 0 | participio passato, maschile singolare di zigrinare | `zigrinare` | `form-gloss` | `participio` |
| 40936 | `allibito` | verb | 0 | participio passato maschile singolare del verbo allibire | `allibire` | `form-gloss` | `participio` |
| 41074 | `tamburello` | noun | 0 | diminutivo di tamburo | `tamburo` | `form-gloss` | `diminutivo` |
| 41149 | `cacciatorino` | noun | 0 | diminutivo di cacciatore | `cacciatore` | `form-gloss` | `diminutivo` |
| 41348 | `porta` | verb | 0 | participio passato, femminile singolare di porgere | `porgere` | `form-gloss` | `participio` |
| 41693 | `duci` | verb | 0 | indicativo presente, seconda persona singolare di ducere | `ducere` | `form-gloss` | `indicativo` |
| 41693 | `duci` | verb | 1 | imperativo presente, seconda persona singolare di ducere | `ducere` | `form-gloss` | `imperativo` |
| 41736 | `mura` | noun | 0 | plurale collettivo di muro, fortificazioni costruite intorno ad una città o un villaggio per impedirne la conquista ai nemici | `conquista` | `form-gloss` | `plurale` |
| 41762 | `sita` | adj | 0 | feminile di sito | `sito` | `form-gloss` | `feminile` |
| 42551 | `modello` | verb | 0 | prima persona singolare dell'indicativo presente del verbo modellare | `modellare` | `form-gloss` | `singolare` |
| 42614 | `iscritto` | verb | 0 | participio passato maschile singolare del verbo iscrivere | `iscrivere` | `form-gloss` | `participio` |
| 42679 | `ori` | verb | 0 | indicativo presente, seconda persona singolare di orare | `orare` | `form-gloss` | `indicativo` |
| 42679 | `ori` | verb | 1 | congiuntivo presente, prima persona singolare di orare | `orare` | `form-gloss` | `congiuntivo` |
| 42679 | `ori` | verb | 2 | congiuntivo presente, seconda persona singolare di orare | `orare` | `form-gloss` | `congiuntivo` |
| 42679 | `ori` | verb | 3 | congiuntivo presente, terza persona singolare di orare | `orare` | `form-gloss` | `congiuntivo` |
| 42679 | `ori` | verb | 4 | imperativo presente, terza persona singolare di orare | `orare` | `form-gloss` | `imperativo` |
| 42820 | `vomi` | verb | 0 | indicativo presente, seconda persona singolare di vomere | `vomere` | `form-gloss` | `indicativo` |
| 42820 | `vomi` | verb | 1 | imperativo presente, seconda persona singolare di vomere | `vomere` | `form-gloss` | `imperativo` |
| 43255 | `abbarrocià` | verb | 0 | toscano: (termine un tempo comune nella Val di Chiana ed aree limitrofe) voce verbale di abbarrocciare, tirar via nell'eseguire un lavoro, farlo male, in fretta, senza cura, nella confusione o in modo caotico. | `caotico` | `form-gloss` | `verbale` |
| 43520 | `6` | verb | 0 | abbreviazione della seconda persona singolare indicativo presente del verbo essere | `essere` | `form-gloss` | `abbreviazione` |
| 43927 | `sto` | verb | 0 | 1ª pers sing presente indicativo di stare | `stare` | `form-gloss` | `pers` |
| 43990 | `dir` | verb | 0 | variante, vedi dire; usata soprattutto in poesia o nella composizione co particelle clitiche | `clitiche` | `form-gloss` | `variante` |
| 44914 | `esse` | adj | 0 | queste, vedi esso | `queste` | `form-gloss` | `vedi` |
| 44929 | `pondero` | verb | 0 | prima personda singolare del presente indicativo di ponderare | `ponderare` | `form-gloss` | `singolare` |
| 45408 | `coso` | verb | 0 | indicativo presente, prima persona singolare di cosare | `cosare` | `form-gloss` | `indicativo` |
| 45583 | `ballo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ballare | `ballare` | `form-gloss` | `singolare` |
| 46209 | `bacino` | noun | 0 | diminutivo di bacio: gesto d'affetto con pressione della bocca | `affetto` | `form-gloss` | `diminutivo` |
| 46411 | `minima` | adj | 0 | superlativo femminile di piccolo | `piccolo` | `form-gloss` | `superlativo` |
| 47213 | `accusato` | verb | 0 | participio passato del verbo accusare | `accusare` | `form-gloss` | `participio` |
| 47372 | `aliena` | verb | 0 | terza persona singolare, indicativo presente di alienare | `alienare` | `form-gloss` | `singolare` |
| 47372 | `aliena` | verb | 1 | seconda persona singolare, imperativo di alienare | `alienare` | `form-gloss` | `singolare` |
| 47407 | `alluminato` | verb | 0 | part. passato di alluminare | `alluminare` | `form-gloss` | `part` |
| 47448 | `amorino` | noun | 0 | diminutivo di amore | `amore` | `form-gloss` | `diminutivo` |
| 47565 | `apostrofo` | verb | 0 | prima persona singolare, modo indicativo e tempo presente del verbo apostrofare | `apostrofare` | `form-gloss` | `singolare` |
| 47877 | `balza` | noun | 2 | striscia o fascia di stoffa pieghettata o arricciata, talvolta di tessuto diverso e diverso colore, applicata alle estremità di vesti femminili, biancheria, tende e simili con funzione ornamentale | `tende` | `form-gloss` | `femminili` |
| 47986 | `blocco` | verb | 0 | prima persona singolare presente del verbo bloccare | `bloccare` | `form-gloss` | `singolare` |
| 48020 | `buca` | verb | 0 | terza persona singolare del modo indicativo presente di bucare | `bucare` | `form-gloss` | `singolare` |
| 48020 | `buca` | verb | 1 | seconda persona singolare del modo imperativo presente di bucare | `bucare` | `form-gloss` | `singolare` |
| 48055 | `cagna` | noun | 0 | femmina del cane | `cane` | `form-gloss` | `femmina` |
| 48259 | `cesso` | verb | 0 | prima persona singolare presente del verbo cessare | `cessare` | `form-gloss` | `singolare` |
| 48388 | `ciurma` | verb | 0 | terza persona singolare, presente indicativo del verbo ciurmare | `ciurmare` | `form-gloss` | `singolare` |
| 48798 | `congettura` | verb | 0 | terza persona singolare, indicativo presente, di congetturare | `congetturare` | `form-gloss` | `singolare` |
| 48798 | `congettura` | verb | 1 | imperativo di congetturare | `congetturare` | `form-gloss` | `imperativo` |
| 48809 | `coniglietto` | noun | 0 | diminutivo di coniglio | `coniglio` | `form-gloss` | `diminutivo` |
| 48945 | `cozzo` | verb | 0 | prima persona singolare del presente indicativo del verbo cozzare | `cozzare` | `form-gloss` | `singolare` |
| 48949 | `creato` | verb | 0 | participio passato del verbo creare | `creare` | `form-gloss` | `participio` |
| 49127 | `danno` | verb | 0 | terza persona plurale, indicativo presente di dare | `dare` | `form-gloss` | `plurale` |
| 49137 | `dato` | verb | 0 | participio passato, maschile singolare di dare | `dare` | `form-gloss` | `participio` |
| 49894 | `fotocopia` | verb | 1 | seconda persona singolare dell'imperativop di fotocopiare | `fotocopiare` | `form-gloss` | `singolare` |
| 50097 | `guida` | verb | 0 | terza persona singolare, indicativo presente di guidare | `guidare` | `form-gloss` | `singolare` |
| 50097 | `guida` | verb | 1 | seconda persona singolare, imperativo di guidare | `guidare` | `form-gloss` | `singolare` |
| 50167 | `imbocco` | verb | 0 | indicativo presente, prima persona singolare di imboccare | `imboccare` | `form-gloss` | `indicativo` |
| 50216 | `impaccio` | verb | 0 | indicativo presente, prima persona singolare di impacciare | `impacciare` | `form-gloss` | `indicativo` |
| 50225 | `impatto` | verb | 0 | prima persona singolare dell' indicativo presente, di impattare | `impattare` | `form-gloss` | `singolare` |
| 50394 | `incontro` | verb | 0 | prima persona singolare del presente indicativo del verbo incontrare | `incontrare` | `form-gloss` | `singolare` |
| 50518 | `inganno` | verb | 0 | prima persona singolare dell' indicativo presente, di ingannare | `ingannare` | `form-gloss` | `singolare` |
| 50584 | `insegna` | verb | 0 | terza persona singolare dell'indicativo presente, di insegnare | `insegnare` | `form-gloss` | `singolare` |
| 50584 | `insegna` | verb | 1 | seconda persona singolare dell'imperativo presente, di insegnare | `insegnare` | `form-gloss` | `singolare` |
| 50633 | `intento` | verb | 0 | prima persona singolare dell'indicativo presente di "intentare" | `intentare` | `form-gloss` | `singolare` |
| 50686 | `intervallo` | verb | 0 | indicativo presente, prima persona singolare di intervallare | `intervallare` | `form-gloss` | `indicativo` |
| 50719 | `intrigo` | verb | 0 | prima persona singolare del presente indicativo del verbo intrigare | `intrigare` | `form-gloss` | `singolare` |
| 50767 | `invito` | verb | 0 | prima persona singolare del presente indicativo del verbo invitare | `invitare` | `form-gloss` | `singolare` |
| 50790 | `abrogato` | verb | 0 | participio passato, maschile singolare di abrogare | `abrogare` | `form-gloss` | `participio` |
| 50970 | `bellissimo` | adj | 0 | superlativo assoluto, maschile singolare di bello | `bello` | `form-gloss` | `superlativo` |
| 51295 | `livella` | verb | 1 | seconda persona singolare dell'omperativo presente di livellare | `livellare` | `form-gloss` | `singolare` |
| 51308 | `lotto` | verb | 0 | prima persona singolare dell'indicativo presente del verbo lottare | `lottare` | `form-gloss` | `singolare` |
| 51318 | `lusso` | verb | 0 | prima persona singolare dell'indicativo presente del verbo lussare | `lussare` | `form-gloss` | `singolare` |
| 51435 | `maestra` | adj | 0 | forma flessa di maestro | `maestro` | `form-gloss` | `forma` |
| 51458 | `difeso` | verb | 0 | participio passato singolare maschile del verbo difendere | `difendere` | `form-gloss` | `participio` |
| 51474 | `maggiore` | adj | 0 | comparativo di maggioranza, maschile e femminile singolare di grande | `grande` | `form-gloss` | `comparativo` |
| 51610 | `massimo` | adj | 0 | superlativo assoluto, maschile singolare di grande | `grande` | `form-gloss` | `superlativo` |
| 51866 | `monologo` | verb | 0 | prima persona sell'indicativo presente di monologare | `monologare` | `form-gloss` | `indicativo` |
| 52052 | `opera` | verb | 0 | terza persona singolare dell' indicativo presente, di operare | `operare` | `form-gloss` | `singolare` |
| 52052 | `opera` | verb | 1 | seconda persona singolare dell' imperativo presente, di operare | `operare` | `form-gloss` | `singolare` |
| 52075 | `ora` | verb | 0 | indicativo presente, terza persona singolare di orare | `orare` | `form-gloss` | `indicativo` |
| 52075 | `ora` | verb | 1 | imperativo presente, seconda persona singolare di orare | `orare` | `form-gloss` | `imperativo` |
| 52175 | `ottimate` | verb | 0 | participio passato (plurale femminile) di ottimare | `ottimare` | `form-gloss` | `participio` |
| 52175 | `ottimate` | verb | 1 | seconda persona plurale dell'indicativo presentedi di ottimare | `ottimare` | `form-gloss` | `plurale` |
| 52178 | `ottimo` | adj | 0 | superlativo assoluto, maschile singolare di buono | `buono` | `form-gloss` | `superlativo` |
| 52244 | `perito` | verb | 0 | participio passato maschile singolare del verbo perire | `perire` | `form-gloss` | `participio` |
| 52553 | `prodotto` | verb | 0 | participio passato maschile singolare del verbo produrre | `produrre` | `form-gloss` | `participio` |
| 52579 | `programma` | verb | 1 | seconda persona singolare del modo imperativo di programmare | `programmare` | `form-gloss` | `singolare` |
| 52608 | `protesta` | verb | 1 | seconda personale singolare imperativo di protestare | `protestare` | `form-gloss` | `singolare` |
| 52618 | `disabilitato` | verb | 0 | particio passato di disabilitare | `disabilitare` | `form-gloss` | `particio` |
| 52640 | `pubblico` | verb | 0 | 1ª persona singolare dell'indicativo presente di pubblicare | `pubblicare` | `form-gloss` | `singolare` |
| 52643 | `pugno` | verb | 0 | prima persona singolare, presente indicativo di pugnare | `pugnare` | `form-gloss` | `singolare` |
| 52717 | `quinta` | adj | 0 | femminilem di quinto | `quinto` | `form-gloss` | `femminilem` |
| 52723 | `quoto` | verb | 0 | 1ª persona singolare del presente semplice indicativo di quotare | `quotare` | `form-gloss` | `singolare` |
| 52726 | `duraturo` | verb | 0 | participio futuro del verbo durare | `durare` | `form-gloss` | `participio` |
| 52738 | `raccomandata` | verb | 0 | participio passato (femminile) di raccomandare | `raccomandare` | `form-gloss` | `participio` |
| 52854 | `reggiseno` | noun | 0 | plurale raro di reggiseno | `reggiseno` | `form-gloss` | `plurale` |
| 52917 | `revoca` | verb | 0 | terza persona singolare presente indicativo del verbo revocare | `revocare` | `form-gloss` | `singolare` |
| 52917 | `revoca` | verb | 1 | terza persona singolare presente indicativo del verbo revocare | `revocare` | `form-gloss` | `singolare` |
| 52978 | `esitante` | verb | 0 | particio presente di esitare | `esitare` | `form-gloss` | `particio` |
| 53050 | `rinnovo` | verb | 0 | prima persona singolare dell'indicativo presente rinnovare | `rinnovare` | `form-gloss` | `singolare` |
| 53097 | `risultante` | verb | 0 | participio presente del verbo risultare | `risultare` | `form-gloss` | `participio` |
| 53187 | `rubino` | verb | 0 | terza persona plurale del congiuntivo presente del verbo rubare | `rubare` | `form-gloss` | `plurale` |
| 53187 | `rubino` | verb | 1 | terza persona plurale dell'imperativo del verbo rubare | `imperativo` | `form-gloss` | `plurale` |
| 53229 | `salasso` | verb | 0 | prima persona singolare presente del verbo salassare | `salassare` | `form-gloss` | `singolare` |
| 53333 | `giustificato` | verb | 0 | particio passato maschile singolare di giustificare | `giustificare` | `form-gloss` | `particio` |
| 54201 | `sparato` | verb | 0 | participio passato del verbo sparare | `sparare` | `form-gloss` | `participio` |
| 54218 | `spavento` | verb | 0 | indicativo presente, prima persona singolare di spaventare | `spaventare` | `form-gloss` | `indicativo` |
| 54334 | `stampato` | verb | 0 | participio passato, maschile singolare di stampare | `stampare` | `form-gloss` | `participio` |
| 54338 | `massacrante` | verb | 0 | participio paresente di massacrare | `massacrare` | `form-gloss` | `participio` |
| 54410 | `stralcio` | verb | 0 | prima persona singolare dell'indicativo preasente di stralciare | `stralciare` | `form-gloss` | `singolare` |
| 54583 | `tavolino` | noun | 0 | diminutivo di tavolo | `tavolo` | `form-gloss` | `diminutivo` |
| 54679 | `pasciuto` | verb | 0 | participio passato del verbo pascere | `pascere` | `form-gloss` | `participio` |
| 54700 | `terrazzino` | noun | 0 | diminutivo di terrazzo | `terrazzo` | `form-gloss` | `diminutivo` |
| 54721 | `tesi` | verb | 0 | indicativo passato remoto, prima persona singolare di tendere | `tendere` | `form-gloss` | `indicativo` |
| 54721 | `tesi` | verb | 1 | participio passato, maschile plurale di tendere | `tendere` | `form-gloss` | `participio` |
| 55261 | `stanco` | verb | 0 | prima persona all'indicativo presente del verbo stancare | `stancare` | `form-gloss` | `indicativo` |
| 55281 | `tuffetto` | noun | 0 | diminutivo di tuffo | `tuffo` | `form-gloss` | `diminutivo` |
| 55425 | `valuta` | verb | 0 | terza persona singolare dell'indicativo presente del verbo valutare | `valutare` | `form-gloss` | `singolare` |
| 55429 | `tentativa` | adj | 0 | tentative (see tentativo) | `tentativo` | `form-gloss` | `see` |
| 55535 | `viaggio` | verb | 0 | prima persona singolare del presente indicativo del verbo viaggiare | `viaggiare` | `form-gloss` | `singolare` |
| 55666 | `voli` | verb | 4 | terza persona singolare imperativo divolare | `volare` | `form-gloss` | `singolare` |
| 55791 | `zirlo` | verb | 0 | first person singular present tense of zirlare | `zirlare` | `form-gloss` | `singular` |
| 56175 | `ansiose` | adj | 0 | fgemminile plurale di ansioso | `ansioso` | `form-gloss` | `fgemminile` |
| 56417 | `battute` | adj | 0 | femminile plurale di' battuto | `battuto` | `form-gloss` | `femminile` |
| 56889 | `competenti` | adj | 0 | maschile e femminile plurale di competente | `competente` | `form-gloss` | `maschile` |
| 56890 | `competenti` | noun | 0 | maschile e femminile plurale di competente | `competente` | `form-gloss` | `maschile` |
| 57085 | `contanti` | adj | 1 | pagamento a zero giorni di valuta, vale a dire con accredito al beneficiario entro lo stesso giorno lavorativo nel quale ha luogo la registrazione contabile nel conto corrente dell'ordinante. Nel gergo comune, si intende un passaggio di denaro da una persona fisica a un'altra nella forma di banconote di carta o di monete metalliche. In senso lato, è un qualsiasi pagamento, anche a mezzo di bonifico bancario o postale, avente accredito immediato. | `bonifico` | `form-gloss` | `forma` |
| 57361 | `degradanti` | adj | 0 | plurale didegradante | `degradante` | `form-gloss` | `plurale` |
| 57446 | `desiderate` | verb | 0 | seconda persona plurale dell'imperativo presente attivo di dēsīderō | `dēsīderō` | `form-gloss` | `plurale` |
| 57446 | `desiderate` | verb | 1 | vocativo maschile singolare del participio perfetto (dēsīderātus) di dēsīderō | `dēsīderō` | `form-gloss` | `maschile` |
| 57479 | `diametrali` | adj | 0 | Plural form of diametrale | `diametrale` | `form-gloss` | `plural` |
| 57646 | `eccepiti` | adj | 0 | Forma plurale maschile di eccepito | `eccepito` | `form-gloss` | `forma` |
| 57720 | `emozionati` | adj | 0 | 'plurale di' emozionato | `emozionato` | `form-gloss` | `plurale` |
| 57766 | `erogata` | verb | 0 | 'femminile di erogato | `erogato` | `form-gloss` | `femminile` |
| 57801 | `esercita` | verb | 0 | terza persona singolare del presente indicativo del verbo esercitare | `esercitare` | `form-gloss` | `singolare` |
| 57810 | `esperta` | adj | 0 | femminile di' esperto | `esperto` | `form-gloss` | `femminile` |
| 57811 | `esperta` | noun | 0 | femminile di' esperto | `esperto` | `form-gloss` | `femminile` |
| 57817 | `espresse` | adj | 0 | femmin9ile plurale di' espresso | `espresso` | `form-gloss` | `femmin` |
| 57835 | `esterni` | verb | 1 | prima, seconda e terza persona singolare presente congiuntivo di esternare | `esternare` | `form-gloss` | `singolare` |
| 57877 | `falsa` | verb | 0 | terza persona singolare del presente indicativo del verbo falsare | `falsare` | `form-gloss` | `singolare` |
| 58142 | `gradite` | adj | 0 | femminle plurale di gradito | `gradito` | `form-gloss` | `femminle` |
| 59073 | `introverse` | adj | 0 | Feminine plural form of introverso | `introverso` | `form-gloss` | `feminine` |
| 59082 | `inumani` | adj | 0 | Plural form of inumano | `inumano` | `form-gloss` | `plural` |
| 59093 | `invalidanti` | adj | 0 | Plural form of invalidante | `invalidante` | `form-gloss` | `plural` |
| 59094 | `invalide` | adj | 0 | Feminine plural form of invalido | `invalido` | `form-gloss` | `feminine` |
| 59103 | `inventivi` | adj | 0 | Plural form of inventivo | `inventivo` | `form-gloss` | `plural` |
| 59114 | `invertite` | adj | 0 | Feminine plural form of invertito | `invertito` | `form-gloss` | `feminine` |
| 59118 | `investigativi` | adj | 0 | Plural form of investigativo | `investigativo` | `form-gloss` | `plural` |
| 59145 | `ipnotiche` | adj | 0 | Feminine plural form of ipnotico | `ipnotico` | `form-gloss` | `feminine` |
| 59146 | `ipnotici` | adj | 0 | Plural form of ipnotico | `ipnotico` | `form-gloss` | `plural` |
| 59163 | `irachene` | adj | 0 | Feminine plural form of iracheno | `iracheno` | `form-gloss` | `feminine` |
| 59195 | `irrilevanti` | adj | 0 | Plural form of irrilevante | `irrilevante` | `form-gloss` | `plural` |
| 59206 | `irritanti` | adj | 0 | Plural form of irritante | `irritante` | `form-gloss` | `plural` |
| 59231 | `ispettivi` | adj | 0 | Plural form of ispettivo | `ispettivo` | `form-gloss` | `plural` |
| 59235 | `israeliane` | adj | 0 | Feminine plural form of israeliano | `israeliano` | `form-gloss` | `feminine` |
| 59236 | `israelite` | adj | 0 | Feminine plural form of israelita | `israelita` | `form-gloss` | `feminine` |
| 59244 | `istessi` | adj | 0 | Plural form of istesso | `istesso` | `form-gloss` | `plural` |
| 59260 | `itineranti` | adj | 0 | Plural form of itinerante | `itinerante` | `form-gloss` | `plural` |
| 59265 | `iussive` | adj | 0 | Feminine plural form of iussivo | `iussivo` | `form-gloss` | `feminine` |
| 59266 | `iussivi` | adj | 0 | Plural form of iussivo | `iussivo` | `form-gloss` | `plural` |
| 59353 | `lesa` | verb | 0 | participio passato, femminile singolare di ledere | `ledere` | `form-gloss` | `participio` |
| 59393 | `logistici` | adj | 0 | Plural form of logistico | `logistico` | `form-gloss` | `plural` |
| 59444 | `macrobiotici` | adj | 0 | Plural form of macrobiotico | `macrobiotico` | `form-gloss` | `plural` |
| 59451 | `macromolecolari` | adj | 0 | Plural form of macromolecolare | `macromolecolare` | `form-gloss` | `plural` |
| 59495 | `magnetizzabili` | adj | 0 | Plural form of magnetizzabile | `magnetizzabile` | `form-gloss` | `plural` |
| 59508 | `maieutici` | adj | 0 | Plural form of maieutico | `maieutico` | `form-gloss` | `plural` |
| 59598 | `marzolini` | adj | 0 | Plural form of marzolino | `marzolino` | `form-gloss` | `plural` |
| 59601 | `maschili` | adj | 0 | Plural form of maschile | `maschile` | `form-gloss` | `plural` |
| 59603 | `massima` | adj | 1 | superlativo assoluto, femminile singolare di grande | `grande` | `form-gloss` | `superlativo` |
| 59605 | `massime` | adj | 0 | superlativo assoluto, femminile plurale di grande | `grande` | `form-gloss` | `superlativo` |
| 59609 | `materni` | adj | 0 | Plural form of materno | `materno` | `form-gloss` | `plural` |
| 59611 | `mattutini` | adj | 0 | Plural form of mattutino | `mattutino` | `form-gloss` | `plural` |
| 59619 | `medi` | verb | 1 | prima, seconda e terza persona singolare del presente congiuntivo di mediare | `mediare` | `form-gloss` | `singolare` |
| 59819 | `nebulosi` | adj | 0 | Plural form of nebuloso | `nebuloso` | `form-gloss` | `plural` |
| 59857 | `netta` | adj | 0 | fmminile singolare di netto | `netto` | `form-gloss` | `fmminile` |
| 59860 | `netti` | verb | 0 | seconda persona singolare dell' indicativo presente, di nettare | `nettare` | `form-gloss` | `singolare` |
| 59860 | `netti` | verb | 1 | prima persona singolare del congiuntivo presente, di nettare | `nettare` | `form-gloss` | `singolare` |
| 59860 | `netti` | verb | 2 | seconda persona singolare del congiuntivo presente, di nettare | `nettare` | `form-gloss` | `singolare` |
| 59860 | `netti` | verb | 4 | terza persona singolare dell'imperativo presente, di nettare | `nettare` | `form-gloss` | `singolare` |
| 59896 | `nominativi` | adj | 0 | Plural form of nominativo | `nominativo` | `form-gloss` | `plural` |
| 59901 | `notevoli` | adj | 0 | Plural form of notevole | `notevole` | `form-gloss` | `plural` |
| 59934 | `nuvoli` | adj | 0 | Plural form of nuvolo | `nuvolo` | `form-gloss` | `plural` |
| 59936 | `nuvolose` | adj | 0 | femminile plurale dinuvoloso | `nuvoloso` | `form-gloss` | `femminile` |
| 60095 | `ospedalieri` | adj | 0 | Plural form of ospedaliero | `ospedaliero` | `form-gloss` | `plural` |
| 60113 | `ottemperanti` | adj | 0 | Plural form of ottemperante | `ottemperante` | `form-gloss` | `plural` |
| 60117 | `ottima` | adj | 0 | superlativo assoluto, femminile singolare di buono | `buono` | `form-gloss` | `superlativo` |
| 60119 | `ottime` | adj | 0 | superlativo assoluto, femminile plurale di buono | `buono` | `form-gloss` | `superlativo` |
| 60120 | `ottimi` | adj | 0 | superlativo assoluto, maschile plurale di buono | `buono` | `form-gloss` | `superlativo` |
| 60324 | `portanti` | adj | 0 | Plural form of portante | `portante` | `form-gloss` | `plural` |
| 60369 | `prese` | noun | 0 | elettricità) plurale di presa | `presa` | `form-gloss` | `plurale` |
| 60370 | `prese` | verb | 0 | terza persona singolare del tempo passato remoto del modo indicativo di prendere | `prendere` | `form-gloss` | `singolare` |
| 60374 | `presidenziali` | adj | 0 | Plural form of presidenziale | `presidenziale` | `form-gloss` | `plural` |
| 60395 | `previ` | adj | 0 | Plural of previo | `previo` | `form-gloss` | `plural` |
| 60426 | `privi di vita` | adj | 0 | Plural form of privo di vita | `privo di vita` | `form-gloss` | `plural` |
| 60472 | `prorogata` | adj | 0 | femminile di' prorogato | `prorogato` | `form-gloss` | `femminile` |
| 60593 | `reagiri` | adj | 0 | Plural form of reagente | `reagente` | `form-gloss` | `plural` |
| 60640 | `respiratori` | adj | 0 | Plural form of respiratorio | `respiratorio` | `form-gloss` | `plural` |
| 60648 | `retributivi` | adj | 0 | Plural form of retributivo | `retributivo` | `form-gloss` | `plural` |
| 60677 | `riciclati` | adj | 0 | Plural form of riciclato | `riciclato` | `form-gloss` | `plural` |
| 60680 | `ridenti` | adj | 0 | maschile e femminile plurale di ridente | `ridente` | `form-gloss` | `maschile` |
| 60704 | `rigide` | adj | 0 | femminile plarale di rigido | `rigido` | `form-gloss` | `femminile` |
| 60706 | `rigidi` | adj | 0 | Plural form of rigido | `rigido` | `form-gloss` | `plural` |
| 60718 | `ripetitivi` | adj | 0 | Plural form of ripetitivo | `ripetitivo` | `form-gloss` | `plural` |
| 60726 | `riproposti` | adj | 0 | Plural form of riproposto | `riproposto` | `form-gloss` | `plural` |
| 60739 | `ritenuti` | adj | 0 | Plural form of ritenuto | `ritenuto` | `form-gloss` | `plural` |
| 60761 | `rotondi` | adj | 0 | Plural form of rotondo | `rotondo` | `form-gloss` | `plural` |
| 60767 | `rubicondi` | adj | 0 | Plural form of rubicondo | `rubicondo` | `form-gloss` | `plural` |
| 60844 | `celeberrimo` | adj | 0 | superlativo assoluto, maschile singolare di celebre | `celebre` | `form-gloss` | `superlativo` |
| 61853 | `giochi` | verb | 5 | terza persona singolare dell'imperativo negativo di giocare | `giocare` | `form-gloss` | `singolare` |
| 61915 | `abbonati` | verb | 0 | imperativo del verbo abbonarsi | `abbonarsi` | `form-gloss` | `imperativo` |
| 63963 | `suto` | verb | 0 | abbreviazione di essuto, forma antica del participio passato del verbo essere, oggi resa con stato, ripreso dal verbo stare | `stare` | `form-gloss` | `abbreviazione` |
| 64310 | `acusticofobie` | noun | 0 | plurale di 'acusticofobia | `acusticofobia` | `form-gloss` | `plurale` |
| 64464 | `legate` | verb | 0 | participio passato (plurale femminile) di legare | `legare` | `form-gloss` | `participio` |
| 64633 | `spacco` | verb | 0 | prima persona singolare dell'indicativo presente del verbo spaccare | `spaccare` | `form-gloss` | `singolare` |
| 64821 | `limoni` | verb | 0 | seconda persona singolare dell'indicativo presente del verbo limonare | `limonare` | `form-gloss` | `singolare` |
| 64821 | `limoni` | verb | 1 | prima, seconda e terza persona singolare del congiuntivo presente del verbo limonare | `limonare` | `form-gloss` | `singolare` |
| 64917 | `legni` | noun | 1 | gruppo di strumenti a fiato anticamente costruiti col legno | `legno` | `names-base` |  |
| 66128 | `velle` | noun | 0 | infinito del verbo latino volo, utilizzato con lo stesso significato dell'italiano volontà, volere | `volere` | `form-gloss` | `infinito` |
| 67681 | `anelli` | noun | 1 | specialità maschile della ginnastica artistica | `ginnastica artistica` | `form-gloss` | `maschile` |
| 68189 | `transumante` | verb | 0 | p. pres di transumare | `transumare` | `form-gloss` | `p` |
| 68695 | `classificati` | verb | 0 | p.pass. di classificare | `classificare` | `form-gloss` | `p` |
| 69814 | `azzurreggiato` | verb | 0 | p. passato di azzurreggiare | `azzurreggiare` | `form-gloss` | `p` |
| 69828 | `azzoppito` | verb | 0 | participio passato del verbo azzoppire | `azzoppire` | `form-gloss` | `participio` |
| 69833 | `azzoppato` | verb | 0 | part. passato di azzoppare | `azzoppare` | `form-gloss` | `part` |
| 70291 | `integerrimo` | adj | 0 | superlativo assoluto, maschile singolare di integro | `integro` | `form-gloss` | `superlativo` |
| 70728 | `divertimenti` | noun | 0 | 'plurale di' divertimento | `divertimento` | `form-gloss` | `plurale` |
| 70731 | `acquapendente` | verb | 0 | part. presente di acquapendere | `acquapendere` | `form-gloss` | `part` |
| 70927 | `componenti` | verb | 0 | participio predente plurale di comporre | `comporre` | `form-gloss` | `participio` |
| 71279 | `acquato` | verb | 0 | part. pass di acquare | `acquare` | `form-gloss` | `part` |
| 71469 | `acquiescente` | verb | 0 | part. presente di acquiescere | `acquiescere` | `form-gloss` | `part` |
| 72156 | `caco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di cacare | `cacare` | `form-gloss` | `singolare` |
| 72274 | `pignoranti` | adj | 0 | vedi pignorante | `pignorante` | `form-gloss` | `vedi` |
| 72282 | `obbligazioni` | noun | 0 | vedi obbligazione | `obbligazione` | `form-gloss` | `vedi` |
| 72697 | `abbarrato` | verb | 0 | part. passato di abbarrare | `abbarrare` | `form-gloss` | `part` |
| 73428 | `abbaruffato` | verb | 0 | part. passato di abbaruffare | `abbaruffare` | `form-gloss` | `part` |
| 73984 | `disoccupati` | verb | 0 | participio presente mas chile plurale di disoccupare | `disoccupare` | `form-gloss` | `participio` |
| 74562 | `abrogati` | verb | 0 | participio passato plurale femminle di abrogare | `abrogare` | `form-gloss` | `participio` |
| 74704 | `punzonatrice` | noun | 1 | colei che punzona, femminile di punzonatore | `punzonatore` | `form-gloss` | `femminile` |
| 75446 | `leggi` | verb | 1 | 2ª persona singolare dell'imperativo di leggere | `leggere` | `form-gloss` | `singolare` |
| 76796 | `scoperto` | verb | 0 | participio passato maschile singolare del verbo scoprire | `scoprire` | `form-gloss` | `participio` |
| 76798 | `punzoni` | verb | 1 | prima, seconda, terza persona singolare del congiuntivo presente di punzonare | `punzonare` | `form-gloss` | `singolare` |
| 77163 | `parti` | verb | 0 | seconda persona singolare dell'indicativo presente del verbo partire | `partire` | `form-gloss` | `singolare` |
| 77773 | `fidanza` | verb | 0 | terza persona singolare dell'indicativo presente del verbo fidanzare | `fidanzare` | `form-gloss` | `singolare` |
| 78381 | `cazzi` | verb | 0 | indicativo presente, seconda persona singolare di cazzare | `cazzare` | `form-gloss` | `indicativo` |
| 78381 | `cazzi` | verb | 1 | congiuntivo presente, prima persona singolare di cazzare | `cazzare` | `form-gloss` | `congiuntivo` |
| 78381 | `cazzi` | verb | 2 | congiuntivo presente, seconda persona singolare di cazzare | `cazzare` | `form-gloss` | `congiuntivo` |
| 78381 | `cazzi` | verb | 3 | congiuntivo presente, terza persona singolare di cazzare | `cazzare` | `form-gloss` | `congiuntivo` |
| 79603 | `agevolati` | verb | 0 | participio passato plurale d i agevolare | `agevolare` | `form-gloss` | `participio` |
| 79632 | `catalizzante` | verb | 0 | participio presente del verbo catalizzare | `catalizzare` | `form-gloss` | `participio` |
| 80170 | `archi` | noun | 1 | nome usato per indicare gli strumenti ad arco | `arco` | `names-base` |  |
| 80193 | `valgo` | verb | 0 | prima persona singolare dell'indicativo presente del verbo valere | `valere` | `form-gloss` | `singolare` |
| 80383 | `telefoni` | verb | 0 | seconda persona singolare dell' indicativo presente del verbo telefonare | `telefonare` | `form-gloss` | `singolare` |
| 80945 | `sontuosa` | adj | 0 | femminile sontuoso | `sontuoso` | `form-gloss` | `femminile` |
| 81065 | `sintetizzatrice` | adj | 0 | f sing di sintetizzatore | `sintetizzatore` | `form-gloss` | `f` |
| 81066 | `sintetizzatrici` | adj | 0 | f plur di sintetizzatore | `sintetizzatore` | `form-gloss` | `f` |
| 81067 | `sintetizzatori` | adj | 0 | m plur di sintetizzatore | `sintetizzatore` | `form-gloss` | `m` |
| 81206 | `edonisti` | noun | 0 | 'maschile plurale di edonista | `edonista` | `form-gloss` | `maschile` |
| 81464 | `stradina` | noun | 0 | diminutivo di strada | `strada` | `form-gloss` | `diminutivo` |
| 82029 | `mnemoniche` | adj | 0 | femm forminile plurale di mnemonico | `mnemonico` | `form-gloss` | `femm` |
| 82485 | `socratici` | adj | 0 | plurale socratico | `socratico` | `form-gloss` | `plurale` |
| 83034 | `convenienti` | adj | 0 | purale di conveniente | `conveniente` | `form-gloss` | `purale` |
| 83237 | `porte` | verb | 0 | participio passato, femminile plurale di porgere | `porgere` | `form-gloss` | `participio` |
| 83278 | `discendente` | verb | 0 | participio presente del verbo discendere | `discendere` | `form-gloss` | `participio` |
| 83719 | `tangenti` | adj | 0 | maschile e femminile plurale di tangente | `tangente` | `form-gloss` | `maschile` |
| 85947 | `camuni` | adj | 0 | (abitanti)plurale di camuno | `camuno` | `form-gloss` | `plurale` |
| 85948 | `camuni` | noun | 0 | (abitanti)plurale di camuno | `camuno` | `form-gloss` | `plurale` |
| 86419 | `umidissimo` | adj | 0 | superlativo assoluto, maschile singolare di umido | `umido` | `form-gloss` | `superlativo` |
| 86828 | `succube` | adj | 1 | variante ritenuta a volte scorretta di succubo, ma oggi la più diffusa nell'uso | `succubo` | `form-gloss` | `variante` |
| 86953 | `svenuto` | verb | 0 | particio passato maschile singolare di svenire | `svenire` | `form-gloss` | `particio` |
| 87426 | `spurga` | verb | 0 | voce del verbo spurgare | `spurgare` | `form-gloss` | `verbo` |
| 87826 | `acerrimi` | adj | 0 | superlativo assoluto, maschile plurale di acre | `acre` | `form-gloss` | `superlativo` |
| 87830 | `acerrima` | adj | 0 | superlativo assoluto, femminile singolare di acre | `acre` | `form-gloss` | `superlativo` |
| 87849 | `acutissimi` | adj | 0 | superlativo assoluto, maschile plurale di acuto | `acuto` | `form-gloss` | `superlativo` |
| 87855 | `acutissima` | adj | 0 | superlativo assoluto, femminile plurale di acuto | `acuto` | `form-gloss` | `superlativo` |
| 88388 | `usai` | verb | 0 | prima persona singolare, tempo passato remoto, modo indicativo del verbo usare | `usare` | `form-gloss` | `singolare` |
| 88428 | `traversa` | verb | 0 | terza persona singolare, indicativo presente, di traversare | `traversare` | `form-gloss` | `singolare` |
| 88876 | `destini` | verb | 3 | terza persona singolare del congiuntivo pretense di destinare | `destinare` | `form-gloss` | `singolare` |
| 88924 | `elogi` | noun | 0 | (di meriti) plurale di elogio | `elogio` | `form-gloss` | `plurale` |
| 89063 | `acutissimo` | adj | 0 | superlativo assoluto, maschile singolare di acuto | `acuto` | `form-gloss` | `superlativo` |
| 89064 | `acutissime` | adj | 0 | superlativo assoluto, femminile plurale di acuto | `acuto` | `form-gloss` | `superlativo` |
| 89429 | `toi` | verb | 0 | seconda persona singolare, modo indicativo del verbo togliere; oggi espressa con: togli | `togliere` | `form-gloss` | `singolare` |
| 91464 | `ragazzone` | noun | 0 | accrescitivo di ragazzo | `ragazzo` | `form-gloss` | `accrescitivo` |
| 91959 | `soffio` | verb | 0 | prima persona singolare del presente indicativo del verbo soffiare | `soffiare` | `form-gloss` | `singolare` |
| 92020 | `terracotte` | noun | 0 | variante di terrecotte, plurale di terracotta | `terracotta` | `form-gloss` | `variante` |
| 92112 | `piega` | verb | 1 | seconda persona singolare dell'imperativo presentedi piegare | `piegare` | `form-gloss` | `singolare` |
| 93123 | `sbrindellato` | verb | 0 | participio passato. di sbrindellare | `sbrindellare` | `form-gloss` | `participio` |
| 93203 | `randage` | adj | 0 | variante di randagie | `randagie` | `form-gloss` | `variante` |
| 93204 | `randage` | noun | 0 | variante di randagie | `randagie` | `form-gloss` | `variante` |
| 93530 | `dirimente` | verb | 0 | participio presente del verbo dirimere | `dirimere` | `form-gloss` | `participio` |
| 93913 | `diluito` | verb | 0 | participio passato del verbo diluire, diluirsi | `diluirsi` | `form-gloss` | `participio` |
| 93969 | `ordini` | verb | 1 | prima persona singolare del congiuntivo presente, di ordinare | `ordinare` | `form-gloss` | `singolare` |
| 93969 | `ordini` | verb | 2 | seconda persona singolare del congiuntivo presente, di ordinare | `ordinare` | `form-gloss` | `singolare` |
| 96093 | `travestito` | verb | 0 | participio passato maschile singolare del verbo travestire | `travestire` | `form-gloss` | `participio` |
| 97361 | `marcio` | verb | 0 | prima persona singolare dell'indicativo presente del verbo marciare | `marciare` | `form-gloss` | `singolare` |
| 97806 | `barbera` | adj | 0 | forma flessa di barbero | `barbero` | `form-gloss` | `forma` |
| 97807 | `barbera` | noun | 0 | forma flessa di barbero | `barbero` | `form-gloss` | `forma` |
| 99064 | `postulanti` | adj | 0 | maschile e femminile plurale di postulante | `postulante` | `form-gloss` | `maschile` |
| 99065 | `postulanti` | noun | 0 | maschile e femminile plurale di postulante | `postulante` | `form-gloss` | `maschile` |
| 99066 | `postulanti` | verb | 0 | participio presente maschile e femminile plurale di postulare | `postulare` | `form-gloss` | `participio` |
| 99121 | `scasso` | verb | 0 | 1ª pers sing indicativo presente di scassare | `scassare` | `form-gloss` | `pers` |
| 99123 | `belo` | verb | 0 | prima persona singolare dell'indicativo presente del verbo belare | `belare` | `form-gloss` | `singolare` |
| 99307 | `pervicaci` | adj | 0 | maschile e femminile plurali di pervicace | `pervicace` | `form-gloss` | `maschile` |
| 99322 | `etere` | noun | 1 | composto organico formato da un atomo di ossigeno unito con singoli legami a due gruppi alchilici o arilici | `arilici` | `form-gloss` | `singoli` |
| 99556 | `picche` | noun | 1 | seme delle carte da gioco francesi, di colore nero e a forma di cuore, con la punta in alto e uno stelo che si inserisce fra i due lobi (♠) | `lobi` | `form-gloss` | `forma` |
| 99754 | `interpolari` | adj | 0 | maschile plurale e femminile plurale di interpolare | `interpolare` | `form-gloss` | `maschile` |
| 99878 | `sensali` | noun | 0 | maschile plurale e femminile plurale di sensale | `sensale` | `form-gloss` | `maschile` |
| 100063 | `eruciformi` | adj | 0 | maschile e femminile plurali di eruciforme | `eruciforme` | `form-gloss` | `maschile` |
| 100112 | `indeiscenti` | adj | 0 | maschile e femminile plurali di indeiscente | `indeiscente` | `form-gloss` | `maschile` |
| 101169 | `deiscenti` | adj | 0 | maschile e femminile plurali di deiscente | `deiscente` | `form-gloss` | `maschile` |
| 101606 | `corruschi` | verb | 1 | prima, seconda e terza persona del congiuntivo presente di corruscare | `corruscare` | `form-gloss` | `congiuntivo` |
| 102084 | `acclivi` | adj | 0 | maschile e femminile plurali di acclive | `acclive` | `form-gloss` | `maschile` |
| 102108 | `obbligatissimo` | adj | 0 | superlativo assoluto, maschile singolare di obbligato | `obbligato` | `form-gloss` | `superlativo` |
| 102263 | `abbiamo` | verb | 0 | prima persona plurale indicativo presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 102263 | `abbiamo` | verb | 1 | prima persona plurale congiuntivo presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 102263 | `abbiamo` | verb | 2 | prima persona plurale imperativo presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 102266 | `avevi` | verb | 0 | 2ᵃ pers. sing. indicativo imperfetto di avere | `avere` | `form-gloss` | `pers` |
| 102268 | `avevamo` | verb | 0 | 1ᵃ pers. pers. pl. indicativo imperfetto di avere | `avere` | `form-gloss` | `pers` |
| 102269 | `avevate` | verb | 0 | 2ª pers plur indicativo imperfetto di avere | `avere` | `form-gloss` | `pers` |
| 102275 | `aveste` | verb | 0 | seconda persona plurale passato remoto del verbo avere | `avere` | `form-gloss` | `plurale` |
| 102275 | `aveste` | verb | 1 | seconda persona plurale congiuntivo imperfetto del verbo avere | `avere` | `form-gloss` | `plurale` |
| 102276 | `ebbero` | verb | 0 | terza persona plurale, indicativo passato remoto di avere | `avere` | `form-gloss` | `plurale` |
| 102468 | `lungimiranti` | adj | 0 | maschile e femminile plurali di lungimirante | `lungimirante` | `form-gloss` | `maschile` |
| 102481 | `incolumi` | adj | 0 | maschile e femminile plurali di incolume | `incolume` | `form-gloss` | `maschile` |
| 102577 | `alacri` | adj | 0 | maschile e femminile plurali di alacre | `alacre` | `form-gloss` | `maschile` |
| 103232 | `erubescenti` | adj | 0 | maschile e femminile plurali di erubescente | `erubescente` | `form-gloss` | `maschile` |
| 103292 | `condomini` | noun | 1 | (comproprietari)) plurale di condomino | `condomino` | `form-gloss` | `plurale` |
| 103458 | `estruso` | verb | 0 | participio passato del verbo estrudere | `estrudere` | `form-gloss` | `participio` |
| 104659 | `zigrini` | verb | 0 | indicativo presente, seconda persona singolare di zigrinare | `zigrinare` | `form-gloss` | `indicativo` |
| 104659 | `zigrini` | verb | 1 | congiuntivo presente, prima persona singolare di zigrinare | `zigrinare` | `form-gloss` | `congiuntivo` |
| 104659 | `zigrini` | verb | 2 | congiuntivo presente, seconda persona singolare di zigrinare | `zigrinare` | `form-gloss` | `congiuntivo` |
| 104659 | `zigrini` | verb | 3 | congiuntivo presente, terza persona singolare di zigrinare | `zigrinare` | `form-gloss` | `congiuntivo` |
| 104659 | `zigrini` | verb | 4 | imperativo presente, terza persona singolare di zigrinare | `zigrinare` | `form-gloss` | `imperativo` |
| 105930 | `mittenti` | noun | 0 | maschile e femminile plurali di mittente | `mittente` | `form-gloss` | `maschile` |
| 105951 | `scoreggia` | verb | 0 | indicativo presente, terza persona singolare di scoreggiare | `scoreggiare` | `form-gloss` | `indicativo` |
| 105951 | `scoreggia` | verb | 1 | imperativo presente, seconda persona singolare di scoreggiare | `scoreggiare` | `form-gloss` | `imperativo` |
| 106040 | `bofonchio` | verb | 0 | prina persona singolare dell'indicativo presente di bofonchiare | `bofonchiare` | `form-gloss` | `singolare` |
| 106261 | `assenti` | adj | 0 | plurale maschile e femminile di assente | `assente` | `form-gloss` | `plurale` |
| 106767 | `prolifico` | verb | 0 | prima persona presente singolare indicativo del verbo prolificare | `prolificare` | `form-gloss` | `singolare` |
| 106827 | `gingillino` | verb | 0 | terza persona plurale congiuntivo presente del verbo gingillare | `gingillare` | `form-gloss` | `plurale` |
| 106827 | `gingillino` | verb | 1 | terza persona plurale imperativo presente del verbo gingillare | `gingillare` | `form-gloss` | `plurale` |
| 106856 | `elevato` | verb | 0 | participio passato maschile singolare del verbo elevare | `elevare` | `form-gloss` | `participio` |
| 108608 | `stipi` | verb | 0 | seconda persona singolare dell'indicativo presente del verbo stipare | `stipare` | `form-gloss` | `singolare` |
| 108608 | `stipi` | verb | 1 | prima persona singolare del congiuntivo presente del verbo stipare | `stipare` | `form-gloss` | `singolare` |
| 108608 | `stipi` | verb | 2 | seconda persona singolare del congiuntivo presente del verbo stipare | `stipare` | `form-gloss` | `singolare` |
| 108608 | `stipi` | verb | 3 | terza persona singolare del congiuntivo presente del verbo stipare | `stipare` | `form-gloss` | `singolare` |
| 108914 | `sono` | verb | 0 | 1ª pers sing presente semplice indicativo di essere | `essere` | `form-gloss` | `pers` |
| 108914 | `sono` | verb | 1 | 3ª pers plur presente semplice indicativo di essere | `essere` | `form-gloss` | `pers` |
| 108944 | `cagavamo` | verb | 0 | 1ᵃ pers. pers. pl. indicativo imperfetto di cagare | `cagare` | `form-gloss` | `pers` |
| 109102 | `molliche` | noun | 0 | (solo al plurale): briciole | `briciole` | `form-gloss` | `plurale` |
| 109121 | `tirai` | verb | 0 | prima persona singolare del passato remoto del verbo tirare | `tirare` | `form-gloss` | `singolare` |
| 109123 | `tirò` | verb | 0 | terza persona singolare del passato remoto del verbo tirare | `tirare` | `form-gloss` | `singolare` |
| 109124 | `tirasti` | verb | 0 | seconda persona singolare del passato remoto del verbo tirare | `tirare` | `form-gloss` | `singolare` |
| 109125 | `fumasti` | verb | 0 | seconda persona singolare del passato remoto del verbo fumare | `fumare` | `form-gloss` | `singolare` |
| 109372 | `creati` | noun | 0 | mschile plurale di creato | `creato` | `form-gloss` | `mschile` |
| 109760 | `suicidi` | verb | 0 | 2ª pers. pers. singolare indicativo presente del verbo suicidarsi | `suicidarsi` | `form-gloss` | `pers` |
| 109760 | `suicidi` | verb | 1 | 1ᵃ pers., 2ª pers. pers. e 3ᵃ pers. singolare congiuntivo presente del verbo suicidarsi | `suicidarsi` | `form-gloss` | `pers` |
| 109760 | `suicidi` | verb | 2 | 3ᵃ pers. singolare imperativo presente del verbo suicidarsi | `suicidarsi` | `form-gloss` | `pers` |
| 110555 | `ingoio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ingoiare | `ingoiare` | `form-gloss` | `singolare` |
| 111297 | `spaccio` | verb | 0 | prima persona singolare, presente indicativo di spacciare | `spacciare` | `form-gloss` | `singolare` |
| 111303 | `ciurmato` | verb | 0 | participio passato del verbo ciurmare | `ciurmare` | `form-gloss` | `participio` |
| 111401 | `morituro` | verb | 0 | participio futuro del verbo morire | `morire` | `form-gloss` | `participio` |
| 111403 | `venturo` | verb | 0 | participio futuro del verbo venire | `venire` | `form-gloss` | `participio` |
| 111406 | `perituro` | verb | 0 | participio futuro del verbo perire | `perire` | `form-gloss` | `participio` |
| 111418 | `nascituro` | verb | 0 | participio futuro del verbo nascere | `nascere` | `form-gloss` | `participio` |
| 111449 | `essente` | verb | 0 | participio presente del verbo essere | `essere` | `form-gloss` | `participio` |
| 111585 | `stampati` | verb | 0 | participio passato, maschile plurale di stampare | `stampare` | `form-gloss` | `participio` |
| 111587 | `stampate` | verb | 0 | participio passato, femminile plurale di stampare | `stampare` | `form-gloss` | `participio` |
| 111589 | `stampata` | verb | 0 | participio passato, femminile singolare di stampare | `stampare` | `form-gloss` | `participio` |
| 111736 | `saluti` | verb | 1 | prina persona singolare del congiuntivo presente di salutare | `salutare` | `form-gloss` | `singolare` |
| 111740 | `secondi` | verb | 0 | seconda persona singolare dell'indicativo presente si secondare | `secondare` | `form-gloss` | `singolare` |
| 111942 | `gite` | verb | 0 | seconda persona plurale, modo indicativo, tempo presente del verbo gire | `gire` | `form-gloss` | `plurale` |
| 111997 | `scontri` | verb | 1 | prima persona singolare del congiuntivo presente\|di scontrare | `scontrare` | `form-gloss` | `singolare` |
| 112011 | `ami` | verb | 0 | 2a persona singolare del presente indicativo del verbo amare | `amare` | `form-gloss` | `singolare` |
| 112011 | `ami` | verb | 1 | 1a, 2a, 3a persona singolare del presente congiuntivo del verbo amare | `amare` | `form-gloss` | `singolare` |
| 112048 | `buchi` | verb | 0 | seconda persona singolare dell'indicativo presentedi bucare | `bucare` | `form-gloss` | `singolare` |
| 112149 | `imputati` | verb | 0 | participio passatomascile plurale di imputare | `imputare` | `form-gloss` | `participio` |
| 112323 | `lucertole` | noun | 0 | . plurale di lucertola | `lucertola` | `form-gloss` | `plurale` |
| 112360 | `pesti` | verb | 0 | seconda persona singolare dell' indicativo presente, di pestare | `pestare` | `form-gloss` | `singolare` |
| 112360 | `pesti` | verb | 1 | prima persona singolare del congiuntivo presente, di pestare | `pestare` | `form-gloss` | `singolare` |
| 112360 | `pesti` | verb | 2 | seconda persona singolare del congiuntivo presente, di pestare | `pestare` | `form-gloss` | `singolare` |
| 112360 | `pesti` | verb | 3 | terza persona singolare del congiuntivo presente, di pestare | `pestare` | `form-gloss` | `singolare` |
| 112668 | `ricci` | adj | 0 | (di peli o fili) plurale di riccio | `riccio` | `form-gloss` | `plurale` |
| 112668 | `ricci` | adj | 2 | (di individui) plurale di riccio | `riccio` | `form-gloss` | `plurale` |
| 112668 | `ricci` | adj | 3 | (di capelli) plurale di riccio | `riccio` | `form-gloss` | `plurale` |
| 112826 | `mangio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di mangiare | `mangiare` | `form-gloss` | `singolare` |
| 112829 | `vedo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di vedere | `vedere` | `form-gloss` | `singolare` |
| 112830 | `leggo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di leggere | `leggere` | `form-gloss` | `singolare` |
| 112831 | `spengo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di spegnere | `spegnere` | `form-gloss` | `singolare` |
| 112865 | `incollo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di incollare | `incollare` | `form-gloss` | `singolare` |
| 112873 | `raccolgo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di raccogliere | `raccogliere` | `form-gloss` | `singolare` |
| 112874 | `tengo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di tenere | `tenere` | `form-gloss` | `singolare` |
| 112883 | `stronco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di stroncare | `stroncare` | `form-gloss` | `singolare` |
| 112884 | `compro` | verb | 0 | 1ª persona singolare del presente semplice indicativo di comprare | `comprare` | `form-gloss` | `singolare` |
| 112885 | `vendo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di vendere | `vendere` | `form-gloss` | `singolare` |
| 112886 | `spargo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di spargere | `spargere` | `form-gloss` | `singolare` |
| 112888 | `affitto` | verb | 0 | 1ª persona singolare del presente semplice indicativo di affittare | `affittare` | `form-gloss` | `singolare` |
| 112889 | `rimango` | verb | 0 | 1ª persona singolare del presente semplice indicativo di rimanere | `rimanere` | `form-gloss` | `singolare` |
| 112892 | `nego` | verb | 0 | prima persona singolare dellindicativo presente di negare | `negare` | `form-gloss` | `singolare` |
| 112895 | `creo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di creare | `creare` | `form-gloss` | `singolare` |
| 112896 | `scopro` | verb | 0 | 1ª persona singolare del presente semplice indicativo di scoprire | `scoprire` | `form-gloss` | `singolare` |
| 112898 | `premo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di premere | `premere` | `form-gloss` | `singolare` |
| 112900 | `muovo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di muovere | `muovere` | `form-gloss` | `singolare` |
| 112902 | `metto` | verb | 0 | 1ª persona singolare del presente semplice indicativo di mettere | `mettere` | `form-gloss` | `singolare` |
| 112905 | `vengo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di venire | `venire` | `form-gloss` | `singolare` |
| 112906 | `unisco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di unire | `unire` | `form-gloss` | `singolare` |
| 112907 | `ledo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ledere | `ledere` | `form-gloss` | `singolare` |
| 112908 | `nascondo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di nascondere | `nascondere` | `form-gloss` | `singolare` |
| 112909 | `modifico` | verb | 0 | 1ª persona singolare del presente semplice indicativo di modificare | `modificare` | `form-gloss` | `singolare` |
| 112915 | `vado` | verb | 0 | 1ª persona singolare del presente semplice indicativo di andare | `andare` | `form-gloss` | `singolare` |
| 112922 | `vandalizzo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di vandalizzare | `vandalizzare` | `form-gloss` | `singolare` |
| 112928 | `smetto` | verb | 0 | 1ª persona singolare del presente semplice indicativo di smettere | `smettere` | `form-gloss` | `singolare` |
| 112929 | `tolgo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di togliere | `togliere` | `form-gloss` | `singolare` |
| 112932 | `scelgo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di scegliere | `scegliere` | `form-gloss` | `singolare` |
| 112933 | `rido` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ridere | `ridere` | `form-gloss` | `singolare` |
| 112934 | `piango` | verb | 0 | 1ª persona singolare del presente semplice indicativo di piangere | `piangere` | `form-gloss` | `singolare` |
| 112935 | `stringo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di stringere | `stringere` | `form-gloss` | `singolare` |
| 112938 | `perdo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di perdere | `perdere` | `form-gloss` | `singolare` |
| 112941 | `elevo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di elevare | `elevare` | `form-gloss` | `singolare` |
| 112942 | `rompo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di rompere | `rompere` | `form-gloss` | `singolare` |
| 112943 | `rubo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di rubare | `rubare` | `form-gloss` | `singolare` |
| 112948 | `sfrego` | verb | 0 | 1ª persona singolare del presente semplice indicativo di sfregare | `sfregare` | `form-gloss` | `singolare` |
| 112949 | `strego` | verb | 0 | 1ª persona singolare del presente semplice indicativo di stregare | `stregare` | `form-gloss` | `singolare` |
| 112951 | `uccido` | verb | 0 | 1ª persona singolare del presente semplice indicativo di uccidere | `uccidere` | `form-gloss` | `singolare` |
| 112954 | `sfoglio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di sfogliare | `sfogliare` | `form-gloss` | `singolare` |
| 112955 | `corro` | verb | 0 | 1ª persona singolare del presente semplice indicativo di correre | `correre` | `form-gloss` | `singolare` |
| 112958 | `agisco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di agire | `agire` | `form-gloss` | `singolare` |
| 112959 | `aziono` | verb | 0 | 1ª persona singolare del presente semplice indicativo di azionare | `azionare` | `form-gloss` | `singolare` |
| 112960 | `elargisco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di elargire | `elargire` | `form-gloss` | `singolare` |
| 113028 | `facciate` | verb | 0 | 2ª persona plurale del congiuntivo presente di fare | `fare` | `form-gloss` | `plurale` |
| 113081 | `vitalizi` | adj | 0 | pluraledi vitalizia | `vitalizia` | `form-gloss` | `pluraledi` |
| 113136 | `particelle` | noun | 1 | quantità infinitesimali | `infinitesimali` | `form-gloss` | `infinitesimali` |
| 113233 | `abbracciante` | verb | 0 | participio presente del verbo abbracciare | `abbracciare` | `form-gloss` | `participio` |
| 113395 | `costituite` | verb | 0 | participio passato (plurale femminile) di costituire | `costituire` | `form-gloss` | `participio` |
| 113632 | `ovatta` | verb | 0 | terza persona singolare presente indicativo del verbo ovattare | `ovattare` | `form-gloss` | `singolare` |
| 113632 | `ovatta` | verb | 1 | seconda persona singolare imperativo del verbo ovattare | `ovattare` | `form-gloss` | `singolare` |
| 113671 | `pennello` | verb | 0 | 1ª persona singolare del presente semplice indicativo di pennellare | `pennellare` | `form-gloss` | `singolare` |
| 113674 | `lancia` | verb | 0 | terza persona singolare indicativo presente del verbo lanciare | `lanciare` | `form-gloss` | `singolare` |
| 113674 | `lancia` | verb | 1 | seconda persona singolare imperativo del verbo lanciare | `lanciare` | `form-gloss` | `singolare` |
| 113754 | `stocco` | verb | 0 | prima persona singolare del verbo stoccare | `stoccare` | `form-gloss` | `singolare` |
| 113990 | `mangi` | verb | 0 | 2ª persona singolare del presente semplice indicativo di mangiare | `mangiare` | `form-gloss` | `singolare` |
| 113992 | `mangiamo` | verb | 0 | 1ª persona plurale del presente semplice indicativo di mangiare | `mangiare` | `form-gloss` | `plurale` |
| 113993 | `mangiano` | verb | 0 | 3ª persona plurale del presente semplice indicativo di mangiare | `mangiare` | `form-gloss` | `plurale` |
| 113997 | `mangiavo` | verb | 0 | 1ª persona singolare dell'imperfetto semplice indicativo di mangiare | `mangiare` | `form-gloss` | `singolare` |
| 113998 | `mangiavi` | verb | 0 | 2ª persona singolare dell'imperfetto semplice indicativo di mangiare | `mangiare` | `form-gloss` | `singolare` |
| 113999 | `mangiava` | verb | 0 | 3ª persona singolare dell'imperfetto semplice indicativo di mangiare | `mangiare` | `form-gloss` | `singolare` |
| 114000 | `mangiavamo` | verb | 0 | 1ª persona plurale dell'imperfetto semplice indicativo di mangiare | `mangiare` | `form-gloss` | `plurale` |
| 114001 | `mangiavate` | verb | 0 | 2ª persona plurale dell'imperfetto semplice indicativo di mangiare | `mangiare` | `form-gloss` | `plurale` |
| 114002 | `mangiavano` | verb | 0 | 3ª persona plurale dell'imperfetto semplice indicativo di mangiare | `mangiare` | `form-gloss` | `plurale` |
| 114200 | `magrissimo` | adj | 0 | superlativo assoluto, maschile singolare di magro | `magro` | `form-gloss` | `superlativo` |
| 114202 | `magrissimi` | adj | 0 | superlativo assoluto, maschile plurale di magro | `magro` | `form-gloss` | `superlativo` |
| 114203 | `magrissima` | adj | 0 | superlativo assoluto, femminile singolare di magro | `magro` | `form-gloss` | `superlativo` |
| 114204 | `magrissime` | adj | 0 | superlativo assoluto, femminile plurale di magro | `magro` | `form-gloss` | `superlativo` |
| 114205 | `bruttissimo` | adj | 0 | superlativo assoluto, maschile singolare di brutto | `brutto` | `form-gloss` | `superlativo` |
| 114206 | `bruttissimi` | adj | 0 | superlativo assoluto, maschile plurale di brutto | `brutto` | `form-gloss` | `superlativo` |
| 114207 | `bruttissima` | adj | 0 | superlativo assoluto, femminile singolare di brutto | `brutto` | `form-gloss` | `superlativo` |
| 114208 | `bruttissime` | adj | 0 | superlativo assoluto, femminile plurale di brutto | `brutto` | `form-gloss` | `superlativo` |
| 114209 | `pigrissimo` | adj | 0 | superlativo assoluto,maschile singolare di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114210 | `pigrissimi` | adj | 0 | superlativo assoluto,maschile plurale di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114211 | `pigrissima` | adj | 0 | superlativo assoluto, femminile singolare di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114212 | `pigrissime` | adj | 0 | superlativo assoluto, femminile plurale di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114213 | `pigerrimo` | adj | 0 | superlativo assoluto, maschile singolare di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114214 | `pigerrimi` | adj | 0 | superlativo assoluto, maschile plurale di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114215 | `pigerrima` | adj | 0 | superlativo assoluto, femminile singolare di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114216 | `pigerrime` | adj | 0 | superlativo assoluto, femminile plurale di pigro | `pigro` | `form-gloss` | `superlativo` |
| 114620 | `spinaci` | noun | 1 | foglie di spinacio, utilizzate come cibo | `spinacio` | `names-base` |  |
| 115032 | `concupiscente` | verb | 0 | participio presente singolare del verbo concupiscere | `concupiscere` | `form-gloss` | `participio` |
| 115073 | `prendeva` | verb | 0 | 3° persona singolare dell'imperfetto semplice indicativo di prendere | `prendere` | `form-gloss` | `singolare` |
| 115559 | `ciarmato` | verb | 0 | participio passato del verbo ciarmare | `ciarmare` | `form-gloss` | `participio` |
| 116370 | `umillimo` | adj | 0 | superlativo assoluto, maschile singolare di umile | `umile` | `form-gloss` | `superlativo` |
| 116683 | `smaliziato` | verb | 0 | participio passato maschile singiolare di smaliziare | `smaliziare` | `form-gloss` | `participio` |
| 117077 | `ditino` | noun | 0 | diminutivo di dito | `dito` | `form-gloss` | `diminutivo` |
| 117171 | `atletesse` | noun | 0 | variante di atlete, femminile plurale di atleta | `atleta` | `form-gloss` | `variante` |
| 118198 | `vicepresidi` | noun | 0 | plurale maschile e femminile di vicepreside | `vicepreside` | `form-gloss` | `plurale` |
| 118307 | `cosi` | verb | 0 | indicativo presente, seconda persona singolare di cosare | `cosare` | `form-gloss` | `indicativo` |
| 118307 | `cosi` | verb | 1 | congiuntivo presente, prima persona singolare di cosare | `cosare` | `form-gloss` | `congiuntivo` |
| 118307 | `cosi` | verb | 2 | congiuntivo presente, seconda persona singolare di cosare | `cosare` | `form-gloss` | `congiuntivo` |
| 118307 | `cosi` | verb | 3 | congiuntivo presente, terza persona singolare di cosare | `cosare` | `form-gloss` | `congiuntivo` |
| 118307 | `cosi` | verb | 4 | imperativo presente, terza persona singolare di cosare | `cosare` | `form-gloss` | `imperativo` |
| 118836 | `siamo` | verb | 1 | prima persona plurale dell'imperativo del verbo essere | `essere` | `form-gloss` | `plurale` |
| 118837 | `scrivo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di scrivere | `scrivere` | `form-gloss` | `singolare` |
| 118839 | `scrive` | verb | 0 | 3ª persona singolare del presente semplice indicativo di scrivere | `scrivere` | `form-gloss` | `singolare` |
| 118842 | `scrivono` | verb | 0 | 3ª persona plurale del presente semplice indicativo di scrivere | `scrivere` | `form-gloss` | `plurale` |
| 118845 | `balliamo` | verb | 0 | 1ª persona plurale del presente semplice indicativo di ballare | `ballare` | `form-gloss` | `plurale` |
| 118847 | `ballate` | verb | 0 | 2ª persona plurale del presente semplice indicativo di ballare | `ballare` | `form-gloss` | `plurale` |
| 118848 | `ballano` | verb | 0 | 3ª persona plurale del presente semplice indicativo di ballare | `ballare` | `form-gloss` | `plurale` |
| 118981 | `campane` | adj | 0 | plurale femminmile di campano | `campano` | `form-gloss` | `plurale` |
| 119014 | `trovo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di trovare | `trovare` | `form-gloss` | `singolare` |
| 119015 | `offro` | verb | 0 | 1ª persona singolare del presente semplice indicativo di offrire | `offrire` | `form-gloss` | `singolare` |
| 119018 | `sento` | verb | 0 | 1ª persona singolare del presente semplice indicativo di sentire | `sentire` | `form-gloss` | `singolare` |
| 119023 | `scaldo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di scaldare | `scaldare` | `form-gloss` | `singolare` |
| 119026 | `ficco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ficcare | `ficcare` | `form-gloss` | `singolare` |
| 119027 | `suco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di sucare | `sucare` | `form-gloss` | `singolare` |
| 119028 | `fingo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di fingere | `fingere` | `form-gloss` | `singolare` |
| 119029 | `gesticolo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di gesticolare | `gesticolare` | `form-gloss` | `singolare` |
| 119030 | `finisco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di finire | `finire` | `form-gloss` | `singolare` |
| 119031 | `termino` | verb | 0 | prima persona singolare del'indicativo presente di terminare | `terminare` | `form-gloss` | `singolare` |
| 119037 | `amplio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ampliare | `ampliare` | `form-gloss` | `singolare` |
| 119038 | `gradisco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di gradire | `gradire` | `form-gloss` | `singolare` |
| 119041 | `brindo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di brindare | `brindare` | `form-gloss` | `singolare` |
| 119042 | `ingesso` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ingessare | `ingessare` | `form-gloss` | `singolare` |
| 119043 | `drizzo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di drizzare | `drizzare` | `form-gloss` | `singolare` |
| 119044 | `traggo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di trarre | `trarre` | `form-gloss` | `singolare` |
| 119045 | `fremo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di fremere | `fremere` | `form-gloss` | `singolare` |
| 119049 | `tramo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di tramare | `tramare` | `form-gloss` | `singolare` |
| 119050 | `ammacco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ammaccare | `ammaccare` | `form-gloss` | `singolare` |
| 119051 | `accendo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di accendere | `accendere` | `form-gloss` | `singolare` |
| 119053 | `sbatto` | verb | 0 | 1ª persona singolare del presente semplice indicativo di sbattere | `sbattere` | `form-gloss` | `singolare` |
| 119056 | `accompagno` | verb | 0 | 1ª persona singolare del presente semplice indicativo di accompagnare | `accompagnare` | `form-gloss` | `singolare` |
| 119058 | `spingo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di spingere | `spingere` | `form-gloss` | `singolare` |
| 119059 | `estendo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di estendere | `estendere` | `form-gloss` | `singolare` |
| 119060 | `sottraggo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di sottrarre | `sottrarre` | `form-gloss` | `singolare` |
| 119063 | `chiudo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di chiudere | `chiudere` | `form-gloss` | `singolare` |
| 119064 | `ruoto` | verb | 0 | 1ª persona singolare del presente semplice indicativo di ruotare | `ruotare` | `form-gloss` | `singolare` |
| 119068 | `brucio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di bruciare | `bruciare` | `form-gloss` | `singolare` |
| 119082 | `infliggo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di infliggere | `infliggere` | `form-gloss` | `singolare` |
| 119083 | `spio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di spiare | `spiare` | `form-gloss` | `singolare` |
| 119084 | `divido` | verb | 0 | 1ª persona singolare dell'indicativo presente di dividere | `dividere` | `form-gloss` | `singolare` |
| 119086 | `accolgo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di accogliere | `accogliere` | `form-gloss` | `singolare` |
| 119087 | `colgo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di cogliere | `cogliere` | `form-gloss` | `singolare` |
| 119088 | `stupisco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di stupire | `stupire` | `form-gloss` | `singolare` |
| 119115 | `sorrido` | verb | 0 | 1ª persona singolare del presente semplice indicativo di sorridere | `sorridere` | `form-gloss` | `singolare` |
| 119116 | `afferro` | verb | 0 | 1ª persona singolare del presente semplice indicativo di afferrare | `afferrare` | `form-gloss` | `singolare` |
| 119118 | `giungo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di giungere | `giungere` | `form-gloss` | `singolare` |
| 119119 | `infilzo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di infilzare | `infilzare` | `form-gloss` | `singolare` |
| 119120 | `annoio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di annoiare | `annoiare` | `form-gloss` | `singolare` |
| 119121 | `forzo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di forzare | `forzare` | `form-gloss` | `singolare` |
| 119122 | `querelo` | verb | 0 | 1ª persona singolare del presente semplice indicativo di querelare | `querelare` | `form-gloss` | `singolare` |
| 119123 | `tossisco` | verb | 0 | 1ª persona singolare del presente semplice indicativo di tossire | `tossire` | `form-gloss` | `singolare` |
| 119126 | `fortifico` | verb | 0 | 1ª persona singolare del presente semplice indicativo di fortificare | `fortificare` | `form-gloss` | `singolare` |
| 119127 | `posso` | verb | 0 | 1ª persona singolare del presente semplice indicativo di potere | `potere` | `form-gloss` | `singolare` |
| 119129 | `cancello` | verb | 0 | 1ª persona singolare del presente semplice indicativo di cancellare | `cancellare` | `form-gloss` | `singolare` |
| 119138 | `voleva` | verb | 0 | 3ª persona singolare del l'imperfetto indicativo di volere | `volere` | `form-gloss` | `singolare` |
| 119183 | `agilissimo` | adj | 0 | superlativo assoluto, maschile singolare di agile | `agile` | `form-gloss` | `superlativo` |
| 119184 | `agilissima` | adj | 0 | superlativo assoluto, femminile singolare di agile | `agile` | `form-gloss` | `superlativo` |
| 119185 | `agilissime` | adj | 0 | superlativo assoluto, femminile plurale di agile | `agile` | `form-gloss` | `superlativo` |
| 119186 | `agilissimi` | adj | 0 | superlativo assoluto, maschile plurale di agile | `agile` | `form-gloss` | `superlativo` |
| 119380 | `integerrimi` | adj | 0 | superlativo assoluto, maschile plurale di integro | `integro` | `form-gloss` | `superlativo` |
| 119381 | `integerrima` | adj | 0 | superlativo assoluto, femminile singolare di integro | `integro` | `form-gloss` | `superlativo` |
| 119382 | `integerrime` | adj | 0 | superlativo assoluto, femminile plurale di integro | `integro` | `form-gloss` | `superlativo` |
| 119693 | `trita` | adj | 0 | femminile dim trito | `trito` | `form-gloss` | `femminile` |
| 119756 | `enimmistiche` | adj | 0 | variante di enigmistiche | `enigmistiche` | `form-gloss` | `variante` |
| 119757 | `enimmistiche` | noun | 0 | variante di enigmistiche | `enigmistiche` | `form-gloss` | `variante` |
| 119758 | `enimmistica` | adj | 0 | variante di enigmistica | `enigmistica` | `form-gloss` | `variante` |
| 119759 | `enimmistica` | noun | 0 | variante di enigmistica | `enigmistica` | `form-gloss` | `variante` |
| 119760 | `enimmistici` | adj | 0 | variante di enigmistici | `enigmistici` | `form-gloss` | `variante` |
| 119763 | `enimmi` | noun | 0 | variante di enigmi | `enigmi` | `form-gloss` | `variante` |
| 119772 | `scopi` | verb | 0 | 2ª persona singolare del presente semplice indicativo di scopare | `scopare` | `form-gloss` | `singolare` |
| 119772 | `scopi` | verb | 1 | 1ª persona singolare del presente semplice congiuntivo di scopare | `scopare` | `form-gloss` | `singolare` |
| 119772 | `scopi` | verb | 2 | 2ª persona singolare del presente semplice congiuntivo di scopare | `scopare` | `form-gloss` | `singolare` |
| 119772 | `scopi` | verb | 3 | 3ª persona singolare del presente semplice congiuntivo di scopare | `scopare` | `form-gloss` | `singolare` |
| 120013 | `glissando` | verb | 0 | gerundio presente del verbo glissare | `glissare` | `form-gloss` | `gerundio` |
| 120500 | `froda` | verb | 0 | 3ª persona singolare del presente semplice indicativo di frodare | `frodare` | `form-gloss` | `singolare` |
| 120500 | `froda` | verb | 1 | 2ª persona singolare del presente imperativo di frodare | `frodare` | `form-gloss` | `singolare` |
| 120733 | `avrai` | verb | 0 | seconda persona singolare indicativo futuro semplice del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120734 | `avrà` | verb | 0 | terza persona singolare indicativo futuro semplice del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120735 | `avremo` | verb | 0 | prima persona plurale indicativo futuro semplice del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120736 | `avrete` | verb | 0 | seconda persona plurale indicativo futuro semplice del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120737 | `avranno` | verb | 0 | terza persona plurale indicativo futuro semplice del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120738 | `avente` | verb | 0 | participio presente del verbo avere | `avere` | `form-gloss` | `participio` |
| 120739 | `avrei` | verb | 0 | prima persona singolare condizionale presente del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120740 | `avresti` | verb | 0 | seconda persona singolare condizionale presente del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120742 | `avremmo` | verb | 0 | prima persona plurale condizionale presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120743 | `avreste` | verb | 0 | seconda persona plurale condizionale presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120744 | `avrebbero` | verb | 0 | terza persona plurale condizionale presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120745 | `abbia` | verb | 0 | prima persona singolare congiuntivo presente del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120745 | `abbia` | verb | 1 | seconda persona singolare congiuntivo presente del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120745 | `abbia` | verb | 2 | terza persona singolare congiuntivo presente del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120745 | `abbia` | verb | 3 | terza persona singolare imperativo presente del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120746 | `abbiate` | verb | 0 | seconda persona plurale congiuntivo presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120746 | `abbiate` | verb | 1 | seconda persona plurale imperativo presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120747 | `abbiano` | verb | 0 | terza persona plurale congiuntivo presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120747 | `abbiano` | verb | 1 | terza persona plurale imperativo presente del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120748 | `avessi` | verb | 0 | prima persona singolare congiuntivo imperfetto del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120748 | `avessi` | verb | 1 | seconda persona singolare congiuntivo imperfetto del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120749 | `avesse` | verb | 0 | terza persona singolare congiuntivo imperfetto del verbo avere | `avere` | `form-gloss` | `singolare` |
| 120750 | `avessimo` | verb | 0 | prima persona plurale congiuntivo imperfetto del verbo avere | `avere` | `form-gloss` | `plurale` |
| 120751 | `avessero` | verb | 0 | terza persona plurale congiuntivo imperfetto del verbo avere | `avere` | `form-gloss` | `plurale` |
| 121016 | `tango` | verb | 0 | indicativo presente, prima persona singolare di tangere | `tangere` | `form-gloss` | `indicativo` |
| 121180 | `pusillanimo` | adj | 0 | variante di pusillanime | `pusillanime` | `form-gloss` | `variante` |
| 121181 | `pusillanimo` | noun | 0 | variante di pusillanime | `pusillanime` | `form-gloss` | `variante` |
| 121583 | `egizie` | noun | 0 | femmnile plurale di egizio | `egizio` | `form-gloss` | `femmnile` |
| 121719 | `passivo` | verb | 0 | 1ª persona singolare indicativo presente di passivare | `passivare` | `form-gloss` | `singolare` |
| 121719 | `passivo` | verb | 1 | 1ª persona singolare indicativo imperfetto di passire | `passire` | `form-gloss` | `singolare` |
| 121721 | `passiva` | verb | 0 | indicativo presente, terza persona singolare di passivare | `passivare` | `form-gloss` | `indicativo` |
| 121721 | `passiva` | verb | 1 | imperativo presente, seconda persona singolare di passivare | `passivare` | `form-gloss` | `imperativo` |
| 121721 | `passiva` | verb | 2 | indicativo imperfetto, terza persona singolare di passire | `passire` | `form-gloss` | `indicativo` |
| 121724 | `passivi` | verb | 0 | indicativo presente, seconda persona singolare di passivare | `passivare` | `form-gloss` | `indicativo` |
| 121724 | `passivi` | verb | 1 | congiuntivo presente, prima persona singolare di passivare | `passivare` | `form-gloss` | `congiuntivo` |
| 121724 | `passivi` | verb | 2 | congiuntivo presente, seconda persona singolare di passivare | `passivare` | `form-gloss` | `congiuntivo` |
| 121724 | `passivi` | verb | 3 | congiuntivo presente, terza persona singolare di passivare | `passivare` | `form-gloss` | `congiuntivo` |
| 121724 | `passivi` | verb | 4 | imperativo presente, terza persona singolare di passivare | `passivare` | `form-gloss` | `imperativo` |
| 121724 | `passivi` | verb | 5 | indicativo imperfetto, seconda persona singolare di passire | `passire` | `form-gloss` | `indicativo` |
| 121786 | `operi` | verb | 0 | indicativo presente, seconda persona singolare di operare | `operare` | `form-gloss` | `indicativo` |
| 121786 | `operi` | verb | 1 | congiuntivo presente, prima persona singolare di operare | `operare` | `form-gloss` | `congiuntivo` |
| 121786 | `operi` | verb | 2 | congiuntivo presente, seconda persona singolare di operare | `operare` | `form-gloss` | `congiuntivo` |
| 121786 | `operi` | verb | 3 | congiuntivo presente, terza persona singolare di operare | `operare` | `form-gloss` | `congiuntivo` |
| 121786 | `operi` | verb | 4 | imperativo presente, terza persona singolare di operare | `operare` | `form-gloss` | `imperativo` |
| 121815 | `elettrotecnica` | noun | 0 | forma femminile di elettrotecnico | `elettrotecnico` | `form-gloss` | `forma` |
| 121958 | `paragrafo` | verb | 0 | indicativo presente, prima persona singolare di paragrafare | `paragrafare` | `form-gloss` | `indicativo` |
| 121960 | `paragrafi` | verb | 0 | indicativo presente, seconda persona singolare di paragrafare | `paragrafare` | `form-gloss` | `indicativo` |
| 121960 | `paragrafi` | verb | 1 | congiuntivo presente, prima persona singolare di paragrafare | `paragrafare` | `form-gloss` | `congiuntivo` |
| 121960 | `paragrafi` | verb | 2 | congiuntivo presente, seconda persona singolare di paragrafare | `paragrafare` | `form-gloss` | `congiuntivo` |
| 121960 | `paragrafi` | verb | 3 | congiuntivo presente, terza persona singolare di paragrafare | `paragrafare` | `form-gloss` | `congiuntivo` |
| 121960 | `paragrafi` | verb | 4 | imperativo presente, terza persona singolare di paragrafare | `paragrafare` | `form-gloss` | `imperativo` |
| 122688 | `arbitra` | verb | 0 | indicativo presente, terza persona singolare del verbo arbitrare | `arbitrare` | `form-gloss` | `indicativo` |
| 122688 | `arbitra` | verb | 1 | imperativo presente, seconda persona singolare del verbo arbitrare | `arbitrare` | `form-gloss` | `imperativo` |
| 122690 | `arbitri` | verb | 2 | seconda persona singolare del congiuntivo presente, di arbitrare | `arbitrare` | `form-gloss` | `singolare` |
| 122696 | `arbitrato` | verb | 0 | participio passato del verbo arbitrare | `arbitrare` | `form-gloss` | `participio` |
| 122699 | `salvadoregne` | adj | 0 | femmilile plurale di salvadoregno | `salvadoregno` | `form-gloss` | `femmilile` |
| 123387 | `calzato` | verb | 0 | participio passato del verbo calzare | `calzare` | `form-gloss` | `participio` |
| 123689 | `sacerdotessa` | noun | 1 | oltre agli stessi significati di sacerdote, nel senso di persona che si dedica intensamente a un'attività, si usa dire: | `sacerdote` | `names-base` |  |
| 123790 | `concordanze` | noun | 0 | elenco alfabetico delle parole (c verbali) o dei temi che ricorrono (c reali) in un'opera o in un autore; di solito comprende un breve contesto con l'indicazione dei luoghi in cui compare ogni parola | `luoghi` | `form-gloss` | `verbali` |
| 124106 | `accantonato` | verb | 0 | participio passato accantonare | `accantonare` | `form-gloss` | `participio` |
| 124206 | `schiatta` | verb | 0 | terza persona singolare del presente indicativo del verbo schiattare | `schiattare` | `form-gloss` | `singolare` |
| 124206 | `schiatta` | verb | 1 | seconda persona singolare dell'imperativo del verbo schiattare. | `schiattare` | `form-gloss` | `singolare` |
| 124250 | `zigrinati` | verb | 0 | participio passato, maschile plurale di zigrinare | `zigrinare` | `form-gloss` | `participio` |
| 124252 | `zigrinata` | verb | 0 | participio passato, femminile singolare di zigrinare | `zigrinare` | `form-gloss` | `participio` |
| 124254 | `zigrinate` | verb | 0 | participio passato, femminile plurale di zigrinare | `zigrinare` | `form-gloss` | `participio` |
| 125228 | `arrivammo` | verb | 0 | voce del verbo arrivare, 1ª coniugazione, modo indicativo, tempo passato remoto, 2ª persona plurale | `arrivare` | `form-gloss` | `verbo` |
| 125349 | `merlato` | verb | 0 | paricipio passato di merlare | `merlare` | `form-gloss` | `paricipio` |
| 125391 | `rottami` | verb | 1 | prima persona singolare del congiuntivo presente,di rottamare | `rottamare` | `form-gloss` | `singolare` |
| 125393 | `coniata` | verb | 0 | participio passato, femminile singolare di coniare | `coniare` | `form-gloss` | `participio` |
| 125495 | `atrabiliari` | adj | 0 | maschile e femminile plurale di atrabiliare | `atrabiliare` | `form-gloss` | `maschile` |
| 125537 | `varî` | adj | 0 | variante di vari (maschile plurale di vario) | `vario` | `form-gloss` | `variante` |
| 125880 | `lamba` | verb | 0 | congiuntivo presente, prima persona singolare di lambere | `lambere` | `form-gloss` | `congiuntivo` |
| 125880 | `lamba` | verb | 1 | congiuntivo presente, seconda persona singolare di lambere | `lambere` | `form-gloss` | `congiuntivo` |
| 125880 | `lamba` | verb | 2 | congiuntivo presente, terza persona singolare di lambere | `lambere` | `form-gloss` | `congiuntivo` |
| 125880 | `lamba` | verb | 3 | imperativo presente, terza persona singolare di lambere | `lambere` | `form-gloss` | `imperativo` |
| 125897 | `facente` | verb | 0 | participio presente maschile e femminile singolare di fare | `fare` | `form-gloss` | `participio` |
| 126025 | `disarmato` | verb | 0 | participio passato, maschile singolare di disarmare | `disarmare` | `form-gloss` | `participio` |
| 126297 | `agevola` | verb | 0 | indicativo presente, terza persona singolare di agevolare | `agevolare` | `form-gloss` | `indicativo` |
| 126297 | `agevola` | verb | 1 | imperativo presente, seconda persona singolare di agevolare | `agevolare` | `form-gloss` | `imperativo` |
| 127291 | `celeberrimi` | adj | 0 | superlativo assoluto, maschile plurale di celebre | `celebre` | `form-gloss` | `superlativo` |
| 127292 | `celeberrime` | adj | 0 | superlativo assoluto, femminile plurale di celebre | `celebre` | `form-gloss` | `superlativo` |
| 127293 | `celeberrima` | adj | 0 | superlativo assoluto, femminile singolare di celebre | `celebre` | `form-gloss` | `superlativo` |
| 127297 | `sacerrime` | adj | 0 | superlativo assoluto, femminile plurale di sacro | `sacro` | `form-gloss` | `superlativo` |
| 127298 | `sacerrima` | adj | 0 | superlativo assoluto, femminile sing di sacro | `sacro` | `form-gloss` | `superlativo` |
| 127299 | `sacerrimo` | adj | 0 | superlativo assoluto, maschile sing di sacro | `sacro` | `form-gloss` | `superlativo` |
| 127300 | `sacerrimi` | adj | 0 | superlativo assoluto, maschile plurale di sacro | `sacro` | `form-gloss` | `superlativo` |
| 127302 | `benedicentissimo` | adj | 0 | superlativo assoluto, maschile singolare di benedicente | `benedicente` | `form-gloss` | `superlativo` |
| 127302 | `benedicentissimo` | adj | 1 | superlativo assoluto, maschile singolare di benedico | `benedico` | `form-gloss` | `superlativo` |
| 127348 | `benevolentissimo` | adj | 0 | superlativo assoluto, maschile singolare di benevolo | `benevolo` | `form-gloss` | `superlativo` |
| 127348 | `benevolentissimo` | adj | 1 | superlativo assoluto, maschile singolare di benevolente | `benevolente` | `form-gloss` | `superlativo` |
| 127349 | `benevolentissimi` | adj | 0 | superlativo assoluto, maschile plurale di benevolo | `benevolo` | `form-gloss` | `superlativo` |
| 127349 | `benevolentissimi` | adj | 1 | superlativo assoluto, maschile plurale di benevolente | `benevolente` | `form-gloss` | `superlativo` |
| 127350 | `benevolentissime` | adj | 0 | superlativo assoluto, femminile plurale di benevolo | `benevolo` | `form-gloss` | `superlativo` |
| 127350 | `benevolentissime` | adj | 1 | superlativo assoluto, femminile plurale di benevolente | `benevolente` | `form-gloss` | `superlativo` |
| 127351 | `benevolentissima` | adj | 0 | superlativo assoluto, femminile singolare di benevolo | `benevolo` | `form-gloss` | `superlativo` |
| 127351 | `benevolentissima` | adj | 1 | superlativo assoluto, femminile singolare di benevolente | `benevolente` | `form-gloss` | `superlativo` |
| 127352 | `beneficentissimo` | adj | 0 | superlativo assoluto, maschile singolare di benefico | `benefico` | `form-gloss` | `superlativo` |
| 127352 | `beneficentissimo` | adj | 1 | superlativo assoluto, maschile singolare di beneficente | `beneficente` | `form-gloss` | `superlativo` |
| 127353 | `beneficentissimi` | adj | 0 | superlativo assoluto, maschile plurale di benefico | `benefico` | `form-gloss` | `superlativo` |
| 127353 | `beneficentissimi` | adj | 1 | superlativo assoluto, maschile plurale di beneficente | `beneficente` | `form-gloss` | `superlativo` |
| 127354 | `beneficentissime` | adj | 0 | superlativo assoluto, femminile plurale di benefico | `benefico` | `form-gloss` | `superlativo` |
| 127354 | `beneficentissime` | adj | 1 | superlativo assoluto, femminile plurale di beneficente | `beneficente` | `form-gloss` | `superlativo` |
| 127355 | `beneficentissima` | adj | 0 | superlativo assoluto, femminile singolare di benefico | `benefico` | `form-gloss` | `superlativo` |
| 127355 | `beneficentissima` | adj | 1 | superlativo assoluto, femminile singolare di beneficente | `beneficente` | `form-gloss` | `superlativo` |
| 127356 | `benedicentissimi` | adj | 0 | superlativo assoluto, maschile plurale di benedicente | `benedicente` | `form-gloss` | `superlativo` |
| 127356 | `benedicentissimi` | adj | 1 | superlativo assoluto, maschile plurale di benedico | `benedico` | `form-gloss` | `superlativo` |
| 127357 | `benedicentissime` | adj | 0 | superlativo assoluto, femminile plurale di benedicente | `benedicente` | `form-gloss` | `superlativo` |
| 127357 | `benedicentissime` | adj | 1 | superlativo assoluto, femminile plurale di benedico | `benedico` | `form-gloss` | `superlativo` |
| 127358 | `benedicentissima` | adj | 0 | superlativo assoluto, femminile singolare di benedicente | `benedicente` | `form-gloss` | `superlativo` |
| 127358 | `benedicentissima` | adj | 1 | superlativo assoluto, femminile singolare di benedico | `benedico` | `form-gloss` | `superlativo` |
| 127362 | `magnificentissimo` | adj | 0 | superlativo assoluto, maschile singolare di magnificente | `magnificente` | `form-gloss` | `superlativo` |
| 127362 | `magnificentissimo` | adj | 1 | superlativo assoluto, maschile singolare di magnifico | `magnifico` | `form-gloss` | `superlativo` |
| 127363 | `magnificentissimi` | adj | 0 | superlativo assoluto, maschile plurale di magnificente | `magnificente` | `form-gloss` | `superlativo` |
| 127363 | `magnificentissimi` | adj | 1 | superlativo assoluto, maschile plurale di magnifico | `magnifico` | `form-gloss` | `superlativo` |
| 127364 | `magnificentissime` | adj | 0 | superlativo assoluto, femminile plurale di magnificente | `magnificente` | `form-gloss` | `superlativo` |
| 127364 | `magnificentissime` | adj | 1 | superlativo assoluto, femminile plurale di magnifico | `magnifico` | `form-gloss` | `superlativo` |
| 127365 | `magnificentissima` | adj | 0 | superlativo assoluto, femminile singolare di magnificente | `magnificente` | `form-gloss` | `superlativo` |
| 127365 | `magnificentissima` | adj | 1 | superlativo assoluto, femminile singolare di magnifico | `magnifico` | `form-gloss` | `superlativo` |
| 127635 | `massimi` | adj | 0 | superlativo assoluto, maschile plurale di grande | `grande` | `form-gloss` | `superlativo` |
| 128340 | `elisa` | adj | 1 | variante di elisia, femminile singolare di elisio | `elisio` | `form-gloss` | `variante` |
| 129708 | `disuso` | verb | 0 | prima persona singolare del presente indicativo del verbo disusare | `disusare` | `form-gloss` | `singolare` |
| 131260 | `resta` | verb | 0 | terza persona singolare indicativo presente del verbo restare | `restare` | `form-gloss` | `singolare` |
| 131260 | `resta` | verb | 1 | seconda persona singolare imperativo del verbo restare | `restare` | `form-gloss` | `singolare` |
| 132128 | `ombrellino` | noun | 0 | diminutivo di ombrello | `ombrello` | `form-gloss` | `diminutivo` |
| 134365 | `carezza` | verb | 1 | seconda persona singolare dell'imperativo presente carezzare | `carezzare` | `form-gloss` | `singolare` |
| 134460 | `comuni` | adj | 0 | maschile e femminile plurale di comune | `comune` | `form-gloss` | `maschile` |
| 134537 | `sgombero` | verb | 1 | participio passato sincopato di sgomberare | `sgomberare` | `form-gloss` | `participio` |
| 134584 | `riempio` | verb | 0 | 1ª persona singolare del presente semplice indicativo di riempire | `riempire` | `form-gloss` | `singolare` |
| 135415 | `bufala` | noun | 0 | femmina del bufalo | `bufalo` | `form-gloss` | `femmina` |
| 135548 | `stilosi` | adj | 0 | (dal gergo giovanile) plurale di stiloso | `stiloso` | `form-gloss` | `plurale` |
| 135550 | `stilose` | adj | 0 | (dal gergo giovanile) plurale femminile di stiloso | `stiloso` | `form-gloss` | `plurale` |
| 135551 | `stilosa` | adj | 0 | (dal gergo giovanile) femminile di stiloso | `stiloso` | `form-gloss` | `femminile` |
| 136374 | `obbediente` | verb | 0 | participio presente del verbo obbedire | `obbedire` | `form-gloss` | `participio` |
| 136625 | `essuto` | verb | 0 | forma antica del participio passato di essere, oggi disusata a favore di stato, participio del verbo stare | `stare` | `form-gloss` | `forma` |
| 136778 | `volpone` | noun | 0 | accrescitivo di volpe | `volpe` | `form-gloss` | `accrescitivo` |
| 136883 | `parata` | verb | 0 | \|participio passato femminile di parare | `parare` | `form-gloss` | `participio` |
| 136932 | `conquista` | verb | 1 | seconda persona singilare dell'imperativo presente di conquistare | `conquistare` | `form-gloss` | `singilare` |
| 137498 | `voglia` | verb | 0 | prima, seconda e terza persona singolare del congiuntivo presente di volere | `volere` | `form-gloss` | `singolare` |
| 137901 | `essa` | pron | 0 | forma flessa di esso | `esso` | `form-gloss` | `forma` |
| 138044 | `postina` | noun | 0 | forma flessa di postino | `postino` | `form-gloss` | `forma` |
| 138079 | `ciliegie` | noun | 0 | forma flessa di ciliegia | `ciliegia` | `form-gloss` | `forma` |
| 138094 | `parallele` | noun | 0 | forma flessa di parallela | `parallela` | `form-gloss` | `forma` |
| 138319 | `flagello` | verb | 0 | primna persona singolare dell'indicativo presente di flagellare | `flagellare` | `form-gloss` | `singolare` |
| 138770 | `ingoia` | verb | 1 | seconda persona singolare dell'imperativo del verbo ingoiare | `ingoiare` | `form-gloss` | `singolare` |
| 138953 | `attese` | noun | 0 | lurale di attesa | `attesa` | `form-gloss` | `lurale` |
| 139792 | `giubilo` | verb | 0 | prima persona singolare dell'indicativo presente do giubilare | `giubilare` | `form-gloss` | `singolare` |
| 139851 | `zarina` | noun | 1 | impropriamente utilizzato per riferirsi anche alla o alle figlie (femmine) dello zar di Russia; principessa di Russia | `Russia` | `form-gloss` | `femmine` |
| 140189 | `puzzolenti` | adj | 0 | plurale maschile e femminile di puzzolente | `puzzolente` | `form-gloss` | `plurale` |
| 140217 | `raffazzonato` | verb | 0 | participio passato maschile singolare del verbo raffazzonare | `raffazzonare` | `form-gloss` | `participio` |
| 140656 | `incentivo` | verb | 0 | prima persona singolare, presente indicativo di incentivare | `incentivare` | `form-gloss` | `singolare` |
| 145929 | `cessando` | verb | 0 | gerundio prsente di cessare | `cessare` | `form-gloss` | `gerundio` |
| 146762 | `emanarono` | verb | 0 | terza persona plurale del' passato remoto di emanare | `emanare` | `form-gloss` | `plurale` |
| 147289 | `gattona` | noun | 0 | accrescitvo di gatta | `gatta` | `form-gloss` | `accrescitvo` |
| 149596 | `lodate` | adj | 0 | femmoinile di lodato | `lodato` | `form-gloss` | `femmoinile` |
| 153052 | `spianando` | verb | 0 | gerundio presentee di spianare | `spianare` | `form-gloss` | `gerundio` |
| 160875 | `frustrata` | adj | 0 | femminiledi frustrato | `frustrato` | `form-gloss` | `femminiledi` |
| 173617 | `domino` | verb | 0 | prima persona singole dell'indicativo presente di dominare | `dominare` | `form-gloss` | `singole` |
| 174074 | `frantumate` | adj | 0 | femminile pluraòe di frantumato | `frantumato` | `form-gloss` | `femminile` |
| 189576 | `coniugando` | verb | 0 | gerundio presen te di coniugare | `coniugare` | `form-gloss` | `gerundio` |
| 193293 | `imbarchi` | noun | 0 | pluraledi sbarco | `sbarco` | `form-gloss` | `pluraledi` |
| 193627 | `segate` | adj | 0 | femmnile plurale di segato | `segato` | `form-gloss` | `femmnile` |
| 195727 | `mendica` | noun | 0 | femminile singolare (raro) di mendico | `mendico` | `form-gloss` | `femminile` |
| 196417 | `paghi` | noun | 0 | plurtale di pago | `pago` | `form-gloss` | `plurtale` |
| 196628 | `peccando` | verb | 0 | gerundio presente peccare | `peccare` | `form-gloss` | `gerundio` |
| 203450 | `truccata` | adj | 0 | femmminile di truccato | `truccato` | `form-gloss` | `femmminile` |
| 211864 | `privilegiata` | adj | 0 | femmmile di privilegiato | `privilegiato` | `form-gloss` | `femmmile` |
| 215371 | `belati` | noun | 0 | plurale belato | `belato` | `form-gloss` | `plurale` |
| 215855 | `suonata` | adj | 0 | fmminile di suonato | `suonato` | `form-gloss` | `fmminile` |
| 227660 | `guidata` | adj | 0 | femmminile di guidato | `guidato` | `form-gloss` | `femmminile` |
| 227780 | `trasportando` | verb | 0 | gerundio presemte di trasportare | `trasportare` | `form-gloss` | `gerundio` |
| 229593 | `derubate` | adj | 0 | femmimnile plurale di derubare | `derubare` | `form-gloss` | `femmimnile` |
| 229594 | `derubate` | adj | 0 | femmimnile plurale di derubare | `derubare` | `form-gloss` | `femmimnile` |
| 233254 | `intrappolando` | verb | 0 | gerundio prsentee di intrappolare | `intrappolare` | `form-gloss` | `gerundio` |
| 235980 | `attenta` | adj | 0 | che presta attenzione, femminile di attento | `attento` | `form-gloss` | `femminile` |
| 239556 | `raggruppate` | adj | 0 | femminile pluraale di raggruppato | `raggruppato` | `form-gloss` | `femminile` |
| 240316 | `caratterizzanti` | adj | 0 | lurale di caratterizzante | `caratterizzante` | `form-gloss` | `lurale` |
| 242169 | `banchetto` | noun | 0 | diminutivo di banco | `banco` | `form-gloss` | `diminutivo` |
| 243935 | `suddiviso` | verb | 0 | paricipio passato maschile singolare di suddividere | `suddividere` | `form-gloss` | `paricipio` |
| 247743 | `scimmiotto` | noun | 0 | diminutivo maschile di scimmia | `scimmia` | `form-gloss` | `diminutivo` |
| 249194 | `adeguando` | verb | 0 | gerundio predente di adeguare | `adeguare` | `form-gloss` | `gerundio` |
| 253606 | `manganelli` | noun | 0 | pliurale di manganello | `manganello` | `form-gloss` | `pliurale` |
| 254286 | `rosolando` | verb | 0 | gerundiopresente di rosolare | `rosolare` | `form-gloss` | `gerundiopresente` |
| 258499 | `schermando` | verb | 0 | gerundio presenre di schermare | `schermare` | `form-gloss` | `gerundio` |
| 264546 | `stigmatizzate` | adj | 0 | femmminile plurale di stigmatizzato | `stigmatizzato` | `form-gloss` | `femmminile` |
| 281338 | `contingenti` | adj | 0 | maschile e femminile plurale di contingente | `contingente` | `form-gloss` | `maschile` |
| 281339 | `contingenti` | noun | 0 | maschile e femminile plurale di contingente | `contingente` | `form-gloss` | `maschile` |
| 282686 | `soggettivi` | adj | 0 | pliurale di soggettivo | `soggettivo` | `form-gloss` | `pliurale` |
| 291956 | `sussidio` | verb | 0 | pria persona singolare dell'indicativo presente di sussidiare | `sussidiare` | `form-gloss` | `singolare` |
| 300226 | `etimologizzante` | verb | 0 | : participio presente di etimologizzare | `etimologizzare` | `form-gloss` | `participio` |
| 300228 | `etimologizzato` | verb | 0 | : participio passato di etimologizzare | `etimologizzare` | `form-gloss` | `participio` |
| 300233 | `etimologizzate` | verb | 0 | : participio passato di etimologizzare, caso femminile plurale; usato a volte anche come sostantivo (esempio le etimologizzate del verbo invocare sono 16, sottintendendo che ci si rifererisce a parole). | `sostantivo` | `form-gloss` | `participio` |
| 300233 | `etimologizzate` | verb | 3 | : seconda persona plurale dell'indicativo presente di etimologizzare | `etimologizzare` | `form-gloss` | `plurale` |
| 300233 | `etimologizzate` | verb | 4 | : seconda persona plurale dell'imperativo di etimologizzare | `etimologizzare` | `form-gloss` | `plurale` |
| 318225 | `pellegrina` | adj | 0 | femminie di pellegrino | `pellegrino` | `form-gloss` | `femminie` |
| 327900 | `vellutate` | verb | 1 | seconda persona plurale dell’indicativo presente di vellutare | `vellutare` | `form-gloss` | `plurale` |
| 327900 | `vellutate` | verb | 2 | seconda persona plurale dell’imperativo di vellutare | `vellutare` | `form-gloss` | `plurale` |
| 333326 | `laureate` | adj | 0 | femminlie plurale di laureato | `laureato` | `form-gloss` | `femminlie` |
| 336762 | `rosichi` | verb | 5 | quarta persona singolare dell'imperativo romano di rosicare | `rosicare` | `form-gloss` | `singolare` |
| 344840 | `rampicanti` | adj | 0 | maschile e femminile plurale di rampicante | `rampicante` | `form-gloss` | `maschile` |
| 346522 | `veleggiando` | verb | 0 | gerundio prsente di veleggiare | `veleggiare` | `form-gloss` | `gerundio` |
| 348507 | `crepa` | verb | 1 | seconda persona singolare dell'imperativo presente crepare | `crepare` | `form-gloss` | `singolare` |
| 351990 | `studiamo` | verb | 0 | 1ª persona plurale dell'indicativo presente di studiare | `studiare` | `form-gloss` | `plurale` |
| 351990 | `studiamo` | verb | 1 | 1ª persona plurale del congiuntivo presente di studiare | `studiare` | `form-gloss` | `plurale` |
| 351990 | `studiamo` | verb | 2 | 1ª persona plurale dell'imperativo di studiare | `studiare` | `form-gloss` | `plurale` |
| 351991 | `studiate` | verb | 0 | 2ª persona plurale dell'indicativo presente di studiare | `studiare` | `form-gloss` | `plurale` |
| 351991 | `studiate` | verb | 1 | 2ª persona plurale del congiuntivo presente di studiare | `studiare` | `form-gloss` | `plurale` |
| 351991 | `studiate` | verb | 2 | 2ª persona plurale dell'imperativo di studiare | `studiare` | `form-gloss` | `plurale` |
| 351992 | `studiano` | verb | 0 | 3ª persona plurale dell'indicativo presente di studiare | `studiare` | `form-gloss` | `plurale` |
| 352005 | `studierò` | verb | 0 | 1ª persona singolare dell'indicativo futuro di studiare | `studiare` | `form-gloss` | `singolare` |
| 352006 | `studierai` | verb | 0 | 2ª persona singolare dell'indicativo futuro di studiare | `studiare` | `form-gloss` | `singolare` |
| 352007 | `studierà` | verb | 0 | 3ª persona singolare dell'indicativo futuro di studiare | `studiare` | `form-gloss` | `singolare` |
| 352007 | `studierà` | verb | 1 | 2ª persona singolare dell'indicativo futuro di studiare | `studiare` | `form-gloss` | `singolare` |
| 352008 | `studieremo` | verb | 0 | 1ª persona plurale dell'indicativo futuro di studiare | `studiare` | `form-gloss` | `plurale` |
| 352009 | `studierete` | verb | 0 | 2ª persona plurale dell'indicativo futuro di studiare | `studiare` | `form-gloss` | `plurale` |
| 352010 | `studieranno` | verb | 0 | 3ª persona plurale dell'indicativo futuro di studiare | `studiare` | `form-gloss` | `plurale` |
| 352427 | `coniate` | adj | 0 | femminie plurale di coniato | `coniato` | `form-gloss` | `femminie` |
| 352530 | `concili` | noun | 0 | purale di concilio | `concilio` | `form-gloss` | `purale` |
| 352816 | `inebriata` | adj | 0 | femminmile di inebriato | `inebriato` | `form-gloss` | `femminmile` |
| 353377 | `imbrogliando` | verb | 0 | gerundio presentee di imbrogliare | `imbrogliare` | `form-gloss` | `gerundio` |
| 359344 | `scompigliati` | adj | 0 | pliurale di scompigliato | `scompigliato` | `form-gloss` | `pliurale` |
| 359354 | `scompigliate` | adj | 0 | femminile pluraòe di scompigliato | `scompigliato` | `form-gloss` | `femminile` |
| 367454 | `salariato` | verb | 0 | participio passato maschile singolaredi salariare | `salariare` | `form-gloss` | `participio` |
| 368133 | `spelacchiate` | adj | 0 | femminole plurale di spelacchiato | `spelacchiato` | `form-gloss` | `femminole` |
| 374971 | `tornita` | adj | 0 | femminilie di tornito | `tornito` | `form-gloss` | `femminilie` |
| 378895 | `prestabilite` | adj | 0 | femminile purale di prestabilito | `prestabilito` | `form-gloss` | `femminile` |
| 379593 | `allestita` | adj | 0 | femminole di allestito | `allestito` | `form-gloss` | `femminole` |
| 384343 | `proferendo` | verb | 0 | gerundio presennte di proferire | `proferire` | `form-gloss` | `gerundio` |
| 386846 | `pattuita` | adj | 0 | femminle di pattuito | `pattuito` | `form-gloss` | `femminle` |
| 395298 | `schizzi` | noun | 0 | purale di schizzo | `schizzo` | `form-gloss` | `purale` |
| 402772 | `combattute` | adj | 0 | femminile plurele di combattuto | `combattuto` | `form-gloss` | `femminile` |
| 403839 | `occhietto` | noun | 0 | diminutivo di occhio | `occhio` | `form-gloss` | `diminutivo` |
| 403840 | `occhiolino` | noun | 0 | diminutivo di occhio | `occhio` | `form-gloss` | `diminutivo` |
| 403841 | `occhione` | noun | 0 | accrescitivo di occhio | `occhio` | `form-gloss` | `accrescitivo` |
| 403961 | `casetta` | noun | 0 | diminutivo di casa | `casa` | `form-gloss` | `diminutivo` |
| 403961 | `casetta` | noun | 1 | tenda a forma di piccola casa | `casa` | `form-gloss` | `forma` |
| 404845 | `frutticino` | noun | 0 | diminutivo di frutto | `frutto` | `form-gloss` | `diminutivo` |
| 404888 | `mestolaccia` | noun | 0 | peggiorativo di mestola | `mestola` | `form-gloss` | `peggiorativo` |
| 405023 | `considerevoli` | adj | 0 | maschile e femminile plurale di considerevole | `considerevole` | `form-gloss` | `maschile` |
| 405914 | `sposate` | adj | 0 | femminile plurare di sposato | `sposato` | `form-gloss` | `femminile` |
| 410090 | `indisponenti` | adj | 0 | maschile e femminile plurale di indisponente | `indisponente` | `form-gloss` | `maschile` |
| 410231 | `nanoelettronica` | noun | 0 | realizzazione di dispositivi elettronici di dimensioni infinitesimali | `infinitesimali` | `form-gloss` | `infinitesimali` |
| 410637 | `scomposte` | adj | 0 | femmimnile plurale di scomposto | `scomposto` | `form-gloss` | `femmimnile` |
| 414099 | `formella` | noun | 0 | diminutivo di forma | `forma` | `form-gloss` | `diminutivo` |
| 416002 | `elefantessa` | noun | 0 | femmina dell'elefante | `elefante` | `form-gloss` | `femmina` |
| 416350 | `miserrimo` | adj | 0 | superlativo assoluto di misero | `misero` | `form-gloss` | `superlativo` |
| 416784 | `lunghissima` | adj | 0 | femminile superlativo assoluto di lungo | `lungo` | `form-gloss` | `femminile` |
| 417138 | `orsa` | noun | 0 | femmina dell' orso | `orso` | `form-gloss` | `femmina` |
| 417817 | `attente` | adj | 0 | che presta attenzione, femminile plurale di attento | `attento` | `form-gloss` | `femminile` |
| 418714 | `veloci` | adj | 0 | maschile e femminile plurale di veloce | `veloce` | `form-gloss` | `maschile` |
| 419358 | `auspici` | noun | 0 | (divinatore)plurale di auspice | `auspice` | `form-gloss` | `plurale` |
| 419358 | `auspici` | noun | 1 | (presagio)plurale di auspicio | `auspicio` | `form-gloss` | `plurale` |
| 420022 | `inginocchiata` | verb | 0 | participio passato femminile sin golare di inginocchiarsi | `inginocchiarsi` | `form-gloss` | `participio` |
| 422117 | `dissennato` | verb | 0 | participio passato. di dissennare | `dissennare` | `form-gloss` | `participio` |
| 422298 | `redolente` | verb | 0 | participio. presente di redolire | `redolire` | `form-gloss` | `participio` |
| 422337 | `siano` | verb | 0 | terza persona plurale del congiuntivo presente del verbo essere | `essere` | `form-gloss` | `plurale` |
| 422337 | `siano` | verb | 1 | terza persona plurale dell'imperativo del verbo essere | `essere` | `form-gloss` | `plurale` |
| 422661 | `sia` | verb | 0 | prima, seconda e terza persona singolare del congiuntivo presente di essere | `essere` | `form-gloss` | `singolare` |
| 422858 | `vascelletto` | noun | 0 | diminutivo di vascello | `vascello` | `form-gloss` | `diminutivo` |
| 423446 | `stupidaggini` | noun | 0 | plurale da stupidaggine | `stupidaggine` | `form-gloss` | `plurale` |
| 423521 | `messinese` | noun | 0 | variante della lingua siciliana parlata a Messina | `parlata` | `form-gloss` | `variante` |
| 423876 | `assistenti` | adj | 0 | maschile e femminile plurale di assistente | `assistente` | `form-gloss` | `maschile` |
| 423877 | `assistenti` | noun | 0 | maschile e femminile plurale di assistente | `assistente` | `form-gloss` | `maschile` |
| 425376 | `riposati` | verb | 0 | participio passto plurale di riposare | `riposare` | `form-gloss` | `participio` |
| 430874 | `lesse` | verb | 0 | terza persona singolare (irregolare) dell'indicativo passato remoto di leggere | `leggere` | `form-gloss` | `singolare` |
| 432109 | `ostesi` | verb | 0 | prima persona singolare dell'indicativo passato remoto (raro) di ostendere | `ostendere` | `form-gloss` | `singolare` |
| 432111 | `ostese` | verb | 0 | terza persona singolare dell'indicativo passato remoto (raro) di ostendere | `ostendere` | `form-gloss` | `singolare` |
| 433719 | `salutari` | adj | 0 | maschile e femminile plurale di salutare | `salutare` | `form-gloss` | `maschile` |
| 434624 | `mordenti` | adj | 0 | maschile e femminile plurale di mordente | `mordente` | `form-gloss` | `maschile` |
| 435276 | `occorrenti` | adj | 0 | maschile e femminile plurale di occorrente | `occorrente` | `form-gloss` | `maschile` |
| 435616 | `trascorsa` | adj | 0 | femminile diu trascorso | `trascorso` | `form-gloss` | `femminile` |
| 436545 | `leggiamo` | verb | 0 | 1ª persona plurale dell'indicativo presente di leggere | `leggere` | `form-gloss` | `plurale` |
| 436545 | `leggiamo` | verb | 1 | 1ª persona plurale del congiuntivo presente di leggere | `leggere` | `form-gloss` | `plurale` |
| 436545 | `leggiamo` | verb | 2 | 1ª persona plurale dell'imperativo di leggere | `leggere` | `form-gloss` | `plurale` |
| 436546 | `leggete` | verb | 0 | 2ª persona plurale dell'indicativo presente di leggere | `leggere` | `form-gloss` | `plurale` |
| 436546 | `leggete` | verb | 1 | 2ª persona plurale dell'imperativo di leggere | `leggere` | `form-gloss` | `plurale` |
| 436547 | `leggono` | verb | 0 | 3ª persona plurale dell'indicativo presente di leggere | `leggere` | `form-gloss` | `plurale` |
| 436548 | `leggevo` | verb | 0 | 1ª persona singolare dell'indicativo imperfetto di leggere | `leggere` | `form-gloss` | `singolare` |
| 436549 | `leggevi` | verb | 0 | 2ª persona singolare dell'indicativo imperfetto di leggere | `leggere` | `form-gloss` | `singolare` |
| 436550 | `leggeva` | verb | 0 | 3ª persona singolare dell'indicativo imperfetto di leggere | `leggere` | `form-gloss` | `singolare` |
| 436550 | `leggeva` | verb | 1 | 2ª persona singolare dell'indicativo imperfetto di leggere | `leggere` | `form-gloss` | `singolare` |
| 436551 | `leggevamo` | verb | 0 | 1ª persona plurale dell'indicativo imperfetto di leggere | `leggere` | `form-gloss` | `plurale` |
| 436552 | `leggevate` | verb | 0 | 2ª persona plurale dell'indicativo imperfetto di leggere | `leggere` | `form-gloss` | `plurale` |
| 436553 | `leggevano` | verb | 0 | 3ª persona plurale dell'indicativo imperfetto di leggere | `leggere` | `form-gloss` | `plurale` |
| 436558 | `leggerò` | verb | 0 | 1ª persona singolare dell'indicativo futuro di leggere | `leggere` | `form-gloss` | `singolare` |
| 436560 | `leggerà` | verb | 1 | 2ª persona singolare dell'indicativo futuro di leggere | `leggere` | `form-gloss` | `singolare` |
| 436561 | `leggeremo` | verb | 0 | 1ª persona plurale dell'indicativo futuro di leggere | `leggere` | `form-gloss` | `plurale` |
| 436562 | `leggerete` | verb | 0 | 2ª persona plurale dell'indicativo futuro di leggere | `leggere` | `form-gloss` | `plurale` |
| 436563 | `leggeranno` | verb | 0 | 3ª persona plurale dell'indicativo futuro di leggere | `leggere` | `form-gloss` | `plurale` |
| 436806 | `conviventi` | adj | 0 | maschile e femminile plurale di convivente | `convivente` | `form-gloss` | `maschile` |
| 440427 | `vinci` | noun | 0 | plurale poetico o letterario di vinco | `vinco` | `form-gloss` | `plurale` |
| 442242 | `sollecitudini` | noun | 0 | pliurale di sollecitudine | `sollecitudine` | `form-gloss` | `pliurale` |
| 442289 | `bestioni` | noun | 1 | accrescitivo di bestie | `bestie` | `form-gloss` | `accrescitivo` |
| 443238 | `decrescenti` | adj | 0 | maschile e femminile plurale di decrescente | `decrescente` | `form-gloss` | `maschile` |
| 447256 | `eurodeputatesse` | noun | 0 | femminile plurale alternativo di eurodeputato | `eurodeputato` | `form-gloss` | `femminile` |
| 447257 | `eurodeputatessa` | noun | 0 | femminile alternativo di eurodeputato | `eurodeputato` | `form-gloss` | `femminile` |
| 447261 | `archeologhi` | noun | 0 | plurale alternativo di archeologo | `archeologo` | `form-gloss` | `plurale` |
| 447283 | `speleologhi` | noun | 0 | plurale alternativo di speleologo | `speleologo` | `form-gloss` | `plurale` |
| 447479 | `originarie` | adj | 0 | femmminile plurale di originario | `originario` | `form-gloss` | `femmminile` |
| 448906 | `scadendo` | verb | 0 | gerundio present di scadere | `scadere` | `form-gloss` | `gerundio` |
| 449171 | `olandesina` | noun | 0 | vezzeggiativo di olandese | `olandese` | `form-gloss` | `vezzeggiativo` |
| 449717 | `baldanzosa` | adj | 0 | femminile baldanzoso | `baldanzoso` | `form-gloss` | `femminile` |
| 450090 | `molari` | adj | 0 | maschile e femminile plurale di molare | `molare` | `form-gloss` | `maschile` |
| 450130 | `motoristiche` | adj | 0 | femminileplurale di motoristico | `motoristico` | `form-gloss` | `femminileplurale` |
| 450224 | `frazionarie` | adj | 0 | pluirsle di frazionaria | `frazionaria` | `form-gloss` | `pluirsle` |
| 450259 | `astruse` | adj | 0 | feminile plurale di astruso | `astruso` | `form-gloss` | `feminile` |
| 450312 | `olduvaiane` | adj | 0 | plursle di olduvaiano | `olduvaiano` | `form-gloss` | `plursle` |
| 453110 | `olimpici` | adj | 0 | pliurale di olimpico | `olimpico` | `form-gloss` | `pliurale` |
| 453215 | `scalari` | adj | 0 | maschile e femminile plurale di scalare | `scalare` | `form-gloss` | `maschile` |
| 454470 | `longobarde` | adj | 0 | femminle plurale di longobardo | `longobardo` | `form-gloss` | `femminle` |
| 455249 | `facciano` | verb | 0 | 3ª persona plurale del congiuntivo presente di fare | `fare` | `form-gloss` | `plurale` |
| 455249 | `facciano` | verb | 1 | 3ª persona plurale imperativo di fare | `fare` | `form-gloss` | `plurale` |
| 455250 | `fa'` | verb | 0 | 2ª persona singolare imperativo di fare | `fare` | `form-gloss` | `singolare` |
| 455252 | `farai` | verb | 0 | 2ª persona singolare dell'indicativo futuro di fare | `fare` | `form-gloss` | `singolare` |
| 455253 | `faremo` | verb | 0 | 1ª persona plurale dell'indicativo futuro di fare | `fare` | `form-gloss` | `plurale` |
| 455254 | `farete` | verb | 0 | 2ª persona plurale dell'indicativo futuro di fare | `fare` | `form-gloss` | `plurale` |
| 455255 | `faranno` | verb | 0 | 3ª persona plurale dell'indicativo futuro di fare | `fare` | `form-gloss` | `plurale` |
| 455859 | `cicliste` | noun | 0 | pluraledi ciclista | `ciclista` | `form-gloss` | `pluraledi` |
| 456862 | `siate` | verb | 1 | seconda persona plurale dell'imperativo del verbo essere | `essere` | `form-gloss` | `plurale` |
| 456865 | `sii` | verb | 0 | seconda persona singolare dell'imperativo del verbo essere | `essere` | `form-gloss` | `singolare` |
| 457369 | `riflessive` | adj | 0 | pluraledi riflessiva | `riflessiva` | `form-gloss` | `pluraledi` |
| 457409 | `morbose` | adj | 0 | plursle di morbosa | `morbosa` | `form-gloss` | `plursle` |
| 457412 | `videotelefonie` | noun | 0 | olurale di videotelefonia | `videotelefonia` | `form-gloss` | `olurale` |
| 457843 | `noncuranti` | adj | 0 | pluraledi noncurante | `noncurante` | `form-gloss` | `pluraledi` |
| 458541 | `leggendarie` | adj | 0 | fmminilw plurale di leggendario | `leggendario` | `form-gloss` | `fmminilw` |
| 458735 | `erboristerie` | noun | 0 | pòlurale di erboristeria | `erboristeria` | `form-gloss` | `pòlurale` |
| 458751 | `regresso` | verb | 0 | participio passato letterario di regredire | `regredire` | `form-gloss` | `participio` |
| 461235 | `può` | verb | 0 | terza persona singolare, presente, modo indicativo del verbo potere | `potere` | `form-gloss` | `singolare` |
| 463535 | `controversa` | verb | 0 | participio passato, femminile singolare di controvertere | `controvertere` | `form-gloss` | `participio` |
| 464019 | `incisiva` | adj | 0 | (di persona) femminile di incisivo | `incisivo` | `form-gloss` | `femminile` |
| 464348 | `sfiziose` | adj | 0 | plirale di sfiziosa | `sfiziosa` | `form-gloss` | `plirale` |
| 464675 | `tranelli` | noun | 0 | pluirale di tranello | `tranello` | `form-gloss` | `pluirale` |
| 465096 | `muratrici` | noun | 0 | femminile plurale alternativo di muratore | `muratore` | `form-gloss` | `femminile` |
| 465097 | `muratora` | noun | 0 | femminile alternativo di muratore | `muratore` | `form-gloss` | `femminile` |
| 465466 | `veneranda` | verb | 0 | gerundio femminile singolre di venerare | `venerare` | `form-gloss` | `gerundio` |
| 465749 | `controverse` | verb | 0 | participio passato, femminile plurale di controvertere | `controvertere` | `form-gloss` | `participio` |
| 465752 | `controversi` | verb | 0 | participio passato, maschile plurale di controvertere | `controvertere` | `form-gloss` | `participio` |
| 468884 | `commetteva` | verb | 0 | terza persona singolare dell'indicativo imperfetto del verbo commettere | `commettere` | `form-gloss` | `singolare` |
| 471767 | `minorato` | verb | 0 | participio passato. di minorare | `minorare` | `form-gloss` | `participio` |
| 471774 | `oracolari` | adj | 0 | maschile e femminile plurale di oracolare | `oracolare` | `form-gloss` | `maschile` |
| 475708 | `prescinderono` | verb | 0 | terza persona plursle dell'indicativo passato remoto di prescindere | `prescindere` | `form-gloss` | `plursle` |
| 502819 | `serrande` | noun | 0 | pliurale di serranda | `serranda` | `form-gloss` | `pliurale` |
| 507387 | `adugge` | verb | 0 | forma variante (obsoleta) della terza persona singolare dell'indicativo presente di aduggiare | `aduggiare` | `form-gloss` | `forma` |
| 511672 | `sanguinolente` | adj | 0 | variante di sanguinolento | `sanguinolento` | `form-gloss` | `variante` |
| 512602 | `indagatrici` | noun | 0 | femminmile plurale di indagatore | `indagatore` | `form-gloss` | `femminmile` |
| 518320 | `velari` | adj | 0 | maschile e femminile plurale di velare | `velare` | `form-gloss` | `maschile` |
| 530676 | `nuoccia` | verb | 0 | prina persona singolare del congiuntivo presente di nuocere | `nuocere` | `form-gloss` | `singolare` |
| 535292 | `rendei` | verb | 0 | variante antiquata della prima persona singolare dell'indicativo passato remoto di rendere | `rendere` | `form-gloss` | `variante` |
| 535293 | `rendetti` | verb | 0 | variante antiquata della prima persona singolare dell'indicativo passato remoto di rendere | `rendere` | `form-gloss` | `variante` |
| 535294 | `rendé` | verb | 0 | variante antiquata della terza persona singolare dell'indicativo passato remoto di rendere | `rendere` | `form-gloss` | `variante` |
| 535295 | `rendette` | verb | 0 | variante antiquata della terza persona singolare dell'indicativo passato remoto di rendere | `rendere` | `form-gloss` | `variante` |
| 535310 | `renderono` | verb | 0 | variante antiquata della terza persona plurale dell'indicativo passato remoto di rendere | `rendere` | `form-gloss` | `variante` |
| 535311 | `rendettero` | verb | 0 | variante antiquata della terza persona plurale dell'indicativo passato remoto di rendere | `rendere` | `form-gloss` | `variante` |
| 535336 | `arrendei` | verb | 0 | variante antiquata della prima persona singolare dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `form-gloss` | `variante` |
| 535337 | `arrendetti` | verb | 0 | variante antiquata della prima persona singolare dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `form-gloss` | `variante` |
| 535340 | `arrendé` | verb | 0 | variante antiquata della terza persona singolare dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `form-gloss` | `variante` |
| 535341 | `arrendette` | verb | 0 | variante antiquata della terza persona singolare dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `form-gloss` | `variante` |
| 535358 | `arrenderono` | verb | 0 | variante antiquata della terza persona plurale dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `form-gloss` | `variante` |
| 535359 | `arrendettero` | verb | 0 | variante antiquata della terza persona plurale dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `form-gloss` | `variante` |
| 535379 | `concedei` | verb | 0 | variante antiquata della prima persona singolare dell'indicativo passato remoto di concedere | `concedere` | `form-gloss` | `variante` |
| 535380 | `concedetti` | verb | 0 | variante antiquata della prima persona singolare dell'indicativo passato remoto di concedere | `concedere` | `form-gloss` | `variante` |
| 535381 | `concedé` | verb | 0 | variante antiquata della terza persona singolare dell'indicativo passato remoto di concedere | `concedere` | `form-gloss` | `variante` |
| 535382 | `concedette` | verb | 0 | variante antiquata della terza persona singolare dell'indicativo passato remoto di concedere | `concedere` | `form-gloss` | `variante` |
| 535395 | `concederono` | verb | 0 | variante antiquata della terza persona plurale dell'indicativo passato remoto di concedere | `concedere` | `form-gloss` | `variante` |
| 535396 | `concedettero` | verb | 0 | variante antiquata della terza persona plurale dell'indicativo passato remoto di concedere | `concedere` | `form-gloss` | `variante` |
| 535416 | `conceduto` | verb | 0 | variante rara del participio passato di concedere | `concedere` | `form-gloss` | `variante` |
| 535417 | `conceduti` | verb | 0 | variante rara del participio passato maschile plurale di concedere | `concedere` | `form-gloss` | `variante` |
| 535418 | `conceduta` | verb | 0 | variante rara del participio passato femminile singolare di concedere | `concedere` | `form-gloss` | `variante` |
| 535419 | `concedute` | verb | 0 | variante rara del participio passato femminile plurale di concedere | `concedere` | `form-gloss` | `variante` |
| 535439 | `procedei` | verb | 0 | variante rara della prima persona singolare dell'indicativo passato remoto di procedere | `procedere` | `form-gloss` | `variante` |
| 535442 | `processe` | verb | 0 | variante antiquata della terza persona singolare dell'indicativo passato remoto di procedere | `procedere` | `form-gloss` | `variante` |
| 535443 | `procedé` | verb | 0 | variante rara della terza persona singolare dell'indicativo passato remoto di procedere | `procedere` | `form-gloss` | `variante` |
| 535447 | `processero` | verb | 0 | variante antiquata della terza persona plurale dell'indicativo passato remoto di procedere | `procedere` | `form-gloss` | `variante` |
| 535448 | `procederono` | verb | 0 | variante rara della terza persona plurale dell'indicativo passato remoto di procedere | `procedere` | `form-gloss` | `variante` |
| 538998 | `cicaline` | noun | 1 | (allarme acustico) plurale di cicalina | `cicalina` | `form-gloss` | `plurale` |
| 543328 | `dispendiosi` | adj | 0 | pluarale di dispendioso | `dispendioso` | `form-gloss` | `pluarale` |
| 543353 | `Psittaciformi` | noun | 0 | uccelli a forma di pappagallo che si nutrono di frutta | `frutta` | `form-gloss` | `forma` |
| 543672 | `disossidanti` | adj | 0 | maschile e femminile plurale di disossidanti | `disossidanti` | `form-gloss` | `maschile` |
| 548422 | `annichilamento` | noun | 0 | variante di annichilimento | `annichilimento` | `form-gloss` | `variante` |
| 548552 | `enigmatiche` | adj | 0 | femminile pliurale di enigmatico | `enigmatico` | `form-gloss` | `femminile` |
| 548667 | `dispiaciute` | verb | 0 | participio passaato femminile plurale di dispiacere | `dispiacere` | `form-gloss` | `participio` |
| 549101 | `sproporzionate` | adj | 0 | plirale femminile di sproporzionato | `sproporzionato` | `form-gloss` | `plirale` |
| 549199 | `tali` | adj | 0 | maschile e femminile plurale di tale | `tale` | `form-gloss` | `maschile` |
| 549200 | `tali` | pron | 0 | maschile e femminile plurale di tale | `tale` | `form-gloss` | `maschile` |
| 551027 | `vendesi` | verb | 0 | letteralmente "si vende", forma utilizzata nei cartelli e negli annunci | `annunci` | `form-gloss` | `forma` |
| 551259 | `evergeti` | noun | 0 | vedi evergete | `evergete` | `form-gloss` | `vedi` |
| 551260 | `evergetide` | noun | 0 | vedi evergete | `evergete` | `form-gloss` | `vedi` |
| 551261 | `evergetidi` | noun | 0 | vedi evergete | `evergete` | `form-gloss` | `vedi` |
| 551262 | `filometori` | noun | 0 | vedi filometore | `filometore` | `form-gloss` | `vedi` |
| 551263 | `filopatori` | noun | 0 | vedi filopatore | `filopatore` | `form-gloss` | `vedi` |
| 551264 | `fisconi` | noun | 0 | vedi fiscone | `fiscone` | `form-gloss` | `vedi` |
| 551272 | `lagidi` | noun | 0 | vedi lagide | `lagide` | `form-gloss` | `vedi` |
| 551275 | `auletride` | noun | 0 | vedi aulete | `aulete` | `form-gloss` | `vedi` |
| 551276 | `auletridi` | noun | 0 | vedi aulete | `aulete` | `form-gloss` | `vedi` |
| 555813 | `avvertita` | verb | 0 | participio passato (femminile) di avvertire | `avvertire` | `form-gloss` | `participio` |
| 557858 | `larvali` | adj | 0 | maschile e femminile plurale di larvale | `larvale` | `form-gloss` | `maschile` |
| 557884 | `gaudenti` | adj | 0 | maschile e femminile plurale di gaudente | `gaudente` | `form-gloss` | `maschile` |
| 560343 | `vanitosi` | adj | 0 | plutale di vanitoso | `vanitoso` | `form-gloss` | `plutale` |
| 560436 | `sedute` | verb | 0 | participio passato (plurale femminile) di sedere | `sedere` | `form-gloss` | `participio` |
| 561964 | `censori` | adj | 0 | pllurale di censorio | `censorio` | `form-gloss` | `pllurale` |
| 562039 | `rintanate` | adj | 0 | femmimnile plurale di rintanato | `rintanato` | `form-gloss` | `femmimnile` |
| 562040 | `rintanate` | verb | 0 | participio passato (plurale femminile) di rintanare | `rintanare` | `form-gloss` | `participio` |
| 566554 | `copersi` | verb | 0 | variante antica dell prima persona singolare dell'indicativo passato remoto di coprire | `coprire` | `form-gloss` | `variante` |
| 569838 | `ucraina` | adj | 0 | femmimile di ucraino | `ucraino` | `form-gloss` | `femmimile` |
| 569839 | `ucraina` | noun | 0 | femmimile di ucraino | `ucraino` | `form-gloss` | `femmimile` |
| 571709 | `bellicose` | adj | 0 | plurale femminine di bellicoso | `bellicoso` | `form-gloss` | `plurale` |
| 577523 | `lastroni` | noun | 0 | pluale di lastrone | `lastrone` | `form-gloss` | `pluale` |
| 579129 | `steatorniti` | noun | 0 | pluraale di steatornite | `steatornite` | `form-gloss` | `pluraale` |
| 579439 | `salirò` | verb | 0 | prima persona singolare dell'indicativo futuro semplice si salire | `salire` | `form-gloss` | `singolare` |
| 579673 | `stalkero` | verb | 0 | 1ª persona singolare del presente semplice indicativo di stalkerare | `stalkerare` | `form-gloss` | `singolare` |
| 579676 | `stalkeri` | verb | 0 | 2ª persona singolare del presente semplice indicativo di stalkerare | `stalkerare` | `form-gloss` | `singolare` |
| 583195 | `impiantito` | verb | 0 | participio passatodi impiantire | `impiantire` | `form-gloss` | `participio` |
| 583245 | `spropositi` | verb | 4 | trza persona singolare dell'imperativo di spropositare | `spropositare` | `form-gloss` | `singolare` |
| 583340 | `spudorate` | adj | 0 | femmimile plurale di spudorato | `spudorato` | `form-gloss` | `femmimile` |
| 583341 | `spudorate` | noun | 0 | femmimile plurale di spudorato | `spudorato` | `form-gloss` | `femmimile` |
| 584041 | `sepolta` | verb | 0 | participio passato demminile di seppellire | `seppellire` | `form-gloss` | `participio` |
| 584095 | `odontotecniche` | adj | 0 | femminileplurale di odontotecnico | `odontotecnico` | `form-gloss` | `femminileplurale` |
| 584160 | `mostruose` | adj | 0 | femmimileplurale di mostruoso | `mostruoso` | `form-gloss` | `femmimileplurale` |
| 584310 | `parolai` | noun | 0 | (di persona) plurale di parolaio | `parolaio` | `form-gloss` | `plurale` |
| 584311 | `parolaia` | noun | 0 | (di persona) femminile di parolaio | `parolaio` | `form-gloss` | `femminile` |
| 584312 | `parolaie` | noun | 0 | (di persona) femminile plurale di parolai | `parolai` | `form-gloss` | `femminile` |
| 584884 | `offra` | verb | 1 | seconda di persona singolare del congiuntivo presente di offrire | `offrire` | `form-gloss` | `singolare` |
| 584885 | `svantaggiose` | adj | 0 | femminile pluraòe di svantaggioso | `svantaggioso` | `form-gloss` | `femminile` |
| 585129 | `previsti` | verb | 0 | participio passato plurale prevedere | `prevedere` | `form-gloss` | `participio` |
| 585400 | `fûro` | verb | 0 | (antico, linguaggio poetico) Forma contratta del verbo "essere", terza persona plurale, furono. | `furono` | `form-gloss` | `forma` |
| 585532 | `grandissima` | adj | 0 | femminile superlativo assoluto di grande | `grande` | `form-gloss` | `femminile` |
| 585533 | `grandissimi` | adj | 0 | superlativo assoluto, maschile plurale di grande | `grande` | `form-gloss` | `superlativo` |
| 585534 | `grandissime` | adj | 0 | superlativo assoluto, femminile plurale di grande | `grande` | `form-gloss` | `superlativo` |
| 585848 | `consentiva` | verb | 0 | terza persona singolare dell'indicativo imperfetto dki consentire | `consentire` | `form-gloss` | `singolare` |
| 585998 | `rarissima` | adj | 0 | superlativo assoluto femminile singolare di raro | `raro` | `form-gloss` | `superlativo` |
| 585999 | `rarissimo` | adj | 0 | superlativo assoluto singolare di raro | `raro` | `form-gloss` | `superlativo` |
| 586000 | `rarissimi` | adj | 0 | superlativo assoluto plurale di raro | `raro` | `form-gloss` | `superlativo` |
| 586001 | `rarissime` | adj | 0 | superlativo assoluto femminile plurale di raro | `raro` | `form-gloss` | `superlativo` |
| 586758 | `disabitati` | adj | 0 | pluirale di disabitato | `disabitato` | `form-gloss` | `pluirale` |
| 586759 | `disabitate` | adj | 0 | femminile pluraledi disabitato | `disabitato` | `form-gloss` | `femminile` |
| 587175 | `rovinate` | adj | 0 | femminole plurale di rovinato | `rovinato` | `form-gloss` | `femminole` |
| 587806 | `risentiti` | verb | 0 | participio passato plurale risentire | `risentire` | `form-gloss` | `participio` |
| 587840 | `sbiadite` | adj | 0 | femminle plurale di sbiadito | `sbiadito` | `form-gloss` | `femminle` |
| 588282 | `giocondi` | adj | 0 | kmaschile di giocondo | `giocondo` | `form-gloss` | `kmaschile` |
| 588286 | `incaute` | adj | 0 | femminiole plurale di incauto | `incauto` | `form-gloss` | `femminiole` |
| 588935 | `piccolissime` | adj | 0 | superlativo assoluto, femminile plurale di piccolo | `piccolo` | `form-gloss` | `superlativo` |
| 588936 | `incisivi` | adj | 0 | (di persona) plurale di incisivo | `incisivo` | `form-gloss` | `plurale` |
| 588938 | `incisive` | adj | 0 | (di persona) femminile plurale di incisivo | `incisivo` | `form-gloss` | `femminile` |
| 589313 | `bolliti` | verb | 0 | participio passato plurale del verbo bollire | `bollire` | `form-gloss` | `participio` |
| 589733 | `sdolcinate` | adj | 0 | femmminile plurale di sdolcinato | `sdolcinato` | `form-gloss` | `femmminile` |
| 589830 | `spessa` | adj | 0 | femminiole di spesso | `spesso` | `form-gloss` | `femminiole` |
| 589841 | `spettacolose` | adj | 0 | femminile purale di spettacoloso | `spettacoloso` | `form-gloss` | `femminile` |
| 589905 | `bonarie` | adj | 0 | femminile pliurale di bonario | `bonario` | `form-gloss` | `femminile` |
| 590026 | `funerei` | adj | 0 | pluralem di funereo | `funereo` | `form-gloss` | `pluralem` |
| 590032 | `mortuari` | adj | 0 | plurle di mortuario | `mortuario` | `form-gloss` | `plurle` |
| 590132 | `minacciosa` | adj | 0 | femminole di minaccioso | `minaccioso` | `form-gloss` | `femminole` |
| 590345 | `faccendiera` | noun | 0 | femminle di faccendiere | `faccendiere` | `form-gloss` | `femminle` |
| 590413 | `ricurve` | adj | 0 | femminle plurale di ricurvo | `ricurvo` | `form-gloss` | `femminle` |
| 591880 | `fregature` | noun | 0 | pliurale di fregatura | `fregatura` | `form-gloss` | `pliurale` |
| 592669 | `scorata` | adj | 0 | femmminile di scorato | `scorato` | `form-gloss` | `femmminile` |
| 592791 | `negligenze` | noun | 0 | pòlurale di negligenza | `negligenza` | `form-gloss` | `pòlurale` |
| 593004 | `imbevi` | verb | 1 | seconda persona singolare dell'imperativo presente imbevere | `imbevere` | `form-gloss` | `singolare` |
| 593021 | `risaputa` | verb | 0 | participio passato femminiòe di risapere | `risapere` | `form-gloss` | `participio` |
| 593360 | `nordiche` | adj | 0 | femminile pliurale di nordico | `nordico` | `form-gloss` | `femminile` |
| 593510 | `populismi` | noun | 0 | pluurale di populismo | `populismo` | `form-gloss` | `pluurale` |
| 595549 | `sedative` | adj | 0 | femminile pluraledi sedativo | `sedativo` | `form-gloss` | `femminile` |
| 595620 | `infuocate` | verb | 0 | participio passato femmminie plurale di infuocare | `infuocare` | `form-gloss` | `participio` |
| 596010 | `ossute` | adj | 0 | femminilew plurale di ossuto | `ossuto` | `form-gloss` | `femminilew` |
| 596011 | `ossuta` | adj | 0 | femminilew di ossuto | `ossuto` | `form-gloss` | `femminilew` |
| 596177 | `biomolecole` | noun | 0 | plurae di biomolecola | `biomolecola` | `form-gloss` | `plurae` |
| 597333 | `miracolistici` | adj | 0 | plurale miracolistico | `miracolistico` | `form-gloss` | `plurale` |
| 599277 | `arzille` | adj | 0 | femminile pliurale di arzillo | `arzillo` | `form-gloss` | `femminile` |
| 599401 | `masti` | noun | 0 | pliurale di mastio | `mastio` | `form-gloss` | `pliurale` |
| 599799 | `alemanne` | noun | 0 | femminile lurale di alemanno | `alemanno` | `form-gloss` | `femminile` |
| 600836 | `sostituta` | noun | 0 | femmminile di sostituto | `sostituto` | `form-gloss` | `femmminile` |
| 601014 | `possidenti` | noun | 0 | plurale dei possidente | `possidente` | `form-gloss` | `plurale` |
| 601507 | `terree` | adj | 0 | femminle plurale di terreo | `terreo` | `form-gloss` | `femminle` |
| 602018 | `istintuali` | adj | 0 | purale di istintuale | `istintuale` | `form-gloss` | `purale` |
| 602147 | `etimologizzata` | verb | 0 | : participio passato di etimologizzare, caso femminile | `etimologizzare` | `form-gloss` | `participio` |
| 602148 | `etimologizzati` | verb | 0 | : participio passato di etimologizzare, caso maschile plurale; usato a volte anche come sostantivo (esempio gli etimologizzati del verbo invocare sono 16, sottintendendo che ci si rifererisce a vocaboli). | `sostantivo` | `form-gloss` | `participio` |
| 602813 | `malnutrite` | adj | 0 | femminle plurale di malnutrito | `malnutrito` | `form-gloss` | `femminle` |
| 602814 | `malnutrita` | adj | 0 | femminle di malnutrito | `malnutrito` | `form-gloss` | `femminle` |
| 603278 | `timorata` | adj | 0 | Femminule di timorato | `timorato` | `form-gloss` | `femminule` |
| 605842 | `giovanissimo` | adj | 0 | superlativo assoluto, maschile singolare di giovane | `giovane` | `form-gloss` | `superlativo` |
| 606883 | `spiati` | verb | 0 | participio passato plurale din spiare | `spiare` | `form-gloss` | `participio` |
| 606905 | `vorresti` | verb | 0 | secona persona singolare del condizionale presente di volere | `volere` | `form-gloss` | `singolare` |
| 614035 | `spezzalo` | verb | 0 | agglutinazione della seconda persona singolare dell'imperativo presente del verbo spezzare con il pronome personale maschile singolare lo. | `lo` | `form-gloss` | `singolare` |
| 614665 | `savia` | noun | 0 | fwmminile di savio | `savio` | `form-gloss` | `fwmminile` |
| 621073 | `liberissimo` | adj | 0 | superlativo assoluto di libero | `libero` | `form-gloss` | `superlativo` |
| 621380 | `caldissimo` | adj | 0 | superlativo assoluto di caldo | `caldo` | `form-gloss` | `superlativo` |
| 621454 | `partissi` | verb | 0 | prima/seconda persona singolare del congiuntivo imperfetto di partire | `partire` | `form-gloss` | `singolare` |
| 621473 | `prude` | verb | 0 | terza persona singolare dell'infinito presente di prudere | `prudere` | `form-gloss` | `singolare` |
| 621479 | `rapidissimo` | adj | 0 | superlativo assoluto di rapido | `rapido` | `form-gloss` | `superlativo` |
| 621833 | `pochissimo` | adj | 0 | superlativo assoluto di poco | `poco` | `form-gloss` | `superlativo` |
| 625505 | `magagne` | noun | 0 | plirale di magagna | `magagna` | `form-gloss` | `plirale` |
| 625761 | `'sta` | adj | 0 | Femminile singolare di 'sto. | `'sto` | `form-gloss` | `femminile` |
| 625762 | `'ste` | adj | 0 | Femminile plurale di 'sto. | `'sto` | `form-gloss` | `femminile` |
| 625763 | `'sti` | adj | 0 | Maschile plurale di 'sto. | `'sto` | `form-gloss` | `maschile` |
| 627372 | `glabra` | adj | 0 | femmiile di glabro | `glabro` | `form-gloss` | `femmiile` |
| 627596 | `succulente` | adj | 0 | femminle plurale di succulento | `succulento` | `form-gloss` | `femminle` |
| 632438 | `untuosa` | adj | 0 | feminile di untuoso | `untuoso` | `form-gloss` | `feminile` |
