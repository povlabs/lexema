# Form records with no `form_of` edge, given one by rule — 2026-10-08

Issue [#722](https://github.com/povlabs/lexema/issues/722). Release
`it-0c432803`. Rule `it-form-of-gloss-edge/v1`
([src/italian/formOfGlossEdge.ts](../src/italian/formOfGlossEdge.ts)), on
questions 7 and 8 of Huey's
[ruling](https://github.com/povlabs/lexema/issues/708#issuecomment-6047197445)
of 2026-10-07 on #708, recorded in
[ADR 0030](../.decisions/0030-corrections-may-fix-edges-and-cells.md).

## What the rule reads

`pnpm run measure:form-of-gloss-edge`
([src/import/measureFormOfGlossEdge.ts](../src/import/measureFormOfGlossEdge.ts))
reads the archive twice. The first pass keeps every sense whose first gloss
names a word after "di"; the second reads every record of the words those
glosses name, with its `forms`. The rule then judges each sense from two lines
of the archive only, and writes the senses it confirms, each with the line it
cites, to
[src/italian/formOfGlossEdgeEvidence.ts](../src/italian/formOfGlossEdgeEvidence.ts).
A second run on the same archive writes the same file.

A sense gets an edge to X when all of these hold:

- its record is Italian;
- it declares no `form_of` edge;
- its first gloss opens with words that say which form it is, and only those
  (`FORM_WORDS`: plurale, femminile, terza persona singolare del congiuntivo
  presente, …), then "di X";
- an Italian record whose `word` is X lists the record's word, exactly, in its
  `forms`. The correction cites the first such record in archive order, by
  line, digest and cell (`/forms/<i>/form`).

**What each correction cites.** ADR 0030 asks every correction to cite a source
revision. An edge correction's evidence is the archive itself, which is a fixed
revision of the source: the release id is the archive's own digest
(`it-0c432803`), and each line is pinned by its SHA-256. So each correction
cites two lines of it: the record's own, whose gloss names X after "di"
(`edge.gloss`, its pointer and text), and X's record, whose forms table lists
the word (`evidence`: line, digest, pointer and the cell's text). It cites no
Wiktionary revision, since the rule reads none.

**Why the gloss's opening must name a form.** ADR 0030 adds an edge "on a form
record". A gloss can name a word after "di" without saying it is a form of it:
`chimico`'s "studioso di chimica" and `appoggio`'s "diritto di appoggiare il
proprio edificio", although `chimica`'s and `appoggiare`'s tables list those
words. Those 97 senses stay as the source states them (`not-a-form-gloss`
below). Misspelt openings (`pòurale`, `fmminile`) are left alone the same way.

**What the rule does not do.** A sense whose edge names another word is not the
rule's: question 9 fixed only `parti`'s two `parto` lines, which are hand
entries in [src/italian/curatedCorrections.ts](../src/italian/curatedCorrections.ts)
citing `parto`'s line 42147. The 746 other such senses below
(`edge-names-another-word`) are listed for a later ruling, not corrected. Many
name a reflexive verb (`svestito`, "participio passato di svestire,
svestirsi", names `svestirsi`), which is not plainly wrong.

## The count

Rule `it-form-of-gloss-edge/v1` on `it-0c432803`: 1939 senses of 1546 records get an edge; 2651 senses are left alone.

| Left alone because | Senses |
|---|---|
| another language's record (`not-italian`) | 1389 |
| a hand entry sets this sense's edge (`hand-entry`) | 2 |
| the gloss names the word itself (`names-itself`) | 23 |
| the gloss names the base after "di" and the base's table lists the word, but its opening does not say which form it is (`not-a-form-gloss`) | 97 |
| a form's gloss, and no Italian record of the base (`no-record-of-base`) | 95 |
| a form's gloss, and no Italian record of the base lists the word (`base-table-does-not-list`) | 299 |
| the sense's edge names another word, which only a ruling fixes (`edge-names-another-word`) | 746 |

## Edges added

| Line | Word | POS | Sense | Gloss | Edge to | Cited line |
|---|---|---|---|---|---|---|
| 606 | `telefonino` | verb | 0 | terza persona plurale del congiuntivo presente di telefonare | `telefonare` | 50191 /forms/69/form |
| 648 | `create` | verb | 1 | seconda persona plurale dell'indicativo presente di creare | `creare` | 75541 /forms/9/form |
| 648 | `create` | verb | 2 | seconda persona plurale dell'imperativo presente di creare | `creare` | 75541 /forms/9/form |
| 659 | `creative` | adj | 0 | femminile plurale di creativo | `creativo` | 113565 /forms/2/form |
| 1223 | `esplicito` | verb | 0 | prima persona singolare dell'indicativo presente di esplicitare | `esplicitare` | 107757 /forms/4/form |
| 1415 | `frana` | verb | 0 | terza persona singolare dell'indicativo presente di franare | `franare` | 138469 /forms/6/form |
| 1415 | `frana` | verb | 1 | seconda persona singolare dell'imperativo presente di franare | `franare` | 138469 /forms/6/form |
| 1888 | `tassa` | verb | 1 | seconda persona singolare dell'imperativo presente di tassare | `tassare` | 138194 /forms/6/form |
| 2059 | `macchina` | verb | 1 | seconda persona singolare dell'imperativo presente di macchinare | `macchinare` | 48699 /forms/6/form |
| 2568 | `fatica` | verb | 1 | seconda persona singolare dell'imperativo presente di faticare | `faticare` | 460948 /forms/6/form |
| 5483 | `aperture` | noun | 0 | plurale di apertura | `apertura` | 47557 /forms/0/form |
| 5688 | `devastate` | verb | 1 | seconda persona plurale dell'indicativo presente di devastare | `devastare` | 61959 /forms/8/form |
| 5688 | `devastate` | verb | 2 | seconda persona plurale dell'imperativo presente di devastare | `devastare` | 61959 /forms/8/form |
| 5926 | `assassinate` | adj | 0 | femminile plurale di assassinato | `assassinato` | 236485 /forms/2/form |
| 7153 | `dislocate` | verb | 1 | seconda persona plurale dell'indicativo presente di dislocare | `dislocare` | 446971 /forms/8/form |
| 7153 | `dislocate` | verb | 2 | seconda persona plurale dell'imperativo presente di dislocare | `dislocare` | 446971 /forms/8/form |
| 7460 | `tardi` | verb | 1 | prima persona singolare del congiuntivo presente di tardare | `tardare` | 418875 /forms/5/form |
| 7460 | `tardi` | verb | 2 | seconda persona singolare del congiuntivo presente di tardare | `tardare` | 418875 /forms/5/form |
| 7460 | `tardi` | verb | 3 | terza persona singolare del congiuntivo presente di tardare | `tardare` | 418875 /forms/5/form |
| 7460 | `tardi` | verb | 4 | terza persona singolare dell'imperativo presente di tardare | `tardare` | 418875 /forms/5/form |
| 7592 | `truffa` | verb | 1 | seconda persona singolare dell'imperativo presente di truffare | `truffare` | 72212 /forms/6/form |
| 8145 | `argomento` | verb | 0 | prima persona singolare dell'indicativo presente di argomentare | `argomentare` | 37697 /forms/4/form |
| 8197 | `paga` | verb | 1 | seconda persona singolare dell'imperativo presente di pagare | `pagare` | 134538 /forms/6/form |
| 8274 | `compra` | verb | 1 | seconda persona singolare dell'imperativo presente di comprare | `comprare` | 754 /forms/6/form |
| 8418 | `motivo` | verb | 0 | prima persona singolare dell'indicativo presente di motivare | `motivare` | 449541 /forms/4/form |
| 8486 | `costa` | verb | 0 | terza persona singolare dell'indicativo presente di costare | `costare` | 73468 /forms/6/form |
| 8486 | `costa` | verb | 1 | seconda persona singolare dell'imperativo presente di costare | `costare` | 73468 /forms/6/form |
| 8666 | `contato` | verb | 0 | participio passato di contare | `contare` | 8546 /forms/3/form |
| 9413 | `cocaine` | noun | 0 | plurale di cocaina | `cocaina` | 135656 /forms/0/form |
| 11245 | `flange` | noun | 0 | plurale di flangia | `flangia` | 111429 /forms/0/form |
| 12308 | `lustre` | adj | 0 | Femminile plurale di lustro | `lustro` | 92499 /forms/2/form |
| 12571 | `massive` | adj | 0 | femminile plurale di massivo | `massivo` | 500198 /forms/2/form |
| 12656 | `medicine` | noun | 0 | plurale di medicina | `medicina` | 1613 /forms/0/form |
| 14769 | `canina` | adj | 0 | femminile di canino | `canino` | 110483 /forms/1/form |
| 15027 | `carina` | adj | 0 | femminile di carino | `carino` | 33199 /forms/1/form |
| 15812 | `cresima` | verb | 0 | terza persona singolare dell'indicativo presente di cresimare | `cresimare` | 405160 /forms/6/form |
| 15812 | `cresima` | verb | 1 | seconda persona singolare dell'imperativo presente di cresimare | `cresimare` | 405160 /forms/6/form |
| 17472 | `sentì` | verb | 0 | terza persona singolare dell'indicativo passato remoto di sentire | `sentire` | 1473 /forms/19/form |
| 17598 | `molle` | adj | 3 | plurale di molla | `molla` | 41168 /forms/0/form |
| 18000 | `sovrana` | adj | 0 | femminile di sovrano | `sovrano` | 18002 /forms/1/form |
| 18001 | `sovrana` | noun | 0 | femminile di sovrano | `sovrano` | 18002 /forms/1/form |
| 18019 | `travaglio` | verb | 0 | prima persona singolare dell'indicativo presente di travagliare | `travagliare` | 50340 /forms/4/form |
| 18035 | `contessa` | noun | 0 | femminile di conte | `conte` | 48844 /forms/1/form |
| 18055 | `nicchia` | verb | 1 | seconda persona singolare dell'imperativo presente di nicchiare | `nicchiare` | 134270 /forms/6/form |
| 18131 | `monofore` | noun | 0 | plurale di monofora | `monofora` | 18130 /forms/0/form |
| 18139 | `trifore` | noun | 0 | plurale di trifora | `trifora` | 18138 /forms/0/form |
| 18466 | `serve` | verb | 0 | terza persona singolare dell'indicativo presente di servire | `servire` | 49989 /forms/7/form |
| 18615 | `bigotti` | noun | 0 | plurale di bigotto | `bigotto` | 18628 /forms/0/form |
| 21418 | `rime` | noun | 0 | plurale di rima | `rima` | 135678 /forms/0/form |
| 21946 | `sensitive` | noun | 0 | plurale di sensitiva | `sensitiva` | 615098 /forms/0/form |
| 22699 | `stupide` | noun | 0 | femminile plurale di stupido | `stupido` | 54450 /forms/2/form |
| 23622 | `vaccinate` | verb | 0 | participio passato plurale femminile di vaccinare | `vaccinare` | 404072 /forms/8/form |
| 23643 | `valse` | verb | 0 | participio passato plurale femminile di valere | `valere` | 45192 /forms/19/form |
| 23643 | `valse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di valere | `valere` | 45192 /forms/19/form |
| 24644 | `brune` | noun | 0 | femminile plurale di bruno | `bruno` | 80150 /forms/2/form |
| 28869 | `guasti` | verb | 0 | seconda persona singolare dell'indicativo presente di guastare | `guastare` | 455745 /forms/6/form |
| 28869 | `guasti` | verb | 1 | prima persona singolare del congiuntivo presente di guastare | `guastare` | 455745 /forms/6/form |
| 28869 | `guasti` | verb | 2 | seconda persona singolare del congiuntivo presente di guastare | `guastare` | 455745 /forms/6/form |
| 28869 | `guasti` | verb | 3 | terza persona singolare del congiuntivo presente di guastare | `guastare` | 455745 /forms/6/form |
| 28869 | `guasti` | verb | 4 | terza persona singolare dell'imperativo presente di guastare | `guastare` | 455745 /forms/6/form |
| 29052 | `vara` | verb | 1 | seconda persona singolare dell'imperativo presente di varare | `varare` | 135705 /forms/6/form |
| 30502 | `campionato` | verb | 0 | participio passato di campionare | `campionare` | 139531 /forms/3/form |
| 30776 | `balena` | verb | 1 | seconda persona singolare dell'imperativo presente di balenare | `balenare` | 477269 /forms/6/form |
| 31063 | `isola` | verb | 0 | terza persona singolare dell'indicativo presente di isolare | `isolare` | 8692 /forms/7/form |
| 31063 | `isola` | verb | 1 | seconda persona singolare dell'imperativo presente di isolare | `isolare` | 8692 /forms/7/form |
| 31174 | `serpe` | noun | 2 | plurale di serpa | `serpa` | 584291 /forms/0/form |
| 31392 | `regola` | verb | 0 | terza persona singolare dell'indicativo presente di regolare | `regolare` | 49180 /forms/7/form |
| 31392 | `regola` | verb | 1 | seconda persona singolare dell'imperativo presente di regolare | `regolare` | 49180 /forms/7/form |
| 31537 | `cassa` | verb | 1 | seconda persona singolare dell'imperativo presente di cassare | `cassare` | 39139 /forms/6/form |
| 31619 | `cucina` | verb | 1 | seconda persona singolare dell'imperativo presente di cucinare | `cucinare` | 31620 /forms/6/form |
| 31633 | `immondizie` | noun | 0 | plurale di immondizia | `immondizia` | 38702 /forms/0/form |
| 31990 | `leva` | verb | 0 | terza persona singolare dell'indicativo presente di levare | `levare` | 48685 /forms/7/form |
| 31990 | `leva` | verb | 1 | seconda persona singolare dell'imperativo di levare | `levare` | 48685 /forms/7/form |
| 32549 | `sagoma` | verb | 1 | seconda persona singolare dell'imperativo presente di sagomare | `sagomare` | 540788 /forms/6/form |
| 33274 | `questa` | pron | 0 | femminile di questo | `questo` | 39248 /forms/1/form |
| 33848 | `bastimenti` | noun | 0 | plurale di bastimento | `bastimento` | 129132 /forms/0/form |
| 33863 | `falcata` | adj | 0 | femminile di falcato | `falcato` | 131062 /forms/2/form |
| 33863 | `falcata` | adj | 1 | femminile di falcato | `falcato` | 131062 /forms/2/form |
| 33863 | `falcata` | adj | 2 | femminile di falcato | `falcato` | 131062 /forms/2/form |
| 33904 | `metrica` | adj | 0 | femminile di metrico | `metrico` | 596802 /forms/1/form |
| 34024 | `recluta` | verb | 1 | seconda persona singolare dell'imperativo presente di reclutare | `reclutare` | 475342 /forms/6/form |
| 37985 | `dai` | verb | 1 | seconda persona singolare dell'imperativo presente di dare | `dare` | 2340 /forms/6/form |
| 38129 | `importante` | verb | 0 | participio presente di importare | `importare` | 43434 /forms/2/form |
| 39385 | `piazza` | verb | 1 | seconda persona singolare dell'imperativo presente di piazzare | `piazzare` | 14784 /forms/7/form |
| 39920 | `molti` | pron | 0 | plurale maschile di molto | `molto` | 32403 /forms/0/form |
| 39927 | `lesina` | verb | 1 | seconda persona singolare dell'imperativo presente di lesinare | `lesinare` | 116617 /forms/6/form |
| 40038 | `insulto` | noun | 1 | prima persona singolare dell'indicativo presente di insultare | `insultare` | 48606 /forms/4/form |
| 40086 | `inculato` | verb | 0 | participio passato maschile di inculare | `inculare` | 40083 /forms/3/form |
| 40176 | `diaframma` | verb | 0 | terza persona singolare dell'indicativo presente di diaframmare | `diaframmare` | 543427 /forms/6/form |
| 40176 | `diaframma` | verb | 1 | seconda persona singolare dell'imperativo presente di diaframmare | `diaframmare` | 543427 /forms/6/form |
| 40369 | `usura` | verb | 0 | terza persona singolare dell'indicativo presente di usurare | `usurare` | 464027 /forms/6/form |
| 40369 | `usura` | verb | 1 | seconda persona singolare dell'imperativo presente di usurare | `usurare` | 464027 /forms/6/form |
| 40401 | `nota` | verb | 2 | participio passato femminile di notare | `notare` | 48760 /forms/6/form |
| 40552 | `fu` | verb | 0 | terza persona singolare dell'indicativo passato remoto di essere | `essere` | 2347 /forms/17/form |
| 40613 | `sua` | adj | 0 | femminile singolare di suo | `suo` | 33189 /forms/1/form |
| 41176 | `miei` | adj | 0 | plurale di mio | `mio` | 40604 /forms/0/form |
| 41177 | `lombi` | noun | 0 | plurale di lombo | `lombo` | 576057 /forms/0/form |
| 41180 | `punta` | verb | 2 | seconda persona singolare dell'imperativo presente di puntare | `puntare` | 8544 /forms/6/form |
| 41191 | `denti` | noun | 0 | plurale di dente | `dente` | 31983 /forms/0/form |
| 41312 | `brocca` | verb | 0 | terza persona singolare dell'indicativo presente di broccare | `broccare` | 479117 /forms/6/form |
| 41312 | `brocca` | verb | 1 | seconda persona singolare dell'imperativo presente di broccare | `broccare` | 479117 /forms/6/form |
| 41461 | `sala` | verb | 1 | seconda persona singolare dell'imperativo presente di salare | `salare` | 49468 /forms/6/form |
| 42838 | `timi` | noun | 0 | plurale di timo | `timo` | 54768 /forms/0/form |
| 43301 | `lapilli` | noun | 0 | plurale di lapillo | `lapillo` | 43300 /forms/0/form |
| 43697 | `tenere` | adj | 0 | femminile plurale di tenero | `tenero` | 54684 /forms/2/form |
| 44686 | `sano` | verb | 0 | prima persona singolare dell'indicativo presente di sanare | `sanare` | 404236 /forms/4/form |
| 44701 | `cercano` | verb | 0 | terza persona plurale dell'indicativo presente di cercare | `cercare` | 3302 /forms/9/form |
| 45195 | `seconda` | adj | 0 | femminile di secondo | `secondo` | 30437 /forms/1/form |
| 45198 | `seconda` | verb | 1 | seconda persona singolare dell'imperativo presente di secondare | `secondare` | 606898 /forms/6/form |
| 45447 | `ricorsi` | verb | 1 | prima persona singolare dell'indicativo passato remoto di ricorrere | `ricorrere` | 49222 /forms/16/form |
| 45499 | `spesa` | verb | 2 | seconda persona singolare dell'imperativo presente di spesare | `spesare` | 417072 /forms/6/form |
| 45586 | `fallo` | verb | 0 | prima persona singolare dell'indicativo presente di fallare | `fallare` | 104687 /forms/4/form |
| 45959 | `merci` | noun | 0 | plurale di merce | `merce` | 33969 /forms/0/form |
| 46136 | `disegni` | verb | 0 | seconda persona singolare dell'indicativo presente di disegnare | `disegnare` | 48287 /forms/5/form |
| 46136 | `disegni` | verb | 1 | prima persona singolare del congiuntivo presente di disegnare | `disegnare` | 48287 /forms/5/form |
| 46136 | `disegni` | verb | 2 | seconda persona singolare del congiuntivo presente di disegnare | `disegnare` | 48287 /forms/5/form |
| 46136 | `disegni` | verb | 3 | terza persona singolare del congiuntivo presente di disegnare | `disegnare` | 48287 /forms/5/form |
| 46136 | `disegni` | verb | 4 | terza persona singolare dell'imperativo presente di disegnare | `disegnare` | 48287 /forms/5/form |
| 46271 | `alimenti` | verb | 0 | seconda persona singolare dell'indicativo presente di alimentare | `alimentare` | 47581 /forms/6/form |
| 46271 | `alimenti` | verb | 1 | prima persona singolare del congiuntivo presente di alimentare | `alimentare` | 47581 /forms/6/form |
| 46271 | `alimenti` | verb | 2 | seconda persona singolare del congiuntivo presente di alimentare | `alimentare` | 47581 /forms/6/form |
| 46271 | `alimenti` | verb | 3 | terza persona singolare del congiuntivo presente di alimentare | `alimentare` | 47581 /forms/6/form |
| 46274 | `modelli` | verb | 1 | prima persona singolare del congiuntivo di modellare | `modellare` | 48735 /forms/6/form |
| 46274 | `modelli` | verb | 2 | seconda persona singolare del congiuntivo presente di modellare | `modellare` | 48735 /forms/6/form |
| 46274 | `modelli` | verb | 3 | terza persona singolare del congiuntivo presente di modellare | `modellare` | 48735 /forms/6/form |
| 46274 | `modelli` | verb | 4 | terza persona singolare dell'imperativo presente di modellare | `modellare` | 48735 /forms/6/form |
| 46690 | `intuito` | verb | 0 | participio passato di intuire | `intuire` | 418450 /forms/3/form |
| 47197 | `accetta` | adj | 0 | femminile singolare di accetto | `accetto` | 50797 /forms/1/form |
| 47585 | `araba` | adj | 0 | femminile di arabo | `arabo` | 476 /forms/1/form |
| 47615 | `armi` | verb | 1 | prima persona singolare del congiuntivo presente di armare | `armare` | 137875 /forms/6/form |
| 47615 | `armi` | verb | 2 | seconda persona singolare del congiuntivo presente di armare | `armare` | 137875 /forms/6/form |
| 47615 | `armi` | verb | 3 | terza persona singolare del congiuntivo presente di armare | `armare` | 137875 /forms/6/form |
| 47615 | `armi` | verb | 4 | terza persona singolare dell'imperativo presente di armare | `armare` | 137875 /forms/6/form |
| 47826 | `avanzo` | noun | 1 | prima persona singolare dell'indicativo presente di avanzare | `avanzare` | 134210 /forms/4/form |
| 47849 | `avvento` | verb | 0 | prima persona singolare dell'indicativo presente di avventare | `avventare` | 520726 /forms/5/form |
| 47869 | `bagnato` | verb | 0 | participio passato maschile singolare di bagnare | `bagnare` | 131958 /forms/4/form |
| 47897 | `bastarda` | adj | 0 | femminile di bastardo | `bastardo` | 40130 /forms/1/form |
| 47898 | `bastarda` | noun | 0 | femminile di bastardo | `bastardo` | 40130 /forms/1/form |
| 48036 | `buttata` | adj | 0 | femminile di buttato | `buttato` | 227082 /forms/1/form |
| 48049 | `cadenza` | verb | 0 | terza persona singolare dell'indicativo presente di cadenzare | `cadenzare` | 524537 /forms/6/form |
| 48049 | `cadenza` | verb | 1 | seconda persona singolare dell'imperativo presente di cadenzare | `cadenzare` | 524537 /forms/6/form |
| 48075 | `calma` | verb | 0 | terza persona singolare dell'indicativo presente di calmare | `calmare` | 760 /forms/7/form |
| 48075 | `calma` | verb | 1 | seconda persona singolare dell'imperativo presente di calmare | `calmare` | 760 /forms/7/form |
| 48283 | `chiavi` | verb | 1 | prima persona singolare del congiuntivo presente di chiavare | `chiavare` | 24382 /forms/5/form |
| 48283 | `chiavi` | verb | 2 | seconda persona singolare del congiuntivo presente di chiavare | `chiavare` | 24382 /forms/5/form |
| 48283 | `chiavi` | verb | 3 | terza persona singolare del congiuntivo presente di chiavare | `chiavare` | 24382 /forms/5/form |
| 48283 | `chiavi` | verb | 4 | terza persona singolare dell'imperativo presente di chiavare | `chiavare` | 24382 /forms/5/form |
| 48449 | `colate` | verb | 0 | participio passato plurale femminile di colare | `colare` | 442769 /forms/9/form |
| 48805 | `coniglia` | noun | 0 | femminile di coniglio | `coniglio` | 191 /forms/1/form |
| 48849 | `contenuto` | adj | 0 | participio passato di contenere | `contenere` | 48119 /forms/4/form |
| 48881 | `corona` | verb | 0 | terza persona singolare dell'indicativo presente di coronare | `coronare` | 538032 /forms/6/form |
| 48881 | `corona` | verb | 1 | seconda persona singolare dell'imperativo presente di coronare | `coronare` | 538032 /forms/6/form |
| 49123 | `dannati` | adj | 0 | plurale di dannato | `dannato` | 226331 /forms/0/form |
| 49124 | `dannati` | noun | 0 | plurale di dannato | `dannato` | 226331 /forms/0/form |
| 49391 | `diserbante` | verb | 0 | participio presente di diserbare | `diserbare` | 460749 /forms/2/form |
| 49455 | `domicilio` | verb | 0 | prima persona singolare dell'indicativo presente di domiciliare | `domiciliare` | 52693 /forms/5/form |
| 49754 | `ferma` | verb | 0 | terza persona singolare dell'indicativo presente di fermare | `fermare` | 48455 /forms/7/form |
| 49754 | `ferma` | verb | 1 | seconda persona singolare dell'imperativo presente di fermare | `fermare` | 48455 /forms/7/form |
| 49874 | `forza` | verb | 1 | seconda persona singolare dell'imperativo di forzare | `forzare` | 48490 /forms/6/form |
| 50600 | `insidia` | verb | 0 | terza persona singolare dell'indicativo presente di insidiare | `insidiare` | 462376 /forms/6/form |
| 51202 | `laureando` | verb | 0 | gerundio presente di laureare | `laureare` | 547967 /forms/2/form |
| 51493 | `magnanine` | noun | 0 | plurale di magnanina. | `magnanina` | 51492 /forms/0/form |
| 51831 | `misura` | verb | 1 | seconda persona dell'imperativo di misurare | `misurare` | 48733 /forms/7/form |
| 52131 | `ospedaliera` | noun | 0 | femminile di ospedaliero | `ospedaliero` | 52132 /forms/1/form |
| 52339 | `pizzicato` | verb | 0 | participio passato di pizzicare | `pizzicare` | 48972 /forms/3/form |
| 52421 | `posta` | verb | 2 | seconda persona singolare dell'imperativo presente di postare | `postare` | 48986 /forms/6/form |
| 52485 | `pressi` | verb | 1 | prima persona singolare del congiuntivo presente di pressare | `pressare` | 447165 /forms/5/form |
| 52485 | `pressi` | verb | 2 | seconda persona singolare del congiuntivo presente di pressare | `pressare` | 447165 /forms/5/form |
| 52485 | `pressi` | verb | 3 | terza persona singolare del congiuntivo presente di pressare | `pressare` | 447165 /forms/5/form |
| 52485 | `pressi` | verb | 4 | terza persona singolare dell'imperativo presente di pressare | `pressare` | 447165 /forms/5/form |
| 52516 | `principessa` | noun | 0 | femminile di principe | `principe` | 52514 /forms/1/form |
| 52558 | `profana` | adj | 0 | Femminile di profano. | `profano` | 52560 /forms/1/form |
| 52626 | `proverbi` | noun | 0 | plurale di proverbio | `proverbio` | 45732 /forms/0/form |
| 52676 | `divino` | verb | 0 | prima persona singolare dell'indicativo presente di divinare | `divinare` | 464884 /forms/4/form |
| 52807 | `emergente` | verb | 0 | participio presente di emergere | `emergere` | 48370 /forms/2/form |
| 53057 | `rinuncia` | verb | 1 | seconda persona singolare dell'imperativo di rinunciare | `rinunciare` | 49282 /forms/6/form |
| 53163 | `romanza` | adj | 0 | femminile di romanzo | `romanzo` | 32560 /forms/1/form |
| 53212 | `sabina` | noun | 0 | femminile di sabino | `sabino` | 544724 /forms/1/form |
| 53271 | `santa` | adj | 0 | femminile singolare di santo | `santo` | 16336 /forms/1/form |
| 53435 | `impossibilitato` | verb | 0 | participio passato di impossibilitare | `impossibilitare` | 582825 /forms/3/form |
| 53627 | `infetto` | verb | 0 | prima persona singolare dell'indicativo presente di infettare | `infettare` | 446906 /forms/4/form |
| 53630 | `infiammato` | verb | 0 | participio passato di infiammare | `infiammare` | 135586 /forms/4/form |
| 53787 | `inventato` | verb | 0 | participio passato di inventare | `inventare` | 48664 /forms/3/form |
| 53948 | `scoperta` | adj | 0 | femminile di scoperto | `scoperto` | 76794 /forms/1/form |
| 53990 | `seguito` | verb | 1 | prima persona singolare dell'indicativo presente di seguitare | `seguitare` | 398561 /forms/5/form |
| 54094 | `slava` | adj | 0 | femminile di slavo | `slavo` | 54102 /forms/1/form |
| 54109 | `smentita` | verb | 0 | participio passato femminile di smentito | `smentito` | 374794 /forms/1/form |
| 54417 | `strega` | verb | 1 | seconda persona singolare dell'imperativo presente di stregare | `stregare` | 620346 /forms/6/form |
| 54441 | `motivato` | verb | 0 | participio passato di motivare | `motivare` | 449541 /forms/3/form |
| 54445 | `stufa` | verb | 1 | seconda persona singolare dell'imperativo di stufare | `stufare` | 460396 /forms/7/form |
| 54532 | `sveglia` | adj | 0 | femminile di sveglio | `sveglio` | 55376 /forms/1/form |
| 54534 | `sveglia` | verb | 1 | seconda persona singolare dell'imperativo di svegliare | `svegliare` | 50136 /forms/7/form |
| 54689 | `tenuta` | adj | 0 | femminile di tenuto | `tenuto` | 415002 /forms/1/form |
| 54790 | `tirata` | adj | 0 | femminile di tirato | `tirato` | 169811 /forms/1/form |
| 54816 | `predefinito` | verb | 0 | participio passato di predefinire | `predefinire` | 49005 /forms/3/form |
| 54858 | `programmato` | verb | 0 | participio passato di programmare | `programmare` | 49094 /forms/3/form |
| 54862 | `proibito` | verb | 0 | participio passato maschile singolare di proibire | `proibire` | 49096 /forms/3/form |
| 55096 | `sognante` | verb | 0 | participio presente di sognare | `sognare` | 3287 /forms/3/form |
| 55165 | `trama` | verb | 1 | seconda persona singolare imperativo di tramare | `tramare` | 32559 /forms/6/form |
| 55209 | `specifico` | verb | 0 | prima persona singolare dell'indicativo presente di specificare | `specificare` | 582663 /forms/4/form |
| 55222 | `trattino` | verb | 1 | terza persona plurale dell'imperativo presente di trattare | `trattare` | 50327 /forms/70/form |
| 55266 | `trombettiere` | noun | 0 | plurale di trombettiera | `trombettiera` | 464037 /forms/0/form |
| 55615 | `visto` | verb | 1 | prima persona singolare dell'indicativo presente di vistare | `vistare` | 581941 /forms/4/form |
| 55666 | `voli` | verb | 2 | seconda persona singolare congiuntivo presente di volare | `volare` | 33319 /forms/5/form |
| 55666 | `voli` | verb | 3 | terza persona singolare congiuntivo presente di volare | `volare` | 33319 /forms/5/form |
| 55954 | `adriatica` | adj | 0 | femminile di adriatico | `adriatico` | 50818 /forms/1/form |
| 55955 | `adriatiche` | adj | 0 | Femminile plurale di adriatico | `adriatico` | 50818 /forms/2/form |
| 56022 | `alpina` | adj | 0 | femminile di alpino | `alpino` | 47409 /forms/1/form |
| 56023 | `alpina` | noun | 0 | femminile di alpino | `alpino` | 47409 /forms/1/form |
| 56024 | `alpine` | adj | 0 | femminile plurale di alpino | `alpino` | 47409 /forms/2/form |
| 56025 | `alpine` | noun | 0 | femminile plurale di alpino | `alpino` | 47409 /forms/2/form |
| 56111 | `analitica` | adj | 0 | plurale di analitico | `analitico` | 33847 /forms/1/form |
| 56113 | `analitiche` | adj | 0 | femminile plurale di analitico | `analitico` | 33847 /forms/2/form |
| 56152 | `anniversari` | noun | 0 | plurale di anniversario | `anniversario` | 47520 /forms/0/form |
| 56223 | `appassionate` | verb | 1 | seconda persona plurale dell'indicativo presente di appassionare | `appassionare` | 460458 /forms/9/form |
| 56223 | `appassionate` | verb | 2 | seconda persona plurale dell'imperativo presente di appassionare | `appassionare` | 460458 /forms/9/form |
| 56633 | `carine` | adj | 0 | femminile plurale di carino | `carino` | 33199 /forms/2/form |
| 56635 | `carini` | adj | 0 | plurale di carino | `carino` | 33199 /forms/0/form |
| 56752 | `chimerica` | adj | 0 | femminile di chimerico | `chimerico` | 51010 /forms/1/form |
| 57041 | `connesse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di connettere | `connettere` | 48080 /forms/20/form |
| 57092 | `contenta` | verb | 0 | terza persona singolare dell'indicativo presente di contentare | `contentare` | 537414 /forms/6/form |
| 57092 | `contenta` | verb | 1 | seconda persona singolare dell'imperativo presente di contentare | `contentare` | 537414 /forms/6/form |
| 57123 | `contraria` | verb | 1 | seconda persona singolare dell'imperativo presente di contrariare | `contrariare` | 464422 /forms/6/form |
| 57413 | `deplorevoli` | adj | 0 | plurale di deplorevole | `deplorevole` | 51372 /forms/0/form |
| 57499 | `differenziate` | verb | 1 | seconda persona plurale dell'indicativo presente di differenziare | `differenziare` | 48243 /forms/9/form |
| 57499 | `differenziate` | verb | 2 | seconda persona plurale del congiuntivo presente di differenziare | `differenziare` | 48243 /forms/9/form |
| 57499 | `differenziate` | verb | 3 | seconda persona plurale dell'imperativo presente di differenziare | `differenziare` | 48243 /forms/9/form |
| 57522 | `diplomatica` | noun | 0 | femminile di diplomatico | `diplomatico` | 40865 /forms/1/form |
| 57533 | `diritta` | adj | 0 | Femminile di diritto. | `diritto` | 39411 /forms/1/form |
| 57581 | `divina` | verb | 1 | seconda persona singolare dell'imperativo presente di divinare | `divinare` | 464884 /forms/6/form |
| 57818 | `espresse` | verb | 0 | participio passato plurale femminile di esprimere | `esprimere` | 48428 /forms/19/form |
| 57818 | `espresse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di esprimere | `esprimere` | 48428 /forms/19/form |
| 57899 | `faticosi` | adj | 0 | plurale di faticoso | `faticoso` | 53069 /forms/0/form |
| 57949 | `fesse` | noun | 0 | femminile plurale di fesso | `fesso` | 49759 /forms/2/form |
| 58167 | `grigiastri` | adj | 0 | plurale di grigiastro | `grigiastro` | 53348 /forms/0/form |
| 58168 | `grigiastri` | noun | 0 | plurale di grigiastro | `grigiastro` | 53348 /forms/0/form |
| 58736 | `infiammate` | verb | 1 | seconda persona plurale dell'indicativo presente di infiammare | `infiammare` | 135586 /forms/9/form |
| 58736 | `infiammate` | verb | 2 | seconda persona plurale dell'imperativo presente di infiammare | `infiammare` | 135586 /forms/9/form |
| 58761 | `informativa` | adj | 0 | Femminile di informativo. | `informativo` | 53639 /forms/1/form |
| 58805 | `inibita` | noun | 0 | femminile di inibito | `inibito` | 50538 /forms/1/form |
| 58807 | `inibite` | noun | 0 | femminile plurale di inibito | `inibito` | 50538 /forms/2/form |
| 58835 | `innovativa` | adj | 0 | Femminile di innovativo. | `innovativo` | 38118 /forms/1/form |
| 58949 | `integrali` | noun | 0 | plurale di integrale | `integrale` | 53716 /forms/0/form |
| 59072 | `introversa` | adj | 0 | Femminile di introverso. | `introverso` | 50725 /forms/1/form |
| 59075 | `intuitive` | adj | 0 | femminile plurale di intuitivo | `intuitivo` | 53769 /forms/2/form |
| 59097 | `invasive` | adj | 0 | Femminile plurale di invasivo. | `invasivo` | 53783 /forms/2/form |
| 59101 | `inventive` | noun | 0 | plurale di inventiva | `inventiva` | 75529 /forms/0/form |
| 59106 | `inversa` | adj | 0 | Femminile di inverso. | `inverso` | 50743 /forms/1/form |
| 59153 | `ipocrite` | noun | 0 | femminile plurale di ipocrita | `ipocrita` | 33347 /forms/1/form |
| 59162 | `irachena` | adj | 0 | Femminile singolare di iracheno. | `iracheno` | 51033 /forms/1/form |
| 59199 | `irrisolta` | adj | 0 | Femminile singolare di irrisolto. | `irrisolto` | 53841 /forms/1/form |
| 59203 | `irrisoria` | adj | 0 | Femminile singolare di irrisorio. | `irrisorio` | 134516 /forms/1/form |
| 59226 | `isolate` | verb | 1 | seconda persona plurale imperativo di isolare | `isolare` | 8692 /forms/9/form |
| 59226 | `isolate` | verb | 2 | femminile plurale participio passato di isolare | `isolare` | 8692 /forms/9/form |
| 59234 | `israeliana` | adj | 0 | Femminile singolare di israeliano. | `israeliano` | 51083 /forms/1/form |
| 59245 | `istintiva` | adj | 0 | Femminile singolare di istintivo. | `istintivo` | 51103 /forms/1/form |
| 59247 | `istituita` | adj | 0 | Femminile singolare di istituito. | `istituito` | 51109 /forms/1/form |
| 59346 | `legittimi` | verb | 3 | terza persona singolare del congiuntivo presente di legittimare | `legittimare` | 77302 /forms/5/form |
| 59402 | `lordi` | verb | 1 | prima persona singolare del congiuntivo presente di lordare | `lordare` | 121684 /forms/5/form |
| 59402 | `lordi` | verb | 2 | seconda persona singolare del congiuntivo presente di lordare | `lordare` | 121684 /forms/5/form |
| 59402 | `lordi` | verb | 3 | terza persona singolare del congiuntivo presente di lordare | `lordare` | 121684 /forms/5/form |
| 59402 | `lordi` | verb | 4 | terza persona singolare dell'imperativo presente di lordare | `lordare` | 121684 /forms/5/form |
| 59503 | `magrebina` | adj | 0 | Femminile singolare di magrebino. | `magrebino` | 43234 /forms/1/form |
| 59594 | `marziana` | adj | 0 | Femminile singolare di marziano. | `marziano` | 51603 /forms/1/form |
| 59596 | `marzolina` | adj | 0 | Femminile singolare di marzolino. | `marzolino` | 54330 /forms/1/form |
| 59600 | `maschie` | adj | 0 | Femminile plurale di maschio | `maschio` | 42445 /forms/2/form |
| 59607 | `materna` | adj | 0 | Femminile singolare di materno. | `materno` | 54340 /forms/1/form |
| 59677 | `milanesi` | noun | 0 | plurale di milanese | `milanese` | 40295 /forms/0/form |
| 59732 | `molte` | pron | 0 | plurale di molta | `molta` | 51849 /forms/0/form |
| 59740 | `monde` | adj | 0 | femminile plurale di mondo | `mondo` | 51859 /forms/2/form |
| 59963 | `operativa` | adj | 0 | femminile di operativo | `operativo` | 54632 /forms/1/form |
| 59967 | `operativi` | adj | 0 | plurale di operativo | `operativo` | 54632 /forms/0/form |
| 60161 | `pariolina` | adj | 0 | Femminile singolare di pariolino. | `pariolino` | 93293 /forms/1/form |
| 60250 | `perpetui` | verb | 1 | prima persona singolare del congiuntivo presente di perpetuare | `perpetuare` | 449921 /forms/5/form |
| 60250 | `perpetui` | verb | 2 | seconda persona singolare del congiuntivo presente di perpetuare | `perpetuare` | 449921 /forms/5/form |
| 60250 | `perpetui` | verb | 3 | terza persona singolare del congiuntivo presente di perpetuare | `perpetuare` | 449921 /forms/5/form |
| 60275 | `pidocchiose` | adj | 0 | femminile plurale di pidocchioso | `pidocchioso` | 551402 /forms/2/form |
| 60276 | `pidocchiose` | noun | 0 | femminile plurale di pidocchioso | `pidocchioso` | 551402 /forms/2/form |
| 60342 | `precisa` | adj | 0 | femminile di preciso | `preciso` | 54811 /forms/1/form |
| 60343 | `precisa` | verb | 1 | seconda persona singolare dell'imperativo presente di precisare | `precisare` | 49002 /forms/6/form |
| 60354 | `preferite` | verb | 0 | participio passato plurale femminile di preferire | `preferire` | 49008 /forms/8/form |
| 60354 | `preferite` | verb | 1 | seconda persona plurale dell'indicativo presente di preferire | `preferire` | 49008 /forms/8/form |
| 60354 | `preferite` | verb | 2 | seconda persona plurale dell'imperativo presente di preferire | `preferire` | 49008 /forms/8/form |
| 60545 | `quella` | pron | 0 | femminile di quello | `quello` | 33211 /forms/1/form |
| 60556 | `quotidiani` | noun | 0 | plurale di quotidiano | `quotidiano` | 52719 /forms/0/form |
| 61224 | `raggrinzito` | verb | 0 | participio passato di raggrinzire | `raggrinzire` | 467060 /forms/4/form |
| 61301 | `esercizi` | noun | 0 | Plurale di esercizio. | `esercizio` | 32811 /forms/0/form |
| 61841 | `resti` | verb | 1 | prima persona singolare del congiuntivo presente di restare | `restare` | 49196 /forms/5/form |
| 61841 | `resti` | verb | 2 | seconda persona singolare del congiuntivo presente di restare | `restare` | 49196 /forms/5/form |
| 61841 | `resti` | verb | 3 | terza persona singolare del congiuntivo presente di restare | `restare` | 49196 /forms/5/form |
| 61841 | `resti` | verb | 4 | terza persona singolare dell'imperativo presente di restare | `restare` | 49196 /forms/5/form |
| 61881 | `cere` | noun | 0 | Plurale di cera | `cera` | 15232 /forms/0/form |
| 61903 | `colori` | verb | 1 | prima persona singolare del congiuntivo presente di colorare | `colorare` | 48014 /forms/5/form |
| 61903 | `colori` | verb | 2 | seconda persona singolare del congiuntivo presente di colorare | `colorare` | 48014 /forms/5/form |
| 61903 | `colori` | verb | 3 | terza persona singolare del congiuntivo presente di colorare | `colorare` | 48014 /forms/5/form |
| 61903 | `colori` | verb | 4 | terza persona singolare dell'imperativo presente di colorare | `colorare` | 48014 /forms/5/form |
| 62149 | `sfoderato` | verb | 0 | participio passato di sfoderare | `sfoderare` | 62147 /forms/3/form |
| 62375 | `eminenze` | noun | 0 | plurale di eminenza | `eminenza` | 43128 /forms/0/form |
| 62384 | `epistemici` | adj | 0 | plurale di epistemico | `epistemico` | 62348 /forms/0/form |
| 62423 | `producente` | verb | 0 | participio presente di produrre | `produrre` | 49080 /forms/3/form |
| 62428 | `producenti` | adj | 0 | plurale di producente | `producente` | 62424 /forms/0/form |
| 62431 | `apofantici` | adj | 0 | plurale di apofantico | `apofantico` | 62430 /forms/0/form |
| 62449 | `potabilizzazioni` | noun | 0 | plurale di potabilizzazione | `potabilizzazione` | 62448 /forms/0/form |
| 62542 | `inopinati` | adj | 0 | plurale di inopinato | `inopinato` | 38577 /forms/0/form |
| 62543 | `inopinate` | adj | 0 | plurale femminile di inopinato | `inopinato` | 38577 /forms/2/form |
| 62544 | `inopinata` | adj | 0 | femminile di inopinato | `inopinato` | 38577 /forms/1/form |
| 62546 | `vincoli` | verb | 1 | prima persona singolare del congiuntivo presente di vincolare | `vincolare` | 50490 /forms/5/form |
| 62546 | `vincoli` | verb | 2 | seconda persona singolare del congiuntivo presente di vincolare | `vincolare` | 50490 /forms/5/form |
| 62546 | `vincoli` | verb | 3 | terza persona singolare del congiuntivo presente di vincolare | `vincolare` | 50490 /forms/5/form |
| 62546 | `vincoli` | verb | 4 | terza persona singolare dell'imperativo presente di vincolare | `vincolare` | 50490 /forms/5/form |
| 63122 | `bacilli` | noun | 0 | plurale di bacillo | `bacillo` | 103714 /forms/0/form |
| 63841 | `rade` | noun | 0 | plurale di rada | `rada` | 63838 /forms/2/form |
| 64227 | `acarofobie` | noun | 0 | plurale di acarofobia | `acarofobia` | 64225 /forms/0/form |
| 64232 | `acrofobie` | noun | 0 | plurale di acrofobia | `acrofobia` | 64059 /forms/0/form |
| 64312 | `aeroacrofobie` | noun | 0 | plurale di aeroacrofobia | `aeroacrofobia` | 64311 /forms/0/form |
| 64498 | `fili` | verb | 1 | prima persona singolare del congiuntivo presente di filare | `filare` | 122028 /forms/5/form |
| 64498 | `fili` | verb | 2 | seconda persona singolare del congiuntivo presente di filare | `filare` | 122028 /forms/5/form |
| 64498 | `fili` | verb | 3 | terza persona singolare del congiuntivo presente di filare | `filare` | 122028 /forms/5/form |
| 64498 | `fili` | verb | 4 | terza persona singolare dell'imperativo presente di filare | `filare` | 122028 /forms/5/form |
| 64548 | `sali` | verb | 6 | seconda persona singolare dell'imperativo presente di salire | `salire` | 49483 /forms/5/form |
| 64596 | `abbandonate` | verb | 1 | seconda persona plurale dell'indicativo presente di abbandonare | `abbandonare` | 738 /forms/9/form |
| 64596 | `abbandonate` | verb | 2 | seconda persona plurale dell'imperativo presente di abbandonare | `abbandonare` | 738 /forms/9/form |
| 64665 | `schiaffi` | verb | 0 | seconda persona singolare dell'indicativo presente di schiaffare | `schiaffare` | 64681 /forms/5/form |
| 64665 | `schiaffi` | verb | 1 | prima persona singolare del congiuntivo presente di schiaffare | `schiaffare` | 64681 /forms/5/form |
| 64665 | `schiaffi` | verb | 4 | terza persona singolare dell'imperativo presente di schiaffare | `schiaffare` | 64681 /forms/5/form |
| 64779 | `Americhe` | name | 0 | plurale di America | `America` | 5293 /forms/0/form |
| 64792 | `percosse` | verb | 0 | participio passato plurale femminile di percuotere | `percuotere` | 125465 /forms/18/form |
| 64935 | `incollature` | noun | 0 | plurale di incollatura | `incollatura` | 64934 /forms/0/form |
| 64970 | `numeri` | verb | 1 | prima persona singolare del congiuntivo presente di numerare | `numerare` | 43713 /forms/5/form |
| 64970 | `numeri` | verb | 2 | seconda persona singolare del congiuntivo presente di numerare | `numerare` | 43713 /forms/5/form |
| 64970 | `numeri` | verb | 3 | terza persona singolare del congiuntivo presente di numerare | `numerare` | 43713 /forms/5/form |
| 64970 | `numeri` | verb | 4 | terza persona singolare dell'imperativo presente di numerare | `numerare` | 43713 /forms/5/form |
| 65007 | `lucidi` | verb | 0 | seconda persona singolare dell'indicativo presente di lucidare | `lucidare` | 64912 /forms/5/form |
| 65007 | `lucidi` | verb | 1 | prima persona singolare del congiuntivo presente di lucidare | `lucidare` | 64912 /forms/5/form |
| 65007 | `lucidi` | verb | 2 | seconda persona singolare del congiuntivo presente di lucidare | `lucidare` | 64912 /forms/5/form |
| 65007 | `lucidi` | verb | 3 | terza persona singolare del congiuntivo presente di lucidare | `lucidare` | 64912 /forms/5/form |
| 65007 | `lucidi` | verb | 4 | terza persona singolare dell'imperativo presente di lucidare | `lucidare` | 64912 /forms/5/form |
| 65402 | `argomenti` | verb | 1 | prima persona singolare del congiuntivo presente di argomentare | `argomentare` | 37697 /forms/5/form |
| 65402 | `argomenti` | verb | 2 | seconda persona singolare del congiuntivo presente di argomentare | `argomentare` | 37697 /forms/5/form |
| 65402 | `argomenti` | verb | 3 | terza persona singolare del congiuntivo presente di argomentare | `argomentare` | 37697 /forms/5/form |
| 65402 | `argomenti` | verb | 4 | terza persona singolare dell'imperativo presente di argomentare | `argomentare` | 37697 /forms/5/form |
| 65415 | `diversi` | verb | 0 | prima persona singolare dell'indicativo passato remoto di divergere | `divergere` | 419747 /forms/16/form |
| 65417 | `questi` | pron | 0 | plurale di questo | `questo` | 39248 /forms/0/form |
| 65420 | `sospetti` | verb | 1 | prima persona singolare del congiuntivo presente di sospettare | `sospettare` | 50036 /forms/5/form |
| 65420 | `sospetti` | verb | 2 | seconda persona singolare del congiuntivo presente di sospettare | `sospettare` | 50036 /forms/5/form |
| 65420 | `sospetti` | verb | 3 | terza persona singolare del congiuntivo presente di sospettare | `sospettare` | 50036 /forms/5/form |
| 65420 | `sospetti` | verb | 4 | terza persona singolare dell'imperativo presente di sospettare | `sospettare` | 50036 /forms/5/form |
| 69055 | `accecato` | verb | 0 | participio passato di accecare | `accecare` | 46392 /forms/4/form |
| 69113 | `selvatici` | adj | 0 | plurale di selvatico | `selvatico` | 55038 /forms/0/form |
| 69145 | `sporchi` | adj | 0 | plurale di sporco | `sporco` | 31651 /forms/0/form |
| 69147 | `aerei` | noun | 0 | plurale di aereo | `aereo` | 2298 /forms/0/form |
| 69658 | `idiopatica` | adj | 0 | femminile di idiopatico | `idiopatico` | 69656 /forms/1/form |
| 69706 | `bruciata` | adj | 0 | femminile singolare di bruciato | `bruciato` | 50978 /forms/1/form |
| 70011 | `spazi` | verb | 1 | prima persona singolare del congiuntivo presente di spaziare | `spaziare` | 134027 /forms/5/form |
| 70011 | `spazi` | verb | 2 | seconda persona singolare del congiuntivo presente di spaziare | `spaziare` | 134027 /forms/5/form |
| 70011 | `spazi` | verb | 3 | terza persona singolare del congiuntivo presente di spaziare | `spaziare` | 134027 /forms/5/form |
| 70011 | `spazi` | verb | 4 | terza persona singolare dell'imperativo presente di spaziare | `spaziare` | 134027 /forms/5/form |
| 70288 | `galoppino` | verb | 1 | terza persona plurale dell'imperativo presente di galoppare | `galoppare` | 459220 /forms/69/form |
| 70294 | `aree` | noun | 0 | plurale di area | `area` | 5780 /forms/0/form |
| 70306 | `banani` | noun | 0 | plurale di banano | `banano` | 70305 /forms/0/form |
| 70581 | `quadri` | verb | 2 | seconda persona singolare del congiuntivo presente di quadrare | `quadrare` | 458788 /forms/5/form |
| 70739 | `vernici` | verb | 1 | prima persona singolare del congiuntivo presente di verniciare | `verniciare` | 458776 /forms/5/form |
| 70739 | `vernici` | verb | 2 | seconda persona singolare del congiuntivo presente di verniciare | `verniciare` | 458776 /forms/5/form |
| 70739 | `vernici` | verb | 3 | terza persona singolare del congiuntivo presente di verniciare | `verniciare` | 458776 /forms/5/form |
| 70739 | `vernici` | verb | 4 | terza persona singolare dell'imperativo presente di verniciare | `verniciare` | 458776 /forms/5/form |
| 71558 | `modulatori` | noun | 0 | plurale di modulatore | `modulatore` | 71498 /forms/0/form |
| 71564 | `abbaiante` | verb | 0 | participio presente di abbaiare | `abbaiare` | 33616 /forms/2/form |
| 71567 | `abbaiato` | verb | 0 | participio passato di abbaiare | `abbaiare` | 33616 /forms/3/form |
| 71576 | `abballato` | verb | 0 | participio passato di abballare | `abballare` | 46078 /forms/3/form |
| 71975 | `ubriachi` | verb | 1 | prima persona singolare del congiuntivo presente di ubriacare | `ubriacare` | 461015 /forms/6/form |
| 71975 | `ubriachi` | verb | 2 | seconda persona singolare del congiuntivo presente di ubriacare | `ubriacare` | 461015 /forms/6/form |
| 71975 | `ubriachi` | verb | 3 | terza persona singolare del congiuntivo presente di ubriacare | `ubriacare` | 461015 /forms/6/form |
| 72114 | `catapulta` | verb | 0 | terza persona singolare dell'indicativo presente di catapultare | `catapultare` | 447184 /forms/6/form |
| 72354 | `acrobazie` | noun | 0 | plurale di acrobazia | `acrobazia` | 72353 /forms/0/form |
| 72380 | `sferoscopi` | noun | 0 | plurale di sferoscopio | `sferoscopio` | 72379 /forms/0/form |
| 72381 | `punti` | adj | 0 | plurale di punto | `punto` | 52668 /forms/0/form |
| 72383 | `punti` | verb | 1 | prima persona singolare del congiuntivo presente di puntare | `puntare` | 8544 /forms/5/form |
| 72383 | `punti` | verb | 2 | seconda persona singolare del congiuntivo presente di puntare | `puntare` | 8544 /forms/5/form |
| 72383 | `punti` | verb | 3 | terza persona singolare del congiuntivo presente di puntare | `puntare` | 8544 /forms/5/form |
| 72383 | `punti` | verb | 4 | terza persona singolare dell'imperativo presente di puntare | `puntare` | 8544 /forms/5/form |
| 72387 | `recidivi` | adj | 0 | plurale di recidivo | `recidivo` | 72345 /forms/0/form |
| 72388 | `recidivi` | noun | 0 | plurale di recidivo | `recidivo` | 72345 /forms/0/form |
| 72391 | `recidive` | adj | 0 | femminile plurale di recidivo | `recidivo` | 72345 /forms/2/form |
| 72392 | `recidive` | noun | 0 | femminile plurale di recidivo | `recidivo` | 72345 /forms/2/form |
| 72456 | `verdi` | noun | 0 | plurale di verde | `verde` | 110 /forms/0/form |
| 72534 | `ave` | noun | 0 | femminile plurale di avo | `avo` | 47840 /forms/2/form |
| 72831 | `sa` | verb | 0 | terza persona singolare dell'indicativo presente di sapere | `sapere` | 38301 /forms/7/form |
| 72939 | `assilli` | verb | 2 | seconda persona singolare del congiuntivo presente di assillare | `assillare` | 422195 /forms/5/form |
| 72939 | `assilli` | verb | 3 | terza persona singolare del congiuntivo presente di assillare | `assillare` | 422195 /forms/5/form |
| 72939 | `assilli` | verb | 4 | terza persona singolare dell'imperativo presente di assillare | `assillare` | 422195 /forms/5/form |
| 73180 | `idiopatici` | adj | 0 | plurale di idiopatico | `idiopatico` | 69656 /forms/0/form |
| 73181 | `idiopatiche` | adj | 0 | femminile plurale di idiopatico | `idiopatico` | 69656 /forms/2/form |
| 73186 | `tracotanti` | noun | 0 | plurale di tracotante | `tracotante` | 72995 /forms/0/form |
| 73452 | `abbatuffolato` | adj | 0 | participio passato di abbatuffolare | `abbatuffolare` | 46115 /forms/4/form |
| 73638 | `gromme` | noun | 0 | plurale di gromma | `gromma` | 73637 /forms/0/form |
| 73641 | `grommosi` | adj | 0 | plurale di grommoso | `grommoso` | 73640 /forms/0/form |
| 73642 | `grommosa` | adj | 0 | femminile di grommoso | `grommoso` | 73640 /forms/1/form |
| 73643 | `grommose` | adj | 0 | femminile plurale di grommoso | `grommoso` | 73640 /forms/2/form |
| 73645 | `legazioni` | noun | 0 | plurale di legazione | `legazione` | 73644 /forms/0/form |
| 73646 | `ridanciani` | adj | 0 | plurale di ridanciano | `ridanciano` | 45998 /forms/0/form |
| 73647 | `ridanciana` | adj | 0 | femminile di ridanciano | `ridanciano` | 45998 /forms/1/form |
| 73648 | `ridanciane` | adj | 0 | femminile plurale di ridanciano | `ridanciano` | 45998 /forms/2/form |
| 73830 | `addendi` | noun | 0 | plurale di addendo | `addendo` | 73827 /forms/0/form |
| 73831 | `eliografie` | noun | 0 | plurale di eliografia | `eliografia` | 73825 /forms/0/form |
| 73833 | `quintettistici` | adj | 0 | plurale di quintettistico | `quintettistico` | 73832 /forms/0/form |
| 73834 | `quintettistica` | adj | 0 | femminile di quintettistico | `quintettistico` | 73832 /forms/1/form |
| 73835 | `quintettistiche` | adj | 0 | femminile plurale di quintettistico | `quintettistico` | 73832 /forms/2/form |
| 73837 | `quintetti` | noun | 0 | plurale di quintetto | `quintetto` | 73836 /forms/0/form |
| 73839 | `comandoli` | noun | 0 | plurale di comandolo | `comandolo` | 73838 /forms/0/form |
| 74055 | `obbrobri` | noun | 0 | plurale di obbrobrio | `obbrobrio` | 74056 /forms/0/form |
| 74189 | `esistenzialismi` | noun | 0 | plurale di esistenzialismo | `esistenzialismo` | 42313 /forms/0/form |
| 74206 | `biciclette` | noun | 0 | plurale di bicicletta | `bicicletta` | 2360 /forms/0/form |
| 74207 | `esopianeti` | noun | 0 | plurale di esopianeta | `esopianeta` | 74174 /forms/0/form |
| 74210 | `nebulose` | noun | 0 | plurale di nebulosa | `nebulosa` | 34035 /forms/2/form |
| 74373 | `amebei` | noun | 0 | plurale di amebeo | `amebeo` | 74371 /forms/0/form |
| 74374 | `manovrabili` | adj | 0 | plurale di manovrabile | `manovrabile` | 74362 /forms/0/form |
| 74375 | `borseggiatori` | noun | 0 | plurale di borseggiatore | `borseggiatore` | 62329 /forms/0/form |
| 74377 | `borseggiatrici` | noun | 0 | femminile plurale di borseggiatore | `borseggiatore` | 62329 /forms/2/form |
| 74568 | `umidi` | adj | 0 | plurale di umido | `umido` | 74566 /forms/0/form |
| 74845 | `agrafie` | noun | 0 | plurale di agrafia | `agrafia` | 74818 /forms/0/form |
| 75105 | `suoi` | adj | 0 | maschile plurale di suo | `suo` | 33189 /forms/0/form |
| 75106 | `suoi` | pron | 0 | maschile plurale di suo | `suo` | 33189 /forms/0/form |
| 75438 | `senatrice` | noun | 0 | femminile di senatore | `senatore` | 54008 /forms/1/form |
| 75451 | `creativi` | adj | 0 | plurale di creativo | `creativo` | 113565 /forms/1/form |
| 75543 | `furieri` | noun | 0 | plurale di furiere | `furiere` | 75542 /forms/0/form |
| 76834 | `pagnotte` | noun | 0 | plurale di pagnotta | `pagnotta` | 76412 /forms/0/form |
| 76948 | `nuore` | noun | 0 | plurale di nuora | `nuora` | 52016 /forms/0/form |
| 76963 | `enchiridi` | noun | 0 | plurale di enchiridio | `enchiridio` | 76937 /forms/0/form |
| 76965 | `encicliche` | noun | 0 | plurale di enciclica | `enciclica` | 76964 /forms/0/form |
| 76967 | `enciclici` | adj | 0 | plurale di enciclico | `enciclico` | 76966 /forms/0/form |
| 77168 | `surrettizia` | adj | 0 | femminile di surrettizio | `surrettizio` | 77161 /forms/1/form |
| 78478 | `beveratoi` | noun | 0 | plurale di beveratoio | `beveratoio` | 78477 /forms/0/form |
| 78483 | `osteologi` | noun | 0 | plurale di osteologo | `osteologo` | 61958 /forms/0/form |
| 78485 | `osteologie` | noun | 0 | plurale di osteologia | `osteologia` | 78484 /forms/0/form |
| 78632 | `posti` | verb | 2 | prima persona singolare del congiuntivo presente di postare | `postare` | 48986 /forms/5/form |
| 78632 | `posti` | verb | 3 | seconda persona singolare del congiuntivo presente di postare | `postare` | 48986 /forms/5/form |
| 78632 | `posti` | verb | 4 | terza persona singolare del congiuntivo presente di postare | `postare` | 48986 /forms/5/form |
| 78632 | `posti` | verb | 5 | terza persona singolare dell'imperativo presente di postare | `postare` | 48986 /forms/5/form |
| 78775 | `abiti` | verb | 4 | terza persona singolare dell'imperativo presente di abitare | `abitare` | 2417 /forms/5/form |
| 78778 | `settentrioni` | noun | 0 | plurale di settentrione | `settentrione` | 54045 /forms/0/form |
| 78788 | `logorroici` | noun | 0 | plurale di logorroico | `logorroico` | 69563 /forms/0/form |
| 78790 | `logorroica` | noun | 0 | femminile di logorroico | `logorroico` | 69563 /forms/1/form |
| 79607 | `agevolate` | verb | 1 | seconda persona plurale dell'indicativo presente di agevolare | `agevolare` | 47566 /forms/8/form |
| 79641 | `abbiadato` | adj | 0 | participio passato di abbiadare | `abbiadare` | 40972 /forms/3/form |
| 79643 | `abbicato` | adj | 0 | participio passato di abbicare | `abbicare` | 46117 /forms/4/form |
| 79647 | `abbigliato` | adj | 0 | participio passato di abbigliare | `abbigliare` | 37644 /forms/4/form |
| 79907 | `dialoghi` | verb | 1 | prima persona singolare del congiuntivo presente di dialogare | `dialogare` | 136049 /forms/5/form |
| 79907 | `dialoghi` | verb | 2 | seconda persona singolare del congiuntivo presente di dialogare | `dialogare` | 136049 /forms/5/form |
| 79907 | `dialoghi` | verb | 3 | terza persona singolare del congiuntivo presente di dialogare | `dialogare` | 136049 /forms/5/form |
| 79907 | `dialoghi` | verb | 4 | terza persona singolare dell'imperativo presente di dialogare | `dialogare` | 136049 /forms/5/form |
| 79967 | `tumuli` | verb | 1 | prima persona singolare del congiuntivo presente di tumulare | `tumulare` | 50384 /forms/5/form |
| 79967 | `tumuli` | verb | 2 | seconda persona singolare del congiuntivo presente di tumulare | `tumulare` | 50384 /forms/5/form |
| 79967 | `tumuli` | verb | 3 | terza persona singolare del congiuntivo presente di tumulare | `tumulare` | 50384 /forms/5/form |
| 79967 | `tumuli` | verb | 4 | terza persona singolare dell'imperativo presente di tumulare | `tumulare` | 50384 /forms/5/form |
| 80182 | `apparecchi` | verb | 1 | prima persona singolare del congiuntivo presente di apparecchiare | `apparecchiare` | 461991 /forms/6/form |
| 80182 | `apparecchi` | verb | 2 | seconda persona singolare del congiuntivo presente di apparecchiare | `apparecchiare` | 461991 /forms/6/form |
| 80182 | `apparecchi` | verb | 3 | terza persona singolare del congiuntivo presente di apparecchiare | `apparecchiare` | 461991 /forms/6/form |
| 80182 | `apparecchi` | verb | 4 | terza persona singolare dell'imperativo presente di apparecchiare | `apparecchiare` | 461991 /forms/6/form |
| 80338 | `cementino` | verb | 1 | terza persona plurale dell'imperativo presente di cementare | `cementare` | 220200 /forms/69/form |
| 80383 | `telefoni` | verb | 1 | prima persona singolare del congiuntivo presente di telefonare | `telefonare` | 50191 /forms/5/form |
| 80383 | `telefoni` | verb | 2 | seconda persona singolare del congiuntivo presente di telefonare | `telefonare` | 50191 /forms/5/form |
| 80383 | `telefoni` | verb | 3 | terza persona singolare del congiuntivo presente di telefonare | `telefonare` | 50191 /forms/5/form |
| 80383 | `telefoni` | verb | 4 | terza persona singolare dell'imperativo presente di telefonare | `telefonare` | 50191 /forms/5/form |
| 80581 | `dati` | verb | 2 | prima persona singolare del congiuntivo presente di datare | `datare` | 137067 /forms/5/form |
| 80581 | `dati` | verb | 3 | seconda persona singolare del congiuntivo presente di datare | `datare` | 137067 /forms/5/form |
| 80581 | `dati` | verb | 4 | terza persona singolare del congiuntivo presente di datare | `datare` | 137067 /forms/5/form |
| 80581 | `dati` | verb | 5 | terza persona singolare dell'imperativo presente di datare | `datare` | 137067 /forms/5/form |
| 80608 | `ricavi` | noun | 0 | plurale di ricavo | `ricavo` | 80606 /forms/0/form |
| 80820 | `ometti` | verb | 1 | seconda persona singolare dell'imperativo presente di omettere | `omettere` | 69938 /forms/5/form |
| 81037 | `merli` | noun | 2 | plurale di merlo | `merlo` | 51715 /forms/0/form |
| 81082 | `bruciate` | adj | 0 | femminile plurale di bruciato | `bruciato` | 50978 /forms/2/form |
| 81239 | `notabili` | noun | 0 | plurale di notabile | `notabile` | 45994 /forms/0/form |
| 81442 | `lucentezze` | noun | 0 | plurale di lucentezza | `lucentezza` | 81441 /forms/0/form |
| 81693 | `concisioni` | noun | 0 | plurale di concisione | `concisione` | 81692 /forms/0/form |
| 81716 | `sogni` | verb | 2 | seconda persona singolare del congiuntivo presente di sognare | `sognare` | 3287 /forms/6/form |
| 81716 | `sogni` | verb | 3 | terza persona singolare del congiuntivo presente di sognare | `sognare` | 3287 /forms/6/form |
| 81716 | `sogni` | verb | 4 | terza persona singolare dell'imperativo presente di sognare | `sognare` | 3287 /forms/6/form |
| 82116 | `psicologismi` | noun | 0 | plurale di psicologismo | `psicologismo` | 82115 /forms/0/form |
| 82516 | `restrittiva` | adj | 0 | femminile di restrittivo | `restrittivo` | 82518 /forms/1/form |
| 82517 | `restrittive` | adj | 0 | femminile plurale di restrittivo | `restrittivo` | 82518 /forms/2/form |
| 82724 | `leciti` | noun | 0 | plurale di lecito | `lecito` | 82719 /forms/0/form |
| 82860 | `sottocutanea` | adj | 0 | femminile di sottocutaneo | `sottocutaneo` | 82858 /forms/1/form |
| 82917 | `quadre` | adj | 0 | femminile plurale di quadro | `quadro` | 70573 /forms/2/form |
| 83082 | `inibiti` | noun | 0 | plurale di inibito | `inibito` | 50538 /forms/0/form |
| 83139 | `scontrosi` | noun | 0 | plurale di scontroso | `scontroso` | 83136 /forms/0/form |
| 83141 | `scontrosa` | noun | 0 | femminile di scontroso | `scontroso` | 83136 /forms/1/form |
| 83145 | `scontrose` | noun | 0 | femminile plurale di scontroso | `scontroso` | 83136 /forms/2/form |
| 83208 | `brasati` | noun | 0 | plurale di brasato | `brasato` | 48010 /forms/0/form |
| 83228 | `francescani` | noun | 0 | plurale di francescano | `francescano` | 62473 /forms/0/form |
| 83235 | `subcontraenti` | noun | 0 | plurale di subcontraente | `subcontraente` | 83232 /forms/0/form |
| 83345 | `monti` | verb | 1 | prima persona singolare del congiuntivo presente di montare | `montare` | 48740 /forms/7/form |
| 83345 | `monti` | verb | 2 | seconda persona singolare del congiuntivo presente di montare | `montare` | 48740 /forms/7/form |
| 83345 | `monti` | verb | 3 | terza persona singolare del congiuntivo presente di montare | `montare` | 48740 /forms/7/form |
| 83345 | `monti` | verb | 4 | terza persona singolare dell'imperativo presente di montare | `montare` | 48740 /forms/7/form |
| 83349 | `montanari` | noun | 0 | plurale di montanaro | `montanaro` | 83346 /forms/0/form |
| 83351 | `montanare` | noun | 0 | femminile plurale di montanaro | `montanaro` | 83346 /forms/2/form |
| 83353 | `montanara` | noun | 0 | femminile di montanaro | `montanaro` | 83346 /forms/1/form |
| 83434 | `fonemi` | noun | 0 | plurale di fonema | `fonema` | 30841 /forms/0/form |
| 83508 | `gasometri` | noun | 0 | plurale di gasometro | `gasometro` | 83504 /forms/0/form |
| 83509 | `gassometri` | noun | 0 | plurale di gassometro | `gassometro` | 83505 /forms/0/form |
| 83524 | `aeriformi` | noun | 0 | plurale di aeriforme | `aeriforme` | 83521 /forms/0/form |
| 83662 | `faziosi` | adv | 0 | plurale di fazioso | `fazioso` | 83660 /forms/0/form |
| 83664 | `faziose` | adv | 0 | femminile plurale di fazioso | `fazioso` | 83660 /forms/2/form |
| 83848 | `negoziatrici` | noun | 0 | femminile plurale di negoziatore | `negoziatore` | 83844 /forms/2/form |
| 84140 | `profilattici` | noun | 0 | plurale di profilattico | `profilattico` | 1584 /forms/0/form |
| 85274 | `spilli` | verb | 1 | prima persona singolare del congiuntivo presente di spillare | `spillare` | 138700 /forms/5/form |
| 85274 | `spilli` | verb | 2 | seconda persona singolare del congiuntivo presente di spillare | `spillare` | 138700 /forms/5/form |
| 85274 | `spilli` | verb | 3 | terza persona singolare del congiuntivo presente di spillare | `spillare` | 138700 /forms/5/form |
| 85274 | `spilli` | verb | 4 | terza persona singolare dell'imperativo presente di spillare | `spillare` | 138700 /forms/5/form |
| 85674 | `mie` | adj | 0 | femminile plurale di mio | `mio` | 40604 /forms/2/form |
| 86041 | `Monocotiledoni` | noun | 0 | plurale di monocotiledone | `monocotiledone` | 86040 /forms/0/form |
| 86568 | `pavimentazioni` | noun | 0 | plurale di pavimentazione | `pavimentazione` | 86567 /forms/0/form |
| 86584 | `mandrini` | noun | 0 | plurale di mandrino | `mandrino` | 62314 /forms/0/form |
| 86918 | `coccolo` | verb | 0 | prima persona singolare dell'indicativo presente di coccolare | `coccolare` | 125499 /forms/4/form |
| 87588 | `direttrice` | noun | 0 | femminile singolare di direttore | `direttore` | 49366 /forms/1/form |
| 87741 | `malfattrice` | noun | 0 | femminile di malfattore | `malfattore` | 51544 /forms/1/form |
| 88043 | `installatori` | noun | 0 | plurale di installatore | `installatore` | 50611 /forms/0/form |
| 88130 | `nitratazioni` | noun | 0 | plurale di nitratazione | `nitratazione` | 51977 /forms/0/form |
| 88135 | `nutrizioni` | noun | 0 | plurale di nutrizione | `nutrizione` | 139314 /forms/0/form |
| 88140 | `opposizioni` | noun | 0 | plurale di opposizione | `opposizione` | 52067 /forms/0/form |
| 88161 | `peccatrici` | noun | 0 | femminile plurale di peccatore | `peccatore` | 137442 /forms/2/form |
| 88177 | `posizioni` | verb | 1 | prima persona singolare del congiuntivo presente di posizionare | `posizionare` | 48983 /forms/5/form |
| 88177 | `posizioni` | verb | 2 | seconda persona singolare del congiuntivo presente di posizionare | `posizionare` | 48983 /forms/5/form |
| 88177 | `posizioni` | verb | 3 | terza persona singolare del congiuntivo presente di posizionare | `posizionare` | 48983 /forms/5/form |
| 88177 | `posizioni` | verb | 4 | terza persona singolare dell'imperativo presente di posizionare | `posizionare` | 48983 /forms/5/form |
| 88217 | `regolarizzazioni` | noun | 0 | plurale di regolarizzazione | `regolarizzazione` | 52865 /forms/0/form |
| 88253 | `sanzioni` | verb | 0 | seconda persona singolare dell'indicativo presente di sanzionare | `sanzionare` | 582842 /forms/5/form |
| 88253 | `sanzioni` | verb | 1 | prima persona singolare del congiuntivo presente di sanzionare | `sanzionare` | 582842 /forms/5/form |
| 88253 | `sanzioni` | verb | 2 | seconda persona singolare del congiuntivo presente di sanzionare | `sanzionare` | 582842 /forms/5/form |
| 88253 | `sanzioni` | verb | 3 | terza persona singolare del congiuntivo presente di sanzionare | `sanzionare` | 582842 /forms/5/form |
| 88259 | `segnali` | verb | 1 | prima persona singolare del congiuntivo presente di segnalare | `segnalare` | 135606 /forms/6/form |
| 88259 | `segnali` | verb | 2 | seconda persona singolare del congiuntivo presente di segnalare | `segnalare` | 135606 /forms/6/form |
| 88259 | `segnali` | verb | 3 | terza persona singolare del congiuntivo presente di segnalare | `segnalare` | 135606 /forms/6/form |
| 88259 | `segnali` | verb | 4 | terza persona singolare dell'imperativo presente di segnalare | `segnalare` | 135606 /forms/6/form |
| 88302 | `stivali` | noun | 0 | plurale di stivale | `stivale` | 54388 /forms/0/form |
| 88661 | `anticipi` | verb | 1 | prima persona singolare del congiuntivo presente di anticipare | `anticipare` | 136562 /forms/5/form |
| 88661 | `anticipi` | verb | 2 | seconda persona singolare del congiuntivo presente di anticipare | `anticipare` | 136562 /forms/5/form |
| 88661 | `anticipi` | verb | 3 | terza persona singolare del congiuntivo presente di anticipare | `anticipare` | 136562 /forms/5/form |
| 88661 | `anticipi` | verb | 4 | terza persona singolare dell'imperativo presente di anticipare | `anticipare` | 136562 /forms/5/form |
| 88694 | `avanzi` | verb | 1 | prima persona singolare del congiuntivo presente di avanzare | `avanzare` | 134210 /forms/5/form |
| 88694 | `avanzi` | verb | 2 | seconda persona singolare del congiuntivo presente di avanzare | `avanzare` | 134210 /forms/5/form |
| 88694 | `avanzi` | verb | 3 | terza persona singolare del congiuntivo presente di avanzare | `avanzare` | 134210 /forms/5/form |
| 88694 | `avanzi` | verb | 4 | terza persona singolare dell'imperativo presente di avanzare | `avanzare` | 134210 /forms/5/form |
| 88732 | `capitani` | verb | 1 | prima persona singolare del congiuntivo presente di capitanare | `capitanare` | 526445 /forms/5/form |
| 88732 | `capitani` | verb | 2 | seconda persona singolare del congiuntivo presente di capitanare | `capitanare` | 526445 /forms/5/form |
| 88732 | `capitani` | verb | 3 | terza persona singolare del congiuntivo presente di capitanare | `capitanare` | 526445 /forms/5/form |
| 88732 | `capitani` | verb | 4 | terza persona singolare dell'imperativo presente di capitanare | `capitanare` | 526445 /forms/5/form |
| 88791 | `commenti` | verb | 1 | prima persona singolare del congiuntivo presente di commentare | `commentare` | 198302 /forms/5/form |
| 88791 | `commenti` | verb | 2 | seconda persona singolare del congiuntivo presente di commentare | `commentare` | 198302 /forms/5/form |
| 88791 | `commenti` | verb | 3 | terza persona singolare del congiuntivo presente di commentare | `commentare` | 198302 /forms/5/form |
| 88791 | `commenti` | verb | 4 | terza persona singolare dell'imperativo presente di commentare | `commentare` | 198302 /forms/5/form |
| 88812 | `confronti` | verb | 1 | prima persona singolare del congiuntivo presente di confrontare | `confrontare` | 421750 /forms/6/form |
| 88812 | `confronti` | verb | 2 | seconda persona singolare del congiuntivo presente di confrontare | `confrontare` | 421750 /forms/6/form |
| 88812 | `confronti` | verb | 3 | terza persona singolare del congiuntivo presente di confrontare | `confrontare` | 421750 /forms/6/form |
| 88812 | `confronti` | verb | 4 | terza persona singolare dell'imperativo presente di confrontare | `confrontare` | 421750 /forms/6/form |
| 88817 | `consulti` | verb | 0 | seconda persona singolare dell'indicativo presente di consultare | `consultare` | 48105 /forms/6/form |
| 88817 | `consulti` | verb | 3 | terza persona singolare dell'imperativo presente di consultare | `consultare` | 48105 /forms/6/form |
| 88828 | `contrasti` | verb | 0 | seconda persona singolare dell'indicativo presente di contrastare | `contrastare` | 135608 /forms/5/form |
| 88828 | `contrasti` | verb | 1 | prima persona singolare del congiuntivo presente di contrastare | `contrastare` | 135608 /forms/5/form |
| 88828 | `contrasti` | verb | 2 | seconda persona singolare del congiuntivo presente di contrastare | `contrastare` | 135608 /forms/5/form |
| 88911 | `domicili` | verb | 0 | seconda persona singolare dell'indicativo presente di domiciliare | `domiciliare` | 52693 /forms/6/form |
| 88911 | `domicili` | verb | 1 | prima persona singolare del congiuntivo di domiciliare | `domiciliare` | 52693 /forms/6/form |
| 88911 | `domicili` | verb | 2 | seconda persona singolare del congiuntivo di domiciliare | `domiciliare` | 52693 /forms/6/form |
| 88911 | `domicili` | verb | 3 | terza persona singolare del congiuntivo di domiciliare | `domiciliare` | 52693 /forms/6/form |
| 88911 | `domicili` | verb | 4 | terza persona singolare dell'imperativo di domiciliare | `domiciliare` | 52693 /forms/6/form |
| 88964 | `fogli` | noun | 0 | plurale di foglio | `foglio` | 49834 /forms/0/form |
| 88968 | `palafreni` | noun | 0 | plurale di palafreno | `palafreno` | 74462 /forms/0/form |
| 89189 | `alieni` | verb | 1 | prima persona singolare del congiuntivo presente di alienare | `alienare` | 47576 /forms/6/form |
| 89189 | `alieni` | verb | 2 | seconda persona singolare del congiuntivo presente di alienare | `alienare` | 47576 /forms/6/form |
| 89189 | `alieni` | verb | 3 | terza persona singolare del congiuntivo presente di alienare | `alienare` | 47576 /forms/6/form |
| 89189 | `alieni` | verb | 4 | terza persona singolare dell'imperativo presente di alienare | `alienare` | 47576 /forms/6/form |
| 89291 | `getti` | verb | 1 | prima persona singolare del congiuntivo presente di gettare | `gettare` | 420758 /forms/6/form |
| 89291 | `getti` | verb | 2 | seconda persona singolare del congiuntivo presente di gettare | `gettare` | 420758 /forms/6/form |
| 89291 | `getti` | verb | 3 | terza persona singolare del congiuntivo presente di gettare | `gettare` | 420758 /forms/6/form |
| 89291 | `getti` | verb | 4 | terza persona singolare dell'imperativo presente di gettare | `gettare` | 420758 /forms/6/form |
| 89307 | `glutei` | adj | 0 | plurale di gluteo | `gluteo` | 135626 /forms/0/form |
| 89323 | `imbarazzi` | verb | 1 | prima persona singolare del congiuntivo presente di imbarazzare | `imbarazzare` | 609138 /forms/5/form |
| 89323 | `imbarazzi` | verb | 2 | seconda persona singolare del congiuntivo presente di imbarazzare | `imbarazzare` | 609138 /forms/5/form |
| 89323 | `imbarazzi` | verb | 3 | terza persona singolare del congiuntivo presente di imbarazzare | `imbarazzare` | 609138 /forms/5/form |
| 89323 | `imbarazzi` | verb | 4 | terza persona singolare dell'imperativo presente di imbarazzare | `imbarazzare` | 609138 /forms/5/form |
| 89338 | `impiastri` | verb | 1 | prima persona singolare del congiuntivo presente di impiastrare | `impiastrare` | 550940 /forms/5/form |
| 89338 | `impiastri` | verb | 2 | seconda persona singolare del congiuntivo presente di impiastrare | `impiastrare` | 550940 /forms/5/form |
| 89338 | `impiastri` | verb | 3 | terza persona singolare del congiuntivo presente di impiastrare | `impiastrare` | 550940 /forms/5/form |
| 89338 | `impiastri` | verb | 4 | terza persona singolare dell'imperativo presente di impiastrare | `impiastrare` | 550940 /forms/5/form |
| 89347 | `incanti` | verb | 1 | prima persona singolare del congiuntivo presente di incantare | `incantare` | 48570 /forms/6/form |
| 89667 | `situazioni` | noun | 0 | plurale di situazione | `situazione` | 45526 /forms/0/form |
| 89968 | `muse` | noun | 0 | plurale di musa | `musa` | 129071 /forms/0/form |
| 90034 | `pastorali` | noun | 0 | plurale di pastorale | `pastorale` | 90012 /forms/0/form |
| 90591 | `ricoverata` | noun | 0 | femminile singolare di ricoverato | `ricoverato` | 90584 /forms/1/form |
| 90618 | `immigrata` | noun | 0 | femminile di immigrato | `immigrato` | 50198 /forms/1/form |
| 90639 | `allegrato` | verb | 0 | participio passato di allegrare | `allegrare` | 90630 /forms/4/form |
| 91093 | `bela` | verb | 1 | seconda persona singolare dell'imperativo presente di belare | `belare` | 63152 /forms/6/form |
| 91388 | `trogloditi` | noun | 0 | plurale maschile di troglodita | `troglodita` | 91385 /forms/0/form |
| 91610 | `districante` | adj | 0 | participio presente di districare | `districare` | 91621 /forms/3/form |
| 91802 | `innamorate` | noun | 0 | femminile plurale di innamorato | `innamorato` | 50557 /forms/2/form |
| 91829 | `medici` | noun | 0 | plurale di medico | `medico` | 8336 /forms/0/form |
| 91894 | `marine` | noun | 0 | plurale di marina | `marina` | 45563 /forms/0/form |
| 91963 | `soffierie` | noun | 0 | plurale di soffieria | `soffieria` | 91962 /forms/0/form |
| 91967 | `soffietti` | noun | 0 | plurale di soffietto | `soffietto` | 91965 /forms/0/form |
| 91971 | `soffioni` | noun | 0 | plurale di soffione | `soffione` | 91970 /forms/0/form |
| 91997 | `vigliacca` | noun | 0 | femminile singolare di vigliacco | `vigliacco` | 91994 /forms/1/form |
| 92001 | `vigliacchi` | noun | 0 | plurale di vigliacco | `vigliacco` | 91994 /forms/0/form |
| 92003 | `etimologa` | noun | 0 | femminile di etimologo | `etimologo` | 92002 /forms/1/form |
| 92004 | `etimologi` | noun | 0 | plurale di etimologo | `etimologo` | 92002 /forms/0/form |
| 92005 | `etimologhe` | noun | 0 | plurale femminile di etimologo | `etimologo` | 92002 /forms/2/form |
| 92029 | `occulti` | verb | 1 | prima persona singolare del congiuntivo presente di occultare | `occultare` | 420833 /forms/6/form |
| 92029 | `occulti` | verb | 2 | seconda persona singolare del congiuntivo presente di occultare | `occultare` | 420833 /forms/6/form |
| 92029 | `occulti` | verb | 3 | terza persona singolare del congiuntivo presente di occultare | `occultare` | 420833 /forms/6/form |
| 92029 | `occulti` | verb | 4 | terza persona singolare dell'imperativo presente di occultare | `occultare` | 420833 /forms/6/form |
| 92392 | `locelli` | noun | 0 | plurale di locello | `locello` | 65622 /forms/0/form |
| 92554 | `mesti` | verb | 1 | prima persona singolare del congiuntivo presente di mestare | `mestare` | 592282 /forms/5/form |
| 92554 | `mesti` | verb | 2 | seconda persona singolare del congiuntivo presente di mestare | `mestare` | 592282 /forms/5/form |
| 92554 | `mesti` | verb | 3 | terza persona singolare del congiuntivo presente di mestare | `mestare` | 592282 /forms/5/form |
| 92554 | `mesti` | verb | 4 | terza persona singolare dell'imperativo presente di mestare | `mestare` | 592282 /forms/5/form |
| 92908 | `campana` | adj | 0 | femminile di campano | `campano` | 136676 /forms/1/form |
| 93106 | `gropponate` | noun | 0 | plurale di gropponata | `gropponata` | 93105 /forms/0/form |
| 93139 | `levanti` | noun | 0 | plurale di levante | `levante` | 51255 /forms/0/form |
| 93938 | `lamenti` | verb | 2 | seconda persona singolare del congiuntivo presente di lamentare | `lamentare` | 463051 /forms/6/form |
| 93938 | `lamenti` | verb | 3 | terza persona singolare del congiuntivo presente di lamentare | `lamentare` | 463051 /forms/6/form |
| 93938 | `lamenti` | verb | 4 | terza persona singolare dell'imperativo presente di lamentare | `lamentare` | 463051 /forms/6/form |
| 93940 | `zampilli` | verb | 4 | terza persona singolare dell'imperativo presente di zampillare | `zampillare` | 50533 /forms/5/form |
| 96472 | `ubriaca` | noun | 0 | femminile singolare di ubriaco | `ubriaco` | 31253 /forms/1/form |
| 96876 | `dilazioni` | verb | 4 | terza persona singolare dell'imperativo presente di dilazionare | `dilazionare` | 418085 /forms/5/form |
| 96958 | `emozioni` | verb | 1 | prima persona singolare del congiuntivo presente di emozionare | `emozionare` | 48378 /forms/6/form |
| 96958 | `emozioni` | verb | 2 | seconda persona singolare del congiuntivo presente di emozionare | `emozionare` | 48378 /forms/6/form |
| 96958 | `emozioni` | verb | 3 | terza persona singolare del congiuntivo presente di emozionare | `emozionare` | 48378 /forms/6/form |
| 97073 | `fidelizzazioni` | noun | 0 | plurale di fidelizzazione | `fidelizzazione` | 49785 /forms/0/form |
| 97086 | `flagellazioni` | noun | 0 | plurale di flagellazione | `flagellazione` | 138317 /forms/0/form |
| 97137 | `funzioni` | verb | 2 | seconda persona singolare del congiuntivo presente di funzionare | `funzionare` | 43058 /forms/5/form |
| 97137 | `funzioni` | verb | 3 | terza persona singolare del congiuntivo presente di funzionare | `funzionare` | 43058 /forms/5/form |
| 97137 | `funzioni` | verb | 4 | terza persona singolare dell'imperativo presente di funzionare | `funzionare` | 43058 /forms/5/form |
| 97158 | `glaciazioni` | noun | 0 | plurale di glaciazione | `glaciazione` | 420277 /forms/0/form |
| 97370 | `aguzzi` | verb | 1 | prima persona singolare del congiuntivo presente di aguzzare | `aguzzare` | 140497 /forms/5/form |
| 97370 | `aguzzi` | verb | 2 | seconda persona singolare del congiuntivo presente di aguzzare | `aguzzare` | 140497 /forms/5/form |
| 97370 | `aguzzi` | verb | 3 | terza persona singolare del congiuntivo presente di aguzzare | `aguzzare` | 140497 /forms/5/form |
| 97370 | `aguzzi` | verb | 4 | terza persona singolare dell'imperativo presente di aguzzare | `aguzzare` | 140497 /forms/5/form |
| 97555 | `legiferazioni` | noun | 0 | plurale di legiferazione | `legiferazione` | 417101 /forms/0/form |
| 97617 | `meccanizzazioni` | noun | 0 | plurale di meccanizzazione | `meccanizzazione` | 46684 /forms/0/form |
| 97968 | `ominazioni` | noun | 0 | plurale di ominazione | `ominazione` | 464306 /forms/0/form |
| 98215 | `istintivi` | noun | 0 | maschile plurale di istintivo | `istintivo` | 51103 /forms/0/form |
| 98297 | `protrazioni` | noun | 0 | plurale di protrazione | `protrazione` | 584348 /forms/0/form |
| 98359 | `razioni` | verb | 1 | prima persona singolare del congiuntivo presente di razionare | `razionare` | 462912 /forms/5/form |
| 98359 | `razioni` | verb | 2 | seconda persona singolare del congiuntivo presente di razionare | `razionare` | 462912 /forms/5/form |
| 98359 | `razioni` | verb | 3 | terza persona singolare del congiuntivo presente di razionare | `razionare` | 462912 /forms/5/form |
| 98359 | `razioni` | verb | 4 | terza persona singolare dell'imperativo presente di razionare | `razionare` | 462912 /forms/5/form |
| 98525 | `scomposizioni` | noun | 0 | plurale di scomposizione | `scomposizione` | 421914 /forms/0/form |
| 98551 | `secrezioni` | noun | 0 | plurale di secrezione | `secrezione` | 140417 /forms/0/form |
| 98671 | `sovrappopolazioni` | noun | 0 | plurale di sovrappopolazione | `sovrappopolazione` | 405644 /forms/0/form |
| 98677 | `sovvenzioni` | verb | 1 | prima persona singolare del congiuntivo presente di sovvenzionare | `sovvenzionare` | 420950 /forms/5/form |
| 98677 | `sovvenzioni` | verb | 2 | seconda persona singolare del congiuntivo presente di sovvenzionare | `sovvenzionare` | 420950 /forms/5/form |
| 98677 | `sovvenzioni` | verb | 3 | terza persona singolare del congiuntivo presente di sovvenzionare | `sovvenzionare` | 420950 /forms/5/form |
| 98677 | `sovvenzioni` | verb | 4 | terza persona singolare dell'imperativo presente di sovvenzionare | `sovvenzionare` | 420950 /forms/5/form |
| 98683 | `specificazioni` | noun | 0 | plurale di specificazione | `specificazione` | 594020 /forms/0/form |
| 98697 | `sponsorizzazioni` | noun | 0 | plurale di sponsorizzazione | `sponsorizzazione` | 412391 /forms/0/form |
| 98699 | `sproporzioni` | noun | 0 | plurale di sproporzione | `sproporzione` | 312789 /forms/0/form |
| 98748 | `superconduzioni` | noun | 0 | plurale di superconduzione | `superconduzione` | 412784 /forms/0/form |
| 98768 | `svalutazioni` | noun | 0 | plurale di svalutazione | `svalutazione` | 140641 /forms/0/form |
| 99119 | `scolte` | noun | 0 | plurale di scolta | `scolta` | 99117 /forms/0/form |
| 102073 | `fantaccina` | noun | 0 | femminile singolare di fantaccino | `fantaccino` | 102037 /forms/1/form |
| 102092 | `economa` | adj | 0 | femminile singolare di economo | `economo` | 40832 /forms/1/form |
| 102145 | `antenata` | noun | 0 | femminile singolare di antenato | `antenato` | 140438 /forms/1/form |
| 102148 | `predecessora` | noun | 0 | femminile singolare di predecessore | `predecessore` | 449052 /forms/1/form |
| 102149 | `scultrice` | noun | 0 | femminile singolare di scultore | `scultore` | 38041 /forms/1/form |
| 102153 | `avventori` | noun | 0 | maschile plurale di avventore | `avventore` | 38448 /forms/0/form |
| 102154 | `avventrice` | noun | 0 | femminile singolare di avventore | `avventore` | 38448 /forms/1/form |
| 102334 | `sudate` | verb | 1 | seconda persona plurale dell'indicativo presente di sudare | `sudare` | 40923 /forms/8/form |
| 102334 | `sudate` | verb | 2 | seconda persona plurale dell'imperativo presente di sudare | `sudare` | 40923 /forms/8/form |
| 102349 | `ottuse` | verb | 0 | participio passato plurale femminile di ottundere | `ottundere` | 82734 /forms/19/form |
| 102433 | `moli` | verb | 1 | prima persona singolare del congiuntivo presente di molare | `molare` | 30313 /forms/5/form |
| 102433 | `moli` | verb | 2 | seconda persona singolare del congiuntivo presente di molare | `molare` | 30313 /forms/5/form |
| 102433 | `moli` | verb | 3 | terza persona singolare del congiuntivo presente di molare | `molare` | 30313 /forms/5/form |
| 102433 | `moli` | verb | 4 | terza persona singolare dell'imperativo presente di molare | `molare` | 30313 /forms/5/form |
| 102544 | `enteroclismi` | noun | 0 | plurale di enteroclisma | `enteroclisma` | 102520 /forms/0/form |
| 102619 | `sprovveduta` | noun | 0 | femminile di sprovveduto | `sprovveduto` | 102613 /forms/1/form |
| 102767 | `pugni` | verb | 1 | prima persona singolare del congiuntivo presente di pugnare | `pugnare` | 43683 /forms/5/form |
| 102767 | `pugni` | verb | 2 | seconda persona singolare del congiuntivo presente di pugnare | `pugnare` | 43683 /forms/5/form |
| 102767 | `pugni` | verb | 3 | terza persona singolare del congiuntivo presente di pugnare | `pugnare` | 43683 /forms/5/form |
| 102863 | `declini` | verb | 1 | prima persona singolare del congiuntivo presente di declinare | `declinare` | 465013 /forms/5/form |
| 102863 | `declini` | verb | 2 | seconda persona singolare del congiuntivo presente di declinare | `declinare` | 465013 /forms/5/form |
| 102863 | `declini` | verb | 3 | terza persona singolare del congiuntivo presente di declinare | `declinare` | 465013 /forms/5/form |
| 102863 | `declini` | verb | 4 | terza persona singolare dell'imperativo presente di declinare | `declinare` | 465013 /forms/5/form |
| 102910 | `spruzzini` | noun | 0 | plurale di spruzzino | `spruzzino` | 623602 /forms/0/form |
| 104992 | `pregio` | verb | 0 | prima persona singolare dell'indicativo presente di pregiare | `pregiare` | 83903 /forms/5/form |
| 105019 | `pedagogie` | noun | 0 | plurale di pedagogia | `pedagogia` | 87048 /forms/0/form |
| 105922 | `gallato` | adj | 0 | participio passato di gallare | `gallare` | 105924 /forms/3/form |
| 106016 | `smidollata` | noun | 0 | femminile singolare di smidollato | `smidollato` | 324925 /forms/1/form |
| 106267 | `valichi` | verb | 1 | prima persona singolare del congiuntivo presente di valicare | `valicare` | 461426 /forms/5/form |
| 106267 | `valichi` | verb | 2 | seconda persona singolare del congiuntivo presente di valicare | `valicare` | 461426 /forms/5/form |
| 106267 | `valichi` | verb | 3 | terza persona singolare del congiuntivo presente di valicare | `valicare` | 461426 /forms/5/form |
| 106267 | `valichi` | verb | 4 | terza persona singolare dell'imperativo presente di valicare | `valicare` | 461426 /forms/5/form |
| 106275 | `cisti` | noun | 0 | plurale di ciste | `ciste` | 48374 /forms/0/form |
| 106310 | `assaltatrice` | noun | 0 | femminile singolare di assaltatore | `assaltatore` | 106282 /forms/1/form |
| 106319 | `appaltatrice` | noun | 0 | femminile singolare di appaltatore | `appaltatore` | 8524 /forms/1/form |
| 106320 | `asfaltatrice` | noun | 0 | femminile singolare di asfaltatore | `asfaltatore` | 106289 /forms/1/form |
| 106394 | `cincischio` | verb | 0 | prima persona singolare dell'indicativo presente di cincischiare | `cincischiare` | 63735 /forms/4/form |
| 106515 | `taggiaschi` | noun | 0 | plurale di taggiasco | `taggiasco` | 106512 /forms/0/form |
| 106517 | `taggiasche` | noun | 0 | femminile plurale di taggiasco | `taggiasco` | 106512 /forms/2/form |
| 106519 | `taggiasca` | noun | 0 | femminile di taggiasco | `taggiasco` | 106512 /forms/1/form |
| 107017 | `sbozzo` | verb | 0 | prima persona singolare dell'indicativo presente di sbozzare | `sbozzare` | 49863 /forms/4/form |
| 107074 | `colmi` | verb | 1 | prima persona singolare del congiuntivo presente di colmare | `colmare` | 418197 /forms/5/form |
| 107074 | `colmi` | verb | 2 | seconda persona singolare del congiuntivo presente di colmare | `colmare` | 418197 /forms/5/form |
| 107074 | `colmi` | verb | 3 | terza persona singolare del congiuntivo presente di colmare | `colmare` | 418197 /forms/5/form |
| 107074 | `colmi` | verb | 4 | terza persona singolare dell'imperativo presente di colmare | `colmare` | 418197 /forms/5/form |
| 107261 | `dimentica` | verb | 1 | seconda persona singolare dell'imperativo presente di dimenticare | `dimenticare` | 19248 /forms/7/form |
| 107263 | `dimentichi` | verb | 1 | prima persona singolare del congiuntivo presente di dimenticare | `dimenticare` | 19248 /forms/6/form |
| 107263 | `dimentichi` | verb | 2 | seconda persona singolare del congiuntivo presente di dimenticare | `dimenticare` | 19248 /forms/6/form |
| 107263 | `dimentichi` | verb | 3 | terza persona singolare del congiuntivo presente di dimenticare | `dimenticare` | 19248 /forms/6/form |
| 107263 | `dimentichi` | verb | 4 | terza persona singolare dell'imperativo presente di dimenticare | `dimenticare` | 19248 /forms/6/form |
| 107335 | `mondano` | verb | 0 | terza persona plurale dell'indicativo presente di mondare | `mondare` | 48738 /forms/9/form |
| 107350 | `fissi` | verb | 2 | prima persona singolare del congiuntivo presente di fissare | `fissare` | 48475 /forms/6/form |
| 107350 | `fissi` | verb | 3 | seconda persona singolare del congiuntivo presente di fissare | `fissare` | 48475 /forms/6/form |
| 107350 | `fissi` | verb | 4 | terza persona singolare del congiuntivo presente di fissare | `fissare` | 48475 /forms/6/form |
| 107350 | `fissi` | verb | 5 | terza persona singolare dell'imperativo presente di fissare | `fissare` | 48475 /forms/6/form |
| 107397 | `scrocconi` | adj | 0 | plurale di scroccone | `scroccone` | 135639 /forms/0/form |
| 107555 | `pippe` | noun | 0 | plurale di pippa | `pippa` | 14201 /forms/0/form |
| 107814 | `estroversa` | noun | 0 | femminile di estroverso | `estroverso` | 62361 /forms/1/form |
| 108289 | `abitate` | verb | 2 | seconda persona plurale dell'imperativo presente di abitare | `abitare` | 2417 /forms/8/form |
| 108771 | `diciottesima` | adj | 0 | femminile di diciottesimo | `diciottesimo` | 108747 /forms/1/form |
| 108772 | `diciottesimi` | adj | 0 | plurale di diciottesimo | `diciottesimo` | 108747 /forms/0/form |
| 108773 | `diciottesime` | adj | 0 | femminile plurale di diciottesimo | `diciottesimo` | 108747 /forms/2/form |
| 108856 | `desti` | verb | 3 | seconda persona singolare del congiuntivo presente di destare | `destare` | 460016 /forms/6/form |
| 108856 | `desti` | verb | 4 | terza persona singolare dell'imperativo presente di destare | `destare` | 460016 /forms/6/form |
| 108960 | `vieto` | verb | 0 | prima persona singolare dell'indicativo presente di vietare | `vietare` | 50479 /forms/4/form |
| 109586 | `accordi` | verb | 1 | prima persona singolare del congiuntivo di accordare | `accordare` | 31308 /forms/6/form |
| 109586 | `accordi` | verb | 2 | seconda persona singolare del congiuntivo presente di accordare | `accordare` | 31308 /forms/6/form |
| 109586 | `accordi` | verb | 3 | terza persona singolare del congiuntivo presente di accordare | `accordare` | 31308 /forms/6/form |
| 109586 | `accordi` | verb | 4 | terza persona singolare dell'imperativo presente di accordare | `accordare` | 31308 /forms/6/form |
| 109596 | `archivi` | verb | 1 | prima persona singolare del congiuntivo presente di archiviare | `archiviare` | 139233 /forms/5/form |
| 109596 | `archivi` | verb | 2 | seconda persona singolare del congiuntivo presente di archiviare | `archiviare` | 139233 /forms/5/form |
| 109596 | `archivi` | verb | 3 | terza persona singolare del congiuntivo presente di archiviare | `archiviare` | 139233 /forms/5/form |
| 109596 | `archivi` | verb | 4 | terza persona singolare dell'imperativo presente di archiviare | `archiviare` | 139233 /forms/5/form |
| 110160 | `tue` | adj | 0 | femminile plurale di tuo | `tuo` | 32854 /forms/2/form |
| 110803 | `liquidi` | noun | 0 | plurale di liquido | `liquido` | 40706 /forms/0/form |
| 110842 | `veicoli` | verb | 1 | prima persona singolare del congiuntivo presente di veicolare | `veicolare` | 584196 /forms/5/form |
| 110842 | `veicoli` | verb | 2 | seconda persona singolare del congiuntivo presente di veicolare | `veicolare` | 584196 /forms/5/form |
| 110842 | `veicoli` | verb | 3 | terza persona singolare del congiuntivo presente di veicolare | `veicolare` | 584196 /forms/5/form |
| 110842 | `veicoli` | verb | 4 | terza persona singolare dell'imperativo presente di veicolare | `veicolare` | 584196 /forms/5/form |
| 110853 | `biochimica` | adj | 0 | femminile di biochimico | `biochimico` | 47961 /forms/1/form |
| 111291 | `ciurmatori` | noun | 0 | plurale di ciurmatore | `ciurmatore` | 111256 /forms/0/form |
| 111295 | `ciurmadori` | noun | 0 | plurale di ciurmadore | `ciurmadore` | 111293 /forms/0/form |
| 111518 | `validi` | verb | 2 | seconda persona singolare del congiuntivo presente di validare | `validare` | 50440 /forms/5/form |
| 111518 | `validi` | verb | 3 | terza persona singolare del congiuntivo presente di validare | `validare` | 50440 /forms/5/form |
| 111518 | `validi` | verb | 4 | terza persona singolare dell'imperativo presente di validare | `validare` | 50440 /forms/5/form |
| 111539 | `abbottonate` | verb | 0 | participio passato plurale femminile di abbottonare | `abbottonare` | 37730 /forms/9/form |
| 111539 | `abbottonate` | verb | 1 | seconda persona plurale dell'indicativo presente di abbottonare | `abbottonare` | 37730 /forms/9/form |
| 111539 | `abbottonate` | verb | 2 | seconda persona plurale dell'imperativo presente di abbottonare | `abbottonare` | 37730 /forms/9/form |
| 111582 | `meccaniche` | noun | 0 | femminile plurale di meccanico | `meccanico` | 51645 /forms/2/form |
| 111592 | `motivi` | verb | 1 | prima persona singolare del congiuntivo presente di motivare | `motivare` | 449541 /forms/5/form |
| 111592 | `motivi` | verb | 2 | seconda persona singolare del congiuntivo presente di motivare | `motivare` | 449541 /forms/5/form |
| 111592 | `motivi` | verb | 3 | terza persona singolare del congiuntivo presente di motivare | `motivare` | 449541 /forms/5/form |
| 111592 | `motivi` | verb | 4 | terza persona singolare dell'imperativo presente di motivare | `motivare` | 449541 /forms/5/form |
| 111601 | `binari` | noun | 0 | plurale di binario | `binario` | 47959 /forms/0/form |
| 111612 | `scambi` | verb | 0 | seconda persona singolare dell'indicativo presente di scambiare | `scambiare` | 49876 /forms/6/form |
| 111612 | `scambi` | verb | 1 | prima persona singolare del congiuntivo presente di scambiare | `scambiare` | 49876 /forms/6/form |
| 111612 | `scambi` | verb | 2 | seconda persona singolare del congiuntivo presente di scambiare | `scambiare` | 49876 /forms/6/form |
| 111612 | `scambi` | verb | 3 | terza persona singolare del congiuntivo presente di scambiare | `scambiare` | 49876 /forms/6/form |
| 111612 | `scambi` | verb | 4 | terza persona singolare dell'imperativo presente di scambiare | `scambiare` | 49876 /forms/6/form |
| 111690 | `tappi` | verb | 2 | seconda persona singolare del congiuntivo presente di tappare | `tappare` | 50185 /forms/5/form |
| 111690 | `tappi` | verb | 3 | terza persona singolare del congiuntivo presente di tappare | `tappare` | 50185 /forms/5/form |
| 111690 | `tappi` | verb | 4 | terza persona singolare dell'imperativo presente di tappare | `tappare` | 50185 /forms/5/form |
| 111740 | `secondi` | verb | 1 | prima persona singolare del congiuntivo presente di secondare | `secondare` | 606898 /forms/5/form |
| 111740 | `secondi` | verb | 2 | seconda persona singolare del congiuntivo presente di secondare | `secondare` | 606898 /forms/5/form |
| 111740 | `secondi` | verb | 3 | terza persona singolare del congiuntivo presente di secondare | `secondare` | 606898 /forms/5/form |
| 111740 | `secondi` | verb | 4 | terza persona singolare dell'imperativo presente di secondare | `secondare` | 606898 /forms/5/form |
| 111843 | `volti` | verb | 3 | seconda persona singolare del congiuntivo presente di voltare | `voltare` | 50522 /forms/6/form |
| 111843 | `volti` | verb | 4 | terza persona singolare del congiuntivo presente di voltare | `voltare` | 50522 /forms/6/form |
| 111843 | `volti` | verb | 5 | terza persona singolare dell'imperativo presente di voltare | `voltare` | 50522 /forms/6/form |
| 111867 | `pennelli` | verb | 1 | prima persona singolare del presente semplice congiuntivo di pennellare | `pennellare` | 114249 /forms/5/form |
| 111867 | `pennelli` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di pennellare | `pennellare` | 114249 /forms/5/form |
| 111867 | `pennelli` | verb | 3 | terza persona singolare del presente semplice congiuntivo di pennellare | `pennellare` | 114249 /forms/5/form |
| 111915 | `becchi` | verb | 1 | prima persona singolare del congiuntivo presente di beccare | `beccare` | 113786 /forms/5/form |
| 111915 | `becchi` | verb | 2 | seconda persona singolare del congiuntivo presente di beccare | `beccare` | 113786 /forms/5/form |
| 111915 | `becchi` | verb | 3 | terza persona singolare del congiuntivo presente di beccare | `beccare` | 113786 /forms/5/form |
| 111915 | `becchi` | verb | 4 | terza persona singolare dell'imperativo presente di beccare | `beccare` | 113786 /forms/5/form |
| 111953 | `regali` | verb | 1 | prima persona singolare del congiuntivo di regalare | `regalare` | 82976 /forms/5/form |
| 111953 | `regali` | verb | 2 | seconda persona singolare del congiuntivo di regalare | `regalare` | 82976 /forms/5/form |
| 111953 | `regali` | verb | 3 | terza persona singolare del congiuntivo di regalare | `regalare` | 82976 /forms/5/form |
| 111953 | `regali` | verb | 4 | terza persona singolare dell'imperativo presente di regalare | `regalare` | 82976 /forms/5/form |
| 111961 | `contorni` | verb | 1 | prima persona singolare del congiuntivo presente di contornare | `contornare` | 537431 /forms/6/form |
| 111961 | `contorni` | verb | 2 | seconda persona singolare del congiuntivo presente di contornare | `contornare` | 537431 /forms/6/form |
| 111961 | `contorni` | verb | 3 | terza persona singolare del congiuntivo presente di contornare | `contornare` | 537431 /forms/6/form |
| 111961 | `contorni` | verb | 4 | terza persona singolare dell'imperativo presente di contornare | `contornare` | 537431 /forms/6/form |
| 112079 | `gusti` | verb | 2 | seconda persona singolare del congiuntivo presente di gustare | `gustare` | 48510 /forms/6/form |
| 112079 | `gusti` | verb | 3 | terza persona singolare del congiuntivo presente di gustare | `gustare` | 48510 /forms/6/form |
| 112079 | `gusti` | verb | 4 | terza persona singolare dell'imperativo presente di gustare | `gustare` | 48510 /forms/6/form |
| 112097 | `ricami` | verb | 4 | terza persona singolare dell'imperativo presente di ricamare | `ricamare` | 463003 /forms/5/form |
| 112112 | `interessi` | verb | 0 | seconda persona singolare dell'indicativo presente di interessare | `interessare` | 48613 /forms/6/form |
| 112112 | `interessi` | verb | 2 | seconda persona singolare del congiuntivo presente di interessare | `interessare` | 48613 /forms/6/form |
| 112112 | `interessi` | verb | 3 | terza persona singolare del congiuntivo presente di interessare | `interessare` | 48613 /forms/6/form |
| 112112 | `interessi` | verb | 4 | terza persona singolare dell'imperativo presente di interessare | `interessare` | 48613 /forms/6/form |
| 112138 | `solchi` | verb | 1 | prima persona singolare del congiuntivo presente di solcare | `solcare` | 620607 /forms/5/form |
| 112138 | `solchi` | verb | 2 | seconda persona singolare del congiuntivo presente di solcare | `solcare` | 620607 /forms/5/form |
| 112138 | `solchi` | verb | 3 | terza persona singolare del congiuntivo presente di solcare | `solcare` | 620607 /forms/5/form |
| 112138 | `solchi` | verb | 4 | terza persona singolare dell'imperativo presente di solcare | `solcare` | 620607 /forms/5/form |
| 112153 | `testi` | verb | 0 | seconda persona singolare dell'indicativo presente di testare | `testare` | 215700 /forms/5/form |
| 112153 | `testi` | verb | 1 | prima persona singolare del congiuntivo presente di testare | `testare` | 215700 /forms/5/form |
| 112153 | `testi` | verb | 3 | terza persona singolare del congiuntivo presente di testare | `testare` | 215700 /forms/5/form |
| 112153 | `testi` | verb | 4 | terza persona singolare dell'imperativo presente di testare | `testare` | 215700 /forms/5/form |
| 112186 | `appoggi` | verb | 1 | prima persona singolare del congiuntivo presente di appoggiare | `appoggiare` | 134508 /forms/6/form |
| 112186 | `appoggi` | verb | 2 | seconda persona singolare del congiuntivo presente di appoggiare | `appoggiare` | 134508 /forms/6/form |
| 112186 | `appoggi` | verb | 3 | terza persona singolare del congiuntivo presente di appoggiare | `appoggiare` | 134508 /forms/6/form |
| 112186 | `appoggi` | verb | 4 | terza persona singolare dell'imperativo presente di appoggiare | `appoggiare` | 134508 /forms/6/form |
| 112193 | `obblighi` | verb | 1 | prima persona singolare del congiuntivo presente di obbligare | `obbligare` | 48767 /forms/6/form |
| 112193 | `obblighi` | verb | 2 | seconda persona singolare del congiuntivo presente di obbligare | `obbligare` | 48767 /forms/6/form |
| 112193 | `obblighi` | verb | 3 | terza persona singolare del congiuntivo presente di obbligare | `obbligare` | 48767 /forms/6/form |
| 112193 | `obblighi` | verb | 4 | terza persona singolare dell'imperativo presente di obbligare | `obbligare` | 48767 /forms/6/form |
| 112207 | `parchi` | adj | 0 | plurale di parco | `parco` | 38842 /forms/0/form |
| 112219 | `attacchi` | verb | 1 | prima persona singolare del congiuntivo presente di attaccare | `attaccare` | 8514 /forms/6/form |
| 112219 | `attacchi` | verb | 2 | seconda persona singolare del congiuntivo presente di attaccare | `attaccare` | 8514 /forms/6/form |
| 112219 | `attacchi` | verb | 3 | terza persona singolare del congiuntivo presente di attaccare | `attaccare` | 8514 /forms/6/form |
| 112226 | `aspetti` | verb | 1 | prima persona singolare del congiuntivo presente di aspettare | `aspettare` | 8764 /forms/6/form |
| 112226 | `aspetti` | verb | 2 | seconda persona singolare del congiuntivo presente di aspettare | `aspettare` | 8764 /forms/6/form |
| 112226 | `aspetti` | verb | 3 | terza persona singolare del congiuntivo presente di aspettare | `aspettare` | 8764 /forms/6/form |
| 112226 | `aspetti` | verb | 4 | terza persona singolare dell'imperativo presente di aspettare | `aspettare` | 8764 /forms/6/form |
| 112231 | `ferite` | verb | 0 | participio passato plurale femminile di ferire | `ferire` | 48453 /forms/9/form |
| 112231 | `ferite` | verb | 1 | seconda persona plurale dell'indicativo presente di ferire | `ferire` | 48453 /forms/9/form |
| 112231 | `ferite` | verb | 2 | seconda persona plurale dell'imperativo presente di ferire | `ferire` | 48453 /forms/9/form |
| 112242 | `germogli` | verb | 1 | prima persona singolare del congiuntivo presente di germogliare | `germogliare` | 460892 /forms/5/form |
| 112242 | `germogli` | verb | 2 | seconda persona singolare del congiuntivo presente di germogliare | `germogliare` | 460892 /forms/5/form |
| 112242 | `germogli` | verb | 3 | terza persona singolare del congiuntivo presente di germogliare | `germogliare` | 460892 /forms/5/form |
| 112242 | `germogli` | verb | 4 | terza persona singolare dell'imperativo presente di germogliare | `germogliare` | 460892 /forms/5/form |
| 112254 | `artigli` | verb | 1 | prima persona singolare del congiuntivo presente di artigliare | `artigliare` | 514284 /forms/5/form |
| 112254 | `artigli` | verb | 2 | seconda persona singolare del congiuntivo presente di artigliare | `artigliare` | 514284 /forms/5/form |
| 112254 | `artigli` | verb | 3 | terza persona singolare del congiuntivo presente di artigliare | `artigliare` | 514284 /forms/5/form |
| 112292 | `frammenti` | verb | 0 | seconda persona singolare dell'indicativo presente di frammentare | `frammentare` | 504830 /forms/6/form |
| 112292 | `frammenti` | verb | 1 | prima persona singolare del congiuntivo presente di frammentare | `frammentare` | 504830 /forms/6/form |
| 112292 | `frammenti` | verb | 2 | seconda persona singolare del congiuntivo presente di frammentare | `frammentare` | 504830 /forms/6/form |
| 112292 | `frammenti` | verb | 3 | terza persona singolare del congiuntivo presente di frammentare | `frammentare` | 504830 /forms/6/form |
| 112292 | `frammenti` | verb | 4 | terza persona singolare dell'imperativo presente di frammentare | `frammentare` | 504830 /forms/6/form |
| 112458 | `pesi` | verb | 1 | prima persona singolare del congiuntivo presente di pesare | `pesare` | 135585 /forms/5/form |
| 112458 | `pesi` | verb | 2 | seconda persona singolare del congiuntivo presente di pesare | `pesare` | 135585 /forms/5/form |
| 112458 | `pesi` | verb | 3 | terza persona singolare del congiuntivo presente di pesare | `pesare` | 135585 /forms/5/form |
| 112458 | `pesi` | verb | 4 | terza persona singolare dell'imperativo presente di pesare | `pesare` | 135585 /forms/5/form |
| 112465 | `tagli` | verb | 1 | prima persona singolare del congiuntivo presente di tagliare | `tagliare` | 8711 /forms/6/form |
| 112465 | `tagli` | verb | 2 | seconda persona singolare del congiuntivo presente di tagliare | `tagliare` | 8711 /forms/6/form |
| 112465 | `tagli` | verb | 3 | terza persona singolare del congiuntivo presente di tagliare | `tagliare` | 8711 /forms/6/form |
| 112465 | `tagli` | verb | 4 | terza persona singolare dell'imperativo presente di tagliare | `tagliare` | 8711 /forms/6/form |
| 112528 | `utilizzi` | verb | 1 | prima persona singolare del congiuntivo presente di utilizzare | `utilizzare` | 50434 /forms/5/form |
| 112528 | `utilizzi` | verb | 2 | seconda persona singolare del congiuntivo presente di utilizzare | `utilizzare` | 50434 /forms/5/form |
| 112528 | `utilizzi` | verb | 3 | terza persona singolare del congiuntivo presente di utilizzare | `utilizzare` | 50434 /forms/5/form |
| 112528 | `utilizzi` | verb | 4 | terza persona singolare dell'imperativo presente di utilizzare | `utilizzare` | 50434 /forms/5/form |
| 112530 | `impieghi` | verb | 0 | seconda persona singolare dell'indicativo presente di impiegare | `impiegare` | 2715 /forms/6/form |
| 112530 | `impieghi` | verb | 1 | prima persona singolare del congiuntivo presente di impiegare | `impiegare` | 2715 /forms/6/form |
| 112530 | `impieghi` | verb | 2 | seconda persona singolare del congiuntivo presente di impiegare | `impiegare` | 2715 /forms/6/form |
| 112530 | `impieghi` | verb | 3 | terza persona singolare del congiuntivo presente di impiegare | `impiegare` | 2715 /forms/6/form |
| 112530 | `impieghi` | verb | 4 | terza persona singolare dell'imperativo presente di impiegare | `impiegare` | 2715 /forms/6/form |
| 112690 | `rapaci` | adj | 0 | plurale di rapace | `rapace` | 52775 /forms/0/form |
| 112866 | `coloro` | pron | 0 | plurale di colui | `colui` | 417857 /forms/0/form |
| 112974 | `autunnali` | noun | 0 | plurale di autunnale | `autunnale` | 112971 /forms/0/form |
| 113020 | `movimenti` | verb | 1 | prima persona singolare del congiuntivo presente di movimentare | `movimentare` | 464488 /forms/5/form |
| 113020 | `movimenti` | verb | 2 | seconda persona singolare del congiuntivo presente di movimentare | `movimentare` | 464488 /forms/5/form |
| 113020 | `movimenti` | verb | 3 | terza persona singolare del congiuntivo presente di movimentare | `movimentare` | 464488 /forms/5/form |
| 113020 | `movimenti` | verb | 4 | terza persona singolare dell'imperativo presente di movimentare | `movimentare` | 464488 /forms/5/form |
| 113077 | `traghetti` | verb | 1 | prima persona singolare del congiuntivo presente di traghettare | `traghettare` | 137863 /forms/5/form |
| 113077 | `traghetti` | verb | 2 | seconda persona singolare del congiuntivo presente di traghettare | `traghettare` | 137863 /forms/5/form |
| 113077 | `traghetti` | verb | 3 | terza persona singolare del congiuntivo presente di traghettare | `traghettare` | 137863 /forms/5/form |
| 113077 | `traghetti` | verb | 4 | terza persona singolare dell'imperativo presente di traghettare | `traghettare` | 137863 /forms/5/form |
| 113172 | `calchi` | verb | 0 | seconda persona singolare dell'indicativo presente di calcare | `calcare` | 43035 /forms/5/form |
| 113172 | `calchi` | verb | 1 | prima persona singolare del congiuntivo presente di calcare | `calcare` | 43035 /forms/5/form |
| 113172 | `calchi` | verb | 2 | seconda persona singolare del congiuntivo presente di calcare | `calcare` | 43035 /forms/5/form |
| 113172 | `calchi` | verb | 3 | terza persona singolare del congiuntivo presente di calcare | `calcare` | 43035 /forms/5/form |
| 113172 | `calchi` | verb | 4 | terza persona singolare dell'imperativo presente di calcare | `calcare` | 43035 /forms/5/form |
| 113194 | `architetti` | verb | 1 | prima persona singolare del congiuntivo presente di architettare | `architettare` | 454576 /forms/5/form |
| 113194 | `architetti` | verb | 2 | seconda persona singolare del congiuntivo presente di architettare | `architettare` | 454576 /forms/5/form |
| 113194 | `architetti` | verb | 3 | terza persona singolare del congiuntivo presente di architettare | `architettare` | 454576 /forms/5/form |
| 113194 | `architetti` | verb | 4 | terza persona singolare dell'imperativo presente di architettare | `architettare` | 454576 /forms/5/form |
| 113646 | `entrambe` | pron | 0 | femminile di entrambi | `entrambi` | 17750 /forms/0/form |
| 113865 | `rinforzi` | verb | 1 | prima persona singolare del congiuntivo presente di rinforzare | `rinforzare` | 459898 /forms/5/form |
| 113865 | `rinforzi` | verb | 2 | seconda persona singolare del congiuntivo presente di rinforzare | `rinforzare` | 459898 /forms/5/form |
| 113865 | `rinforzi` | verb | 4 | terza persona singolare dell'imperativo presente di rinforzare | `rinforzare` | 459898 /forms/5/form |
| 113920 | `mangiate` | noun | 0 | femminile plurale di mangiata | `mangiata` | 113922 /forms/0/form |
| 113937 | `cristiani` | noun | 0 | plurale di cristiano | `cristiano` | 15547 /forms/0/form |
| 114006 | `versi` | adj | 0 | plurale di verso | `verso` | 124456 /forms/0/form |
| 114128 | `almanacchi` | verb | 1 | prima persona singolare del congiuntivo presente di almanaccare | `almanaccare` | 511698 /forms/5/form |
| 114128 | `almanacchi` | verb | 2 | seconda persona singolare del congiuntivo presente di almanaccare | `almanaccare` | 511698 /forms/5/form |
| 114128 | `almanacchi` | verb | 3 | terza persona singolare del congiuntivo presente di almanaccare | `almanaccare` | 511698 /forms/5/form |
| 114128 | `almanacchi` | verb | 4 | terza persona singolare dell'imperativo presente di almanaccare | `almanaccare` | 511698 /forms/5/form |
| 114289 | `argini` | verb | 1 | prima persona singolare del congiuntivo presente di arginare | `arginare` | 136888 /forms/5/form |
| 114289 | `argini` | verb | 2 | seconda persona singolare del congiuntivo presente di arginare | `arginare` | 136888 /forms/5/form |
| 114289 | `argini` | verb | 3 | terza persona singolare del congiuntivo presente di arginare | `arginare` | 136888 /forms/5/form |
| 114289 | `argini` | verb | 4 | terza persona singolare dell'imperativo presente di arginare | `arginare` | 136888 /forms/5/form |
| 114349 | `romanzi` | verb | 1 | prima persona singolare del congiuntivo presente di romanzare | `romanzare` | 412697 /forms/5/form |
| 114349 | `romanzi` | verb | 2 | seconda persona singolare del congiuntivo presente di romanzare | `romanzare` | 412697 /forms/5/form |
| 114349 | `romanzi` | verb | 3 | terza persona singolare del congiuntivo presente di romanzare | `romanzare` | 412697 /forms/5/form |
| 114349 | `romanzi` | verb | 4 | terza persona singolare dell'imperativo presente di romanzare | `romanzare` | 412697 /forms/5/form |
| 114526 | `specchi` | verb | 1 | prima persona singolare del congiuntivo presente di specchiare | `specchiare` | 588479 /forms/6/form |
| 114526 | `specchi` | verb | 2 | seconda persona singolare del congiuntivo presente di specchiare | `specchiare` | 588479 /forms/6/form |
| 114526 | `specchi` | verb | 3 | terza persona singolare del congiuntivo presente di specchiare | `specchiare` | 588479 /forms/6/form |
| 114526 | `specchi` | verb | 4 | terza persona singolare dell'imperativo presente di specchiare | `specchiare` | 588479 /forms/6/form |
| 114634 | `scavi` | verb | 1 | prima persona singolare del presente semplice congiuntivo di scavare | `scavare` | 82713 /forms/5/form |
| 114634 | `scavi` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di scavare | `scavare` | 82713 /forms/5/form |
| 114634 | `scavi` | verb | 3 | terza persona singolare del presente semplice congiuntivo di scavare | `scavare` | 82713 /forms/5/form |
| 114642 | `spuntino` | verb | 0 | terza persona plurale del congiuntivo presente di spuntare | `spuntare` | 134499 /forms/69/form |
| 114642 | `spuntino` | verb | 1 | terza persona plurale dell'imperativo presente di spuntare | `spuntare` | 134499 /forms/69/form |
| 114669 | `cataloghi` | verb | 1 | prima persona singolare del presente semplice congiuntivo di catalogare | `catalogare` | 110633 /forms/5/form |
| 114669 | `cataloghi` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di catalogare | `catalogare` | 110633 /forms/5/form |
| 114669 | `cataloghi` | verb | 3 | terza persona singolare del presente semplice congiuntivo di catalogare | `catalogare` | 110633 /forms/5/form |
| 114747 | `blocchi` | verb | 1 | prima persona singolare del congiuntivo presente di bloccare | `bloccare` | 417960 /forms/5/form |
| 114747 | `blocchi` | verb | 2 | seconda persona singolare del congiuntivo presente di bloccare | `bloccare` | 417960 /forms/5/form |
| 114747 | `blocchi` | verb | 3 | terza persona singolare del congiuntivo presente di bloccare | `bloccare` | 417960 /forms/5/form |
| 114747 | `blocchi` | verb | 4 | terza persona singolare dell'imperativo presente di bloccare | `bloccare` | 417960 /forms/5/form |
| 115371 | `profeti` | verb | 4 | terza persona singolare dell'imperativo presente di profetare | `profetare` | 134003 /forms/5/form |
| 115532 | `diletto` | verb | 0 | prima persona singolare dell'indicativo presente di dilettare | `dilettare` | 449316 /forms/4/form |
| 116280 | `alterchi` | verb | 1 | prima persona singolare del congiuntivo presente di altercare | `altercare` | 490667 /forms/5/form |
| 116280 | `alterchi` | verb | 2 | seconda persona singolare del congiuntivo presente di altercare | `altercare` | 490667 /forms/5/form |
| 116280 | `alterchi` | verb | 3 | terza persona singolare del congiuntivo presente di altercare | `altercare` | 490667 /forms/5/form |
| 116280 | `alterchi` | verb | 4 | terza persona singolare dell'imperativo presente di altercare | `altercare` | 490667 /forms/5/form |
| 116527 | `scanni` | verb | 1 | prima persona singolare del presente semplice congiuntivo di scannare | `scannare` | 134280 /forms/5/form |
| 116527 | `scanni` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di scannare | `scannare` | 134280 /forms/5/form |
| 116527 | `scanni` | verb | 3 | terza persona singolare del presente semplice congiuntivo di scannare | `scannare` | 134280 /forms/5/form |
| 117455 | `liberi` | verb | 1 | prima persona singolare del congiuntivo presente di liberare | `liberare` | 48688 /forms/6/form |
| 117455 | `liberi` | verb | 2 | seconda persona singolare del congiuntivo presente di liberare | `liberare` | 48688 /forms/6/form |
| 117455 | `liberi` | verb | 3 | terza persona singolare del congiuntivo presente di liberare | `liberare` | 48688 /forms/6/form |
| 117455 | `liberi` | verb | 4 | terza persona singolare dell'imperativo presente di liberare | `liberare` | 48688 /forms/6/form |
| 118524 | `diletti` | verb | 2 | prima persona singolare del congiuntivo presente di dilettare | `dilettare` | 449316 /forms/5/form |
| 118749 | `esamini` | verb | 1 | prima persona singolare del congiuntivo presente di esaminare | `esaminare` | 48396 /forms/5/form |
| 118749 | `esamini` | verb | 2 | seconda persona singolare del congiuntivo presente di esaminare | `esaminare` | 48396 /forms/5/form |
| 118749 | `esamini` | verb | 3 | terza persona singolare del congiuntivo presente di esaminare | `esaminare` | 48396 /forms/5/form |
| 118749 | `esamini` | verb | 4 | terza persona singolare dell'imperativo presente di esaminare | `esaminare` | 48396 /forms/5/form |
| 119405 | `oppositrice` | noun | 0 | femminile singolare di oppositore | `oppositore` | 119400 /forms/1/form |
| 119887 | `queste` | pron | 0 | femminile plurale di questo | `questo` | 39248 /forms/2/form |
| 120023 | `nona` | adj | 0 | femminile di nono | `nono` | 30461 /forms/1/form |
| 120095 | `abalieni` | verb | 2 | seconda persona singolare del congiuntivo presente di abalienare | `abalienare` | 71489 /forms/5/form |
| 120095 | `abalieni` | verb | 3 | terza persona singolare del congiuntivo presente di abalienare | `abalienare` | 71489 /forms/5/form |
| 121159 | `cazare` | noun | 0 | plurale di cazara, vedi cazaro | `cazara` | 121157 /forms/0/form |
| 121230 | `avvisi` | verb | 1 | prima persona singolare del congiuntivo presente di avvisare | `avvisare` | 136117 /forms/6/form |
| 121230 | `avvisi` | verb | 2 | seconda persona singolare del congiuntivo presente di avvisare | `avvisare` | 136117 /forms/6/form |
| 121230 | `avvisi` | verb | 3 | terza persona singolare del congiuntivo presente di avvisare | `avvisare` | 136117 /forms/6/form |
| 121230 | `avvisi` | verb | 4 | terza persona singolare dell'imperativo presente di avvisare | `avvisare` | 136117 /forms/6/form |
| 121383 | `galvani` | noun | 0 | plurale di galvano | `galvano` | 121382 /forms/0/form |
| 121493 | `incessi` | noun | 0 | plurale di incesso | `incesso` | 121490 /forms/0/form |
| 122111 | `urlo` | noun | 1 | prima persona singolare dell'indicativo presente di urlare | `urlare` | 82709 /forms/4/form |
| 122437 | `abbracciati` | verb | 1 | participio passato plurale di abbracciarsi | `abbracciarsi` | 47444 /forms/89/form |
| 122457 | `Cosa` | noun | 0 | femminile di Coso | `Coso` | 122453 /forms/1/form |
| 122501 | `sbarrato` | verb | 0 | participio passato di sbarrare | `sbarrare` | 8696 /forms/3/form |
| 122503 | `sbarra` | verb | 1 | seconda persona singolare dell'imperativo presente di sbarrare | `sbarrare` | 8696 /forms/6/form |
| 122603 | `arcuato` | verb | 0 | participio passato di arcuare | `arcuare` | 511858 /forms/3/form |
| 123353 | `pneumatici` | adj | 0 | plurale di pneumatico | `pneumatico` | 37616 /forms/0/form |
| 123979 | `plana` | verb | 0 | terza persona singolare dell'indicativo presente di planare | `planare` | 479050 /forms/6/form |
| 123979 | `plana` | verb | 1 | seconda persona singolare dell'imperativo presente di planare | `planare` | 479050 /forms/6/form |
| 124907 | `olofrastica` | adj | 0 | femminile di olofrastico | `olofrastico` | 33928 /forms/1/form |
| 125320 | `destra` | adj | 0 | femminile di destro | `destro` | 137655 /forms/1/form |
| 125430 | `schiera` | verb | 1 | seconda persona singolare dell'imperativo presente di schierare | `schierare` | 446924 /forms/7/form |
| 125443 | `curvo` | verb | 0 | prima persona singolare dell'indicativo presente di curvare | `curvare` | 48160 /forms/5/form |
| 125456 | `scanalato` | verb | 0 | participio passato di scanalare | `scanalare` | 465375 /forms/3/form |
| 125719 | `volontaria` | noun | 0 | femminile di volontario | `volontario` | 125716 /forms/1/form |
| 125827 | `nunzia` | noun | 0 | femminile di nunzio | `nunzio` | 125828 /forms/1/form |
| 125882 | `stolta` | noun | 0 | femminile di stolto | `stolto` | 125895 /forms/1/form |
| 126081 | `ardito` | verb | 0 | participio passato di ardire | `ardire` | 111978 /forms/3/form |
| 126229 | `punteggiato` | verb | 0 | participio passato di punteggiare | `punteggiare` | 544654 /forms/3/form |
| 126259 | `sradicato` | verb | 0 | participio passato di sradicare | `sradicare` | 50082 /forms/4/form |
| 126491 | `rivoltato` | verb | 0 | participio passato di rivoltare | `rivoltare` | 465406 /forms/3/form |
| 126548 | `supporti` | noun | 0 | plurale di supporto | `supporto` | 269299 /forms/0/form |
| 127022 | `maritata` | adj | 0 | femminile di maritato | `maritato` | 258233 /forms/1/form |
| 127950 | `ciabatta` | verb | 1 | seconda persona singolare dell'imperativo presente di ciabattare | `ciabattare` | 530678 /forms/6/form |
| 129501 | `spazzino` | verb | 0 | terza persona plurale del congiuntivo presente di spazzare | `spazzare` | 221802 /forms/69/form |
| 129501 | `spazzino` | verb | 1 | terza persona plurale dell'imperativo presente di spazzare | `spazzare` | 221802 /forms/69/form |
| 129821 | `infilato` | verb | 0 | participio passato di infilare | `infilare` | 421850 /forms/4/form |
| 130141 | `potenziato` | verb | 0 | participio passato di potenziare | `potenziare` | 48989 /forms/3/form |
| 130322 | `stecchino` | verb | 1 | terza persona plurale dell'imperativo presente di steccare | `steccare` | 67792 /forms/69/form |
| 130711 | `circoli` | verb | 2 | seconda persona singolare del congiuntivo presente di circolare | `circolare` | 111121 /forms/5/form |
| 130711 | `circoli` | verb | 3 | terza persona singolare del congiuntivo presente di circolare | `circolare` | 111121 /forms/5/form |
| 130711 | `circoli` | verb | 4 | terza persona singolare dell'imperativo presente di circolare | `circolare` | 111121 /forms/5/form |
| 130769 | `coricato` | verb | 0 | participio passato di coricare | `coricare` | 464118 /forms/4/form |
| 131430 | `piantato` | verb | 0 | participio passato di piantare | `piantare` | 111356 /forms/3/form |
| 131638 | `sfogliato` | verb | 0 | participio passato di sfogliare | `sfogliare` | 417903 /forms/3/form |
| 131731 | `cerchiato` | verb | 0 | participio passato di cerchiare | `cerchiare` | 530638 /forms/3/form |
| 132187 | `pronunzia` | verb | 1 | seconda persona singolare dell'imperativo presente di pronunziare | `pronunziare` | 101238 /forms/6/form |
| 132907 | `ascesa` | adj | 0 | femminile di asceso | `asceso` | 439565 /forms/1/form |
| 133160 | `divorzio` | verb | 0 | prima persona singolare dell'indicativo presente di divorziare | `divorziare` | 48335 /forms/4/form |
| 133240 | `facinorosi` | adj | 0 | plurale di facinoroso, ovvero incline alla violenza e alla ribellione. | `facinoroso` | 74098 /forms/0/form |
| 133848 | `gloria` | verb | 1 | seconda persona singolare dell'imperativo presente di gloriare | `gloriare` | 464111 /forms/7/form |
| 133892 | `transenna` | verb | 1 | seconda persona singolare dell'imperativo presente di transennare | `transennare` | 465628 /forms/6/form |
| 133949 | `medianici` | noun | 0 | plurale di medianico | `medianico` | 133950 /forms/0/form |
| 133979 | `correlato` | verb | 0 | participio passato di correlare, correlarsi | `correlare` | 109179 /forms/3/form |
| 134107 | `argentino` | verb | 0 | terza persona plurale del congiuntivo presente di argentare | `argentare` | 514092 /forms/69/form |
| 134107 | `argentino` | verb | 1 | terza persona plurale dell'imperativo presente di argentare | `argentare` | 514092 /forms/69/form |
| 134408 | `congegnato` | verb | 0 | participio passato di congegnare | `congegnare` | 535705 /forms/3/form |
| 135507 | `pelo` | verb | 0 | prima persona singolare dell'indicativo presente di pelare | `pelare` | 421342 /forms/4/form |
| 135511 | `aporetica` | adj | 0 | femminile di aporetico | `aporetico` | 107989 /forms/1/form |
| 135546 | `tonni` | noun | 0 | plurale di tonno | `tonno` | 55076 /forms/0/form |
| 135546 | `tonni` | noun | 1 | plurale di tonno | `tonno` | 55076 /forms/0/form |
| 135570 | `bagnate` | verb | 1 | seconda persona plurale dell'indicativo presente di bagnare | `bagnare` | 131958 /forms/9/form |
| 135570 | `bagnate` | verb | 2 | seconda persona plurale dell'imperativo presente di bagnare | `bagnare` | 131958 /forms/9/form |
| 135796 | `grazia` | verb | 0 | terza persona singolare dell'indicativo presente di graziare | `graziare` | 460916 /forms/6/form |
| 135796 | `grazia` | verb | 1 | seconda persona singolare dell'imperativo presente di graziare | `graziare` | 460916 /forms/6/form |
| 136449 | `fecondo` | verb | 0 | prima persona singolare dell'indicativo presente di fecondare | `fecondare` | 138504 /forms/4/form |
| 136753 | `destino` | verb | 0 | terza persona plurale del congiuntivo presente di destare | `destare` | 460016 /forms/70/form |
| 136753 | `destino` | verb | 1 | terza persona plurale dell'imperativo presente di destare | `destare` | 460016 /forms/70/form |
| 136892 | `cooperativa` | adj | 0 | femminile di cooperativo | `cooperativo` | 404927 /forms/1/form |
| 137195 | `sposi` | noun | 0 | plurale di sposo | `sposo` | 43447 /forms/0/form |
| 137212 | `annullato` | verb | 0 | participio passato di annullare | `annullare` | 72912 /forms/4/form |
| 137290 | `depravato` | verb | 0 | participio passato di depravare | `depravare` | 539006 /forms/3/form |
| 137525 | `statica` | adj | 0 | femminile di statico | `statico` | 55264 /forms/1/form |
| 137691 | `amminoglicosidi` | noun | 0 | plurale di amminoglicoside | `amminoglicoside` | 137684 /forms/0/form |
| 137701 | `recettori` | noun | 0 | plurale di recettore | `recettore` | 137698 /forms/0/form |
| 137702 | `recettrice` | noun | 0 | femminile di recettore | `recettore` | 137698 /forms/1/form |
| 137703 | `recettrici` | noun | 0 | femminile plurale di recettore | `recettore` | 137698 /forms/2/form |
| 138217 | `cotizzi` | noun | 0 | plurale di cotizzo | `cotizzo` | 138213 /forms/0/form |
| 138245 | `frullato` | adj | 0 | participio passato di frullare | `frullare` | 138248 /forms/3/form |
| 138280 | `fiacca` | adj | 0 | femminile di fiacco | `fiacco` | 138359 /forms/1/form |
| 138375 | `piccato` | adj | 0 | participio passato di piccare | `piccare` | 467302 /forms/3/form |
| 138390 | `fodera` | verb | 1 | seconda persona singolare dell'imperativo presente di foderare | `foderare` | 420765 /forms/6/form |
| 138403 | `pendii` | noun | 0 | plurale di pendio | `pendio` | 140477 /forms/0/form |
| 139073 | `cenci` | noun | 0 | plurale di cencio | `cencio` | 43803 /forms/0/form |
| 139746 | `cuori` | noun | 0 | plurale di cuore | `cuore` | 39371 /forms/0/form |
| 140252 | `sutura` | verb | 1 | seconda persona singolare dell'imperativo presente di suturare | `suturare` | 464931 /forms/6/form |
| 141798 | `abituata` | adj | 0 | femminile di abituato | `abituato` | 141795 /forms/1/form |
| 143112 | `accatastati` | adj | 0 | plurale di accatastato | `accatastato` | 143111 /forms/0/form |
| 145446 | `bussi` | noun | 0 | plurale di busso | `busso` | 145444 /forms/0/form |
| 147822 | `illuminata` | adj | 0 | femminile di illuminato | `illuminato` | 124085 /forms/1/form |
| 150054 | `miniate` | verb | 2 | seconda persona plurale dell'indicativo presente di miniare | `miniare` | 43147 /forms/8/form |
| 150054 | `miniate` | verb | 3 | seconda persona plurale del congiuntivo presente di miniare | `miniare` | 43147 /forms/8/form |
| 150054 | `miniate` | verb | 4 | seconda persona plurale dell'imperativo presente di miniare | `miniare` | 43147 /forms/8/form |
| 150392 | `originata` | adj | 0 | femminile di originato | `originato` | 150390 /forms/1/form |
| 150815 | `portate` | adj | 0 | femminile plurale di portato | `portato` | 52407 /forms/2/form |
| 152862 | `spariamo` | verb | 3 | prima persona plurale dell'indicativo presente di sparire | `sparire` | 50053 /forms/7/form |
| 152862 | `spariamo` | verb | 4 | prima persona plurale del congiuntivo presente di sparire | `sparire` | 50053 /forms/7/form |
| 152862 | `spariamo` | verb | 5 | prima persona plurale dell'imperativo di sparire | `sparire` | 50053 /forms/7/form |
| 155046 | `alterate` | adj | 0 | femminile plurale di alterato | `alterato` | 41903 /forms/2/form |
| 155562 | `addestrate` | adj | 0 | femminile plurale di addestrato | `addestrato` | 125408 /forms/2/form |
| 157502 | `confederate` | adj | 0 | femminile plurale di confederato | `confederato` | 157494 /forms/2/form |
| 157763 | `considerata` | adj | 0 | femminile di considerato | `considerato` | 51122 /forms/1/form |
| 157945 | `curata` | adj | 0 | femminile di curato | `curato` | 49097 /forms/1/form |
| 159553 | `dorata` | adj | 0 | femminile di dorato | `dorato` | 52702 /forms/1/form |
| 159559 | `dorate` | adj | 0 | femminile plurale di dorato | `dorato` | 52702 /forms/2/form |
| 163343 | `migliorate` | adj | 0 | femminile plurale di migliorato | `migliorato` | 163334 /forms/2/form |
| 164154 | `oscura` | adj | 0 | femminile di oscuro | `oscuro` | 44617 /forms/1/form |
| 164878 | `preparate` | adj | 0 | femminile plurale di preparato | `preparato` | 52475 /forms/2/form |
| 165047 | `prosperi` | adj | 0 | plurale di prospero | `prospero` | 137707 /forms/0/form |
| 166870 | `scioperanti` | noun | 0 | plurale di scioperante | `scioperante` | 53326 /forms/0/form |
| 167748 | `sgombri` | adj | 0 | plurale di sgombro | `sgombro` | 135698 /forms/0/form |
| 167751 | `sgombra` | adj | 0 | femminile di sgombro | `sgombro` | 135698 /forms/1/form |
| 168580 | `fumò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di fumare | `fumare` | 48506 /forms/18/form |
| 168822 | `stemperata` | adj | 0 | femminile di stemperato | `stemperato` | 168819 /forms/1/form |
| 169589 | `tarata` | noun | 0 | femminile di tarato | `tarato` | 169586 /forms/1/form |
| 169817 | `tirate` | noun | 0 | plurale di tirata | `tirata` | 54790 /forms/2/form |
| 169853 | `tollerata` | adj | 0 | femminile di tollerato | `tollerato` | 169850 /forms/1/form |
| 169854 | `tollerata` | noun | 0 | femminile di tollerato | `tollerato` | 169850 /forms/1/form |
| 171144 | `affamati` | adj | 0 | plurale di affamato | `affamato` | 122146 /forms/0/form |
| 171534 | `armate` | adj | 0 | femminile plurale di armato | `armato` | 126037 /forms/2/form |
| 173582 | `domi` | adj | 0 | plurale di domo | `domo` | 173577 /forms/0/form |
| 175503 | `mima` | noun | 0 | femminile plurale di mimo | `mimo` | 175500 /forms/1/form |
| 177174 | `bolli` | noun | 0 | plurale di bollo | `bollo` | 177172 /forms/0/form |
| 179690 | `fotografata` | adj | 0 | femminile di fotografato | `fotografato` | 179686 /forms/1/form |
| 181638 | `russi` | adj | 0 | plurale di russo | `russo` | 166 /forms/0/form |
| 181639 | `russi` | noun | 0 | plurale di russo | `russo` | 166 /forms/0/form |
| 181934 | `trattati` | noun | 0 | plurale di trattato | `trattato` | 55211 /forms/0/form |
| 182647 | `inculate` | noun | 0 | plurale di inculata | `inculata` | 182639 /forms/2/form |
| 182689 | `meditate` | adj | 0 | femminile di meditato | `meditato` | 138776 /forms/2/form |
| 182729 | `presento` | verb | 1 | prima persona singolare dell'indicativo presente di presentire | `presentire` | 136415 /forms/4/form |
| 182730 | `presenta` | verb | 3 | seconda persona singolare del congiuntivo presente di presentire | `presentire` | 136415 /forms/64/form |
| 182730 | `presenta` | verb | 4 | terza persona singolare del congiuntivo presente di presentire | `presentire` | 136415 /forms/64/form |
| 182730 | `presenta` | verb | 5 | terza persona singolare dell'imperativo presente di presentire | `presentire` | 136415 /forms/64/form |
| 182769 | `vuota` | adj | 0 | femminile di vuoto | `vuoto` | 55689 /forms/1/form |
| 184370 | `precipitate` | adj | 0 | femminile plurale di precipitato | `precipitato` | 184363 /forms/2/form |
| 185260 | `suscitati` | adj | 0 | plurale di suscitato | `suscitato` | 185257 /forms/0/form |
| 186523 | `aggiogate` | adj | 0 | femminile plurale di aggiogato | `aggiogato` | 130313 /forms/2/form |
| 188062 | `bloccata` | adj | 0 | femminile di bloccato | `bloccato` | 133830 /forms/1/form |
| 189852 | `corrugate` | adj | 0 | femminile plurale di corrugato | `corrugato` | 189845 /forms/2/form |
| 190984 | `disbrigò` | verb | 1 | seconda persona singolare dell'imperativo presente di disbrigare | `disbrigare` | 544359 /forms/18/form |
| 191838 | `elencati` | adj | 0 | plurale di elencato | `elencato` | 191836 /forms/0/form |
| 192263 | `essiccati` | adj | 0 | plurale di essiccato | `essiccato` | 192261 /forms/0/form |
| 193749 | `implicata` | adj | 0 | femminile di implicato | `implicato` | 193746 /forms/1/form |
| 195945 | `negata` | adj | 0 | femminile di negato | `negato` | 195940 /forms/1/form |
| 197166 | `prodiga` | adj | 0 | femminile di prodigo | `prodigo` | 197160 /forms/1/form |
| 197884 | `qualificate` | adj | 0 | femminile plurale di qualificato | `qualificato` | 197877 /forms/2/form |
| 199639 | `rinnegate` | adj | 0 | femminile plurale di rinnegato | `rinnegato` | 133906 /forms/2/form |
| 200772 | `scarichi` | adj | 0 | plurale di scarico | `scarico` | 8119 /forms/0/form |
| 200773 | `scarichi` | noun | 0 | plurale di scarico | `scarico` | 8119 /forms/0/form |
| 201215 | `sfoghi` | noun | 0 | plurale di sfogo | `sfogo` | 54051 /forms/0/form |
| 201219 | `sfogate` | adj | 0 | femminile plurale di sfogato | `sfogato` | 201212 /forms/2/form |
| 202081 | `sofisticata` | adj | 0 | femminile di sofisticato | `sofisticato` | 202078 /forms/1/form |
| 203045 | `svaghi` | noun | 0 | plurale di svago | `svago` | 139270 /forms/0/form |
| 203448 | `truccati` | adj | 0 | plurale di truccato | `truccato` | 203446 /forms/0/form |
| 205057 | `allacciata` | adj | 0 | femminile di allacciato | `allacciato` | 205054 /forms/1/form |
| 205349 | `angosciati` | adj | 0 | plurale di angosciato | `angosciato` | 205347 /forms/0/form |
| 207015 | `crucci` | noun | 0 | plurale di cruccio | `cruccio` | 49018 /forms/0/form |
| 209729 | `messaggi` | noun | 0 | plurale di messaggio | `messaggio` | 39523 /forms/0/form |
| 210055 | `avvocatessa` | noun | 0 | femminile di avvocato | `avvocato` | 8356 /forms/1/form |
| 210232 | `parcheggiata` | adj | 0 | femminile di parcheggiato | `parcheggiato` | 210228 /forms/1/form |
| 211614 | `scheggiate` | adj | 0 | femminile plurale di scheggiato | `scheggiato` | 211608 /forms/2/form |
| 212725 | `setacciati` | adj | 0 | plurale di setacciato | `setacciato` | 212724 /forms/0/form |
| 213362 | `sorteggi` | noun | 0 | plurale di sorteggio | `sorteggio` | 213360 /forms/0/form |
| 216777 | `esaltata` | adj | 0 | femminile di esaltato | `esaltato` | 216773 /forms/1/form |
| 216875 | `regnanti` | adj | 0 | plurale di regnante | `regnante` | 216872 /forms/0/form |
| 216876 | `regnanti` | noun | 0 | plurale di regnante | `regnante` | 216872 /forms/0/form |
| 218134 | `frese` | noun | 0 | plurale di fresa | `fresa` | 41961 /forms/0/form |
| 218713 | `citerei` | adj | 0 | plurale di citereo | `citereo` | 584639 /forms/0/form |
| 219435 | `carabinieri` | noun | 0 | plurale di carabiniere | `carabiniere` | 48150 /forms/0/form |
| 222186 | `forzata` | adj | 0 | femminile di forzato | `forzato` | 49877 /forms/1/form |
| 223772 | `molesti` | adj | 0 | maschile plurale di molesto | `molesto` | 138655 /forms/0/form |
| 224644 | `intarsiata` | adj | 0 | femminile di intarsiato | `intarsiato` | 224641 /forms/1/form |
| 225807 | `tributata` | adj | 0 | femminile di tributato | `tributato` | 225805 /forms/1/form |
| 226055 | `vegeti` | adj | 0 | plurale di vegeto | `vegeto` | 226053 /forms/0/form |
| 226202 | `violati` | adj | 0 | plurale di violato | `violato` | 226200 /forms/0/form |
| 227326 | `rifiutata` | adj | 0 | femminile di rifiutato | `rifiutato` | 227323 /forms/1/form |
| 227702 | `sospettati` | adj | 0 | plurale di sospettato | `sospettato` | 227700 /forms/0/form |
| 227871 | `ritrovate` | noun | 0 | plurale di ritrovato | `ritrovato` | 53113 /forms/2/form |
| 227953 | `riservata` | adj | 0 | femminile di riservato | `riservato` | 54971 /forms/1/form |
| 228780 | `rappresentate` | adj | 0 | femminile plurale di rappresentato | `rappresentato` | 228770 /forms/2/form |
| 229042 | `riposi` | noun | 0 | plurale di riposo | `riposo` | 53067 /forms/0/form |
| 229085 | `sciamannato` | verb | 0 | participio passato passato di sciamannare | `sciamannare` | 49899 /forms/3/form |
| 230280 | `posizionati` | adj | 0 | plurale di posizionato | `posizionato` | 230278 /forms/0/form |
| 231693 | `attrezzata` | adj | 0 | femminile di attrezzato | `attrezzato` | 50940 /forms/1/form |
| 232434 | `scheda` | verb | 0 | terza persona singolare dell'indicativo presente di schedare | `schedare` | 458629 /forms/6/form |
| 232434 | `scheda` | verb | 1 | seconda persona singolare dell'imperativo presente di schedare | `schedare` | 458629 /forms/6/form |
| 233091 | `concordata` | adj | 0 | femminile di concordato | `concordato` | 136351 /forms/1/form |
| 235977 | `attenti` | adj | 0 | plurale di attento | `attento` | 8622 /forms/0/form |
| 237270 | `crostata` | adj | 0 | femminile di crostato | `crostato` | 237268 /forms/1/form |
| 240825 | `sorvoli` | noun | 0 | plurale di sorvolo | `sorvolo` | 240823 /forms/0/form |
| 241527 | `meccanizzati` | adj | 0 | plurale di meccanizzato | `meccanizzato` | 241525 /forms/0/form |
| 241743 | `aggiornata` | adj | 0 | femminile di aggiornato | `aggiornato` | 135803 /forms/1/form |
| 241916 | `schivi` | adj | 0 | femminile di schivo | `schivo` | 55018 /forms/0/form |
| 241918 | `schiva` | adj | 0 | femminile di schivo | `schivo` | 55018 /forms/1/form |
| 245101 | `scontate` | adj | 0 | femminile plurale di scontato | `scontato` | 138745 /forms/2/form |
| 245950 | `accoltellati` | adj | 0 | plurale di accoltellato | `accoltellato` | 245948 /forms/0/form |
| 246088 | `scarti` | adj | 0 | plurale di scarto | `scarto` | 246085 /forms/0/form |
| 246089 | `scarti` | noun | 0 | plurale di scarto | `scarto` | 246085 /forms/0/form |
| 247112 | `congegni` | noun | 0 | plurale di congegno | `congegno` | 247110 /forms/0/form |
| 252362 | `prezzolate` | adj | 0 | femminile plurale di prezzolato | `prezzolato` | 73016 /forms/2/form |
| 254085 | `recapitate` | adj | 0 | femminile plurale di recapitato | `recapitato` | 254074 /forms/2/form |
| 255118 | `civilizzata` | adj | 0 | femminile di civilizzato | `civilizzato` | 255114 /forms/1/form |
| 261709 | `compatti` | adj | 0 | plurale di compatto | `compatto` | 139204 /forms/0/form |
| 264079 | `sollecita` | adj | 0 | femminile di sollecito | `sollecito` | 264073 /forms/1/form |
| 266594 | `cesellati` | adj | 0 | plurale di cesellato | `cesellato` | 266592 /forms/0/form |
| 269211 | `stonata` | adj | 0 | femminile di stonato | `stonato` | 269207 /forms/1/form |
| 269212 | `stonata` | noun | 0 | femminile di stonato | `stonato` | 269207 /forms/1/form |
| 269297 | `supportata` | adj | 0 | femminile singolare di supportato | `supportato` | 269294 /forms/1/form |
| 272630 | `disusate` | adj | 0 | femminile plurale di disusato | `disusato` | 272623 /forms/2/form |
| 281079 | `compartecipi` | noun | 0 | plurale di compartecipe | `compartecipe` | 546675 /forms/0/form |
| 281292 | `connaturata` | adj | 0 | femminile di connaturato | `connaturato` | 281289 /forms/1/form |
| 283896 | `incurvata` | adj | 0 | femminile di incurvato | `incurvato` | 283891 /forms/1/form |
| 284925 | `invasi` | adj | 0 | plurale di invaso | `invaso` | 284923 /forms/0/form |
| 285844 | `triti` | adj | 0 | plurale di trito | `trito` | 285841 /forms/0/form |
| 288952 | `stipati` | adj | 0 | plurale di stipato | `stipato` | 288948 /forms/0/form |
| 289796 | `vagabondi` | noun | 0 | plurale di vagabondo | `vagabondo` | 107603 /forms/0/form |
| 295018 | `sciala` | verb | 0 | terza persona singolare dell'indicativo presente di scialare | `scialare` | 403404 /forms/6/form |
| 298200 | `introiti` | noun | 0 | plurale di introito | `introito` | 50722 /forms/0/form |
| 332498 | `assennati` | adj | 0 | plurale di assennato | `assennato` | 116317 /forms/0/form |
| 333032 | `cenni` | noun | 0 | plurale di cenno | `cenno` | 140559 /forms/0/form |
| 346324 | `palpeggi` | noun | 0 | plurale di palpeggio | `palpeggio` | 346322 /forms/0/form |
| 347526 | `svantaggi` | noun | 0 | plurale di svantaggio | `svantaggio` | 54528 /forms/0/form |
| 350612 | `sconcia` | adj | 0 | femminile di sconcio | `sconcio` | 350607 /forms/1/form |
| 351949 | `odi` | verb | 5 | seconda persona singolare dell'indicativo presente di udire | `udire` | 899 /forms/6/form |
| 351949 | `odi` | verb | 6 | seconda persona singolare dell'imperativo presente di udire | `udire` | 899 /forms/6/form |
| 352421 | `coniati` | adj | 0 | plurale di coniato | `coniato` | 352419 /forms/0/form |
| 352979 | `consigliata` | adj | 0 | femminile di consigliato | `consigliato` | 352976 /forms/1/form |
| 355382 | `estasiati` | adj | 0 | plurale di estasiato | `estasiato` | 355380 /forms/0/form |
| 358844 | `attorniata` | adj | 0 | femminile di attorniato | `attorniato` | 358842 /forms/1/form |
| 362148 | `smaliziati` | adj | 0 | plurale di smaliziato | `smaliziato` | 116682 /forms/0/form |
| 362397 | `soverchi` | adj | 0 | plurale di soverchio | `soverchio` | 111547 /forms/0/form |
| 363503 | `propizia` | adj | 0 | femminile di propizio | `propizio` | 363499 /forms/1/form |
| 369467 | `serva` | verb | 3 | seconda persona singolare dell'imperativo di servire | `servire` | 49989 /forms/65/form |
| 371626 | `definite` | adj | 0 | femminile plurale di definito | `definito` | 371619 /forms/2/form |
| 372315 | `feriti` | noun | 0 | plurale di ferita | `ferita` | 49746 /forms/1/form |
| 373661 | `spedita` | adj | 0 | femminile singolare di spedito | `spedito` | 55214 /forms/1/form |
| 374669 | `sostituite` | adj | 0 | femminile plurale di sostituito | `sostituito` | 54182 /forms/2/form |
| 374749 | `smarriti` | adj | 0 | plurale di smarrito | `smarrito` | 55077 /forms/0/form |
| 378310 | `arditi` | adj | 0 | plurale di ardito | `ardito` | 126079 /forms/0/form |
| 378318 | `ardite` | adj | 0 | femminile plurale di ardito | `ardito` | 126079 /forms/2/form |
| 396238 | `frolla` | adj | 0 | femminile di frollo | `frollo` | 396235 /forms/1/form |
| 396579 | `sfiatate` | noun | 0 | plurale di sfiatata | `sfiatata` | 396570 /forms/0/form |
| 398621 | `stramazzi` | noun | 0 | plurale di stramazzo | `stramazzo` | 398618 /forms/0/form |
| 400263 | `sbagliate` | adj | 0 | femminile plurale di sbagliato | `sbagliato` | 39556 /forms/2/form |
| 400919 | `indotte` | adj | 0 | femminile plurale di indotto | `indotto` | 400914 /forms/2/form |
| 404984 | `angiosperme` | adj | 0 | femminile di angiospermo | `angiospermo` | 473611 /forms/2/form |
| 405544 | `alfabloccanti` | noun | 0 | plurale di alfabloccante | `alfabloccante` | 405535 /forms/0/form |
| 405855 | `ecclesiastica` | noun | 0 | femminile di ecclesiastico | `ecclesiastico` | 405856 /forms/1/form |
| 406427 | `impegnati` | adj | 0 | plurale di impegnato | `impegnato` | 53407 /forms/0/form |
| 406429 | `impegnata` | adj | 0 | femminile di impegnato | `impegnato` | 53407 /forms/1/form |
| 407500 | `raccolte` | noun | 0 | plurale di raccolta | `raccolta` | 52728 /forms/2/form |
| 410634 | `scomposti` | adj | 0 | plurale di scomposto | `scomposto` | 126616 /forms/0/form |
| 410679 | `sottoposti` | adj | 0 | femminile plurale di sottoposto | `sottoposto` | 55178 /forms/0/form |
| 412930 | `veterinari` | noun | 0 | plurale di veterinario | `veterinario` | 55527 /forms/0/form |
| 413664 | `amminozuccheri` | noun | 0 | plurale di amminozucchero | `amminozucchero` | 413594 /forms/0/form |
| 414219 | `arancioni` | adj | 0 | plurale di arancione | `arancione` | 80 /forms/0/form |
| 414691 | `protratta` | adj | 0 | femminile di protratto | `protratto` | 414689 /forms/1/form |
| 415251 | `detenuta` | adj | 0 | femminile di detenuto | `detenuto` | 46164 /forms/1/form |
| 415252 | `detenuta` | noun | 0 | femminile di detenuto | `detenuto` | 46164 /forms/1/form |
| 416668 | `esploso` | verb | 0 | participio passato di esplodere | `esplodere` | 48418 /forms/3/form |
| 417559 | `dossi` | noun | 0 | plurale di dosso | `dosso` | 417558 /forms/0/form |
| 418086 | `mietitrice` | noun | 0 | femminile di mietitore | `mietitore` | 589768 /forms/1/form |
| 418415 | `nubi` | noun | 0 | plurale di nube | `nube` | 43866 /forms/0/form |
| 419219 | `coltroni` | noun | 0 | plurale di coltrone | `coltrone` | 419218 /forms/0/form |
| 419220 | `trapunte` | noun | 0 | plurale di trapunta | `trapunta` | 127735 /forms/0/form |
| 419319 | `visti` | adj | 0 | plurale di visto | `visto` | 55613 /forms/0/form |
| 419320 | `visti` | noun | 0 | plurale di visto | `visto` | 55613 /forms/0/form |
| 419321 | `visti` | verb | 3 | seconda persona singolare del congiuntivo presente di vistare | `vistare` | 581941 /forms/5/form |
| 419321 | `visti` | verb | 5 | terza persona singolare dell'imperativo presente di vistare | `vistare` | 581941 /forms/5/form |
| 419384 | `mormorii` | noun | 0 | plurale di mormorio | `mormorio` | 138599 /forms/0/form |
| 419518 | `pizzoccheri` | noun | 0 | plurale di pizzocchero | `pizzocchero` | 419517 /forms/0/form |
| 419902 | `combinatoria` | adj | 0 | femminile di combinatorio | `combinatorio` | 419904 /forms/1/form |
| 419967 | `motociclisti` | noun | 0 | plurale di motociclista | `motociclista` | 38033 /forms/0/form |
| 420445 | `socchiuso` | verb | 0 | participio passato di socchiudere | `socchiudere` | 627699 /forms/3/form |
| 420446 | `senziente` | verb | 0 | participio presente di sentire | `sentire` | 1473 /forms/3/form |
| 421214 | `forzature` | noun | 0 | plurale di forzatura | `forzatura` | 460959 /forms/0/form |
| 422394 | `pollini` | noun | 0 | plurale di polline | `polline` | 422395 /forms/0/form |
| 422419 | `attinenze` | noun | 0 | plurale di attinenza | `attinenza` | 422418 /forms/0/form |
| 422426 | `ripicche` | noun | 0 | plurale di ripicca | `ripicca` | 61995 /forms/0/form |
| 422436 | `parlamentari` | noun | 0 | plurale di parlamentare | `parlamentare` | 136367 /forms/0/form |
| 422899 | `bradicardie` | noun | 0 | plurale di bradicardia | `bradicardia` | 86380 /forms/0/form |
| 422990 | `solitudini` | noun | 0 | plurale di solitudine | `solitudine` | 54142 /forms/0/form |
| 423222 | `intese` | adj | 0 | femminile plurale di inteso | `inteso` | 53748 /forms/2/form |
| 423300 | `ragionamenti` | noun | 0 | plurale di ragionamento | `ragionamento` | 52757 /forms/0/form |
| 423353 | `ominidi` | noun | 0 | plurale di ominide | `ominide` | 135721 /forms/0/form |
| 423726 | `gladiatrice` | noun | 0 | femminile di gladiatore | `gladiatore` | 415933 /forms/1/form |
| 423879 | `assistiti` | noun | 0 | plurale di assistito | `assistito` | 138392 /forms/0/form |
| 423880 | `assistiti` | noun | 0 | plurale di assistito | `assistito` | 138392 /forms/0/form |
| 424198 | `persistenti` | verb | 0 | participio presente plurale di persistente | `persistente` | 8497 /forms/0/form |
| 425090 | `apologisti` | noun | 0 | plurale di apologista | `apologista` | 425089 /forms/0/form |
| 425091 | `apologiste` | noun | 0 | plurale di apologista | `apologista` | 425089 /forms/1/form |
| 425139 | `fanciulle` | noun | 0 | plurale di fanciulla | `fanciulla` | 422737 /forms/0/form |
| 427564 | `scuri` | noun | 0 | plurale di scuro | `scuro` | 53974 /forms/0/form |
| 429547 | `mutamenti` | noun | 0 | plurale di mutamento | `mutamento` | 51901 /forms/0/form |
| 429556 | `vendite` | noun | 0 | plurale di vendita | `vendita` | 55472 /forms/0/form |
| 431077 | `puliture` | noun | 0 | plurale di pulitura | `pulitura` | 425067 /forms/0/form |
| 431125 | `invase` | adj | 0 | femminile plurale di invaso | `invaso` | 284924 /forms/2/form |
| 432027 | `fraintese` | verb | 1 | participio passato plurale femminile di fraintendere | `fraintendere` | 426120 /forms/18/form |
| 432148 | `pretese` | noun | 0 | plurale di pretesa | `pretesa` | 432144 /forms/2/form |
| 432991 | `dipendenti` | adj | 0 | femminile di dipendente | `dipendente` | 8660 /forms/0/form |
| 433810 | `anatemi` | noun | 0 | plurale di anatema | `anatema` | 81727 /forms/0/form |
| 434213 | `vissuta` | adj | 0 | femminile di vissuto | `vissuto` | 55803 /forms/1/form |
| 435320 | `percorsi` | adj | 0 | plurale di percorso | `percorso` | 24253 /forms/0/form |
| 435412 | `ricorrenti` | noun | 0 | plurale di ricorrente | `ricorrente` | 435408 /forms/0/form |
| 441222 | `ettolitri` | noun | 0 | plurale di ettolitro | `ettolitro` | 409050 /forms/0/form |
| 442025 | `dotti` | noun | 0 | plurale di dotto | `dotto` | 33960 /forms/0/form |
| 442032 | `studiosa` | noun | 0 | femminile di studioso | `studioso` | 54442 /forms/1/form |
| 442034 | `studiosi` | noun | 0 | plurale di studioso | `studioso` | 54442 /forms/0/form |
| 442036 | `studiose` | noun | 0 | femminile plurale di studioso | `studioso` | 54442 /forms/2/form |
| 442121 | `gioiosi` | adj | 0 | plurale di gioioso | `gioioso` | 243938 /forms/0/form |
| 442122 | `gioiosa` | adj | 0 | femminile di gioioso | `gioioso` | 243938 /forms/1/form |
| 442123 | `gioiose` | adj | 0 | plurale di gioioso | `gioioso` | 243938 /forms/2/form |
| 442241 | `interessamenti` | noun | 0 | plurale di interessamento | `interessamento` | 50642 /forms/0/form |
| 444509 | `sorrette` | adj | 0 | femminile plurale di sorretto | `sorretto` | 444506 /forms/2/form |
| 446357 | `disfatte` | noun | 0 | plurale di disfatta | `disfatta` | 49393 /forms/2/form |
| 446969 | `sinestesie` | noun | 0 | plurale di sinestesia | `sinestesia` | 34110 /forms/0/form |
| 446999 | `iodoformi` | noun | 0 | plurale di iodoformio | `iodoformio` | 38178 /forms/0/form |
| 447061 | `fauni` | noun | 0 | plurale di fauno | `fauno` | 134582 /forms/0/form |
| 447065 | `assiomi` | noun | 0 | plurale di assioma | `assioma` | 46295 /forms/0/form |
| 447342 | `genetiche` | adj | 0 | femminile plurale di genetico | `genetico` | 139411 /forms/2/form |
| 447352 | `eugenetiche` | noun | 0 | femminile di eugenetica | `eugenetica` | 139739 /forms/2/form |
| 447543 | `scheletrica` | adj | 0 | femminile di scheletrico | `scheletrico` | 418615 /forms/1/form |
| 447544 | `scheletrici` | adj | 0 | plurale di scheletrico | `scheletrico` | 418615 /forms/0/form |
| 447650 | `agostiniani` | noun | 0 | plurale di agostiniano | `agostiniano` | 447643 /forms/0/form |
| 447726 | `anatomisti` | noun | 0 | plurale di anatomista | `anatomista` | 306369 /forms/0/form |
| 447727 | `anatomiste` | noun | 0 | femminile plurale di anatomista | `anatomista` | 306369 /forms/1/form |
| 447757 | `retriva` | adj | 0 | femminile di retrivo | `retrivo` | 447376 /forms/1/form |
| 447758 | `retrivi` | adj | 0 | plurale di retrivo | `retrivo` | 447376 /forms/0/form |
| 447797 | `contrafforti` | noun | 0 | plurale di contrafforte | `contrafforte` | 136298 /forms/0/form |
| 448422 | `darviniana` | noun | 0 | femminile di darviniano | `darviniano` | 448415 /forms/1/form |
| 448428 | `darwinisti` | noun | 0 | plurale di darwinista | `darwinista` | 448423 /forms/0/form |
| 448430 | `darwiniste` | noun | 0 | plurale di darwinista | `darwinista` | 448423 /forms/1/form |
| 448443 | `redivivi` | noun | 0 | plurale di redivivo | `redivivo` | 134676 /forms/0/form |
| 448566 | `cartucce` | noun | 0 | plurale di cartuccia | `cartuccia` | 48196 /forms/0/form |
| 448599 | `pieghevoli` | noun | 0 | plurale di pieghevole | `pieghevole` | 139342 /forms/0/form |
| 449134 | `antropofagie` | noun | 0 | plurale di antropofagia | `antropofagia` | 447827 /forms/0/form |
| 449340 | `crotonesi` | noun | 0 | plurale di crotonese | `crotonese` | 449337 /forms/0/form |
| 449508 | `costruttori` | noun | 0 | plurale di costruttore | `costruttore` | 449501 /forms/0/form |
| 449660 | `ambientalisti` | noun | 0 | plurale di ambientalista | `ambientalista` | 47434 /forms/0/form |
| 449662 | `ambientaliste` | noun | 0 | plurale di ambientalista | `ambientalista` | 47434 /forms/1/form |
| 449680 | `leghisti` | noun | 0 | plurale di leghista | `leghista` | 122969 /forms/0/form |
| 449682 | `leghiste` | noun | 0 | plurale di leghista | `leghista` | 122969 /forms/1/form |
| 449703 | `mongole` | noun | 0 | plurale di mongola | `mongola` | 449700 /forms/2/form |
| 449770 | `scriteriata` | noun | 0 | femminile di scriteriato | `scriteriato` | 423435 /forms/1/form |
| 449772 | `scriteriati` | noun | 0 | plurale di scriteriato | `scriteriato` | 423435 /forms/0/form |
| 449774 | `scriteriate` | noun | 0 | plurale di scriteriata | `scriteriata` | 449769 /forms/2/form |
| 449820 | `neorealiste` | adj | 0 | femminile plurale di neorealista | `neorealista` | 421787 /forms/1/form |
| 449821 | `neorealiste` | noun | 0 | femminile plurale di neorealista | `neorealista` | 421787 /forms/1/form |
| 449878 | `botanici` | noun | 0 | plurale di botanico | `botanico` | 139345 /forms/0/form |
| 449880 | `botaniche` | noun | 0 | femminile plurale di botanico | `botanico` | 139345 /forms/2/form |
| 449890 | `contestatori` | noun | 0 | plurale di contestatore | `contestatore` | 418108 /forms/0/form |
| 449892 | `contestatrice` | noun | 0 | femminile di contestatore | `contestatore` | 418108 /forms/1/form |
| 449894 | `contestatrici` | noun | 0 | plurale di contestatrice | `contestatrice` | 449891 /forms/2/form |
| 449979 | `affascinatori` | noun | 0 | plurale di affascinatore | `affascinatore` | 449976 /forms/0/form |
| 449981 | `affascinatrice` | noun | 0 | femminile di affascinatore | `affascinatore` | 449976 /forms/1/form |
| 449983 | `affascinatrici` | noun | 0 | plurale di affascinatrice | `affascinatrice` | 449980 /forms/2/form |
| 450161 | `masticatori` | noun | 0 | plurale di masticatore | `masticatore` | 447583 /forms/0/form |
| 450163 | `masticatrice` | noun | 0 | femminile di masticatore | `masticatore` | 447583 /forms/1/form |
| 450165 | `masticatrici` | noun | 0 | plurale di masticatrice | `masticatrice` | 450162 /forms/2/form |
| 450209 | `progressiste` | noun | 0 | plurale di progressista | `progressista` | 245263 /forms/1/form |
| 450323 | `precambriani` | noun | 0 | plurale di precambriano | `precambriano` | 448981 /forms/0/form |
| 450327 | `archeozoici` | noun | 0 | plurale di archeozoico | `archeozoico` | 449295 /forms/0/form |
| 450412 | `terminali` | noun | 0 | plurale di terminale | `terminale` | 413933 /forms/0/form |
| 450531 | `panamensi` | noun | 0 | plurale di panamense | `panamense` | 447007 /forms/0/form |
| 450535 | `siberiane` | noun | 0 | plurale di siberiana | `siberiana` | 450536 /forms/2/form |
| 450537 | `siberiana` | noun | 0 | femminile di siberiano | `siberiano` | 54058 /forms/1/form |
| 450539 | `siberiani` | noun | 0 | plurale di siberiano | `siberiano` | 54058 /forms/0/form |
| 450546 | `cilena` | adj | 0 | femminile di cileno | `cileno` | 419110 /forms/1/form |
| 450547 | `cilena` | noun | 0 | femminile di cileno | `cileno` | 419110 /forms/1/form |
| 450561 | `teoretiche` | noun | 0 | plurale di teoretica | `teoretica` | 450557 /forms/2/form |
| 450760 | `penitenziari` | noun | 0 | plurale di penitenziario | `penitenziario` | 87155 /forms/0/form |
| 450776 | `protettori` | noun | 0 | plurale di protettore | `protettore` | 38425 /forms/0/form |
| 450778 | `protettrice` | noun | 0 | femminile di protettore | `protettore` | 38425 /forms/1/form |
| 450942 | `bloggisti` | noun | 0 | plurale di bloggista | `bloggista` | 450940 /forms/0/form |
| 450943 | `bloggiste` | noun | 0 | plurale di bloggista | `bloggista` | 450940 /forms/1/form |
| 450953 | `turistica` | adj | 0 | femminile di turistico | `turistico` | 55590 /forms/1/form |
| 451007 | `tribune` | noun | 0 | plurale di tribuna | `tribuna` | 104953 /forms/2/form |
| 451041 | `collettivisti` | noun | 0 | plurale di collettivista | `collettivista` | 432845 /forms/0/form |
| 451043 | `collettiviste` | noun | 0 | plurale di collettivista | `collettivista` | 432845 /forms/1/form |
| 451502 | `inaridimenti` | noun | 0 | plurale di inaridimento | `inaridimento` | 451496 /forms/0/form |
| 451522 | `rachitica` | noun | 0 | femminile di rachitico | `rachitico` | 422541 /forms/1/form |
| 451524 | `rachitiche` | noun | 0 | plurale di rachitica | `rachitica` | 451521 /forms/2/form |
| 451526 | `rachitici` | noun | 0 | plurale di rachitico | `rachitico` | 422541 /forms/0/form |
| 451616 | `interconnessioni` | noun | 0 | plurale di interconnessione | `interconnessione` | 418395 /forms/0/form |
| 451624 | `pigmei` | noun | 0 | plurale di pigmeo | `pigmeo` | 451621 /forms/0/form |
| 451628 | `pigmea` | noun | 0 | femminile di pigmeo | `pigmeo` | 451621 /forms/1/form |
| 452175 | `omofobi` | noun | 0 | plurale di omofobo | `omofobo` | 452172 /forms/0/form |
| 452177 | `omofobe` | noun | 0 | plurale di omofoba | `omofoba` | 452178 /forms/2/form |
| 452179 | `omofoba` | noun | 0 | femminile di omofobo | `omofobo` | 452172 /forms/1/form |
| 452181 | `pinete` | noun | 0 | plurale di pineta | `pineta` | 419093 /forms/0/form |
| 452321 | `scissionisti` | noun | 0 | plurale di scissionista | `scissionista` | 452317 /forms/0/form |
| 452323 | `scissioniste` | noun | 0 | plurale di scissionista | `scissionista` | 452317 /forms/1/form |
| 452541 | `regressioni` | noun | 0 | plurale di regressione | `regressione` | 452540 /forms/0/form |
| 453214 | `graduali` | noun | 0 | plurale di graduale | `graduale` | 116650 /forms/0/form |
| 453381 | `atea` | noun | 0 | femminile di ateo | `ateo` | 33351 /forms/1/form |
| 453412 | `eclittiche` | noun | 0 | plurale di eclittica | `eclittica` | 133218 /forms/2/form |
| 453456 | `capitalisti` | noun | 0 | plurale di capitalista | `capitalista` | 417552 /forms/0/form |
| 453460 | `capitaliste` | noun | 0 | plurale di capitalista | `capitalista` | 417552 /forms/1/form |
| 454086 | `populisti` | noun | 0 | plurale di populista | `populista` | 138872 /forms/1/form |
| 454088 | `populiste` | noun | 0 | plurale di populista | `populista` | 138872 /forms/0/form |
| 454449 | `precettori` | noun | 0 | plurale di precettore | `precettore` | 131870 /forms/0/form |
| 454743 | `fidi` | noun | 0 | plurale di fido | `fido` | 136376 /forms/0/form |
| 454746 | `fida` | verb | 1 | seconda persona singolare dell'imperativo presente di fidare | `fidare` | 237660 /forms/7/form |
| 454937 | `posteri` | noun | 0 | plurale di postero | `postero` | 448276 /forms/0/form |
| 454939 | `postera` | noun | 0 | femminile di postero | `postero` | 448276 /forms/1/form |
| 454941 | `postere` | noun | 0 | plurale di postera | `postera` | 454938 /forms/2/form |
| 454946 | `arcieri` | noun | 0 | plurale di arciere | `arciere` | 454944 /forms/0/form |
| 455130 | `britannici` | noun | 0 | plurale di britannico | `britannico` | 135601 /forms/0/form |
| 455135 | `endocardi` | noun | 0 | plurale di endocardio | `endocardio` | 62371 /forms/0/form |
| 455163 | `ripetitori` | noun | 0 | plurale di ripetitore | `ripetitore` | 416356 /forms/0/form |
| 455180 | `formatrici` | noun | 0 | plurale di formatrice | `formatrice` | 455176 /forms/2/form |
| 455183 | `formatori` | noun | 0 | plurale di formatore | `formatore` | 107295 /forms/0/form |
| 455876 | `manicomi` | noun | 0 | plurale di manicomio | `manicomio` | 194911 /forms/0/form |
| 455882 | `selvaggi` | noun | 0 | plurale di selvaggio | `selvaggio` | 107606 /forms/0/form |
| 455884 | `selvagge` | noun | 0 | plurale di selvaggia | `selvaggia` | 455885 /forms/2/form |
| 456098 | `radioripetitori` | noun | 0 | plurale di radioripetitore | `radioripetitore` | 405778 /forms/0/form |
| 457416 | `angolari` | adj | 0 | plurale di angolare | `angolare` | 412899 /forms/0/form |
| 457542 | `soprammobili` | noun | 0 | plurale di soprammobile | `soprammobile` | 409084 /forms/0/form |
| 457602 | `missilistiche` | noun | 0 | plurale di missilistica | `missilistica` | 457598 /forms/2/form |
| 457628 | `Rotiferi` | noun | 0 | plurale di rotifero | `rotifero` | 457627 /forms/0/form |
| 457690 | `universi` | noun | 0 | plurale di universo | `universo` | 14787 /forms/0/form |
| 457733 | `microstrisce` | noun | 0 | plurale di microstriscia | `microstriscia` | 414186 /forms/0/form |
| 458098 | `realisti` | adj | 0 | plurale di realista | `realista` | 420508 /forms/0/form |
| 458099 | `realisti` | noun | 0 | plurale di realista | `realista` | 420508 /forms/0/form |
| 458737 | `gastronomi` | noun | 0 | plurale di gastronomo | `gastronomo` | 404952 /forms/0/form |
| 458738 | `gastronome` | noun | 0 | plurale di gastronoma | `gastronoma` | 458736 /forms/2/form |
| 459140 | `urbanistiche` | noun | 0 | plurale di urbanistica | `urbanistica` | 135860 /forms/2/form |
| 459349 | `antibiotici` | noun | 0 | plurale di antibiotico | `antibiotico` | 129135 /forms/0/form |
| 459971 | `prevaricatrice` | noun | 0 | femminile di prevaricatore | `prevaricatore` | 459966 /forms/1/form |
| 460461 | `pensatoi` | noun | 0 | plurale di pensatoio | `pensatoio` | 460460 /forms/0/form |
| 460637 | `superpoteri` | noun | 0 | plurale di superpotere | `superpotere` | 465594 /forms/0/form |
| 461267 | `sepolto` | verb | 0 | participio passato di seppellire | `seppellire` | 49988 /forms/5/form |
| 462355 | `sferoidi` | noun | 0 | plurale di sferoide | `sferoide` | 592671 /forms/0/form |
| 462388 | `arie` | noun | 0 | plurale di aria | `aria` | 46035 /forms/0/form |
| 462606 | `guantoni` | noun | 0 | plurale di guantone | `guantone` | 460937 /forms/0/form |
| 462926 | `bufaghe` | noun | 0 | plurale di bufaga | `bufaga` | 462925 /forms/0/form |
| 463049 | `lattaia` | noun | 0 | femminile di lattaio | `lattaio` | 405609 /forms/1/form |
| 463176 | `bastoncelli` | noun | 0 | plurale di bastoncello | `bastoncello` | 463172 /forms/0/form |
| 463321 | `traci` | noun | 0 | plurale di trace | `trace` | 463317 /forms/0/form |
| 463329 | `massicce` | adj | 0 | femminile plurale di massiccio | `massiccio` | 33372 /forms/2/form |
| 463471 | `longitudini` | noun | 0 | plurale di longitudine | `longitudine` | 115080 /forms/0/form |
| 463516 | `concitamenti` | noun | 0 | plurale di concitamento | `concitamento` | 463515 /forms/0/form |
| 463531 | `prosillogismi` | noun | 0 | plurale di prosillogismo | `prosillogismo` | 463530 /forms/0/form |
| 463577 | `eurocrati` | noun | 0 | plurale di eurocrate | `eurocrate` | 463576 /forms/0/form |
| 463586 | `boccioli` | noun | 0 | plurale di bocciolo | `bocciolo` | 417899 /forms/0/form |
| 463591 | `triumviri` | noun | 0 | plurale di triumviro | `triumviro` | 463590 /forms/0/form |
| 463751 | `vedremo` | verb | 0 | prima persona plurale dell'indicativo futuro semplice di vedere | `vedere` | 33206 /forms/26/form |
| 463799 | `microbiologa` | noun | 0 | femminile di microbiologo | `microbiologo` | 450678 /forms/1/form |
| 463886 | `catapecchie` | noun | 0 | plurale di catapecchia | `catapecchia` | 403947 /forms/0/form |
| 463968 | `assisa` | adj | 0 | femminile di assiso | `assiso` | 463971 /forms/1/form |
| 464042 | `prosapie` | noun | 0 | plurale di prosapia | `prosapia` | 110274 /forms/0/form |
| 464513 | `gluoni` | noun | 0 | plurale di gluone | `gluone` | 422770 /forms/0/form |
| 464514 | `muoni` | noun | 0 | plurale di muone | `muone` | 417381 /forms/0/form |
| 464708 | `metropolitani` | noun | 0 | plurale di metropolitano | `metropolitano` | 234862 /forms/0/form |
| 464836 | `monorotaie` | noun | 0 | plurale di monorotaia | `monorotaia` | 449686 /forms/0/form |
| 465008 | `capite` | verb | 2 | seconda persona plurale dell'imperativo presente di capire | `capire` | 39333 /forms/9/form |
| 465599 | `discepola` | noun | 0 | femminile di discepolo | `discepolo` | 15549 /forms/1/form |
| 465611 | `simulatrice` | noun | 0 | femminile di simulatore | `simulatore` | 422524 /forms/1/form |
| 465685 | `biofarmaci` | noun | 0 | plurale di biofarmaco | `biofarmaco` | 409559 /forms/0/form |
| 465706 | `barbara` | noun | 0 | femminile di barbaro | `barbaro` | 136594 /forms/1/form |
| 465884 | `dogmatica` | adj | 0 | femminile di dogmatico | `dogmatico` | 423034 /forms/1/form |
| 466129 | `Crocodili` | noun | 0 | plurale di crocodilio | `crocodilio` | 466128 /forms/0/form |
| 466141 | `Crotalidi` | noun | 0 | plurale di crotalide | `crotalide` | 466140 /forms/0/form |
| 466151 | `Alligatoridi` | noun | 0 | plurale di alligatoride | `alligatoride` | 466150 /forms/0/form |
| 466154 | `Didelfidi` | noun | 0 | plurale di didelfide | `didelfide` | 466153 /forms/0/form |
| 466157 | `Macropodidi` | noun | 0 | plurale di macropodide | `macropodide` | 51408 /forms/0/form |
| 466160 | `Falangeridi` | noun | 0 | plurale di falangeride | `falangeride` | 466159 /forms/0/form |
| 466178 | `Struzioniformi` | noun | 0 | plurale di struzioniforme | `struzioniforme` | 466176 /forms/0/form |
| 466234 | `Gasteropodi` | noun | 0 | plurale di gasteropode | `gasteropode` | 466233 /forms/0/form |
| 466239 | `Lacertidi` | noun | 0 | plurale di lacertide | `lacertide` | 466240 /forms/0/form |
| 494768 | `orate` | noun | 0 | plurale di orata | `orata` | 52092 /forms/0/form |
| 497906 | `legioni` | noun | 0 | plurale di legione | `legione` | 497909 /forms/0/form |
| 504208 | `celebratori` | noun | 0 | plurale di celebratore | `celebratore` | 504211 /forms/0/form |
| 527971 | `dalmatica` | adj | 0 | femminile di dalmatico | `dalmatico` | 461701 /forms/1/form |
| 527972 | `dalmatica` | noun | 0 | femminile di dalmatico | `dalmatico` | 461701 /forms/1/form |
| 528242 | `saprei` | verb | 0 | prima persona singolare del condizionale presente di sapere | `sapere` | 38301 /forms/53/form |
| 534049 | `concesse` | adj | 0 | femminile plurale di concesso | `concesso` | 465741 /forms/2/form |
| 534590 | `rogatori` | noun | 0 | plurale di rogatore | `rogatore` | 534593 /forms/0/form |
| 535698 | `rimpatriata` | adj | 0 | femminile di rimpatriato | `rimpatriato` | 544279 /forms/1/form |
| 537829 | `Amnioti` | noun | 0 | plurale di amniote | `amniote` | 570065 /forms/0/form |
| 537830 | `amnioti` | noun | 0 | plurale di amniote | `amniote` | 570064 /forms/0/form |
| 538028 | `capisce` | verb | 0 | terza persona singolare dell'indicativo presente di capire | `capire` | 39333 /forms/7/form |
| 538251 | `vostre` | adj | 0 | femminile plurale di vostro | `vostro` | 135628 /forms/2/form |
| 538252 | `vostre` | pron | 0 | femminile plurale di vostro | `vostro` | 135628 /forms/2/form |
| 538552 | `vostra` | adj | 0 | femminile singolare di vostro | `vostro` | 135628 /forms/1/form |
| 538553 | `vostra` | pron | 0 | femminile singolare di vostro | `vostro` | 135628 /forms/1/form |
| 538558 | `vostri` | adj | 0 | maschile plurale di vostro | `vostro` | 135628 /forms/0/form |
| 538559 | `vostri` | pron | 0 | maschile plurale di vostro | `vostro` | 135628 /forms/0/form |
| 539099 | `servali` | noun | 0 | plurale di servalo | `servalo` | 466594 /forms/0/form |
| 540780 | `amebe` | noun | 0 | plurale di ameba | `ameba` | 405135 /forms/0/form |
| 540864 | `privative` | noun | 0 | plurale di privativa | `privativa` | 420346 /forms/0/form |
| 541042 | `burocratismi` | noun | 0 | plurale di burocratismo | `burocratismo` | 406194 /forms/0/form |
| 541133 | `acciughine` | noun | 0 | plurale di acciughina | `acciughina` | 115949 /forms/0/form |
| 541143 | `formicaleoni` | noun | 0 | plurale di formicaleone | `formicaleone` | 541072 /forms/0/form |
| 541146 | `macaoni` | noun | 0 | plurale di macaone | `macaone` | 51323 /forms/0/form |
| 541171 | `anofeli` | noun | 0 | plurale di anofele | `anofele` | 541168 /forms/0/form |
| 541192 | `forfecchie` | noun | 0 | plurale di forfecchia | `forfecchia` | 541191 /forms/0/form |
| 541208 | `mugnaiacci` | noun | 0 | plurale di mugnaiaccio | `mugnaiaccio` | 541207 /forms/0/form |
| 541594 | `fonopatie` | noun | 0 | plurale di fonopatia | `fonopatia` | 461432 /forms/0/form |
| 543341 | `gassometrie` | noun | 0 | plurale di gassometria | `gassometria` | 540848 /forms/0/form |
| 543438 | `riesci` | verb | 0 | seconda persona singolare dell'indicativo presente di riuscire | `riuscire` | 49424 /forms/5/form |
| 544549 | `salsicce` | noun | 0 | plurale di salsiccia | `salsiccia` | 41150 /forms/0/form |
| 544656 | `labronici` | adj | 0 | plurale di labronico | `labronico` | 544655 /forms/0/form |
| 545062 | `bariatrici` | adj | 0 | plurale di bariatrico | `bariatrico` | 449145 /forms/0/form |
| 545063 | `bariatriche` | adj | 0 | femminile plurale di bariatrico | `bariatrico` | 449145 /forms/2/form |
| 545064 | `bariatrica` | adj | 0 | femminile di bariatrico | `bariatrico` | 449145 /forms/1/form |
| 545081 | `quadrupedi` | adj | 0 | plurale di quadrupede | `quadrupede` | 137563 /forms/0/form |
| 545082 | `quadrupedi` | noun | 0 | plurale di quadrupede | `quadrupede` | 137563 /forms/0/form |
| 545105 | `eporediesi` | noun | 0 | plurale di eporediese | `eporediese` | 545104 /forms/0/form |
| 545152 | `ingannatori` | noun | 0 | plurale di ingannatore | `ingannatore` | 461854 /forms/0/form |
| 545154 | `ingannatrice` | noun | 0 | femminile di ingannatore | `ingannatore` | 461854 /forms/1/form |
| 545156 | `ingannatrici` | noun | 0 | plurale di ingannatore | `ingannatore` | 461854 /forms/2/form |
| 545171 | `tirsi` | noun | 0 | plurale di tirso | `tirso` | 55094 /forms/0/form |
| 545172 | `tirinzia` | adj | 0 | femminile di tirinzio | `tirinzio` | 494981 /forms/1/form |
| 545173 | `tirinzi` | adj | 0 | femminile di tirinzio | `tirinzio` | 494981 /forms/0/form |
| 545174 | `tirinzie` | adj | 0 | plurale di tirinzio | `tirinzio` | 494981 /forms/2/form |
| 545184 | `morigerate` | adj | 0 | femminile plurale di morigerato | `morigerato` | 46681 /forms/2/form |
| 545198 | `autoguide` | noun | 0 | plurale di autoguida | `autoguida` | 545197 /forms/0/form |
| 545235 | `romanziera` | noun | 0 | femminile di romanziere | `romanziere` | 409547 /forms/1/form |
| 545279 | `bottegai` | noun | 0 | plurale di bottegaio | `bottegaio` | 459481 /forms/0/form |
| 545281 | `bottegaie` | noun | 0 | plurale femminile di bottegaio | `bottegaio` | 459481 /forms/2/form |
| 545297 | `denigratoria` | adj | 0 | femminile di denigratorio | `denigratorio` | 99015 /forms/1/form |
| 546166 | `riottenuto` | verb | 0 | participio passato di riottenere | `riottenere` | 546218 /forms/3/form |
| 546829 | `naiadi` | noun | 0 | plurale di naiade | `naiade` | 548723 /forms/0/form |
| 546832 | `prospettive` | noun | 0 | plurale di prospettiva | `prospettiva` | 403203 /forms/0/form |
| 547317 | `frenature` | noun | 0 | plurale di frenatura | `frenatura` | 447435 /forms/0/form |
| 547324 | `sepolti` | adj | 0 | plurale di sepolto | `sepolto` | 461265 /forms/0/form |
| 547325 | `sepolti` | noun | 0 | plurale di sepolto | `sepolto` | 461265 /forms/0/form |
| 547372 | `livree` | noun | 0 | plurale di livrea | `livrea` | 131278 /forms/0/form |
| 547378 | `pontificali` | adj | 0 | plurale di pontificale | `pontificale` | 547373 /forms/0/form |
| 547379 | `pontificali` | noun | 0 | plurale di pontificale | `pontificale` | 547373 /forms/0/form |
| 547390 | `soddisfatta` | adj | 0 | femminile di soddisfatto | `soddisfatto` | 24284 /forms/1/form |
| 547406 | `stami` | noun | 0 | plurale di stame | `stame` | 135322 /forms/0/form |
| 547543 | `facevano` | verb | 0 | terza persona plurale dell'indicativo imperfetto di fare | `fare` | 11077 /forms/17/form |
| 548531 | `scucita` | adj | 0 | femminile di scucito | `scucito` | 548529 /forms/1/form |
| 548533 | `scuciti` | adj | 0 | plurale di scucito | `scucito` | 548529 /forms/0/form |
| 548535 | `scucite` | adj | 0 | plurale di scucito | `scucito` | 548529 /forms/2/form |
| 548709 | `urbisagliesi` | adj | 0 | plurale di urbisagliese | `urbisagliese` | 548708 /forms/0/form |
| 548722 | `insidie` | noun | 0 | plurale di insidia | `insidia` | 50599 /forms/0/form |
| 548732 | `astrofisici` | adj | 0 | plurale di astrofisico | `astrofisico` | 404953 /forms/0/form |
| 548733 | `astrofisici` | noun | 0 | plurale di astrofisico | `astrofisico` | 404953 /forms/0/form |
| 548734 | `astrofisiche` | adj | 0 | plurale di astrofisico | `astrofisico` | 404953 /forms/2/form |
| 548761 | `stravaganti` | noun | 0 | plurale di stravagante | `stravagante` | 322883 /forms/0/form |
| 549098 | `risalgono` | verb | 0 | terza persona plurale dell'indicativo presente di risalire | `risalire` | 137054 /forms/9/form |
| 549226 | `accessi` | noun | 0 | plurale di accesso | `accesso` | 32783 /forms/0/form |
| 550014 | `pornografica` | adj | 0 | femminile singolare di pornografico | `pornografico` | 137565 /forms/1/form |
| 550016 | `scabrosa` | adj | 0 | femminile singolare di scabroso | `scabroso` | 133953 /forms/1/form |
| 550064 | `vocali` | adj | 0 | plurale di vocale | `vocale` | 30834 /forms/0/form |
| 551282 | `romanesca` | adj | 0 | femminile di romanesco | `romanesco` | 72255 /forms/1/form |
| 551365 | `raccoglitrice` | noun | 0 | femminile di raccoglitore | `raccoglitore` | 420726 /forms/1/form |
| 551370 | `sassate` | noun | 0 | plurale di sassata | `sassata` | 460528 /forms/0/form |
| 552872 | `crematistica` | adj | 0 | femminile singolare di crematistico | `crematistico` | 552874 /forms/1/form |
| 552927 | `naumachie` | noun | 0 | plurale di naumachia | `naumachia` | 528564 /forms/0/form |
| 552970 | `visitatrice` | noun | 0 | femminile di visitatore | `visitatore` | 55610 /forms/1/form |
| 560503 | `vana` | adj | 0 | femminile di vano | `vano` | 55434 /forms/1/form |
| 560504 | `vane` | adj | 0 | femminile plurale di vano | `vano` | 55434 /forms/2/form |
| 560509 | `pianistica` | adj | 0 | femminile di pianistico | `pianistico` | 560508 /forms/1/form |
| 560510 | `pianistici` | adj | 0 | plurale di pianistico | `pianistico` | 560508 /forms/0/form |
| 560511 | `pianistiche` | adj | 0 | femminile plurale di pianistico | `pianistico` | 560508 /forms/2/form |
| 561954 | `girovaghe` | noun | 0 | femminile plurale di girovago | `girovago` | 127101 /forms/2/form |
| 561960 | `piccine` | adj | 0 | plurale femminile di piccino | `piccino` | 422761 /forms/2/form |
| 561961 | `piccine` | noun | 0 | plurale femminile di piccino | `piccino` | 422761 /forms/2/form |
| 561965 | `censori` | noun | 0 | plurale di censore | `censore` | 464069 /forms/0/form |
| 564295 | `selvatica` | adj | 0 | femminile di selvatico | `selvatico` | 55038 /forms/1/form |
| 564296 | `selvatica` | noun | 0 | femminile di selvatico | `selvatico` | 55038 /forms/1/form |
| 565047 | `frigi` | adj | 0 | plurale di frigio | `frigio` | 72409 /forms/0/form |
| 565048 | `frigi` | noun | 0 | plurale di frigio | `frigio` | 72409 /forms/0/form |
| 566866 | `soddisfatte` | adj | 0 | femminile plurale di soddisfatto | `soddisfatto` | 24284 /forms/2/form |
| 568465 | `mentitori` | noun | 0 | plurale di mentitore | `mentitore` | 68096 /forms/0/form |
| 569852 | `confidenze` | noun | 0 | plurale di confidenza | `confidenza` | 404079 /forms/0/form |
| 569991 | `consentiti` | adj | 0 | plurale di consentito | `consentito` | 457547 /forms/0/form |
| 570042 | `pandemie` | noun | 0 | plurale di pandemia | `pandemia` | 30820 /forms/0/form |
| 571660 | `brecce` | noun | 0 | plurale di breccia | `breccia` | 492990 /forms/0/form |
| 571749 | `valdostane` | noun | 0 | plurale di valdostana | `valdostana` | 562001 /forms/2/form |
| 571887 | `fessa` | noun | 0 | femminile singolare di fesso | `fesso` | 49759 /forms/1/form |
| 571892 | `fessi` | noun | 0 | maschile plurale di fesso | `fesso` | 49759 /forms/0/form |
| 573802 | `tare` | noun | 0 | plurale di tara | `tara` | 169593 /forms/0/form |
| 573808 | `peponidi` | noun | 0 | plurale di peponide | `peponide` | 408277 /forms/0/form |
| 576040 | `conserve` | noun | 0 | plurale di conserva | `conserva` | 217722 /forms/0/form |
| 576980 | `tessalonicesi` | noun | 0 | plurale di tessalonicese | `tessalonicese` | 554128 /forms/0/form |
| 576984 | `Impenni` | noun | 0 | plurale di impenne | `impenne` | 576983 /forms/0/form |
| 577008 | `colombi` | noun | 0 | plurale di colombo | `colombo` | 31081 /forms/0/form |
| 577070 | `parresie` | noun | 0 | plurale di parresia | `parresia` | 420552 /forms/0/form |
| 577080 | `legacci` | noun | 0 | plurale di legaccio | `legaccio` | 134547 /forms/0/form |
| 577158 | `seriemi` | noun | 0 | plurale di seriema | `seriema` | 577157 /forms/0/form |
| 577604 | `omotermi` | adj | 0 | plurale di omotermo | `omotermo` | 466056 /forms/0/form |
| 578493 | `preconcetti` | noun | 0 | plurale di preconcetto | `preconcetto` | 254639 /forms/0/form |
| 578494 | `proponimenti` | noun | 0 | plurale di proponimento | `proponimento` | 423290 /forms/0/form |
| 578511 | `balestrucci` | noun | 0 | plurale di balestruccio | `balestruccio` | 578231 /forms/0/form |
| 579137 | `dettami` | noun | 0 | plurale di dettame | `dettame` | 49301 /forms/0/form |
| 579179 | `fontanili` | noun | 0 | plurale di fontanile | `fontanile` | 579178 /forms/0/form |
| 579233 | `morisse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di morire | `morire` | 38799 /forms/84/form |
| 579258 | `roventi` | adj | 0 | plurale di rovente | `rovente` | 134203 /forms/0/form |
| 579322 | `proroghe` | noun | 0 | plurale di proroga | `proroga` | 197433 /forms/0/form |
| 579356 | `scoprite` | verb | 0 | seconda persona plurale dell'indicativo presente di scoprire | `scoprire` | 49934 /forms/8/form |
| 579356 | `scoprite` | verb | 1 | seconda persona plurale dell'imperativo presente di scoprire | `scoprire` | 49934 /forms/8/form |
| 579438 | `saprà` | verb | 0 | terza persona singolare dell'indicativo futuro semplice di sapere | `sapere` | 38301 /forms/25/form |
| 579487 | `nociuto` | verb | 0 | participio passato di nuocere | `nuocere` | 420935 /forms/3/form |
| 579523 | `arabesche` | adj | 0 | femminile plurale di arabesco | `arabesco` | 338878 /forms/2/form |
| 579525 | `gineconomi` | noun | 0 | maschile plurale di gineconomo | `gineconomo` | 579524 /forms/0/form |
| 579535 | `ardiglioni` | noun | 0 | maschile plurale di ardiglione | `ardiglione` | 579534 /forms/0/form |
| 579541 | `scopriamo` | verb | 1 | prima persona plurale del congiuntivo presente di scoprire | `scoprire` | 49934 /forms/7/form |
| 579541 | `scopriamo` | verb | 2 | prima persona plurale dell'imperativo presente di scoprire | `scoprire` | 49934 /forms/7/form |
| 579580 | `vistò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di vistare | `vistare` | 581941 /forms/18/form |
| 579590 | `provenienze` | noun | 0 | plurale di provenienza | `provenienza` | 52623 /forms/0/form |
| 579693 | `vedete` | verb | 0 | seconda persona plurale dell'indicativo presente di vedere | `vedere` | 33206 /forms/9/form |
| 579693 | `vedete` | verb | 1 | seconda persona plurale dell'imperativo presente di vedere | `vedere` | 33206 /forms/9/form |
| 581574 | `volesse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di volere | `volere` | 2711 /forms/72/form |
| 581575 | `potranno` | verb | 0 | terza persona plurale dell'indicativo futuro semplice di potere | `potere` | 33208 /forms/30/form |
| 581576 | `dovessero` | verb | 0 | terza persona plurale del congiuntivo imperfetto di dovere | `dovere` | 38294 /forms/113/form |
| 581907 | `logorò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di logorare | `logorare` | 40222 /forms/19/form |
| 581993 | `soppresse` | adj | 0 | femminile plurale di soppresso | `soppresso` | 535569 /forms/2/form |
| 582539 | `trasandati` | adj | 0 | plurale di trasandato | `trasandato` | 421833 /forms/0/form |
| 582753 | `aranciate` | noun | 0 | plurale di aranciata | `aranciata` | 1401 /forms/0/form |
| 582783 | `logorate` | verb | 0 | participio passato plurale femminile di logorare | `logorare` | 40222 /forms/9/form |
| 582783 | `logorate` | verb | 1 | seconda persona plurale dell'indicativo presente di logorare | `logorare` | 40222 /forms/9/form |
| 582783 | `logorate` | verb | 2 | seconda persona plurale dell'imperativo presente di logorare | `logorare` | 40222 /forms/9/form |
| 582787 | `insufficienze` | noun | 0 | plurale di insufficienza | `insufficienza` | 50613 /forms/0/form |
| 582803 | `piace` | verb | 0 | terza persona singolare dell'indicativo presente di piacere | `piacere` | 33110 /forms/6/form |
| 582870 | `ascetica` | noun | 0 | femminile di ascetico | `ascetico` | 227830 /forms/1/form |
| 582959 | `locande` | noun | 0 | plurale di locanda | `locanda` | 40355 /forms/0/form |
| 582960 | `balere` | noun | 0 | plurale di balera | `balera` | 582962 /forms/0/form |
| 583025 | `consentono` | verb | 0 | terza persona plurale dell'indicativo presente di consentire | `consentire` | 48097 /forms/9/form |
| 583033 | `motovedette` | noun | 0 | plurale di motovedetta | `motovedetta` | 128791 /forms/0/form |
| 583044 | `annessa` | adj | 0 | femminile di annesso | `annesso` | 420501 /forms/1/form |
| 583176 | `ragguardevoli` | adj | 0 | plurale di ragguardevole | `ragguardevole` | 464309 /forms/0/form |
| 583184 | `nutritivi` | adj | 0 | plurale di nutritivo | `nutritivo` | 454601 /forms/0/form |
| 583186 | `nutritive` | adj | 0 | femminile plurale di nutritivo | `nutritivo` | 454601 /forms/2/form |
| 583231 | `diamo` | verb | 0 | prima persona plurale dell'indicativo presente di dare | `dare` | 2340 /forms/8/form |
| 583231 | `diamo` | verb | 2 | prima persona plurale dell'imperativo presente di dare | `dare` | 2340 /forms/8/form |
| 583232 | `offriamo` | verb | 1 | prima persona plurale del congiuntivo presente di offrire | `offrire` | 1134 /forms/8/form |
| 583232 | `offriamo` | verb | 2 | prima persona plurale dell'imperativo presente di offrire | `offrire` | 1134 /forms/8/form |
| 583233 | `consentite` | verb | 1 | seconda persona plurale dell'indicativo presente di consentire | `consentire` | 48097 /forms/8/form |
| 583233 | `consentite` | verb | 2 | seconda persona plurale dell'imperativo presente di consentire | `consentire` | 48097 /forms/8/form |
| 583269 | `dispiace` | verb | 0 | terza persona singolare dell'indicativo presente di dispiacere | `dispiacere` | 48304 /forms/6/form |
| 583336 | `aurea` | adj | 0 | femminile di aureo | `aureo` | 31596 /forms/1/form |
| 583345 | `immodesti` | adj | 0 | plurale di immodesto | `immodesto` | 134719 /forms/0/form |
| 583373 | `rilassa` | verb | 1 | seconda persona singolare dell'imperativo presente di rilassare | `rilassare` | 49251 /forms/7/form |
| 583413 | `udiamo` | verb | 1 | prima persona plurale del congiuntivo presente di udire | `udire` | 899 /forms/8/form |
| 583413 | `udiamo` | verb | 2 | prima persona plurale dell'imperativo presente di udire | `udire` | 899 /forms/8/form |
| 583414 | `patiamo` | verb | 1 | prima persona plurale del congiuntivo presente di patire | `patire` | 410140 /forms/8/form |
| 583414 | `patiamo` | verb | 2 | prima persona plurale dell'imperativo presente di patire | `patire` | 410140 /forms/8/form |
| 583415 | `prevediamo` | verb | 1 | prima persona plurale del congiuntivo presente di prevedere | `prevedere` | 49046 /forms/11/form |
| 583415 | `prevediamo` | verb | 2 | prima persona plurale dell'imperativo presente di prevedere | `prevedere` | 49046 /forms/11/form |
| 583416 | `capiamo` | verb | 0 | prima persona plurale dell'indicativo presente di capire | `capire` | 39333 /forms/8/form |
| 583416 | `capiamo` | verb | 1 | prima persona plurale del congiuntivo presente di capire | `capire` | 39333 /forms/8/form |
| 583416 | `capiamo` | verb | 2 | prima persona plurale dell'imperativo presente di capire | `capire` | 39333 /forms/8/form |
| 583419 | `visitatrici` | noun | 0 | femminile plurale di visitatore | `visitatore` | 55610 /forms/2/form |
| 583420 | `visitatori` | noun | 0 | plurale di visitatore | `visitatore` | 55610 /forms/0/form |
| 583523 | `custodie` | noun | 0 | plurale di custodia | `custodia` | 49112 /forms/0/form |
| 583780 | `soppressi` | adj | 0 | plurale di soppresso | `soppresso` | 535569 /forms/0/form |
| 583942 | `realistici` | adj | 0 | plurale di realistico | `realistico` | 449832 /forms/0/form |
| 583943 | `irrealistici` | adj | 0 | plurale di irrealistico | `irrealistico` | 460052 /forms/0/form |
| 583944 | `irrealistica` | adj | 0 | femminile di irrealistico | `irrealistico` | 460052 /forms/1/form |
| 583948 | `ricciuti` | adj | 0 | plurale di ricciuto | `ricciuto` | 438178 /forms/0/form |
| 584029 | `accigliate` | verb | 1 | seconda persona plurale dell'indicativo presente di accigliare | `accigliare` | 454945 /forms/8/form |
| 584029 | `accigliate` | verb | 2 | seconda persona plurale del congiuntivo presente di accigliare | `accigliare` | 454945 /forms/8/form |
| 584029 | `accigliate` | verb | 3 | seconda persona plurale dell'imperativo presente di accigliare | `accigliare` | 454945 /forms/8/form |
| 584075 | `soddisfatti` | adj | 0 | plurale di soddisfatto | `soddisfatto` | 24284 /forms/0/form |
| 584100 | `odontoiatri` | noun | 0 | plurale di odontoiatra | `odontoiatra` | 417963 /forms/0/form |
| 584107 | `semenzai` | noun | 0 | plurale di semenzaio | `semenzaio` | 584106 /forms/0/form |
| 584181 | `tacque` | verb | 0 | terza persona singolare dell'indicativo passato remoto di tacere | `tacere` | 50178 /forms/20/form |
| 584200 | `folignati` | adj | 0 | plurale di folignate | `folignate` | 584199 /forms/0/form |
| 584221 | `cooperatori` | noun | 0 | plurale di cooperatore | `cooperatore` | 544716 /forms/0/form |
| 584242 | `mucose` | noun | 0 | plurale di mucosa | `mucosa` | 51896 /forms/0/form |
| 584243 | `rivide` | verb | 0 | terza persona singolare dell'indicativo passato remoto di rivedere | `rivedere` | 49431 /forms/19/form |
| 584244 | `epigone` | noun | 0 | femminile plurale di epigono | `epigono` | 38695 /forms/2/form |
| 584249 | `epigona` | noun | 0 | femminile di epigono | `epigono` | 38695 /forms/1/form |
| 584275 | `esecutivi` | adj | 0 | plurale di esecutivo | `esecutivo` | 413962 /forms/0/form |
| 584282 | `umanitarie` | noun | 0 | femminile plurale di umanitario | `umanitario` | 139730 /forms/2/form |
| 584284 | `umanitari` | noun | 0 | femminile plurale di umanitario | `umanitario` | 139730 /forms/0/form |
| 584293 | `consente` | verb | 0 | terza persona singolare dell'indicativo presente di consentire | `consentire` | 48097 /forms/6/form |
| 584892 | `rischiò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di rischiare | `rischiare` | 81157 /forms/18/form |
| 584901 | `imbrogliona` | noun | 0 | femminile di imbroglione | `imbroglione` | 130247 /forms/1/form |
| 584902 | `imbroglioni` | noun | 0 | plurale di imbroglione | `imbroglione` | 130247 /forms/0/form |
| 584929 | `convalide` | noun | 0 | plurale di convalida | `convalida` | 260563 /forms/0/form |
| 584972 | `soddisfece` | verb | 0 | terza persona singolare dell'indicativo passato remoto di soddisfare | `soddisfare` | 39039 /forms/23/form |
| 584974 | `godette` | verb | 0 | terza persona singolare dell'indicativo passato remoto di godere | `godere` | 133340 /forms/20/form |
| 585045 | `salirebbe` | verb | 0 | terza persona singolare del condizionale presente di salire | `salire` | 49483 /forms/78/form |
| 585047 | `sindacaliste` | noun | 0 | femminile plurale di sindacalista | `sindacalista` | 163086 /forms/1/form |
| 585193 | `biscrome` | noun | 0 | plurale di biscroma | `biscroma` | 475351 /forms/0/form |
| 585195 | `piacete` | verb | 1 | seconda persona plurale dell'imperativo presente di piacere | `piacere` | 33110 /forms/8/form |
| 585224 | `logori` | verb | 1 | prima persona singolare del congiuntivo presente di logorare | `logorare` | 40222 /forms/6/form |
| 585224 | `logori` | verb | 2 | seconda persona singolare del congiuntivo presente di logorare | `logorare` | 40222 /forms/6/form |
| 585224 | `logori` | verb | 3 | terza persona singolare del congiuntivo presente di logorare | `logorare` | 40222 /forms/6/form |
| 585224 | `logori` | verb | 4 | terza persona singolare dell'imperativo presente di logorare | `logorare` | 40222 /forms/6/form |
| 585240 | `riscosse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di riscuotere | `riscuotere` | 134241 /forms/18/form |
| 585261 | `bassopiani` | noun | 0 | plurale di bassopiano | `bassopiano` | 404377 /forms/0/form |
| 585282 | `asili` | noun | 0 | plurale di asilo | `asilo` | 8171 /forms/0/form |
| 585314 | `incolpevoli` | adj | 0 | plurale di incolpevole | `incolpevole` | 464434 /forms/0/form |
| 585319 | `piaci` | verb | 1 | seconda persona singolare dell'imperativo presente di piacere | `piacere` | 33110 /forms/5/form |
| 585324 | `morrai` | verb | 0 | seconda persona singolare dell'indicativo futuro semplice di morire | `morire` | 38799 /forms/25/form |
| 585338 | `traspari` | verb | 1 | seconda persona singolare dell'imperativo presente di trasparire | `trasparire` | 61652 /forms/5/form |
| 585367 | `spense` | verb | 0 | terza persona singolare dell'indicativo passato remoto di spegnere | `spegnere` | 137762 /forms/18/form |
| 585402 | `vedranno` | verb | 0 | terza persona plurale dell'indicativo futuro semplice di vedere | `vedere` | 33206 /forms/28/form |
| 585450 | `uccisori` | noun | 0 | plurale di uccisore | `uccisore` | 113159 /forms/0/form |
| 585451 | `uccisora` | noun | 0 | femminile singolare di uccisore | `uccisore` | 113159 /forms/1/form |
| 585579 | `condizionamenti` | noun | 0 | plurale di condizionamento | `condizionamento` | 417746 /forms/0/form |
| 585591 | `spruzzate` | verb | 0 | participio passato plurale femminile di spruzzare | `spruzzare` | 32642 /forms/8/form |
| 585712 | `stazionaria` | adj | 0 | femminile di stazionario | `stazionario` | 55273 /forms/1/form |
| 585717 | `logora` | verb | 0 | terza persona singolare dell'indicativo presente di logorare | `logorare` | 40222 /forms/7/form |
| 585717 | `logora` | verb | 1 | seconda persona singolare dell'imperativo presente di logorare | `logorare` | 40222 /forms/7/form |
| 585728 | `trasandata` | adj | 0 | femminile di trasandato | `trasandato` | 421833 /forms/1/form |
| 585730 | `rimbomba` | verb | 0 | terza persona singolare dell'indicativo presente di rimbombare | `rimbombare` | 49255 /forms/6/form |
| 585730 | `rimbomba` | verb | 1 | seconda persona singolare dell'imperativo presente di rimbombare | `rimbombare` | 49255 /forms/6/form |
| 585765 | `punse` | verb | 0 | terza persona singolare dell'indicativo passato remoto di pungere | `pungere` | 462776 /forms/18/form |
| 585827 | `connetti` | verb | 1 | seconda persona singolare dell'imperativo presente di connettere | `connettere` | 48080 /forms/6/form |
| 586043 | `prevedessi` | verb | 0 | prima persona singolare del congiuntivo imperfetto di prevedere | `prevedere` | 49046 /forms/84/form |
| 586043 | `prevedessi` | verb | 1 | seconda persona singolare del congiuntivo imperfetto di prevedere | `prevedere` | 49046 /forms/84/form |
| 586190 | `celestiali` | noun | 0 | plurale di celestiale | `celestiale` | 126534 /forms/0/form |
| 586209 | `aurei` | adj | 0 | plurale di aureo | `aureo` | 31596 /forms/0/form |
| 586696 | `invaghite` | verb | 0 | participio passato plurale femminile di invaghire | `invaghire` | 136942 /forms/9/form |
| 586696 | `invaghite` | verb | 1 | seconda persona plurale dell'indicativo presente di invaghire | `invaghire` | 136942 /forms/9/form |
| 586696 | `invaghite` | verb | 2 | seconda persona plurale dell'imperativo presente di invaghire | `invaghire` | 136942 /forms/9/form |
| 586701 | `stentata` | adj | 0 | femminile di stentato | `stentato` | 257639 /forms/1/form |
| 586706 | `estimatori` | noun | 0 | plurale di estimatore | `estimatore` | 417777 /forms/0/form |
| 587266 | `burberi` | noun | 0 | plurale di burbero | `burbero` | 136257 /forms/0/form |
| 587740 | `lestofanti` | noun | 0 | plurale di lestofante | `lestofante` | 124143 /forms/0/form |
| 587778 | `cafoni` | adj | 0 | plurale di cafone | `cafone` | 16227 /forms/0/form |
| 587779 | `cafoni` | noun | 0 | plurale di cafone | `cafone` | 16227 /forms/0/form |
| 587780 | `cafona` | adj | 0 | femminile di cafone | `cafone` | 16227 /forms/1/form |
| 587781 | `cafona` | noun | 0 | femminile di cafone | `cafone` | 16227 /forms/1/form |
| 587782 | `zotica` | adj | 0 | femminile di zotico | `zotico` | 55839 /forms/1/form |
| 587783 | `zotica` | noun | 0 | femminile di zotico | `zotico` | 55839 /forms/1/form |
| 587792 | `asprigni` | adj | 0 | plurale di asprigno | `asprigno` | 124011 /forms/0/form |
| 587817 | `libbre` | noun | 0 | plurale di libbra | `libbra` | 97846 /forms/0/form |
| 587845 | `arbitraria` | adj | 0 | femminile di arbitrario | `arbitrario` | 115156 /forms/1/form |
| 587847 | `arbitrarie` | adj | 0 | femminile plurale di arbitrario | `arbitrario` | 115156 /forms/2/form |
| 587848 | `soggettive` | adj | 0 | plurale femminile di soggettivo | `soggettivo` | 282684 /forms/2/form |
| 587948 | `copertoni` | noun | 0 | plurale di copertone | `copertone` | 136244 /forms/0/form |
| 588280 | `terrori` | noun | 0 | plurale di terrore | `terrore` | 54706 /forms/0/form |
| 588314 | `spirali` | noun | 0 | plurale di spirale | `spirale` | 121650 /forms/0/form |
| 588352 | `scellerata` | noun | 0 | femminile di scellerato | `scellerato` | 133734 /forms/1/form |
| 588362 | `malefica` | noun | 0 | femminile di malefico | `malefico` | 38851 /forms/1/form |
| 588364 | `malefiche` | noun | 0 | femminile plurale di malefico | `malefico` | 38851 /forms/2/form |
| 588416 | `riformisti` | adj | 0 | plurale di riformista | `riformista` | 416709 /forms/0/form |
| 588417 | `riformisti` | noun | 0 | plurale di riformista | `riformista` | 416709 /forms/0/form |
| 588543 | `atipica` | adj | 0 | femminile di atipico | `atipico` | 422704 /forms/1/form |
| 588580 | `lussuriosa` | adj | 0 | femminile di lussurioso | `lussurioso` | 419964 /forms/1/form |
| 588673 | `malinconica` | adj | 0 | femminile di malinconico | `malinconico` | 138573 /forms/1/form |
| 588941 | `rapinatori` | noun | 0 | plurale di rapinatore | `rapinatore` | 136987 /forms/0/form |
| 589039 | `taccheggiatori` | noun | 0 | plurale di taccheggiatore | `taccheggiatore` | 409198 /forms/0/form |
| 589039 | `taccheggiatori` | noun | 1 | plurale di taccheggiatore | `taccheggiatore` | 409198 /forms/0/form |
| 589050 | `alluvioni` | noun | 0 | plurale di alluvione | `alluvione` | 47408 /forms/0/form |
| 589050 | `alluvioni` | noun | 1 | plurale di alluvione | `alluvione` | 47408 /forms/0/form |
| 589116 | `manate` | noun | 0 | plurale di manata | `manata` | 589114 /forms/0/form |
| 589117 | `dominatori` | noun | 0 | plurale di dominatore | `dominatore` | 530669 /forms/0/form |
| 589253 | `multimiliardari` | noun | 0 | plurale di multimiliardario | `multimiliardario` | 589250 /forms/0/form |
| 589257 | `multimiliardarie` | noun | 0 | femminile plurale di multimiliardario | `multimiliardario` | 589250 /forms/2/form |
| 589737 | `leziosa` | adj | 0 | femminile di lezioso | `lezioso` | 115067 /forms/1/form |
| 589912 | `scellerate` | noun | 0 | plurale femminile di scellerato | `scellerato` | 133734 /forms/2/form |
| 589942 | `grinzosa` | adj | 0 | femminile di grinzoso | `grinzoso` | 494933 /forms/1/form |
| 589944 | `grinzose` | adj | 0 | femminile di grinzoso | `grinzoso` | 494933 /forms/2/form |
| 589984 | `riavuta` | adj | 0 | femminile di riavuto | `riavuto` | 589982 /forms/1/form |
| 589986 | `riavuti` | adj | 0 | plurale di riavuto | `riavuto` | 589982 /forms/0/form |
| 589988 | `riavute` | adj | 0 | plurale femminile di riavuto | `riavuto` | 589982 /forms/2/form |
| 590029 | `superstiti` | noun | 0 | plurale di superstite | `superstite` | 54516 /forms/0/form |
| 590103 | `appariscenti` | adj | 0 | plurale di appariscente | `appariscente` | 420386 /forms/0/form |
| 590166 | `indossatori` | noun | 0 | plurale di indossatore | `indossatore` | 464481 /forms/0/form |
| 590207 | `mandrie` | noun | 0 | plurale di mandria | `mandria` | 63271 /forms/0/form |
| 590275 | `persuasive` | noun | 0 | femminile plurale di persuasivo | `persuasivo` | 442108 /forms/2/form |
| 590309 | `musi` | noun | 0 | plurale di muso | `muso` | 108763 /forms/0/form |
| 590346 | `armeggiona` | noun | 0 | femminile di armeggione | `armeggione` | 583208 /forms/1/form |
| 590347 | `armeggioni` | noun | 0 | plurale di armeggione | `armeggione` | 583208 /forms/0/form |
| 590370 | `partirei` | verb | 0 | prima persona singolare del condizionale presente di partire | `partire` | 8714 /forms/52/form |
| 590381 | `iconica` | noun | 0 | femminile di iconico | `iconico` | 461446 /forms/1/form |
| 590383 | `iconiche` | noun | 0 | femminile plurale di iconico | `iconico` | 461446 /forms/2/form |
| 590426 | `ostacolisti` | noun | 0 | plurale di ostacolista | `ostacolista` | 46187 /forms/0/form |
| 590449 | `balorda` | adj | 0 | femminile di balordo | `balordo` | 133529 /forms/1/form |
| 590452 | `balordi` | adj | 0 | plurale di balordo | `balordo` | 133529 /forms/0/form |
| 590453 | `balorde` | adj | 0 | femminile plurale di balordo | `balordo` | 133529 /forms/2/form |
| 590488 | `rovinò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di rovinare | `rovinare` | 49461 /forms/19/form |
| 590489 | `intendimenti` | noun | 0 | plurale di intendimento | `intendimento` | 50628 /forms/0/form |
| 590497 | `imbevuti` | adj | 0 | plurale di imbevuto | `imbevuto` | 467160 /forms/0/form |
| 590569 | `elitaria` | adj | 0 | femminile di elitario | `elitario` | 63932 /forms/1/form |
| 591073 | `possediamo` | verb | 1 | prima persona plurale del congiuntivo presente di possedere | `possedere` | 37873 /forms/8/form |
| 591073 | `possediamo` | verb | 2 | prima persona plurale dell'imperativo presente di possedere | `possedere` | 37873 /forms/8/form |
| 591187 | `chiarificatori` | noun | 0 | plurale di chiarificatore | `chiarificatore` | 591182 /forms/0/form |
| 591188 | `chiarificatori` | noun | 0 | plurale di chiarificatore | `chiarificatore` | 591182 /forms/0/form |
| 591708 | `disfai` | verb | 1 | seconda persona singolare dell'imperativo presente di disfare | `disfare` | 48291 /forms/6/form |
| 591715 | `speranzosa` | adj | 0 | femminile di speranzoso | `speranzoso` | 551394 /forms/1/form |
| 591716 | `speranzosi` | adj | 0 | plurale di speranzoso | `speranzoso` | 551394 /forms/0/form |
| 591717 | `speranzose` | adj | 0 | femminile plurale di speranzoso | `speranzoso` | 551394 /forms/2/form |
| 591772 | `nullatenenti` | noun | 0 | plurale di nullatenente | `nullatenente` | 405463 /forms/0/form |
| 591790 | `altaici` | adj | 0 | plurale di altaico | `altaico` | 591773 /forms/0/form |
| 591881 | `ferraresi` | adj | 0 | plurale di ferrarese | `ferrarese` | 544437 /forms/0/form |
| 591882 | `ferraresi` | noun | 0 | plurale di ferrarese | `ferrarese` | 544437 /forms/0/form |
| 592298 | `polpette` | noun | 0 | plurale di polpetta | `polpetta` | 52378 /forms/0/form |
| 592338 | `radiata` | adj | 0 | femminile di radiato | `radiato` | 352691 /forms/1/form |
| 592370 | `rimarchevoli` | adj | 0 | plurale di rimarchevole | `rimarchevole` | 500274 /forms/0/form |
| 592382 | `distensioni` | noun | 0 | plurale di distensione | `distensione` | 416922 /forms/0/form |
| 592399 | `udite` | verb | 1 | seconda persona plurale dell'indicativo presente di udire | `udire` | 899 /forms/9/form |
| 592399 | `udite` | verb | 2 | seconda persona plurale dell'imperativo presente di udire | `udire` | 899 /forms/9/form |
| 592523 | `cerimoniosa` | adj | 0 | femminile di cerimonioso | `cerimonioso` | 462061 /forms/1/form |
| 592710 | `quelli` | pron | 0 | plurale di quello | `quello` | 33211 /forms/0/form |
| 592768 | `clausole` | noun | 0 | plurale di clausola | `clausola` | 405347 /forms/0/form |
| 592778 | `sbieca` | noun | 0 | femminile di sbieco | `sbieco` | 139146 /forms/1/form |
| 592826 | `atipici` | adj | 0 | plurale di atipico | `atipico` | 422704 /forms/0/form |
| 592827 | `atipiche` | adj | 0 | femminile plurale di atipico | `atipico` | 422704 /forms/2/form |
| 592828 | `anormali` | adj | 0 | plurale di anormale | `anormale` | 138784 /forms/0/form |
| 592829 | `anormali` | noun | 0 | plurale di anormale | `anormale` | 138784 /forms/0/form |
| 592832 | `devianti` | adj | 0 | plurale di deviante | `deviante` | 592830 /forms/0/form |
| 592873 | `artiglieri` | noun | 0 | plurale di artigliere | `artigliere` | 460117 /forms/0/form |
| 592884 | `sapesti` | verb | 0 | seconda persona singolare dell'indicativo passato remoto di sapere | `sapere` | 38301 /forms/18/form |
| 592966 | `destri` | noun | 0 | plurale di destro | `destro` | 137655 /forms/0/form |
| 593042 | `comporti` | verb | 4 | terza persona singolare dell'imperativo presente di comportare | `comportare` | 90625 /forms/6/form |
| 593043 | `stracotti` | adj | 0 | plurale di stracotto | `stracotto` | 593046 /forms/0/form |
| 593044 | `stracotti` | noun | 0 | plurale di stracotto | `stracotto` | 593046 /forms/0/form |
| 593064 | `lodigiana` | noun | 0 | femminile di lodigiano | `lodigiano` | 535663 /forms/1/form |
| 593270 | `prevedendo` | verb | 0 | gerundio presente di prevedere | `prevedere` | 49046 /forms/1/form |
| 593742 | `sottosviluppati` | adj | 0 | plurale di sottosviluppato | `sottosviluppato` | 441883 /forms/0/form |
| 593774 | `vanagloriosi` | noun | 0 | plurale di vanaglorioso | `vanaglorioso` | 463957 /forms/0/form |
| 594612 | `monocordi` | adj | 0 | plurale di monocorde | `monocorde` | 594610 /forms/0/form |
| 594618 | `stazionarie` | adj | 0 | femminile plurale di stazionario | `stazionario` | 55273 /forms/2/form |
| 594672 | `reclusioni` | noun | 0 | plurale di reclusione | `reclusione` | 412308 /forms/0/form |
| 594725 | `giostraia` | noun | 0 | plurale di giostrai | `giostrai` | 160796 /forms/1/form |
| 594747 | `giostraie` | noun | 0 | femminile plurale di giostrai | `giostrai` | 160796 /forms/2/form |
| 594783 | `vanagloriose` | noun | 0 | femminile plurale di vanaglorioso | `vanaglorioso` | 463957 /forms/2/form |
| 595129 | `sovvertitori` | noun | 0 | plurale di sovvertitore | `sovvertitore` | 404313 /forms/0/form |
| 595452 | `sapevamo` | verb | 0 | prima persona plurale dell'indicativo imperfetto di sapere | `sapere` | 38301 /forms/14/form |
| 595532 | `colombiana` | noun | 0 | femminile di colombiano | `colombiano` | 423652 /forms/1/form |
| 595533 | `piacque` | verb | 0 | terza persona singolare dell'indicativo passato remoto di piacere | `piacere` | 33110 /forms/18/form |
| 595582 | `eleatica` | adj | 0 | femminile di eleatico | `eleatico` | 464110 /forms/1/form |
| 595608 | `debbo` | verb | 0 | prima persona singolare dell'indicativo presente di dovere | `dovere` | 38294 /forms/4/form |
| 595618 | `tettoie` | noun | 0 | plurale di tettoia | `tettoia` | 7633 /forms/0/form |
| 595661 | `propizie` | adj | 0 | femminile plurale di propizio | `propizio` | 363499 /forms/2/form |
| 595736 | `mulattiere` | noun | 0 | plurale di mulattiera | `mulattiera` | 417157 /forms/0/form |
| 595906 | `soffitti` | noun | 0 | plurale di soffitto | `soffitto` | 215350 /forms/0/form |
| 596369 | `accaldata` | adj | 0 | femminile di accaldato | `accaldato` | 461609 /forms/1/form |
| 596659 | `endovenosa` | adj | 0 | femminile di endovenoso | `endovenoso` | 407596 /forms/1/form |
| 597092 | `assembleari` | adj | 0 | plurale di assembleare | `assembleare` | 413448 /forms/0/form |
| 597327 | `taxa` | noun | 0 | plurale di taxon | `taxon` | 605666 /forms/0/form |
| 597799 | `sbieche` | noun | 0 | femminile plurale di sbieco | `sbieco` | 139146 /forms/2/form |
| 598163 | `decennali` | adj | 0 | plurale di decennale | `decennale` | 30468 /forms/0/form |
| 598176 | `scollacciata` | adj | 0 | femminile di scollacciato | `scollacciato` | 548384 /forms/1/form |
| 598977 | `simmetrica` | adj | 0 | femminile di simmetrico | `simmetrico` | 140337 /forms/1/form |
| 598978 | `simmetrici` | adj | 0 | plurale di simmetrico | `simmetrico` | 140337 /forms/0/form |
| 599171 | `robacce` | noun | 0 | plurale di robaccia | `robaccia` | 596981 /forms/0/form |
| 599391 | `rauca` | adj | 0 | femminile di rauco | `rauco` | 462911 /forms/1/form |
| 599425 | `tradizionalisti` | adj | 0 | plurale di tradizionalista | `tradizionalista` | 447122 /forms/0/form |
| 599426 | `tradizionalisti` | noun | 0 | plurale di tradizionalista | `tradizionalista` | 447122 /forms/0/form |
| 599427 | `tradizionaliste` | adj | 0 | femminile plurale di tradizionalista | `tradizionalista` | 447122 /forms/1/form |
| 599428 | `tradizionaliste` | noun | 0 | femminile plurale di tradizionalista | `tradizionalista` | 447122 /forms/1/form |
| 599493 | `sonetti` | noun | 0 | plurale di sonetto | `sonetto` | 135169 /forms/0/form |
| 599524 | `Ostreidi` | noun | 0 | plurale di ostreide | `ostreide` | 599522 /forms/0/form |
| 599551 | `duomi` | noun | 0 | plurale di duomo | `duomo` | 40389 /forms/0/form |
| 599608 | `burrascosa` | adj | 0 | femminile di burrascoso | `burrascoso` | 546743 /forms/1/form |
| 599719 | `lipomi` | noun | 0 | plurale di lipoma | `lipoma` | 33594 /forms/0/form |
| 599720 | `mixomi` | noun | 0 | plurale di mixoma | `mixoma` | 551015 /forms/0/form |
| 599769 | `avicola` | adj | 0 | femminile di avicolo | `avicolo` | 599768 /forms/1/form |
| 599770 | `avicoli` | adj | 0 | plurale di avicolo | `avicolo` | 599768 /forms/0/form |
| 599771 | `avicole` | adj | 0 | femminile plurale di avicolo | `avicolo` | 599768 /forms/2/form |
| 599802 | `visigota` | adj | 0 | femminile di visigoto | `visigoto` | 69844 /forms/1/form |
| 599803 | `visigota` | noun | 0 | femminile di visigoto | `visigoto` | 69844 /forms/1/form |
| 599880 | `nodali` | adj | 0 | plurale di nodale | `nodale` | 457387 /forms/0/form |
| 599881 | `zampogne` | noun | 0 | plurale di zampogna | `zampogna` | 40996 /forms/0/form |
| 599922 | `rispettiva` | adj | 0 | femminile di rispettivo | `rispettivo` | 489148 /forms/1/form |
| 599974 | `vetuste` | adj | 0 | femminile plurale di vetusto | `vetusto` | 102054 /forms/2/form |
| 600253 | `sotterranei` | adj | 0 | plurale di sotterraneo | `sotterraneo` | 54187 /forms/0/form |
| 600742 | `comizianti` | noun | 0 | plurale di comiziante | `comiziante` | 600741 /forms/0/form |
| 600839 | `vicari` | noun | 0 | plurale di vicario | `vicario` | 43175 /forms/0/form |
| 600857 | `microbi` | noun | 0 | plurale di microbo | `microbo` | 138694 /forms/0/form |
| 600878 | `corsive` | adj | 0 | femminile plurale di corsivo | `corsivo` | 464596 /forms/2/form |
| 600905 | `anteroposteriori` | adj | 0 | plurale di anteroposteriore | `anteroposteriore` | 600900 /forms/0/form |
| 601288 | `espansionismi` | noun | 0 | plurale di espansionismo | `espansionismo` | 278073 /forms/0/form |
| 601614 | `milionari` | adj | 0 | plurale di milionario | `milionario` | 51771 /forms/0/form |
| 601743 | `bubbonica` | adj | 0 | femminile di bubbonico | `bubbonico` | 544491 /forms/1/form |
| 602075 | `malvoni` | noun | 0 | plurale di malvone | `malvone` | 602074 /forms/0/form |
| 602223 | `disumane` | adj | 0 | femminile plurale di disumano | `disumano` | 277492 /forms/2/form |
| 602625 | `globose` | adj | 0 | femminile plurale di globoso | `globoso` | 592293 /forms/2/form |
| 602980 | `avvelenatrice` | noun | 0 | femminile di avvelenatore | `avvelenatore` | 462400 /forms/1/form |
| 603062 | `maestranze` | noun | 0 | plurale di maestranza | `maestranza` | 404894 /forms/0/form |
| 603291 | `inavveduti` | adj | 0 | plurale di inavveduto | `inavveduto` | 544555 /forms/0/form |
| 603915 | `pediatri` | noun | 0 | plurale di pediatra | `pediatra` | 52219 /forms/0/form |
| 604022 | `neonatologi` | noun | 0 | plurale di neonatologo | `neonatologo` | 44530 /forms/0/form |
| 604464 | `alfanumerici` | adj | 0 | plurale di alfanumerico | `alfanumerico` | 449143 /forms/0/form |
| 604526 | `dovremmo` | verb | 0 | prima persona plurale del condizionale presente di dovere | `dovere` | 38294 /forms/83/form |
| 604673 | `proprietari` | noun | 0 | plurale di proprietario | `proprietario` | 52596 /forms/0/form |
| 604674 | `proprietaria` | noun | 0 | femminile di proprietario | `proprietario` | 52596 /forms/1/form |
| 604714 | `compié` | verb | 0 | terza persona singolare dell'indicativo passato remoto di compiere | `compiere` | 8748 /forms/22/form |
| 604882 | `semiliquidi` | adj | 0 | plurale di semiliquido | `semiliquido` | 417026 /forms/0/form |
| 605173 | `bucanieri` | noun | 0 | plurale di bucaniere | `bucaniere` | 133801 /forms/1/form |
| 605175 | `bucaniera` | noun | 0 | plurale di bucaniere | `bucaniere` | 133801 /forms/0/form |
| 605283 | `farmacologica` | adj | 0 | femminile di farmacologico | `farmacologico` | 404727 /forms/1/form |
| 605296 | `geologa` | noun | 0 | femminile di geologo | `geologo` | 215019 /forms/1/form |
| 605376 | `tossica` | adj | 0 | femminile di tossico | `tossico` | 44132 /forms/1/form |
| 605458 | `scabrosi` | adj | 0 | plurale di scabroso | `scabroso` | 133953 /forms/0/form |
| 605504 | `distensive` | adj | 0 | femminile plurale di distensivo | `distensivo` | 548626 /forms/2/form |
| 605576 | `hawaiana` | adj | 0 | femminile di hawaiano | `hawaiano` | 33104 /forms/1/form |
| 605618 | `atte` | adj | 0 | femminile plurale di atto | `atto` | 7575 /forms/2/form |
| 605647 | `asessuata` | adj | 0 | femminile di asessuato | `asessuato` | 120019 /forms/1/form |
| 605696 | `incastellature` | noun | 0 | plurale di incastellatura | `incastellatura` | 442204 /forms/0/form |
| 605723 | `pseudoscientifica` | adj | 0 | femminile di pseudoscientifico | `pseudoscientifico` | 596782 /forms/1/form |
| 605724 | `gerarchica` | adj | 0 | femminile di gerarchico | `gerarchico` | 461454 /forms/1/form |
| 605784 | `programmatrice` | noun | 0 | femminile di programmatore | `programmatore` | 432872 /forms/1/form |
| 605877 | `mammarie` | adj | 0 | femminile plurale di mammario | `mammario` | 420879 /forms/2/form |
| 605983 | `psicoattiva` | adj | 0 | femminile di psicoattivo | `psicoattivo` | 417701 /forms/1/form |
| 606010 | `teologica` | adj | 0 | femminile di teologico | `teologico` | 463381 /forms/1/form |
| 606060 | `calcagni` | noun | 0 | plurale di calcagno | `calcagno` | 412701 /forms/0/form |
| 606152 | `castani` | noun | 0 | plurale di castano | `castano` | 32408 /forms/0/form |
| 606286 | `aviatrici` | noun | 0 | femminile plurale di aviatore | `aviatore` | 137386 /forms/2/form |
| 606320 | `elicotteriste` | noun | 0 | femminile plurale di elicotterista | `elicotterista` | 418341 /forms/1/form |
| 606339 | `figurativa` | adj | 0 | femminile di figurativo | `figurativo` | 450481 /forms/1/form |
| 606427 | `camioniste` | noun | 0 | femminile plurale di camionista | `camionista` | 38011 /forms/1/form |
| 606430 | `lanciatrice` | noun | 0 | femminile di lanciatore | `lanciatore` | 605924 /forms/1/form |
| 606431 | `battitrice` | noun | 0 | femminile di battitore | `battitore` | 605925 /forms/1/form |
| 606481 | `cantautrice` | noun | 0 | femminile di cantautore | `cantautore` | 258498 /forms/1/form |
| 606485 | `fotomodella` | noun | 0 | femminile di fotomodello | `fotomodello` | 605391 /forms/1/form |
| 606701 | `luccichii` | noun | 0 | plurale di luccichio | `luccichio` | 614061 /forms/0/form |
| 606702 | `lampeggiamenti` | noun | 0 | plurale di lampeggiamento | `lampeggiamento` | 494952 /forms/0/form |
| 606776 | `sommaria` | adj | 0 | femminile di sommario | `sommario` | 136757 /forms/1/form |
| 607002 | `carpentiera` | noun | 0 | femminile di carpentiere | `carpentiere` | 134051 /forms/0/form |
| 607070 | `indulgenze` | noun | 0 | plurale di indulgenza | `indulgenza` | 82435 /forms/0/form |
| 607075 | `prati` | noun | 0 | plurale di prato | `prato` | 52442 /forms/0/form |
| 607112 | `tarassachi` | noun | 0 | plurale di tarassaco | `tarassaco` | 463209 /forms/0/form |
| 609948 | `subacquea` | adj | 0 | femminile di subacqueo | `subacqueo` | 465730 /forms/1/form |
| 609992 | `chirurga` | noun | 0 | femminile di chirurgo | `chirurgo` | 109600 /forms/1/form |
| 610041 | `pretensioni` | noun | 0 | plurale di pretensione | `pretensione` | 277251 /forms/0/form |
| 610042 | `alterigie` | noun | 0 | plurale di alterigia | `alterigia` | 121826 /forms/0/form |
| 610060 | `semidei` | noun | 0 | plurale di semidio | `semidio` | 465009 /forms/0/form |
| 610882 | `discorsiva` | adj | 0 | femminile di discorsivo | `discorsivo` | 610881 /forms/1/form |
| 611108 | `attoriali` | adj | 0 | plurale di attoriale | `attoriale` | 599265 /forms/0/form |
| 611364 | `elettriciste` | noun | 0 | femminile plurale di elettricista | `elettricista` | 137535 /forms/1/form |
| 611365 | `idrauliche` | adj | 0 | femminile plurale di idraulico | `idraulico` | 39322 /forms/2/form |
| 611366 | `idrauliche` | noun | 0 | femminile plurale di idraulico | `idraulico` | 39322 /forms/2/form |
| 611444 | `espungo` | verb | 0 | prima persona singolare dell'indicativo presente di espungere | `espungere` | 106158 /forms/4/form |
| 611766 | `cianfrusaglie` | noun | 0 | plurale di cianfrusaglia | `cianfrusaglia` | 129643 /forms/0/form |
| 612215 | `siede` | verb | 0 | terza persona singolare dell'indicativo presente di sedere | `sedere` | 43693 /forms/8/form |
| 612274 | `offrirò` | verb | 0 | prima persona singolare dell'indicativo futuro semplice di offrire | `offrire` | 1134 /forms/23/form |
| 612362 | `fondatrice` | noun | 0 | femminile di fondatore | `fondatore` | 43131 /forms/1/form |
| 612861 | `membranose` | adj | 0 | femminile plurale di membranoso | `membranoso` | 612860 /forms/2/form |
| 613704 | `sottace` | verb | 0 | terza persona singolare dell'indicativo presente di sottacere | `sottacere` | 111329 /forms/6/form |
| 613988 | `pungi` | verb | 0 | seconda persona singolare dell'indicativo presente di pungere | `pungere` | 462776 /forms/5/form |
| 613988 | `pungi` | verb | 1 | seconda persona singolare dell'imperativo presente di pungere | `pungere` | 462776 /forms/5/form |
| 614288 | `gentilizi` | adj | 0 | plurale di gentilizio | `gentilizio` | 421992 /forms/0/form |
| 615146 | `picciotti` | noun | 0 | plurale di picciotto | `picciotto` | 77824 /forms/0/form |
| 615178 | `lecitine` | noun | 0 | plurale di lecitina | `lecitina` | 413319 /forms/0/form |
| 615245 | `ranuncoli` | noun | 0 | plurale di ranuncolo; la sua classificazione scientifica è Ranunculus acer ( tassonomia) | `ranuncolo` | 125134 /forms/0/form |
| 615331 | `vecce` | noun | 0 | plurale di veccia; la sua classificazione scientifica è Vicia sativa ( tassonomia) | `veccia` | 614755 /forms/0/form |
| 615406 | `eucalipti` | noun | 0 | plurale di eucalipto | `eucalipto` | 405846 /forms/0/form |
| 616507 | `saponarie` | noun | 0 | plurale di saponaria | `saponaria` | 237123 /forms/0/form |
| 616514 | `cicerchie` | noun | 0 | plurale di cicerchia; la sua classificazione scientifica è Lathyrus sativus ( tassonomia) | `cicerchia` | 15412 /forms/0/form |
| 616597 | `consessi` | noun | 0 | plurale di consesso | `consesso` | 449826 /forms/0/form |
| 617313 | `protodiaconi` | noun | 0 | plurale di protodiacono | `protodiacono` | 617271 /forms/0/form |
| 618628 | `certosini` | noun | 0 | plurale di certosino | `certosino` | 416203 /forms/0/form |
| 621170 | `scemenze` | noun | 0 | plurale di scemenza | `scemenza` | 464344 /forms/0/form |
| 621745 | `divelta` | adj | 0 | femminile di divelto | `divelto` | 479127 /forms/1/form |
| 622011 | `cioccolati` | noun | 0 | Plurale di cioccolato | `cioccolato` | 1252 /forms/0/form |
| 622063 | `rocchetti` | noun | 0 | Plurale di rocchetto | `rocchetto` | 416991 /forms/0/form |
| 622270 | `fortunelle` | noun | 0 | Plurale di fortunella | `fortunella` | 615024 /forms/0/form |
| 622278 | `pompelmi` | noun | 0 | Plurale di pompelmo | `pompelmo` | 2222 /forms/0/form |
| 622418 | `vampira` | noun | 0 | femminile di vampiro | `vampiro` | 133215 /forms/1/form |
| 622627 | `callistenie` | noun | 0 | Plurale di callistenia | `callistenia` | 579577 /forms/0/form |
| 622631 | `malformativa` | adj | 0 | femminile di malformativo | `malformativo` | 422317 /forms/1/form |
| 622632 | `malformative` | adj | 0 | femminile plurale di malformativo | `malformativo` | 422317 /forms/2/form |
| 622687 | `autoservizi` | noun | 0 | Plurale di autoservizio | `autoservizio` | 622683 /forms/0/form |
| 623667 | `svizzerine` | noun | 0 | plurale di svizzerina | `svizzerina` | 623666 /forms/0/form |
| 623668 | `amburghesi` | noun | 0 | plurale di amburghese | `amburghese` | 547511 /forms/0/form |
| 623669 | `svizzeri` | noun | 0 | plurale di svizzero | `svizzero` | 54543 /forms/0/form |
| 623670 | `svizzere` | noun | 0 | plurale di svizzera | `svizzera` | 54539 /forms/2/form |
| 623671 | `medaglioni` | noun | 0 | plurale di medaglione | `medaglione` | 606614 /forms/0/form |
| 624014 | `superette` | noun | 0 | Plurale di superetta | `superetta` | 624017 /forms/0/form |
| 624044 | `gronde` | noun | 0 | plurale di gronda | `gronda` | 38485 /forms/0/form |
| 624141 | `bancali` | noun | 0 | plurale di bancale | `bancale` | 624140 /forms/0/form |
| 624156 | `favoni` | noun | 0 | plurale di favonio | `favonio` | 493039 /forms/0/form |
| 624196 | `fratercule` | noun | 0 | Plurale di fratercula | `fratercula` | 577109 /forms/0/form |
| 624325 | `mezzoradi` | noun | 0 | plurale di mezzorado | `mezzorado` | 624324 /forms/0/form |
| 624327 | `strucoli` | noun | 0 | plurale di strucolo | `strucolo` | 624326 /forms/0/form |
| 624348 | `esorcisti` | noun | 0 | plurale di esorcista | `esorcista` | 49611 /forms/0/form |
| 624363 | `acquaerobiche` | noun | 0 | Plurale di acquaerobica | `acquaerobica` | 624362 /forms/0/form |
| 624364 | `idroginnastiche` | noun | 0 | Plurale di idroginnastica | `idroginnastica` | 624361 /forms/0/form |
| 624367 | `acquaginnastiche` | noun | 0 | Plurale di acquaginnastica | `acquaginnastica` | 624366 /forms/0/form |
| 624368 | `idroaerobiche` | noun | 0 | Plurale di idroaerobica | `idroaerobica` | 624365 /forms/0/form |
| 624609 | `scansionatori` | noun | 0 | plurale di scansionatore | `scansionatore` | 624608 /forms/0/form |
| 624611 | `tracciatori` | noun | 0 | plurale di tracciatore | `tracciatore` | 624610 /forms/0/form |
| 624614 | `diagrammatori` | noun | 0 | plurale di diagrammatore | `diagrammatore` | 624612 /forms/0/form |
| 624615 | `graficatori` | noun | 0 | plurale di graficatore | `graficatore` | 624613 /forms/0/form |
| 624620 | `telecopiatrici` | noun | 0 | plurale di telecopiatrice | `telecopiatrice` | 624619 /forms/0/form |
| 624621 | `telecopiatori` | noun | 0 | plurale di telecopiatore | `telecopiatore` | 624618 /forms/0/form |
| 624622 | `telecopie` | noun | 0 | plurale di telecopia | `telecopia` | 624616 /forms/0/form |
| 624623 | `telecopiature` | noun | 0 | plurale di telecopiatura | `telecopiatura` | 624617 /forms/0/form |
| 624676 | `tecnofinanze` | noun | 0 | Plurale di tecnofinanza | `tecnofinanza` | 458721 /forms/0/form |
| 624679 | `discorsive` | adj | 0 | femminile plurale di discorsivo | `discorsivo` | 610881 /forms/2/form |
| 624821 | `combusti` | adj | 0 | plurale di combusto | `combusto` | 591620 /forms/0/form |
| 624841 | `flautiste` | noun | 0 | femminile plurale di flautista | `flautista` | 591807 /forms/1/form |
| 624893 | `scanditori` | noun | 0 | plurale di scanditore | `scanditore` | 624891 /forms/0/form |
| 624894 | `scansori` | noun | 0 | plurale di scansore | `scansore` | 624892 /forms/0/form |
| 624895 | `scannerizzatori` | noun | 0 | plurale di scannerizzatore | `scannerizzatore` | 624890 /forms/0/form |
| 624898 | `indirizzatori` | noun | 0 | plurale di indirizzatore | `indirizzatore` | 624896 /forms/0/form |
| 624899 | `smistatori` | noun | 0 | plurale di smistatore | `smistatore` | 624897 /forms/0/form |
| 624914 | `sedioli` | noun | 0 | plurale di sediolo | `sediolo` | 624913 /forms/0/form |
| 624933 | `scuotitoi` | noun | 0 | plurale di scuotitoio | `scuotitoio` | 624932 /forms/0/form |
| 624935 | `scuotitori` | noun | 0 | plurale di scuotitore | `scuotitore` | 624934 /forms/0/form |
| 625220 | `adempi` | verb | 1 | seconda persona singolare dell'imperativo presente di adempiere | `adempiere` | 45292 /forms/6/form |
| 625221 | `sottaci` | verb | 1 | seconda persona singolare dell'imperativo presente di sottacere | `sottacere` | 111329 /forms/5/form |
| 625604 | `rabbiosi` | adj | 0 | plurale di rabbioso | `rabbioso` | 438189 /forms/0/form |
| 625785 | `devio` | verb | 0 | prima persona persona singolare dell'indicativo presente di deviare | `deviare` | 135676 /forms/4/form |
| 625853 | `imprevidenti` | adj | 0 | plurale di imprevidente | `imprevidente` | 585258 /forms/0/form |
| 625854 | `imprevidenti` | noun | 0 | plurale di imprevidente | `imprevidente` | 585258 /forms/0/form |
| 626823 | `mangiatori` | noun | 0 | plurale di mangiatore | `mangiatore` | 500246 /forms/0/form |
| 627259 | `assalitrice` | adj | 0 | femminile di assalitore | `assalitore` | 432932 /forms/1/form |
| 627260 | `assalitrice` | noun | 0 | femminile di assalitore | `assalitore` | 432932 /forms/1/form |
| 627291 | `gerosolimitana` | adj | 0 | femminile di gerosolimitano | `gerosolimitano` | 127849 /forms/1/form |
| 627292 | `gerosolimitana` | noun | 0 | femminile di gerosolimitano | `gerosolimitano` | 127849 /forms/1/form |
| 627573 | `fletti` | verb | 1 | seconda persona singolare dell'imperativo presente di flettere | `flettere` | 48478 /forms/6/form |
| 627589 | `farmacologa` | noun | 0 | femminile di farmacologo | `farmacologo` | 405151 /forms/1/form |
| 627594 | `espungi` | verb | 1 | seconda persona singolare dell'imperativo presente di espungere | `espungere` | 106158 /forms/5/form |
| 627625 | `tigliosa` | adj | 0 | femminile di tiglioso | `tiglioso` | 627619 /forms/1/form |
| 627626 | `tigliosi` | adj | 0 | plurale di tiglioso | `tiglioso` | 627619 /forms/0/form |
| 627627 | `tigliose` | adj | 0 | femminile plurale di tiglioso | `tiglioso` | 627619 /forms/2/form |
| 632430 | `riscuoti` | verb | 1 | seconda persona singolare dell'imperativo presente di riscuotere | `riscuotere` | 134241 /forms/5/form |
| 632434 | `malfidi` | adj | 0 | plurale di malfido | `malfido` | 454080 /forms/0/form |
| 632435 | `malfida` | adj | 0 | femminile di malfido | `malfido` | 454080 /forms/1/form |
| 632436 | `malfide` | adj | 0 | femminile plurale di malfido | `malfido` | 454080 /forms/2/form |
| 660874 | `dismossioni` | noun | 0 | Plurale di dismossione. | `dismossione` | 654129 /forms/0/form |
| 683904 | `forche` | noun | 0 | plurale di forca | `forca` | 135673 /forms/0/form |
| 731653 | `veliche` | adj | 0 | femminile plurale di velico | `velico` | 731683 /forms/2/form |
| 798262 | `tensive` | adj | 0 | femminile plurale di tensivo | `tensivo` | 798260 /forms/2/form |

## Senses left alone

| Line | Word | POS | Sense | Gloss | Edge | Reason |
|---|---|---|---|---|---|---|
| 9 | `informatica` | noun | 0 | femminile di informatico, studiosa di informatica | `studiosa` | `edge-names-another-word` |
| 392 | `oats` | noun | 0 | plurale di oat |  | `not-italian` |
| 577 | `albanese` | noun | 0 | persona di nazionalità albanese (e per estensione chi ha origini albanesi) |  | `base-table-does-not-list` |
| 920 | `Junge` | noun | 0 | persona di sesso femminile che è (relativamente) giovane, non vecchia |  | `not-italian` |
| 2124 | `addensante` | noun | 0 | sostanza che si aggiunge con lo scopo di addensare |  | `not-a-form-gloss` |
| 2708 | `complimento` | verb | 0 | prima persona singolare dell'indicativo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 4614 | `abasing` | verb | 0 | participio presente di abase. |  | `not-italian` |
| 4709 | `abortive` | adj | 0 | femminile di abortif |  | `not-italian` |
| 4783 | `academics` | noun | 0 | plurale di academic |  | `not-italian` |
| 4942 | `acquainted` | verb | 0 | participio passato di to acquaint |  | `not-italian` |
| 5700 | `arbitrate` | verb | 1 | imperativo presente, seconda persona plurale di arbitrare |  | `not-a-form-gloss` |
| 6321 | `helps` | noun | 0 | plurale di help |  | `not-italian` |
| 6576 | `horses` | noun | 0 | plurale di horse |  | `not-italian` |
| 6809 | `dies` | noun | 0 | plurale di die |  | `not-italian` |
| 7683 | `lance` | noun | 1 | lancia, lanciere, soldato armato di lancia |  | `not-italian` |
| 8225 | `riuscita` | verb | 0 | participio passato femminile di riuscire |  | `base-table-does-not-list` |
| 8455 | `avventuriere` | noun | 0 | variante di avventuriero |  | `not-a-form-gloss` |
| 9259 | `clamors` | noun | 0 | plurale di clamor |  | `not-italian` |
| 9352 | `clones` | noun | 0 | plurale di clone |  | `not-italian` |
| 9354 | `clones` | noun | 0 | plurale di clone |  | `not-italian` |
| 9460 | `combats` | noun | 0 | plurale di combat |  | `not-italian` |
| 9870 | `costs` | noun | 0 | plurale di cost |  | `not-italian` |
| 11064 | `families` | noun | 0 | plurale di family |  | `not-italian` |
| 11283 | `flies` | noun | 0 | plurale di fly |  | `not-italian` |
| 11358 | `folks` | noun | 0 | plurale di folk |  | `not-italian` |
| 12098 | `lions` | noun | 0 | plurale di lion |  | `not-italian` |
| 12137 | `lives` | noun | 0 | plurale di life |  | `not-italian` |
| 12221 | `loops` | noun | 0 | plurale di loop |  | `not-italian` |
| 12321 | `lying` | verb | 0 | participio presente di lie |  | `not-italian` |
| 12327 | `lyrics` | noun | 1 | plurale di lyric |  | `not-italian` |
| 12461 | `malts` | noun | 0 | Plurale di malt |  | `not-italian` |
| 12650 | `mechanics` | noun | 0 | Plurale di mechanic, meccanici |  | `not-italian` |
| 12736 | `millimetres` | noun | 0 | plurale di millimetre |  | `not-italian` |
| 12768 | `mishmashes` | noun | 0 | plurale di mishmash |  | `not-italian` |
| 12809 | `modulate` | verb | 0 | participio passato plurale femminile di modulare |  | `not-italian` |
| 12809 | `modulate` | verb | 1 | seconda persona plurale dell'indicativo presente di modulare |  | `not-italian` |
| 12809 | `modulate` | verb | 2 | seconda persona plurale dell'imperativo presente di modulare |  | `not-italian` |
| 13388 | `agiti` | noun | 0 | plurale di agita |  | `not-italian` |
| 13416 | `aiti` | noun | 0 | plurale di aita |  | `not-italian` |
| 13559 | `ammozzi` | noun | 0 | plurale di ammozzu |  | `not-italian` |
| 13938 | `ascari` | noun | 0 | variante di ascaro |  | `not-a-form-gloss` |
| 14834 | `caparruni` | noun | 0 | persona di mal affare |  | `not-italian` |
| 15033 | `carnera` | noun | 0 | persona di grande forza e dal fisico imponente. |  | `base-table-does-not-list` |
| 15297 | `chica` | noun | 0 | femminile di chico, ragazza |  | `not-italian` |
| 15962 | `foto aeree` | phrase | 0 | plurale di foto aerea |  | `base-table-does-not-list` |
| 15984 | `ciosa` | adj | 0 | femminile di cioso |  | `not-italian` |
| 16224 | `sacerdote` | noun | 5 | variante di sacerdotessa |  | `not-a-form-gloss` |
| 17089 | `rose` | verb | 0 | rosare, colorare di rosa |  | `not-italian` |
| 17641 | `tappo` | noun | 1 | persona di bassa statura |  | `base-table-does-not-list` |
| 17714 | `noce` | noun | 0 | plurale di noc |  | `not-italian` |
| 17769 | `scomunica` | verb | 0 | terza persona singolare dell'indicativo presente di scomunicare |  | `base-table-does-not-list` |
| 17769 | `scomunica` | verb | 1 | seconda persona singolare dell'imperativo presente di scomunicare |  | `base-table-does-not-list` |
| 18168 | `benedicente` | adj | 0 | attributo araldico che si applica alla mano in atto di benedire; con tre dita alzate ed è la benedizione di rito latino; quella greca ha tutte le dita levate e si toccano il pollice e l'anulare |  | `not-a-form-gloss` |
| 19346 | `neurotics` | noun | 0 | plurale di neurotic |  | `not-italian` |
| 19411 | `noodles` | noun | 0 | plurale di noodle |  | `not-italian` |
| 19428 | `noses` | noun | 0 | plurale di nose |  | `not-italian` |
| 19529 | `oars` | noun | 0 | plurale di oar |  | `not-italian` |
| 19535 | `oaths` | noun | 0 | plurale di oath |  | `not-italian` |
| 19555 | `objectors` | noun | 0 | plurale di objector |  | `not-italian` |
| 19556 | `objects` | noun | 0 | plurale di object |  | `not-italian` |
| 19654 | `occurrences` | noun | 0 | plurale di occurrence |  | `not-italian` |
| 19656 | `oceans` | noun | 0 | plurale di ocean |  | `not-italian` |
| 19673 | `odors` | noun | 0 | plurale di odor |  | `not-italian` |
| 19695 | `offers` | noun | 0 | plurale di offer |  | `not-italian` |
| 19701 | `officers` | noun | 0 | plurale di officer |  | `not-italian` |
| 19718 | `okays` | noun | 0 | plurale di okay |  | `not-italian` |
| 19723 | `oleanders` | noun | 0 | plurale di oleander |  | `not-italian` |
| 19794 | `openers` | noun | 0 | plurale di opener |  | `not-italian` |
| 19799 | `opens` | noun | 0 | plurale di open |  | `not-italian` |
| 19844 | `oppressors` | noun | 0 | plurale di oppressor |  | `not-italian` |
| 19856 | `opticians` | noun | 0 | plurale di optician |  | `not-italian` |
| 19863 | `options` | noun | 0 | plurale di option |  | `not-italian` |
| 19897 | `orbs` | noun | 0 | plurale di orb |  | `not-italian` |
| 19919 | `organs` | noun | 0 | plurale di organ |  | `not-italian` |
| 19944 | `orthodontists` | noun | 0 | plurale di orthodontist |  | `not-italian` |
| 19960 | `others` | noun | 0 | plurale di other |  | `not-italian` |
| 20000 | `outlines` | noun | 0 | plurale di outline, contorni |  | `not-italian` |
| 20021 | `outs` | noun | 0 | plurale di out |  | `not-italian` |
| 20148 | `paddies` | noun | 0 | plurale di paddy |  | `not-italian` |
| 20183 | `palliatives` | noun | 0 | plurale di palliative |  | `not-italian` |
| 20222 | `paradises` | noun | 0 | plurale di paradise |  | `not-italian` |
| 20225 | `paragons` | noun | 0 | plurale di paragon |  | `not-italian` |
| 20238 | `parcels` | noun | 0 | plurale di parcel |  | `not-italian` |
| 20317 | `pathfinders` | noun | 0 | plurale di pathfinder |  | `not-italian` |
| 20409 | `perils` | noun | 0 | plurale di peril |  | `not-italian` |
| 20453 | `phaseouts` | noun | 0 | plurale di phaseout |  | `not-italian` |
| 20509 | `pillars` | noun | 0 | plurale di pillar |  | `not-italian` |
| 20682 | `posses` | noun | 0 | plurale di posse |  | `not-italian` |
| 20944 | `quavers` | noun | 0 | plurale di quaver |  | `not-italian` |
| 21525 | `roosts` | noun | 0 | plurale di roost |  | `not-italian` |
| 21567 | `rues` | noun | 0 | plurale di rue |  | `not-italian` |
| 21759 | `saws` | noun | 0 | plurale di saw |  | `not-italian` |
| 21814 | `schools` | noun | 0 | plurale di school |  | `not-italian` |
| 22193 | `skins` | noun | 0 | plurale di skin, pelli |  | `not-italian` |
| 22302 | `smells` | noun | 0 | plurale di smell |  | `not-italian` |
| 22352 | `snow chains` | phrase | 0 | plurale di snow chain, catene da neve |  | `not-italian` |
| 22546 | `spring` | verb | 1 | prima persona singolare presente di springen |  | `not-italian` |
| 22590 | `state` | verb | 2 | seconda persona plurale (voi) del presente dell indicativo di stare |  | `not-a-form-gloss` |
| 22590 | `state` | verb | 3 | seconda persona plurale (voi) de l'imperativo di stare |  | `not-a-form-gloss` |
| 23024 | `those` | adj | 0 | plurale di that: quelli, quelle |  | `not-italian` |
| 23025 | `those` | pron | 0 | plurale di that |  | `not-italian` |
| 23033 | `thoughts` | noun | 0 | plurale di thought |  | `not-italian` |
| 23071 | `thrusts` | noun | 0 | plurale di thrust, spinte |  | `not-italian` |
| 23122 | `times` | noun | 0 | plurale di time |  | `not-italian` |
| 23924 | `wells` | noun | 0 | plurale di well, pozzi |  | `not-italian` |
| 23925 | `welters` | noun | 0 | plurale di welter |  | `not-italian` |
| 23927 | `wenches` | noun | 0 | plurale di wench |  | `not-italian` |
| 23964 | `whirlpools` | noun | 0 | plurale di whirlpool |  | `not-italian` |
| 24014 | `wins` | noun | 0 | plurale di win |  | `not-italian` |
| 24027 | `wit` | noun | 1 | persona di spirito, persona arguta, bello spirito |  | `not-italian` |
| 24047 | `wolves` | noun | 0 | plurale di wolf |  | `not-italian` |
| 24049 | `women` | noun | 0 | plurale di woman, donne |  | `not-italian` |
| 24057 | `woods` | noun | 0 | plurale di wood |  | `not-italian` |
| 24066 | `words` | noun | 0 | plurale di word |  | `not-italian` |
| 24135 | `yaps` | noun | 0 | plurale di yap |  | `not-italian` |
| 24141 | `yards` | noun | 0 | plurale di yard |  | `not-italian` |
| 24144 | `yarns` | noun | 0 | plurale di yarn |  | `not-italian` |
| 24148 | `yawns` | noun | 0 | plurale di yawn |  | `not-italian` |
| 24149 | `yclept` | verb | 0 | participio passato di clepe |  | `not-italian` |
| 24178 | `yells` | noun | 0 | plurale di yell |  | `not-italian` |
| 24226 | `zoological gardens` | noun | 0 | plurale di zoological garden |  | `not-italian` |
| 24449 | `Afkaten` | noun | 0 | plurale di Afkat |  | `not-italian` |
| 24487 | `annere` | adj | 0 | plurale di anner |  | `not-italian` |
| 24554 | `Beester` | noun | 0 | plurale di Beest, bestie |  | `not-italian` |
| 24728 | `Dische` | noun | 0 | plurale di Disch, tavoli |  | `not-italian` |
| 24820 | `Erfohrungen` | noun | 0 | plurale di Erfohrung |  | `not-italian` |
| 24862 | `Fleiten` | noun | 0 | plurale di Fleit |  | `not-italian` |
| 25070 | `Kinner` | noun | 0 | plurale di Kind |  | `not-italian` |
| 25071 | `Kinner` | noun | 0 | plurale di Kind |  | `not-italian` |
| 25116 | `Korten` | noun | 0 | plurale di Kort |  | `not-italian` |
| 25139 | `Langhoorden` | noun | 0 | plurale di Langhoorde |  | `not-italian` |
| 25160 | `Lodens` | noun | 0 | plurale di Loden |  | `not-italian` |
| 25411 | `Swestern` | noun | 0 | plurale di Swesser |  | `not-italian` |
| 25419 | `Swolken` | noun | 0 | plurale di Swolk |  | `not-italian` |
| 25431 | `Tieden` | noun | 0 | plurale di Tied |  | `not-italian` |
| 25444 | `Tohlen` | noun | 0 | plurale di Tohl |  | `not-italian` |
| 25536 | `Wettloopen` | noun | 0 | plurale di Wettloop |  | `not-italian` |
| 25557 | `Wischen` | noun | 0 | plurale di Wisch |  | `not-italian` |
| 25610 | `Abarten` | noun | 0 | plurale di Abart |  | `not-italian` |
| 25629 | `Abbildungen` | noun | 0 | plurale di Abbildung |  | `not-italian` |
| 26368 | `bestanden` | noun | 0 | plurale di bestand |  | `not-italian` |
| 26520 | `Bilder` | noun | 0 | plurale di Bild, quadri, dipinti, immagini, effigi, ritratti |  | `not-italian` |
| 26547 | `Biochemikerin` | noun | 0 | femminile di Biochemiker |  | `not-italian` |
| 26964 | `Abenteuerin` | noun | 0 | femminile di Abenteurer |  | `not-italian` |
| 27110 | `abgemachten` | adj | 0 | plurale di abgemacht, pattuiti, concordati |  | `not-italian` |
| 27582 | `Abwege` | noun | 0 | plurale di Abweg |  | `not-italian` |
| 27587 | `re` | noun | 0 | persona di sesso maschile al comando di una monarchia |  | `base-table-does-not-list` |
| 27707 | `juorne` | noun | 0 | plurale di juorno |  | `not-italian` |
| 28913 | `imo` | noun | 1 | persona di bassa situazione sociale |  | `base-table-does-not-list` |
| 29412 | `Achterdöören` | noun | 0 | plurale di Achterdöör |  | `not-italian` |
| 29414 | `Akschonen` | noun | 0 | plurale di Akschoon |  | `not-italian` |
| 29418 | `Amerikaners` | noun | 0 | plurale di Amerikaner |  | `not-italian` |
| 29673 | `Algerierin` | noun | 0 | femminile di Algerier |  | `not-italian` |
| 29801 | `Alternativen` | noun | 0 | plurale di Alternative |  | `not-italian` |
| 29836 | `Altertümer` | noun | 0 | plurale di Altertum |  | `not-italian` |
| 30085 | `Angelegenheiten` | noun | 0 | plurale di Angelegenheit |  | `not-italian` |
| 30425 | `bestia` | noun | 2 | persona di bassi istinti |  | `not-italian` |
| 30561 | `Andrea` | name | 0 | femminile di Andrés |  | `not-italian` |
| 30807 | `hvalir` | noun | 0 | plurale di hvalur |  | `not-italian` |
| 31255 | `ubriacone` | noun | 1 | femminile plurale di ubriacone |  | `names-itself` |
| 31624 | `corrente` | adj | 1 | attributo degli animali raffigurati nell'atto di correre |  | `not-a-form-gloss` |
| 31763 | `celibe` | noun | 0 | persona di sesso femminile che non è maritata; nubile |  | `base-table-does-not-list` |
| 31981 | `chimico` | noun | 0 | studioso di chimica |  | `not-a-form-gloss` |
| 32557 | `enigma` | noun | 2 | persona di cui sono difficili da capirsi gli atti e gli scopi |  | `base-table-does-not-list` |
| 32814 | `vestiti` | verb | 0 | participio passato plurale di vestire |  | `base-table-does-not-list` |
| 33247 | `bene` | noun | 0 | plurale di been |  | `not-italian` |
| 33316 | `scusa` | noun | 0 | l'atto di scusare o di scusarsi |  | `not-a-form-gloss` |
| 33621 | `abbasso` | adv | 1 | ordine di abbassare, o scendere giù |  | `not-a-form-gloss` |
| 33777 | `allampanato` | adj | 0 | persona di corporatura magrissima o secca e molto alta |  | `base-table-does-not-list` |
| 34009 | `gigante` | noun | 1 | persona di statura notevolmente al di sopra della media |  | `base-table-does-not-list` |
| 34206 | `svestito` | verb | 0 | participio passato di svestire, svestirsi | `svestirsi` | `edge-names-another-word` |
| 36281 | `Davidia` | name | 0 | femminile di Davide |  | `base-table-does-not-list` |
| 37573 | `mostro` | noun | 2 | persona di talento |  | `base-table-does-not-list` |
| 37929 | `foresto` | noun | 1 | persona di un altro Paese |  | `not-italian` |
| 38671 | `sbornia` | verb | 1 | seconda persona singolare dell'imperativo presente di sborniare |  | `no-record-of-base` |
| 39529 | `stampante` | verb | 0 | participio presente singolare di stampare |  | `base-table-does-not-list` |
| 39547 | `uso` | noun | 0 | l'atto di usare |  | `not-a-form-gloss` |
| 39549 | `utilizzo` | noun | 0 | l'atto di utilizzare |  | `not-a-form-gloss` |
| 39598 | `punkettone` | noun | 1 | Plurale femminile di punkettone |  | `names-itself` |
| 39696 | `Dame` | noun | 0 | persona di sesso femminile che ha un aspetto ben curato, contegno coltivato ed educazione; signora |  | `not-italian` |
| 40109 | `gnocca` | adj | 0 | femminile di gnocco, molto attraente | `attraente` | `edge-names-another-word` |
| 40566 | `politico` | noun | 0 | esperto di politica |  | `not-a-form-gloss` |
| 40566 | `politico` | noun | 1 | chi si occupa di politica per professione |  | `not-a-form-gloss` |
| 40584 | `dinosauro` | noun | 1 | persona di grande prestigio e stima, ma avente idee antiquate, non al passo con i tempi |  | `base-table-does-not-list` |
| 40584 | `dinosauro` | noun | 2 | persona di eccessiva longevità istituzionale |  | `base-table-does-not-list` |
| 40746 | `maglierista` | noun | 0 | femminile singolare di maglierista |  | `names-itself` |
| 41313 | `surici` | noun | 0 | plurale di sorece |  | `not-italian` |
| 41348 | `porta` | verb | 1 | terza persona singolare di portare dell'indicativo presente di portare | `presente` | `edge-names-another-word` |
| 41348 | `porta` | verb | 2 | seconda persona singolare di portare imperativo presente di portare | `presente` | `edge-names-another-word` |
| 41473 | `posa` | noun | 0 | gesto di posare |  | `not-a-form-gloss` |
| 41781 | `pulicari` | noun | 0 | plurale di pulicara |  | `not-italian` |
| 41807 | `pivello` | noun | 0 | persona di poco conto o inesperta |  | `base-table-does-not-list` |
| 41937 | `banane` | noun | 0 | plurale di banană |  | `not-italian` |
| 42264 | `mele` | noun | 0 | plurale di mela nel senso di frutto del melo o di frutto in generale; vedi mela | `melo` | `edge-names-another-word` |
| 42372 | `perso` | verb | 0 | participio passato maschile singolare di perdere, perdersi | `perdersi` | `edge-names-another-word` |
| 42850 | `morti` | verb | 0 | participio passato plurale di morire |  | `base-table-does-not-list` |
| 43227 | `cazzare` | noun | 0 | plurale di cazzara, vedi cazzaro | `cazzaro` | `edge-names-another-word` |
| 43442 | `novizza` | noun | 0 | femminile di novizzo |  | `not-italian` |
| 43448 | `sposo` | verb | 0 | prima persona singolare dellindicativo presente di sposare |  | `not-a-form-gloss` |
| 43460 | `disegno` | noun | 2 | modo di disegnare |  | `not-a-form-gloss` |
| 43490 | `gioco` | noun | 3 | modo di giocare, nello sport o in una competizione in cui si punta denaro |  | `not-a-form-gloss` |
| 43816 | `cola` | noun | 0 | plurale di colon |  | `not-italian` |
| 44365 | `diti` | noun | 0 | plurale di dito, se riferito a dita dello stesso tipo | `tipo` | `edge-names-another-word` |
| 45284 | `consacrato` | verb | 0 | participio passato di consacrare, consacrarsi | `consacrarsi` | `edge-names-another-word` |
| 45426 | `fratello` | noun | 0 | persona di sesso maschile legata ad un'altra dal fatto di essere figlio (naturalmente o giuridicamente) di uno o di entrambi i genitori |  | `base-table-does-not-list` |
| 45482 | `svolta` | noun | 0 | l'azione di svoltare |  | `not-a-form-gloss` |
| 45574 | `vela` | noun | 0 | plurale di velum |  | `not-italian` |
| 45964 | `incubi` | verb | 1 | prima persona singolare del congiuntivo presente di incubare |  | `no-record-of-base` |
| 45964 | `incubi` | verb | 2 | seconda persona singolare del congiuntivo presente di incubare |  | `no-record-of-base` |
| 45964 | `incubi` | verb | 3 | terza persona singolare del congiuntivo presente di incubare |  | `no-record-of-base` |
| 45964 | `incubi` | verb | 4 | terza persona singolare dell'imperativo presente di incubare |  | `no-record-of-base` |
| 45999 | `ridanciano` | noun | 0 | persona di cui pare sia nota la facilità nell'affrontare la vita con spirito ed allegria |  | `base-table-does-not-list` |
| 46283 | `complimenti` | verb | 0 | seconda persona singolare dell'indicativo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 46283 | `complimenti` | verb | 1 | prima persona singolare del congiuntivo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 46283 | `complimenti` | verb | 2 | seconda persona singolare del congiuntivo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 46283 | `complimenti` | verb | 3 | terza persona singolare del congiuntivo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 46283 | `complimenti` | verb | 4 | terza persona singolare dell'imperativo di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 47279 | `affetto` | noun | 0 | plurale di affetto |  | `names-itself` |
| 47305 | `agitato` | verb | 0 | participio passato di agitare, agitarsi | `agitarsi` | `edge-names-another-word` |
| 47365 | `alessandrina` | adj | 0 | femminile di alessandrino |  | `base-table-does-not-list` |
| 47516 | `animo` | verb | 0 | prima persona singolare presente di animar |  | `not-italian` |
| 47518 | `anni` | noun | 0 | plurale di anno. |  | `not-italian` |
| 47540 | `anticipo` | noun | 0 | l'atto di anticipare il tempo di qualcosa seguito da complemento di specificazione |  | `not-a-form-gloss` |
| 47611 | `armadio` | noun | 2 | persona di corporatura robusta |  | `base-table-does-not-list` |
| 47691 | `assaggio` | noun | 0 | l'azione di assaggiare vivande o bevande |  | `not-a-form-gloss` |
| 47709 | `asta` | adj | 0 | femminile singolare di ăsta |  | `not-italian` |
| 47887 | `bara` | noun | 0 | femminile di baro |  | `base-table-does-not-list` |
| 47962 | `biochimico` | noun | 0 | studioso di biochimica |  | `not-a-form-gloss` |
| 48009 | `bracconiere` | noun | 0 | femminile plurale di bracconiere |  | `names-itself` |
| 48037 | `buttata` | verb | 0 | participio passato di buttare |  | `base-table-does-not-list` |
| 48142 | `cappuccini` | noun | 0 | plurale di cappuccinu |  | `not-italian` |
| 48146 | `capre` | noun | 0 | plurale di capră |  | `not-italian` |
| 48231 | `celle` | adj | 0 | femminile di celui |  | `not-italian` |
| 48267 | `chele` | noun | 0 | variante di chela |  | `not-a-form-gloss` |
| 48270 | `chiamata` | verb | 0 | participio passato femminile di chiamare |  | `base-table-does-not-list` |
| 48314 | `cibi` | noun | 0 | plurale di cibu |  | `not-italian` |
| 48368 | `elogiare` | verb | 0 | prima persona singolare congiuntivo futuro di elogiar |  | `not-italian` |
| 48368 | `elogiare` | verb | 1 | terza persona singolare congiuntivo futuro di elogiar |  | `not-italian` |
| 48739 | `mondare` | verb | 0 | prima persona singolare del congiuntivo futuro di mondar |  | `not-italian` |
| 48739 | `mondare` | verb | 1 | terza persona singolare del congiuntivo futuro di mondar |  | `not-italian` |
| 48776 | `condannata` | verb | 0 | participio passato di condannare. |  | `base-table-does-not-list` |
| 48781 | `condotto` | verb | 0 | participio passato maschile di condurre, condursi | `condursi` | `edge-names-another-word` |
| 48812 | `coniugata` | verb | 0 | participio passato femminile di coniugare |  | `base-table-does-not-list` |
| 48824 | `consegnato` | verb | 0 | participio passato di consegnare, consegnarsi | `consegnarsi` | `edge-names-another-word` |
| 48993 | `precipitare` | verb | 0 | prima persona singolare congiuntivo futuro di precipitar |  | `not-italian` |
| 48993 | `precipitare` | verb | 1 | terza persona singolare congiuntivo futuro di precipitar |  | `not-italian` |
| 49062 | `cucito` | noun | 1 | arte di cucire |  | `not-a-form-gloss` |
| 49157 | `decima` | verb | 1 | seconda persona singolare del imperativo di decimare | `imperativo` | `edge-names-another-word` |
| 49818 | `fisico` | noun | 1 | studioso di fisica |  | `not-a-form-gloss` |
| 49965 | `fusa` | noun | 0 | plurale arcaico di fuso |  | `not-a-form-gloss` |
| 49995 | `gemello` | verb | 0 | prima persona singolare dell'indicativo presente di gemellare |  | `base-table-does-not-list` |
| 50068 | `grana` | noun | 0 | plurale di granum |  | `not-italian` |
| 50075 | `greca` | noun | 0 | femminile di greco (donne nate in Grecia) | `Grecia` | `edge-names-another-word` |
| 50096 | `guida` | noun | 1 | tutte le indicazioni e gli insegnamenti che consentono di guidare |  | `not-a-form-gloss` |
| 50281 | `imposta` | verb | 1 | seconda persona singolare dell' imperativo di impostare | `imperativo` | `edge-names-another-word` |
| 50285 | `impostore` | noun | 0 | femminile plurale di impostore |  | `names-itself` |
| 50469 | `infante` | adj | 0 | persona di età compresa tra la nascita e l'adolescenza |  | `base-table-does-not-list` |
| 50758 | `invio` | noun | 0 | l'azione di inviare qualcosa o qualcuno |  | `not-a-form-gloss` |
| 50846 | `allarmato` | verb | 0 | participio passato di allarmare, allarmarsi | `allarmarsi` | `edge-names-another-word` |
| 50909 | `aritmetico` | noun | 0 | studioso di aritmetica |  | `not-a-form-gloss` |
| 50944 | `attribuito` | verb | 0 | participio passato di attribuire, attribuirsi | `attribuirsi` | `edge-names-another-word` |
| 51030 | `comodo` | verb | 0 | prima persona singolare dell'indicativo presente di comodare |  | `no-record-of-base` |
| 51153 | `conteso` | verb | 0 | participio passato di contendere, contendersi | `contendersi` | `edge-names-another-word` |
| 51193 | `corrotto` | verb | 0 | participio passato maschile di corrompere, corrompersi | `corrompersi` | `edge-names-another-word` |
| 51273 | `linea` | verb | 1 | seconda persona singolare dell'imperativo di lineare |  | `base-table-does-not-list` |
| 51615 | `matematico` | noun | 0 | studioso di matematica |  | `not-a-form-gloss` |
| 51695 | `meraviglia` | verb | 1 | seconda persona singolare dell' imperativo di meravigliare |  | `base-table-does-not-list` |
| 51731 | `metafisico` | noun | 0 | chi si occupa di metafisica |  | `not-a-form-gloss` |
| 51769 | `migliore` | adj | 0 | comparativo di buono |  | `not-a-form-gloss` |
| 51788 | `mina` | pron | 0 | plurale di min |  | `not-italian` |
| 51870 | `monte` | noun | 0 | plurale di monta |  | `base-table-does-not-list` |
| 51906 | `nana` | adj | 0 | femminile di nano |  | `base-table-does-not-list` |
| 51907 | `nana` | noun | 0 | femminile di nano |  | `base-table-does-not-list` |
| 51988 | `nomi` | noun | 0 | plurale di nomu |  | `not-italian` |
| 52238 | `perdono` | verb | 0 | prima persona singolare di perdonar nel presente indicativo. |  | `not-italian` |
| 52270 | `pettinata` | verb | 0 | participio passato femminile di pettinare |  | `base-table-does-not-list` |
| 52273 | `piana` | adj | 0 | femminile di piano |  | `base-table-does-not-list` |
| 52547 | `proclama` | verb | 1 | seconda persona singolare dell' imperativo di proclamare | `imperativo` | `edge-names-another-word` |
| 52563 | `profano` | verb | 0 | prima persona singolare indicativo presente di profanar |  | `not-italian` |
| 52916 | `revoca` | noun | 0 | l'atto di revocare qualcosa o qualcuno, effettuare un definitivo annullamento di qualcosa |  | `not-a-form-gloss` |
| 53038 | `rimprovero` | noun | 0 | l'atto del rimproverare, e in particolare discorso fatto allo scopo di rimproverare qualcuno |  | `not-a-form-gloss` |
| 53157 | `romana` | adj | 0 | femminile di romano |  | `not-italian` |
| 53158 | `romana` | noun | 0 | femminile di romano |  | `not-italian` |
| 53189 | `runa` | noun | 0 | plurale di run |  | `not-italian` |
| 53280 | `santi` | noun | 0 | plurale di santa |  | `not-italian` |
| 53280 | `santi` | noun | 1 | plurale di santu |  | `not-italian` |
| 53293 | `scadenza` | verb | 1 | seconda persona singolare dell'imperativo di scadenzare |  | `no-record-of-base` |
| 53362 | `illuminante` | adj | 0 | che è in grado di illuminare |  | `not-a-form-gloss` |
| 53484 | `inaffidabile` | adj | 0 | persona di cui non ci si può fidare |  | `base-table-does-not-list` |
| 53510 | `incentivante` | adj | 0 | in grado di incentivare |  | `not-a-form-gloss` |
| 53859 | `istruito` | verb | 0 | participio passato maschile singolare di istruire, istruirsi | `istruirsi` | `edge-names-another-word` |
| 53950 | `scoperta` | verb | 0 | participio passato femminile di scoprire |  | `base-table-does-not-list` |
| 54063 | `siciliana` | adj | 0 | Femminile di sicilianu. |  | `not-italian` |
| 54153 | `somma` | verb | 1 | seconda-persona singolare dell'imperativo di sommare |  | `not-a-form-gloss` |
| 54165 | `sorella` | noun | 0 | persona di sesso femminile legata collateralmente ad un'altra, appartenente allo stesso nucleo familiare, dal fatto di essere figlia (naturale o giuridica) di uno o di entrambi i genitori |  | `base-table-does-not-list` |
| 54184 | `sostituto` | noun | 1 | participio passato di sostituire |  | `base-table-does-not-list` |
| 54198 | `sparata` | verb | 0 | participio passato femminile di sparare |  | `base-table-does-not-list` |
| 54598 | `nutrito` | verb | 0 | participio passato di nutrire, nutrirsi | `nutrirsi` | `edge-names-another-word` |
| 54618 | `tempesta` | verb | 1 | seconda persona singolare imperativo di tempestare | `imperativo` | `edge-names-another-word` |
| 54814 | `preciso` | verb | 0 | prima persona singolare dell'indicativo presente di precisare |  | `not-italian` |
| 54831 | `preso` | verb | 0 | participio passato singolare maschile di prendere, prendersi | `prendersi` | `edge-names-another-word` |
| 54856 | `profumato` | verb | 0 | participio passato maschile singolare di profumare, profumarsi | `profumarsi` | `edge-names-another-word` |
| 54873 | `provinciale` | noun | 0 | persona di mentalità e abitudini arretrate e rozze |  | `base-table-does-not-list` |
| 54985 | `ritornato` | verb | 0 | participio passato di ritornare, ritornarsi | `ritornarsi` | `edge-names-another-word` |
| 55108 | `torta` | adj | 0 | femminile di torto |  | `not-italian` |
| 55120 | `toscana` | noun | 0 | persona di sesso femminile o cosa relativa alla Toscana |  | `base-table-does-not-list` |
| 55133 | `traccia` | verb | 1 | seconda persona singolare, imperativo di tracciare |  | `not-a-form-gloss` |
| 55213 | `trattato` | verb | 0 | participio passato maschile di trattare, trattarsi | `trattarsi` | `edge-names-another-word` |
| 55275 | `trovato` | verb | 0 | participio passato maschile singolare di trovare, trovarsi | `trovarsi` | `edge-names-another-word` |
| 55382 | `sviscerato` | verb | 0 | participio passato maschile singolare di sviscerare, sviscerarsi | `sviscerarsi` | `edge-names-another-word` |
| 55512 | `tollerante` | adj | 0 | che tollera, che ha la capacità di tollerare certe situazioni |  | `not-a-form-gloss` |
| 55520 | `tostato` | verb | 0 | participio passato di tostare, tostarsi | `tostarsi` | `edge-names-another-word` |
| 55559 | `vilipendio` | verb | 0 | prima persona singolare indicativo presente di vilipendiar |  | `not-italian` |
| 55730 | `venduto` | verb | 0 | participio passato di vendere, vendersi | `vendersi` | `edge-names-another-word` |
| 55859 | `zelante` | noun | 1 | persona di rara tenacia, forza intraprendente e vigorosa energia |  | `base-table-does-not-list` |
| 55881 | `abbaglianti` | noun | 0 | plurale di abbagliante, fari più luminosi delle macchine | `macchine` | `edge-names-another-word` |
| 56010 | `allegata` | adj | 0 | femminile singolare di allegato |  | `base-table-does-not-list` |
| 56042 | `alta` | adj | 0 | femminile di alto |  | `not-italian` |
| 56044 | `alta` | adj | 0 | femminile di alto |  | `not-italian` |
| 56165 | `meno` | noun | 0 | plurale di jino |  | `not-italian` |
| 56225 | `appassionati` | verb | 0 | participio passato plurale di appassionare |  | `base-table-does-not-list` |
| 56418 | `battute` | verb | 0 | participio passato plurale femminile di battere |  | `base-table-does-not-list` |
| 56681 | `ceca` | noun | 0 | plurale di cecum |  | `not-italian` |
| 56856 | `colte` | verb | 0 | participio passato plurale femminile di cogliere |  | `base-table-does-not-list` |
| 57031 | `congiunte` | verb | 0 | participio passato plurale femminile di congiungere |  | `base-table-does-not-list` |
| 57329 | `toma` | verb | 0 | terza persona singolare dell'indicativo presente di tomar |  | `not-italian` |
| 57516 | `dinastici` | adj | 0 | plurale di dinastico |  | `base-table-does-not-list` |
| 57603 | `dovuta` | verb | 0 | participio passato femminile di dovere |  | `base-table-does-not-list` |
| 57660 | `effettuata` | verb | 0 | participio passato femminile di effettuare |  | `base-table-does-not-list` |
| 57800 | `eseguiti` | verb | 0 | participio passato plurale di eseguire |  | `base-table-does-not-list` |
| 57816 | `espressa` | verb | 0 | participio passato femminile di esprimere |  | `base-table-does-not-list` |
| 58127 | `giustificata` | verb | 0 | participio passato femminile di giustificare |  | `base-table-does-not-list` |
| 58172 | `grosse` | adj | 0 | femminile di gros |  | `not-italian` |
| 58430 | `imprenditoriali` | adj | 0 | plurale di imprenditoriale |  | `base-table-does-not-list` |
| 58999 | `intermedi` | verb | 0 | seconda persona singolare dell'indicativo presente di intermediare |  | `no-record-of-base` |
| 58999 | `intermedi` | verb | 1 | prima persona singolare del congiuntivo presente di intermediare |  | `no-record-of-base` |
| 58999 | `intermedi` | verb | 2 | seconda persona singolare del congiuntivo presente di intermediare |  | `no-record-of-base` |
| 58999 | `intermedi` | verb | 3 | terza persona singolare del congiuntivo presente di intermediare |  | `no-record-of-base` |
| 58999 | `intermedi` | verb | 4 | terza persona singolare dell'imperativo presente di intermediare |  | `no-record-of-base` |
| 59076 | `intuitive` | adj | 0 | femminile di intuitif |  | `not-italian` |
| 59150 | `ipocondriaca` | adj | 0 | Femminile singolare di ipocondriaco. |  | `base-table-does-not-list` |
| 59208 | `irta` | adj | 0 | Femminile singolare di irto. |  | `base-table-does-not-list` |
| 59229 | `ispettiva` | adj | 0 | Femminile singolare di ispettivo. |  | `base-table-does-not-list` |
| 59233 | `ispirattrice` | adj | 0 | Femminile singolare di ispiratore. |  | `base-table-does-not-list` |
| 59242 | `istessa` | adj | 0 | Femminile singolare di istesso. |  | `base-table-does-not-list` |
| 59264 | `iussiva` | adj | 0 | Femminile singolare di iussivo. |  | `base-table-does-not-list` |
| 59357 | `lese` | verb | 0 | participio passato plurale femminile di ledere |  | `base-table-does-not-list` |
| 59357 | `lese` | verb | 1 | terza persona singolare dell'indicativo passato remoto di ledere |  | `base-table-does-not-list` |
| 59395 | `lontana` | verb | 1 | seconda persona singolare dell'imperativo presente di lontanare |  | `no-record-of-base` |
| 59509 | `maiorchina` | adj | 0 | Femminile singolare di maiorchino. |  | `base-table-does-not-list` |
| 59554 | `malcontenta` | adj | 0 | Femminile singolare di malcontento. |  | `base-table-does-not-list` |
| 59690 | `minuta` | noun | 0 | plurale di minutë |  | `not-italian` |
| 59928 | `nuove` | noun | 0 | plurale di nuove |  | `names-itself` |
| 60115 | `ottentotta` | adj | 0 | Femminile singolare di ottentotto. |  | `base-table-does-not-list` |
| 60250 | `perpetui` | verb | 4 | terza persona singolare dell'imperativo presente di perepetuare |  | `no-record-of-base` |
| 60297 | `planetaria` | noun | 0 | plurale di planetarium |  | `not-italian` |
| 60307 | `politicamente corretta` | phrase | 0 | femminile di politicamente corretto |  | `base-table-does-not-list` |
| 60308 | `politicamente corrette` | phrase | 0 | femminile plurale di politicamente corretto |  | `base-table-does-not-list` |
| 60309 | `politicamente corretti` | phrase | 0 | plurale di politicamente corretto |  | `base-table-does-not-list` |
| 60373 | `presi` | verb | 1 | participio passato plurale maschile di prendere | `participio passato` | `edge-names-another-word` |
| 60388 | `preventiva` | verb | 1 | seonda persona singolare dell'imperativo presente di preventivare |  | `not-a-form-gloss` |
| 60415 | `priva di vita` | adj | 0 | Femminile singolare di privo di vita. |  | `base-table-does-not-list` |
| 60638 | `residua` | noun | 0 | plurale di residuum |  | `not-italian` |
| 60688 | `ridotta` | verb | 0 | participio passato femminile di ridurre |  | `base-table-does-not-list` |
| 61777 | `acrobate` | noun | 0 | variante di acrobata |  | `not-a-form-gloss` |
| 61821 | `passatempi` | noun | 0 | plurale di passatempo. |  | `base-table-does-not-list` |
| 61915 | `abbonati` | verb | 1 | participio passato plurale di abbonare |  | `base-table-does-not-list` |
| 62059 | `baxeiti` | noun | 0 | plurale di baxeto e baxin |  | `no-record-of-base` |
| 62097 | `italosomali` | noun | 0 | Plurale di italosomalo. |  | `base-table-does-not-list` |
| 62164 | `ignorantone` | noun | 0 | femminile plurale di ignorantone |  | `names-itself` |
| 62203 | `äpplen` | noun | 0 | plurale di äpple |  | `not-italian` |
| 62204 | `flickor` | noun | 0 | plurale di flicka |  | `not-italian` |
| 62209 | `kor` | noun | 0 | plurale di ko |  | `not-italian` |
| 62214 | `vaser` | noun | 0 | plurale di vas |  | `not-italian` |
| 62215 | `nätter` | noun | 0 | plurale di natt |  | `not-italian` |
| 62216 | `män` | noun | 0 | Plurale di man |  | `not-italian` |
| 62217 | `böcker` | noun | 0 | plurale di bok "(libro)" |  | `not-italian` |
| 62220 | `fötter` | noun | 0 | plurale di fot |  | `not-italian` |
| 62223 | `gäss` | noun | 0 | plurale di gås |  | `not-italian` |
| 62225 | `tänger` | noun | 0 | plurale di tång |  | `not-italian` |
| 62239 | `chatte` | noun | 0 | femminile di chat |  | `not-italian` |
| 62255 | `balcons` | noun | 0 | plurale di balcon |  | `not-italian` |
| 62286 | `fratellastro` | noun | 0 | persona di sesso maschile con un solo genitore in comune con un'altra persona |  | `base-table-does-not-list` |
| 62374 | `polipnee` | noun | 0 | plurale di polipnea |  | `base-table-does-not-list` |
| 62393 | `fortificato` | verb | 0 | participio passato di fortificare, fortificarsi | `fortificarsi` | `edge-names-another-word` |
| 62427 | `producenti` | verb | 0 | participio presente di produrre |  | `base-table-does-not-list` |
| 62452 | `rattrappanti` | adj | 0 | plurale di rattrappante |  | `base-table-does-not-list` |
| 62461 | `ananassen` | noun | 0 | plurale di ananas |  | `not-italian` |
| 62501 | `mačci` | noun | 0 | plurale di mačak, gatti |  | `not-italian` |
| 62502 | `mačke` | noun | 0 | plurale di mačka, gatti, gatte |  | `not-italian` |
| 62503 | `mačke` | noun | 0 | plurale di mačka, gatti, gatte |  | `not-italian` |
| 62547 | `accusations` | noun | 0 | plurale di accusation |  | `not-italian` |
| 62686 | `finnoise` | noun | 0 | femminile di finnois |  | `not-italian` |
| 62687 | `finnoise` | adj | 0 | femminile di finnois |  | `not-italian` |
| 62688 | `fraises` | noun | 0 | plurale di fraise, fragole |  | `not-italian` |
| 62857 | `Fußspuren` | noun | 0 | plurale di Fußspur |  | `not-italian` |
| 62883 | `Geschenke` | noun | 0 | plurale di Geschenk |  | `not-italian` |
| 62896 | `Schallplatten` | noun | 0 | plurale di Schallplatte |  | `not-italian` |
| 62900 | `Granaten` | noun | 0 | plurale di Granate |  | `not-italian` |
| 62912 | `Handbreite` | noun | 0 | plurale di Handbreit |  | `not-italian` |
| 63112 | `baby-teeth` | noun | 0 | plurale di baby-tooth |  | `not-italian` |
| 63113 | `babyteeth` | noun | 0 | plurale di babytooth |  | `not-italian` |
| 63114 | `baby teeth` | noun | 0 | plurale di baby tooth |  | `not-italian` |
| 63123 | `bacilli` | noun | 0 | plurale di bacillus |  | `not-italian` |
| 63394 | `kelkaj` | adj | 0 | plurale di kelka |  | `not-italian` |
| 64286 | `abarrotados` | adj | 0 | plurale di abarrotado |  | `not-italian` |
| 64288 | `abarrotadas` | adj | 0 | plurale di abarrotada, femminile di abarrotados |  | `not-italian` |
| 64290 | `abarrotada` | adj | 0 | femminile di abarrotado |  | `not-italian` |
| 64295 | `abatidos` | adj | 0 | plurale di abatido |  | `not-italian` |
| 64297 | `abatidas` | adj | 0 | plurale di abatida, femminile di abatidos |  | `not-italian` |
| 64298 | `abatida` | adj | 0 | femminile di abatido |  | `not-italian` |
| 64330 | `leccarda` | adj | 0 | femminile di leccardo |  | `base-table-does-not-list` |
| 64501 | `canti` | verb | 1 | prima persona singolare del congiuntivo presente di cantare | `prima` | `edge-names-another-word` |
| 64594 | `abbandonata` | verb | 0 | participio passato femminile di abbandonare |  | `base-table-does-not-list` |
| 64661 | `pileuse` | adj | 0 | femminile di pileux |  | `not-italian` |
| 64667 | `schiaffetti` | noun | 0 | plurale di schiaffetto, diminutivo di schiaffi | `schiaffi` | `edge-names-another-word` |
| 64671 | `schiaffoni` | noun | 0 | plurale di schiaffone, accrescitivo di schiaffi | `schiaffi` | `edge-names-another-word` |
| 64907 | `saldato` | verb | 0 | participio passato maschile singolare di saldare, saldarsi | `saldarsi` | `edge-names-another-word` |
| 64919 | `punte` | adj | 0 | femminile plurale di punto |  | `base-table-does-not-list` |
| 64938 | `battuti` | verb | 0 | participio passato plurale di battere |  | `base-table-does-not-list` |
| 64958 | `semina` | noun | 0 | l'atto o il processo di seminare, cioè di deporre nel terreno i semi per una coltivazione |  | `not-a-form-gloss` |
| 64980 | `numeri negativi` | phrase | 0 | plurale di numero negativo |  | `base-table-does-not-list` |
| 65177 | `आँखें` | noun | 0 | plurale di आँख |  | `not-italian` |
| 65277 | `absuelto` | verb | 0 | participio passato maschile singolare di absolver |  | `not-italian` |
| 65939 | `brode` | noun | 0 | plurale di brood |  | `not-italian` |
| 66129 | `velle` | noun | 0 | plurale di vel |  | `not-italian` |
| 66131 | `nekke` | noun | 0 | plurale di nek |  | `not-italian` |
| 66138 | `wange` | noun | 0 | plurale di wang |  | `not-italian` |
| 66143 | `gewrigte` | noun | 0 | plurale di gewrig |  | `not-italian` |
| 66146 | `polse` | noun | 0 | plurale di pols |  | `not-italian` |
| 66149 | `boude` | noun | 0 | plurale di boud |  | `not-italian` |
| 66152 | `maermerries` | noun | 0 | plurale di maermerrie |  | `not-italian` |
| 66155 | `enkels` | noun | 0 | plurale di enkel |  | `not-italian` |
| 66158 | `skouers` | noun | 0 | plurale di skouer |  | `not-italian` |
| 66160 | `bo-arms` | noun | 0 | plurale di bo-arm |  | `not-italian` |
| 66162 | `elmboë` | noun | 0 | plurale di elmboog |  | `not-italian` |
| 66164 | `voorarms` | noun | 0 | plurale di voorarm |  | `not-italian` |
| 66165 | `hande` | noun | 0 | plurale di hand |  | `not-italian` |
| 66166 | `vingers` | noun | 0 | plurale di vinger |  | `not-italian` |
| 66169 | `duime` | noun | 0 | plurale di duim |  | `not-italian` |
| 66170 | `ribbes` | noun | 0 | plurale di rib |  | `not-italian` |
| 66176 | `knië` | noun | 0 | plurale di knie |  | `not-italian` |
| 66178 | `voete` | noun | 0 | plurale di voet |  | `not-italian` |
| 66587 | `potatoes` | noun | 0 | plurale di potato |  | `not-italian` |
| 66598 | `peas` | noun | 0 | plurale di pea |  | `not-italian` |
| 66603 | `beans` | noun | 0 | plurale di bean |  | `not-italian` |
| 66623 | `onions` | noun | 0 | plurale di onion |  | `not-italian` |
| 67150 | `ruka` | noun | 0 | plurale di ruci |  | `not-italian` |
| 68331 | `Krone` | noun | 0 | plurale di Kron |  | `not-italian` |
| 68514 | `Läden` | noun | 0 | plurale di Laden |  | `not-italian` |
| 68744 | `teens` | noun | 0 | plurale di teen |  | `not-italian` |
| 69057 | `eclissato` | verb | 0 | participio passato di eclissare, eclissarsi | `eclissarsi` | `edge-names-another-word` |
| 69708 | `bruciata` | verb | 0 | participio passato femminile di bruciare |  | `base-table-does-not-list` |
| 69824 | `azzuffato` | verb | 0 | participio passato di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 70293 | `aires` | noun | 0 | plurale di aire, aree. |  | `not-italian` |
| 70759 | `calibres` | noun | 0 | plurale di calibre |  | `not-italian` |
| 71082 | `Redensarten` | noun | 0 | plurale di Redensart |  | `not-italian` |
| 71514 | `amareggiate` | adj | 0 | Femminile plurale di amareggiato, plurale di amareggiata, femminile di amareggiati. | `amareggiati` | `edge-names-another-word` |
| 71584 | `abballottato` | verb | 0 | part. passato di abballottare |  | `not-a-form-gloss` |
| 71690 | `zebras` | noun | 0 | plurale di zebra |  | `not-italian` |
| 71695 | `abbambinato` | verb | 0 | part. passato di abbambinare |  | `not-a-form-gloss` |
| 71697 | `abbancato` | verb | 0 | part. passato di abbancare |  | `not-a-form-gloss` |
| 71704 | `abbarbagliato` | verb | 0 | part. passato di abbarbagliare |  | `not-a-form-gloss` |
| 72114 | `catapulta` | verb | 1 | seconda persona singolare dell'imperativo presente di cataplultare |  | `no-record-of-base` |
| 72361 | `logos` | noun | 0 | Plurale di logo |  | `not-italian` |
| 72362 | `logos` | noun | 0 | plurale di logo |  | `not-italian` |
| 72570 | `Januare` | name | 0 | plurale di Januar |  | `not-italian` |
| 72914 | `abris` | noun | 0 | plurale di abri |  | `not-italian` |
| 72915 | `abris` | noun | 0 | plurale di abril |  | `not-italian` |
| 72923 | `quadrati` | verb | 0 | participio passato plurale di quadrare |  | `base-table-does-not-list` |
| 73600 | `achacosa` | adj | 0 | femminile di achacoso |  | `not-italian` |
| 73605 | `achacosas` | adj | 0 | femminile plurale di achacoso |  | `not-italian` |
| 73607 | `achacosos` | adj | 0 | maschile plurale di achacoso |  | `not-italian` |
| 73659 | `cotillons` | noun | 0 | plurale di cotillon |  | `not-italian` |
| 73873 | `uffici` | verb | 1 | prima persona singolare del congiuntivo presente di ufficiare |  | `no-record-of-base` |
| 73873 | `uffici` | verb | 2 | seconda persona singolare del congiuntivo presente di ufficiare |  | `no-record-of-base` |
| 73873 | `uffici` | verb | 3 | terza persona singolare del congiuntivo presente di ufficiare |  | `no-record-of-base` |
| 73873 | `uffici` | verb | 4 | terza persona singolare dell'imperativo presente di ufficiare |  | `no-record-of-base` |
| 73879 | `relazioni` | verb | 1 | prima persona singolare del congiuntivo presente di relazionare |  | `no-record-of-base` |
| 73879 | `relazioni` | verb | 2 | seconda persona singolare del congiuntivo presente di relazionare |  | `no-record-of-base` |
| 73879 | `relazioni` | verb | 3 | terza persona singolare del congiuntivo presente di relazionare |  | `no-record-of-base` |
| 73879 | `relazioni` | verb | 4 | terza persona singolare dell'imperativo presente di relazionare |  | `no-record-of-base` |
| 74202 | `extorsions` | noun | 0 | plurale di extorsion, estorsioni |  | `not-italian` |
| 74205 | `extortions` | noun | 0 | plurale di extortion, estorsioni |  | `not-italian` |
| 74302 | `boutiques` | noun | 0 | plurale di boutique |  | `not-italian` |
| 74304 | `magasins` | noun | 0 | plurale di magasin |  | `not-italian` |
| 74305 | `dictionnaires` | noun | 0 | plurale di dictionnaire |  | `not-italian` |
| 74306 | `palettes` | noun | 0 | plurale di palette |  | `not-italian` |
| 74308 | `vocabulaires` | noun | 0 | plurale di vocabulaire |  | `not-italian` |
| 74312 | `diapositives` | noun | 0 | plurale di diapositive |  | `not-italian` |
| 74316 | `thermosiphons` | noun | 0 | plurale di thermosiphon |  | `not-italian` |
| 74319 | `brasseries` | noun | 0 | plurale di brasserie |  | `not-italian` |
| 74320 | `fourchettes` | noun | 0 | plurale di fourchette |  | `not-italian` |
| 74322 | `bahuts` | noun | 0 | plurale di bahut |  | `not-italian` |
| 74324 | `coffres` | noun | 0 | plurale di coffre |  | `not-italian` |
| 74325 | `glaces` | noun | 0 | plurale di glace |  | `not-italian` |
| 74327 | `glaçons` | noun | 0 | plurale di glaçon |  | `not-italian` |
| 74331 | `briquets` | noun | 0 | plurale di briquet |  | `not-italian` |
| 74334 | `oreillers` | noun | 0 | plurale di oreiller |  | `not-italian` |
| 74336 | `coussins` | phrase | 0 | plurale di coussin |  | `not-italian` |
| 74338 | `curvilignes` | adj | 0 | plurale di curviligne |  | `not-italian` |
| 74340 | `curiosités` | noun | 0 | plurale di curiosité |  | `not-italian` |
| 74342 | `intérêts` | noun | 0 | plurale di intérêt |  | `not-italian` |
| 74344 | `fabriques` | noun | 0 | plurale di fabrique |  | `not-italian` |
| 74346 | `usines` | noun | 0 | plurale di usine |  | `not-italian` |
| 74347 | `ateliers` | noun | 0 | plurale di atelier |  | `not-italian` |
| 74351 | `wigs` | noun | 0 | plurale di wig |  | `not-italian` |
| 74352 | `bouillons` | noun | 0 | plurale di bouillon |  | `not-italian` |
| 74353 | `boules` | noun | 0 | plurale di boule |  | `not-italian` |
| 74354 | `boîtes` | noun | 0 | plurale di boîte |  | `not-italian` |
| 74355 | `blousons` | noun | 0 | plurale di blouson |  | `not-italian` |
| 74356 | `bises` | noun | 0 | plurale di bise |  | `not-italian` |
| 74357 | `biftecks` | noun | 0 | plurale di bifteck |  | `not-italian` |
| 74358 | `artichauts` | noun | 0 | plurale di artichaut |  | `not-italian` |
| 74372 | `artichokes` | noun | 0 | plurale di artichoke |  | `not-italian` |
| 74380 | `oasiens` | adj | 0 | plurale di oasien |  | `not-italian` |
| 74381 | `oasiens` | noun | 0 | plurale di oasien |  | `not-italian` |
| 74382 | `oasienne` | adj | 0 | femminile di oasien |  | `not-italian` |
| 74383 | `oasienne` | noun | 0 | femminile di oasien |  | `not-italian` |
| 74384 | `oasiennes` | adj | 0 | femminile plurale di oasien |  | `not-italian` |
| 74385 | `oasiennes` | noun | 0 | femminile plurale di oasien |  | `not-italian` |
| 74387 | `obédiences` | noun | 0 | plurale di obédience |  | `not-italian` |
| 74491 | `pierwsza` | adj | 0 | Femminile di pierwszy |  | `not-italian` |
| 74825 | `serca` | noun | 0 | plurale di cuore (singolare: serce) |  | `not-italian` |
| 75000 | `wartości` | noun | 0 | plurale di wartość |  | `not-italian` |
| 75002 | `antykomuniści` | noun | 0 | plurale di antykomunista |  | `not-italian` |
| 75008 | `almák` | noun | 0 | plurale di alma |  | `not-italian` |
| 75010 | `citromok` | noun | 0 | plurale di citrom |  | `not-italian` |
| 75013 | `eprek` | noun | 0 | plurale di eper |  | `not-italian` |
| 75015 | `földieprek` | noun | 0 | plurale di földi eper |  | `not-italian` |
| 75017 | `görögdinnyék` | noun | 0 | plurale di görögdinnye |  | `not-italian` |
| 75019 | `narancsok` | noun | 0 | plurale di narancs |  | `not-italian` |
| 75021 | `szedrek` | noun | 0 | plurale di szeder |  | `not-italian` |
| 75022 | `szilvák` | noun | 0 | plurale di szilva |  | `not-italian` |
| 75124 | `niebieskoocy` | noun | 0 | plurale di niebieskooki |  | `not-italian` |
| 75151 | `appelsiinit` | noun | 0 | plurale di appelsiini |  | `not-italian` |
| 75152 | `aprikoosit` | noun | 0 | plurale di aprikoosi |  | `not-italian` |
| 75157 | `bananen` | noun | 0 | plurale di banaan |  | `not-italian` |
| 75163 | `przecinki` | noun | 0 | plurale di przecinek |  | `not-italian` |
| 75165 | `démocrates` | noun | 0 | plurale di démocrate |  | `not-italian` |
| 75166 | `democrats` | noun | 0 | plurale di democrat |  | `not-italian` |
| 75168 | `démocraties` | noun | 0 | plurale di démocratie |  | `not-italian` |
| 75170 | `fantezii` | noun | 0 | plurale di fantezie |  | `not-italian` |
| 75172 | `fantaisies` | noun | 0 | plurale di fantaisie |  | `not-italian` |
| 75439 | `senatrici` | noun | 0 | femminile plurale di senatore, femminile di senatori, plurale di senatrice | `senatrice` | `edge-names-another-word` |
| 75454 | `perseveranze` | noun | 0 | plurale di perseveranza |  | `base-table-does-not-list` |
| 76776 | `żarty` | noun | 0 | plurale di żart |  | `not-italian` |
| 76837 | `scoperti` | verb | 0 | participio passato plurale di scoprire |  | `base-table-does-not-list` |
| 76842 | `dni` | noun | 0 | plurale di dzień |  | `not-italian` |
| 76845 | `nasi` | noun | 0 | plurale di nasz |  | `not-italian` |
| 76848 | `wasi` | noun | 0 | plurale di wasz |  | `not-italian` |
| 76854 | `moce` | noun | 0 | plurale di moc |  | `not-italian` |
| 76855 | `Sycylijczycy` | noun | 0 | plurale di Sycylijczyk |  | `not-italian` |
| 76856 | `Toskańczycy` | noun | 0 | plurale di Toskańczyk |  | `not-italian` |
| 76857 | `Lombardczycy` | noun | 0 | plurale di Lombardczyk |  | `not-italian` |
| 76858 | `Marsjanie` | noun | 0 | plurale di Marsjanin |  | `not-italian` |
| 76859 | `Polacy` | noun | 0 | plurale di Polak |  | `not-italian` |
| 76860 | `Polki` | noun | 0 | plurale di Polka |  | `not-italian` |
| 76865 | `nadzieje` | noun | 0 | plurale di nadzieja |  | `not-italian` |
| 76890 | `acting` | verb | 0 | participio presente di act |  | `not-italian` |
| 76891 | `sleeping` | verb | 0 | participio presente di sleep |  | `not-italian` |
| 77162 | `parti` | noun | 1 | plurale di parto, nell'accezione di atto biologico di espulsione dal grembo materno di un neonato | `neonato` | `hand-entry` |
| 77162 | `parti` | noun | 2 | plurale di parto, nell'accezione di persona della popolazione dei Parti | `Parti` | `hand-entry` |
| 77499 | `Abbiegungen` | noun | 0 | plurale di Abbiegung |  | `not-italian` |
| 77597 | `nurkat` | noun | 0 | plurale di nurkka |  | `not-italian` |
| 77598 | `kulmat` | noun | 0 | plurale di kulma |  | `not-italian` |
| 77616 | `télécommandes` | noun | 0 | plurale di télécommande |  | `not-italian` |
| 77617 | `boissons` | noun | 0 | plurale di boisson |  | `not-italian` |
| 77619 | `caméléons` | noun | 0 | plurale di caméléon |  | `not-italian` |
| 77622 | `chevaux` | noun | 0 | plurale di cheval |  | `not-italian` |
| 77623 | `lionne` | noun | 0 | femminile di lion, leonessa |  | `not-italian` |
| 77624 | `lionnes` | noun | 0 | femminile plurale di lion , leonesse |  | `not-italian` |
| 77913 | `limonades` | noun | 0 | plurale di limonade |  | `not-italian` |
| 78011 | `poncifs` | noun | 0 | plurale di poncif |  | `not-italian` |
| 78415 | `craftsmen` | noun | 0 | plurale di craftsman |  | `not-italian` |
| 78454 | `Sardyńczycy` | noun | 0 | plurale di Sardyńczyk |  | `not-italian` |
| 78472 | `onomatopeiche` | adj | 0 | femminile plurale di onomatopeico, plurale di onomatopeica | `onomatopeica` | `edge-names-another-word` |
| 78666 | `pisi` | noun | 0 | plurale di pisu |  | `not-italian` |
| 78707 | `spacchiotti` | noun | 0 | plurale di spacchiotto |  | `not-italian` |
| 78792 | `logorroiche` | noun | 0 | plurale di logorroica |  | `base-table-does-not-list` |
| 78793 | `logorroiche` | noun | 0 | plurale di logorroica |  | `base-table-does-not-list` |
| 78796 | `strillone` | noun | 0 | plurale di strillone |  | `names-itself` |
| 79189 | `affacciato` | verb | 0 | participio passato di affacciare, affacciarsi | `affacciarsi` | `edge-names-another-word` |
| 79235 | `parasole` | noun | 0 | plurale di parasol |  | `not-italian` |
| 79237 | `oczy` | noun | 0 | plurale di oko |  | `not-italian` |
| 79238 | `kwiaty` | noun | 0 | plurale di kwiat |  | `not-italian` |
| 79240 | `sympatie` | noun | 0 | plurale di sympatia |  | `not-italian` |
| 79241 | `insurekcje` | noun | 0 | plurale di insurekcja |  | `not-italian` |
| 79242 | `partyzanci` | noun | 0 | plurale di partyzant |  | `not-italian` |
| 79410 | `vacances` | noun | 0 | plurale di vacance |  | `not-italian` |
| 79412 | `vacanciers` | noun | 0 | plurale di vacancier |  | `not-italian` |
| 79413 | `vacancière` | noun | 0 | femminile di vacancier |  | `not-italian` |
| 79414 | `vacancières` | noun | 0 | femminile plurale di vacancier |  | `not-italian` |
| 79537 | `agendas` | noun | 0 | plurale di agenda |  | `not-italian` |
| 79562 | `ammizzigghi` | noun | 0 | plurale di ammizzigghiu |  | `not-italian` |
| 79562 | `ammizzigghi` | noun | 1 | plurale di ammizzigghia |  | `not-italian` |
| 79563 | `mmizzigghi` | noun | 0 | plurale di mmizzigghiu |  | `not-italian` |
| 79563 | `mmizzigghi` | noun | 1 | plurale di mmizzigghia |  | `not-italian` |
| 79718 | `ambassadeurs` | noun | 0 | plurale di ambassadeur |  | `not-italian` |
| 79719 | `éléphants` | noun | 0 | plurale di éléphant |  | `not-italian` |
| 79720 | `éléphante` | noun | 0 | femminile di éléphant |  | `not-italian` |
| 79721 | `éléphantes` | noun | 0 | femminile plurale di éléphant |  | `not-italian` |
| 79723 | `règles` | noun | 0 | plurale di règle |  | `not-italian` |
| 79726 | `saumons` | noun | 0 | plurale di saumon |  | `not-italian` |
| 79728 | `plages` | noun | 0 | plurale di plage |  | `not-italian` |
| 79730 | `diamants` | noun | 0 | plurale di diamant |  | `not-italian` |
| 79850 | `comics` | noun | 0 | plurale di comic |  | `not-italian` |
| 79933 | `tradotto` | verb | 0 | participio passato di tradurre, tradursi | `tradursi` | `edge-names-another-word` |
| 80018 | `hops` | noun | 0 | plurale di hop |  | `not-italian` |
| 80044 | `depositions` | noun | 0 | plurale di deposition |  | `not-italian` |
| 80186 | `sesta` | adj | 0 | femminile di sesto |  | `base-table-does-not-list` |
| 80208 | `materie prime` | phrase | 0 | plurale di materia prima |  | `base-table-does-not-list` |
| 80236 | `monoliti` | noun | 0 | plurale di monolito o monolite | `monolite` | `edge-names-another-word` |
| 80306 | `marshes` | noun | 0 | plurale di marsh |  | `not-italian` |
| 80308 | `midges` | noun | 0 | plurale di midge |  | `not-italian` |
| 80320 | `invisibles` | adj | 0 | plurale di invisible |  | `not-italian` |
| 80321 | `visibles` | adj | 0 | plurale di visible |  | `not-italian` |
| 80390 | `shields` | noun | 0 | plurale di shield |  | `not-italian` |
| 80392 | `dells` | noun | 0 | plurale di dell |  | `not-italian` |
| 80395 | `boulders` | noun | 0 | plurale di boulder |  | `not-italian` |
| 80464 | `pints` | noun | 0 | plurale di pint |  | `not-italian` |
| 80468 | `liters` | noun | 0 | plurale di liter |  | `not-italian` |
| 80493 | `philosophies` | noun | 0 | plurale di philosophie |  | `not-italian` |
| 80501 | `folies` | noun | 0 | plurale di folie |  | `not-italian` |
| 80504 | `elves` | noun | 0 | plurale di elf |  | `not-italian` |
| 80509 | `leaves` | noun | 0 | plurale di leaf |  | `not-italian` |
| 80534 | `vulgaires` | adj | 0 | plurale di vulgaire |  | `not-italian` |
| 80536 | `peuples` | noun | 0 | plurale di peuple |  | `not-italian` |
| 80541 | `horsemen` | noun | 0 | plurale di horseman |  | `not-italian` |
| 80544 | `shoulders` | noun | 0 | plurale di shoulder |  | `not-italian` |
| 80545 | `fields` | noun | 0 | plurale di field |  | `not-italian` |
| 80638 | `parisiens` | adj | 0 | plurale di parisien |  | `not-italian` |
| 80639 | `parisienne` | adj | 0 | femminile di parisien |  | `not-italian` |
| 80640 | `parisiennes` | adj | 0 | femminile plurale di parisien |  | `not-italian` |
| 80693 | `peines` | noun | 0 | plurale di peine |  | `not-italian` |
| 80695 | `réputations` | noun | 0 | plurale di réputation |  | `not-italian` |
| 80699 | `matières` | noun | 0 | plurale di matière |  | `not-italian` |
| 80745 | `chienne` | noun | 0 | femminile di chien |  | `not-italian` |
| 80800 | `aérodromes` | noun | 0 | plurale di aérodrome |  | `not-italian` |
| 80802 | `vigoureuse` | adj | 0 | femminile di vigoureux |  | `not-italian` |
| 80803 | `vigoureuses` | adj | 0 | femminile plurale di vigoureux |  | `not-italian` |
| 80804 | `tables` | noun | 0 | plurale di table |  | `not-italian` |
| 80805 | `tables` | noun | 0 | plurale di table |  | `not-italian` |
| 80806 | `argents` | noun | 0 | plurale di argent |  | `not-italian` |
| 80808 | `valeurs` | noun | 0 | plurale di valeur |  | `not-italian` |
| 80810 | `idéologies` | noun | 0 | plurale di idéologie |  | `not-italian` |
| 80812 | `idées` | noun | 0 | plurale di idée |  | `not-italian` |
| 80814 | `littératures` | noun | 0 | plurale di littérature |  | `not-italian` |
| 80829 | `shires` | noun | 0 | plurale di shire |  | `not-italian` |
| 80830 | `counts` | noun | 0 | plurale di count |  | `not-italian` |
| 80832 | `counties` | noun | 0 | plurale di county |  | `not-italian` |
| 80834 | `countesses` | noun | 0 | plurale di countess |  | `not-italian` |
| 80836 | `earls` | noun | 0 | plurale di earl |  | `not-italian` |
| 80837 | `dukes` | noun | 0 | plurale di duke |  | `not-italian` |
| 80838 | `duchesses` | noun | 0 | plurale di duchess |  | `not-italian` |
| 80840 | `marquesses` | noun | 0 | plurale di marquess |  | `not-italian` |
| 80843 | `marquises` | noun | 0 | plurale di marquis |  | `not-italian` |
| 80845 | `marchionesses` | noun | 0 | plurale di marchioness |  | `not-italian` |
| 80847 | `reines` | noun | 0 | plurale di reine |  | `not-italian` |
| 80849 | `rois` | noun | 0 | plurale di roi |  | `not-italian` |
| 80875 | `ducs` | noun | 0 | plurale di duc |  | `not-italian` |
| 80882 | `artistes` | noun | 0 | plurale di artiste |  | `not-italian` |
| 80886 | `saprofiti` | noun | 0 | plurale di saprofito o saprofita |  | `base-table-does-not-list` |
| 80899 | `wars` | noun | 0 | plurale di war, guerre |  | `not-italian` |
| 80911 | `kindreds` | noun | 0 | plurale di kindred |  | `not-italian` |
| 80913 | `soirs` | noun | 0 | plurale di soir |  | `not-italian` |
| 80917 | `removals` | noun | 0 | plurale di removal |  | `not-italian` |
| 80918 | `dismissals` | noun | 0 | plurale di dismissal |  | `not-italian` |
| 80919 | `teams` | noun | 0 | plurale di team |  | `not-italian` |
| 80921 | `classmates` | noun | 0 | plurale di classmate |  | `not-italian` |
| 80922 | `crews` | noun | 0 | plurale di crew |  | `not-italian` |
| 80923 | `universities` | noun | 0 | plurale di university |  | `not-italian` |
| 80924 | `noises` | noun | 0 | plurale di noise |  | `not-italian` |
| 80928 | `homages` | noun | 0 | plurale di homage |  | `not-italian` |
| 80929 | `boxeuse` | noun | 0 | femminile di boxeur |  | `not-italian` |
| 80948 | `italiens` | adj | 0 | plurale di italien |  | `not-italian` |
| 80949 | `italienne` | adj | 0 | femminile di italien |  | `not-italian` |
| 80950 | `italiennes` | adj | 0 | femminile plurale di italien |  | `not-italian` |
| 80951 | `langues` | noun | 0 | plurale di langue |  | `not-italian` |
| 80953 | `idiomes` | noun | 0 | plurale di idiome |  | `not-italian` |
| 80955 | `propres` | adj | 0 | plurale di propre |  | `not-italian` |
| 80996 | `waxes` | noun | 0 | plurale di wax |  | `not-italian` |
| 80999 | `phonographs` | noun | 0 | plurale di phonograph |  | `not-italian` |
| 81001 | `gramophones` | noun | 0 | plurale di gramophone |  | `not-italian` |
| 81002 | `cylinders` | noun | 0 | plurale di cylinder |  | `not-italian` |
| 81005 | `monarchs` | noun | 0 | plurale di monarch |  | `not-italian` |
| 81006 | `monarchies` | noun | 0 | plurale di monarchy |  | `not-italian` |
| 81007 | `princes` | noun | 0 | plurale di prince |  | `not-italian` |
| 81008 | `princesses` | noun | 0 | plurale di princess |  | `not-italian` |
| 81012 | `archbishops` | noun | 0 | plurale di archbishop |  | `not-italian` |
| 81024 | `facilities` | noun | 0 | plurale di facility |  | `not-italian` |
| 81094 | `ensembles` | noun | 0 | plurale di ensemble |  | `not-italian` |
| 81097 | `orchestres` | noun | 0 | plurale di orchestre |  | `not-italian` |
| 81099 | `théâtres` | noun | 0 | plurale di théâtre |  | `not-italian` |
| 81101 | `tragédies` | noun | 0 | plurale di tragédie |  | `not-italian` |
| 81103 | `comédies` | noun | 0 | plurale di comédie |  | `not-italian` |
| 81105 | `drames` | noun | 0 | plurale di drame |  | `not-italian` |
| 81107 | `opéras` | noun | 0 | plurale di opéra |  | `not-italian` |
| 81108 | `êtres` | noun | 0 | plurale di être |  | `not-italian` |
| 81120 | `dogmes` | noun | 0 | plurale di dogme |  | `not-italian` |
| 81121 | `religions` | noun | 0 | plurale di religion |  | `not-italian` |
| 81122 | `religions` | noun | 0 | plurale di religion |  | `not-italian` |
| 81126 | `cultes` | noun | 0 | plurale di culte |  | `not-italian` |
| 81129 | `rites` | noun | 0 | plurale di rite |  | `not-italian` |
| 81130 | `rites` | noun | 0 | plurale di rite |  | `not-italian` |
| 81132 | `druidismes` | noun | 0 | plurale di druidisme |  | `not-italian` |
| 81135 | `cérémonies` | noun | 0 | plurale di cérémonie |  | `not-italian` |
| 81137 | `religieuse` | adj | 0 | femminile di religieux |  | `not-italian` |
| 81138 | `religieuses` | adj | 0 | femminile plurale di religieux |  | `not-italian` |
| 81140 | `ordres` | noun | 0 | plurale di ordre |  | `not-italian` |
| 81214 | `windsocks` | noun | 0 | plurale di windsock |  | `not-italian` |
| 81217 | `windmills` | noun | 0 | plurale di windmill |  | `not-italian` |
| 81219 | `approbations` | noun | 0 | plurale di approbation |  | `not-italian` |
| 81221 | `commendations` | noun | 0 | plurale di commendation |  | `not-italian` |
| 81222 | `recommendations` | noun | 0 | plurale di recommendation |  | `not-italian` |
| 81243 | `intuitions` | noun | 0 | plurale di intuition |  | `not-italian` |
| 81245 | `intuitifs` | adj | 0 | plurale di intuitif |  | `not-italian` |
| 81246 | `intuitives` | adj | 0 | femminile plurale di intuitif |  | `not-italian` |
| 81279 | `gendarme` | noun | 1 | persona di corporatura robusta e/o alta con modo di fare energico |  | `base-table-does-not-list` |
| 81289 | `tomatoes` | noun | 0 | plurale di tomato |  | `not-italian` |
| 81297 | `greci` | noun | 0 | plurale di greco (uomo nato in Grecia) | `Grecia` | `edge-names-another-word` |
| 81299 | `greche` | noun | 0 | femminile plurale di greco (donne nate in Grecia) | `Grecia` | `edge-names-another-word` |
| 81303 | `rubbers` | noun | 0 | plurale di rubber |  | `not-italian` |
| 81306 | `polymers` | noun | 0 | plurale di polymer |  | `not-italian` |
| 81309 | `monomers` | noun | 0 | plurale di monomer |  | `not-italian` |
| 81311 | `particles` | noun | 0 | plurale di particle |  | `not-italian` |
| 81313 | `portions` | noun | 0 | plurale di portion |  | `not-italian` |
| 81331 | `warthogs` | noun | 0 | plurale di warthog |  | `not-italian` |
| 81334 | `warts` | noun | 0 | plurale di wart |  | `not-italian` |
| 81337 | `hedgehogs` | noun | 0 | plurale di hedgehog |  | `not-italian` |
| 81339 | `hoars` | noun | 0 | plurale di hoar |  | `not-italian` |
| 81340 | `badgers` | noun | 0 | plurale di badger |  | `not-italian` |
| 81343 | `breezes` | noun | 0 | plurale di breeze |  | `not-italian` |
| 81345 | `drakes` | noun | 0 | plurale di drake |  | `not-italian` |
| 81348 | `efts` | noun | 0 | plurale di eft |  | `not-italian` |
| 81351 | `fawns` | noun | 0 | plurale di fawn |  | `not-italian` |
| 81354 | `gibbons` | noun | 0 | plurale di gibbon |  | `not-italian` |
| 81355 | `herons` | noun | 0 | plurale di heron |  | `not-italian` |
| 81369 | `singes` | noun | 0 | plurale di singe |  | `not-italian` |
| 81371 | `gestes` | noun | 0 | plurale di geste |  | `not-italian` |
| 81373 | `mouvements` | noun | 0 | plurale di mouvement |  | `not-italian` |
| 81376 | `leopards` | noun | 0 | plurale di leopard |  | `not-italian` |
| 81377 | `tigers` | noun | 0 | plurale di tiger |  | `not-italian` |
| 81380 | `hyenas` | noun | 0 | plurale di hyena |  | `not-italian` |
| 81381 | `ibexes` | noun | 0 | plurale di ibex |  | `not-italian` |
| 81383 | `hyènes` | noun | 0 | plurale di hyène |  | `not-italian` |
| 81390 | `dandys` | noun | 0 | plurale di dandy |  | `not-italian` |
| 81391 | `dandies` | noun | 0 | plurale di dandy |  | `not-italian` |
| 81396 | `Cefalopodi` | noun | 0 | plurale di cefalopode |  | `base-table-does-not-list` |
| 81408 | `navels` | noun | 0 | plurale di navel |  | `not-italian` |
| 81409 | `mammals` | noun | 0 | plurale di mammal |  | `not-italian` |
| 81413 | `vertebrates` | noun | 0 | plurale di vertebrate |  | `not-italian` |
| 81414 | `invertebrates` | noun | 0 | plurale di invertebrate |  | `not-italian` |
| 81417 | `spinal columns` | noun | 0 | plurale di spinal column |  | `not-italian` |
| 81420 | `spines` | noun | 0 | plurale di spine |  | `not-italian` |
| 81424 | `vertebrae` | noun | 0 | plurale di vertebra |  | `not-italian` |
| 81426 | `skulls` | noun | 0 | plurale di skull |  | `not-italian` |
| 81427 | `fangs` | noun | 0 | plurale di fang |  | `not-italian` |
| 81429 | `liars` | noun | 0 | plurale di liar |  | `not-italian` |
| 81432 | `pathologies` | noun | 0 | plurale di pathology |  | `not-italian` |
| 81433 | `pathologies` | noun | 0 | plurale di pathologie |  | `not-italian` |
| 81468 | `terreurs` | noun | 0 | plurale di terreur |  | `not-italian` |
| 81471 | `émotions` | noun | 0 | plurale di émotion |  | `not-italian` |
| 81473 | `âmes` | noun | 0 | plurale di âme |  | `not-italian` |
| 81476 | `immatériels` | adj | 0 | plurale di immatériel |  | `not-italian` |
| 81478 | `immatérielle` | adj | 0 | femminile di immatériel |  | `not-italian` |
| 81479 | `immatérielles` | adj | 0 | femminile plurale di immatériel |  | `not-italian` |
| 81484 | `morceaux` | noun | 0 | plurale di morceau |  | `not-italian` |
| 81487 | `clairs` | adj | 0 | plurale di clair |  | `not-italian` |
| 81488 | `clairs` | noun | 0 | plurale di clair |  | `not-italian` |
| 81489 | `claire` | adj | 0 | femminile di clair |  | `not-italian` |
| 81490 | `claires` | adj | 0 | femminile plurale di clair |  | `not-italian` |
| 81511 | `intelligents` | adj | 0 | plurale di intelligent |  | `not-italian` |
| 81514 | `habiletés` | noun | 0 | plurale di habileté |  | `not-italian` |
| 81566 | `shoehorns` | noun | 0 | plurale di shoehorn |  | `not-italian` |
| 81570 | `creams` | noun | 0 | plurale di cream |  | `not-italian` |
| 81584 | `molars` | noun | 0 | plurale di molar |  | `not-italian` |
| 81586 | `premolars` | noun | 0 | plurale di premolar |  | `not-italian` |
| 81587 | `canines` | noun | 0 | plurale di canine |  | `not-italian` |
| 81589 | `incisors` | noun | 0 | plurale di incisor |  | `not-italian` |
| 81590 | `harps` | noun | 0 | plurale di harp |  | `not-italian` |
| 81591 | `violins` | noun | 0 | plurale di violin |  | `not-italian` |
| 81592 | `saxophones` | noun | 0 | plurale di saxophone |  | `not-italian` |
| 81593 | `clarinets` | noun | 0 | plurale di clarinet |  | `not-italian` |
| 81716 | `sogni` | verb | 1 | prina persona singolare del congiuntivo presente di sognare |  | `not-a-form-gloss` |
| 81732 | `citróny` | noun | 0 | plurale di citrón |  | `not-italian` |
| 81916 | `fiati` | noun | 0 | plurale di fiato |  | `base-table-does-not-list` |
| 81997 | `businesses` | noun | 0 | plurale di business |  | `not-italian` |
| 82033 | `earldoms` | noun | 0 | plurale di earldom |  | `not-italian` |
| 82040 | `frères` | noun | 0 | plurale di frère |  | `not-italian` |
| 82042 | `sœurs` | noun | 0 | plurale di sœur |  | `not-italian` |
| 82045 | `demi-frères` | noun | 0 | plurale di demi-frère |  | `not-italian` |
| 82046 | `demi-sœurs` | noun | 0 | plurale di demi-sœur |  | `not-italian` |
| 82057 | `cellphones` | noun | 0 | plurale di cellphone |  | `not-italian` |
| 82059 | `cell phones` | noun | 0 | plurale di cell phone |  | `not-italian` |
| 82144 | `сөздер` | noun | 1 | plurale di сөз |  | `not-italian` |
| 82145 | `sözder` | noun | 1 | plurale di söz |  | `not-italian` |
| 82235 | `балалар` | noun | 1 | plurale di бала |  | `not-italian` |
| 82407 | `coins` | noun | 0 | plurale di coin |  | `not-italian` |
| 82413 | `тағамтар` | noun | 1 | plurale di тағам |  | `not-italian` |
| 82414 | `аңдар` | noun | 1 | plurale di аң |  | `not-italian` |
| 82431 | `busybodies` | noun | 0 | plurale di busybody |  | `not-italian` |
| 82433 | `bowls` | noun | 0 | plurale di bowl |  | `not-italian` |
| 82452 | `élites` | noun | 0 | plurale di élite |  | `not-italian` |
| 82454 | `brainwashings` | noun | 0 | plurale di brainwashing |  | `not-italian` |
| 82456 | `brain-washings` | noun | 0 | plurale di brain-washing |  | `not-italian` |
| 82460 | `saprobi` | noun | 0 | plurale di saprobio e di saprobo | `saprobo` | `edge-names-another-word` |
| 82705 | `accidentales` | adj | 0 | plurale di accidental |  | `not-italian` |
| 82707 | `temptations` | noun | 0 | plurale di temptation |  | `not-italian` |
| 82733 | `adieux` | noun | 0 | plurale di adieu, addii, saluti |  | `not-italian` |
| 82736 | `burlone` | adj | 0 | femminile di burlone |  | `names-itself` |
| 82755 | `clams` | noun | 0 | plurale di clam (italiano: vongole) |  | `not-italian` |
| 82756 | `thesauri` | noun | 0 | plurale di thesaurus |  | `not-italian` |
| 82757 | `thesauruses` | noun | 0 | plurale di thesaurus |  | `not-italian` |
| 82760 | `phenotypes` | noun | 0 | plurale di phenotype |  | `not-italian` |
| 82762 | `stem cells` | noun | 0 | plurale di stem cell |  | `not-italian` |
| 82790 | `aceptables` | adj | 0 | plurale di aceptable |  | `not-italian` |
| 82835 | `ácida` | adj | 0 | femminile di ácido |  | `not-italian` |
| 82836 | `ácidas` | adj | 0 | femminile plurale di ácido |  | `not-italian` |
| 82838 | `pendulums` | noun | 0 | plurale di pendulum |  | `not-italian` |
| 82839 | `pendula` | noun | 0 | plurale di pendulum |  | `not-italian` |
| 82851 | `adiposi` | adj | 0 | plurale di adipe |  | `base-table-does-not-list` |
| 82894 | `aclaraciones` | noun | 0 | plurale di aclaración |  | `not-italian` |
| 82902 | `acogedores` | adj | 0 | plurale di acogedor |  | `not-italian` |
| 82903 | `acogedora` | adj | 0 | femminile di acogedor |  | `not-italian` |
| 82904 | `acogedoras` | adj | 0 | femminile plurale di acogedor |  | `not-italian` |
| 82911 | `acomodados` | adj | 0 | plurale di acomodado |  | `not-italian` |
| 82912 | `acomodada` | adj | 0 | femminile di acomodado |  | `not-italian` |
| 82913 | `acomodadas` | adj | 0 | femminile plurale di acomodado |  | `not-italian` |
| 83224 | `ambasády` | noun | 0 | plurale di ambasáda |  | `not-italian` |
| 83226 | `mamky` | noun | 0 | femminile plurale di mamka |  | `not-italian` |
| 83240 | `portes` | noun | 0 | plurale di porte |  | `not-italian` |
| 83255 | `famines` | noun | 0 | plurale di famine |  | `not-italian` |
| 83256 | `famines` | noun | 0 | plurale di famine |  | `not-italian` |
| 83315 | `hooligans` | noun | 0 | plurale di hooligan |  | `not-italian` |
| 83316 | `hammers` | noun | 0 | plurale di hammer |  | `not-italian` |
| 83317 | `Bulgarians` | noun | 0 | plurale di Bulgarian |  | `not-italian` |
| 83382 | `Reptilia` | noun | 0 | plurale di reptile, rettili |  | `not-italian` |
| 83431 | `ladies` | noun | 0 | plurale di lady |  | `not-italian` |
| 83533 | `liquefatta` | verb | 0 | participio passato femminile di liquefare |  | `base-table-does-not-list` |
| 83676 | `redecorations` | noun | 0 | plurale di redecoration |  | `not-italian` |
| 83679 | `miners` | noun | 0 | plurale di miner |  | `not-italian` |
| 83680 | `wrens` | noun | 0 | plurale di wren |  | `not-italian` |
| 83687 | `ferrets` | noun | 0 | plurale di ferret |  | `not-italian` |
| 83689 | `furets` | noun | 0 | plurale di furet |  | `not-italian` |
| 83700 | `española` | adj | 0 | femminile di español, spagnola |  | `not-italian` |
| 83701 | `españolas` | adj | 0 | femminile plurale di español, spagnole |  | `not-italian` |
| 83731 | `prosodies` | noun | 0 | plurale di prosody |  | `not-italian` |
| 83739 | `colors` | noun | 0 | plurale di color |  | `not-italian` |
| 83742 | `izquierdos` | adj | 0 | plurale di izquierdo |  | `not-italian` |
| 83743 | `izquierda` | adj | 0 | femminile di izquierdo, sinistra |  | `not-italian` |
| 83762 | `hierarchies` | noun | 0 | plurale di hierarchy |  | `not-italian` |
| 83764 | `hiérarchies` | noun | 0 | plurale di hiérarchie |  | `not-italian` |
| 83784 | `Asteraceae` | noun | 1 | plurale di asteracea |  | `not-italian` |
| 83812 | `sereins` | adj | 0 | plurale di serein |  | `not-italian` |
| 83813 | `sereines` | adj | 0 | femminile plurale di serein |  | `not-italian` |
| 83814 | `sereine` | adj | 0 | femminile di serein |  | `not-italian` |
| 83819 | `saviors` | noun | 0 | plurale di savior |  | `not-italian` |
| 83873 | `patrols` | noun | 0 | plurale di patrol |  | `not-italian` |
| 83880 | `instants` | noun | 0 | plurale di instant |  | `not-italian` |
| 83884 | `instances` | noun | 0 | plurale di instance |  | `not-italian` |
| 83918 | `bandes dessinées` | phrase | 0 | plurale di bande dessinée |  | `not-italian` |
| 83920 | `jibs` | noun | 0 | plurale di jib |  | `not-italian` |
| 83989 | `champions` | noun | 0 | plurale di champion |  | `not-italian` |
| 83991 | `championships` | noun | 0 | plurale di championship |  | `not-italian` |
| 84045 | `mainsails` | noun | 0 | plurale di mainsail |  | `not-italian` |
| 84052 | `compost bins` | noun | 0 | plurale di compost bin |  | `not-italian` |
| 84072 | `engineers` | noun | 0 | plurale di engineer |  | `not-italian` |
| 84074 | `strains` | noun | 0 | plurale di strain |  | `not-italian` |
| 84075 | `radii` | noun | 0 | plurale di radius |  | `not-italian` |
| 84076 | `radiuses` | noun | 0 | plurale di radius |  | `not-italian` |
| 84077 | `yield stresses` | noun | 0 | plurale di yield stress |  | `not-italian` |
| 84078 | `yields` | noun | 0 | plurale di yield |  | `not-italian` |
| 84080 | `deformations` | noun | 0 | plurale di deformation |  | `not-italian` |
| 84083 | `thicknesses` | noun | 0 | plurale di thickness |  | `not-italian` |
| 84085 | `masts` | noun | 0 | plurale di mast |  | `not-italian` |
| 84087 | `mainmasts` | noun | 0 | plurale di mainmast |  | `not-italian` |
| 84123 | `barometers` | noun | 0 | plurale di barometer |  | `not-italian` |
| 84124 | `booms` | noun | 0 | plurale di boom |  | `not-italian` |
| 84126 | `tillers` | noun | 0 | plurale di tiller |  | `not-italian` |
| 84178 | `lighthouses` | noun | 0 | plurale di lighthouse |  | `not-italian` |
| 84186 | `buoys` | noun | 0 | plurale di buoy |  | `not-italian` |
| 84189 | `keels` | noun | 0 | plurale di keel |  | `not-italian` |
| 84291 | `traceurs` | noun | 0 | plurale di traceur |  | `not-italian` |
| 84293 | `traceurs` | noun | 0 | plurale di traceur |  | `not-italian` |
| 84367 | `avvilito` | verb | 0 | participio passato di avvilire, avvilirsi | `avvilirsi` | `edge-names-another-word` |
| 84909 | `congelata` | verb | 0 | participio passato femminile di congelare |  | `base-table-does-not-list` |
| 84914 | `congiunti` | verb | 0 | participio passato plurale di congiungere |  | `base-table-does-not-list` |
| 84948 | `kings` | noun | 0 | plurale di king |  | `not-italian` |
| 84955 | `translators` | noun | 0 | plurale di translator |  | `not-italian` |
| 84957 | `traducteurs` | noun | 0 | plurale di traducteur, traduttori |  | `not-italian` |
| 84958 | `traductrice` | noun | 0 | femminile di traducteur, traduttrice |  | `not-italian` |
| 84959 | `traductrices` | noun | 0 | femminile plurale di traducteur, traduttrici |  | `not-italian` |
| 84962 | `traductores` | noun | 0 | plurale di traductor, traduttori, traduttrici |  | `not-italian` |
| 84965 | `Dolmetscherin` | noun | 0 | femminile di Dolmetscher |  | `not-italian` |
| 84975 | `deplorables` | adj | 0 | plurale di deplorable |  | `not-italian` |
| 84987 | `bairros` | noun | 0 | plurale di bairro |  | `not-italian` |
| 85011 | `assets` | noun | 0 | plurale di asset, attività, beni |  | `not-italian` |
| 85014 | `fixed assets` | noun | 0 | plurale di fixed asset |  | `not-italian` |
| 85017 | `intangible assets` | noun | 0 | plurale di intangible asset |  | `not-italian` |
| 85022 | `chalkboards` | noun | 0 | plurale di chalkboard |  | `not-italian` |
| 85023 | `blackboards` | noun | 0 | plurale di blackboard |  | `not-italian` |
| 85066 | `chalks` | noun | 0 | plurale di chalk |  | `not-italian` |
| 85069 | `dashboards` | noun | 0 | plurale di dashboard |  | `not-italian` |
| 85254 | `pillar boxes` | noun | 0 | plurale di pillar box |  | `not-italian` |
| 85255 | `letter boxes` | noun | 0 | plurale di letter box |  | `not-italian` |
| 85256 | `mailboxes` | noun | 0 | plurale di mailbox |  | `not-italian` |
| 85258 | `half-pints` | noun | 0 | plurale di half-pint |  | `not-italian` |
| 85260 | `imperial pints` | noun | 0 | plurale di imperial pint |  | `not-italian` |
| 85277 | `maat` | noun | 0 | plurale di maa |  | `not-italian` |
| 85287 | `épingles` | noun | 0 | plurale di épingle |  | `not-italian` |
| 85363 | `educações` | noun | 0 | plurale di educação |  | `not-italian` |
| 85365 | `éducations` | noun | 0 | plurale di éducation |  | `not-italian` |
| 85366 | `educations` | noun | 0 | plurale di education |  | `not-italian` |
| 85369 | `leers` | noun | 0 | plurale di leer |  | `not-italian` |
| 85533 | `manners` | noun | 0 | plurale di manner |  | `not-italian` |
| 85539 | `water lilies` | noun | 0 | plurale di water lily |  | `not-italian` |
| 85541 | `nénufars` | noun | 0 | plurale di nénufar |  | `not-italian` |
| 85543 | `nénuphars` | noun | 0 | plurale di nénuphar |  | `not-italian` |
| 85695 | `turistit` | noun | 0 | plurale di turisti |  | `not-italian` |
| 86005 | `dales` | noun | 0 | plurale di dale |  | `not-italian` |
| 86006 | `valleys` | noun | 0 | plurale di valley |  | `not-italian` |
| 86061 | `luffs` | noun | 0 | plurale di luff |  | `not-italian` |
| 86146 | `Koreas` | name | 0 | plurale di Korea, termine usato per indicare collettivamente la Corea del Sud e la Corea del Nord |  | `not-italian` |
| 86270 | `emprisonnements` | noun | 0 | plurale di emprisonnement |  | `not-italian` |
| 86278 | `prisonnière` | adj | 0 | femminile di prisonnier |  | `not-italian` |
| 86279 | `prisonnière` | noun | 0 | femminile di prisonnier |  | `not-italian` |
| 86280 | `prisonniers` | adj | 0 | plurale di prisonnier |  | `not-italian` |
| 86281 | `prisonniers` | noun | 0 | plurale di prisonnier |  | `not-italian` |
| 86282 | `prisonnières` | adj | 0 | femminile plurale di prisonnier |  | `not-italian` |
| 86283 | `prisonnières` | noun | 0 | femminile plurale di prisonnier |  | `not-italian` |
| 86288 | `adhésive` | adj | 0 | femminile di adhésif |  | `not-italian` |
| 86429 | `classiques` | adj | 0 | plurale di classique |  | `not-italian` |
| 86765 | `integrals` | noun | 0 | plurale di integral |  | `not-italian` |
| 86770 | `integers` | noun | 0 | plurale di integer |  | `not-italian` |
| 86961 | `barbadoregni` | noun | 0 | plurale di barbadoregno |  | `base-table-does-not-list` |
| 86965 | `barbadoregna` | noun | 0 | femminile di barbadoregno |  | `base-table-does-not-list` |
| 87106 | `eigenvectors` | noun | 0 | plurale di eigenvector |  | `not-italian` |
| 87107 | `eigenvalues` | noun | 0 | plurale di eigenvalue |  | `not-italian` |
| 87195 | `faces` | noun | 0 | plurale di face |  | `not-italian` |
| 87401 | `graveyards` | noun | 0 | plurale di graveyard |  | `not-italian` |
| 87402 | `moterys` | noun | 0 | plurale di moteris |  | `not-italian` |
| 87403 | `ponios` | noun | 0 | plurale di ponia |  | `not-italian` |
| 87409 | `klubai` | noun | 0 | plurale di klubas |  | `not-italian` |
| 87439 | `kiaušai` | noun | 0 | plurale di kiaušas |  | `not-italian` |
| 87457 | `akys` | noun | 0 | plurale di akis |  | `not-italian` |
| 87476 | `dūmai` | noun | 0 | plurale di dūmas |  | `not-italian` |
| 87512 | `lūpos` | noun | 0 | plurale di lūpa |  | `not-italian` |
| 87602 | `dittatori` | adj | 0 | plurale di dittatorio |  | `no-record-of-base` |
| 87648 | `frazioni` | verb | 1 | prima persona singolare del congiuntivo presente di frazionare |  | `base-table-does-not-list` |
| 87648 | `frazioni` | verb | 2 | seconda persona singolare del congiuntivo presente di frazionare |  | `base-table-does-not-list` |
| 87648 | `frazioni` | verb | 3 | terza persona singolare del congiuntivo presente di frazionare |  | `base-table-does-not-list` |
| 87648 | `frazioni` | verb | 4 | terza persona singolare dell'imperativo presente di frazionare |  | `base-table-does-not-list` |
| 87762 | `venos` | noun | 0 | plurale di vena |  | `not-italian` |
| 87796 | `drawings` | noun | 0 | plurale di drawing |  | `not-italian` |
| 87798 | `homomorphisms` | noun | 0 | plurale di homomorphism |  | `not-italian` |
| 87920 | `vārdi` | noun | 0 | plurale di vārd |  | `not-italian` |
| 87945 | `jaunie` | adj | 0 | plurale di jaunatne |  | `not-italian` |
| 87950 | `mazulis` | adj | 0 | plurale di mazuļi |  | `not-italian` |
| 87959 | `vecs` | adj | 0 | plurale di veči |  | `not-italian` |
| 88383 | `buciniai` | noun | 0 | plurale di bučinys |  | `not-italian` |
| 88385 | `apkabinimai` | noun | 0 | plurale di apkabinima |  | `not-italian` |
| 88391 | `balzamasi` | noun | 0 | plurale di balzamas |  | `not-italian` |
| 88393 | `bankininkasi` | noun | 0 | plurale di bankininkas |  | `not-italian` |
| 88395 | `vaikasi` | noun | 0 | plurale di vaikas |  | `not-italian` |
| 88402 | `kondicioneriusi` | noun | 0 | plurale di kondicionerius |  | `not-italian` |
| 88405 | `aids` | noun | 0 | plurale di aid |  | `not-italian` |
| 88483 | `ribbons` | noun | 0 | plurale di ribbon |  | `not-italian` |
| 88489 | `yellows` | noun | 0 | plurale di yellow |  | `not-italian` |
| 88506 | `greens` | noun | 0 | plurale di green |  | `not-italian` |
| 88507 | `jaunes` | adj | 0 | plurale di jaune |  | `not-italian` |
| 88508 | `jaunes` | noun | 0 | plurale di jaune |  | `not-italian` |
| 88537 | `great-grandmothers` | noun | 0 | plurale di great-grandmother, bisnonne |  | `not-italian` |
| 88538 | `great-grandfathers` | noun | 0 | plurale di great-grandfather, bisnonni |  | `not-italian` |
| 88541 | `uvreda` | noun | 0 | plurale di uvred |  | `not-italian` |
| 88543 | `blesava` | noun | 0 | plurale di blesav |  | `not-italian` |
| 88545 | `budalasta` | noun | 0 | plurale di budalast |  | `not-italian` |
| 88547 | `glupaka` | noun | 0 | plurale di glupak |  | `not-italian` |
| 88549 | `zvijera` | noun | 0 | plurale di zvijer |  | `not-italian` |
| 88770 | `ciondoli` | verb | 1 | prima persona singolare del congiuntivo presente di ciondolare |  | `base-table-does-not-list` |
| 88770 | `ciondoli` | verb | 2 | seconda persona singolare del congiuntivo presente di ciondolare |  | `base-table-does-not-list` |
| 88770 | `ciondoli` | verb | 3 | terza persona singolare del congiuntivo presente di ciondolare |  | `base-table-does-not-list` |
| 88770 | `ciondoli` | verb | 4 | terza persona singolare dell'imperativo presente di ciondolare |  | `base-table-does-not-list` |
| 89058 | `strawberries` | noun | 0 | plurale di strawberry |  | `not-italian` |
| 89099 | `golds` | noun | 0 | plurale di gold |  | `not-italian` |
| 89107 | `ares` | noun | 0 | plurale di are |  | `not-italian` |
| 89108 | `ares` | noun | 0 | plurale di are |  | `not-italian` |
| 89111 | `pathologiques` | adj | 0 | plurale di pathologique |  | `not-italian` |
| 89115 | `pathologistes` | noun | 0 | plurale di pathologiste |  | `not-italian` |
| 89117 | `phytopathologies` | noun | 0 | plurale di phytopathologie |  | `not-italian` |
| 89119 | `phytopathologiques` | adj | 0 | plurale di phytopathologique |  | `not-italian` |
| 89121 | `phytopathologistes` | adj | 0 | plurale di phytopathologiste |  | `not-italian` |
| 89161 | `doliny` | noun | 0 | plurale di dolina |  | `not-italian` |
| 89169 | `grane` | noun | 0 | plurale di grana |  | `not-italian` |
| 89170 | `grane` | noun | 0 | plurale di grana |  | `not-italian` |
| 89205 | `pales` | noun | 0 | plurale di pale |  | `not-italian` |
| 89216 | `piaski` | noun | 0 | plurale di piasek |  | `not-italian` |
| 89223 | `liście` | noun | 0 | plurale di liść |  | `not-italian` |
| 89229 | `wody` | noun | 0 | plurale di woda |  | `not-italian` |
| 89466 | `slayers` | noun | 0 | plurale di slayer |  | `not-italian` |
| 89493 | `ciężarówki` | noun | 0 | plurale di ciężarówka |  | `not-italian` |
| 89494 | `filozofie` | noun | 0 | plurale di filozofia |  | `not-italian` |
| 89499 | `mecze` | noun | 0 | plurale di mecz |  | `not-italian` |
| 89510 | `futuryści` | noun | 0 | plurale di futurysta |  | `not-italian` |
| 89511 | `apteki` | noun | 0 | plurale di apteka |  | `not-italian` |
| 89512 | `histerie` | noun | 0 | plurale di histeria |  | `not-italian` |
| 89513 | `koniugacje` | noun | 0 | plurale di koniugacja |  | `not-italian` |
| 89521 | `cérebros` | noun | 0 | plurale di cérebro |  | `not-italian` |
| 89523 | `książki` | noun | 0 | plurale di książka |  | `not-italian` |
| 89524 | `lotnicy` | noun | 0 | plurale di lotnik |  | `not-italian` |
| 89529 | `histerycy` | noun | 0 | plurale di histeryk |  | `not-italian` |
| 89532 | `órgãos` | noun | 0 | plurale di órgão |  | `not-italian` |
| 89536 | `dwukropki` | noun | 0 | plurale di dwukropek |  | `not-italian` |
| 89539 | `impulsy` | noun | 0 | plurale di impuls |  | `not-italian` |
| 89546 | `skakanki` | noun | 0 | plurale di skakanka |  | `not-italian` |
| 89555 | `daggers` | noun | 0 | plurale di dagger |  | `not-italian` |
| 89557 | `mięśnie` | noun | 0 | plurale di mięsień |  | `not-italian` |
| 90003 | `milliseconds` | noun | 0 | plurale di millisecond, millisecondi |  | `not-italian` |
| 90067 | `microseconds` | noun | 0 | plurale di microsecond, microsecondi |  | `not-italian` |
| 90070 | `microsecondes` | noun | 0 | plurale di microseconde, microsecondi |  | `not-italian` |
| 90082 | `nanosecondes` | noun | 0 | plurale di nanoseconde, nanosecondi |  | `not-italian` |
| 90085 | `nanoseconds` | noun | 0 | plurale di nanosecond, nanosecondi |  | `not-italian` |
| 90096 | `apostrophes` | noun | 0 | plurale di apostrophe |  | `not-italian` |
| 90106 | `colons` | noun | 0 | plurale di colon |  | `not-italian` |
| 90112 | `space bars` | phrase | 0 | plurale di space bar, barre spaziatrici |  | `not-italian` |
| 90120 | `barre spaziatrici` | phrase | 0 | plurale di barra spaziatrice |  | `base-table-does-not-list` |
| 90186 | `prime` | adj | 1 | eccellente, di prima qualità |  | `not-italian` |
| 90196 | `lettori DVD` | phrase | 0 | plurale di lettore DVD |  | `base-table-does-not-list` |
| 90198 | `DVD players` | phrase | 0 | plurale di DVD player, lettori DVD |  | `not-italian` |
| 90232 | `stradzanos` | noun | 0 | plurale di stradzana |  | `not-italian` |
| 90239 | `laisva` | adj | 0 | femminile singolare di laisvas |  | `not-italian` |
| 90244 | `citrinos` | noun | 0 | plurale di citrina |  | `not-italian` |
| 90417 | `liaisons` | noun | 0 | plurale di liaison |  | `not-italian` |
| 90418 | `liaisons` | noun | 0 | plurale di liaison |  | `not-italian` |
| 90487 | `users` | noun | 0 | plurale di user |  | `not-italian` |
| 90488 | `utilisateurs` | noun | 0 | plurale di utilisateur |  | `not-italian` |
| 90574 | `disposta` | verb | 0 | participio passato femminile di disporre |  | `base-table-does-not-list` |
| 90636 | `allegorizzato` | verb | 0 | part. passato di allegorizzare |  | `not-a-form-gloss` |
| 91053 | `kuracje` | noun | 0 | plurale di kuracja |  | `not-italian` |
| 91054 | `irregulars` | noun | 0 | plurale di irregular |  | `not-italian` |
| 91069 | `hymny` | noun | 0 | plurale di hymn |  | `not-italian` |
| 91074 | `mjesta` | noun | 0 | plurale di mjest |  | `not-italian` |
| 91087 | `bona` | adj | 0 | femminile di bono, detto di ragazza o donna molto attraente | `donna` | `edge-names-another-word` |
| 91194 | `sezonoj` | noun | 0 | plurale di sezono |  | `not-italian` |
| 91201 | `tagoj` | noun | 0 | plurale di tago |  | `not-italian` |
| 91203 | `semajnoj` | noun | 0 | plurale di semajno |  | `not-italian` |
| 91235 | `symbioses` | noun | 0 | plurale di simbiosis |  | `not-italian` |
| 91237 | `sakes` | noun | 0 | plurale di sake |  | `not-italian` |
| 91241 | `beavers` | noun | 0 | plurale di beaver |  | `not-italian` |
| 91348 | `ospedali psichiatrici` | phrase | 0 | plurale di ospedale psichiatrico |  | `base-table-does-not-list` |
| 91351 | `abandons` | noun | 0 | plurale di abandon |  | `not-italian` |
| 91432 | `sous-anneaux` | noun | 0 | plurale di sous-anneau, sottoanelli |  | `not-italian` |
| 91435 | `subanillos` | noun | 0 | plurale di subanillo, sottoanelli |  | `not-italian` |
| 91436 | `subrings` | noun | 0 | plurale di subring, sottoanelli |  | `not-italian` |
| 91441 | `subfields` | noun | 0 | plurale di subfield, sottocampi |  | `not-italian` |
| 91473 | `schiacciati` | verb | 0 | participio passato plurale di schiacciare |  | `base-table-does-not-list` |
| 91482 | `midgets` | noun | 0 | plurale di midget |  | `not-italian` |
| 91518 | `écoutes` | noun | 0 | plurale di écoute |  | `not-italian` |
| 91528 | `parrots` | noun | 0 | plurale di parrot, pappagalli |  | `not-italian` |
| 91532 | `perroquets` | noun | 0 | plurale di perroquet |  | `not-italian` |
| 91534 | `papagaios` | noun | 0 | plurale di papagaio |  | `not-italian` |
| 91625 | `sciettini` | noun | 0 | plurale di sciettino - piccoli sci corti | `corti` | `edge-names-another-word` |
| 91660 | `gunboats` | noun | 0 | plurale di gunboat |  | `not-italian` |
| 91662 | `torpedo boats` | phrase | 0 | plurale di torpedo boat, torpediniere |  | `not-italian` |
| 91664 | `torpilleurs` | noun | 0 | plurale di torpilleur |  | `not-italian` |
| 91714 | `ferryboats` | noun | 0 | plurale di ferryboat |  | `not-italian` |
| 91774 | `currencies` | noun | 0 | plurale di currency |  | `not-italian` |
| 91863 | `raccomandati` | verb | 0 | participio passato plurale di raccomandare |  | `base-table-does-not-list` |
| 91893 | `marine` | noun | 0 | fante di marina statunitense o britannico |  | `not-a-form-gloss` |
| 91896 | `counteroffensives` | noun | 0 | plurale di counteroffensive |  | `not-italian` |
| 91897 | `offensives` | noun | 0 | plurale di offensive |  | `not-italian` |
| 91907 | `eaux-de-vie` | noun | 0 | plurale di eau-de-vie |  | `not-italian` |
| 91927 | `heels` | noun | 0 | plurale di heel |  | `not-italian` |
| 91928 | `licenses` | noun | 0 | plurale di license |  | `not-italian` |
| 91930 | `licences` | noun | 0 | plurale di licence |  | `not-italian` |
| 91989 | `dairy farmers` | phrase | 0 | plurale di dairy farmer |  | `not-italian` |
| 91992 | `fancy dresses` | phrase | 0 | plurale di fancy dress |  | `not-italian` |
| 92008 | `etimologistas` | noun | 0 | plurale di etimologista |  | `not-italian` |
| 92043 | `bonnets` | noun | 0 | plurale di bonnet |  | `not-italian` |
| 92064 | `deprimita` | verb | 0 | participio passato di deprimi |  | `not-italian` |
| 92065 | `demoralizita` | verb | 0 | participio passato di demoralizi |  | `not-italian` |
| 92092 | `marmalades` | noun | 0 | plurale di marmalade |  | `not-italian` |
| 92104 | `countergambits` | noun | 0 | plurale di countergambit, controgambetti |  | `not-italian` |
| 92118 | `she-bosses` | noun | 0 | plurale di capa |  | `not-italian` |
| 92121 | `licitazioni private` | phrase | 0 | plurale di licitazione privata |  | `base-table-does-not-list` |
| 92126 | `gabi` | adj | 0 | femminile di gabus |  | `not-italian` |
| 92158 | `undercarriages` | noun | 0 | plurale di undercarriage |  | `not-italian` |
| 92164 | `inquinamenti luminosi` | phrase | 0 | plurale di inquinamento luminoso |  | `base-table-does-not-list` |
| 92181 | `fasteners` | noun | 0 | plurale di fastener |  | `not-italian` |
| 92183 | `hyphenations` | noun | 0 | plurale di hyphenation |  | `not-italian` |
| 92480 | `mottos` | noun | 0 | plurale di motto, motti |  | `not-italian` |
| 92481 | `mottoes` | noun | 0 | plurale di motto, motti |  | `not-italian` |
| 92486 | `Sardes` | noun | 0 | plurale di Sarde |  | `not-italian` |
| 92497 | `cocinas` | noun | 0 | plurale di cocina |  | `not-italian` |
| 92498 | `cocinas` | noun | 0 | plurale di cocina |  | `not-italian` |
| 92507 | `lustro` | verb | 0 | prima persona singolare dell'indicativo presente di lustrar |  | `not-italian` |
| 92522 | `šunys` | noun | 0 | plurale di šuo |  | `not-italian` |
| 92897 | `bufonofobias` | noun | 0 | plurale di bufonofobia |  | `not-italian` |
| 93131 | `bookshelves` | noun | 0 | plurale di bookshelf |  | `not-italian` |
| 93137 | `gobbo` | noun | 0 | variante di gobba |  | `not-a-form-gloss` |
| 93207 | `spartiate` | noun | 0 | variante di spartiata |  | `not-a-form-gloss` |
| 93400 | `bumblebees` | noun | 0 | plurale di bumblebee |  | `not-italian` |
| 93935 | `kuće` | noun | 0 | plurale di kuća |  | `not-italian` |
| 93936 | `куће` | noun | 0 | plurale di кућа |  | `not-italian` |
| 93938 | `lamenti` | verb | 0 | seconda persona singolare dell'indicativo presente di lamentare | `indicativo` | `edge-names-another-word` |
| 93943 | `муве` | noun | 0 | plurale di мува |  | `not-italian` |
| 93944 | `muve` | noun | 0 | plurale di muva |  | `not-italian` |
| 93956 | `prevodi` | noun | 0 | plurale di prevod |  | `not-italian` |
| 93957 | `преводи` | noun | 0 | plurale di превод |  | `not-italian` |
| 93969 | `ordini` | verb | 3 | terza persona singolare del congiuntivo presente di ordinare | `presente` | `edge-names-another-word` |
| 93992 | `gore` | noun | 0 | plurale di gora |  | `not-italian` |
| 93994 | `горе` | noun | 0 | plurale di гора |  | `not-italian` |
| 96459 | `ubriacona` | noun | 0 | femminile singolare di ubriacone |  | `base-table-does-not-list` |
| 96462 | `ubbriacona` | noun | 0 | femminile singolare di ubbriacone |  | `base-table-does-not-list` |
| 96466 | `ubbriaca` | noun | 0 | femminile singolare di ubbriaco |  | `base-table-does-not-list` |
| 96470 | `ebriaca` | noun | 0 | femminile singolare di ebriaco |  | `base-table-does-not-list` |
| 97199 | `incantazioni` | noun | 0 | plurale di incantazione |  | `no-record-of-base` |
| 97319 | `worms` | noun | 0 | plurale di worm |  | `not-italian` |
| 97376 | `kary` | noun | 0 | plurale di kara |  | `not-italian` |
| 97588 | `luppolizzazioni` | noun | 0 | plurale di luppolizzazione |  | `no-record-of-base` |
| 97613 | `mattazioni` | noun | 0 | plurale di mattazione |  | `no-record-of-base` |
| 97971 | `ondazioni` | noun | 0 | plurale di ondazione |  | `no-record-of-base` |
| 98010 | `palatizzazioni` | noun | 0 | plurale di palatizzazione |  | `no-record-of-base` |
| 98033 | `penetrazioni` | noun | 0 | plurale di penetrazione,atto dell'immettere una punta in una superficie; atto dell'introdurre il pene nella vagina | `vagina` | `edge-names-another-word` |
| 98044 | `perfezioni` | verb | 1 | prima persona singolare del congiuntivo presente di perfezionare |  | `base-table-does-not-list` |
| 98044 | `perfezioni` | verb | 2 | seconda persona singolare del congiuntivo presente di perfezionare |  | `base-table-does-not-list` |
| 98044 | `perfezioni` | verb | 3 | terza persona singolare del congiuntivo presente di perfezionare |  | `base-table-does-not-list` |
| 98044 | `perfezioni` | verb | 4 | terza persona singolare dell'imperativo presente di perfezionare |  | `base-table-does-not-list` |
| 98077 | `nipponico` | noun | 0 | persona di etnia giapponese |  | `base-table-does-not-list` |
| 98138 | `poliaddizioni` | noun | 0 | plurale di poliaddizione |  | `base-table-does-not-list` |
| 98154 | `postulazioni` | noun | 0 | plurale di postulazione |  | `base-table-does-not-list` |
| 98179 | `metafizycy` | noun | 0 | plurale di metafizyk |  | `not-italian` |
| 98269 | `profanazioni` | noun | 0 | plurale di profanazione |  | `base-table-does-not-list` |
| 98279 | `propagulazioni` | noun | 0 | plurale di propagulazione, variante di propagolazioni |  | `no-record-of-base` |
| 98432 | `riconvenzioni` | noun | 0 | plurale di riconvenzione |  | `no-record-of-base` |
| 98505 | `sanguinazioni` | noun | 0 | plurale di sanguinazione |  | `no-record-of-base` |
| 98550 | `sdrammatizzazioni` | noun | 0 | plurale di sdrammatizzazione |  | `no-record-of-base` |
| 98744 | `suffragazioni` | noun | 0 | plurale di suffragazione |  | `no-record-of-base` |
| 98986 | `rebrobates` | noun | 0 | plurale di reprobate: reprobi / reprobe |  | `not-italian` |
| 99113 | `greetings` | noun | 0 | plurale di greeting |  | `not-italian` |
| 99126 | `belaj` | adj | 0 | plurale di bela |  | `not-italian` |
| 99127 | `beloj` | noun | 0 | plurale di belo |  | `not-italian` |
| 99158 | `bildoj` | noun | 0 | plurale di bildo, immagini |  | `not-italian` |
| 99162 | `effigies` | noun | 0 | plurale di effigies |  | `not-italian` |
| 99173 | `patroj` | noun | 0 | plurale di patro |  | `not-italian` |
| 99174 | `gepatroj` | noun | 0 | plurale di gepatro |  | `not-italian` |
| 99257 | `banners` | noun | 0 | plurale di banner |  | `not-italian` |
| 99262 | `watercrafts` | noun | 0 | plurale di watercraft |  | `not-italian` |
| 99294 | `aragonesi` | noun | 0 | plurale di aragonese |  | `base-table-does-not-list` |
| 99313 | `déboires` | noun | 0 | plurale di déboire |  | `not-italian` |
| 99320 | `combles` | noun | 0 | plurale di comble |  | `not-italian` |
| 99657 | `helpoj` | noun | 0 | plurale di helpo |  | `not-italian` |
| 99674 | `eagles` | noun | 0 | plurale di eagle |  | `not-italian` |
| 99677 | `pùlece` | noun | 0 | plurale di póllece |  | `not-italian` |
| 99725 | `conceits` | noun | 0 | plurale di conceit |  | `not-italian` |
| 99726 | `vanities` | noun | 0 | plurale di vanity |  | `not-italian` |
| 100076 | `hooks` | noun | 0 | plurale di hook |  | `not-italian` |
| 100087 | `versions` | noun | 0 | plurale di version |  | `not-italian` |
| 100088 | `chariots` | noun | 0 | plurale di chariot |  | `not-italian` |
| 100118 | `darts` | noun | 0 | plurale di dart |  | `not-italian` |
| 100366 | `barriers` | noun | 0 | plurale di barrier |  | `not-italian` |
| 100367 | `obstacles` | noun | 0 | plurale di obstacle |  | `not-italian` |
| 100368 | `obstacles` | noun | 0 | plurale di obstacle |  | `not-italian` |
| 100370 | `avancements` | phrase | 0 | plurale di avancement |  | `not-italian` |
| 100392 | `linfociti` | noun | 0 | plurale di linfocito e linfocita | `linfocita` | `edge-names-another-word` |
| 100869 | `secchi` | verb | 1 | prima persona singolare del congiuntivo presente di seccare |  | `base-table-does-not-list` |
| 100869 | `secchi` | verb | 2 | seconda persona singolare del congiuntivo presente di seccare |  | `base-table-does-not-list` |
| 100869 | `secchi` | verb | 4 | terza persona singolare dell'imperativo presente di seccare |  | `base-table-does-not-list` |
| 101166 | `porti` | verb | 2 | prima persona singolare del congiuntivo presente di portare | `congiuntivo` | `edge-names-another-word` |
| 101166 | `porti` | verb | 3 | seconda persona singolare del congiuntivo presente di portare | `congiuntivo` | `edge-names-another-word` |
| 101166 | `porti` | verb | 4 | terza persona singolare dell'imperativo di portare | `imperativo` | `edge-names-another-word` |
| 101244 | `archanioły` | noun | 0 | plurale di archanioł |  | `not-italian` |
| 101264 | `serotonine` | noun | 0 | plurale (rarissimo o previsto solo come possibilità teorica) di serotonina |  | `not-a-form-gloss` |
| 101636 | `Christianities` | noun | 0 | plurale di Christianity |  | `not-italian` |
| 101640 | `sciapito` | adj | 0 | variante regionale di scipito, influenzata dall'aggettivo sciapo |  | `not-a-form-gloss` |
| 101757 | `anomalies` | noun | 0 | plurale di anomaly |  | `not-italian` |
| 101779 | `entries` | noun | 0 | plurale di entry |  | `not-italian` |
| 101824 | `châteaux` | noun | 0 | plurale di château |  | `not-italian` |
| 102006 | `nits` | noun | 0 | plurale di nit |  | `not-italian` |
| 102007 | `nils` | noun | 0 | plurale di nil |  | `not-italian` |
| 102021 | `buildings` | noun | 0 | plurale di building |  | `not-italian` |
| 102026 | `caveats` | noun | 0 | plurale di caveat |  | `not-italian` |
| 102028 | `catapults` | noun | 0 | plurale di catapult |  | `not-italian` |
| 102030 | `resemblances` | noun | 0 | plurale di resemblance |  | `not-italian` |
| 102036 | `fidelities` | noun | 0 | plurale di fidelity |  | `not-italian` |
| 102048 | `sauté` | verb | 0 | participio passato di sauter |  | `not-italian` |
| 102051 | `sautée` | adj | 0 | femminile di sauté |  | `not-italian` |
| 102052 | `sautés` | adj | 0 | plurale di sauté |  | `not-italian` |
| 102053 | `sautées` | adj | 0 | femminile plurale di sauté |  | `not-italian` |
| 102058 | `distributions` | noun | 0 | plurale di distribution |  | `not-italian` |
| 102060 | `exponentielles` | adj | 0 | femminile plurale di exponentiel |  | `not-italian` |
| 102062 | `exponentiels` | adj | 0 | plurale di exponentiel |  | `not-italian` |
| 102065 | `morphologies` | noun | 0 | plurale di morphology |  | `not-italian` |
| 102091 | `economa` | noun | 0 | femminile (singolare) di economo |  | `not-a-form-gloss` |
| 102156 | `avventora` | noun | 0 | femminile singolare di avventore, cui andrebbe preferito l'uso del suo equivalente moderno avventrice perché, nonostante la correttezza, sta progressivamente scomparendo dalla lingua viva, sia scritta che parlata |  | `base-table-does-not-list` |
| 102183 | `gelatiniformi` | adj | 0 | plurale di gelatiniforme |  | `no-record-of-base` |
| 102331 | `sudati` | verb | 0 | participio passato plurale di sudare |  | `base-table-does-not-list` |
| 102407 | `deers` | noun | 0 | plurale di deer |  | `not-italian` |
| 102408 | `llobos` | noun | 0 | plurale di llobu |  | `not-italian` |
| 102409 | `lloba` | noun | 0 | femminile di llobu |  | `not-italian` |
| 102410 | `llobes` | noun | 0 | femminile plurale di llobu |  | `not-italian` |
| 102436 | `inveterato` | adj | 0 | nel significato letterale di inveterare, di cui è participio passato, equivale a invecchiato o, per estensione, perseverante, perdurante nel tempo; da qui derivano i significati tuttora in uso |  | `not-a-form-gloss` |
| 102449 | `maldekstraj` | adj | 0 | plurale di maldekstra |  | `not-italian` |
| 102452 | `conti sinottici` | phrase | 0 | plurale di conto sinottico |  | `base-table-does-not-list` |
| 102455 | `Schutzstaffeln` | noun | 0 | plurale di Schutzstaffel |  | `not-italian` |
| 102558 | `fraternités` | noun | 0 | plurale di fraternité |  | `not-italian` |
| 102570 | `brulicami` | noun | 0 | plurale raramente o per niente impiegato di brulicame |  | `not-a-form-gloss` |
| 102594 | `bizantino` | noun | 0 | persona di Bisanzio, l'attuale Istanbul |  | `base-table-does-not-list` |
| 102607 | `bathrobes` | noun | 0 | plurale di bathrobe |  | `not-italian` |
| 102676 | `comrades` | noun | 0 | plurale di comrade |  | `not-italian` |
| 102767 | `pugni` | verb | 4 | terza persona singolare dell' imperativo prsente di pugnare |  | `not-a-form-gloss` |
| 102780 | `clés` | noun | 0 | plurale di clé |  | `not-italian` |
| 102809 | `luces` | noun | 0 | plurale di luz |  | `not-italian` |
| 102811 | `abigarrados` | adj | 0 | plurale di abigarrado |  | `not-italian` |
| 102812 | `abigarrada` | adj | 0 | femminile di abigarrado |  | `not-italian` |
| 102813 | `abigarradas` | adj | 0 | femminile plurale di abigarrado |  | `not-italian` |
| 102938 | `taschini` | noun | 0 | plurale di taschino |  | `no-record-of-base` |
| 103014 | `mężczyźni` | noun | 0 | plurale di mężczyzna |  | `not-italian` |
| 103097 | `pasy bezpieczeństwa` | noun | 0 | plurale di pas bezpieczeństwa |  | `not-italian` |
| 103144 | `ordnances` | noun | 0 | plurale di ordnance |  | `not-italian` |
| 103181 | `bufalini` | noun | 0 | plurale di bufalino |  | `no-record-of-base` |
| 103230 | `cannabinoids` | noun | 0 | plurale di cannabinoid |  | `not-italian` |
| 103323 | `descants` | noun | 0 | plurale di descant |  | `not-italian` |
| 103348 | `hipotenusas` | noun | 0 | plurale di hipotenusa |  | `not-italian` |
| 103355 | `hypoténuses` | noun | 0 | plurale di hypoténuse |  | `not-italian` |
| 103357 | `hypotenuses` | noun | 0 | plurale di hypotenuse |  | `not-italian` |
| 103363 | `catheti` | noun | 0 | plurale di cathetus |  | `not-italian` |
| 103488 | `gherlini` | noun | 0 | plurale di gherlino |  | `no-record-of-base` |
| 103519 | `gonnellini` | noun | 0 | plurale di gonnellino |  | `no-record-of-base` |
| 103532 | `luigini` | noun | 0 | plurale di luigino |  | `no-record-of-base` |
| 103540 | `mandarins` | noun | 0 | plurale di mandarin |  | `not-italian` |
| 103643 | `srpskohrvatska` | adj | 0 | femminile di srpskohrvatski |  | `not-italian` |
| 103643 | `srpskohrvatska` | adj | 1 | plurale di srpskohrvatsko |  | `not-italian` |
| 103644 | `srprkohrvatske` | adj | 0 | plurale di srpskohrvatska |  | `not-italian` |
| 103646 | `српскохрватска` | adj | 0 | femminile di српскохрватски |  | `not-italian` |
| 103646 | `српскохрватска` | adj | 1 | plurale di српскохрватско |  | `not-italian` |
| 103647 | `српскохрватске` | adj | 0 | plurale di српскохрватска |  | `not-italian` |
| 103823 | `organzini` | noun | 0 | plurale di organzino |  | `base-table-does-not-list` |
| 103868 | `rovescini` | noun | 0 | plurale di rovescino |  | `base-table-does-not-list` |
| 103903 | `tope` | noun | 0 | plurale di topa ( vagine ) | `vagine` | `edge-names-another-word` |
| 103903 | `tope` | noun | 1 | plurale di topa ( talpe ) | `talpe` | `edge-names-another-word` |
| 103927 | `atoms` | noun | 0 | plurale di atom |  | `not-italian` |
| 104410 | `vēdekļi` | noun | 0 | plurale di vēdeklis |  | `not-italian` |
| 104420 | `lāči` | noun | 0 | plurale di lācis |  | `not-italian` |
| 104440 | `rubļi` | noun | 0 | plurale di rublis |  | `not-italian` |
| 104453 | `pulksteņi` | noun | 0 | plurale di pulkstenis |  | `not-italian` |
| 104462 | `riteņi` | noun | 0 | plurale di ritenis |  | `not-italian` |
| 104474 | `spaiņi` | noun | 0 | plurale di spainis |  | `not-italian` |
| 104521 | `filles` | noun | 0 | plurale di fille |  | `not-italian` |
| 104724 | `varas` | noun | 0 | plurale di vara |  | `not-italian` |
| 104733 | `absolventové` | noun | 0 | plurale di absolvent |  | `not-italian` |
| 104734 | `absolventi` | noun | 0 | plurale di absolvent |  | `not-italian` |
| 104772 | `abbatiaux` | adj | 0 | plurale di abbatial |  | `not-italian` |
| 104773 | `abbatiale` | adj | 0 | femminile di abbatial |  | `not-italian` |
| 104776 | `cene` | noun | 0 | plurale di cena |  | `not-italian` |
| 104794 | `vistas` | noun | 0 | plurale di vista |  | `not-italian` |
| 104795 | `vistas` | noun | 0 | plurale di vista |  | `not-italian` |
| 104796 | `vistas` | noun | 0 | plurale di vista |  | `not-italian` |
| 104797 | `vistas` | noun | 0 | plurale di vista |  | `not-italian` |
| 104807 | `chederim` | noun | 0 | plurale di cheder |  | `not-italian` |
| 104905 | `federations` | noun | 0 | plurale di federation |  | `not-italian` |
| 105017 | `runakuna` | noun | 0 | plurale di runa |  | `not-italian` |
| 105091 | `Abenteurerin` | noun | 0 | femminile di Abenteurer |  | `not-italian` |
| 105095 | `granges` | noun | 0 | plurale di grange |  | `not-italian` |
| 105153 | `lingue` | noun | 1 | plurale di lingua (idioma) | `idioma` | `edge-names-another-word` |
| 105158 | `homonimies` | noun | 0 | plurale di homonymie |  | `not-italian` |
| 105166 | `korespondecje` | noun | 0 | plurale di korespondecja |  | `not-italian` |
| 105168 | `linoskoczkowie` | noun | 0 | plurale di linoskoczek |  | `not-italian` |
| 105175 | `cienie` | noun | 0 | plurale di cień |  | `not-italian` |
| 105177 | `cienie do powiek` | phrase | 0 | plurale di cień do powiek |  | `not-italian` |
| 105181 | `gry` | noun | 0 | plurale di gra |  | `not-italian` |
| 105182 | `powieki` | noun | 0 | plurale di powieka |  | `not-italian` |
| 105183 | `hyperonimies` | noun | 0 | plurale di hyperonymie |  | `not-italian` |
| 105189 | `paronymies` | noun | 0 | plurale di paronymie |  | `not-italian` |
| 105190 | `synonymes` | noun | 0 | plurale di synonyme |  | `not-italian` |
| 105191 | `hyponymies` | noun | 0 | plurale di hyponymie |  | `not-italian` |
| 105194 | `Kuchengabeln` | noun | 0 | plurale di Kuchengabel |  | `not-italian` |
| 105195 | `mutivi` | noun | 0 | plurale di mutivo |  | `not-italian` |
| 105196 | `mutivi` | noun | 0 | plurale di mutìu |  | `not-italian` |
| 105271 | `ūsai` | noun | 0 | plurale di ūsas |  | `not-italian` |
| 105284 | `bastards` | adj | 0 | plurale di bastardo |  | `not-italian` |
| 105374 | `sālis` | noun | 0 | plurale di sāls |  | `not-italian` |
| 105381 | `sāļi` | noun | 0 | plurale di sāls |  | `not-italian` |
| 105401 | `pilis` | noun | 0 | plurale di pils |  | `not-italian` |
| 105409 | `zosis` | noun | 0 | plurale di zoss |  | `not-italian` |
| 105417 | `govis` | noun | 0 | plurale di govs |  | `not-italian` |
| 105425 | `zivis` | noun | 0 | plurale di zivs |  | `not-italian` |
| 105442 | `debesis` | noun | 2 | plurale di debess |  | `not-italian` |
| 105481 | `noons` | noun | 0 | plurale di noon |  | `not-italian` |
| 105842 | `haid` | noun | 0 | plurale di hai |  | `not-italian` |
| 105904 | `prezydenci` | noun | 0 | plurale di prezydent |  | `not-italian` |
| 105912 | `umiejętności` | noun | 0 | plurale di umiejętność |  | `not-italian` |
| 106055 | `addummi` | noun | 0 | plurale di addummu |  | `not-italian` |
| 106163 | `hermanos` | noun | 0 | plurale di hermano |  | `not-italian` |
| 106187 | `newborns` | noun | 0 | plurale di newborn |  | `not-italian` |
| 106188 | `notifications` | noun | 0 | plurale di notification |  | `not-italian` |
| 106191 | `nuclei` | noun | 0 | plurale di nucleus |  | `not-italian` |
| 106192 | `nucleuses` | noun | 0 | plurale di nucleus |  | `not-italian` |
| 106193 | `neutralizations` | noun | 0 | plurale di neutralization |  | `not-italian` |
| 106194 | `neuroses` | noun | 0 | plurale di neurosis |  | `not-italian` |
| 106195 | `overabundances` | noun | 0 | plurale di overabundance |  | `not-italian` |
| 106196 | `overcalls` | noun | 0 | plurale di overcall |  | `not-italian` |
| 106197 | `overglazes` | noun | 0 | plurale di overglaze |  | `not-italian` |
| 106226 | `integristas` | adj | 0 | plurale di integrista |  | `not-italian` |
| 106227 | `initiates` | noun | 0 | plurale di initiate |  | `not-italian` |
| 106230 | `fibers` | noun | 0 | plurale di fiber |  | `not-italian` |
| 106237 | `simboli chimici` | phrase | 0 | plurale di simbolo chimico |  | `base-table-does-not-list` |
| 106369 | `panizze` | noun | 0 | plurale di panizza |  | `not-italian` |
| 106370 | `panizze` | noun | 0 | plurale di panizza |  | `not-italian` |
| 106384 | `panicce` | noun | 0 | plurale di paniccia |  | `not-italian` |
| 106385 | `panicce` | noun | 0 | plurale di paniccia |  | `not-italian` |
| 106403 | `panisce` | noun | 0 | plurale di paniscia |  | `not-italian` |
| 106404 | `panisce` | noun | 0 | plurale di paniscia |  | `not-italian` |
| 106405 | `panisse` | noun | 0 | plurale di panissa |  | `not-italian` |
| 106406 | `panisse` | noun | 0 | plurale di panissa |  | `not-italian` |
| 106442 | `aggettivi pronominali` | phrase | 0 | plurale di aggettivo pronominale |  | `base-table-does-not-list` |
| 106450 | `policewomen` | noun | 0 | plurale di policewoman |  | `not-italian` |
| 106451 | `policemen` | noun | 0 | plurale di policeman |  | `not-italian` |
| 106493 | `brooches` | noun | 0 | plurale di brooch |  | `not-italian` |
| 106500 | `pepenadores` | noun | 0 | plurale di pepenador |  | `not-italian` |
| 106551 | `deputies` | noun | 0 | plurale di deputy |  | `not-italian` |
| 106643 | `ender` | noun | 0 | plurale di and |  | `not-italian` |
| 106652 | `krefter` | noun | 0 | plurale di kraft |  | `not-italian` |
| 106657 | `menn` | noun | 0 | plurale di mann |  | `not-italian` |
| 106658 | `netter` | noun | 0 | plurale di natt |  | `not-italian` |
| 106660 | `tenner` | noun | 0 | plurale di tann |  | `not-italian` |
| 106661 | `gjess` | noun | 0 | plurale di gås |  | `not-italian` |
| 106663 | `hender` | noun | 0 | plurale di hånd |  | `not-italian` |
| 106665 | `tær` | noun | 0 | plurale di tå |  | `not-italian` |
| 106666 | `bøker` | noun | 0 | plurale di bok |  | `not-italian` |
| 106667 | `føtter` | noun | 0 | plurale di fot |  | `not-italian` |
| 106670 | `kyr` | noun | 0 | plurale di ku |  | `not-italian` |
| 106671 | `røtter` | noun | 0 | plurale di rot |  | `not-italian` |
| 106673 | `øyne` | noun | 0 | plurale di øye |  | `not-italian` |
| 106676 | `esler` | noun | 0 | plurale di esel |  | `not-italian` |
| 106677 | `trær` | noun | 0 | plurale di tre |  | `not-italian` |
| 106678 | `hadak` | noun | 0 | plurale di had |  | `not-italian` |
| 106745 | `flesse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di flettere |  | `base-table-does-not-list` |
| 106913 | `krenkelser` | verb | 0 | plurale di krenkelse |  | `not-italian` |
| 107059 | `partioj` | noun | 0 | plurale di partio |  | `not-italian` |
| 107156 | `coniugati` | verb | 0 | participio passato plurale di coniugare |  | `base-table-does-not-list` |
| 107180 | `richiamata` | verb | 0 | participio passato femminile di richiamare |  | `base-table-does-not-list` |
| 107247 | `assoggettato` | verb | 0 | participio passato di assoggettare, assoggettarsi | `assoggettarsi` | `edge-names-another-word` |
| 107325 | `finiti` | verb | 0 | participio passato plurale di finire |  | `base-table-does-not-list` |
| 107472 | `fák` | noun | 0 | plurale di fa |  | `not-italian` |
| 107480 | `idők` | noun | 0 | plurale di idő |  | `not-italian` |
| 107756 | `sequels` | noun | 0 | plurale di sequel |  | `not-italian` |
| 107806 | `runs` | noun | 0 | plurale di run |  | `not-italian` |
| 107838 | `esacerbato` | verb | 0 | participio passato di esacerbare, esacerbarsi | `esacerbarsi` | `edge-names-another-word` |
| 107869 | `spells` | noun | 0 | plurale di spell |  | `not-italian` |
| 107910 | `lays` | noun | 0 | plurale di lay |  | `not-italian` |
| 108016 | `katoj` | noun | 0 | plurale di kato |  | `not-italian` |
| 108019 | `amikoj` | noun | 0 | plurale di amiko |  | `not-italian` |
| 108020 | `geamikoj` | noun | 0 | plurale di amiko, usato per indicare un gruppo di sesso diverso |  | `not-italian` |
| 108070 | `batatas` | noun | 0 | plurale di batata |  | `not-italian` |
| 108104 | `noobs` | noun | 0 | plurale di noob |  | `not-italian` |
| 108158 | `acidaj` | adj | 0 | plurale di acida |  | `not-italian` |
| 108161 | `akraj` | adj | 0 | plurale di akra |  | `not-italian` |
| 108163 | `akutaj` | adj | 0 | plurale di akuta |  | `not-italian` |
| 108166 | `aliaj` | adj | 0 | plurale di alia |  | `not-italian` |
| 108171 | `altaj` | adj | 0 | plurale di alta |  | `not-italian` |
| 108174 | `anglaj` | adj | 0 | plurale di angla |  | `not-italian` |
| 108177 | `apertaj` | adj | 0 | plurale di aperta |  | `not-italian` |
| 108182 | `bigotoj` | noun | 0 | plurale di bigoto |  | `not-italian` |
| 108185 | `blankaj` | adj | 0 | plurale di blanka |  | `not-italian` |
| 108188 | `bonaj` | adj | 0 | plurale di bona |  | `not-italian` |
| 108189 | `edzoj` | noun | 0 | plurale di edzo |  | `not-italian` |
| 108194 | `flavaj` | adj | 0 | plurale di flava |  | `not-italian` |
| 108210 | `dekstraj` | adj | 0 | plurale di dekstra |  | `not-italian` |
| 108213 | `dikaj` | adj | 0 | plurale di dika |  | `not-italian` |
| 108217 | `glataj` | adj | 0 | plurale di glata |  | `not-italian` |
| 108221 | `grandaj` | adj | 0 | plurale di granda |  | `not-italian` |
| 108224 | `pezaj` | adj | 0 | plurale di peza |  | `not-italian` |
| 108277 | `abbigliata` | verb | 0 | participio passato femminile di abbigliare |  | `base-table-does-not-list` |
| 108285 | `abitati` | verb | 0 | participio passato plurale di abitare |  | `base-table-does-not-list` |
| 108386 | `korektaj` | adj | 0 | plurale di korekta |  | `not-italian` |
| 108389 | `larĝaj` | adj | 0 | plurale di larĝa |  | `not-italian` |
| 108392 | `longaj` | adj | 0 | plurale di longa |  | `not-italian` |
| 108395 | `nigraj` | adj | 0 | plurale di nigra |  | `not-italian` |
| 108398 | `ruĝaj` | adj | 0 | plurale di ruĝa |  | `not-italian` |
| 108401 | `verdaj` | adj | 0 | plurale di verda |  | `not-italian` |
| 108402 | `patraj` | adj | 0 | plurale di patra |  | `not-italian` |
| 108407 | `palaj` | adj | 0 | plurale di pala |  | `not-italian` |
| 108419 | `spazi funzionali` | phrase | 0 | plurale di spazio funzionale |  | `base-table-does-not-list` |
| 108423 | `premi Nobel` | phrase | 0 | plurale di premio Nobel |  | `base-table-does-not-list` |
| 108505 | `reĝoj` | noun | 0 | plurale di reĝo |  | `not-italian` |
| 108508 | `arĉoj` | noun | 0 | plurale di arĉo |  | `not-italian` |
| 108511 | `plektroj` | noun | 0 | plurale di plektro |  | `not-italian` |
| 108517 | `silabadoj` | noun | 0 | plurale di silabado |  | `not-italian` |
| 108532 | `statuoj` | noun | 0 | plurale di statuo |  | `not-italian` |
| 108830 | `territories` | noun | 0 | plurale di territory, territori |  | `not-italian` |
| 108891 | `valvole di ritegno` | phrase | 0 | plurale di valvola di ritegno |  | `base-table-does-not-list` |
| 108916 | `angolok` | noun | 0 | plurale di angol |  | `not-italian` |
| 108964 | `hobbies` | noun | 0 | plurale di hobby, passatempi | `passatempi` | `edge-names-another-word` |
| 109101 | `fejek` | noun | 0 | plurale di fej |  | `not-italian` |
| 109298 | `имена существительные` | noun | 0 | plurale di имя существительное |  | `not-italian` |
| 109307 | `brutte` | noun | 0 | plurale di brutta, forma femminile di brutto | `brutto` | `edge-names-another-word` |
| 109376 | `creata` | verb | 0 | participio passato femminile di creare |  | `base-table-does-not-list` |
| 109514 | `риби` | noun | 0 | plurale di pesce |  | `not-italian` |
| 109635 | `affairs` | noun | 0 | plurale di affair |  | `not-italian` |
| 110305 | `pregna` | adj | 0 | femminile di pregno |  | `base-table-does-not-list` |
| 110512 | `ŝnuroj` | noun | 0 | plurale di ŝnuro |  | `not-italian` |
| 110559 | `vivoj` | noun | 0 | plurale di vivo |  | `not-italian` |
| 110592 | `fluoj` | noun | 0 | plurale di fluo |  | `not-italian` |
| 110596 | `fluksoj` | noun | 0 | plurale di flukso |  | `not-italian` |
| 110600 | `flusoj` | noun | 0 | plurale di fluso |  | `not-italian` |
| 110604 | `homaroj` | noun | 0 | plurale di homaro |  | `not-italian` |
| 110607 | `homoj` | noun | 0 | plurale di homo |  | `not-italian` |
| 110610 | `fotiloj` | noun | 0 | plurale di fotilo |  | `not-italian` |
| 110613 | `ĉevalidoj` | noun | 0 | plurale di ĉevalido |  | `not-italian` |
| 110617 | `kokinoj` | noun | 0 | plurale di kokino |  | `not-italian` |
| 110618 | `kokidoj` | noun | 0 | plurale di kokido |  | `not-italian` |
| 110623 | `kokoj` | noun | 0 | plurale di koko |  | `not-italian` |
| 110626 | `anoj` | noun | 0 | plurale di ano |  | `not-italian` |
| 110629 | `animoj` | noun | 0 | plurale di animo |  | `not-italian` |
| 110640 | `mores` | noun | 0 | plurale di mos |  | `not-italian` |
| 110642 | `pères` | noun | 0 | plurale di père |  | `not-italian` |
| 110644 | `beaux-pères` | noun | 0 | plurale di beau-père |  | `not-italian` |
| 110683 | `federiĝoj` | noun | 0 | plurale di federiĝo |  | `not-italian` |
| 110687 | `federacioj` | noun | 0 | plurale di federacio |  | `not-italian` |
| 110691 | `tondiloj` | noun | 0 | plurale di tondilo |  | `not-italian` |
| 110707 | `paĉjoj` | noun | 0 | plurale di paĉjo |  | `not-italian` |
| 110717 | `maldikuloj` | noun | 0 | plurale di maldikulo |  | `not-italian` |
| 110720 | `iuj` | noun | 0 | plurale di iu |  | `not-italian` |
| 110727 | `pafoĉesigoj` | noun | 0 | plurale di pafoĉesigo |  | `not-italian` |
| 110731 | `pafopaŭzoj` | noun | 0 | plurale di pafopaŭzo |  | `not-italian` |
| 110735 | `grands-pères` | noun | 0 | plurale di grand-père |  | `not-italian` |
| 110737 | `grands-mères` | noun | 0 | plurale di grand-mère |  | `not-italian` |
| 110811 | `enterrements` | noun | 0 | plurale di enterrement |  | `not-italian` |
| 110833 | `travaux` | noun | 0 | plurale di travail |  | `not-italian` |
| 110837 | `revolucioj` | noun | 0 | plurale di revolucio |  | `not-italian` |
| 110859 | `assorto` | verb | 1 | participio passato di assorbire (si veda assorbito) | `assorbito` | `edge-names-another-word` |
| 110874 | `rivoluoj` | noun | 0 | plurale di rivoluo |  | `not-italian` |
| 110966 | `diskutoj` | noun | 0 | plurale di diskuto |  | `not-italian` |
| 110970 | `debatoj` | noun | 0 | plurale di debato |  | `not-italian` |
| 110973 | `ĉi tiuj` | adj | 0 | plurale di ĉi tiu |  | `not-italian` |
| 111006 | `sinusoj` | noun | 0 | plurale di sinuso |  | `not-italian` |
| 111012 | `tangentoj` | noun | 0 | plurale di tangento |  | `not-italian` |
| 111015 | `kotangentoj` | noun | 0 | plurale di kotangento |  | `not-italian` |
| 111018 | `kosinusoj` | noun | 0 | plurale di kosinuso |  | `not-italian` |
| 111044 | `vortoj` | noun | 0 | plurale di vorto |  | `not-italian` |
| 111077 | `kafoj` | noun | 0 | plurale di kafo |  | `not-italian` |
| 111080 | `laktokafoj` | noun | 0 | plurale di laktokafo |  | `not-italian` |
| 111084 | `laktoj` | noun | 0 | plurale di lakto |  | `not-italian` |
| 111089 | `skoltoj` | noun | 0 | plurale di skolto |  | `not-italian` |
| 111093 | `ovoj` | noun | 0 | plurale di ovo |  | `not-italian` |
| 111099 | `edzinmurdoj` | noun | 0 | plurale di edzinmurdo |  | `not-italian` |
| 111102 | `edzomurdoj` | noun | 0 | plurale di edzomurdo |  | `not-italian` |
| 111106 | `murdoj` | noun | 0 | plurale di murdo |  | `not-italian` |
| 111238 | `acciai inossidabili` | phrase | 0 | plurale di acciaio inossidabile |  | `base-table-does-not-list` |
| 111371 | `huéspedes` | noun | 0 | plurale di huésped |  | `not-italian` |
| 111533 | `abbottonato` | adj | 1 | persona di carattere chiuso e riservato |  | `base-table-does-not-list` |
| 111587 | `stampate` | verb | 1 | seconda persona plurale dell'indicativo presente di stampare |  | `base-table-does-not-list` |
| 111971 | `bachi da seta` | phrase | 0 | plurale di baco da seta |  | `base-table-does-not-list` |
| 112112 | `interessi` | verb | 1 | prina persona singolare del congiuntivo presente di interessare |  | `not-a-form-gloss` |
| 112166 | `lenzuoli` | noun | 0 | plurale di lenzuolo, utilizzato riferendosi al plurale di singolari, e non a una coppia. Per una coppia usa il plurale femminile lenzuola | `lenzuola` | `edge-names-another-word` |
| 112167 | `lenzuola` | noun | 0 | plurale di lenzuolo per intendere la coppia di lenzuola con cui si prepara il letto | `letto` | `edge-names-another-word` |
| 112486 | `rapporti` | verb | 1 | prima persona singolare del congiuntivo presente di rapportare |  | `base-table-does-not-list` |
| 112486 | `rapporti` | verb | 2 | seconda persona singolare del congiuntivo presente di rapportare |  | `base-table-does-not-list` |
| 112486 | `rapporti` | verb | 3 | terza persona singolare del congiuntivo presente di rapportare |  | `base-table-does-not-list` |
| 112486 | `rapporti` | verb | 4 | terza persona singolare dell'imperativo presente di rapportare |  | `base-table-does-not-list` |
| 112562 | `calabraise` | adj | 0 | femminile di calabrais |  | `not-italian` |
| 112788 | `houseisms` | noun | 0 | plurale di houseism |  | `not-italian` |
| 113287 | `house-isms` | noun | 0 | plurale di house-ism |  | `not-italian` |
| 113293 | `Americas` | name | 1 | plurale di America |  | `not-italian` |
| 113309 | `wellerisms` | noun | 0 | plurale di wellerism |  | `not-italian` |
| 113504 | `books` | noun | 0 | plurale di book, libro |  | `not-italian` |
| 113505 | `bottles` | noun | 0 | plurale di bottle, bottiglie |  | `not-italian` |
| 113810 | `smacchi` | verb | 1 | prima persona singolare del congiuntivo presente di smacchiare |  | `no-record-of-base` |
| 113810 | `smacchi` | verb | 2 | seconda persona singolare del congiuntivo presente di smacchiare |  | `no-record-of-base` |
| 113810 | `smacchi` | verb | 3 | terza persona singolare del congiuntivo presente di smacchiare |  | `no-record-of-base` |
| 113810 | `smacchi` | verb | 4 | terza persona singolare dell'imperativo presente di smacchiare |  | `no-record-of-base` |
| 113896 | `suddivisi` | verb | 1 | participio passato maschile plurale di suddividere, suddividersi | `suddividersi` | `edge-names-another-word` |
| 113948 | `arrostito` | verb | 0 | participio passato di arrostire, arrostirsi | `arrostirsi` | `edge-names-another-word` |
| 114308 | `tuffi a candela` | phrase | 0 | plurale di tuffo a candela |  | `base-table-does-not-list` |
| 114380 | `riflessi` | verb | 0 | participio passato plurale di riflettere |  | `base-table-does-not-list` |
| 114380 | `riflessi` | verb | 1 | prima persona singolare dell'indicativo passato remoto di riflettere |  | `base-table-does-not-list` |
| 114768 | `carbonara` | noun | 0 | femminile di carbonara |  | `names-itself` |
| 114989 | `orbita` | verb | 1 | seconda persona singolare dell'imperativo presente di orbitare |  | `no-record-of-base` |
| 115244 | `vigne` | noun | 0 | ceppo di vigna |  | `not-italian` |
| 116100 | `imballato` | verb | 0 | participio passato di imballare, imballarsi | `imballarsi` | `edge-names-another-word` |
| 116107 | `midzoj` | noun | 0 | plurale di midzo |  | `not-italian` |
| 116445 | `disordinato` | verb | 0 | participio passato maschile singolare di disordinàre |  | `no-record-of-base` |
| 116447 | `disordinati` | verb | 0 | participio passato plurale di disordinare |  | `base-table-does-not-list` |
| 116583 | `azzuffino` | verb | 0 | terza persona plurale del congiuntivo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 116583 | `azzuffino` | verb | 1 | terza persona plurale dell'imperativo di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 116599 | `vituperi` | noun | 0 | plurale di vituperio, vitupero | `vitupero` | `edge-names-another-word` |
| 117038 | `membra` | noun | 0 | plurale di membro; arti | `arti` | `edge-names-another-word` |
| 117128 | `colli di bottiglia` | phrase | 0 | plurale di collo di bottiglia |  | `base-table-does-not-list` |
| 117189 | `ruminante` | adj | 0 | che è in grado di ruminare, cioè di far tornare dal rumine alla bocca il cibo per una seconda masticazione |  | `not-a-form-gloss` |
| 117199 | `dù` | adj | 0 | femminile di düü |  | `not-italian` |
| 117204 | `trè` | adj | 0 | femminile di trii |  | `not-italian` |
| 117533 | `steloj` | noun | 0 | plurale di stelo |  | `not-italian` |
| 117536 | `sunoj` | noun | 0 | plurale di suno |  | `not-italian` |
| 117553 | `koroj` | noun | 0 | plurale di koro |  | `not-italian` |
| 117556 | `manoj` | noun | 0 | plurale di mano |  | `not-italian` |
| 117584 | `grafinoj` | noun | 0 | plurale di grafino |  | `not-italian` |
| 117587 | `grafoj` | noun | 0 | plurale di grafo |  | `not-italian` |
| 117635 | `lanoj` | noun | 0 | plurale di lano |  | `not-italian` |
| 117643 | `jaroj` | noun | 0 | plurale di jaro |  | `not-italian` |
| 117648 | `lundoj` | noun | 0 | plurale di lundo |  | `not-italian` |
| 117652 | `mardoj` | noun | 0 | plurale di mardo |  | `not-italian` |
| 117655 | `merkredoj` | noun | 0 | plurale di merkredo |  | `not-italian` |
| 117658 | `ĵaŭdoj` | noun | 0 | plurale di ĵaŭdo |  | `not-italian` |
| 117661 | `vendredoj` | noun | 0 | plurale di vendredo |  | `not-italian` |
| 117664 | `sabatoj` | noun | 0 | plurale di sabato |  | `not-italian` |
| 117667 | `dimanĉoj` | noun | 0 | plurale di dimanĉo |  | `not-italian` |
| 117672 | `printempoj` | noun | 0 | plurale di printempo |  | `not-italian` |
| 117675 | `someroj` | noun | 0 | plurale di somero |  | `not-italian` |
| 117679 | `aŭtunoj` | noun | 0 | plurale di aŭtuno |  | `not-italian` |
| 117683 | `vintroj` | noun | 0 | plurale di vintro |  | `not-italian` |
| 117984 | `securities` | noun | 0 | plurale di security, garanzie |  | `not-italian` |
| 118179 | `vikioj` | noun | 0 | plurale di vikio |  | `not-italian` |
| 118232 | `akvoj` | noun | 0 | plurale di akvo |  | `not-italian` |
| 118242 | `vinoj` | noun | 0 | plurale di vino |  | `not-italian` |
| 118245 | `oleoj` | noun | 0 | plurale di oleo |  | `not-italian` |
| 118265 | `volovanoj` | noun | 0 | plurale di volovano |  | `not-italian` |
| 118269 | `ĥedivoj` | noun | 0 | plurale di ĥedivo |  | `not-italian` |
| 118273 | `limesoj` | noun | 0 | plurale di limeso |  | `not-italian` |
| 118430 | `gitaroj` | noun | 0 | plurale di gitaro |  | `not-italian` |
| 118465 | `trincia` | verb | 1 | seconda persona singolare dell'imperativo presente di trinciare | `presente` | `edge-names-another-word` |
| 118607 | `arcok` | noun | 0 | plurale di arc |  | `not-italian` |
| 118688 | `naissances` | noun | 0 | plurale di naissance |  | `not-italian` |
| 118800 | `szállodák` | noun | 0 | plurale di szálloda |  | `not-italian` |
| 119439 | `diciottenne` | noun | 0 | persona di diciotto anni |  | `base-table-does-not-list` |
| 120095 | `abalieni` | verb | 1 | prima persona singolare del congiuntivo presente di abalienare | `congiuntivo` | `edge-names-another-word` |
| 120095 | `abalieni` | verb | 4 | terza persona singolare dell'imperativo presente di abalienare | `imperativo` | `edge-names-another-word` |
| 120096 | `abaliena` | verb | 1 | seconda persona singolare dell'imperativo presente di abalienare | `imperativo` | `edge-names-another-word` |
| 120098 | `abalieniamo` | verb | 1 | prima persona plurale del congiuntivo presente di abalienare | `congiuntivo` | `edge-names-another-word` |
| 120098 | `abalieniamo` | verb | 2 | prima persona plurale dell'imperativo presente di abalienare | `imperativo` | `edge-names-another-word` |
| 120100 | `abalienate` | verb | 1 | seconda persona plurale dell'imperativo presente di abalienare | `imperativo` | `edge-names-another-word` |
| 120128 | `abalienino` | verb | 1 | terza persona plurale dell'imperativo presente di abalienare | `imperativo` | `edge-names-another-word` |
| 120301 | `tamarro` | noun | 1 | persona di giovane età proveniente dalla periferia che aderisce a determinati aspetti della moda in maniera molto appariscente |  | `base-table-does-not-list` |
| 120594 | `raffinata` | verb | 0 | participio passato femminile di raffinare |  | `base-table-does-not-list` |
| 120620 | `assunto` | verb | 0 | participio passato di assumere, assumersi | `assumersi` | `edge-names-another-word` |
| 121150 | `cazzara` | noun | 0 | forma femminile di cazzaro |  | `not-a-form-gloss` |
| 121157 | `cazara` | noun | 0 | forma femminile di cazaro |  | `not-a-form-gloss` |
| 121337 | `L` | character | 0 | maiuscolo di l nell'alfabeto latino |  | `not-italian` |
| 121338 | `L` | character | 0 | maiuscolo di l nell'alfabeto italiano; si trova all'inizio del periodo o come iniziale di un nome proprio |  | `not-a-form-gloss` |
| 121408 | `luterana` | adj | 0 | femminile di luterano: luterana | `luterana` | `edge-names-another-word` |
| 121409 | `luterana` | noun | 0 | femminile di luterano: luterana | `luterana` | `edge-names-another-word` |
| 121770 | `ossi` | noun | 0 | plurale di osso; quando si intende un insieme organico, come per esempio lo scheletro, si usa ossa | `ossa` | `edge-names-another-word` |
| 121801 | `ceka` | noun | 0 | forma femminile di ceko |  | `not-a-form-gloss` |
| 121840 | `akordoj` | noun | 0 | plurale di akordo |  | `not-italian` |
| 121844 | `kokosoj` | noun | 0 | plurale di kokoso |  | `not-italian` |
| 121848 | `kokosnuksoj` | noun | 0 | plurale di kokosnukso |  | `not-italian` |
| 121856 | `citronoj` | noun | 0 | plurale di citrono |  | `not-italian` |
| 121870 | `nTrw` | noun | 0 | plurale di maschile nTr, gli dei |  | `not-italian` |
| 121918 | `nfrw` | noun | 0 | plurale di nfr |  | `not-italian` |
| 121920 | `nfrt` | noun | 0 | femminile di nfr |  | `not-italian` |
| 122080 | `panoj` | noun | 0 | plurale di pano |  | `not-italian` |
| 122083 | `tomatoj` | noun | 0 | plurale di tomato |  | `not-italian` |
| 122159 | `boues` | noun | 0 | plurale di boue |  | `not-italian` |
| 122160 | `cispe` | noun | 0 | plurale di cispa | `plurale` | `edge-names-another-word` |
| 122266 | `abbracciato` | verb | 0 | participio passato maschile singolare di abbracciare, abbracciarsi | `abbracciarsi` | `edge-names-another-word` |
| 122386 | `mieloj` | noun | 0 | plurale di mielo |  | `not-italian` |
| 122430 | `Dee` | noun | 0 | plurale di dea |  | `base-table-does-not-list` |
| 122437 | `abbracciati` | verb | 0 | participio passato plurale di abbracciare |  | `base-table-does-not-list` |
| 122456 | `Cosi` | noun | 0 | plurale di Coso |  | `not-italian` |
| 122458 | `Cosa` | noun | 0 | femminile di Coso |  | `not-italian` |
| 122564 | `pankestoj` | noun | 0 | plurale di pankesto |  | `not-italian` |
| 122567 | `knedokestoj` | noun | 0 | plurale di knedokesto |  | `not-italian` |
| 122585 | `ĉefpaĝoj` | noun | 0 | plurale di ĉefpaĝo |  | `not-italian` |
| 122588 | `ĉefaj` | adj | 0 | plurale di ĉefa |  | `not-italian` |
| 122592 | `precipaj` | adj | 0 | plurale di precipa |  | `not-italian` |
| 122596 | `retpoŝtoj` | noun | 0 | plurale di retpoŝto |  | `not-italian` |
| 122989 | `diffamato` | verb | 0 | participio passato di diffamare, diffamarsi | `diffamarsi` | `edge-names-another-word` |
| 122991 | `infamato` | verb | 0 | participio passato di infamare, infamarsi | `infamarsi` | `edge-names-another-word` |
| 123440 | `gràcies` | noun | 0 | Plurale di gràcia |  | `not-italian` |
| 124409 | `futók` | noun | 0 | plurale di futó |  | `not-italian` |
| 124410 | `fotelek` | noun | 0 | plurale di fotel |  | `not-italian` |
| 125004 | `katasztrófák` | noun | 0 | plurale di katasztrófa |  | `not-italian` |
| 125191 | `covata` | verb | 0 | participio passato femminile di covare |  | `base-table-does-not-list` |
| 125232 | `strafaccio` | verb | 0 | prima persona singolare dell'indicativo presente di strafare |  | `no-record-of-base` |
| 125267 | `elettrochimico` | noun | 0 | studioso di elettrochimica |  | `not-a-form-gloss` |
| 125391 | `rottami` | verb | 3 | terza persona singolare di rottamare del congiuntivo presente | `presente` | `edge-names-another-word` |
| 125412 | `sinistrato` | verb | 0 | participio passato singolare maschile di sinistrare |  | `no-record-of-base` |
| 125435 | `scorciato` | verb | 0 | participio passato di scorciare , scorciarsi | `scorciarsi` | `edge-names-another-word` |
| 125756 | `manifesto` | verb | 0 | prima persona singolare dell' indicativo presente di manifestare | `indicativo` | `edge-names-another-word` |
| 125829 | `nunzie` | noun | 0 | plurale di nunzia, vedi nunzio | `nunzio` | `edge-names-another-word` |
| 125899 | `stolte` | noun | 0 | plurale di stolta, vedi stolto | `stolto` | `edge-names-another-word` |
| 125907 | `bisabuela` | noun | 0 | femminile di bisabuelo |  | `not-italian` |
| 125908 | `bisabuelas` | noun | 0 | plurale di bisabuela, vedi bisabuelo |  | `not-italian` |
| 125909 | `bisabuelos` | noun | 0 | plurale di bisabuelo |  | `not-italian` |
| 126319 | `striglia` | verb | 1 | seconda persona singolare dell'imperativo presente di strigliare |  | `base-table-does-not-list` |
| 126450 | `strappato` | verb | 0 | participio passato di strappare, strapparsi | `strapparsi` | `edge-names-another-word` |
| 126487 | `harangok` | noun | 0 | plurale di harang |  | `no-record-of-base` |
| 126510 | `scoppiato` | verb | 0 | participio passato maschile di scoppiare, scoppiarsi | `scoppiarsi` | `edge-names-another-word` |
| 126533 | `μήλα` | noun | 0 | plurale di μήλο |  | `not-italian` |
| 127733 | `scantinato` | verb | 0 | participio passato di scantinare |  | `no-record-of-base` |
| 127941 | `rimbambito` | verb | 0 | participio passato di rimbambire, rimbambirsi | `rimbambirsi` | `edge-names-another-word` |
| 128427 | `Eichel` | noun | 2 | plurale di Eichel fiori |  | `not-italian` |
| 128956 | `agitée` | adj | 0 | femminile di agité |  | `not-italian` |
| 129779 | `diramato` | verb | 0 | participio presente di diramare, diramarsi | `diramarsi` | `edge-names-another-word` |
| 130071 | `pascente` | verb | 0 | participio presente di pascere |  | `base-table-does-not-list` |
| 130077 | `parlante` | adj | 0 | che può di parlare |  | `not-a-form-gloss` |
| 130713 | `sowy` | noun | 1 | plurale di sowa |  | `not-italian` |
| 130729 | `catube` | noun | 0 | plurale di catuba |  | `no-record-of-base` |
| 131036 | `متون` | noun | 0 | plurale di متن |  | `not-italian` |
| 131105 | `retadresoj` | noun | 0 | plurale di retadreso |  | `not-italian` |
| 131640 | `spogliato` | verb | 0 | participio passato di spogliare, spogliarsi | `spogliarsi` | `edge-names-another-word` |
| 131837 | `dormiente` | adj | 1 | attributo araldico che si applica agli animali rappresentati in atto di dormire, quindi sdraiati a terra e con la testa poggiata sulle zampe o tra di esse; il tronco dell'animale è appoggiato per terra così come la testa |  | `not-a-form-gloss` |
| 132277 | `custodito` | verb | 0 | participio passato di custodire, custodirsi | `custodirsi` | `edge-names-another-word` |
| 132294 | `incastonato` | verb | 0 | participio passato di incastonare, incastonarsi | `incastonarsi` | `edge-names-another-word` |
| 132418 | `bevente` | adj | 0 | attributo araldico che si applica alla figura umana o all'animale in atto di bere |  | `not-a-form-gloss` |
| 133067 | `curvato` | verb | 0 | participio passato di curvare, curvarsi | `curvarsi` | `edge-names-another-word` |
| 133241 | `facinorosa` | adj | 0 | femminile di facinoroso, ovvero incline alla violenza e alla ribellione. | `ribellione` | `edge-names-another-word` |
| 133319 | `rissa` | verb | 1 | seconda persona singolare dell'imperativo presente di rissare |  | `no-record-of-base` |
| 133426 | `appoggio` | noun | 2 | diritto di appoggiare il proprio edificio al muro di un altro |  | `not-a-form-gloss` |
| 133797 | `panettiere` | noun | 0 | femminile plurale di panettiere |  | `names-itself` |
| 133805 | `cancelliere` | noun | 0 | femminile plurale di cancelliere |  | `names-itself` |
| 133831 | `bloccato` | verb | 0 | participio passato maschile di bloccare, bloccarsi | `bloccarsi` | `edge-names-another-word` |
| 134052 | `carpentiere` | noun | 0 | femminile plurale di carpentiere |  | `names-itself` |
| 134071 | `finanza` | noun | 2 | plurale di finanza (1) condizioni monetarie |  | `names-itself` |
| 134288 | `latitante` | adj | 2 | participio presente singolare di latitare |  | `base-table-does-not-list` |
| 134405 | `confinante` | noun | 0 | persona di un altro territorio (o abitazione) ma con una parte del confine in comune |  | `base-table-does-not-list` |
| 134456 | `teso` | verb | 1 | prima persona singolare dell'indicativo presente di tesare |  | `no-record-of-base` |
| 134583 | `جزایر` | noun | 0 | plurale di جزیره |  | `not-italian` |
| 134722 | `chianchera` | noun | 0 | femminile di chianchiere |  | `not-italian` |
| 135518 | `giusto` | adj | 4 | persona di levatura spirituale |  | `no-record-of-base` |
| 135566 | `bagnati` | verb | 0 | participio passato plurale di bagnare |  | `base-table-does-not-list` |
| 136294 | `sfibrante` | verb | 0 | participio presente di sfibrare, sfibrarsi | `sfibrarsi` | `edge-names-another-word` |
| 136384 | `saputo` | noun | 0 | persona che crede di sapere tutto |  | `not-a-form-gloss` |
| 136660 | `fumata` | verb | 0 | participio passato femminile di fumare |  | `base-table-does-not-list` |
| 136697 | `intasato` | verb | 0 | participio passato di intasare, intasarsi | `intasarsi` | `edge-names-another-word` |
| 136821 | `tradotta` | verb | 0 | participio passato femminile di tradurre |  | `base-table-does-not-list` |
| 136913 | `smusso` | verb | 0 | prima persona singolare dell'indicativo presente di smussare, smussarsi | `smussarsi` | `edge-names-another-word` |
| 136944 | `invaghito` | verb | 0 | participio passato di invaghire, invaghirsi | `invaghirsi` | `edge-names-another-word` |
| 137140 | `circondato` | verb | 0 | participio passato di circondare, circondarsi | `circondarsi` | `edge-names-another-word` |
| 137142 | `accerchiato` | verb | 0 | participio passato di accerchiare, accerchiarsi | `accerchiarsi` | `edge-names-another-word` |
| 137561 | `sviluppato` | verb | 0 | participio passato maschile singolare di sviluppare, svilupparsi | `svilupparsi` | `edge-names-another-word` |
| 137581 | `trasmesso` | verb | 0 | participio passato maschile singolare di trasmettere, trasmettersi | `trasmettersi` | `edge-names-another-word` |
| 137652 | `comando` | noun | 1 | autorità o potere di comandare, di dare ordini e di disporre, nonché l'incarico di chi dispone di tale potere, con le responsabilità conseguenti |  | `not-a-form-gloss` |
| 137673 | `sincera` | verb | 1 | seconda persona singolare dell'imperativo presente di sincerare, sincerarsi |  | `no-record-of-base` |
| 137690 | `aminoglycosides` | noun | 0 | plurale di aminoglycoside |  | `not-italian` |
| 137705 | `receptors` | noun | 0 | plurale di receptor |  | `not-italian` |
| 138424 | `fratturato` | verb | 0 | participio passato maschile di fratturare, fratturarsi | `fratturarsi` | `edge-names-another-word` |
| 138547 | `mutilato` | verb | 0 | participio passato maschile di mutilare, (dal latino mutilare che deriva d mutĭlus cioè "mutilo" | `mutilo` | `edge-names-another-word` |
| 138751 | `offerto` | verb | 0 | participio passato maschile di offrire, offrirsi | `offrirsi` | `edge-names-another-word` |
| 138813 | `gestrice` | noun | 0 | femminile di gestore |  | `base-table-does-not-list` |
| 138988 | `nutrigenomica` | adj | 0 | femminile di nutrigenomico |  | `no-record-of-base` |
| 139036 | `suertes` | noun | 0 | plurale di suerte |  | `not-italian` |
| 139041 | `dientes` | noun | 0 | plurale di diente |  | `not-italian` |
| 139126 | `glondrinas` | noun | 0 | plurale di golondrina |  | `not-italian` |
| 139138 | `argumentos` | noun | 0 | plurale di argumento |  | `not-italian` |
| 139148 | `sbieco` | verb | 0 | prima persona singolare dell'indicativo presente di sbiecare |  | `no-record-of-base` |
| 139346 | `botanico` | noun | 0 | studioso di botanica |  | `not-a-form-gloss` |
| 139779 | `rilasciato` | verb | 0 | participio passato di rilasciare, rilasciarsi | `rilasciarsi` | `edge-names-another-word` |
| 140242 | `statistico` | noun | 0 | studioso di statistica |  | `not-a-form-gloss` |
| 140330 | `Messrs` | abbrev | 0 | plurale di Mr, come abbreviazione di mister ossia "signore"; utilizzato comunemente in forma scritta come titolo onorifico generico plurale per gli uomini |  | `not-italian` |
| 140331 | `Mmes` | abbrev | 0 | plurale di Mrs, ossia "signora"; utilizzato comunemente in forma scritta come titolo onorifico generico plurale per le donne |  | `not-italian` |
| 144652 | `accumulato` | verb | 0 | participio passato di accumulare, accumularsi | `accumularsi` | `edge-names-another-word` |
| 144786 | `alimentato` | verb | 0 | participio passato di alimentare, alimentarsi | `alimentarsi` | `edge-names-another-word` |
| 144954 | `allontanato` | verb | 0 | participio passato maschile singolare di allontanare, allontanarsi | `allontanarsi` | `edge-names-another-word` |
| 145608 | `calato` | verb | 0 | participio passato di calare, calarsi | `calarsi` | `edge-names-another-word` |
| 145648 | `calcolato` | verb | 0 | participio passato di calcolare, calcolarsi | `calcolarsi` | `edge-names-another-word` |
| 145726 | `calmato` | verb | 0 | participio passato di calmare, calmarsi | `calmarsi` | `edge-names-another-word` |
| 145890 | `chiamato` | verb | 0 | participio passato di chiamare, chiamarsi | `chiamarsi` | `edge-names-another-word` |
| 145932 | `cessato` | verb | 0 | participio passato di cessare, cessarsi | `cessarsi` | `edge-names-another-word` |
| 146517 | `dispensato` | verb | 0 | participio passato di dispensare, dispensarsi | `dispensarsi` | `edge-names-another-word` |
| 146786 | `emendato` | verb | 0 | participio passato maschile di emendare, emendarsi | `emendarsi` | `edge-names-another-word` |
| 146999 | `esaminato` | verb | 0 | participio passato di esaminare, esaminarsi | `esaminarsi` | `edge-names-another-word` |
| 147084 | `estirpato` | verb | 0 | participio passato di estirpare, estirparsi | `estirparsi` | `edge-names-another-word` |
| 148834 | `incrinato` | verb | 0 | participio passato di incrinare, incrinarsi | `incrinarsi` | `edge-names-another-word` |
| 149038 | `ingannato` | verb | 0 | participio passato di ingannare, ingannarsi | `ingannarsi` | `edge-names-another-word` |
| 150509 | `ossessionato` | verb | 0 | participio passato di ossessionare, ossessionarsi | `ossessionarsi` | `edge-names-another-word` |
| 150556 | `pensato` | verb | 0 | participio passato maschile singolare di pensare, pensarsi | `pensarsi` | `edge-names-another-word` |
| 150978 | `restaurato` | verb | 0 | participio passato di restaurare, restaurarsi | `restaurarsi` | `edge-names-another-word` |
| 151111 | `rincuorato` | verb | 0 | participio passato di rincuorare, rincuorarsi | `rincuorarsi` | `edge-names-another-word` |
| 151650 | `scagionato` | verb | 0 | participio passato maschile singolare di scagionare, scagionarsi | `scagionarsi` | `edge-names-another-word` |
| 151774 | `scardinato` | verb | 0 | participio passato di scardinare, scardinarsi | `scardinarsi` | `edge-names-another-word` |
| 152695 | `sollevato` | verb | 0 | participio passato di sollevare, sollevarsi | `sollevarsi` | `edge-names-another-word` |
| 153555 | `trascinato` | verb | 0 | participio passato maschile singolare di trascinare, trascinarsi | `trascinarsi` | `edge-names-another-word` |
| 153836 | `travisato` | verb | 0 | participio passato di travisare, travisarsi | `travisarsi` | `edge-names-another-word` |
| 154629 | `acculturato` | verb | 0 | participio passato di acculturare, acculturarsi | `acculturarsi` | `edge-names-another-word` |
| 155732 | `aggirato` | verb | 0 | participio passato di aggirare, aggirarsi | `aggirarsi` | `edge-names-another-word` |
| 156229 | `avvalorato` | verb | 0 | participio passato di avvalorare, avvalorarsi | `avvalorarsi` | `edge-names-another-word` |
| 156978 | `censurato` | verb | 0 | participio passato di censurare, censurarsi | `censurarsi` | `edge-names-another-word` |
| 157326 | `compenetrato` | verb | 0 | participio passato di compenetrare, compenetrarsi | `compenetrarsi` | `edge-names-another-word` |
| 157591 | `configurato` | verb | 0 | participio passato di configurare, configurarsi | `configurarsi` | `edge-names-another-word` |
| 158734 | `deteriorato` | verb | 0 | participio passato maschile singolare di deteriorare, deteriorarsi | `deteriorarsi` | `edge-names-another-word` |
| 159169 | `disancorato` | verb | 0 | participio passato di disancorare, disancorarsi | `disancorarsi` | `edge-names-another-word` |
| 160796 | `giostrai` | noun | 0 | plurale di giostrai |  | `names-itself` |
| 161161 | `impiastrato` | verb | 0 | participio passato di impiastrare, impiastrarsi | `impiastrarsi` | `edge-names-another-word` |
| 161641 | `incentrato` | verb | 0 | participio passato di incentrare, incentrarsi | `incentrarsi` | `edge-names-another-word` |
| 162003 | `innamorai` | verb | 0 | prima persona singolare dell'indicativo passato remoto di innamorare, innamorarsi | `innamorarsi` | `edge-names-another-word` |
| 162790 | `lacerato` | verb | 0 | participio passato di lacerare, lacerarsi | `lacerarsi` | `edge-names-another-word` |
| 163335 | `migliorato` | verb | 0 | participio passato di migliorare, migliorarsi | `migliorarsi` | `edge-names-another-word` |
| 163339 | `migliori` | adj | 0 | comparativo di buono |  | `not-a-form-gloss` |
| 163643 | `mostrato` | verb | 0 | participio passato di mostrare, mostrarsi | `mostrarsi` | `edge-names-another-word` |
| 165979 | `rimembrato` | verb | 0 | participio passato di rimembrare, rimembrarsi | `rimembrarsi` | `edge-names-another-word` |
| 167453 | `sferrato` | verb | 0 | participio passato di sferrare, sferrarsi | `sferrarsi` | `edge-names-another-word` |
| 167498 | `sfiorato` | verb | 0 | participio passato di sfiorare, sfiorarsi | `sfiorarsi` | `edge-names-another-word` |
| 167994 | `smascherato` | verb | 0 | participio passato di smascherare, smascherarsi | `smascherarsi` | `edge-names-another-word` |
| 168435 | `spiro` | noun | 0 | atto di spirare, inspirazione d'aria |  | `not-a-form-gloss` |
| 168820 | `stemperato` | verb | 0 | participio passato di stemperare, stemperarsi | `stemperarsi` | `edge-names-another-word` |
| 169208 | `subentri` | noun | 0 | plurale di subentro |  | `base-table-does-not-list` |
| 169463 | `sventrato` | verb | 0 | participio passato di sventrare, sventrarsi | `sventrarsi` | `edge-names-another-word` |
| 172196 | `confermato` | verb | 0 | participio passato di confermare, confermarsi | `confermarsi` | `edge-names-another-word` |
| 172470 | `cresimato` | verb | 0 | participio passato di cresimare, cresimarsi | `cresimarsi` | `edge-names-another-word` |
| 172596 | `decimato` | verb | 0 | participio passato di decimare, decimarsi | `decimarsi` | `edge-names-another-word` |
| 173629 | `entusiasmato` | verb | 0 | participio passato di entusiasmare, entusiasmarsi | `entusiasmarsi` | `edge-names-another-word` |
| 174067 | `frantumato` | verb | 0 | participio passato di frantumare, frantumarsi | `frantumarsi` | `edge-names-another-word` |
| 175995 | `rafferma` | verb | 0 | terza persona singolare dell'indicativo presente di raffermare |  | `no-record-of-base` |
| 176494 | `riconfermato` | verb | 0 | participio passato di riconfermare, riconfermarsi | `riconfermarsi` | `edge-names-another-word` |
| 177382 | `esplicitato` | verb | 0 | participio passato di esplicitare, esplicitarsi | `esplicitarsi` | `edge-names-another-word` |
| 178515 | `querelato` | verb | 0 | participio passato di querelare, querelarsi | `querelarsi` | `edge-names-another-word` |
| 179036 | `standardizzato` | verb | 0 | participio passato di standardizzare, standardizzarsi | `standardizzarsi` | `edge-names-another-word` |
| 179643 | `accomunato` | verb | 0 | participio passato di accomunare, accomunarsi | `accomunarsi` | `edge-names-another-word` |
| 179811 | `enucleato` | verb | 0 | participio passato di enucleare, enuclearsi | `enuclearsi` | `edge-names-another-word` |
| 180999 | `immaginato` | verb | 0 | participio passato di immaginare, immaginarsi | `immaginarsi` | `edge-names-another-word` |
| 181039 | `dipanato` | verb | 0 | participio passato di dipanare, dipanarsi | `dipanarsi` | `edge-names-another-word` |
| 181384 | `sopportato` | verb | 0 | participio passato di sopportare, sopportarsi | `sopportarsi` | `edge-names-another-word` |
| 181427 | `dominato` | verb | 0 | participio passato di dominare, dominarsi | `dominarsi` | `edge-names-another-word` |
| 181516 | `torniamo` | verb | 4 | prima persona plurale del congiuntivo presente di tornire |  | `no-record-of-base` |
| 181848 | `trovati` | adj | 0 | plurale di trovato |  | `base-table-does-not-list` |
| 182728 | `presentato` | verb | 0 | participio passato di presentare, presentarsi | `presentarsi` | `edge-names-another-word` |
| 182847 | `segnalato` | verb | 0 | participio passato di segnalare, segnalarsi | `segnalarsi` | `edge-names-another-word` |
| 183224 | `ricordato` | verb | 0 | participio passato di ricordare, ricordarsi | `ricordarsi` | `edge-names-another-word` |
| 183398 | `realizzato` | verb | 0 | participio passato di realizzare, realizzarsi | `realizzarsi` | `edge-names-another-word` |
| 183795 | `conquistato` | verb | 0 | participio passato di conquistare, conquistarsi | `conquistarsi` | `edge-names-another-word` |
| 183880 | `turbato` | verb | 0 | participio passato di turbare, turbarsi | `turbarsi` | `edge-names-another-word` |
| 186393 | `affrancato` | verb | 0 | participio passato di affrancare, affrancarsi | `affrancarsi` | `edge-names-another-word` |
| 186560 | `aggiudicato` | verb | 0 | participio passato di aggiudicare, aggiudicarsi | `aggiudicarsi` | `edge-names-another-word` |
| 186908 | `ammaccato` | verb | 0 | participio passato di ammaccare, ammaccarsi | `ammaccarsi` | `edge-names-another-word` |
| 186995 | `amplificato` | verb | 0 | participio passato di amplificare, amplificarsi | `amplificarsi` | `edge-names-another-word` |
| 187390 | `arroccato` | verb | 0 | participio passato di arroccare, arroccarsi | `arroccarsi` | `edge-names-another-word` |
| 187594 | `auspicato` | verb | 0 | participio passato di auspicare, auspicarsi | `auspicarsi` | `edge-names-another-word` |
| 187771 | `barricato` | verb | 0 | participio passato di barricare, barricarsi | `barricarsi` | `edge-names-another-word` |
| 189293 | `collegato` | verb | 0 | participio passato di collegare, collegarsi | `collegarsi` | `edge-names-another-word` |
| 189376 | `collocato` | verb | 0 | participio passato di collocare, collocarsi | `collocarsi` | `edge-names-another-word` |
| 189802 | `cornificato` | verb | 0 | participio passato di cornificare, cornificarsi | `cornificarsi` | `edge-names-another-word` |
| 189890 | `criticato` | verb | 0 | participio passato di criticare, criticarsi | `criticarsi` | `edge-names-another-word` |
| 190100 | `decuplicato` | verb | 0 | participio passato di decuplicare, decuplicarsi | `decuplicarsi` | `edge-names-another-word` |
| 190490 | `dequalificato` | verb | 0 | participio passato di dequalificare, dequalificarsi | `dequalificarsi` | `edge-names-another-word` |
| 190707 | `dilungato` | verb | 0 | participio passato di dilungare, dilungarsi | `dilungarsi` | `edge-names-another-word` |
| 191138 | `dislocato` | verb | 0 | participio passato di dislocare, dislocarsi | `dislocarsi` | `edge-names-another-word` |
| 191350 | `districato` | verb | 0 | participio passato di districare, districarsi | `districarsi` | `edge-names-another-word` |
| 191476 | `diversificato` | verb | 0 | participio passato di diversificare, diversificarsi | `diversificarsi` | `edge-names-another-word` |
| 191522 | `divulgato` | verb | 0 | participio passato di divulgare, divulgarsi | `divulgarsi` | `edge-names-another-word` |
| 192262 | `essiccato` | verb | 0 | participio passato maschile singolare di essiccare, essiccarsi | `essiccarsi` | `edge-names-another-word` |
| 192307 | `faticato` | verb | 0 | participio passato di faticare, faticarsi | `faticarsi` | `edge-names-another-word` |
| 194174 | `intensificato` | verb | 0 | participio passato di intensificare, intensificarsi | `intensificarsi` | `edge-names-another-word` |
| 195416 | `mancata` | adj | 0 | femminile di mancato |  | `base-table-does-not-list` |
| 195633 | `mitigato` | verb | 0 | participio passato di mitigare, mitigarsi | `mitigarsi` | `edge-names-another-word` |
| 195852 | `morsicato` | verb | 0 | participio passato di morsicare, morsicarsi | `morsicarsi` | `edge-names-another-word` |
| 195896 | `moltiplicato` | verb | 0 | participio passato di moltiplicare, moltiplicarsi | `moltiplicarsi` | `edge-names-another-word` |
| 196325 | `offuscato` | verb | 0 | participio passato di offuscare, offuscarsi | `offuscarsi` | `edge-names-another-word` |
| 196409 | `pagato` | verb | 0 | participio passato di pagare, pagarsi | `pagarsi` | `edge-names-another-word` |
| 197156 | `prodigato` | verb | 0 | participio passato di prodigare, prodigarsi | `prodigarsi` | `edge-names-another-word` |
| 197388 | `prosciugato` | verb | 0 | participio passato di prosciugare, prosciugarsi | `prosciugarsi` | `edge-names-another-word` |
| 197473 | `propagato` | verb | 0 | participio passato di propagare, propagarsi | `propagarsi` | `edge-names-another-word` |
| 197604 | `purificato` | verb | 0 | participio passato di purificare, purificarsi | `purificarsi` | `edge-names-another-word` |
| 198005 | `rammaricato` | verb | 0 | participio passato di rammaricare, rammaricarsi | `rammaricarsi` | `edge-names-another-word` |
| 198134 | `relegato` | verb | 0 | participio passato di relegare, relegarsi | `relegarsi` | `edge-names-another-word` |
| 198503 | `ricalchi` | noun | 0 | plurale di ricalco |  | `base-table-does-not-list` |
| 198542 | `riattaccato` | verb | 0 | participio passato di riattaccare, riattaccarsi | `riattaccarsi` | `edge-names-another-word` |
| 199463 | `rinfrancato` | verb | 0 | participio passato di rinfrancare, rinfrancarsi | `rinfrancarsi` | `edge-names-another-word` |
| 199936 | `ripiegato` | verb | 0 | participio passato di ripiegare, ripiegarsi | `ripiegarsi` | `edge-names-another-word` |
| 200553 | `sbloccato` | verb | 0 | participio passato di sbloccare, sbloccarsi | `sbloccarsi` | `edge-names-another-word` |
| 201167 | `sfiancati` | adj | 0 | plurale di sfiancatu |  | `not-italian` |
| 201170 | `sfiancata` | adj | 0 | femminile di sfiancatu |  | `not-italian` |
| 201177 | `sfiancate` | adj | 0 | plurale di sfiancata |  | `not-italian` |
| 201727 | `stancante` | verb | 0 | participio presente di stancare, stancarsi | `stancarsi` | `edge-names-another-word` |
| 201818 | `sobbarcato` | verb | 0 | participio passato di sobbarcare, sobbarcarsi | `sobbarcarsi` | `edge-names-another-word` |
| 201993 | `soggiogato` | verb | 0 | participio passato di soggiogare, soggiogarsi | `soggiogarsi` | `edge-names-another-word` |
| 202124 | `solidificato` | verb | 0 | participio passato di solidificare, solidificarsi | `solidificarsi` | `edge-names-another-word` |
| 203039 | `svagato` | verb | 0 | participio passato di svagare, svagarsi | `svagarsi` | `edge-names-another-word` |
| 203869 | `vendicato` | verb | 0 | participio passato di vendicare, vendicarsi | `vendicarsi` | `edge-names-another-word` |
| 207096 | `denunciato` | verb | 0 | participio passato di denunciare, denunciarsi | `denunciarsi` | `edge-names-another-word` |
| 207312 | `elogiato` | verb | 0 | participio passato di elogiare, elogiarsi | `elogiarsi` | `edge-names-another-word` |
| 207927 | `fronteggiato` | verb | 0 | participio passato di fronteggiare, fronteggiarsi | `fronteggiarsi` | `edge-names-another-word` |
| 208462 | `guerreggiato` | verb | 0 | participio passato di guerreggiare, guerreggiarsi | `guerreggiarsi` | `edge-names-another-word` |
| 208826 | `incoraggiato` | verb | 0 | participio passato di incoraggiare, incoraggiarsi | `incoraggiarsi` | `edge-names-another-word` |
| 208989 | `ingaggiato` | verb | 0 | participio passato di ingaggiare, ingaggiarsi | `ingaggiarsi` | `edge-names-another-word` |
| 210100 | `osteggiato` | verb | 0 | participio passato di osteggiare, osteggiarsi | `osteggiarsi` | `edge-names-another-word` |
| 211069 | `sbeffeggiato` | verb | 0 | participio passato di sbeffeggiare, sbeffeggiarsi | `sbeffeggiarsi` | `edge-names-another-word` |
| 213519 | `spalleggiato` | verb | 0 | participio passato di spalleggiare, spalleggiarsi | `spalleggiarsi` | `edge-names-another-word` |
| 213896 | `squarciato` | verb | 0 | participio passato di squarciare, squarciarsi | `squarciarsi` | `edge-names-another-word` |
| 213981 | `stropicciato` | verb | 0 | participio passato di stropicciare, stropicciarsi | `stropicciarsi` | `edge-names-another-word` |
| 214400 | `informatico` | noun | 0 | studioso di informatica |  | `not-a-form-gloss` |
| 214562 | `verniciato` | verb | 0 | participio passato di verniciare, verniciarsi | `verniciarsi` | `edge-names-another-word` |
| 215462 | `rallentato` | verb | 0 | participio passato di rallentare, rallentarsi | `rallentarsi` | `edge-names-another-word` |
| 215668 | `detestato` | verb | 0 | participio passato di detestare, detestarsi | `detestarsi` | `edge-names-another-word` |
| 215713 | `disprezzato` | verb | 0 | participio passato di disprezzare, disprezzarsi | `disprezzarsi` | `edge-names-another-word` |
| 217688 | `liberò` | verb | 1 | prima persona singolare dell'indicativo futuro semplice di libare |  | `base-table-does-not-list` |
| 217713 | `conservato` | verb | 0 | participio passato di conservare, conservarsi | `conservarsi` | `edge-names-another-word` |
| 218677 | `citato` | verb | 0 | participio passato di citare, citarsi | `citarsi` | `edge-names-another-word` |
| 218904 | `ambientato` | verb | 0 | participio passato di ambientare, ambientarsi | `ambientarsi` | `edge-names-another-word` |
| 219070 | `basato` | verb | 0 | participio passato di basare, basarsi | `basarsi` | `edge-names-another-word` |
| 219967 | `consolante` | adj | 0 | in grado di consolare |  | `not-a-form-gloss` |
| 220061 | `consultato` | verb | 0 | participio passato di consultare, consultarsi | `consultarsi` | `edge-names-another-word` |
| 220669 | `deformato` | verb | 0 | participio passato di deformare, deformarsi | `deformarsi` | `edge-names-another-word` |
| 220760 | `degradato` | verb | 0 | participio passato di degradare, degradarsi | `degradarsi` | `edge-names-another-word` |
| 221019 | `denominato` | verb | 0 | participio passato di denominare, denominarsi | `denominarsi` | `edge-names-another-word` |
| 221306 | `destinato` | verb | 0 | participio passato di destinare, destinarsi | `destinarsi` | `edge-names-another-word` |
| 221441 | `dilatato` | verb | 0 | participio passato di dilatare, dilatarsi | `dilatarsi` | `edge-names-another-word` |
| 222225 | `frenante` | adj | 0 | che permette di frenare |  | `not-a-form-gloss` |
| 222917 | `perturbato` | verb | 0 | participio passato di perturbare, perturbarsi | `perturbarsi` | `edge-names-another-word` |
| 223932 | `obnubilato` | verb | 0 | participio passato di obnubilare, obnubilarsi | `obnubilarsi` | `edge-names-another-word` |
| 225249 | `salvaguardato` | verb | 0 | participio passato di salvaguardare, salvaguardarsi | `salvaguardarsi` | `edge-names-another-word` |
| 225374 | `sedato` | verb | 0 | participio passato maschile singolare di sedare, sedarsi | `sedarsi` | `edge-names-another-word` |
| 225929 | `uniformato` | verb | 0 | participio passato di uniformare, uniformarsi | `uniformarsi` | `edge-names-another-word` |
| 226536 | `cristianizzato` | verb | 0 | participio passato di cristianizzare, cristianizzarsi | `cristianizzarsi` | `edge-names-another-word` |
| 227324 | `rifiutato` | verb | 0 | participio passato di rifiutare, rifiutarsi | `rifiutarsi` | `edge-names-another-word` |
| 227486 | `meritato` | verb | 0 | participio passato di meritare, meritarsi | `meritarsi` | `edge-names-another-word` |
| 227658 | `guidato` | verb | 0 | participio passato di guidare, guidarsi | `guidarsi` | `edge-names-another-word` |
| 227743 | `salutato` | verb | 0 | participio passato di salutare, salutarsi | `salutarsi` | `edge-names-another-word` |
| 227783 | `trasportato` | verb | 0 | participio passato di trasportare, trasportarsi | `trasportarsi` | `edge-names-another-word` |
| 227995 | `rivelato` | verb | 0 | participio passato di rivelare, rivelarsi | `rivelarsi` | `edge-names-another-word` |
| 228096 | `osservato` | verb | 0 | participio passato maschile singolare di osservare, osservarsi | `osservarsi` | `edge-names-another-word` |
| 228265 | `disegnato` | verb | 0 | participio passato di disegnare, disegnarsi | `disegnarsi` | `edge-names-another-word` |
| 228599 | `guadagnato` | verb | 0 | participio passato di guadagnare, guadagnarsi | `guadagnarsi` | `edge-names-another-word` |
| 228817 | `tatuato` | verb | 0 | participio passato di tatuare, tatuarsi | `tatuarsi` | `edge-names-another-word` |
| 228863 | `incitato` | verb | 0 | participio passato di incitare, incitarsi | `incitarsi` | `edge-names-another-word` |
| 229000 | `denudato` | verb | 0 | participio passato di denudare, denudarsi | `denudarsi` | `edge-names-another-word` |
| 229292 | `sistemato` | verb | 0 | participio passato di sistemare, sistemarsi | `sistemarsi` | `edge-names-another-word` |
| 229917 | `installato` | verb | 0 | participio passato di installare, installarsi | `installarsi` | `edge-names-another-word` |
| 231650 | `tutelato` | verb | 0 | participio passato di tutelare, tutelarsi | `tutelarsi` | `edge-names-another-word` |
| 232529 | `pestato` | verb | 0 | participio passato di pestare, pestarsi | `pestarsi` | `edge-names-another-word` |
| 233258 | `intrappolato` | verb | 0 | participio passato di intrappolare, intrappolarsi | `intrappolarsi` | `edge-names-another-word` |
| 233423 | `intitolato` | verb | 0 | participio passato di intitolare, intitolarsi | `intitolarsi` | `edge-names-another-word` |
| 233467 | `neutralizzato` | verb | 0 | participio passato di neutralizzare, neutralizzarsi | `neutralizzarsi` | `edge-names-another-word` |
| 234212 | `incoronato` | verb | 0 | participio passato di incoronare. incoronarsi | `incoronarsi` | `edge-names-another-word` |
| 235515 | `proiettato` | verb | 0 | participio passato di proiettare, proiettarsi | `proiettarsi` | `edge-names-another-word` |
| 235682 | `rappezzato` | verb | 0 | participio passato di rappezzare, rappezzarsi | `rappezzarsi` | `edge-names-another-word` |
| 236654 | `sopravvalutato` | verb | 0 | participio passato di sopravvalutare, sopravvalutarsi | `sopravvalutarsi` | `edge-names-another-word` |
| 236782 | `sottovalutato` | verb | 0 | participio passato di sottovalutare, sottovalutarsi | `sottovalutarsi` | `edge-names-another-word` |
| 237097 | `disinfettato` | verb | 0 | participio passato di disinfettare, disinfettarsi | `disinfettarsi` | `edge-names-another-word` |
| 237667 | `manipolato` | verb | 0 | participio passato di manipolare, manipolarsi | `manipolarsi` | `edge-names-another-word` |
| 237845 | `contattato` | verb | 0 | participio passato di contattare, contattarsi | `contattarsi` | `edge-names-another-word` |
| 238437 | `dimezzato` | verb | 0 | participio passato maschile singolare di dimezzare, dimezzarsi | `dimezzarsi` | `edge-names-another-word` |
| 238941 | `sigillato` | verb | 0 | participio passato di sigillare, sigillarsi | `sigillarsi` | `edge-names-another-word` |
| 239505 | `spodestato` | verb | 0 | participio passato di spodestare, spodestarsi | `spodestarsi` | `edge-names-another-word` |
| 239592 | `disdegnato` | verb | 0 | participio passato di disdegnare, disegnarsi | `disegnarsi` | `edge-names-another-word` |
| 240147 | `sminuzzato` | verb | 0 | participio passato di sminuzzare, sminuzzarsi | `sminuzzarsi` | `edge-names-another-word` |
| 240317 | `caratterizzato` | verb | 0 | participio passato di caratterizzare, caratterizzarsi | `caratterizzarsi` | `edge-names-another-word` |
| 240864 | `rivoluzionato` | verb | 0 | participio passato di rivoluzionare, rivoluzionarsi | `rivoluzionarsi` | `edge-names-another-word` |
| 240949 | `focalizzato` | verb | 0 | participio passato di focalizzare, focalizzarsi | `focalizzarsi` | `edge-names-another-word` |
| 241034 | `tramandato` | verb | 0 | participio passato di tramandare, tramandarsi | `tramandarsi` | `edge-names-another-word` |
| 241400 | `paracadutato` | verb | 0 | participio passato di paracadutare, paracadutarsi | `paracadutarsi` | `edge-names-another-word` |
| 242001 | `sfidato` | verb | 0 | participio passato di sfidare, sfidarsi | `sfidarsi` | `edge-names-another-word` |
| 242213 | `caramellato` | verb | 0 | participio passato di caramellare, caramellarsi | `caramellarsi` | `edge-names-another-word` |
| 243247 | `incrostato` | verb | 0 | participio passato di incrostare, incrostarsi | `incrostarsi` | `edge-names-another-word` |
| 243422 | `diffidato` | verb | 0 | participio passato di diffidare, diffidarsi | `diffidarsi` | `edge-names-another-word` |
| 244029 | `mescolato` | verb | 0 | participio passato maschile singolare di mescolare, mescolarsi | `mescolarsi` | `edge-names-another-word` |
| 245009 | `schiantato` | verb | 0 | participio passato di schiantare, schiantarsi | `schiantarsi` | `edge-names-another-word` |
| 245993 | `accontentato` | verb | 0 | participio passato di accontentare, accontentarsi | `accontentarsi` | `edge-names-another-word` |
| 246086 | `scarto` | noun | 2 | persona di poco conto |  | `base-table-does-not-list` |
| 247233 | `disseminato` | verb | 0 | participio passato di disseminare, disseminarsi | `disseminarsi` | `edge-names-another-word` |
| 247319 | `esentato` | verb | 0 | participio passato di esentare, esentarsi | `esentarsi` | `edge-names-another-word` |
| 248482 | `rammentato` | verb | 0 | participio passato di rammentare, rammentarsi | `rammentarsi` | `edge-names-another-word` |
| 248816 | `riscontrato` | verb | 0 | participio passato di riscontrare, riscontrarsi | `riscontrarsi` | `edge-names-another-word` |
| 249447 | `fossilizzato` | verb | 0 | participio passato di fossilizzare, fossilizzarsi | `fossilizzarsi` | `edge-names-another-word` |
| 250099 | `occultato` | verb | 0 | participio passato di occultare, occultarsi | `occultarsi` | `edge-names-another-word` |
| 250190 | `riutilizzi` | noun | 0 | plurale di riutilizzo |  | `base-table-does-not-list` |
| 250775 | `sciupata` | adj | 0 | femminie di sciupato |  | `not-a-form-gloss` |
| 250817 | `scombussolato` | verb | 0 | participio passato maschile singolare di scombussolare, scombussolarsi | `scombussolarsi` | `edge-names-another-word` |
| 251709 | `sintonizzato` | verb | 0 | participio passato di sintonizzare, sintonizzarsi | `sintonizzarsi` | `edge-names-another-word` |
| 252273 | `svolto` | verb | 1 | participio passato di svolgere, svolgersi | `svolgersi` | `edge-names-another-word` |
| 252782 | `aggravato` | verb | 0 | participio passato di aggravare, aggravarsi | `aggravarsi` | `edge-names-another-word` |
| 252912 | `direzionato` | verb | 0 | participio passato di direzionare, direzionarsi | `direzionarsi` | `edge-names-another-word` |
| 253271 | `pressato` | verb | 0 | participio passato di pressare, pressarsi | `pressarsi` | `edge-names-another-word` |
| 253810 | `dileguato` | verb | 0 | participio passato di dileguare, dileguarsi | `dileguarsi` | `edge-names-another-word` |
| 254904 | `intervallato` | verb | 0 | participio passato di intervallare, intervallarsi | `intervallarsi` | `edge-names-another-word` |
| 255115 | `civilizzato` | verb | 0 | participio passato di civilizzare, civilizzarsi | `civilizzarsi` | `edge-names-another-word` |
| 255714 | `affinato` | verb | 0 | participio passato di affinare, affinarsi | `affinarsi` | `edge-names-another-word` |
| 256003 | `prefissato` | verb | 0 | participio passato di prefissare, prefissarsi | `prefissarsi` | `edge-names-another-word` |
| 256288 | `immobilizzato` | verb | 0 | participio passato di immobilizzare, immobilizzarsi | `immobilizzarsi` | `edge-names-another-word` |
| 256375 | `incanalato` | verb | 0 | participio passato di incanalare, incanalarsi | `incanalarsi` | `edge-names-another-word` |
| 256418 | `incartato` | verb | 0 | participio passato di incartare, incartarsi | `incartarsi` | `edge-names-another-word` |
| 257430 | `aggrappato` | verb | 0 | participio passato di aggrappare, aggrapparsi | `aggrapparsi` | `edge-names-another-word` |
| 258934 | `discolpato` | verb | 0 | participio passato di discolpare, discolparsi | `discolparsi` | `edge-names-another-word` |
| 259439 | `politicizzato` | verb | 0 | participio passato di politicizzare, politicizzarsi | `politicizzarsi` | `edge-names-another-word` |
| 259771 | `azzannato` | verb | 0 | participio passato di azzannare, azzannarsi | `azzannarsi` | `edge-names-another-word` |
| 259987 | `rasserenato` | verb | 0 | participio passato di rasserenare, rasserenarsi | `rasserenarsi` | `edge-names-another-word` |
| 260558 | `convalidato` | verb | 0 | participio passato di convalidare, convalidarsi | `convalidarsi` | `edge-names-another-word` |
| 261532 | `acciuffato` | verb | 0 | participio passato di acciuffare, acciuffarsi | `acciuffarsi` | `edge-names-another-word` |
| 262417 | `rifocillato` | verb | 0 | participio passato di rifocillare, rifocillarsi | `rifocillarsi` | `edge-names-another-word` |
| 262753 | `rimescolato` | verb | 0 | participio passato di rimescolare, rimescolarsi | `rimescolarsi` | `edge-names-another-word` |
| 263897 | `rinsaldato` | verb | 0 | participio passato di rinsaldare, rinsaldarsi | `rinsaldarsi` | `edge-names-another-word` |
| 266010 | `camuffato` | verb | 0 | participio passato di camuffare, camuffarsi | `camuffarsi` | `edge-names-another-word` |
| 266429 | `catapultato` | verb | 0 | participio passato di catapultare, catapultarsi | `catapultarsi` | `edge-names-another-word` |
| 266598 | `cesello` | noun | 1 | l'atto di cesellare |  | `not-a-form-gloss` |
| 267281 | `beo` | verb | 0 | prima persona singolare dell'indicativo presente di beare o di bearsi | `bearsi` | `edge-names-another-word` |
| 267623 | `bronzi` | noun | 0 | plurale di bronzo:campane | `campane` | `edge-names-another-word` |
| 268919 | `sdegnato` | verb | 0 | participio passato di sdegnare, sdegnarsi | `sdegnarsi` | `edge-names-another-word` |
| 270868 | `dimensionato` | verb | 0 | participio passato di dimensionare, dimensionarsi | `dimensionarsi` | `edge-names-another-word` |
| 271599 | `disabituato` | verb | 0 | participio passato di disabituare, disabituarsi | `disabituarsi` | `edge-names-another-word` |
| 273344 | `incolonnato` | verb | 0 | participio passato di incolonnare, incolonnarsi | `incolonnarsi` | `edge-names-another-word` |
| 274321 | `eternato` | verb | 0 | participio passato di eternare, eternarsi | `eternarsi` | `edge-names-another-word` |
| 275334 | `svincolato` | verb | 0 | participio passato di svincolare, svincolarsi | `svincolarsi` | `edge-names-another-word` |
| 275503 | `scandalizzato` | verb | 0 | participio passato di scandalizzare, scandalizzarsi | `scandalizzarsi` | `edge-names-another-word` |
| 276443 | `chiazzato` | verb | 0 | participio passato di chiazzare, chiazzarsi | `chiazzarsi` | `edge-names-another-word` |
| 277827 | `squassato` | verb | 0 | participio passato di squassare, squassarsi | `squassarsi` | `edge-names-another-word` |
| 278038 | `decongestionato` | verb | 0 | participio passato di decongestionare, decongestionarsi | `decongestionarsi` | `edge-names-another-word` |
| 278830 | `sbriciolato` | verb | 0 | participio passato maschile singolare di sbriciolare, sbriciolarsi | `sbriciolarsi` | `edge-names-another-word` |
| 279299 | `scaraventato` | verb | 0 | participio passato di scaraventare, scaraventarsi | `scaraventarsi` | `edge-names-another-word` |
| 279819 | `schifato` | verb | 0 | participio passato di schifare, schifarsi | `schifarsi` | `edge-names-another-word` |
| 280908 | `screpolato` | verb | 0 | participio passato di screpolare, screpolarsi | `screpolarsi` | `edge-names-another-word` |
| 282640 | `frammentato` | verb | 0 | participio passato di frammentare, frammentarsi | `frammentarsi` | `edge-names-another-word` |
| 283348 | `imbrattato` | verb | 0 | participio passato di imbrattare, imbrattarsi | `imbrattarsi` | `edge-names-another-word` |
| 284785 | `smorzato` | verb | 0 | participio passato di smorzare, smorzarsi | `smorzarsi` | `edge-names-another-word` |
| 286176 | `dopato` | verb | 0 | participio passato di dopare, doparsi | `doparsi` | `edge-names-another-word` |
| 287188 | `piroetta` | verb | 1 | seconda persona singolare dell'imperativo di pirolettare |  | `no-record-of-base` |
| 289040 | `svalutato` | verb | 0 | participio passato di svalutare, svalutarsi | `svalutarsi` | `edge-names-another-word` |
| 289333 | `rimpinguato` | verb | 0 | participio passato di rimpinguare, rimpinguarsi | `rimpinguarsi` | `edge-names-another-word` |
| 289877 | `sgrossato` | verb | 0 | participio passato di sgrossare, sgrossarsi | `sgrossarsi` | `edge-names-another-word` |
| 290089 | `rassodato` | verb | 0 | participio passato di rassodare, rassodarsi | `rassodarsi` | `edge-names-another-word` |
| 291441 | `stagnato` | verb | 0 | participio passato di stagnare, stagnarsi | `stagnarsi` | `edge-names-another-word` |
| 294128 | `atrofizzato` | verb | 0 | participio passato di atrofizzare, atrofizzarsi | `atrofizzarsi` | `edge-names-another-word` |
| 295056 | `spiegazzato` | verb | 0 | participio passato di spiegazzare, spiegazzarsi | `spiegazzarsi` | `edge-names-another-word` |
| 309192 | `disaffezionato` | verb | 0 | participio passato di disaffezionare, disaffezionarsi | `disaffezionarsi` | `edge-names-another-word` |
| 309313 | `disappannato` | verb | 0 | participio passato di disappannare, disappannarsi | `disappannarsi` | `edge-names-another-word` |
| 310103 | `disavvezzato` | verb | 0 | participio passato di disavvezzare, disavvezzarsi | `disavvezzarsi` | `edge-names-another-word` |
| 310949 | `disallineato` | verb | 0 | participio passato di disallineare, disallinearsi | `disallinearsi` | `edge-names-another-word` |
| 314253 | `grecizzato` | verb | 0 | participio passato di grecizzare, grecizzarsi | `grecizzarsi` | `edge-names-another-word` |
| 317846 | `ottoni` | noun | 0 | tutti gli strumenti musicali a fiato fatti di ottone |  | `not-a-form-gloss` |
| 332039 | `scomparsa` | verb | 0 | participio passato femminile singolare di scomparire |  | `base-table-does-not-list` |
| 335169 | `secato` | verb | 0 | participio passato di secare, secarsi | `secarsi` | `edge-names-another-word` |
| 337430 | `stomacato` | verb | 0 | participio passato di stomacare, stomacarsi | `stomacarsi` | `edge-names-another-word` |
| 346153 | `strusciato` | verb | 0 | participio passato di strusciare, strusciarsi | `strusciarsi` | `edge-names-another-word` |
| 346688 | `vezzeggiato` | verb | 0 | participio passato di vezzeggiare, vezzeggiarsi | `vezzeggiarsi` | `edge-names-another-word` |
| 351945 | `odiato` | verb | 0 | participio passato maschile singolare di odiare, odiarsi | `odiarsi` | `edge-names-another-word` |
| 352146 | `cambiato` | verb | 0 | participio passato di cambiare, cambiarsi | `cambiarsi` | `edge-names-another-word` |
| 352977 | `consigliato` | verb | 0 | participio passato di consigliare, consigliarsi | `consigliarsi` | `edge-names-another-word` |
| 353018 | `svegliato` | verb | 0 | participio passato di svegliare, svegliarsi | `svegliarsi` | `edge-names-another-word` |
| 353097 | `risparmiato` | verb | 0 | participio passato di risparmiare, risparmiarsi | `risparmiarsi` | `edge-names-another-word` |
| 353138 | `annoiato` | verb | 0 | participio passato di annoiare, annoiarsi | `annoiarsi` | `edge-names-another-word` |
| 353301 | `imperniato` | verb | 0 | participio passato di imperniare, imperniarsi | `imperniarsi` | `edge-names-another-word` |
| 353827 | `finanziato` | verb | 0 | participio passato di finanziare, finanziarsi | `finanziarsi` | `edge-names-another-word` |
| 354662 | `raschiato` | verb | 0 | participio passato di raschiare, raschiarsi | `raschiarsi` | `edge-names-another-word` |
| 354747 | `ammucchiato` | verb | 0 | participio passato di ammucchiare, ammucchiarsi | `ammucchiarsi` | `edge-names-another-word` |
| 354914 | `ricambiato` | verb | 0 | participio passato di ricambiare, ricambiarsi | `ricambiarsi` | `edge-names-another-word` |
| 355381 | `estasiato` | verb | 0 | participio passato di estasiare, estasiarsi | `estasiarsi` | `edge-names-another-word` |
| 355915 | `succhiato` | verb | 0 | participio passato di succhiare, succhiarsi | `succhiarsi` | `edge-names-another-word` |
| 356349 | `rinviato` | verb | 0 | participio passato di rinviare, rinviarsi | `rinviarsi` | `edge-names-another-word` |
| 356714 | `depotenziato` | verb | 0 | participio passato di depotenziare, depotenziarsi | `depotenziarsi` | `edge-names-another-word` |
| 356802 | `doppiata` | verb | 0 | participio passato femminile singolare di doppiare |  | `base-table-does-not-list` |
| 357543 | `invischiato` | verb | 0 | participio passato di invischiare, invischiarsi | `invischiarsi` | `edge-names-another-word` |
| 357785 | `ingarbugliato` | verb | 0 | participio passato di ingarbugliare. ingarbugliarsi | `ingarbugliarsi` | `edge-names-another-word` |
| 359714 | `aggrovigliato` | verb | 0 | participio passato di aggrovigliare, aggrovigliarsi | `aggrovigliarsi` | `edge-names-another-word` |
| 359920 | `annebbiato` | verb | 0 | participio passato di annebbiare, annebbiarsi | `annebbiarsi` | `edge-names-another-word` |
| 360005 | `asfissiato` | verb | 0 | participio passato di asfissiare, afissiarsi | `afissiarsi` | `edge-names-another-word` |
| 360048 | `asserragliato` | verb | 0 | participio passato di asserragliare, asserragliarsi | `asserragliarsi` | `edge-names-another-word` |
| 360092 | `assottigliato` | verb | 0 | participio passato di assottigliare, assottigliarsi | `assottigliarsi` | `edge-names-another-word` |
| 360295 | `distanziato` | verb | 0 | participio passato di distanziare, distanziarsi | `distanziarsi` | `edge-names-another-word` |
| 360991 | `rannicchiato` | verb | 0 | participio passato di rannicchiare, rannicchiarsi | `rannicchiarsi` | `edge-names-another-word` |
| 361575 | `disincagliato` | verb | 0 | participio passato di disincagliare, disincagliarsi | `disincagliarsi` | `edge-names-another-word` |
| 363046 | `punzecchiato` | verb | 0 | participio passato di punzecchiare, punzecchiarsi | `punzecchiarsi` | `edge-names-another-word` |
| 363373 | `tediato` | verb | 0 | participio passato di tediare, tediarsi | `tediarsi` | `edge-names-another-word` |
| 363621 | `rosicchiato` | verb | 0 | participio passato di rosicchiare, rosicchiarsi | `rosicchiarsi` | `edge-names-another-word` |
| 368411 | `svariato` | verb | 0 | participio passato di svariare, svariarsi | `svariarsi` | `edge-names-another-word` |
| 372076 | `digerito` | verb | 0 | participio passato di digerire, digerirsi | `digerirsi` | `edge-names-another-word` |
| 373316 | `chiarito` | verb | 0 | participio passato di chiarire, chiarirsi | `chiarirsi` | `edge-names-another-word` |
| 373531 | `distribuito` | verb | 0 | participio passato di distribuire, distribuirsi | `distribuirsi` | `edge-names-another-word` |
| 374035 | `infastidito` | verb | 0 | participio passato di infastidire, infastidirsi | `infastidirsi` | `edge-names-another-word` |
| 374079 | `ingerito` | verb | 0 | participio passato di ingerire, ingerirsi | `ingerirsi` | `edge-names-another-word` |
| 374162 | `restituito` | verb | 0 | participio passato di restituire, restituirsi | `restituirsi` | `edge-names-another-word` |
| 374206 | `dimagrito` | verb | 0 | participio passato di dimagrire, dimagrirsi | `dimagrirsi` | `edge-names-another-word` |
| 374618 | `deperito` | verb | 0 | participio passato di deperire, deperirsi | `deperirsi` | `edge-names-another-word` |
| 376487 | `imbarbarito` | verb | 0 | participio passato di imbarbarire, imbarbarirsi | `imbarbarirsi` | `edge-names-another-word` |
| 376873 | `inasprito` | verb | 0 | participio passato di inasprire, inasprirsi | `inasprirsi` | `edge-names-another-word` |
| 376917 | `incattivito` | verb | 0 | participio passato di incattivire, incattivirsi | `incattivirsi` | `edge-names-another-word` |
| 377313 | `intenerito` | verb | 0 | participio passato di intenerire, intenerirsi | `intenerirsi` | `edge-names-another-word` |
| 377532 | `intristito` | verb | 0 | participio passato di intristire, intristirsi | `intristirsi` | `edge-names-another-word` |
| 377788 | `ribadito` | verb | 0 | participio passato di ribadire, ribadirsi | `ribadirsi` | `edge-names-another-word` |
| 378578 | `ammorbidito` | verb | 0 | participio passato di ammorbidire, ammorbidirsi | `ammorbidirsi` | `edge-names-another-word` |
| 378620 | `asservito` | verb | 0 | participio passato di asservire, asservirsi | `asservirsi` | `edge-names-another-word` |
| 379063 | `gestito` | verb | 0 | participio passato di gestire, gestirsi | `gestirsi` | `edge-names-another-word` |
| 380156 | `scandito` | verb | 0 | participio passato di scandire, scandirsi | `scandirsi` | `edge-names-another-word` |
| 380243 | `appiattito` | verb | 0 | participio passato di appiattire, appiattirsi | `appiattirsi` | `edge-names-another-word` |
| 380373 | `rinvigorito` | verb | 0 | participio passato di rinvigorire, rinvigorirsi | `rinvigorirsi` | `edge-names-another-word` |
| 381114 | `incuriosito` | verb | 0 | participio passato di incuriosire, incuriosirsi | `incuriosirsi` | `edge-names-another-word` |
| 381158 | `insignito` | verb | 0 | participio passato di insignire, insignirsi | `insignirsi` | `edge-names-another-word` |
| 381416 | `impietrito` | verb | 0 | participio passato di impietrire, impietrirsi | `impietrirsi` | `edge-names-another-word` |
| 381556 | `sminuito` | verb | 0 | participio passato di sminuire, sminuirsi | `sminuirsi` | `edge-names-another-word` |
| 382077 | `rimpicciolito` | verb | 0 | participio passato di rimpicciolire, rimpicciolirsi | `rimpicciolirsi` | `edge-names-another-word` |
| 382293 | `abbrustolito` | verb | 0 | participio passato di abbrustolire, abbrustolirsi | `abbrustolirsi` | `edge-names-another-word` |
| 383129 | `ammutolito` | verb | 0 | participio passato di ammutolire, ammutolirsi | `ammutolirsi` | `edge-names-another-word` |
| 383221 | `appesantito` | verb | 0 | participio passato di appesantire, appesantirsi | `appesantirsi` | `edge-names-another-word` |
| 383397 | `attutito` | verb | 0 | participio passato di attutire, attutirsi | `attutirsi` | `edge-names-another-word` |
| 384044 | `ostruito` | verb | 0 | participio passato di ostruire, ostruirsi | `ostruirsi` | `edge-names-another-word` |
| 384256 | `infiacchito` | verb | 0 | participio passato di infiacchire, infiacchirsi | `infiacchirsi` | `edge-names-another-word` |
| 385249 | `imbastardito` | verb | 0 | participio passato di imbastardire, imbastardirsi | `imbastardirsi` | `edge-names-another-word` |
| 386072 | `ingobbito` | verb | 0 | participio passato di ingobbire, ingobbirsi | `ingobbirsi` | `edge-names-another-word` |
| 387487 | `rabbonito` | verb | 0 | participio passato di rabbonire, rabbonirsi | `rabbonirsi` | `edge-names-another-word` |
| 394649 | `armonizzato` | verb | 0 | participio passato di armonizzare, armonizzarsi | `armonizzarsi` | `edge-names-another-word` |
| 397422 | `cozzato` | verb | 0 | participio passato di cozzare, cozzarsi | `cozzarsi` | `edge-names-another-word` |
| 397512 | `crollato` | verb | 0 | participio passato di crollare, crollarsi | `crollarsi` | `edge-names-another-word` |
| 398623 | `stramazzi` | noun | 0 | plurale di stramazzo |  | `not-italian` |
| 401923 | `spremuto` | verb | 0 | participio passato di spremere, spremersi | `spremersi` | `edge-names-another-word` |
| 403031 | `ribattuto` | verb | 0 | participio passato di ribattere, ribattersi | `ribattersi` | `edge-names-another-word` |
| 404406 | `ignoto` | noun | 1 | persona di cui non si conoscono le generalità |  | `base-table-does-not-list` |
| 404954 | `astrofisico` | noun | 0 | studioso di astrofisica |  | `not-a-form-gloss` |
| 406076 | `coagulato` | verb | 0 | participio passato di coagulare, coagularsi | `coagularsi` | `edge-names-another-word` |
| 407670 | `edentule` | adj | 0 | variante di edentulo |  | `not-a-form-gloss` |
| 407801 | `fuoriuscito` | verb | 0 | participio passato di fuoriuscire |  | `no-record-of-base` |
| 410230 | `nanoelettronica` | adj | 0 | femminile di nanoelettronico |  | `no-record-of-base` |
| 410416 | `predisposto` | verb | 0 | participio passato di predisporre, predisporsi | `predisporsi` | `edge-names-another-word` |
| 411233 | `decomposto` | verb | 0 | participio passato di decomporre, decomporsi | `decomporsi` | `edge-names-another-word` |
| 411278 | `deposto` | verb | 0 | participio passato di deporre, deporsi | `deporsi` | `edge-names-another-word` |
| 413348 | `termochimico` | noun | 0 | studioso di termochimica |  | `not-a-form-gloss` |
| 414112 | `scontenti` | verb | 1 | prima persona singolare del congiuntivo presente di scontentare |  | `base-table-does-not-list` |
| 414112 | `scontenti` | verb | 2 | seconda persona singolare del congiuntivo presente di scontentare |  | `base-table-does-not-list` |
| 414112 | `scontenti` | verb | 3 | terza persona singolare del congiuntivo presente di scontentare |  | `base-table-does-not-list` |
| 414112 | `scontenti` | verb | 4 | terza persona singolare dell'imperativo presente di scontentare |  | `base-table-does-not-list` |
| 415104 | `astenuto` | verb | 0 | participio passato di astenere, astenersi | `astenersi` | `edge-names-another-word` |
| 416194 | `guagliona` | noun | 0 | femminile di guaglione |  | `not-italian` |
| 417780 | `promesso` | adj | 0 | che è frutto di promesse |  | `not-a-form-gloss` |
| 419478 | `accompagnatore` | noun | 1 | genere maschile di accompagnatrice |  | `not-a-form-gloss` |
| 419820 | `racchiuso` | verb | 0 | participio passato di racchiudere, racchiudersi | `racchiudersi` | `edge-names-another-word` |
| 420332 | `adempiuto` | verb | 0 | participio passato di adempiere, adempiersi | `adempiersi` | `edge-names-another-word` |
| 420353 | `scervellato` | verb | 0 | participio passato di scervellare |  | `no-record-of-base` |
| 420388 | `riconosciuto` | verb | 0 | participio passato di riconoscere, riconoscersi | `riconoscersi` | `edge-names-another-word` |
| 420417 | `inorridito` | verb | 0 | participio passato di inorridire, inorridirsi | `inorridirsi` | `edge-names-another-word` |
| 421590 | `banking` | verb | 0 | participio presente di to bank |  | `not-italian` |
| 422370 | `taciuto` | verb | 0 | participio passato di tacere, tacersi | `tacersi` | `edge-names-another-word` |
| 422435 | `ecatombi` | noun | 0 | plurale di ecatombe |  | `base-table-does-not-list` |
| 422603 | `primitivo` | noun | 0 | persona di cultura non europea che non si è adeguata alle forme di civiltà e di vita del mondo industrializzato |  | `base-table-does-not-list` |
| 423454 | `priora` | noun | 0 | femminile di priora |  | `names-itself` |
| 423716 | `facinorose` | adj | 0 | femminile di facinoroso, ovvero incline alla violenza e alla ribellione. | `ribellione` | `edge-names-another-word` |
| 425357 | `apersi` | verb | 0 | prima persona singolare dell'indicativo passato remoto di aprire (più comune la forma aprii) | `aprii` | `edge-names-another-word` |
| 425358 | `aperse` | verb | 0 | terza persona singolare dell'indicativo passato remoto di aprire (più comune la forma aprì) | `aprì` | `edge-names-another-word` |
| 425359 | `apersero` | verb | 0 | terza persona plurale dell'indicativo passato remoto di aprire (più comune la forma aprirono) | `aprirono` | `edge-names-another-word` |
| 426433 | `raggiunto` | verb | 0 | participio passato di raggiungere, raggiungersi | `raggiungersi` | `edge-names-another-word` |
| 427072 | `inciso` | verb | 0 | participio passato di incidere, incidersi | `incidersi` | `edge-names-another-word` |
| 427732 | `contraddistinto` | verb | 0 | participio passato di contraddistinguere, contraddistinguersi | `contraddistinguersi` | `edge-names-another-word` |
| 429091 | `distorto` | verb | 0 | participio passato di distorcere, distorcersi | `distorcersi` | `edge-names-another-word` |
| 430549 | `distolto` | verb | 0 | participio passato di distogliere, distogliersi | `distogliersi` | `edge-names-another-word` |
| 430678 | `accolto` | verb | 0 | participio passato di accogliere, accogliersi | `accogliersi` | `edge-names-another-word` |
| 434186 | `esplodente` | adj | 0 | in grado di esplodere |  | `not-a-form-gloss` |
| 434297 | `appreso` | verb | 0 | participio passato di apprendere, apprendersi | `apprendersi` | `edge-names-another-word` |
| 434547 | `ripreso` | verb | 0 | participio passato di riprendere, riprendersi | `riprendersi` | `edge-names-another-word` |
| 436500 | `travolto` | verb | 0 | participio passato di travolgere, travolgersi | `travolgersi` | `edge-names-another-word` |
| 437789 | `rinvenuto` | verb | 0 | participio passato di rinvenire, rinvenirsi | `rinvenirsi` | `edge-names-another-word` |
| 438624 | `descritto` | verb | 0 | participio passato di descrivere, descriversi | `descriversi` | `edge-names-another-word` |
| 439478 | `livelli` | verb | 1 | prima persona singolare del congiuntivo presente di livellare |  | `base-table-does-not-list` |
| 439478 | `livelli` | verb | 2 | seconda persona singolare del congiuntivo presente di livellare |  | `base-table-does-not-list` |
| 439478 | `livelli` | verb | 3 | terza persona singolare del congiuntivo presente di livellare |  | `base-table-does-not-list` |
| 439478 | `livelli` | verb | 4 | terza persona singolare dell'imperativo presente di livellare |  | `base-table-does-not-list` |
| 440792 | `attinto` | verb | 0 | participio passato di attingere, attingersi | `attingersi` | `edge-names-another-word` |
| 443139 | `accresciuto` | verb | 0 | participio passato di accrescere, accrescersi | `accrescersi` | `edge-names-another-word` |
| 445352 | `dette` | verb | 1 | terza persona singolare dell'indicativo passato remoto di dare (v. anche diede) | `diede` | `edge-names-another-word` |
| 445836 | `accapigliato` | verb | 0 | participio passato di accapigliare, accapigliarsi | `accapigliarsi` | `edge-names-another-word` |
| 445930 | `confitto` | verb | 0 | participio passato di configgere, configgersi | `configgersi` | `edge-names-another-word` |
| 447744 | `scandinava` | noun | 0 | femminile di scandinavo (donne nate in Scandinavia) | `Scandinavia` | `edge-names-another-word` |
| 447826 | `ridato` | verb | 0 | participio passato di ridare, ridarsi | `ridarsi` | `edge-names-another-word` |
| 449213 | `ilobati` | noun | 0 | plurale di ilobate, scimmia antropomorfa, comunemente denominata gibbone | `gibbone` | `edge-names-another-word` |
| 449344 | `bioetico` | noun | 0 | studioso di bioetica |  | `not-a-form-gloss` |
| 450012 | `protopaleolitica` | noun | 0 | femminile di protopaleolitico |  | `base-table-does-not-list` |
| 450014 | `protopaleolitici` | noun | 0 | plurale di protopaleolitico |  | `base-table-does-not-list` |
| 450016 | `protopaleolitiche` | noun | 0 | femminile plurale di protopaleolitico |  | `base-table-does-not-list` |
| 450202 | `scossi` | verb | 0 | prima persona singolare dell'indicativo passato remoto di scuocere |  | `no-record-of-base` |
| 450780 | `protettrici` | noun | 0 | plurale di protettrici |  | `names-itself` |
| 451073 | `bilinea` | adj | 0 | femminile di bilineo |  | `base-table-does-not-list` |
| 451481 | `anglo-americana` | noun | 0 | femminile di anglo-americano |  | `base-table-does-not-list` |
| 452577 | `narcisisti` | noun | 0 | plurale di narcisista |  | `base-table-does-not-list` |
| 452579 | `narcisiste` | noun | 0 | plurale di narcisista |  | `base-table-does-not-list` |
| 456513 | `telpherages` | noun | 0 | plurale di telpherage |  | `not-italian` |
| 457455 | `astroparticelle` | noun | 0 | plurale di astroparticella |  | `no-record-of-base` |
| 457520 | `mitragliatore` | noun | 0 | militare fornito di mitragliatrice o di moschetto automatico |  | `not-a-form-gloss` |
| 457548 | `consentito` | verb | 0 | participio passato di consentire, consentirsi | `consentirsi` | `edge-names-another-word` |
| 457703 | `estromesso` | verb | 0 | participio passato di estromettere, estromettersi | `estromettersi` | `edge-names-another-word` |
| 458377 | `cristallizzato` | verb | 0 | participio passato di cristallizzare, cristallizzarsi | `cristallizzarsi` | `edge-names-another-word` |
| 458736 | `gastronoma` | noun | 0 | femminile di gastronomo |  | `base-table-does-not-list` |
| 458811 | `isotele` | noun | 0 | plurale di isotela |  | `base-table-does-not-list` |
| 459420 | `riacquisito` | verb | 0 | participio passato di riacquisire |  | `base-table-does-not-list` |
| 459771 | `commendatore` | noun | 2 | persona di elevata classe sociale |  | `base-table-does-not-list` |
| 460307 | `tempi composti` | phrase | 0 | plurale di tempo composto |  | `base-table-does-not-list` |
| 461557 | `infocato` | verb | 0 | participio passato di infocare |  | `no-record-of-base` |
| 461603 | `trappista` | noun | 1 | persona di grande austerità |  | `base-table-does-not-list` |
| 461975 | `Daniels` | name | 0 | plurale di Daniel |  | `not-italian` |
| 462273 | `sfasciumi` | noun | 0 | plurale di sfasciume |  | `no-record-of-base` |
| 462318 | `seudomanti` | noun | 0 | plurale di seudomante |  | `no-record-of-base` |
| 462454 | `Marks` | name | 0 | plurale di Mark |  | `not-italian` |
| 462502 | `portafogli` | noun | 0 | variante di portafoglio |  | `not-a-form-gloss` |
| 463254 | `domand` | noun | 0 | plurale di domanda |  | `not-italian` |
| 463323 | `arreso` | verb | 0 | participio passato di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 463593 | `gravato` | verb | 0 | participio passato di gravare, gravarsi | `gravarsi` | `edge-names-another-word` |
| 464388 | `irruenti` | adj | 0 | plurale di irruente o irruento | `irruento` | `edge-names-another-word` |
| 464438 | `dissuaso` | verb | 0 | participio passato di dissuadere, dissuadersi | `dissuadersi` | `edge-names-another-word` |
| 464954 | `cortigiano` | noun | 0 | persona di corte |  | `base-table-does-not-list` |
| 464993 | `riempito` | verb | 0 | participio passato di riempire, riempirsi | `riempirsi` | `edge-names-another-word` |
| 465070 | `aeroliti` | noun | 0 | plurale di aerolite, aerolito | `aerolito` | `edge-names-another-word` |
| 465266 | `logorato` | verb | 0 | participio passato di logorare, logorarsi | `logorarsi` | `edge-names-another-word` |
| 465605 | `riscosso` | verb | 0 | participio passato di riscuotere, riscuotersi | `riscuotersi` | `edge-names-another-word` |
| 466137 | `Crocodilidi` | noun | 0 | plurale di crocodilide |  | `base-table-does-not-list` |
| 466161 | `Diprotodonti` | noun | 0 | plurale di diprotodonte |  | `base-table-does-not-list` |
| 466229 | `Echinodermi` | noun | 0 | plurale di echinoderma |  | `no-record-of-base` |
| 466232 | `Brachiopodi` | noun | 0 | plurale di brachiopode |  | `no-record-of-base` |
| 466868 | `sedemmo` | verb | 0 | prima persona plurale dell'indicativo passato remoto di sedere | `remoto` | `edge-names-another-word` |
| 466993 | `mila` | adj | 0 | plurale di mille |  | `base-table-does-not-list` |
| 467161 | `imbevuto` | verb | 0 | participio passato maschile di imbevere, imbeversi | `imbeversi` | `edge-names-another-word` |
| 467163 | `immesso` | verb | 0 | participio passato di immettere, immettersi | `immettersi` | `edge-names-another-word` |
| 475326 | `costrutto` | verb | 0 | participio passato di costruire |  | `base-table-does-not-list` |
| 481021 | `barricadera` | adj | 0 | femminile di barricadero, persona incline alla lotta armata |  | `no-record-of-base` |
| 488827 | `bamboche` | noun | 2 | persona di bassa statura, nanerottolo |  | `not-italian` |
| 513414 | `limes` | noun | 0 | plurale di lime |  | `not-italian` |
| 514312 | `istadis` | noun | 0 | plurale di istadi |  | `not-italian` |
| 514321 | `atóngius` | noun | 0 | plurale di atóngiu |  | `not-italian` |
| 514329 | `ierrus` | noun | 0 | plurale di ierru |  | `not-italian` |
| 517052 | `propagatori` | noun | 0 | plurale di propagatore |  | `no-record-of-base` |
| 535332 | `arrendendo` | verb | 0 | gerundio di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535333 | `arrendente` | verb | 0 | participio presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535335 | `arresi` | verb | 0 | prima persona singolare dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535335 | `arresi` | verb | 1 | participio passato maschile plurale di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535339 | `arrese` | verb | 0 | terza persona singolare dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535339 | `arrese` | verb | 1 | participio passato femminile plurale di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535342 | `arrendo` | verb | 0 | prima persona singolare dell'indicativo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535343 | `arrendi` | verb | 0 | seconda persona singolare dell'indicativo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535343 | `arrendi` | verb | 1 | seconda persona singolare dell'imperativo di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535344 | `arrende` | verb | 0 | terza persona singolare dell'indicativo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535345 | `arrendiamo` | verb | 0 | prima persona plurale dell'indicativo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535345 | `arrendiamo` | verb | 1 | prima persona plurale del congiuntivo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535345 | `arrendiamo` | verb | 2 | prima persona plurale dell'imperativo di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535346 | `arrendete` | verb | 0 | seconda persona plurale dell'indicativo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535346 | `arrendete` | verb | 1 | seconda persona plurale dell'imperativo di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535347 | `arrendono` | verb | 0 | terza persona plurale dell'indicativo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535348 | `arrendevo` | verb | 0 | prima persona singolare dell'indicativo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535349 | `arrendevi` | verb | 0 | seconda persona singolare dell'indicativo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535350 | `arrendeva` | verb | 0 | terza persona singolare dell'indicativo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535351 | `arrendevamo` | verb | 0 | prima persona plurale dell'indicativo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535352 | `arrendevate` | verb | 0 | seconda persona plurale dell'indicativo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535353 | `arrendevano` | verb | 0 | terza persona plurale dell'indicativo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535354 | `arrendesti` | verb | 0 | seconda persona singolare dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535355 | `arrendemmo` | verb | 0 | prima persona plurale dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535356 | `arrendeste` | verb | 0 | seconda persona plurale dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535356 | `arrendeste` | verb | 1 | seconda persona plurale del congiuntivo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535357 | `arresero` | verb | 0 | terza persona plurale dell'indicativo passato remoto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535360 | `arrenderò` | verb | 0 | prima persona singolare dell'indicativo futuro di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535361 | `arrenderai` | verb | 0 | seconda persona singolare dell'indicativo futuro di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535362 | `arrenderà` | verb | 0 | terza persona singolare dell'indicativo futuro di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535363 | `arrenderemo` | verb | 0 | prima persona plurale dell'indicativo futuro di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535364 | `arrenderete` | verb | 0 | seconda persona plurale dell'indicativo futuro di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535365 | `arrenderanno` | verb | 0 | terza persona plurale dell'indicativo futuro di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535366 | `arrenderei` | verb | 0 | prima persona singolare del condizionale presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535367 | `arrenderesti` | verb | 0 | seconda persona singolare del condizionale presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535368 | `arrenderebbe` | verb | 0 | terza persona singolare del condizionale presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535369 | `arrenderemmo` | verb | 0 | prima persona plurale del condizionale presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535370 | `arrendereste` | verb | 0 | seconda persona plurale del condizionale presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535371 | `arrenderebbero` | verb | 0 | terza persona plurale del condizionale presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535372 | `arrenda` | verb | 0 | prima persona singolare del congiuntivo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535372 | `arrenda` | verb | 1 | seconda persona singolare del congiuntivo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535372 | `arrenda` | verb | 2 | terza persona singolare del congiuntivo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535372 | `arrenda` | verb | 3 | terza persona singolare dell'imperativo di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535373 | `arrendiate` | verb | 0 | seconda persona plurale del congiuntivo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535374 | `arrendano` | verb | 0 | terza persona plurale del congiuntivo presente di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535374 | `arrendano` | verb | 1 | terza persona plurale dell'imperativo di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535375 | `arrendessi` | verb | 0 | prima persona singolare del congiuntivo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535375 | `arrendessi` | verb | 1 | seconda persona singolare del congiuntivo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535376 | `arrendesse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535377 | `arrendessimo` | verb | 0 | prima persona plurale del congiuntivo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 535378 | `arrendessero` | verb | 0 | terza persona plurale del congiuntivo imperfetto di arrendere, arrendersi | `arrendersi` | `edge-names-another-word` |
| 536367 | `risolto` | verb | 0 | participio passato di risolvere, risolversi | `risolversi` | `edge-names-another-word` |
| 537457 | `complimentando` | verb | 0 | gerundio di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537458 | `complimentante` | verb | 0 | participio presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537460 | `complimentato` | verb | 0 | participio passato di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537463 | `complimentate` | verb | 0 | seconda persona plurale dell'indicativo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537463 | `complimentate` | verb | 1 | seconda persona plurale dell'imperativo di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537463 | `complimentate` | verb | 2 | participio passato femminile plurale di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537464 | `complimenta` | verb | 0 | terza persona singolare dell'indicativo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537464 | `complimenta` | verb | 1 | seconda persona singolare dell'imperativo di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537465 | `complimentiamo` | verb | 0 | prima persona plurale dell'indicativo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537465 | `complimentiamo` | verb | 1 | prima persona plurale del congiuntivo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537465 | `complimentiamo` | verb | 2 | prima persona plurale dell'imperativo di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537466 | `complimentano` | verb | 0 | terza persona plurale dell'indicativo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537467 | `complimentavo` | verb | 0 | prima persona singolare dell'indicativo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537468 | `complimentavi` | verb | 0 | seconda persona singolare dell'indicativo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537469 | `complimentava` | verb | 0 | terza persona singolare dell'indicativo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537470 | `complimentavamo` | verb | 0 | prima persona plurale dell'indicativo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537471 | `complimentavate` | verb | 0 | seconda persona plurale dell'indicativo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537472 | `complimentavano` | verb | 0 | terza persona plurale dell'indicativo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537473 | `complimentai` | verb | 0 | prima persona singolare dell'indicativo passato remoto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537474 | `complimentasti` | verb | 0 | seconda persona singolare dell'indicativo passato remoto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537475 | `complimentò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537476 | `complimentammo` | verb | 0 | prima persona plurale dell'indicativo passato remoto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537477 | `complimentaste` | verb | 0 | seconda persona plurale dell'indicativo passato remoto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537477 | `complimentaste` | verb | 1 | seconda persona plurale del congiuntivo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537478 | `complimentarono` | verb | 0 | terza persona plurale dell'indicativo passato remoto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537479 | `complimenterò` | verb | 0 | prima persona singolare dell'indicativo futuro di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537480 | `complimenterai` | verb | 0 | seconda persona singolare dell'indicativo futuro di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537481 | `complimenterà` | verb | 0 | terza persona singolare dell'indicativo futuro di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537482 | `complimenteremo` | verb | 0 | prima persona plurale dell'indicativo futuro di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537483 | `complimenterete` | verb | 0 | seconda persona plurale dell'indicativo futuro di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537484 | `complimenteranno` | verb | 0 | terza persona plurale dell'indicativo futuro di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537485 | `complimenterei` | verb | 0 | prima persona singolare del condizionale presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537486 | `complimenteresti` | verb | 0 | seconda persona singolare del condizionale presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537487 | `complimenterebbe` | verb | 0 | terza persona singolare del condizionale presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537488 | `complimenteremmo` | verb | 0 | prima persona plurale del condizionale presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537489 | `complimentereste` | verb | 0 | seconda persona plurale del condizionale presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537490 | `complimenterebbero` | verb | 0 | terza persona plurale del condizionale presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537491 | `complimentiate` | verb | 0 | seconda persona plurale del congiuntivo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537493 | `complimentino` | verb | 0 | terza persona plurale del congiuntivo presente di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537493 | `complimentino` | verb | 1 | terza persona plurale dell'imperativo di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537494 | `complimentassi` | verb | 0 | prima persona singolare del congiuntivo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537494 | `complimentassi` | verb | 1 | seconda persona singolare del congiuntivo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537495 | `complimentasse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537496 | `complimentassimo` | verb | 0 | prima persona plurale del congiuntivo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537497 | `complimentassero` | verb | 0 | terza persona plurale del congiuntivo imperfetto di complimentare, complimentarsi | `complimentarsi` | `edge-names-another-word` |
| 537667 | `azzuffando` | verb | 0 | gerundio di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537668 | `azzuffante` | verb | 0 | participio presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537672 | `azzuffate` | verb | 0 | seconda persona plurale dell'indicativo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537672 | `azzuffate` | verb | 1 | seconda persona plurale dell'imperativo di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537672 | `azzuffate` | verb | 2 | participio passato femminile plurale di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537673 | `azzuffo` | verb | 0 | prima persona singolare dell'indicativo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537674 | `azzuffi` | verb | 0 | seconda persona singolare dell'indicativo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537674 | `azzuffi` | verb | 1 | prima persona singolare del congiuntivo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537674 | `azzuffi` | verb | 2 | seconda persona singolare del congiuntivo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537674 | `azzuffi` | verb | 3 | terza persona singolare del congiuntivo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537674 | `azzuffi` | verb | 4 | terza persona singolare dell'imperativo di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537675 | `azzuffa` | verb | 0 | terza persona singolare dell'indicativo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537675 | `azzuffa` | verb | 1 | seconda persona singolare dell'imperativo di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537676 | `azzuffiamo` | verb | 0 | prima persona plurale dell'indicativo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537676 | `azzuffiamo` | verb | 1 | prima persona plurale del congiuntivo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537676 | `azzuffiamo` | verb | 2 | prima persona plurale dell'imperativo di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537677 | `azzuffano` | verb | 0 | terza persona plurale dell'indicativo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537678 | `azzuffavo` | verb | 0 | prima persona singolare dell'indicativo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537679 | `azzuffavi` | verb | 0 | seconda persona singolare dell'indicativo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537680 | `azzuffava` | verb | 0 | terza persona singolare dell'indicativo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537681 | `azzuffavamo` | verb | 0 | prima persona plurale dell'indicativo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537682 | `azzuffavate` | verb | 0 | seconda persona plurale dell'indicativo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537683 | `azzuffavano` | verb | 0 | terza persona plurale dell'indicativo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537684 | `azzuffai` | verb | 0 | prima persona singolare dell'indicativo passato remoto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537685 | `azzuffasti` | verb | 0 | seconda persona singolare dell'indicativo passato remoto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537686 | `azzuffò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537687 | `azzuffammo` | verb | 0 | prima persona plurale dell'indicativo passato remoto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537688 | `azzuffaste` | verb | 0 | seconda persona plurale dell'indicativo passato remoto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537688 | `azzuffaste` | verb | 1 | seconda persona plurale del congiuntivo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537689 | `azzuffarono` | verb | 0 | terza persona plurale dell'indicativo passato remoto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537690 | `azzufferò` | verb | 0 | prima persona singolare dell'indicativo futuro di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537691 | `azzufferai` | verb | 0 | seconda persona singolare dell'indicativo futuro di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537692 | `azzufferà` | verb | 0 | terza persona singolare dell'indicativo futuro di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537693 | `azzufferemo` | verb | 0 | prima persona plurale dell'indicativo futuro di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537694 | `azzufferete` | verb | 0 | seconda persona plurale dell'indicativo futuro di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537695 | `azzufferanno` | verb | 0 | terza persona plurale dell'indicativo futuro di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537696 | `azzufferei` | verb | 0 | prima persona singolare del condizionale presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537697 | `azzufferesti` | verb | 0 | seconda persona singolare del condizionale presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537698 | `azzufferebbe` | verb | 0 | terza persona singolare del condizionale presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537699 | `azzufferemmo` | verb | 0 | prima persona plurale del condizionale presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537700 | `azzuffereste` | verb | 0 | seconda persona plurale del condizionale presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537701 | `azzufferebbero` | verb | 0 | terza persona plurale del condizionale presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537702 | `azzuffiate` | verb | 0 | seconda persona plurale del congiuntivo presente di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537703 | `azzuffassi` | verb | 0 | prima persona singolare del congiuntivo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537703 | `azzuffassi` | verb | 1 | seconda persona singolare del congiuntivo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537704 | `azzuffasse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537705 | `azzuffassimo` | verb | 0 | prima persona plurale del congiuntivo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537706 | `azzuffassero` | verb | 0 | terza persona plurale del congiuntivo imperfetto di azzuffare, azzuffarsi | `azzuffarsi` | `edge-names-another-word` |
| 537746 | `attardando` | verb | 0 | gerundio di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537747 | `attardante` | verb | 0 | participio presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537749 | `attardato` | verb | 0 | participio passato di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537752 | `attardate` | verb | 0 | seconda persona plurale dell'indicativo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537752 | `attardate` | verb | 1 | seconda persona plurale dell'imperativo di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537752 | `attardate` | verb | 2 | participio passato femminile plurale di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537753 | `attardo` | verb | 0 | prima persona singolare dell'indicativo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537754 | `attardi` | verb | 0 | seconda persona singolare dell'indicativo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537754 | `attardi` | verb | 1 | prima persona singolare del congiuntivo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537754 | `attardi` | verb | 2 | seconda persona singolare del congiuntivo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537754 | `attardi` | verb | 3 | terza persona singolare del congiuntivo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537754 | `attardi` | verb | 4 | terza persona singolare dell'imperativo di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537755 | `attarda` | verb | 0 | terza persona singolare dell'indicativo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537755 | `attarda` | verb | 1 | seconda persona singolare dell'imperativo di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537756 | `attardiamo` | verb | 0 | prima persona plurale dell'indicativo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537756 | `attardiamo` | verb | 1 | prima persona plurale del congiuntivo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537756 | `attardiamo` | verb | 2 | prima persona plurale dell'imperativo di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537757 | `attardano` | verb | 0 | terza persona plurale dell'indicativo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537758 | `attardavo` | verb | 0 | prima persona singolare dell'indicativo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537759 | `attardavi` | verb | 0 | seconda persona singolare dell'indicativo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537760 | `attardava` | verb | 0 | terza persona singolare dell'indicativo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537761 | `attardavamo` | verb | 0 | prima persona plurale dell'indicativo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537762 | `attardavate` | verb | 0 | seconda persona plurale dell'indicativo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537763 | `attardavano` | verb | 0 | terza persona plurale dell'indicativo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537764 | `attardai` | verb | 0 | prima persona singolare dell'indicativo passato remoto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537765 | `attardasti` | verb | 0 | seconda persona singolare dell'indicativo passato remoto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537766 | `attardò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537767 | `attardammo` | verb | 0 | prima persona plurale dell'indicativo passato remoto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537768 | `attardaste` | verb | 0 | seconda persona plurale dell'indicativo passato remoto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537768 | `attardaste` | verb | 1 | seconda persona plurale del congiuntivo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537769 | `attardarono` | verb | 0 | terza persona plurale dell'indicativo passato remoto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537770 | `attarderò` | verb | 0 | prima persona singolare dell'indicativo futuro di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537771 | `attarderai` | verb | 0 | seconda persona singolare dell'indicativo futuro di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537772 | `attarderà` | verb | 0 | terza persona singolare dell'indicativo futuro di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537773 | `attarderemo` | verb | 0 | prima persona plurale dell'indicativo futuro di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537774 | `attarderete` | verb | 0 | seconda persona plurale dell'indicativo futuro di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537775 | `attarderanno` | verb | 0 | terza persona plurale dell'indicativo futuro di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537776 | `attarderei` | verb | 0 | prima persona singolare del condizionale presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537777 | `attarderesti` | verb | 0 | seconda persona singolare del condizionale presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537778 | `attarderebbe` | verb | 0 | terza persona singolare del condizionale presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537779 | `attarderemmo` | verb | 0 | prima persona plurale del condizionale presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537780 | `attardereste` | verb | 0 | seconda persona plurale del condizionale presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537781 | `attarderebbero` | verb | 0 | terza persona plurale del condizionale presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537782 | `attardiate` | verb | 0 | seconda persona plurale del congiuntivo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537783 | `attardino` | verb | 0 | terza persona plurale del congiuntivo presente di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537783 | `attardino` | verb | 1 | terza persona plurale dell'imperativo di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537784 | `attardassi` | verb | 0 | prima persona singolare del congiuntivo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537784 | `attardassi` | verb | 1 | seconda persona singolare del congiuntivo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537785 | `attardasse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537786 | `attardassimo` | verb | 0 | prima persona plurale del congiuntivo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 537787 | `attardassero` | verb | 0 | terza persona plurale del congiuntivo imperfetto di attardare, attardarsi | `attardarsi` | `edge-names-another-word` |
| 539043 | `ciba` | verb | 0 | terza persona singolare dell'indicativo presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539043 | `ciba` | verb | 1 | seconda persona singolare dell'imperativo di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539089 | `Klarinette` | noun | 0 | plurale di Klarinett |  | `not-italian` |
| 539154 | `sgradito` | verb | 0 | participio passato di sgradire |  | `base-table-does-not-list` |
| 539375 | `cibando` | verb | 0 | gerundio di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539376 | `cibante` | verb | 0 | participio presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539378 | `cibato` | verb | 0 | participio passato di cibare, cibarsi | `cibarsi` | `edge-names-another-word` |
| 539381 | `cibate` | verb | 0 | seconda persona plurale dell'indicativo presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539381 | `cibate` | verb | 1 | seconda persona plurale dell'imperativo di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539381 | `cibate` | verb | 2 | participio passato femminile plurale di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539382 | `cibiamo` | verb | 0 | prima persona plurale dell'indicativo presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539382 | `cibiamo` | verb | 1 | prima persona plurale del congiuntivo presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539382 | `cibiamo` | verb | 2 | prima persona plurale dell'imperativo di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539383 | `cibano` | verb | 0 | terza persona plurale dell'indicativo presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539384 | `cibavo` | verb | 0 | prima persona singolare dell'indicativo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539385 | `cibavi` | verb | 0 | seconda persona singolare dell'indicativo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539386 | `cibava` | verb | 0 | terza persona singolare dell'indicativo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539387 | `cibavamo` | verb | 0 | prima persona plurale dell'indicativo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539388 | `cibavate` | verb | 0 | seconda persona plurale dell'indicativo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539389 | `cibavano` | verb | 0 | terza persona plurale dell'indicativo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539390 | `cibai` | verb | 0 | prima persona singolare dell'indicativo passato remoto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539391 | `cibasti` | verb | 0 | seconda persona singolare dell'indicativo passato remoto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539392 | `cibò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539393 | `cibammo` | verb | 0 | prima persona plurale dell'indicativo passato remoto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539394 | `cibaste` | verb | 0 | seconda persona plurale dell'indicativo passato remoto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539394 | `cibaste` | verb | 1 | seconda persona plurale del congiuntivo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539395 | `cibarono` | verb | 0 | terza persona plurale dell'indicativo passato remoto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539396 | `ciberò` | verb | 0 | prima persona singolare dell'indicativo futuro di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539397 | `ciberai` | verb | 0 | seconda persona singolare dell'indicativo futuro di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539398 | `ciberà` | verb | 0 | terza persona singolare dell'indicativo futuro di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539399 | `ciberemo` | verb | 0 | prima persona plurale dell'indicativo futuro di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539400 | `ciberete` | verb | 0 | seconda persona plurale dell'indicativo futuro di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539401 | `ciberanno` | verb | 0 | terza persona plurale dell'indicativo futuro di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539402 | `ciberei` | verb | 0 | prima persona singolare del condizionale presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539403 | `ciberesti` | verb | 0 | seconda persona singolare del condizionale presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539404 | `ciberebbe` | verb | 0 | terza persona singolare del condizionale presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539405 | `ciberemmo` | verb | 0 | prima persona plurale del condizionale presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539406 | `cibereste` | verb | 0 | seconda persona plurale del condizionale presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539407 | `ciberebbero` | verb | 0 | terza persona plurale del condizionale presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539408 | `cibiate` | verb | 0 | seconda persona plurale del congiuntivo presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539409 | `cibino` | verb | 0 | terza persona plurale del congiuntivo presente di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539409 | `cibino` | verb | 1 | terza persona plurale dell'imperativo di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539410 | `cibassi` | verb | 0 | prima persona singolare del congiuntivo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539410 | `cibassi` | verb | 1 | seconda persona singolare del congiuntivo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539411 | `cibasse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539412 | `cibassimo` | verb | 0 | prima persona plurale del congiuntivo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 539413 | `cibassero` | verb | 0 | terza persona plurale del congiuntivo imperfetto di cibare/cibarsi | `cibarsi` | `edge-names-another-word` |
| 541141 | `saltabecche` | noun | 0 | plurale di saltabecca |  | `base-table-does-not-list` |
| 544508 | `comportato` | verb | 0 | participio passato di comportare, comportarsi | `comportarsi` | `edge-names-another-word` |
| 544644 | `scelti` | verb | 0 | participio passato plurale di scegliere |  | `base-table-does-not-list` |
| 545075 | `danzatori` | noun | 0 | plurale di danzatori |  | `names-itself` |
| 545282 | `bottegaia` | noun | 0 | femminmile di bottegaio |  | `not-a-form-gloss` |
| 546817 | `sofferto` | verb | 0 | participio passato di soffrire, soffrirsi | `soffrirsi` | `edge-names-another-word` |
| 547313 | `goduto` | verb | 0 | participio passato di godere, godersi | `godersi` | `edge-names-another-word` |
| 547326 | `sepolti` | verb | 0 | participio passato plurale di seppellire |  | `base-table-does-not-list` |
| 547380 | `ponteficali` | adj | 0 | plurale di ponteficale |  | `base-table-does-not-list` |
| 547381 | `ponteficali` | noun | 0 | plurale di ponteficale |  | `base-table-does-not-list` |
| 547895 | `Pestizide` | noun | 0 | plurale di Pestizid |  | `not-italian` |
| 548576 | `gastrostomie` | noun | 0 | plurale di gastrostomia |  | `no-record-of-base` |
| 548615 | `babok` | noun | 0 | plurale di bab |  | `not-italian` |
| 548987 | `riaperto` | verb | 0 | participio passato di riaprire, riaprirsi | `riaprirsi` | `edge-names-another-word` |
| 550069 | `dissolto` | verb | 0 | participio passato di dissolvere, dissolversi | `dissolversi` | `edge-names-another-word` |
| 550942 | `borei` | noun | 0 | plurale di borei |  | `names-itself` |
| 551568 | `trentine` | noun | 0 | plurale di trentina, abitante di Trento o del Trentino | `Trentino` | `edge-names-another-word` |
| 555667 | `totolin` | noun | 0 | femminile singolare di tacchino |  | `not-italian` |
| 556573 | `szögek` | noun | 0 | plurale di szög |  | `not-italian` |
| 557823 | `büfék` | noun | 0 | plurale di büfé |  | `not-italian` |
| 558057 | `gabonák` | noun | 0 | plurale di gabona |  | `not-italian` |
| 560325 | `bátyok` | noun | 0 | plurale di báty |  | `not-italian` |
| 560381 | `piaciuto` | verb | 0 | participio passato di piacere, piacersi | `piacersi` | `edge-names-another-word` |
| 560457 | `hollók` | noun | 0 | plurale di holló |  | `not-italian` |
| 560458 | `házak` | noun | 0 | plurale di ház |  | `not-italian` |
| 561841 | `desertificato` | verb | 0 | participio passato di desertificare, desertificarsi | `desertificarsi` | `edge-names-another-word` |
| 561929 | `sorellastra` | noun | 0 | persona di sesso femminile con un solo genitore in comune con un'altra persona |  | `base-table-does-not-list` |
| 566613 | `rimasto` | verb | 0 | participio passato di rimanere, rimanersi | `rimanersi` | `edge-names-another-word` |
| 567120 | `fanerogame` | noun | 0 | plurale di fanerogama |  | `base-table-does-not-list` |
| 568728 | `rovinata` | adj | 0 | femminile di rovinato |  | `base-table-does-not-list` |
| 570097 | `bonari` | noun | 0 | pòurale di bonario |  | `not-a-form-gloss` |
| 579557 | `embrici` | noun | 0 | plurale di embrice |  | `base-table-does-not-list` |
| 579773 | `repleta` | adj | 0 | femminile singolare di repleto |  | `base-table-does-not-list` |
| 581538 | `ammaliziato` | verb | 0 | participio passato di ammaliziare |  | `no-record-of-base` |
| 581905 | `espiato` | verb | 0 | participio passato di espiare |  | `base-table-does-not-list` |
| 582450 | `scontentò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di scontentare |  | `base-table-does-not-list` |
| 582468 | `scontentato` | verb | 0 | participio passato di scontentare |  | `base-table-does-not-list` |
| 582722 | `武器` | noun | 0 | plurale di 武器 |  | `not-italian` |
| 582782 | `logorate` | adj | 0 | plurale femminile di logorate |  | `names-itself` |
| 582864 | `prevalse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di prevalere |  | `base-table-does-not-list` |
| 582961 | `folcloristici` | adj | 0 | plurale di folocloristico |  | `no-record-of-base` |
| 583029 | `rivede` | verb | 0 | terza persona singolare dell'indicativo presente di leggere |  | `base-table-does-not-list` |
| 583160 | `Aare` | noun | 0 | plurale di Aar |  | `not-italian` |
| 583185 | `nutritiva` | adj | 0 | fmminile di nutritivo |  | `not-a-form-gloss` |
| 583421 | `successe` | verb | 0 | participio passato plurale femminile di succedere |  | `base-table-does-not-list` |
| 583701 | `bevuti` | verb | 0 | participio passato plurale di bere |  | `base-table-does-not-list` |
| 583945 | `irrealistiche` | adj | 0 | femminile di plurale di irrealistico |  | `base-table-does-not-list` |
| 583958 | `dritti` | noun | 0 | plurale di dritto |  | `base-table-does-not-list` |
| 584070 | `villainess` | noun | 0 | femminile di villain |  | `not-italian` |
| 584081 | `eseguita` | verb | 0 | participio passato femminile di eseguire |  | `base-table-does-not-list` |
| 584184 | `fuorvii` | verb | 1 | prima persona singolare del congiuntivo presente di fuorviare |  | `no-record-of-base` |
| 584184 | `fuorvii` | verb | 2 | seconda persona singolare del congiuntivo presente di fuorviare |  | `no-record-of-base` |
| 584184 | `fuorvii` | verb | 3 | terza persona singolare del congiuntivo presente di fuorviare |  | `no-record-of-base` |
| 584184 | `fuorvii` | verb | 4 | terza persona singolare dell'imperativo presente di fuorviare |  | `no-record-of-base` |
| 584188 | `ascensioni` | noun | 0 | plurale di ascensione |  | `not-italian` |
| 584191 | `spruzzata` | verb | 0 | participio passato femminile di spruzzare |  | `base-table-does-not-list` |
| 584276 | `esecutivi` | noun | 0 | plurale di governo |  | `base-table-does-not-list` |
| 584345 | `provveduta` | verb | 0 | participio passato femminile di provvedere |  | `base-table-does-not-list` |
| 584546 | `appassite` | verb | 1 | seconda persona plurale dell'indicativo presente di appassire |  | `base-table-does-not-list` |
| 584546 | `appassite` | verb | 2 | seconda persona plurale dell'imperativo presente di appassire |  | `base-table-does-not-list` |
| 584550 | `annesse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di annettere |  | `base-table-does-not-list` |
| 584574 | `josei mangas` | phrase | 0 | plurale di josei manga |  | `not-italian` |
| 584599 | `kappa makis` | phrase | 0 | plurale di kappa maki |  | `not-italian` |
| 584652 | `lectures kun` | phrase | 0 | plurale di lecture kun |  | `not-italian` |
| 584653 | `lectures nanori` | phrase | 0 | plurale di lecture nanori |  | `not-italian` |
| 584654 | `lectures on` | phrase | 0 | plurale di lecture on |  | `not-italian` |
| 584656 | `mae geris` | phrase | 0 | plurale di mae geri |  | `not-italian` |
| 584714 | `pains melons` | phrase | 0 | plurale di pain melon |  | `not-italian` |
| 584723 | `romans visuels` | phrase | 0 | plurale di roman visuel |  | `not-italian` |
| 584785 | `taisho kotos` | phrase | 0 | plurale di taisho koto |  | `not-italian` |
| 584815 | `visual novels` | phrase | 0 | plurale di visual novel |  | `not-italian` |
| 584842 | `annessi` | verb | 1 | prima persona singolare dell'indicativo passato remoto di annettere |  | `base-table-does-not-list` |
| 584844 | `avulsi` | verb | 1 | prima persona singolare dell'indicativo passato remoto di avellere |  | `no-record-of-base` |
| 584862 | `imbrodolò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di imbrodolare |  | `no-record-of-base` |
| 584891 | `disdegnamo` | verb | 1 | prima persona plurale dell'imperativo presente di disdegnare |  | `base-table-does-not-list` |
| 585049 | `espia` | verb | 1 | seconda persona singolare dell'imperativo presente di espiare |  | `base-table-does-not-list` |
| 585126 | `sentiti` | verb | 0 | participio passato plurale di sentire |  | `base-table-does-not-list` |
| 585128 | `patiti` | verb | 0 | participio passato plurale di patire |  | `base-table-does-not-list` |
| 585228 | `perfeziono` | verb | 0 | prima persona singolare dell'indicativo presente di perfezionare |  | `base-table-does-not-list` |
| 585229 | `perfezionò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di perfezionare |  | `base-table-does-not-list` |
| 585231 | `risolte` | verb | 0 | participio passato plurale femminile di risolvere |  | `base-table-does-not-list` |
| 585358 | `raggrinza` | verb | 1 | seconda persona singolare dell'imperativo presente di raggrinzare |  | `base-table-does-not-list` |
| 585368 | `ricuci` | verb | 1 | seconda persona singolare dell'imperativo presente di ricucire |  | `no-record-of-base` |
| 585593 | `spruzzati` | verb | 0 | participio passato plurale di spruzzare |  | `base-table-does-not-list` |
| 585729 | `trasandate` | adj | 0 | femminile pluraòe di trasandato |  | `not-a-form-gloss` |
| 585823 | `meravigliò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di meravigliare |  | `base-table-does-not-list` |
| 585916 | `riflettuta` | verb | 0 | participio passato femminile di riflettere |  | `base-table-does-not-list` |
| 586482 | `cinematografò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di cinematografare |  | `base-table-does-not-list` |
| 586694 | `asteracee` | noun | 0 | plurale di asteracea |  | `base-table-does-not-list` |
| 587173 | `capimafia` | noun | 0 | plurale di capomafia |  | `base-table-does-not-list` |
| 587195 | `permuti` | verb | 1 | prima persona singolare del congiuntivo presente di permutare |  | `base-table-does-not-list` |
| 587195 | `permuti` | verb | 2 | seconda persona singolare del congiuntivo presente di permutare |  | `base-table-does-not-list` |
| 588225 | `meses` | noun | 0 | plurale di mês |  | `not-italian` |
| 588226 | `janeiros` | noun | 0 | plurale di janeiro |  | `not-italian` |
| 588937 | `incisivi` | noun | 0 | plurale di dente |  | `base-table-does-not-list` |
| 589255 | `multimiliardaria` | noun | 0 | fmminile di multimiliardario |  | `not-a-form-gloss` |
| 589931 | `sfatto` | verb | 0 | participio passato di sfare |  | `no-record-of-base` |
| 589933 | `sfatta` | verb | 0 | participio passato femminile di sfare |  | `no-record-of-base` |
| 589935 | `sfatti` | verb | 0 | participio passato plurale di sfare |  | `no-record-of-base` |
| 589937 | `sfatte` | verb | 0 | participio passato femminile plurale di sfare |  | `no-record-of-base` |
| 590205 | `handen` | noun | 0 | plurale di hand |  | `not-italian` |
| 590219 | `wink` | verb | 0 | imperativo singolare di winken |  | `not-italian` |
| 590219 | `wink` | verb | 1 | prima persona singolare del presente indicativo di winken |  | `not-italian` |
| 590728 | `logorata` | verb | 0 | participio passato femminile di logorare |  | `base-table-does-not-list` |
| 590865 | `sconnesse` | verb | 0 | participio passato plurale femminile di sconnettere |  | `base-table-does-not-list` |
| 590865 | `sconnesse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di sconnettere |  | `base-table-does-not-list` |
| 590887 | `sfiammate` | verb | 1 | seconda persona plurale dell'indicativo presente di sfiammare |  | `no-record-of-base` |
| 590887 | `sfiammate` | verb | 2 | seconda persona plurale dell'imperativo presente di sfiammare |  | `no-record-of-base` |
| 591067 | `rimbombato` | verb | 0 | participio passsato di rimbombare |  | `not-a-form-gloss` |
| 591509 | `usciti` | verb | 0 | participio passato plurale di uscire |  | `base-table-does-not-list` |
| 591724 | `pescatrice` | noun | 0 | persona di sesso femminile che si occupa di pescare pesci e altro per poi venderli |  | `base-table-does-not-list` |
| 591970 | `burning` | verb | 0 | participio presente di to burn |  | `not-italian` |
| 592503 | `cowgirl` | noun | 0 | femminile di cowboy |  | `not-italian` |
| 592764 | `ripercossi` | verb | 0 | participio passato plurale di ripercuotere |  | `base-table-does-not-list` |
| 592764 | `ripercossi` | verb | 1 | prima persona singolare dell'indicativo passato remoto di ripercuotere |  | `base-table-does-not-list` |
| 592779 | `sbieca` | verb | 0 | terza persona singolare dell'indicativo presente di sbiecare |  | `no-record-of-base` |
| 592779 | `sbieca` | verb | 1 | seconda persona singolare dell'imperativo presente di sbiecare |  | `no-record-of-base` |
| 595105 | `deviata` | adj | 0 | femminile di deviato |  | `base-table-does-not-list` |
| 595528 | `stagnata` | verb | 0 | participio passato femminile di stagnare |  | `base-table-does-not-list` |
| 595539 | `fiatamo` | verb | 1 | prima persona plurale del congiuntivo presente di fiatare |  | `base-table-does-not-list` |
| 595539 | `fiatamo` | verb | 2 | prima persona plurale dell'imperativo presente di fiatare |  | `base-table-does-not-list` |
| 595914 | `destata` | verb | 0 | participio passato femminile di destare |  | `base-table-does-not-list` |
| 596445 | `fraudolenta` | adj | 0 | femminile di fraudolento | `femminile` | `edge-names-another-word` |
| 596749 | `buljonoj` | noun | 0 | plurale di buljono |  | `not-italian` |
| 596993 | `malvestita` | adj | 0 | femminile di malvestito | `femminile` | `edge-names-another-word` |
| 597598 | `stagliati` | adj | 0 | plurale di stagliato |  | `base-table-does-not-list` |
| 597961 | `superalcolici` | adj | 0 | plurale di superalcolico | `plurale` | `edge-names-another-word` |
| 599084 | `efficacie` | noun | 0 | plurale di efficacia |  | `base-table-does-not-list` |
| 599498 | `Pizie` | noun | 0 | plurale di pizia |  | `base-table-does-not-list` |
| 599523 | `ostreidi` | noun | 0 | plurale di ostreide |  | `base-table-does-not-list` |
| 599828 | `abbattette` | verb | 0 | terza persona singolare dell'indicativo passato remoto di abbattere |  | `base-table-does-not-list` |
| 599865 | `circondari` | noun | 0 | plurale di circondario |  | `base-table-does-not-list` |
| 600252 | `sotterranea` | adj | 0 | femminile di sotterraneo |  | `base-table-does-not-list` |
| 601073 | `neonazisti` | adj | 0 | plurale di neonazista | `plurale` | `edge-names-another-word` |
| 601587 | `esplorativi` | adj | 0 | plurale di esplorativo | `plurale` | `edge-names-another-word` |
| 601697 | `mezzasega` | noun | 0 | Persona di piccola statura e dall'aspetto gracile |  | `base-table-does-not-list` |
| 602279 | `murature` | noun | 0 | plurale di muratura |  | `base-table-does-not-list` |
| 604543 | `chimes` | noun | 0 | plurale di chime |  | `no-record-of-base` |
| 605513 | `pregne` | adj | 0 | femminile plurale di pregno |  | `base-table-does-not-list` |
| 606034 | `mamelucchi` | noun | 0 | plurale di mamelucco |  | `no-record-of-base` |
| 606887 | `piroette` | noun | 0 | plurale di piroetta |  | `base-table-does-not-list` |
| 606959 | `retrocessi` | verb | 1 | prima persona singolare dell'indicativo passato remoto di retrocedere |  | `base-table-does-not-list` |
| 607270 | `attractive` | adj | 0 | femminile singolare di attractif |  | `not-italian` |
| 607279 | `killing` | verb | 0 | participio presente di kill |  | `not-italian` |
| 607283 | `goods` | noun | 0 | plurale di good |  | `not-italian` |
| 611363 | `gommiste` | noun | 0 | femminile plurale di gommista |  | `base-table-does-not-list` |
| 612214 | `rileccato` | verb | 0 | participio passato di rileccato |  | `names-itself` |
| 612406 | `roosters` | noun | 0 | plurale di rooster, gallo |  | `not-italian` |
| 612902 | `palpeggiatore` | noun | 0 | persona di sesso maschile che tocca una donna in modo indecente |  | `base-table-does-not-list` |
| 613558 | `sbattette` | verb | 0 | terza persona singolare dell'indicativo passato remoto di sbattere |  | `base-table-does-not-list` |
| 613753 | `retrocesse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di retrocedere |  | `base-table-does-not-list` |
| 614162 | `espio` | verb | 0 | prima persona singolare dell'indicativo presente di espiare |  | `base-table-does-not-list` |
| 614914 | `anfitriona` | noun | 0 | femminile di anfitrione |  | `base-table-does-not-list` |
| 618976 | `guinea` | noun | 1 | persona di origine italiana |  | `not-italian` |
| 619010 | `ninguém` | noun | 0 | persona di poca importanza; signor nessuno |  | `not-italian` |
| 621838 | `nouvelle` | adj | 0 | femminile singolare di nouveau |  | `not-italian` |
| 621963 | `guardrails` | noun | 0 | plurale di guardrail |  | `not-italian` |
| 621964 | `tunnels` | noun | 0 | plurale di tunnel |  | `not-italian` |
| 621965 | `motels` | noun | 0 | plurale di motel |  | `not-italian` |
| 621966 | `hotels` | noun | 0 | plurale di hotel |  | `not-italian` |
| 621967 | `clowns` | noun | 0 | plurale di clown |  | `not-italian` |
| 621968 | `revolvers` | noun | 0 | plurale di revolver |  | `not-italian` |
| 621969 | `computers` | noun | 0 | plurale di computer |  | `not-italian` |
| 621970 | `hamburgers` | noun | 0 | plurale di hamburger |  | `not-italian` |
| 621972 | `weekends` | noun | 0 | plurale di weekend |  | `not-italian` |
| 621975 | `pacemakers` | noun | 0 | plurale di pacemaker |  | `not-italian` |
| 621993 | `camions` | noun | 0 | Plurale di camion |  | `not-italian` |
| 621994 | `biberons` | noun | 0 | Plurale di biberon |  | `not-italian` |
| 621995 | `garages` | noun | 0 | Plurale di garage |  | `not-italian` |
| 621996 | `garages` | noun | 0 | plurale di garage |  | `not-italian` |
| 621997 | `hôtels` | noun | 0 | Plurale di hôtel |  | `not-italian` |
| 622000 | `gunnels` | noun | 0 | plurale di gunnel |  | `not-italian` |
| 622001 | `funnels` | noun | 0 | plurale di funnel |  | `not-italian` |
| 622002 | `runnels` | noun | 0 | plurale di runnel |  | `not-italian` |
| 622003 | `handrails` | noun | 0 | plurale di handrail |  | `not-italian` |
| 622004 | `railroads` | noun | 0 | plurale di railroad |  | `not-italian` |
| 622005 | `cars` | noun | 0 | plurale di car |  | `not-italian` |
| 622006 | `trucks` | noun | 0 | plurale di truck |  | `not-italian` |
| 622007 | `roads` | noun | 0 | plurale di road |  | `not-italian` |
| 622008 | `chocolates` | noun | 0 | plurale di chocolate |  | `not-italian` |
| 622009 | `chocolates` | noun | 0 | Plurale di chocolate |  | `not-italian` |
| 622010 | `chocolats` | noun | 0 | Plurale di chocolat |  | `not-italian` |
| 622159 | `idents` | noun | 0 | plurale di ident |  | `not-italian` |
| 622160 | `bumpers` | noun | 0 | plurale di bumper |  | `not-italian` |
| 622161 | `jingles` | noun | 0 | plurale di jingle |  | `not-italian` |
| 622363 | `tuners` | noun | 0 | plurale di tuner |  | `not-italian` |
| 622364 | `freezers` | noun | 0 | plurale di freezer |  | `not-italian` |
| 622368 | `encoders` | noun | 0 | plurale di encoder |  | `not-italian` |
| 622369 | `decoders` | noun | 0 | plurale di decoder |  | `not-italian` |
| 622374 | `hovercrafts` | noun | 0 | plurale di hovercraft |  | `not-italian` |
| 622375 | `halibuts` | noun | 0 | plurale di halibut |  | `not-italian` |
| 623762 | `fusilli` | noun | 0 | plurale di fusillo; pasta di grano duro che assomiglia ad un vite elicoidale | `vite` | `edge-names-another-word` |
| 624016 | `superettes` | noun | 0 | plurale di superette |  | `not-italian` |
| 624240 | `aux` | article | 0 | Plurale di au. |  | `not-italian` |
| 624422 | `lemmings` | noun | 0 | plurale di lemming |  | `not-italian` |
| 624440 | `crêpes` | noun | 0 | Plurale di crêpe |  | `not-italian` |
| 625436 | `gilets` | noun | 0 | Plurale di gilet |  | `not-italian` |
| 625484 | `obiettori` | noun | 0 | plurale di obiettore |  | `no-record-of-base` |
| 625609 | `rincara` | verb | 1 | seconda persona singolare dell'imperativo presente di rincarare |  | `base-table-does-not-list` |
| 625631 | `beignets` | noun | 0 | Plurale di beignet |  | `not-italian` |
| 625704 | `commence` | verb | 2 | seconda persona singolare dell'imperativo di commencer |  | `not-italian` |
| 625745 | `wilt` | verb | 1 | seconda persona plurale dell'indicativo presente di willen |  | `not-italian` |
| 625745 | `wilt` | verb | 2 | imperativo plurale di willen |  | `not-italian` |
| 625877 | `supérettes` | noun | 0 | Plurale di supérette |  | `not-italian` |
| 627222 | `scanners` | noun | 0 | plurale di scanner |  | `not-italian` |
| 627289 | `prevali` | verb | 0 | seconda persona singolare dell'indicativo presente di prevalere |  | `base-table-does-not-list` |
| 627289 | `prevali` | verb | 1 | seconda persona singolare dell'imperativo presente di prevalere |  | `base-table-does-not-list` |
| 627350 | `hermanas` | noun | 0 | plurale di hermana |  | `not-italian` |
| 627353 | `irmãs` | noun | 0 | plurale di irmã |  | `not-italian` |
| 651766 | `spechi` | noun | 0 | plurale di speco |  | `no-record-of-base` |
| 671228 | `faccendone` | noun | 0 | plurale di faccendone |  | `names-itself` |
| 770629 | `glissières de sécurité` | phrase | 0 | Plurale di glissière de sécurité |  | `not-italian` |
| 770635 | `manches à air` | phrase | 0 | Plurale di manche à air |  | `not-italian` |
| 770639 | `hydroplanages` | noun | 0 | Plurale di hydroplanage |  | `not-italian` |
| 770642 | `aquaplanages` | noun | 0 | Plurale di aquaplanage |  | `not-italian` |
| 771444 | `panneaux de signalisation` | phrase | 0 | Plurale di panneau de signalisation |  | `not-italian` |
| 773082 | `yachts` | noun | 0 | plurale di yacht |  | `not-italian` |
| 798263 | `aquaplanings` | noun | 0 | plurale di aquaplaning |  | `not-italian` |
| 798264 | `hydroplanings` | noun | 0 | plurale di hydroplaning |  | `not-italian` |
| 798265 | `waterplanings` | noun | 0 | plurale di waterplaning |  | `not-italian` |
| 798468 | `Christmas crackers` | phrase | 0 | plurale di Christmas cracker |  | `not-italian` |
| 798469 | `Yorkshire puddings` | phrase | 0 | plurale di Yorkshire pudding |  | `not-italian` |
| 798470 | `Christmas puddings` | phrase | 0 | plurale di Christmas pudding |  | `not-italian` |
| 798471 | `plum puddings` | phrase | 0 | plurale di plum pudding |  | `not-italian` |
| 798487 | `TV dinners` | phrase | 0 | plurale di TV dinner |  | `not-italian` |
| 798489 | `hot cross buns` | phrase | 0 | plurale di hot cross bun |  | `not-italian` |
| 798490 | `mince pies` | phrase | 0 | plurale di mince pie |  | `not-italian` |
| 798491 | `simnel cakes` | phrase | 0 | plurale di simnel cake |  | `not-italian` |
| 798492 | `Dundee cakes` | phrase | 0 | plurale di Dundee cake |  | `not-italian` |
| 798495 | `sausage rolls` | phrase | 0 | plurale di sausage roll |  | `not-italian` |
| 798497 | `cottage pies` | phrase | 0 | plurale di cottage pie |  | `not-italian` |
| 798498 | `shepherd's pies` | phrase | 0 | plurale di shepherd's pie |  | `not-italian` |
| 798504 | `Altertumsforscherinnen` | noun | 0 | plurale di Altertumsforscherin |  | `not-italian` |
| 798505 | `Ammen` | noun | 0 | plurale di Amme |  | `not-italian` |
| 798525 | `crumpets` | noun | 0 | plurale di crumpet |  | `not-italian` |
| 798526 | `scones` | noun | 0 | plurale di scone |  | `not-italian` |
| 798527 | `bagels` | noun | 0 | plurale di bagel |  | `not-italian` |
| 798529 | `toffees` | noun | 0 | plurale di toffee |  | `not-italian` |
| 798531 | `Scotch eggs` | phrase | 0 | plurale di Scotch egg |  | `not-italian` |
| 798533 | `Chelsea buns` | phrase | 0 | plurale di Chelsea bun |  | `not-italian` |
| 798534 | `muffins` | noun | 0 | plurale di muffin |  | `not-italian` |
| 798535 | `donuts` | noun | 0 | plurale di donut |  | `not-italian` |
| 798536 | `doughnuts` | noun | 0 | plurale di doughnut |  | `not-italian` |
| 798537 | `bulldozers` | noun | 0 | plurale di bulldozer |  | `not-italian` |
| 798538 | `bulldogs` | noun | 0 | plurale di bulldog |  | `not-italian` |
| 798539 | `jets` | noun | 0 | plurale di jet |  | `not-italian` |
| 798541 | `bobsleds` | noun | 0 | plurale di bobsled |  | `not-italian` |
| 798544 | `bobsleighs` | noun | 0 | plurale di bobsleigh |  | `not-italian` |
| 798545 | `bobsledges` | noun | 0 | plurale di bobsledge |  | `not-italian` |
| 798546 | `sidecars` | noun | 0 | plurale di sidecar |  | `not-italian` |
| 798547 | `hangars` | noun | 0 | Plurale di hangar |  | `not-italian` |
| 798548 | `hangars` | noun | 0 | plurale di hangar |  | `not-italian` |
| 798549 | `terminals` | noun | 0 | plurale di terminal |  | `not-italian` |
| 798550 | `transistors` | noun | 0 | plurale di transistor |  | `not-italian` |
| 798551 | `robots` | noun | 0 | Plurale di robot |  | `not-italian` |
| 798552 | `robots` | noun | 0 | plurale di robot |  | `not-italian` |
| 798553 | `transponders` | noun | 0 | plurale di transponder |  | `not-italian` |
| 798554 | `traveller's cheques` | phrase | 0 | plurale di traveller's cheque |  | `not-italian` |
| 798556 | `traveler's checks` | phrase | 0 | plurale di traveler's check |  | `not-italian` |
| 798560 | `wind socks` | noun | 0 | plurale di wind sock |  | `not-italian` |
| 798565 | `roast beefs` | phrase | 0 | plurale di roast beef |  | `not-italian` |
| 798570 | `hot dogs` | phrase | 0 | plurale di hot dog |  | `not-italian` |
| 798571 | `burgers` | noun | 0 | plurale di burger |  | `not-italian` |
| 798572 | `cheeseburgers` | noun | 0 | plurale di cheeseburger |  | `not-italian` |
| 798574 | `airbags` | noun | 0 | plurale di airbag |  | `not-italian` |
| 798575 | `ketchups` | noun | 0 | plurale di ketchup |  | `not-italian` |
| 798576 | `comfort zones` | phrase | 0 | plurale di comfort zone |  | `not-italian` |
| 798578 | `bodysuits` | noun | 0 | plurale di bodysuit |  | `not-italian` |
| 798579 | `condoms` | noun | 0 | plurale di condom |  | `not-italian` |
| 798583 | `internal condoms` | phrase | 0 | plurale di internal condom |  | `not-italian` |
| 798584 | `female condoms` | phrase | 0 | plurale di female condom |  | `not-italian` |
| 798585 | `femidoms` | noun | 0 | plurale di femidom |  | `not-italian` |
| 798587 | `routers` | noun | 0 | plurale di router |  | `not-italian` |
| 798588 | `passwords` | noun | 0 | plurale di password |  | `not-italian` |
| 798589 | `bytes` | noun | 0 | plurale di byte |  | `not-italian` |
| 798590 | `bits` | noun | 0 | plurale di bit |  | `not-italian` |
| 798591 | `modems` | noun | 0 | plurale di modem |  | `not-italian` |
| 798592 | `smartphones` | noun | 0 | plurale di smartphone |  | `not-italian` |
| 798593 | `touch screens` | phrase | 0 | plurale di touch screen |  | `not-italian` |
| 798594 | `tablets` | noun | 0 | plurale di tablet |  | `not-italian` |
| 798595 | `social networks` | phrase | 0 | plurale di social network |  | `not-italian` |
| 798599 | `cruise controls` | phrase | 0 | plurale di cruise control |  | `not-italian` |
| 798601 | `shortbreads` | noun | 0 | plurale di shortbread |  | `not-italian` |
| 798604 | `porridges` | noun | 0 | plurale di porridge |  | `not-italian` |
| 798605 | `jellies` | noun | 0 | plurale di jelly |  | `not-italian` |
| 798606 | `custards` | noun | 0 | plurale di custard |  | `not-italian` |
| 798607 | `marketings` | noun | 0 | plurale di marketing |  | `not-italian` |
| 798608 | `Christmas cakes` | phrase | 0 | plurale di Christmas cake |  | `not-italian` |
| 798611 | `apple pies` | phrase | 0 | plurale di apple pie |  | `not-italian` |
| 798613 | `tartes aux pommes` | phrase | 0 | Plurale di tarte aux pommes |  | `not-italian` |
| 798615 | `Cornish pasties` | phrase | 0 | plurale di Cornish pasty |  | `not-italian` |
| 798625 | `nursery rhymes` | phrase | 0 | plurale di nursery rhyme |  | `not-italian` |
| 798888 | `leotards` | noun | 0 | plurale di leotard |  | `not-italian` |
| 798891 | `dental dams` | phrase | 0 | plurale di dental dam |  | `not-italian` |
| 798893 | `oral dams` | phrase | 0 | plurale di oral dam |  | `not-italian` |
| 799270 | `Sunday roasts` | phrase | 0 | plurale di Sunday roast |  | `not-italian` |
| 799272 | `full English breakfasts` | phrase | 0 | plurale di full English breakfast |  | `not-italian` |
| 799274 | `full breakfasts` | phrase | 0 | plurale di full breakfast |  | `not-italian` |
| 799275 | `Leiterplatten` | noun | 0 | plurale di Leiterplatte |  | `not-italian` |
| 799279 | `ginger beers` | phrase | 0 | plurale di ginger beer |  | `not-italian` |
| 799280 | `root beers` | phrase | 0 | plurale di root beer |  | `not-italian` |
| 799283 | `ginger ales` | phrase | 0 | plurale di ginger ale |  | `not-italian` |
| 799587 | `guard rails` | noun | 0 | plurale di guard rail |  | `not-italian` |
| 799596 | `motoryachts` | noun | 0 | plurale di motoryacht |  | `not-italian` |
| 799600 | `motor yachts` | phrase | 0 | plurale di motor yacht |  | `not-italian` |
