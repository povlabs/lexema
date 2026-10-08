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
glosses name, with its `forms`. It then reads the dump the archive was built
from, `itwiktionary-20260701`, for the revision of each page those senses and
words are on. The rule judges each sense from two lines of the archive, and
writes the senses it confirms, each with the line of X it read and the two page
revisions it cites, to
[src/italian/formOfGlossEdgeEvidence.ts](../src/italian/formOfGlossEdgeEvidence.ts).
A second run on the same archive and dump writes the same file.

A sense gets an edge to X when all of these hold:

- its record is Italian;
- it declares no `form_of` edge;
- its first gloss opens with words that say which form it is, and only those
  (`FORM_WORDS`: plurale, femminile, terza persona singolare del congiuntivo
  presente, …), then "di X";
- an Italian record whose `word` is X lists the record's word, exactly, in its
  `forms`. The rule reads the first such record in archive order;
- the record's page and X's page both have a revision in the dump (every one
  does: `page-not-in-dump` below is 0).

**What each correction cites.** Each correction cites the two Wiktionary pages
its facts come from, not lines of Lexema's archive: Huey's
[ruling](https://github.com/povlabs/lexema/issues/722#issuecomment-6058471600)
of 2026-10-08, "we got that from wikti, cite wikti that's all". Those are the
record's own it.wiktionary page, which shows the gloss naming X after "di", and
X's page, whose forms table lists the word. Each is pinned at the revision in
the dump the archive was extracted from, so the link shows the text the
archive read (`aerei`:
[4016979](https://it.wiktionary.org/w/index.php?title=aerei&oldid=4016979);
`aereo`:
[3963800](https://it.wiktionary.org/w/index.php?title=aereo&oldid=3963800)).
The table below links both for every edge.

**Why the gloss's opening must name a form.** ADR 0030 adds an edge "on a form
record". A gloss can name a word after "di" without saying it is a form of it:
`chimico`'s "studioso di chimica" and `appoggio`'s "diritto di appoggiare il
proprio edificio", although `chimica`'s and `appoggiare`'s tables list those
words. Those 97 senses stay as the source states them (`not-a-form-gloss`
below). Misspelt openings (`pòurale`, `fmminile`) are left alone the same way.

**What the rule does not do.** A sense whose edge names another word is not the
rule's: question 9 fixed only `parti`'s two `parto` lines, which are hand
entries in [src/italian/curatedCorrections.ts](../src/italian/curatedCorrections.ts)
citing `parti`'s and `parto`'s pages. The 746 other such senses below
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
| the word's page or the base's page is not in the dump, so there is no page to cite (`page-not-in-dump`) | 0 |

## Edges added

| Line | Word | POS | Sense | Gloss | Edge to | Cited pages |
|---|---|---|---|---|---|---|
| 606 | `telefonino` | verb | 0 | terza persona plurale del congiuntivo presente di telefonare | `telefonare` | [telefonino](https://it.wiktionary.org/w/index.php?title=telefonino&oldid=4049670), [telefonare](https://it.wiktionary.org/w/index.php?title=telefonare&oldid=4044395) |
| 648 | `create` | verb | 1 | seconda persona plurale dell'indicativo presente di creare | `creare` | [create](https://it.wiktionary.org/w/index.php?title=create&oldid=3835584), [creare](https://it.wiktionary.org/w/index.php?title=creare&oldid=3935491) |
| 648 | `create` | verb | 2 | seconda persona plurale dell'imperativo presente di creare | `creare` | [create](https://it.wiktionary.org/w/index.php?title=create&oldid=3835584), [creare](https://it.wiktionary.org/w/index.php?title=creare&oldid=3935491) |
| 659 | `creative` | adj | 0 | femminile plurale di creativo | `creativo` | [creative](https://it.wiktionary.org/w/index.php?title=creative&oldid=3394749), [creativo](https://it.wiktionary.org/w/index.php?title=creativo&oldid=4040262) |
| 1223 | `esplicito` | verb | 0 | prima persona singolare dell'indicativo presente di esplicitare | `esplicitare` | [esplicito](https://it.wiktionary.org/w/index.php?title=esplicito&oldid=4059275), [esplicitare](https://it.wiktionary.org/w/index.php?title=esplicitare&oldid=4060175) |
| 1415 | `frana` | verb | 0 | terza persona singolare dell'indicativo presente di franare | `franare` | [frana](https://it.wiktionary.org/w/index.php?title=frana&oldid=4070792), [franare](https://it.wiktionary.org/w/index.php?title=franare&oldid=3505363) |
| 1415 | `frana` | verb | 1 | seconda persona singolare dell'imperativo presente di franare | `franare` | [frana](https://it.wiktionary.org/w/index.php?title=frana&oldid=4070792), [franare](https://it.wiktionary.org/w/index.php?title=franare&oldid=3505363) |
| 1888 | `tassa` | verb | 1 | seconda persona singolare dell'imperativo presente di tassare | `tassare` | [tassa](https://it.wiktionary.org/w/index.php?title=tassa&oldid=4007740), [tassare](https://it.wiktionary.org/w/index.php?title=tassare&oldid=3651244) |
| 2059 | `macchina` | verb | 1 | seconda persona singolare dell'imperativo presente di macchinare | `macchinare` | [macchina](https://it.wiktionary.org/w/index.php?title=macchina&oldid=4045226), [macchinare](https://it.wiktionary.org/w/index.php?title=macchinare&oldid=3947020) |
| 2568 | `fatica` | verb | 1 | seconda persona singolare dell'imperativo presente di faticare | `faticare` | [fatica](https://it.wiktionary.org/w/index.php?title=fatica&oldid=4042250), [faticare](https://it.wiktionary.org/w/index.php?title=faticare&oldid=3962730) |
| 5483 | `aperture` | noun | 0 | plurale di apertura | `apertura` | [aperture](https://it.wiktionary.org/w/index.php?title=aperture&oldid=3378175), [apertura](https://it.wiktionary.org/w/index.php?title=apertura&oldid=3970995) |
| 5688 | `devastate` | verb | 1 | seconda persona plurale dell'indicativo presente di devastare | `devastare` | [devastate](https://it.wiktionary.org/w/index.php?title=devastate&oldid=4053653), [devastare](https://it.wiktionary.org/w/index.php?title=devastare&oldid=3952960) |
| 5688 | `devastate` | verb | 2 | seconda persona plurale dell'imperativo presente di devastare | `devastare` | [devastate](https://it.wiktionary.org/w/index.php?title=devastate&oldid=4053653), [devastare](https://it.wiktionary.org/w/index.php?title=devastare&oldid=3952960) |
| 5926 | `assassinate` | adj | 0 | femminile plurale di assassinato | `assassinato` | [assassinate](https://it.wiktionary.org/w/index.php?title=assassinate&oldid=3867479), [assassinato](https://it.wiktionary.org/w/index.php?title=assassinato&oldid=4076805) |
| 7153 | `dislocate` | verb | 1 | seconda persona plurale dell'indicativo presente di dislocare | `dislocare` | [dislocate](https://it.wiktionary.org/w/index.php?title=dislocate&oldid=3835735), [dislocare](https://it.wiktionary.org/w/index.php?title=dislocare&oldid=4048852) |
| 7153 | `dislocate` | verb | 2 | seconda persona plurale dell'imperativo presente di dislocare | `dislocare` | [dislocate](https://it.wiktionary.org/w/index.php?title=dislocate&oldid=3835735), [dislocare](https://it.wiktionary.org/w/index.php?title=dislocare&oldid=4048852) |
| 7460 | `tardi` | verb | 1 | prima persona singolare del congiuntivo presente di tardare | `tardare` | [tardi](https://it.wiktionary.org/w/index.php?title=tardi&oldid=4037650), [tardare](https://it.wiktionary.org/w/index.php?title=tardare&oldid=3678746) |
| 7460 | `tardi` | verb | 2 | seconda persona singolare del congiuntivo presente di tardare | `tardare` | [tardi](https://it.wiktionary.org/w/index.php?title=tardi&oldid=4037650), [tardare](https://it.wiktionary.org/w/index.php?title=tardare&oldid=3678746) |
| 7460 | `tardi` | verb | 3 | terza persona singolare del congiuntivo presente di tardare | `tardare` | [tardi](https://it.wiktionary.org/w/index.php?title=tardi&oldid=4037650), [tardare](https://it.wiktionary.org/w/index.php?title=tardare&oldid=3678746) |
| 7460 | `tardi` | verb | 4 | terza persona singolare dell'imperativo presente di tardare | `tardare` | [tardi](https://it.wiktionary.org/w/index.php?title=tardi&oldid=4037650), [tardare](https://it.wiktionary.org/w/index.php?title=tardare&oldid=3678746) |
| 7592 | `truffa` | verb | 1 | seconda persona singolare dell'imperativo presente di truffare | `truffare` | [truffa](https://it.wiktionary.org/w/index.php?title=truffa&oldid=4005891), [truffare](https://it.wiktionary.org/w/index.php?title=truffare&oldid=3778583) |
| 8145 | `argomento` | verb | 0 | prima persona singolare dell'indicativo presente di argomentare | `argomentare` | [argomento](https://it.wiktionary.org/w/index.php?title=argomento&oldid=4052829), [argomentare](https://it.wiktionary.org/w/index.php?title=argomentare&oldid=4039628) |
| 8197 | `paga` | verb | 1 | seconda persona singolare dell'imperativo presente di pagare | `pagare` | [paga](https://it.wiktionary.org/w/index.php?title=paga&oldid=4194472), [pagare](https://it.wiktionary.org/w/index.php?title=pagare&oldid=4043779) |
| 8274 | `compra` | verb | 1 | seconda persona singolare dell'imperativo presente di comprare | `comprare` | [compra](https://it.wiktionary.org/w/index.php?title=compra&oldid=3800231), [comprare](https://it.wiktionary.org/w/index.php?title=comprare&oldid=4008871) |
| 8418 | `motivo` | verb | 0 | prima persona singolare dell'indicativo presente di motivare | `motivare` | [motivo](https://it.wiktionary.org/w/index.php?title=motivo&oldid=4056484), [motivare](https://it.wiktionary.org/w/index.php?title=motivare&oldid=3938670) |
| 8486 | `costa` | verb | 0 | terza persona singolare dell'indicativo presente di costare | `costare` | [costa](https://it.wiktionary.org/w/index.php?title=costa&oldid=4000240), [costare](https://it.wiktionary.org/w/index.php?title=costare&oldid=4011050) |
| 8486 | `costa` | verb | 1 | seconda persona singolare dell'imperativo presente di costare | `costare` | [costa](https://it.wiktionary.org/w/index.php?title=costa&oldid=4000240), [costare](https://it.wiktionary.org/w/index.php?title=costare&oldid=4011050) |
| 8666 | `contato` | verb | 0 | participio passato di contare | `contare` | [contato](https://it.wiktionary.org/w/index.php?title=contato&oldid=3969282), [contare](https://it.wiktionary.org/w/index.php?title=contare&oldid=4008580) |
| 9413 | `cocaine` | noun | 0 | plurale di cocaina | `cocaina` | [cocaine](https://it.wiktionary.org/w/index.php?title=cocaine&oldid=3952066), [cocaina](https://it.wiktionary.org/w/index.php?title=cocaina&oldid=4066791) |
| 11245 | `flange` | noun | 0 | plurale di flangia | `flangia` | [flange](https://it.wiktionary.org/w/index.php?title=flange&oldid=3831912), [flangia](https://it.wiktionary.org/w/index.php?title=flangia&oldid=3899039) |
| 12308 | `lustre` | adj | 0 | Femminile plurale di lustro | `lustro` | [lustre](https://it.wiktionary.org/w/index.php?title=lustre&oldid=3173913), [lustro](https://it.wiktionary.org/w/index.php?title=lustro&oldid=4034007) |
| 12571 | `massive` | adj | 0 | femminile plurale di massivo | `massivo` | [massive](https://it.wiktionary.org/w/index.php?title=massive&oldid=3968941), [massivo](https://it.wiktionary.org/w/index.php?title=massivo&oldid=3880399) |
| 12656 | `medicine` | noun | 0 | plurale di medicina | `medicina` | [medicine](https://it.wiktionary.org/w/index.php?title=medicine&oldid=3860631), [medicina](https://it.wiktionary.org/w/index.php?title=medicina&oldid=4076083) |
| 14769 | `canina` | adj | 0 | femminile di canino | `canino` | [canina](https://it.wiktionary.org/w/index.php?title=canina&oldid=3743722), [canino](https://it.wiktionary.org/w/index.php?title=canino&oldid=4040555) |
| 15027 | `carina` | adj | 0 | femminile di carino | `carino` | [carina](https://it.wiktionary.org/w/index.php?title=carina&oldid=3975120), [carino](https://it.wiktionary.org/w/index.php?title=carino&oldid=3998818) |
| 15812 | `cresima` | verb | 0 | terza persona singolare dell'indicativo presente di cresimare | `cresimare` | [cresima](https://it.wiktionary.org/w/index.php?title=cresima&oldid=3945671), [cresimare](https://it.wiktionary.org/w/index.php?title=cresimare&oldid=3903958) |
| 15812 | `cresima` | verb | 1 | seconda persona singolare dell'imperativo presente di cresimare | `cresimare` | [cresima](https://it.wiktionary.org/w/index.php?title=cresima&oldid=3945671), [cresimare](https://it.wiktionary.org/w/index.php?title=cresimare&oldid=3903958) |
| 17472 | `sentì` | verb | 0 | terza persona singolare dell'indicativo passato remoto di sentire | `sentire` | [sentì](https://it.wiktionary.org/w/index.php?title=sent%C3%AC&oldid=3987530), [sentire](https://it.wiktionary.org/w/index.php?title=sentire&oldid=4038218) |
| 17598 | `molle` | adj | 3 | plurale di molla | `molla` | [molle](https://it.wiktionary.org/w/index.php?title=molle&oldid=4248868), [molla](https://it.wiktionary.org/w/index.php?title=molla&oldid=4022445) |
| 18000 | `sovrana` | adj | 0 | femminile di sovrano | `sovrano` | [sovrana](https://it.wiktionary.org/w/index.php?title=sovrana&oldid=3850123), [sovrano](https://it.wiktionary.org/w/index.php?title=sovrano&oldid=3947902) |
| 18001 | `sovrana` | noun | 0 | femminile di sovrano | `sovrano` | [sovrana](https://it.wiktionary.org/w/index.php?title=sovrana&oldid=3850123), [sovrano](https://it.wiktionary.org/w/index.php?title=sovrano&oldid=3947902) |
| 18019 | `travaglio` | verb | 0 | prima persona singolare dell'indicativo presente di travagliare | `travagliare` | [travaglio](https://it.wiktionary.org/w/index.php?title=travaglio&oldid=4054684), [travagliare](https://it.wiktionary.org/w/index.php?title=travagliare&oldid=3651831) |
| 18035 | `contessa` | noun | 0 | femminile di conte | `conte` | [contessa](https://it.wiktionary.org/w/index.php?title=contessa&oldid=3831425), [conte](https://it.wiktionary.org/w/index.php?title=conte&oldid=4001097) |
| 18055 | `nicchia` | verb | 1 | seconda persona singolare dell'imperativo presente di nicchiare | `nicchiare` | [nicchia](https://it.wiktionary.org/w/index.php?title=nicchia&oldid=4042161), [nicchiare](https://it.wiktionary.org/w/index.php?title=nicchiare&oldid=3901314) |
| 18131 | `monofore` | noun | 0 | plurale di monofora | `monofora` | [monofore](https://it.wiktionary.org/w/index.php?title=monofore&oldid=3312687), [monofora](https://it.wiktionary.org/w/index.php?title=monofora&oldid=3424416) |
| 18139 | `trifore` | noun | 0 | plurale di trifora | `trifora` | [trifore](https://it.wiktionary.org/w/index.php?title=trifore&oldid=3349701), [trifora](https://it.wiktionary.org/w/index.php?title=trifora&oldid=3651898) |
| 18466 | `serve` | verb | 0 | terza persona singolare dell'indicativo presente di servire | `servire` | [serve](https://it.wiktionary.org/w/index.php?title=serve&oldid=4056486), [servire](https://it.wiktionary.org/w/index.php?title=servire&oldid=4070800) |
| 18615 | `bigotti` | noun | 0 | plurale di bigotto | `bigotto` | [bigotti](https://it.wiktionary.org/w/index.php?title=bigotti&oldid=2849738), [bigotto](https://it.wiktionary.org/w/index.php?title=bigotto&oldid=3964953) |
| 21418 | `rime` | noun | 0 | plurale di rima | `rima` | [rime](https://it.wiktionary.org/w/index.php?title=rime&oldid=3437566), [rima](https://it.wiktionary.org/w/index.php?title=rima&oldid=4008983) |
| 21946 | `sensitive` | noun | 0 | plurale di sensitiva | `sensitiva` | [sensitive](https://it.wiktionary.org/w/index.php?title=sensitive&oldid=4020067), [sensitiva](https://it.wiktionary.org/w/index.php?title=sensitiva&oldid=4020062) |
| 22699 | `stupide` | noun | 0 | femminile plurale di stupido | `stupido` | [stupide](https://it.wiktionary.org/w/index.php?title=stupide&oldid=3662391), [stupido](https://it.wiktionary.org/w/index.php?title=stupido&oldid=3972048) |
| 23622 | `vaccinate` | verb | 0 | participio passato plurale femminile di vaccinare | `vaccinare` | [vaccinate](https://it.wiktionary.org/w/index.php?title=vaccinate&oldid=3838133), [vaccinare](https://it.wiktionary.org/w/index.php?title=vaccinare&oldid=4035981) |
| 23643 | `valse` | verb | 0 | participio passato plurale femminile di valere | `valere` | [valse](https://it.wiktionary.org/w/index.php?title=valse&oldid=4008801), [valere](https://it.wiktionary.org/w/index.php?title=valere&oldid=4037458) |
| 23643 | `valse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di valere | `valere` | [valse](https://it.wiktionary.org/w/index.php?title=valse&oldid=4008801), [valere](https://it.wiktionary.org/w/index.php?title=valere&oldid=4037458) |
| 24644 | `brune` | noun | 0 | femminile plurale di bruno | `bruno` | [brune](https://it.wiktionary.org/w/index.php?title=brune&oldid=4005758), [bruno](https://it.wiktionary.org/w/index.php?title=bruno&oldid=3988679) |
| 28869 | `guasti` | verb | 0 | seconda persona singolare dell'indicativo presente di guastare | `guastare` | [guasti](https://it.wiktionary.org/w/index.php?title=guasti&oldid=4058276), [guastare](https://it.wiktionary.org/w/index.php?title=guastare&oldid=3976750) |
| 28869 | `guasti` | verb | 1 | prima persona singolare del congiuntivo presente di guastare | `guastare` | [guasti](https://it.wiktionary.org/w/index.php?title=guasti&oldid=4058276), [guastare](https://it.wiktionary.org/w/index.php?title=guastare&oldid=3976750) |
| 28869 | `guasti` | verb | 2 | seconda persona singolare del congiuntivo presente di guastare | `guastare` | [guasti](https://it.wiktionary.org/w/index.php?title=guasti&oldid=4058276), [guastare](https://it.wiktionary.org/w/index.php?title=guastare&oldid=3976750) |
| 28869 | `guasti` | verb | 3 | terza persona singolare del congiuntivo presente di guastare | `guastare` | [guasti](https://it.wiktionary.org/w/index.php?title=guasti&oldid=4058276), [guastare](https://it.wiktionary.org/w/index.php?title=guastare&oldid=3976750) |
| 28869 | `guasti` | verb | 4 | terza persona singolare dell'imperativo presente di guastare | `guastare` | [guasti](https://it.wiktionary.org/w/index.php?title=guasti&oldid=4058276), [guastare](https://it.wiktionary.org/w/index.php?title=guastare&oldid=3976750) |
| 29052 | `vara` | verb | 1 | seconda persona singolare dell'imperativo presente di varare | `varare` | [vara](https://it.wiktionary.org/w/index.php?title=vara&oldid=3950796), [varare](https://it.wiktionary.org/w/index.php?title=varare&oldid=4053537) |
| 30502 | `campionato` | verb | 0 | participio passato di campionare | `campionare` | [campionato](https://it.wiktionary.org/w/index.php?title=campionato&oldid=3891558), [campionare](https://it.wiktionary.org/w/index.php?title=campionare&oldid=3535810) |
| 30776 | `balena` | verb | 1 | seconda persona singolare dell'imperativo presente di balenare | `balenare` | [balena](https://it.wiktionary.org/w/index.php?title=balena&oldid=4058643), [balenare](https://it.wiktionary.org/w/index.php?title=balenare&oldid=4013508) |
| 31063 | `isola` | verb | 0 | terza persona singolare dell'indicativo presente di isolare | `isolare` | [isola](https://it.wiktionary.org/w/index.php?title=isola&oldid=4141071), [isolare](https://it.wiktionary.org/w/index.php?title=isolare&oldid=3968761) |
| 31063 | `isola` | verb | 1 | seconda persona singolare dell'imperativo presente di isolare | `isolare` | [isola](https://it.wiktionary.org/w/index.php?title=isola&oldid=4141071), [isolare](https://it.wiktionary.org/w/index.php?title=isolare&oldid=3968761) |
| 31174 | `serpe` | noun | 2 | plurale di serpa | `serpa` | [serpe](https://it.wiktionary.org/w/index.php?title=serpe&oldid=4175660), [serpa](https://it.wiktionary.org/w/index.php?title=serpa&oldid=4003333) |
| 31392 | `regola` | verb | 0 | terza persona singolare dell'indicativo presente di regolare | `regolare` | [regola](https://it.wiktionary.org/w/index.php?title=regola&oldid=4050803), [regolare](https://it.wiktionary.org/w/index.php?title=regolare&oldid=3999421) |
| 31392 | `regola` | verb | 1 | seconda persona singolare dell'imperativo presente di regolare | `regolare` | [regola](https://it.wiktionary.org/w/index.php?title=regola&oldid=4050803), [regolare](https://it.wiktionary.org/w/index.php?title=regolare&oldid=3999421) |
| 31537 | `cassa` | verb | 1 | seconda persona singolare dell'imperativo presente di cassare | `cassare` | [cassa](https://it.wiktionary.org/w/index.php?title=cassa&oldid=4053088), [cassare](https://it.wiktionary.org/w/index.php?title=cassare&oldid=3892259) |
| 31619 | `cucina` | verb | 1 | seconda persona singolare dell'imperativo presente di cucinare | `cucinare` | [cucina](https://it.wiktionary.org/w/index.php?title=cucina&oldid=4056086), [cucinare](https://it.wiktionary.org/w/index.php?title=cucinare&oldid=4002484) |
| 31633 | `immondizie` | noun | 0 | plurale di immondizia | `immondizia` | [immondizie](https://it.wiktionary.org/w/index.php?title=immondizie&oldid=4016994), [immondizia](https://it.wiktionary.org/w/index.php?title=immondizia&oldid=3880194) |
| 31990 | `leva` | verb | 0 | terza persona singolare dell'indicativo presente di levare | `levare` | [leva](https://it.wiktionary.org/w/index.php?title=leva&oldid=4066835), [levare](https://it.wiktionary.org/w/index.php?title=levare&oldid=4037576) |
| 31990 | `leva` | verb | 1 | seconda persona singolare dell'imperativo di levare | `levare` | [leva](https://it.wiktionary.org/w/index.php?title=leva&oldid=4066835), [levare](https://it.wiktionary.org/w/index.php?title=levare&oldid=4037576) |
| 32549 | `sagoma` | verb | 1 | seconda persona singolare dell'imperativo presente di sagomare | `sagomare` | [sagoma](https://it.wiktionary.org/w/index.php?title=sagoma&oldid=3984912), [sagomare](https://it.wiktionary.org/w/index.php?title=sagomare&oldid=3908527) |
| 33274 | `questa` | pron | 0 | femminile di questo | `questo` | [questa](https://it.wiktionary.org/w/index.php?title=questa&oldid=3889589), [questo](https://it.wiktionary.org/w/index.php?title=questo&oldid=3892270) |
| 33848 | `bastimenti` | noun | 0 | plurale di bastimento | `bastimento` | [bastimenti](https://it.wiktionary.org/w/index.php?title=bastimenti&oldid=3268230), [bastimento](https://it.wiktionary.org/w/index.php?title=bastimento&oldid=3988219) |
| 33863 | `falcata` | adj | 0 | femminile di falcato | `falcato` | [falcata](https://it.wiktionary.org/w/index.php?title=falcata&oldid=3994918), [falcato](https://it.wiktionary.org/w/index.php?title=falcato&oldid=3994946) |
| 33863 | `falcata` | adj | 1 | femminile di falcato | `falcato` | [falcata](https://it.wiktionary.org/w/index.php?title=falcata&oldid=3994918), [falcato](https://it.wiktionary.org/w/index.php?title=falcato&oldid=3994946) |
| 33863 | `falcata` | adj | 2 | femminile di falcato | `falcato` | [falcata](https://it.wiktionary.org/w/index.php?title=falcata&oldid=3994918), [falcato](https://it.wiktionary.org/w/index.php?title=falcato&oldid=3994946) |
| 33904 | `metrica` | adj | 0 | femminile di metrico | `metrico` | [metrica](https://it.wiktionary.org/w/index.php?title=metrica&oldid=3961334), [metrico](https://it.wiktionary.org/w/index.php?title=metrico&oldid=3869872) |
| 34024 | `recluta` | verb | 1 | seconda persona singolare dell'imperativo presente di reclutare | `reclutare` | [recluta](https://it.wiktionary.org/w/index.php?title=recluta&oldid=4058501), [reclutare](https://it.wiktionary.org/w/index.php?title=reclutare&oldid=3669515) |
| 37985 | `dai` | verb | 1 | seconda persona singolare dell'imperativo presente di dare | `dare` | [dai](https://it.wiktionary.org/w/index.php?title=dai&oldid=4067127), [dare](https://it.wiktionary.org/w/index.php?title=dare&oldid=4068088) |
| 38129 | `importante` | verb | 0 | participio presente di importare | `importare` | [importante](https://it.wiktionary.org/w/index.php?title=importante&oldid=4068891), [importare](https://it.wiktionary.org/w/index.php?title=importare&oldid=3582003) |
| 39385 | `piazza` | verb | 1 | seconda persona singolare dell'imperativo presente di piazzare | `piazzare` | [piazza](https://it.wiktionary.org/w/index.php?title=piazza&oldid=4054193), [piazzare](https://it.wiktionary.org/w/index.php?title=piazzare&oldid=4066839) |
| 39920 | `molti` | pron | 0 | plurale maschile di molto | `molto` | [molti](https://it.wiktionary.org/w/index.php?title=molti&oldid=3312523), [molto](https://it.wiktionary.org/w/index.php?title=molto&oldid=3949207) |
| 39927 | `lesina` | verb | 1 | seconda persona singolare dell'imperativo presente di lesinare | `lesinare` | [lesina](https://it.wiktionary.org/w/index.php?title=lesina&oldid=4059863), [lesinare](https://it.wiktionary.org/w/index.php?title=lesinare&oldid=3934042) |
| 40038 | `insulto` | noun | 1 | prima persona singolare dell'indicativo presente di insultare | `insultare` | [insulto](https://it.wiktionary.org/w/index.php?title=insulto&oldid=3987029), [insultare](https://it.wiktionary.org/w/index.php?title=insultare&oldid=3893654) |
| 40086 | `inculato` | verb | 0 | participio passato maschile di inculare | `inculare` | [inculato](https://it.wiktionary.org/w/index.php?title=inculato&oldid=3525812), [inculare](https://it.wiktionary.org/w/index.php?title=inculare&oldid=3892398) |
| 40176 | `diaframma` | verb | 0 | terza persona singolare dell'indicativo presente di diaframmare | `diaframmare` | [diaframma](https://it.wiktionary.org/w/index.php?title=diaframma&oldid=3997043), [diaframmare](https://it.wiktionary.org/w/index.php?title=diaframmare&oldid=3919390) |
| 40176 | `diaframma` | verb | 1 | seconda persona singolare dell'imperativo presente di diaframmare | `diaframmare` | [diaframma](https://it.wiktionary.org/w/index.php?title=diaframma&oldid=3997043), [diaframmare](https://it.wiktionary.org/w/index.php?title=diaframmare&oldid=3919390) |
| 40369 | `usura` | verb | 0 | terza persona singolare dell'indicativo presente di usurare | `usurare` | [usura](https://it.wiktionary.org/w/index.php?title=usura&oldid=4048195), [usurare](https://it.wiktionary.org/w/index.php?title=usurare&oldid=3449665) |
| 40369 | `usura` | verb | 1 | seconda persona singolare dell'imperativo presente di usurare | `usurare` | [usura](https://it.wiktionary.org/w/index.php?title=usura&oldid=4048195), [usurare](https://it.wiktionary.org/w/index.php?title=usurare&oldid=3449665) |
| 40401 | `nota` | verb | 2 | participio passato femminile di notare | `notare` | [nota](https://it.wiktionary.org/w/index.php?title=nota&oldid=4038046), [notare](https://it.wiktionary.org/w/index.php?title=notare&oldid=3974037) |
| 40552 | `fu` | verb | 0 | terza persona singolare dell'indicativo passato remoto di essere | `essere` | [fu](https://it.wiktionary.org/w/index.php?title=fu&oldid=3993526), [essere](https://it.wiktionary.org/w/index.php?title=essere&oldid=4076611) |
| 40613 | `sua` | adj | 0 | femminile singolare di suo | `suo` | [sua](https://it.wiktionary.org/w/index.php?title=sua&oldid=3892529), [suo](https://it.wiktionary.org/w/index.php?title=suo&oldid=3952240) |
| 41176 | `miei` | adj | 0 | plurale di mio | `mio` | [miei](https://it.wiktionary.org/w/index.php?title=miei&oldid=3943262), [mio](https://it.wiktionary.org/w/index.php?title=mio&oldid=4011940) |
| 41177 | `lombi` | noun | 0 | plurale di lombo | `lombo` | [lombi](https://it.wiktionary.org/w/index.php?title=lombi&oldid=3833013), [lombo](https://it.wiktionary.org/w/index.php?title=lombo&oldid=4008760) |
| 41180 | `punta` | verb | 2 | seconda persona singolare dell'imperativo presente di puntare | `puntare` | [punta](https://it.wiktionary.org/w/index.php?title=punta&oldid=4032861), [puntare](https://it.wiktionary.org/w/index.php?title=puntare&oldid=3946217) |
| 41191 | `denti` | noun | 0 | plurale di dente | `dente` | [denti](https://it.wiktionary.org/w/index.php?title=denti&oldid=4066328), [dente](https://it.wiktionary.org/w/index.php?title=dente&oldid=4059282) |
| 41312 | `brocca` | verb | 0 | terza persona singolare dell'indicativo presente di broccare | `broccare` | [brocca](https://it.wiktionary.org/w/index.php?title=brocca&oldid=3924538), [broccare](https://it.wiktionary.org/w/index.php?title=broccare&oldid=3538506) |
| 41312 | `brocca` | verb | 1 | seconda persona singolare dell'imperativo presente di broccare | `broccare` | [brocca](https://it.wiktionary.org/w/index.php?title=brocca&oldid=3924538), [broccare](https://it.wiktionary.org/w/index.php?title=broccare&oldid=3538506) |
| 41461 | `sala` | verb | 1 | seconda persona singolare dell'imperativo presente di salare | `salare` | [sala](https://it.wiktionary.org/w/index.php?title=sala&oldid=4069959), [salare](https://it.wiktionary.org/w/index.php?title=salare&oldid=4001700) |
| 42838 | `timi` | noun | 0 | plurale di timo | `timo` | [timi](https://it.wiktionary.org/w/index.php?title=timi&oldid=3941939), [timo](https://it.wiktionary.org/w/index.php?title=timo&oldid=4049909) |
| 43301 | `lapilli` | noun | 0 | plurale di lapillo | `lapillo` | [lapilli](https://it.wiktionary.org/w/index.php?title=lapilli&oldid=2985337), [lapillo](https://it.wiktionary.org/w/index.php?title=lapillo&oldid=4068376) |
| 43697 | `tenere` | adj | 0 | femminile plurale di tenero | `tenero` | [tenere](https://it.wiktionary.org/w/index.php?title=tenere&oldid=4040404), [tenero](https://it.wiktionary.org/w/index.php?title=tenero&oldid=4060809) |
| 44686 | `sano` | verb | 0 | prima persona singolare dell'indicativo presente di sanare | `sanare` | [sano](https://it.wiktionary.org/w/index.php?title=sano&oldid=3995382), [sanare](https://it.wiktionary.org/w/index.php?title=sanare&oldid=3982149) |
| 44701 | `cercano` | verb | 0 | terza persona plurale dell'indicativo presente di cercare | `cercare` | [cercano](https://it.wiktionary.org/w/index.php?title=cercano&oldid=3799126), [cercare](https://it.wiktionary.org/w/index.php?title=cercare&oldid=4075919) |
| 45195 | `seconda` | adj | 0 | femminile di secondo | `secondo` | [seconda](https://it.wiktionary.org/w/index.php?title=seconda&oldid=4004980), [secondo](https://it.wiktionary.org/w/index.php?title=secondo&oldid=3951618) |
| 45198 | `seconda` | verb | 1 | seconda persona singolare dell'imperativo presente di secondare | `secondare` | [seconda](https://it.wiktionary.org/w/index.php?title=seconda&oldid=4004980), [secondare](https://it.wiktionary.org/w/index.php?title=secondare&oldid=3974770) |
| 45447 | `ricorsi` | verb | 1 | prima persona singolare dell'indicativo passato remoto di ricorrere | `ricorrere` | [ricorsi](https://it.wiktionary.org/w/index.php?title=ricorsi&oldid=3934881), [ricorrere](https://it.wiktionary.org/w/index.php?title=ricorrere&oldid=4048309) |
| 45499 | `spesa` | verb | 2 | seconda persona singolare dell'imperativo presente di spesare | `spesare` | [spesa](https://it.wiktionary.org/w/index.php?title=spesa&oldid=3998007), [spesare](https://it.wiktionary.org/w/index.php?title=spesare&oldid=3781908) |
| 45586 | `fallo` | verb | 0 | prima persona singolare dell'indicativo presente di fallare | `fallare` | [fallo](https://it.wiktionary.org/w/index.php?title=fallo&oldid=3919764), [fallare](https://it.wiktionary.org/w/index.php?title=fallare&oldid=3404098) |
| 45959 | `merci` | noun | 0 | plurale di merce | `merce` | [merci](https://it.wiktionary.org/w/index.php?title=merci&oldid=4035486), [merce](https://it.wiktionary.org/w/index.php?title=merce&oldid=4075635) |
| 46136 | `disegni` | verb | 0 | seconda persona singolare dell'indicativo presente di disegnare | `disegnare` | [disegni](https://it.wiktionary.org/w/index.php?title=disegni&oldid=4031417), [disegnare](https://it.wiktionary.org/w/index.php?title=disegnare&oldid=3982273) |
| 46136 | `disegni` | verb | 1 | prima persona singolare del congiuntivo presente di disegnare | `disegnare` | [disegni](https://it.wiktionary.org/w/index.php?title=disegni&oldid=4031417), [disegnare](https://it.wiktionary.org/w/index.php?title=disegnare&oldid=3982273) |
| 46136 | `disegni` | verb | 2 | seconda persona singolare del congiuntivo presente di disegnare | `disegnare` | [disegni](https://it.wiktionary.org/w/index.php?title=disegni&oldid=4031417), [disegnare](https://it.wiktionary.org/w/index.php?title=disegnare&oldid=3982273) |
| 46136 | `disegni` | verb | 3 | terza persona singolare del congiuntivo presente di disegnare | `disegnare` | [disegni](https://it.wiktionary.org/w/index.php?title=disegni&oldid=4031417), [disegnare](https://it.wiktionary.org/w/index.php?title=disegnare&oldid=3982273) |
| 46136 | `disegni` | verb | 4 | terza persona singolare dell'imperativo presente di disegnare | `disegnare` | [disegni](https://it.wiktionary.org/w/index.php?title=disegni&oldid=4031417), [disegnare](https://it.wiktionary.org/w/index.php?title=disegnare&oldid=3982273) |
| 46271 | `alimenti` | verb | 0 | seconda persona singolare dell'indicativo presente di alimentare | `alimentare` | [alimenti](https://it.wiktionary.org/w/index.php?title=alimenti&oldid=3864187), [alimentare](https://it.wiktionary.org/w/index.php?title=alimentare&oldid=4051362) |
| 46271 | `alimenti` | verb | 1 | prima persona singolare del congiuntivo presente di alimentare | `alimentare` | [alimenti](https://it.wiktionary.org/w/index.php?title=alimenti&oldid=3864187), [alimentare](https://it.wiktionary.org/w/index.php?title=alimentare&oldid=4051362) |
| 46271 | `alimenti` | verb | 2 | seconda persona singolare del congiuntivo presente di alimentare | `alimentare` | [alimenti](https://it.wiktionary.org/w/index.php?title=alimenti&oldid=3864187), [alimentare](https://it.wiktionary.org/w/index.php?title=alimentare&oldid=4051362) |
| 46271 | `alimenti` | verb | 3 | terza persona singolare del congiuntivo presente di alimentare | `alimentare` | [alimenti](https://it.wiktionary.org/w/index.php?title=alimenti&oldid=3864187), [alimentare](https://it.wiktionary.org/w/index.php?title=alimentare&oldid=4051362) |
| 46274 | `modelli` | verb | 1 | prima persona singolare del congiuntivo di modellare | `modellare` | [modelli](https://it.wiktionary.org/w/index.php?title=modelli&oldid=3934148), [modellare](https://it.wiktionary.org/w/index.php?title=modellare&oldid=3921970) |
| 46274 | `modelli` | verb | 2 | seconda persona singolare del congiuntivo presente di modellare | `modellare` | [modelli](https://it.wiktionary.org/w/index.php?title=modelli&oldid=3934148), [modellare](https://it.wiktionary.org/w/index.php?title=modellare&oldid=3921970) |
| 46274 | `modelli` | verb | 3 | terza persona singolare del congiuntivo presente di modellare | `modellare` | [modelli](https://it.wiktionary.org/w/index.php?title=modelli&oldid=3934148), [modellare](https://it.wiktionary.org/w/index.php?title=modellare&oldid=3921970) |
| 46274 | `modelli` | verb | 4 | terza persona singolare dell'imperativo presente di modellare | `modellare` | [modelli](https://it.wiktionary.org/w/index.php?title=modelli&oldid=3934148), [modellare](https://it.wiktionary.org/w/index.php?title=modellare&oldid=3921970) |
| 46690 | `intuito` | verb | 0 | participio passato di intuire | `intuire` | [intuito](https://it.wiktionary.org/w/index.php?title=intuito&oldid=4012630), [intuire](https://it.wiktionary.org/w/index.php?title=intuire&oldid=3977388) |
| 47197 | `accetta` | adj | 0 | femminile singolare di accetto | `accetto` | [accetta](https://it.wiktionary.org/w/index.php?title=accetta&oldid=4043162), [accetto](https://it.wiktionary.org/w/index.php?title=accetto&oldid=3971857) |
| 47585 | `araba` | adj | 0 | femminile di arabo | `arabo` | [araba](https://it.wiktionary.org/w/index.php?title=araba&oldid=3627306), [arabo](https://it.wiktionary.org/w/index.php?title=arabo&oldid=4067051) |
| 47615 | `armi` | verb | 1 | prima persona singolare del congiuntivo presente di armare | `armare` | [armi](https://it.wiktionary.org/w/index.php?title=armi&oldid=3994588), [armare](https://it.wiktionary.org/w/index.php?title=armare&oldid=3964133) |
| 47615 | `armi` | verb | 2 | seconda persona singolare del congiuntivo presente di armare | `armare` | [armi](https://it.wiktionary.org/w/index.php?title=armi&oldid=3994588), [armare](https://it.wiktionary.org/w/index.php?title=armare&oldid=3964133) |
| 47615 | `armi` | verb | 3 | terza persona singolare del congiuntivo presente di armare | `armare` | [armi](https://it.wiktionary.org/w/index.php?title=armi&oldid=3994588), [armare](https://it.wiktionary.org/w/index.php?title=armare&oldid=3964133) |
| 47615 | `armi` | verb | 4 | terza persona singolare dell'imperativo presente di armare | `armare` | [armi](https://it.wiktionary.org/w/index.php?title=armi&oldid=3994588), [armare](https://it.wiktionary.org/w/index.php?title=armare&oldid=3964133) |
| 47826 | `avanzo` | noun | 1 | prima persona singolare dell'indicativo presente di avanzare | `avanzare` | [avanzo](https://it.wiktionary.org/w/index.php?title=avanzo&oldid=4043215), [avanzare](https://it.wiktionary.org/w/index.php?title=avanzare&oldid=3995788) |
| 47849 | `avvento` | verb | 0 | prima persona singolare dell'indicativo presente di avventare | `avventare` | [avvento](https://it.wiktionary.org/w/index.php?title=avvento&oldid=3997237), [avventare](https://it.wiktionary.org/w/index.php?title=avventare&oldid=3632970) |
| 47869 | `bagnato` | verb | 0 | participio passato maschile singolare di bagnare | `bagnare` | [bagnato](https://it.wiktionary.org/w/index.php?title=bagnato&oldid=4053808), [bagnare](https://it.wiktionary.org/w/index.php?title=bagnare&oldid=3991846) |
| 47897 | `bastarda` | adj | 0 | femminile di bastardo | `bastardo` | [bastarda](https://it.wiktionary.org/w/index.php?title=bastarda&oldid=3570546), [bastardo](https://it.wiktionary.org/w/index.php?title=bastardo&oldid=4066731) |
| 47898 | `bastarda` | noun | 0 | femminile di bastardo | `bastardo` | [bastarda](https://it.wiktionary.org/w/index.php?title=bastarda&oldid=3570546), [bastardo](https://it.wiktionary.org/w/index.php?title=bastardo&oldid=4066731) |
| 48036 | `buttata` | adj | 0 | femminile di buttato | `buttato` | [buttata](https://it.wiktionary.org/w/index.php?title=buttata&oldid=3633783), [buttato](https://it.wiktionary.org/w/index.php?title=buttato&oldid=4053944) |
| 48049 | `cadenza` | verb | 0 | terza persona singolare dell'indicativo presente di cadenzare | `cadenzare` | [cadenza](https://it.wiktionary.org/w/index.php?title=cadenza&oldid=4076996), [cadenzare](https://it.wiktionary.org/w/index.php?title=cadenzare&oldid=3633820) |
| 48049 | `cadenza` | verb | 1 | seconda persona singolare dell'imperativo presente di cadenzare | `cadenzare` | [cadenza](https://it.wiktionary.org/w/index.php?title=cadenza&oldid=4076996), [cadenzare](https://it.wiktionary.org/w/index.php?title=cadenzare&oldid=3633820) |
| 48075 | `calma` | verb | 0 | terza persona singolare dell'indicativo presente di calmare | `calmare` | [calma](https://it.wiktionary.org/w/index.php?title=calma&oldid=4097344), [calmare](https://it.wiktionary.org/w/index.php?title=calmare&oldid=3971915) |
| 48075 | `calma` | verb | 1 | seconda persona singolare dell'imperativo presente di calmare | `calmare` | [calma](https://it.wiktionary.org/w/index.php?title=calma&oldid=4097344), [calmare](https://it.wiktionary.org/w/index.php?title=calmare&oldid=3971915) |
| 48283 | `chiavi` | verb | 1 | prima persona singolare del congiuntivo presente di chiavare | `chiavare` | [chiavi](https://it.wiktionary.org/w/index.php?title=chiavi&oldid=4016958), [chiavare](https://it.wiktionary.org/w/index.php?title=chiavare&oldid=3863081) |
| 48283 | `chiavi` | verb | 2 | seconda persona singolare del congiuntivo presente di chiavare | `chiavare` | [chiavi](https://it.wiktionary.org/w/index.php?title=chiavi&oldid=4016958), [chiavare](https://it.wiktionary.org/w/index.php?title=chiavare&oldid=3863081) |
| 48283 | `chiavi` | verb | 3 | terza persona singolare del congiuntivo presente di chiavare | `chiavare` | [chiavi](https://it.wiktionary.org/w/index.php?title=chiavi&oldid=4016958), [chiavare](https://it.wiktionary.org/w/index.php?title=chiavare&oldid=3863081) |
| 48283 | `chiavi` | verb | 4 | terza persona singolare dell'imperativo presente di chiavare | `chiavare` | [chiavi](https://it.wiktionary.org/w/index.php?title=chiavi&oldid=4016958), [chiavare](https://it.wiktionary.org/w/index.php?title=chiavare&oldid=3863081) |
| 48449 | `colate` | verb | 0 | participio passato plurale femminile di colare | `colare` | [colate](https://it.wiktionary.org/w/index.php?title=colate&oldid=3835421), [colare](https://it.wiktionary.org/w/index.php?title=colare&oldid=3999621) |
| 48805 | `coniglia` | noun | 0 | femminile di coniglio | `coniglio` | [coniglia](https://it.wiktionary.org/w/index.php?title=coniglia&oldid=3759374), [coniglio](https://it.wiktionary.org/w/index.php?title=coniglio&oldid=4046155) |
| 48849 | `contenuto` | adj | 0 | participio passato di contenere | `contenere` | [contenuto](https://it.wiktionary.org/w/index.php?title=contenuto&oldid=4067168), [contenere](https://it.wiktionary.org/w/index.php?title=contenere&oldid=3981741) |
| 48881 | `corona` | verb | 0 | terza persona singolare dell'indicativo presente di coronare | `coronare` | [corona](https://it.wiktionary.org/w/index.php?title=corona&oldid=3957952), [coronare](https://it.wiktionary.org/w/index.php?title=coronare&oldid=3922331) |
| 48881 | `corona` | verb | 1 | seconda persona singolare dell'imperativo presente di coronare | `coronare` | [corona](https://it.wiktionary.org/w/index.php?title=corona&oldid=3957952), [coronare](https://it.wiktionary.org/w/index.php?title=coronare&oldid=3922331) |
| 49123 | `dannati` | adj | 0 | plurale di dannato | `dannato` | [dannati](https://it.wiktionary.org/w/index.php?title=dannati&oldid=3396035), [dannato](https://it.wiktionary.org/w/index.php?title=dannato&oldid=4046262) |
| 49124 | `dannati` | noun | 0 | plurale di dannato | `dannato` | [dannati](https://it.wiktionary.org/w/index.php?title=dannati&oldid=3396035), [dannato](https://it.wiktionary.org/w/index.php?title=dannato&oldid=4046262) |
| 49391 | `diserbante` | verb | 0 | participio presente di diserbare | `diserbare` | [diserbante](https://it.wiktionary.org/w/index.php?title=diserbante&oldid=3692602), [diserbare](https://it.wiktionary.org/w/index.php?title=diserbare&oldid=4012164) |
| 49455 | `domicilio` | verb | 0 | prima persona singolare dell'indicativo presente di domiciliare | `domiciliare` | [domicilio](https://it.wiktionary.org/w/index.php?title=domicilio&oldid=3919543), [domiciliare](https://it.wiktionary.org/w/index.php?title=domiciliare&oldid=3894812) |
| 49754 | `ferma` | verb | 0 | terza persona singolare dell'indicativo presente di fermare | `fermare` | [ferma](https://it.wiktionary.org/w/index.php?title=ferma&oldid=4058493), [fermare](https://it.wiktionary.org/w/index.php?title=fermare&oldid=3968683) |
| 49754 | `ferma` | verb | 1 | seconda persona singolare dell'imperativo presente di fermare | `fermare` | [ferma](https://it.wiktionary.org/w/index.php?title=ferma&oldid=4058493), [fermare](https://it.wiktionary.org/w/index.php?title=fermare&oldid=3968683) |
| 49874 | `forza` | verb | 1 | seconda persona singolare dell'imperativo di forzare | `forzare` | [forza](https://it.wiktionary.org/w/index.php?title=forza&oldid=4054650), [forzare](https://it.wiktionary.org/w/index.php?title=forzare&oldid=3942407) |
| 50600 | `insidia` | verb | 0 | terza persona singolare dell'indicativo presente di insidiare | `insidiare` | [insidia](https://it.wiktionary.org/w/index.php?title=insidia&oldid=4004264), [insidiare](https://it.wiktionary.org/w/index.php?title=insidiare&oldid=3782624) |
| 51202 | `laureando` | verb | 0 | gerundio presente di laureare | `laureare` | [laureando](https://it.wiktionary.org/w/index.php?title=laureando&oldid=3511689), [laureare](https://it.wiktionary.org/w/index.php?title=laureare&oldid=3999013) |
| 51493 | `magnanine` | noun | 0 | plurale di magnanina. | `magnanina` | [magnanine](https://it.wiktionary.org/w/index.php?title=magnanine&oldid=2992181), [magnanina](https://it.wiktionary.org/w/index.php?title=magnanina&oldid=3643428) |
| 51831 | `misura` | verb | 1 | seconda persona dell'imperativo di misurare | `misurare` | [misura](https://it.wiktionary.org/w/index.php?title=misura&oldid=4251400), [misurare](https://it.wiktionary.org/w/index.php?title=misurare&oldid=4067116) |
| 52131 | `ospedaliera` | noun | 0 | femminile di ospedaliero | `ospedaliero` | [ospedaliera](https://it.wiktionary.org/w/index.php?title=ospedaliera&oldid=3919703), [ospedaliero](https://it.wiktionary.org/w/index.php?title=ospedaliero&oldid=4020127) |
| 52339 | `pizzicato` | verb | 0 | participio passato di pizzicare | `pizzicare` | [pizzicato](https://it.wiktionary.org/w/index.php?title=pizzicato&oldid=3982287), [pizzicare](https://it.wiktionary.org/w/index.php?title=pizzicare&oldid=3981628) |
| 52421 | `posta` | verb | 2 | seconda persona singolare dell'imperativo presente di postare | `postare` | [posta](https://it.wiktionary.org/w/index.php?title=posta&oldid=4054173), [postare](https://it.wiktionary.org/w/index.php?title=postare&oldid=3841682) |
| 52485 | `pressi` | verb | 1 | prima persona singolare del congiuntivo presente di pressare | `pressare` | [pressi](https://it.wiktionary.org/w/index.php?title=pressi&oldid=4055618), [pressare](https://it.wiktionary.org/w/index.php?title=pressare&oldid=3647156) |
| 52485 | `pressi` | verb | 2 | seconda persona singolare del congiuntivo presente di pressare | `pressare` | [pressi](https://it.wiktionary.org/w/index.php?title=pressi&oldid=4055618), [pressare](https://it.wiktionary.org/w/index.php?title=pressare&oldid=3647156) |
| 52485 | `pressi` | verb | 3 | terza persona singolare del congiuntivo presente di pressare | `pressare` | [pressi](https://it.wiktionary.org/w/index.php?title=pressi&oldid=4055618), [pressare](https://it.wiktionary.org/w/index.php?title=pressare&oldid=3647156) |
| 52485 | `pressi` | verb | 4 | terza persona singolare dell'imperativo presente di pressare | `pressare` | [pressi](https://it.wiktionary.org/w/index.php?title=pressi&oldid=4055618), [pressare](https://it.wiktionary.org/w/index.php?title=pressare&oldid=3647156) |
| 52516 | `principessa` | noun | 0 | femminile di principe | `principe` | [principessa](https://it.wiktionary.org/w/index.php?title=principessa&oldid=3922750), [principe](https://it.wiktionary.org/w/index.php?title=principe&oldid=3967183) |
| 52558 | `profana` | adj | 0 | Femminile di profano. | `profano` | [profana](https://it.wiktionary.org/w/index.php?title=profana&oldid=4000883), [profano](https://it.wiktionary.org/w/index.php?title=profano&oldid=3849879) |
| 52626 | `proverbi` | noun | 0 | plurale di proverbio | `proverbio` | [proverbi](https://it.wiktionary.org/w/index.php?title=proverbi&oldid=3807428), [proverbio](https://it.wiktionary.org/w/index.php?title=proverbio&oldid=3962525) |
| 52676 | `divino` | verb | 0 | prima persona singolare dell'indicativo presente di divinare | `divinare` | [divino](https://it.wiktionary.org/w/index.php?title=divino&oldid=4057684), [divinare](https://it.wiktionary.org/w/index.php?title=divinare&oldid=4054588) |
| 52807 | `emergente` | verb | 0 | participio presente di emergere | `emergere` | [emergente](https://it.wiktionary.org/w/index.php?title=emergente&oldid=3894848), [emergere](https://it.wiktionary.org/w/index.php?title=emergere&oldid=4066825) |
| 53057 | `rinuncia` | verb | 1 | seconda persona singolare dell'imperativo di rinunciare | `rinunciare` | [rinuncia](https://it.wiktionary.org/w/index.php?title=rinuncia&oldid=4057354), [rinunciare](https://it.wiktionary.org/w/index.php?title=rinunciare&oldid=3997252) |
| 53163 | `romanza` | adj | 0 | femminile di romanzo | `romanzo` | [romanza](https://it.wiktionary.org/w/index.php?title=romanza&oldid=3874895), [romanzo](https://it.wiktionary.org/w/index.php?title=romanzo&oldid=4064290) |
| 53212 | `sabina` | noun | 0 | femminile di sabino | `sabino` | [sabina](https://it.wiktionary.org/w/index.php?title=sabina&oldid=3988386), [sabino](https://it.wiktionary.org/w/index.php?title=sabino&oldid=3889664) |
| 53271 | `santa` | adj | 0 | femminile singolare di santo | `santo` | [santa](https://it.wiktionary.org/w/index.php?title=santa&oldid=3648883), [santo](https://it.wiktionary.org/w/index.php?title=santo&oldid=4051581) |
| 53435 | `impossibilitato` | verb | 0 | participio passato di impossibilitare | `impossibilitare` | [impossibilitato](https://it.wiktionary.org/w/index.php?title=impossibilitato&oldid=3957466), [impossibilitare](https://it.wiktionary.org/w/index.php?title=impossibilitare&oldid=3790482) |
| 53627 | `infetto` | verb | 0 | prima persona singolare dell'indicativo presente di infettare | `infettare` | [infetto](https://it.wiktionary.org/w/index.php?title=infetto&oldid=3790562), [infettare](https://it.wiktionary.org/w/index.php?title=infettare&oldid=3889703) |
| 53630 | `infiammato` | verb | 0 | participio passato di infiammare | `infiammare` | [infiammato](https://it.wiktionary.org/w/index.php?title=infiammato&oldid=3980651), [infiammare](https://it.wiktionary.org/w/index.php?title=infiammare&oldid=3889722) |
| 53787 | `inventato` | verb | 0 | participio passato di inventare | `inventare` | [inventato](https://it.wiktionary.org/w/index.php?title=inventato&oldid=3776074), [inventare](https://it.wiktionary.org/w/index.php?title=inventare&oldid=4045712) |
| 53948 | `scoperta` | adj | 0 | femminile di scoperto | `scoperto` | [scoperta](https://it.wiktionary.org/w/index.php?title=scoperta&oldid=4000614), [scoperto](https://it.wiktionary.org/w/index.php?title=scoperto&oldid=3834023) |
| 53990 | `seguito` | verb | 1 | prima persona singolare dell'indicativo presente di seguitare | `seguitare` | [seguito](https://it.wiktionary.org/w/index.php?title=seguito&oldid=4013406), [seguitare](https://it.wiktionary.org/w/index.php?title=seguitare&oldid=4001441) |
| 54094 | `slava` | adj | 0 | femminile di slavo | `slavo` | [slava](https://it.wiktionary.org/w/index.php?title=slava&oldid=3691517), [slavo](https://it.wiktionary.org/w/index.php?title=slavo&oldid=3786905) |
| 54109 | `smentita` | verb | 0 | participio passato femminile di smentito | `smentito` | [smentita](https://it.wiktionary.org/w/index.php?title=smentita&oldid=3995459), [smentito](https://it.wiktionary.org/w/index.php?title=smentito&oldid=4010694) |
| 54417 | `strega` | verb | 1 | seconda persona singolare dell'imperativo presente di stregare | `stregare` | [strega](https://it.wiktionary.org/w/index.php?title=strega&oldid=4001500), [stregare](https://it.wiktionary.org/w/index.php?title=stregare&oldid=4035387) |
| 54441 | `motivato` | verb | 0 | participio passato di motivare | `motivare` | [motivato](https://it.wiktionary.org/w/index.php?title=motivato&oldid=3783270), [motivare](https://it.wiktionary.org/w/index.php?title=motivare&oldid=3938670) |
| 54445 | `stufa` | verb | 1 | seconda persona singolare dell'imperativo di stufare | `stufare` | [stufa](https://it.wiktionary.org/w/index.php?title=stufa&oldid=3959048), [stufare](https://it.wiktionary.org/w/index.php?title=stufare&oldid=3964242) |
| 54532 | `sveglia` | adj | 0 | femminile di sveglio | `sveglio` | [sveglia](https://it.wiktionary.org/w/index.php?title=sveglia&oldid=4075984), [sveglio](https://it.wiktionary.org/w/index.php?title=sveglio&oldid=3999466) |
| 54534 | `sveglia` | verb | 1 | seconda persona singolare dell'imperativo di svegliare | `svegliare` | [sveglia](https://it.wiktionary.org/w/index.php?title=sveglia&oldid=4075984), [svegliare](https://it.wiktionary.org/w/index.php?title=svegliare&oldid=4031338) |
| 54689 | `tenuta` | adj | 0 | femminile di tenuto | `tenuto` | [tenuta](https://it.wiktionary.org/w/index.php?title=tenuta&oldid=4046356), [tenuto](https://it.wiktionary.org/w/index.php?title=tenuto&oldid=3868944) |
| 54790 | `tirata` | adj | 0 | femminile di tirato | `tirato` | [tirata](https://it.wiktionary.org/w/index.php?title=tirata&oldid=3963055), [tirato](https://it.wiktionary.org/w/index.php?title=tirato&oldid=4002116) |
| 54816 | `predefinito` | verb | 0 | participio passato di predefinire | `predefinire` | [predefinito](https://it.wiktionary.org/w/index.php?title=predefinito&oldid=4217051), [predefinire](https://it.wiktionary.org/w/index.php?title=predefinire&oldid=3433321) |
| 54858 | `programmato` | verb | 0 | participio passato di programmare | `programmare` | [programmato](https://it.wiktionary.org/w/index.php?title=programmato&oldid=3987033), [programmare](https://it.wiktionary.org/w/index.php?title=programmare&oldid=4003360) |
| 54862 | `proibito` | verb | 0 | participio passato maschile singolare di proibire | `proibire` | [proibito](https://it.wiktionary.org/w/index.php?title=proibito&oldid=3791192), [proibire](https://it.wiktionary.org/w/index.php?title=proibire&oldid=3964865) |
| 55096 | `sognante` | verb | 0 | participio presente di sognare | `sognare` | [sognante](https://it.wiktionary.org/w/index.php?title=sognante&oldid=3989914), [sognare](https://it.wiktionary.org/w/index.php?title=sognare&oldid=4039000) |
| 55165 | `trama` | verb | 1 | seconda persona singolare imperativo di tramare | `tramare` | [trama](https://it.wiktionary.org/w/index.php?title=trama&oldid=4000030), [tramare](https://it.wiktionary.org/w/index.php?title=tramare&oldid=4032493) |
| 55209 | `specifico` | verb | 0 | prima persona singolare dell'indicativo presente di specificare | `specificare` | [specifico](https://it.wiktionary.org/w/index.php?title=specifico&oldid=4009387), [specificare](https://it.wiktionary.org/w/index.php?title=specificare&oldid=4075744) |
| 55222 | `trattino` | verb | 1 | terza persona plurale dell'imperativo presente di trattare | `trattare` | [trattino](https://it.wiktionary.org/w/index.php?title=trattino&oldid=3960247), [trattare](https://it.wiktionary.org/w/index.php?title=trattare&oldid=3921273) |
| 55266 | `trombettiere` | noun | 0 | plurale di trombettiera | `trombettiera` | [trombettiere](https://it.wiktionary.org/w/index.php?title=trombettiere&oldid=3448596), [trombettiera](https://it.wiktionary.org/w/index.php?title=trombettiera&oldid=3651945) |
| 55615 | `visto` | verb | 1 | prima persona singolare dell'indicativo presente di vistare | `vistare` | [visto](https://it.wiktionary.org/w/index.php?title=visto&oldid=4048297), [vistare](https://it.wiktionary.org/w/index.php?title=vistare&oldid=3776379) |
| 55666 | `voli` | verb | 2 | seconda persona singolare congiuntivo presente di volare | `volare` | [voli](https://it.wiktionary.org/w/index.php?title=voli&oldid=3933187), [volare](https://it.wiktionary.org/w/index.php?title=volare&oldid=4009802) |
| 55666 | `voli` | verb | 3 | terza persona singolare congiuntivo presente di volare | `volare` | [voli](https://it.wiktionary.org/w/index.php?title=voli&oldid=3933187), [volare](https://it.wiktionary.org/w/index.php?title=volare&oldid=4009802) |
| 55954 | `adriatica` | adj | 0 | femminile di adriatico | `adriatico` | [adriatica](https://it.wiktionary.org/w/index.php?title=adriatica&oldid=2813651), [adriatico](https://it.wiktionary.org/w/index.php?title=adriatico&oldid=4062423) |
| 55955 | `adriatiche` | adj | 0 | Femminile plurale di adriatico | `adriatico` | [adriatiche](https://it.wiktionary.org/w/index.php?title=adriatiche&oldid=2813652), [adriatico](https://it.wiktionary.org/w/index.php?title=adriatico&oldid=4062423) |
| 56022 | `alpina` | adj | 0 | femminile di alpino | `alpino` | [alpina](https://it.wiktionary.org/w/index.php?title=alpina&oldid=2822366), [alpino](https://it.wiktionary.org/w/index.php?title=alpino&oldid=3840249) |
| 56023 | `alpina` | noun | 0 | femminile di alpino | `alpino` | [alpina](https://it.wiktionary.org/w/index.php?title=alpina&oldid=2822366), [alpino](https://it.wiktionary.org/w/index.php?title=alpino&oldid=3840249) |
| 56024 | `alpine` | adj | 0 | femminile plurale di alpino | `alpino` | [alpine](https://it.wiktionary.org/w/index.php?title=alpine&oldid=3373880), [alpino](https://it.wiktionary.org/w/index.php?title=alpino&oldid=3840249) |
| 56025 | `alpine` | noun | 0 | femminile plurale di alpino | `alpino` | [alpine](https://it.wiktionary.org/w/index.php?title=alpine&oldid=3373880), [alpino](https://it.wiktionary.org/w/index.php?title=alpino&oldid=3840249) |
| 56111 | `analitica` | adj | 0 | plurale di analitico | `analitico` | [analitica](https://it.wiktionary.org/w/index.php?title=analitica&oldid=3374997), [analitico](https://it.wiktionary.org/w/index.php?title=analitico&oldid=3976568) |
| 56113 | `analitiche` | adj | 0 | femminile plurale di analitico | `analitico` | [analitiche](https://it.wiktionary.org/w/index.php?title=analitiche&oldid=3374999), [analitico](https://it.wiktionary.org/w/index.php?title=analitico&oldid=3976568) |
| 56152 | `anniversari` | noun | 0 | plurale di anniversario | `anniversario` | [anniversari](https://it.wiktionary.org/w/index.php?title=anniversari&oldid=2828177), [anniversario](https://it.wiktionary.org/w/index.php?title=anniversario&oldid=3893352) |
| 56223 | `appassionate` | verb | 1 | seconda persona plurale dell'indicativo presente di appassionare | `appassionare` | [appassionate](https://it.wiktionary.org/w/index.php?title=appassionate&oldid=3834987), [appassionare](https://it.wiktionary.org/w/index.php?title=appassionare&oldid=3996946) |
| 56223 | `appassionate` | verb | 2 | seconda persona plurale dell'imperativo presente di appassionare | `appassionare` | [appassionate](https://it.wiktionary.org/w/index.php?title=appassionate&oldid=3834987), [appassionare](https://it.wiktionary.org/w/index.php?title=appassionare&oldid=3996946) |
| 56633 | `carine` | adj | 0 | femminile plurale di carino | `carino` | [carine](https://it.wiktionary.org/w/index.php?title=carine&oldid=3173534), [carino](https://it.wiktionary.org/w/index.php?title=carino&oldid=3998818) |
| 56635 | `carini` | adj | 0 | plurale di carino | `carino` | [carini](https://it.wiktionary.org/w/index.php?title=carini&oldid=2861222), [carino](https://it.wiktionary.org/w/index.php?title=carino&oldid=3998818) |
| 56752 | `chimerica` | adj | 0 | femminile di chimerico | `chimerico` | [chimerica](https://it.wiktionary.org/w/index.php?title=chimerica&oldid=2866601), [chimerico](https://it.wiktionary.org/w/index.php?title=chimerico&oldid=4010998) |
| 57041 | `connesse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di connettere | `connettere` | [connesse](https://it.wiktionary.org/w/index.php?title=connesse&oldid=4159757), [connettere](https://it.wiktionary.org/w/index.php?title=connettere&oldid=3635387) |
| 57092 | `contenta` | verb | 0 | terza persona singolare dell'indicativo presente di contentare | `contentare` | [contenta](https://it.wiktionary.org/w/index.php?title=contenta&oldid=3921655), [contentare](https://it.wiktionary.org/w/index.php?title=contentare&oldid=3635521) |
| 57092 | `contenta` | verb | 1 | seconda persona singolare dell'imperativo presente di contentare | `contentare` | [contenta](https://it.wiktionary.org/w/index.php?title=contenta&oldid=3921655), [contentare](https://it.wiktionary.org/w/index.php?title=contentare&oldid=3635521) |
| 57123 | `contraria` | verb | 1 | seconda persona singolare dell'imperativo presente di contrariare | `contrariare` | [contraria](https://it.wiktionary.org/w/index.php?title=contraria&oldid=4064271), [contrariare](https://it.wiktionary.org/w/index.php?title=contrariare&oldid=3976414) |
| 57413 | `deplorevoli` | adj | 0 | plurale di deplorevole | `deplorevole` | [deplorevoli](https://it.wiktionary.org/w/index.php?title=deplorevoli&oldid=2896514), [deplorevole](https://it.wiktionary.org/w/index.php?title=deplorevole&oldid=4248029) |
| 57499 | `differenziate` | verb | 1 | seconda persona plurale dell'indicativo presente di differenziare | `differenziare` | [differenziate](https://it.wiktionary.org/w/index.php?title=differenziate&oldid=3835682), [differenziare](https://it.wiktionary.org/w/index.php?title=differenziare&oldid=3969015) |
| 57499 | `differenziate` | verb | 2 | seconda persona plurale del congiuntivo presente di differenziare | `differenziare` | [differenziate](https://it.wiktionary.org/w/index.php?title=differenziate&oldid=3835682), [differenziare](https://it.wiktionary.org/w/index.php?title=differenziare&oldid=3969015) |
| 57499 | `differenziate` | verb | 3 | seconda persona plurale dell'imperativo presente di differenziare | `differenziare` | [differenziate](https://it.wiktionary.org/w/index.php?title=differenziate&oldid=3835682), [differenziare](https://it.wiktionary.org/w/index.php?title=differenziare&oldid=3969015) |
| 57522 | `diplomatica` | noun | 0 | femminile di diplomatico | `diplomatico` | [diplomatica](https://it.wiktionary.org/w/index.php?title=diplomatica&oldid=4077084), [diplomatico](https://it.wiktionary.org/w/index.php?title=diplomatico&oldid=3994054) |
| 57533 | `diritta` | adj | 0 | Femminile di diritto. | `diritto` | [diritta](https://it.wiktionary.org/w/index.php?title=diritta&oldid=3637892), [diritto](https://it.wiktionary.org/w/index.php?title=diritto&oldid=4075813) |
| 57581 | `divina` | verb | 1 | seconda persona singolare dell'imperativo presente di divinare | `divinare` | [divina](https://it.wiktionary.org/w/index.php?title=divina&oldid=4052437), [divinare](https://it.wiktionary.org/w/index.php?title=divinare&oldid=4054588) |
| 57818 | `espresse` | verb | 0 | participio passato plurale femminile di esprimere | `esprimere` | [espresse](https://it.wiktionary.org/w/index.php?title=espresse&oldid=3993128), [esprimere](https://it.wiktionary.org/w/index.php?title=esprimere&oldid=3947189) |
| 57818 | `espresse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di esprimere | `esprimere` | [espresse](https://it.wiktionary.org/w/index.php?title=espresse&oldid=3993128), [esprimere](https://it.wiktionary.org/w/index.php?title=esprimere&oldid=3947189) |
| 57899 | `faticosi` | adj | 0 | plurale di faticoso | `faticoso` | [faticosi](https://it.wiktionary.org/w/index.php?title=faticosi&oldid=3923700), [faticoso](https://it.wiktionary.org/w/index.php?title=faticoso&oldid=3962724) |
| 57949 | `fesse` | noun | 0 | femminile plurale di fesso | `fesso` | [fesse](https://it.wiktionary.org/w/index.php?title=fesse&oldid=3895812), [fesso](https://it.wiktionary.org/w/index.php?title=fesso&oldid=3978033) |
| 58167 | `grigiastri` | adj | 0 | plurale di grigiastro | `grigiastro` | [grigiastri](https://it.wiktionary.org/w/index.php?title=grigiastri&oldid=3919114), [grigiastro](https://it.wiktionary.org/w/index.php?title=grigiastro&oldid=4054331) |
| 58168 | `grigiastri` | noun | 0 | plurale di grigiastro | `grigiastro` | [grigiastri](https://it.wiktionary.org/w/index.php?title=grigiastri&oldid=3919114), [grigiastro](https://it.wiktionary.org/w/index.php?title=grigiastro&oldid=4054331) |
| 58736 | `infiammate` | verb | 1 | seconda persona plurale dell'indicativo presente di infiammare | `infiammare` | [infiammate](https://it.wiktionary.org/w/index.php?title=infiammate&oldid=3836367), [infiammare](https://it.wiktionary.org/w/index.php?title=infiammare&oldid=3889722) |
| 58736 | `infiammate` | verb | 2 | seconda persona plurale dell'imperativo presente di infiammare | `infiammare` | [infiammate](https://it.wiktionary.org/w/index.php?title=infiammate&oldid=3836367), [infiammare](https://it.wiktionary.org/w/index.php?title=infiammare&oldid=3889722) |
| 58761 | `informativa` | adj | 0 | Femminile di informativo. | `informativo` | [informativa](https://it.wiktionary.org/w/index.php?title=informativa&oldid=3641568), [informativo](https://it.wiktionary.org/w/index.php?title=informativo&oldid=3895071) |
| 58805 | `inibita` | noun | 0 | femminile di inibito | `inibito` | [inibita](https://it.wiktionary.org/w/index.php?title=inibita&oldid=3920438), [inibito](https://it.wiktionary.org/w/index.php?title=inibito&oldid=4067162) |
| 58807 | `inibite` | noun | 0 | femminile plurale di inibito | `inibito` | [inibite](https://it.wiktionary.org/w/index.php?title=inibite&oldid=3641637), [inibito](https://it.wiktionary.org/w/index.php?title=inibito&oldid=4067162) |
| 58835 | `innovativa` | adj | 0 | Femminile di innovativo. | `innovativo` | [innovativa](https://it.wiktionary.org/w/index.php?title=innovativa&oldid=3641680), [innovativo](https://it.wiktionary.org/w/index.php?title=innovativo&oldid=3973300) |
| 58949 | `integrali` | noun | 0 | plurale di integrale | `integrale` | [integrali](https://it.wiktionary.org/w/index.php?title=integrali&oldid=3827194), [integrale](https://it.wiktionary.org/w/index.php?title=integrale&oldid=3991240) |
| 59072 | `introversa` | adj | 0 | Femminile di introverso. | `introverso` | [introversa](https://it.wiktionary.org/w/index.php?title=introversa&oldid=3642260), [introverso](https://it.wiktionary.org/w/index.php?title=introverso&oldid=3945838) |
| 59075 | `intuitive` | adj | 0 | femminile plurale di intuitivo | `intuitivo` | [intuitive](https://it.wiktionary.org/w/index.php?title=intuitive&oldid=3887764), [intuitivo](https://it.wiktionary.org/w/index.php?title=intuitivo&oldid=3941090) |
| 59097 | `invasive` | adj | 0 | Femminile plurale di invasivo. | `invasivo` | [invasive](https://it.wiktionary.org/w/index.php?title=invasive&oldid=3642300), [invasivo](https://it.wiktionary.org/w/index.php?title=invasivo&oldid=3836448) |
| 59101 | `inventive` | noun | 0 | plurale di inventiva | `inventiva` | [inventive](https://it.wiktionary.org/w/index.php?title=inventive&oldid=4002940), [inventiva](https://it.wiktionary.org/w/index.php?title=inventiva&oldid=4046027) |
| 59106 | `inversa` | adj | 0 | Femminile di inverso. | `inverso` | [inversa](https://it.wiktionary.org/w/index.php?title=inversa&oldid=3642314), [inverso](https://it.wiktionary.org/w/index.php?title=inverso&oldid=3971957) |
| 59153 | `ipocrite` | noun | 0 | femminile plurale di ipocrita | `ipocrita` | [ipocrite](https://it.wiktionary.org/w/index.php?title=ipocrite&oldid=3832559), [ipocrita](https://it.wiktionary.org/w/index.php?title=ipocrita&oldid=4049422) |
| 59162 | `irachena` | adj | 0 | Femminile singolare di iracheno. | `iracheno` | [irachena](https://it.wiktionary.org/w/index.php?title=irachena&oldid=3642424), [iracheno](https://it.wiktionary.org/w/index.php?title=iracheno&oldid=3990855) |
| 59199 | `irrisolta` | adj | 0 | Femminile singolare di irrisolto. | `irrisolto` | [irrisolta](https://it.wiktionary.org/w/index.php?title=irrisolta&oldid=3642487), [irrisolto](https://it.wiktionary.org/w/index.php?title=irrisolto&oldid=4011298) |
| 59203 | `irrisoria` | adj | 0 | Femminile singolare di irrisorio. | `irrisorio` | [irrisoria](https://it.wiktionary.org/w/index.php?title=irrisoria&oldid=3642490), [irrisorio](https://it.wiktionary.org/w/index.php?title=irrisorio&oldid=3965028) |
| 59226 | `isolate` | verb | 1 | seconda persona plurale imperativo di isolare | `isolare` | [isolate](https://it.wiktionary.org/w/index.php?title=isolate&oldid=3868118), [isolare](https://it.wiktionary.org/w/index.php?title=isolare&oldid=3968761) |
| 59226 | `isolate` | verb | 2 | femminile plurale participio passato di isolare | `isolare` | [isolate](https://it.wiktionary.org/w/index.php?title=isolate&oldid=3868118), [isolare](https://it.wiktionary.org/w/index.php?title=isolare&oldid=3968761) |
| 59234 | `israeliana` | adj | 0 | Femminile singolare di israeliano. | `israeliano` | [israeliana](https://it.wiktionary.org/w/index.php?title=israeliana&oldid=3642559), [israeliano](https://it.wiktionary.org/w/index.php?title=israeliano&oldid=4061603) |
| 59245 | `istintiva` | adj | 0 | Femminile singolare di istintivo. | `istintivo` | [istintiva](https://it.wiktionary.org/w/index.php?title=istintiva&oldid=3642577), [istintivo](https://it.wiktionary.org/w/index.php?title=istintivo&oldid=3984016) |
| 59247 | `istituita` | adj | 0 | Femminile singolare di istituito. | `istituito` | [istituita](https://it.wiktionary.org/w/index.php?title=istituita&oldid=3642580), [istituito](https://it.wiktionary.org/w/index.php?title=istituito&oldid=3832546) |
| 59346 | `legittimi` | verb | 3 | terza persona singolare del congiuntivo presente di legittimare | `legittimare` | [legittimi](https://it.wiktionary.org/w/index.php?title=legittimi&oldid=3934036), [legittimare](https://it.wiktionary.org/w/index.php?title=legittimare&oldid=3896514) |
| 59402 | `lordi` | verb | 1 | prima persona singolare del congiuntivo presente di lordare | `lordare` | [lordi](https://it.wiktionary.org/w/index.php?title=lordi&oldid=3920730), [lordare](https://it.wiktionary.org/w/index.php?title=lordare&oldid=3643214) |
| 59402 | `lordi` | verb | 2 | seconda persona singolare del congiuntivo presente di lordare | `lordare` | [lordi](https://it.wiktionary.org/w/index.php?title=lordi&oldid=3920730), [lordare](https://it.wiktionary.org/w/index.php?title=lordare&oldid=3643214) |
| 59402 | `lordi` | verb | 3 | terza persona singolare del congiuntivo presente di lordare | `lordare` | [lordi](https://it.wiktionary.org/w/index.php?title=lordi&oldid=3920730), [lordare](https://it.wiktionary.org/w/index.php?title=lordare&oldid=3643214) |
| 59402 | `lordi` | verb | 4 | terza persona singolare dell'imperativo presente di lordare | `lordare` | [lordi](https://it.wiktionary.org/w/index.php?title=lordi&oldid=3920730), [lordare](https://it.wiktionary.org/w/index.php?title=lordare&oldid=3643214) |
| 59503 | `magrebina` | adj | 0 | Femminile singolare di magrebino. | `magrebino` | [magrebina](https://it.wiktionary.org/w/index.php?title=magrebina&oldid=3643453), [magrebino](https://it.wiktionary.org/w/index.php?title=magrebino&oldid=3964236) |
| 59594 | `marziana` | adj | 0 | Femminile singolare di marziano. | `marziano` | [marziana](https://it.wiktionary.org/w/index.php?title=marziana&oldid=3643694), [marziano](https://it.wiktionary.org/w/index.php?title=marziano&oldid=3975481) |
| 59596 | `marzolina` | adj | 0 | Femminile singolare di marzolino. | `marzolino` | [marzolina](https://it.wiktionary.org/w/index.php?title=marzolina&oldid=3643696), [marzolino](https://it.wiktionary.org/w/index.php?title=marzolino&oldid=3643699) |
| 59600 | `maschie` | adj | 0 | Femminile plurale di maschio | `maschio` | [maschie](https://it.wiktionary.org/w/index.php?title=maschie&oldid=3984679), [maschio](https://it.wiktionary.org/w/index.php?title=maschio&oldid=3985362) |
| 59607 | `materna` | adj | 0 | Femminile singolare di materno. | `materno` | [materna](https://it.wiktionary.org/w/index.php?title=materna&oldid=3643759), [materno](https://it.wiktionary.org/w/index.php?title=materno&oldid=3785860) |
| 59677 | `milanesi` | noun | 0 | plurale di milanese | `milanese` | [milanesi](https://it.wiktionary.org/w/index.php?title=milanesi&oldid=3671806), [milanese](https://it.wiktionary.org/w/index.php?title=milanese&oldid=4070115) |
| 59732 | `molte` | pron | 0 | plurale di molta | `molta` | [molte](https://it.wiktionary.org/w/index.php?title=molte&oldid=3312521), [molta](https://it.wiktionary.org/w/index.php?title=molta&oldid=3002018) |
| 59740 | `monde` | adj | 0 | femminile plurale di mondo | `mondo` | [monde](https://it.wiktionary.org/w/index.php?title=monde&oldid=3861089), [mondo](https://it.wiktionary.org/w/index.php?title=mondo&oldid=4050772) |
| 59963 | `operativa` | adj | 0 | femminile di operativo | `operativo` | [operativa](https://it.wiktionary.org/w/index.php?title=operativa&oldid=3428047), [operativo](https://it.wiktionary.org/w/index.php?title=operativo&oldid=4059330) |
| 59967 | `operativi` | adj | 0 | plurale di operativo | `operativo` | [operativi](https://it.wiktionary.org/w/index.php?title=operativi&oldid=3428049), [operativo](https://it.wiktionary.org/w/index.php?title=operativo&oldid=4059330) |
| 60161 | `pariolina` | adj | 0 | Femminile singolare di pariolino. | `pariolino` | [pariolina](https://it.wiktionary.org/w/index.php?title=pariolina&oldid=3683369), [pariolino](https://it.wiktionary.org/w/index.php?title=pariolino&oldid=3735526) |
| 60250 | `perpetui` | verb | 1 | prima persona singolare del congiuntivo presente di perpetuare | `perpetuare` | [perpetui](https://it.wiktionary.org/w/index.php?title=perpetui&oldid=3868480), [perpetuare](https://it.wiktionary.org/w/index.php?title=perpetuare&oldid=4066997) |
| 60250 | `perpetui` | verb | 2 | seconda persona singolare del congiuntivo presente di perpetuare | `perpetuare` | [perpetui](https://it.wiktionary.org/w/index.php?title=perpetui&oldid=3868480), [perpetuare](https://it.wiktionary.org/w/index.php?title=perpetuare&oldid=4066997) |
| 60250 | `perpetui` | verb | 3 | terza persona singolare del congiuntivo presente di perpetuare | `perpetuare` | [perpetui](https://it.wiktionary.org/w/index.php?title=perpetui&oldid=3868480), [perpetuare](https://it.wiktionary.org/w/index.php?title=perpetuare&oldid=4066997) |
| 60275 | `pidocchiose` | adj | 0 | femminile plurale di pidocchioso | `pidocchioso` | [pidocchiose](https://it.wiktionary.org/w/index.php?title=pidocchiose&oldid=3024460), [pidocchioso](https://it.wiktionary.org/w/index.php?title=pidocchioso&oldid=3817128) |
| 60276 | `pidocchiose` | noun | 0 | femminile plurale di pidocchioso | `pidocchioso` | [pidocchiose](https://it.wiktionary.org/w/index.php?title=pidocchiose&oldid=3024460), [pidocchioso](https://it.wiktionary.org/w/index.php?title=pidocchioso&oldid=3817128) |
| 60342 | `precisa` | adj | 0 | femminile di preciso | `preciso` | [precisa](https://it.wiktionary.org/w/index.php?title=precisa&oldid=4052684), [preciso](https://it.wiktionary.org/w/index.php?title=preciso&oldid=3999826) |
| 60343 | `precisa` | verb | 1 | seconda persona singolare dell'imperativo presente di precisare | `precisare` | [precisa](https://it.wiktionary.org/w/index.php?title=precisa&oldid=4052684), [precisare](https://it.wiktionary.org/w/index.php?title=precisare&oldid=4015612) |
| 60354 | `preferite` | verb | 0 | participio passato plurale femminile di preferire | `preferire` | [preferite](https://it.wiktionary.org/w/index.php?title=preferite&oldid=3868531), [preferire](https://it.wiktionary.org/w/index.php?title=preferire&oldid=3998723) |
| 60354 | `preferite` | verb | 1 | seconda persona plurale dell'indicativo presente di preferire | `preferire` | [preferite](https://it.wiktionary.org/w/index.php?title=preferite&oldid=3868531), [preferire](https://it.wiktionary.org/w/index.php?title=preferire&oldid=3998723) |
| 60354 | `preferite` | verb | 2 | seconda persona plurale dell'imperativo presente di preferire | `preferire` | [preferite](https://it.wiktionary.org/w/index.php?title=preferite&oldid=3868531), [preferire](https://it.wiktionary.org/w/index.php?title=preferire&oldid=3998723) |
| 60545 | `quella` | pron | 0 | femminile di quello | `quello` | [quella](https://it.wiktionary.org/w/index.php?title=quella&oldid=3194923), [quello](https://it.wiktionary.org/w/index.php?title=quello&oldid=4042892) |
| 60556 | `quotidiani` | noun | 0 | plurale di quotidiano | `quotidiano` | [quotidiani](https://it.wiktionary.org/w/index.php?title=quotidiani&oldid=3933079), [quotidiano](https://it.wiktionary.org/w/index.php?title=quotidiano&oldid=4059494) |
| 61224 | `raggrinzito` | verb | 0 | participio passato di raggrinzire | `raggrinzire` | [raggrinzito](https://it.wiktionary.org/w/index.php?title=raggrinzito&oldid=3996707), [raggrinzire](https://it.wiktionary.org/w/index.php?title=raggrinzire&oldid=4058390) |
| 61301 | `esercizi` | noun | 0 | Plurale di esercizio. | `esercizio` | [esercizi](https://it.wiktionary.org/w/index.php?title=esercizi&oldid=2921686), [esercizio](https://it.wiktionary.org/w/index.php?title=esercizio&oldid=3988674) |
| 61841 | `resti` | verb | 1 | prima persona singolare del congiuntivo presente di restare | `restare` | [resti](https://it.wiktionary.org/w/index.php?title=resti&oldid=4053067), [restare](https://it.wiktionary.org/w/index.php?title=restare&oldid=4047419) |
| 61841 | `resti` | verb | 2 | seconda persona singolare del congiuntivo presente di restare | `restare` | [resti](https://it.wiktionary.org/w/index.php?title=resti&oldid=4053067), [restare](https://it.wiktionary.org/w/index.php?title=restare&oldid=4047419) |
| 61841 | `resti` | verb | 3 | terza persona singolare del congiuntivo presente di restare | `restare` | [resti](https://it.wiktionary.org/w/index.php?title=resti&oldid=4053067), [restare](https://it.wiktionary.org/w/index.php?title=restare&oldid=4047419) |
| 61841 | `resti` | verb | 4 | terza persona singolare dell'imperativo presente di restare | `restare` | [resti](https://it.wiktionary.org/w/index.php?title=resti&oldid=4053067), [restare](https://it.wiktionary.org/w/index.php?title=restare&oldid=4047419) |
| 61881 | `cere` | noun | 0 | Plurale di cera | `cera` | [cere](https://it.wiktionary.org/w/index.php?title=cere&oldid=3634507), [cera](https://it.wiktionary.org/w/index.php?title=cera&oldid=4040781) |
| 61903 | `colori` | verb | 1 | prima persona singolare del congiuntivo presente di colorare | `colorare` | [colori](https://it.wiktionary.org/w/index.php?title=colori&oldid=3952525), [colorare](https://it.wiktionary.org/w/index.php?title=colorare&oldid=4048187) |
| 61903 | `colori` | verb | 2 | seconda persona singolare del congiuntivo presente di colorare | `colorare` | [colori](https://it.wiktionary.org/w/index.php?title=colori&oldid=3952525), [colorare](https://it.wiktionary.org/w/index.php?title=colorare&oldid=4048187) |
| 61903 | `colori` | verb | 3 | terza persona singolare del congiuntivo presente di colorare | `colorare` | [colori](https://it.wiktionary.org/w/index.php?title=colori&oldid=3952525), [colorare](https://it.wiktionary.org/w/index.php?title=colorare&oldid=4048187) |
| 61903 | `colori` | verb | 4 | terza persona singolare dell'imperativo presente di colorare | `colorare` | [colori](https://it.wiktionary.org/w/index.php?title=colori&oldid=3952525), [colorare](https://it.wiktionary.org/w/index.php?title=colorare&oldid=4048187) |
| 62149 | `sfoderato` | verb | 0 | participio passato di sfoderare | `sfoderare` | [sfoderato](https://it.wiktionary.org/w/index.php?title=sfoderato&oldid=3837580), [sfoderare](https://it.wiktionary.org/w/index.php?title=sfoderare&oldid=4130626) |
| 62375 | `eminenze` | noun | 0 | plurale di eminenza | `eminenza` | [eminenze](https://it.wiktionary.org/w/index.php?title=eminenze&oldid=3401298), [eminenza](https://it.wiktionary.org/w/index.php?title=eminenza&oldid=3638556) |
| 62384 | `epistemici` | adj | 0 | plurale di epistemico | `epistemico` | [epistemici](https://it.wiktionary.org/w/index.php?title=epistemici&oldid=3402128), [epistemico](https://it.wiktionary.org/w/index.php?title=epistemico&oldid=3638670) |
| 62423 | `producente` | verb | 0 | participio presente di produrre | `produrre` | [producente](https://it.wiktionary.org/w/index.php?title=producente&oldid=3034299), [produrre](https://it.wiktionary.org/w/index.php?title=produrre&oldid=3976720) |
| 62428 | `producenti` | adj | 0 | plurale di producente | `producente` | [producenti](https://it.wiktionary.org/w/index.php?title=producenti&oldid=3433964), [producente](https://it.wiktionary.org/w/index.php?title=producente&oldid=3034299) |
| 62431 | `apofantici` | adj | 0 | plurale di apofantico | `apofantico` | [apofantici](https://it.wiktionary.org/w/index.php?title=apofantici&oldid=3378216), [apofantico](https://it.wiktionary.org/w/index.php?title=apofantico&oldid=2829714) |
| 62449 | `potabilizzazioni` | noun | 0 | plurale di potabilizzazione | `potabilizzazione` | [potabilizzazioni](https://it.wiktionary.org/w/index.php?title=potabilizzazioni&oldid=3433069), [potabilizzazione](https://it.wiktionary.org/w/index.php?title=potabilizzazione&oldid=3029252) |
| 62542 | `inopinati` | adj | 0 | plurale di inopinato | `inopinato` | [inopinati](https://it.wiktionary.org/w/index.php?title=inopinati&oldid=3661521), [inopinato](https://it.wiktionary.org/w/index.php?title=inopinato&oldid=3621422) |
| 62543 | `inopinate` | adj | 0 | plurale femminile di inopinato | `inopinato` | [inopinate](https://it.wiktionary.org/w/index.php?title=inopinate&oldid=3414796), [inopinato](https://it.wiktionary.org/w/index.php?title=inopinato&oldid=3621422) |
| 62544 | `inopinata` | adj | 0 | femminile di inopinato | `inopinato` | [inopinata](https://it.wiktionary.org/w/index.php?title=inopinata&oldid=3414794), [inopinato](https://it.wiktionary.org/w/index.php?title=inopinato&oldid=3621422) |
| 62546 | `vincoli` | verb | 1 | prima persona singolare del congiuntivo presente di vincolare | `vincolare` | [vincoli](https://it.wiktionary.org/w/index.php?title=vincoli&oldid=4059394), [vincolare](https://it.wiktionary.org/w/index.php?title=vincolare&oldid=3839817) |
| 62546 | `vincoli` | verb | 2 | seconda persona singolare del congiuntivo presente di vincolare | `vincolare` | [vincoli](https://it.wiktionary.org/w/index.php?title=vincoli&oldid=4059394), [vincolare](https://it.wiktionary.org/w/index.php?title=vincolare&oldid=3839817) |
| 62546 | `vincoli` | verb | 3 | terza persona singolare del congiuntivo presente di vincolare | `vincolare` | [vincoli](https://it.wiktionary.org/w/index.php?title=vincoli&oldid=4059394), [vincolare](https://it.wiktionary.org/w/index.php?title=vincolare&oldid=3839817) |
| 62546 | `vincoli` | verb | 4 | terza persona singolare dell'imperativo presente di vincolare | `vincolare` | [vincoli](https://it.wiktionary.org/w/index.php?title=vincoli&oldid=4059394), [vincolare](https://it.wiktionary.org/w/index.php?title=vincolare&oldid=3839817) |
| 63122 | `bacilli` | noun | 0 | plurale di bacillo | `bacillo` | [bacilli](https://it.wiktionary.org/w/index.php?title=bacilli&oldid=3381998), [bacillo](https://it.wiktionary.org/w/index.php?title=bacillo&oldid=3898261) |
| 63841 | `rade` | noun | 0 | plurale di rada | `rada` | [rade](https://it.wiktionary.org/w/index.php?title=rade&oldid=3435633), [rada](https://it.wiktionary.org/w/index.php?title=rada&oldid=4035783) |
| 64227 | `acarofobie` | noun | 0 | plurale di acarofobia | `acarofobia` | [acarofobie](https://it.wiktionary.org/w/index.php?title=acarofobie&oldid=3369121), [acarofobia](https://it.wiktionary.org/w/index.php?title=acarofobia&oldid=3369120) |
| 64232 | `acrofobie` | noun | 0 | plurale di acrofobia | `acrofobia` | [acrofobie](https://it.wiktionary.org/w/index.php?title=acrofobie&oldid=3370716), [acrofobia](https://it.wiktionary.org/w/index.php?title=acrofobia&oldid=3817015) |
| 64312 | `aeroacrofobie` | noun | 0 | plurale di aeroacrofobia | `aeroacrofobia` | [aeroacrofobie](https://it.wiktionary.org/w/index.php?title=aeroacrofobie&oldid=3371315), [aeroacrofobia](https://it.wiktionary.org/w/index.php?title=aeroacrofobia&oldid=2814186) |
| 64498 | `fili` | verb | 1 | prima persona singolare del congiuntivo presente di filare | `filare` | [fili](https://it.wiktionary.org/w/index.php?title=fili&oldid=3933839), [filare](https://it.wiktionary.org/w/index.php?title=filare&oldid=4038882) |
| 64498 | `fili` | verb | 2 | seconda persona singolare del congiuntivo presente di filare | `filare` | [fili](https://it.wiktionary.org/w/index.php?title=fili&oldid=3933839), [filare](https://it.wiktionary.org/w/index.php?title=filare&oldid=4038882) |
| 64498 | `fili` | verb | 3 | terza persona singolare del congiuntivo presente di filare | `filare` | [fili](https://it.wiktionary.org/w/index.php?title=fili&oldid=3933839), [filare](https://it.wiktionary.org/w/index.php?title=filare&oldid=4038882) |
| 64498 | `fili` | verb | 4 | terza persona singolare dell'imperativo presente di filare | `filare` | [fili](https://it.wiktionary.org/w/index.php?title=fili&oldid=3933839), [filare](https://it.wiktionary.org/w/index.php?title=filare&oldid=4038882) |
| 64548 | `sali` | verb | 6 | seconda persona singolare dell'imperativo presente di salire | `salire` | [sali](https://it.wiktionary.org/w/index.php?title=sali&oldid=3800705), [salire](https://it.wiktionary.org/w/index.php?title=salire&oldid=3958977) |
| 64596 | `abbandonate` | verb | 1 | seconda persona plurale dell'indicativo presente di abbandonare | `abbandonare` | [abbandonate](https://it.wiktionary.org/w/index.php?title=abbandonate&oldid=3834804), [abbandonare](https://it.wiktionary.org/w/index.php?title=abbandonare&oldid=3964118) |
| 64596 | `abbandonate` | verb | 2 | seconda persona plurale dell'imperativo presente di abbandonare | `abbandonare` | [abbandonate](https://it.wiktionary.org/w/index.php?title=abbandonate&oldid=3834804), [abbandonare](https://it.wiktionary.org/w/index.php?title=abbandonare&oldid=3964118) |
| 64665 | `schiaffi` | verb | 0 | seconda persona singolare dell'indicativo presente di schiaffare | `schiaffare` | [schiaffi](https://it.wiktionary.org/w/index.php?title=schiaffi&oldid=4038793), [schiaffare](https://it.wiktionary.org/w/index.php?title=schiaffare&oldid=3649130) |
| 64665 | `schiaffi` | verb | 1 | prima persona singolare del congiuntivo presente di schiaffare | `schiaffare` | [schiaffi](https://it.wiktionary.org/w/index.php?title=schiaffi&oldid=4038793), [schiaffare](https://it.wiktionary.org/w/index.php?title=schiaffare&oldid=3649130) |
| 64665 | `schiaffi` | verb | 4 | terza persona singolare dell'imperativo presente di schiaffare | `schiaffare` | [schiaffi](https://it.wiktionary.org/w/index.php?title=schiaffi&oldid=4038793), [schiaffare](https://it.wiktionary.org/w/index.php?title=schiaffare&oldid=3649130) |
| 64779 | `Americhe` | name | 0 | plurale di America | `America` | [Americhe](https://it.wiktionary.org/w/index.php?title=Americhe&oldid=3834160), [America](https://it.wiktionary.org/w/index.php?title=America&oldid=4043196) |
| 64792 | `percosse` | verb | 0 | participio passato plurale femminile di percuotere | `percuotere` | [percosse](https://it.wiktionary.org/w/index.php?title=percosse&oldid=3868467), [percuotere](https://it.wiktionary.org/w/index.php?title=percuotere&oldid=3900549) |
| 64935 | `incollature` | noun | 0 | plurale di incollatura | `incollatura` | [incollature](https://it.wiktionary.org/w/index.php?title=incollature&oldid=3641234), [incollatura](https://it.wiktionary.org/w/index.php?title=incollatura&oldid=3807929) |
| 64970 | `numeri` | verb | 1 | prima persona singolare del congiuntivo presente di numerare | `numerare` | [numeri](https://it.wiktionary.org/w/index.php?title=numeri&oldid=4037513), [numerare](https://it.wiktionary.org/w/index.php?title=numerare&oldid=3602412) |
| 64970 | `numeri` | verb | 2 | seconda persona singolare del congiuntivo presente di numerare | `numerare` | [numeri](https://it.wiktionary.org/w/index.php?title=numeri&oldid=4037513), [numerare](https://it.wiktionary.org/w/index.php?title=numerare&oldid=3602412) |
| 64970 | `numeri` | verb | 3 | terza persona singolare del congiuntivo presente di numerare | `numerare` | [numeri](https://it.wiktionary.org/w/index.php?title=numeri&oldid=4037513), [numerare](https://it.wiktionary.org/w/index.php?title=numerare&oldid=3602412) |
| 64970 | `numeri` | verb | 4 | terza persona singolare dell'imperativo presente di numerare | `numerare` | [numeri](https://it.wiktionary.org/w/index.php?title=numeri&oldid=4037513), [numerare](https://it.wiktionary.org/w/index.php?title=numerare&oldid=3602412) |
| 65007 | `lucidi` | verb | 0 | seconda persona singolare dell'indicativo presente di lucidare | `lucidare` | [lucidi](https://it.wiktionary.org/w/index.php?title=lucidi&oldid=3937542), [lucidare](https://it.wiktionary.org/w/index.php?title=lucidare&oldid=3927531) |
| 65007 | `lucidi` | verb | 1 | prima persona singolare del congiuntivo presente di lucidare | `lucidare` | [lucidi](https://it.wiktionary.org/w/index.php?title=lucidi&oldid=3937542), [lucidare](https://it.wiktionary.org/w/index.php?title=lucidare&oldid=3927531) |
| 65007 | `lucidi` | verb | 2 | seconda persona singolare del congiuntivo presente di lucidare | `lucidare` | [lucidi](https://it.wiktionary.org/w/index.php?title=lucidi&oldid=3937542), [lucidare](https://it.wiktionary.org/w/index.php?title=lucidare&oldid=3927531) |
| 65007 | `lucidi` | verb | 3 | terza persona singolare del congiuntivo presente di lucidare | `lucidare` | [lucidi](https://it.wiktionary.org/w/index.php?title=lucidi&oldid=3937542), [lucidare](https://it.wiktionary.org/w/index.php?title=lucidare&oldid=3927531) |
| 65007 | `lucidi` | verb | 4 | terza persona singolare dell'imperativo presente di lucidare | `lucidare` | [lucidi](https://it.wiktionary.org/w/index.php?title=lucidi&oldid=3937542), [lucidare](https://it.wiktionary.org/w/index.php?title=lucidare&oldid=3927531) |
| 65402 | `argomenti` | verb | 1 | prima persona singolare del congiuntivo presente di argomentare | `argomentare` | [argomenti](https://it.wiktionary.org/w/index.php?title=argomenti&oldid=3960650), [argomentare](https://it.wiktionary.org/w/index.php?title=argomentare&oldid=4039628) |
| 65402 | `argomenti` | verb | 2 | seconda persona singolare del congiuntivo presente di argomentare | `argomentare` | [argomenti](https://it.wiktionary.org/w/index.php?title=argomenti&oldid=3960650), [argomentare](https://it.wiktionary.org/w/index.php?title=argomentare&oldid=4039628) |
| 65402 | `argomenti` | verb | 3 | terza persona singolare del congiuntivo presente di argomentare | `argomentare` | [argomenti](https://it.wiktionary.org/w/index.php?title=argomenti&oldid=3960650), [argomentare](https://it.wiktionary.org/w/index.php?title=argomentare&oldid=4039628) |
| 65402 | `argomenti` | verb | 4 | terza persona singolare dell'imperativo presente di argomentare | `argomentare` | [argomenti](https://it.wiktionary.org/w/index.php?title=argomenti&oldid=3960650), [argomentare](https://it.wiktionary.org/w/index.php?title=argomentare&oldid=4039628) |
| 65415 | `diversi` | verb | 0 | prima persona singolare dell'indicativo passato remoto di divergere | `divergere` | [diversi](https://it.wiktionary.org/w/index.php?title=diversi&oldid=3969110), [divergere](https://it.wiktionary.org/w/index.php?title=divergere&oldid=3904871) |
| 65417 | `questi` | pron | 0 | plurale di questo | `questo` | [questi](https://it.wiktionary.org/w/index.php?title=questi&oldid=3992433), [questo](https://it.wiktionary.org/w/index.php?title=questo&oldid=3892270) |
| 65420 | `sospetti` | verb | 1 | prima persona singolare del congiuntivo presente di sospettare | `sospettare` | [sospetti](https://it.wiktionary.org/w/index.php?title=sospetti&oldid=3982598), [sospettare](https://it.wiktionary.org/w/index.php?title=sospettare&oldid=3778393) |
| 65420 | `sospetti` | verb | 2 | seconda persona singolare del congiuntivo presente di sospettare | `sospettare` | [sospetti](https://it.wiktionary.org/w/index.php?title=sospetti&oldid=3982598), [sospettare](https://it.wiktionary.org/w/index.php?title=sospettare&oldid=3778393) |
| 65420 | `sospetti` | verb | 3 | terza persona singolare del congiuntivo presente di sospettare | `sospettare` | [sospetti](https://it.wiktionary.org/w/index.php?title=sospetti&oldid=3982598), [sospettare](https://it.wiktionary.org/w/index.php?title=sospettare&oldid=3778393) |
| 65420 | `sospetti` | verb | 4 | terza persona singolare dell'imperativo presente di sospettare | `sospettare` | [sospetti](https://it.wiktionary.org/w/index.php?title=sospetti&oldid=3982598), [sospettare](https://it.wiktionary.org/w/index.php?title=sospettare&oldid=3778393) |
| 69055 | `accecato` | verb | 0 | participio passato di accecare | `accecare` | [accecato](https://it.wiktionary.org/w/index.php?title=accecato&oldid=3970914), [accecare](https://it.wiktionary.org/w/index.php?title=accecare&oldid=3969667) |
| 69113 | `selvatici` | adj | 0 | plurale di selvatico | `selvatico` | [selvatici](https://it.wiktionary.org/w/index.php?title=selvatici&oldid=3858882), [selvatico](https://it.wiktionary.org/w/index.php?title=selvatico&oldid=3962088) |
| 69145 | `sporchi` | adj | 0 | plurale di sporco | `sporco` | [sporchi](https://it.wiktionary.org/w/index.php?title=sporchi&oldid=3868856), [sporco](https://it.wiktionary.org/w/index.php?title=sporco&oldid=4009279) |
| 69147 | `aerei` | noun | 0 | plurale di aereo | `aereo` | [aerei](https://it.wiktionary.org/w/index.php?title=aerei&oldid=4016979), [aereo](https://it.wiktionary.org/w/index.php?title=aereo&oldid=3963800) |
| 69658 | `idiopatica` | adj | 0 | femminile di idiopatico | `idiopatico` | [idiopatica](https://it.wiktionary.org/w/index.php?title=idiopatica&oldid=3412102), [idiopatico](https://it.wiktionary.org/w/index.php?title=idiopatico&oldid=3920162) |
| 69706 | `bruciata` | adj | 0 | femminile singolare di bruciato | `bruciato` | [bruciata](https://it.wiktionary.org/w/index.php?title=bruciata&oldid=3896235), [bruciato](https://it.wiktionary.org/w/index.php?title=bruciato&oldid=4062063) |
| 70011 | `spazi` | verb | 1 | prima persona singolare del congiuntivo presente di spaziare | `spaziare` | [spazi](https://it.wiktionary.org/w/index.php?title=spazi&oldid=4066499), [spaziare](https://it.wiktionary.org/w/index.php?title=spaziare&oldid=3901233) |
| 70011 | `spazi` | verb | 2 | seconda persona singolare del congiuntivo presente di spaziare | `spaziare` | [spazi](https://it.wiktionary.org/w/index.php?title=spazi&oldid=4066499), [spaziare](https://it.wiktionary.org/w/index.php?title=spaziare&oldid=3901233) |
| 70011 | `spazi` | verb | 3 | terza persona singolare del congiuntivo presente di spaziare | `spaziare` | [spazi](https://it.wiktionary.org/w/index.php?title=spazi&oldid=4066499), [spaziare](https://it.wiktionary.org/w/index.php?title=spaziare&oldid=3901233) |
| 70011 | `spazi` | verb | 4 | terza persona singolare dell'imperativo presente di spaziare | `spaziare` | [spazi](https://it.wiktionary.org/w/index.php?title=spazi&oldid=4066499), [spaziare](https://it.wiktionary.org/w/index.php?title=spaziare&oldid=3901233) |
| 70288 | `galoppino` | verb | 1 | terza persona plurale dell'imperativo presente di galoppare | `galoppare` | [galoppino](https://it.wiktionary.org/w/index.php?title=galoppino&oldid=4076597), [galoppare](https://it.wiktionary.org/w/index.php?title=galoppare&oldid=4060750) |
| 70294 | `aree` | noun | 0 | plurale di area | `area` | [aree](https://it.wiktionary.org/w/index.php?title=aree&oldid=3379028), [area](https://it.wiktionary.org/w/index.php?title=area&oldid=3965544) |
| 70306 | `banani` | noun | 0 | plurale di banano | `banano` | [banani](https://it.wiktionary.org/w/index.php?title=banani&oldid=3382346), [banano](https://it.wiktionary.org/w/index.php?title=banano&oldid=4023270) |
| 70581 | `quadri` | verb | 2 | seconda persona singolare del congiuntivo presente di quadrare | `quadrare` | [quadri](https://it.wiktionary.org/w/index.php?title=quadri&oldid=4070645), [quadrare](https://it.wiktionary.org/w/index.php?title=quadrare&oldid=4042447) |
| 70739 | `vernici` | verb | 1 | prima persona singolare del congiuntivo presente di verniciare | `verniciare` | [vernici](https://it.wiktionary.org/w/index.php?title=vernici&oldid=3838173), [verniciare](https://it.wiktionary.org/w/index.php?title=verniciare&oldid=3906107) |
| 70739 | `vernici` | verb | 2 | seconda persona singolare del congiuntivo presente di verniciare | `verniciare` | [vernici](https://it.wiktionary.org/w/index.php?title=vernici&oldid=3838173), [verniciare](https://it.wiktionary.org/w/index.php?title=verniciare&oldid=3906107) |
| 70739 | `vernici` | verb | 3 | terza persona singolare del congiuntivo presente di verniciare | `verniciare` | [vernici](https://it.wiktionary.org/w/index.php?title=vernici&oldid=3838173), [verniciare](https://it.wiktionary.org/w/index.php?title=verniciare&oldid=3906107) |
| 70739 | `vernici` | verb | 4 | terza persona singolare dell'imperativo presente di verniciare | `verniciare` | [vernici](https://it.wiktionary.org/w/index.php?title=vernici&oldid=3838173), [verniciare](https://it.wiktionary.org/w/index.php?title=verniciare&oldid=3906107) |
| 71558 | `modulatori` | noun | 0 | plurale di modulatore | `modulatore` | [modulatori](https://it.wiktionary.org/w/index.php?title=modulatori&oldid=3001719), [modulatore](https://it.wiktionary.org/w/index.php?title=modulatore&oldid=3809682) |
| 71564 | `abbaiante` | verb | 0 | participio presente di abbaiare | `abbaiare` | [abbaiante](https://it.wiktionary.org/w/index.php?title=abbaiante&oldid=3365789), [abbaiare](https://it.wiktionary.org/w/index.php?title=abbaiare&oldid=4042415) |
| 71567 | `abbaiato` | verb | 0 | participio passato di abbaiare | `abbaiare` | [abbaiato](https://it.wiktionary.org/w/index.php?title=abbaiato&oldid=2800209), [abbaiare](https://it.wiktionary.org/w/index.php?title=abbaiare&oldid=4042415) |
| 71576 | `abballato` | verb | 0 | participio passato di abballare | `abballare` | [abballato](https://it.wiktionary.org/w/index.php?title=abballato&oldid=3365814), [abballare](https://it.wiktionary.org/w/index.php?title=abballare&oldid=3625924) |
| 71975 | `ubriachi` | verb | 1 | prima persona singolare del congiuntivo presente di ubriacare | `ubriacare` | [ubriachi](https://it.wiktionary.org/w/index.php?title=ubriachi&oldid=3850264), [ubriacare](https://it.wiktionary.org/w/index.php?title=ubriacare&oldid=3949360) |
| 71975 | `ubriachi` | verb | 2 | seconda persona singolare del congiuntivo presente di ubriacare | `ubriacare` | [ubriachi](https://it.wiktionary.org/w/index.php?title=ubriachi&oldid=3850264), [ubriacare](https://it.wiktionary.org/w/index.php?title=ubriacare&oldid=3949360) |
| 71975 | `ubriachi` | verb | 3 | terza persona singolare del congiuntivo presente di ubriacare | `ubriacare` | [ubriachi](https://it.wiktionary.org/w/index.php?title=ubriachi&oldid=3850264), [ubriacare](https://it.wiktionary.org/w/index.php?title=ubriacare&oldid=3949360) |
| 72114 | `catapulta` | verb | 0 | terza persona singolare dell'indicativo presente di catapultare | `catapultare` | [catapulta](https://it.wiktionary.org/w/index.php?title=catapulta&oldid=3896310), [catapultare](https://it.wiktionary.org/w/index.php?title=catapultare&oldid=3389189) |
| 72354 | `acrobazie` | noun | 0 | plurale di acrobazia | `acrobazia` | [acrobazie](https://it.wiktionary.org/w/index.php?title=acrobazie&oldid=3370715), [acrobazia](https://it.wiktionary.org/w/index.php?title=acrobazia&oldid=4019614) |
| 72380 | `sferoscopi` | noun | 0 | plurale di sferoscopio | `sferoscopio` | [sferoscopi](https://it.wiktionary.org/w/index.php?title=sferoscopi&oldid=3098804), [sferoscopio](https://it.wiktionary.org/w/index.php?title=sferoscopio&oldid=3098805) |
| 72381 | `punti` | adj | 0 | plurale di punto | `punto` | [punti](https://it.wiktionary.org/w/index.php?title=punti&oldid=4053272), [punto](https://it.wiktionary.org/w/index.php?title=punto&oldid=4037022) |
| 72383 | `punti` | verb | 1 | prima persona singolare del congiuntivo presente di puntare | `puntare` | [punti](https://it.wiktionary.org/w/index.php?title=punti&oldid=4053272), [puntare](https://it.wiktionary.org/w/index.php?title=puntare&oldid=3946217) |
| 72383 | `punti` | verb | 2 | seconda persona singolare del congiuntivo presente di puntare | `puntare` | [punti](https://it.wiktionary.org/w/index.php?title=punti&oldid=4053272), [puntare](https://it.wiktionary.org/w/index.php?title=puntare&oldid=3946217) |
| 72383 | `punti` | verb | 3 | terza persona singolare del congiuntivo presente di puntare | `puntare` | [punti](https://it.wiktionary.org/w/index.php?title=punti&oldid=4053272), [puntare](https://it.wiktionary.org/w/index.php?title=puntare&oldid=3946217) |
| 72383 | `punti` | verb | 4 | terza persona singolare dell'imperativo presente di puntare | `puntare` | [punti](https://it.wiktionary.org/w/index.php?title=punti&oldid=4053272), [puntare](https://it.wiktionary.org/w/index.php?title=puntare&oldid=3946217) |
| 72387 | `recidivi` | adj | 0 | plurale di recidivo | `recidivo` | [recidivi](https://it.wiktionary.org/w/index.php?title=recidivi&oldid=3436436), [recidivo](https://it.wiktionary.org/w/index.php?title=recidivo&oldid=3896333) |
| 72388 | `recidivi` | noun | 0 | plurale di recidivo | `recidivo` | [recidivi](https://it.wiktionary.org/w/index.php?title=recidivi&oldid=3436436), [recidivo](https://it.wiktionary.org/w/index.php?title=recidivo&oldid=3896333) |
| 72391 | `recidive` | adj | 0 | femminile plurale di recidivo | `recidivo` | [recidive](https://it.wiktionary.org/w/index.php?title=recidive&oldid=3436435), [recidivo](https://it.wiktionary.org/w/index.php?title=recidivo&oldid=3896333) |
| 72392 | `recidive` | noun | 0 | femminile plurale di recidivo | `recidivo` | [recidive](https://it.wiktionary.org/w/index.php?title=recidive&oldid=3436435), [recidivo](https://it.wiktionary.org/w/index.php?title=recidivo&oldid=3896333) |
| 72456 | `verdi` | noun | 0 | plurale di verde | `verde` | [verdi](https://it.wiktionary.org/w/index.php?title=verdi&oldid=3587515), [verde](https://it.wiktionary.org/w/index.php?title=verde&oldid=4067992) |
| 72534 | `ave` | noun | 0 | femminile plurale di avo | `avo` | [ave](https://it.wiktionary.org/w/index.php?title=ave&oldid=4076149), [avo](https://it.wiktionary.org/w/index.php?title=avo&oldid=3955227) |
| 72831 | `sa` | verb | 0 | terza persona singolare dell'indicativo presente di sapere | `sapere` | [sa](https://it.wiktionary.org/w/index.php?title=sa&oldid=3957275), [sapere](https://it.wiktionary.org/w/index.php?title=sapere&oldid=4066625) |
| 72939 | `assilli` | verb | 2 | seconda persona singolare del congiuntivo presente di assillare | `assillare` | [assilli](https://it.wiktionary.org/w/index.php?title=assilli&oldid=3865498), [assillare](https://it.wiktionary.org/w/index.php?title=assillare&oldid=3493427) |
| 72939 | `assilli` | verb | 3 | terza persona singolare del congiuntivo presente di assillare | `assillare` | [assilli](https://it.wiktionary.org/w/index.php?title=assilli&oldid=3865498), [assillare](https://it.wiktionary.org/w/index.php?title=assillare&oldid=3493427) |
| 72939 | `assilli` | verb | 4 | terza persona singolare dell'imperativo presente di assillare | `assillare` | [assilli](https://it.wiktionary.org/w/index.php?title=assilli&oldid=3865498), [assillare](https://it.wiktionary.org/w/index.php?title=assillare&oldid=3493427) |
| 73180 | `idiopatici` | adj | 0 | plurale di idiopatico | `idiopatico` | [idiopatici](https://it.wiktionary.org/w/index.php?title=idiopatici&oldid=3412104), [idiopatico](https://it.wiktionary.org/w/index.php?title=idiopatico&oldid=3920162) |
| 73181 | `idiopatiche` | adj | 0 | femminile plurale di idiopatico | `idiopatico` | [idiopatiche](https://it.wiktionary.org/w/index.php?title=idiopatiche&oldid=3412103), [idiopatico](https://it.wiktionary.org/w/index.php?title=idiopatico&oldid=3920162) |
| 73186 | `tracotanti` | noun | 0 | plurale di tracotante | `tracotante` | [tracotanti](https://it.wiktionary.org/w/index.php?title=tracotanti&oldid=3143021), [tracotante](https://it.wiktionary.org/w/index.php?title=tracotante&oldid=4070905) |
| 73452 | `abbatuffolato` | adj | 0 | participio passato di abbatuffolare | `abbatuffolare` | [abbatuffolato](https://it.wiktionary.org/w/index.php?title=abbatuffolato&oldid=2801018), [abbatuffolare](https://it.wiktionary.org/w/index.php?title=abbatuffolare&oldid=3366028) |
| 73638 | `gromme` | noun | 0 | plurale di gromma | `gromma` | [gromme](https://it.wiktionary.org/w/index.php?title=gromme&oldid=3410248), [gromma](https://it.wiktionary.org/w/index.php?title=gromma&oldid=3896408) |
| 73641 | `grommosi` | adj | 0 | plurale di grommoso | `grommoso` | [grommosi](https://it.wiktionary.org/w/index.php?title=grommosi&oldid=3410251), [grommoso](https://it.wiktionary.org/w/index.php?title=grommoso&oldid=3410252) |
| 73642 | `grommosa` | adj | 0 | femminile di grommoso | `grommoso` | [grommosa](https://it.wiktionary.org/w/index.php?title=grommosa&oldid=3410249), [grommoso](https://it.wiktionary.org/w/index.php?title=grommoso&oldid=3410252) |
| 73643 | `grommose` | adj | 0 | femminile plurale di grommoso | `grommoso` | [grommose](https://it.wiktionary.org/w/index.php?title=grommose&oldid=3410250), [grommoso](https://it.wiktionary.org/w/index.php?title=grommoso&oldid=3410252) |
| 73645 | `legazioni` | noun | 0 | plurale di legazione | `legazione` | [legazioni](https://it.wiktionary.org/w/index.php?title=legazioni&oldid=3419089), [legazione](https://it.wiktionary.org/w/index.php?title=legazione&oldid=3968812) |
| 73646 | `ridanciani` | adj | 0 | plurale di ridanciano | `ridanciano` | [ridanciani](https://it.wiktionary.org/w/index.php?title=ridanciani&oldid=3437355), [ridanciano](https://it.wiktionary.org/w/index.php?title=ridanciano&oldid=3893142) |
| 73647 | `ridanciana` | adj | 0 | femminile di ridanciano | `ridanciano` | [ridanciana](https://it.wiktionary.org/w/index.php?title=ridanciana&oldid=3437353), [ridanciano](https://it.wiktionary.org/w/index.php?title=ridanciano&oldid=3893142) |
| 73648 | `ridanciane` | adj | 0 | femminile plurale di ridanciano | `ridanciano` | [ridanciane](https://it.wiktionary.org/w/index.php?title=ridanciane&oldid=3437354), [ridanciano](https://it.wiktionary.org/w/index.php?title=ridanciano&oldid=3893142) |
| 73830 | `addendi` | noun | 0 | plurale di addendo | `addendo` | [addendi](https://it.wiktionary.org/w/index.php?title=addendi&oldid=3370906), [addendo](https://it.wiktionary.org/w/index.php?title=addendo&oldid=4046601) |
| 73831 | `eliografie` | noun | 0 | plurale di eliografia | `eliografia` | [eliografie](https://it.wiktionary.org/w/index.php?title=eliografie&oldid=3401052), [eliografia](https://it.wiktionary.org/w/index.php?title=eliografia&oldid=3896423) |
| 73833 | `quintettistici` | adj | 0 | plurale di quintettistico | `quintettistico` | [quintettistici](https://it.wiktionary.org/w/index.php?title=quintettistici&oldid=3435511), [quintettistico](https://it.wiktionary.org/w/index.php?title=quintettistico&oldid=3040156) |
| 73834 | `quintettistica` | adj | 0 | femminile di quintettistico | `quintettistico` | [quintettistica](https://it.wiktionary.org/w/index.php?title=quintettistica&oldid=3435509), [quintettistico](https://it.wiktionary.org/w/index.php?title=quintettistico&oldid=3040156) |
| 73835 | `quintettistiche` | adj | 0 | femminile plurale di quintettistico | `quintettistico` | [quintettistiche](https://it.wiktionary.org/w/index.php?title=quintettistiche&oldid=3435510), [quintettistico](https://it.wiktionary.org/w/index.php?title=quintettistico&oldid=3040156) |
| 73837 | `quintetti` | noun | 0 | plurale di quintetto | `quintetto` | [quintetti](https://it.wiktionary.org/w/index.php?title=quintetti&oldid=3435508), [quintetto](https://it.wiktionary.org/w/index.php?title=quintetto&oldid=4017336) |
| 73839 | `comandoli` | noun | 0 | plurale di comandolo | `comandolo` | [comandoli](https://it.wiktionary.org/w/index.php?title=comandoli&oldid=3392383), [comandolo](https://it.wiktionary.org/w/index.php?title=comandolo&oldid=3392384) |
| 74055 | `obbrobri` | noun | 0 | plurale di obbrobrio | `obbrobrio` | [obbrobri](https://it.wiktionary.org/w/index.php?title=obbrobri&oldid=3427134), [obbrobrio](https://it.wiktionary.org/w/index.php?title=obbrobrio&oldid=3896439) |
| 74189 | `esistenzialismi` | noun | 0 | plurale di esistenzialismo | `esistenzialismo` | [esistenzialismi](https://it.wiktionary.org/w/index.php?title=esistenzialismi&oldid=3919096), [esistenzialismo](https://it.wiktionary.org/w/index.php?title=esistenzialismo&oldid=3963530) |
| 74206 | `biciclette` | noun | 0 | plurale di bicicletta | `bicicletta` | [biciclette](https://it.wiktionary.org/w/index.php?title=biciclette&oldid=3829441), [bicicletta](https://it.wiktionary.org/w/index.php?title=bicicletta&oldid=4027334) |
| 74207 | `esopianeti` | noun | 0 | plurale di esopianeta | `esopianeta` | [esopianeti](https://it.wiktionary.org/w/index.php?title=esopianeti&oldid=3402921), [esopianeta](https://it.wiktionary.org/w/index.php?title=esopianeta&oldid=3956521) |
| 74210 | `nebulose` | noun | 0 | plurale di nebulosa | `nebulosa` | [nebulose](https://it.wiktionary.org/w/index.php?title=nebulose&oldid=3425816), [nebulosa](https://it.wiktionary.org/w/index.php?title=nebulosa&oldid=4061552) |
| 74373 | `amebei` | noun | 0 | plurale di amebeo | `amebeo` | [amebei](https://it.wiktionary.org/w/index.php?title=amebei&oldid=3374306), [amebeo](https://it.wiktionary.org/w/index.php?title=amebeo&oldid=2823216) |
| 74374 | `manovrabili` | adj | 0 | plurale di manovrabile | `manovrabile` | [manovrabili](https://it.wiktionary.org/w/index.php?title=manovrabili&oldid=3421703), [manovrabile](https://it.wiktionary.org/w/index.php?title=manovrabile&oldid=3643598) |
| 74375 | `borseggiatori` | noun | 0 | plurale di borseggiatore | `borseggiatore` | [borseggiatori](https://it.wiktionary.org/w/index.php?title=borseggiatori&oldid=3385705), [borseggiatore](https://it.wiktionary.org/w/index.php?title=borseggiatore&oldid=3895981) |
| 74377 | `borseggiatrici` | noun | 0 | femminile plurale di borseggiatore | `borseggiatore` | [borseggiatrici](https://it.wiktionary.org/w/index.php?title=borseggiatrici&oldid=3385707), [borseggiatore](https://it.wiktionary.org/w/index.php?title=borseggiatore&oldid=3895981) |
| 74568 | `umidi` | adj | 0 | plurale di umido | `umido` | [umidi](https://it.wiktionary.org/w/index.php?title=umidi&oldid=3449321), [umido](https://it.wiktionary.org/w/index.php?title=umido&oldid=3896459) |
| 74845 | `agrafie` | noun | 0 | plurale di agrafia | `agrafia` | [agrafie](https://it.wiktionary.org/w/index.php?title=agrafie&oldid=3372462), [agrafia](https://it.wiktionary.org/w/index.php?title=agrafia&oldid=3896464) |
| 75105 | `suoi` | adj | 0 | maschile plurale di suo | `suo` | [suoi](https://it.wiktionary.org/w/index.php?title=suoi&oldid=3896468), [suo](https://it.wiktionary.org/w/index.php?title=suo&oldid=3952240) |
| 75106 | `suoi` | pron | 0 | maschile plurale di suo | `suo` | [suoi](https://it.wiktionary.org/w/index.php?title=suoi&oldid=3896468), [suo](https://it.wiktionary.org/w/index.php?title=suo&oldid=3952240) |
| 75438 | `senatrice` | noun | 0 | femminile di senatore | `senatore` | [senatrice](https://it.wiktionary.org/w/index.php?title=senatrice&oldid=3875945), [senatore](https://it.wiktionary.org/w/index.php?title=senatore&oldid=3895189) |
| 75451 | `creativi` | adj | 0 | plurale di creativo | `creativo` | [creativi](https://it.wiktionary.org/w/index.php?title=creativi&oldid=3394750), [creativo](https://it.wiktionary.org/w/index.php?title=creativo&oldid=4040262) |
| 75543 | `furieri` | noun | 0 | plurale di furiere | `furiere` | [furieri](https://it.wiktionary.org/w/index.php?title=furieri&oldid=3407417), [furiere](https://it.wiktionary.org/w/index.php?title=furiere&oldid=3407416) |
| 76834 | `pagnotte` | noun | 0 | plurale di pagnotta | `pagnotta` | [pagnotte](https://it.wiktionary.org/w/index.php?title=pagnotte&oldid=3429222), [pagnotta](https://it.wiktionary.org/w/index.php?title=pagnotta&oldid=3645442) |
| 76948 | `nuore` | noun | 0 | plurale di nuora | `nuora` | [nuore](https://it.wiktionary.org/w/index.php?title=nuore&oldid=3008899), [nuora](https://it.wiktionary.org/w/index.php?title=nuora&oldid=3644903) |
| 76963 | `enchiridi` | noun | 0 | plurale di enchiridio | `enchiridio` | [enchiridi](https://it.wiktionary.org/w/index.php?title=enchiridi&oldid=3401531), [enchiridio](https://it.wiktionary.org/w/index.php?title=enchiridio&oldid=2918229) |
| 76965 | `encicliche` | noun | 0 | plurale di enciclica | `enciclica` | [encicliche](https://it.wiktionary.org/w/index.php?title=encicliche&oldid=3401533), [enciclica](https://it.wiktionary.org/w/index.php?title=enciclica&oldid=4049951) |
| 76967 | `enciclici` | adj | 0 | plurale di enciclico | `enciclico` | [enciclici](https://it.wiktionary.org/w/index.php?title=enciclici&oldid=3401534), [enciclico](https://it.wiktionary.org/w/index.php?title=enciclico&oldid=2918233) |
| 77168 | `surrettizia` | adj | 0 | femminile di surrettizio | `surrettizio` | [surrettizia](https://it.wiktionary.org/w/index.php?title=surrettizia&oldid=3174054), [surrettizio](https://it.wiktionary.org/w/index.php?title=surrettizio&oldid=3896511) |
| 78478 | `beveratoi` | noun | 0 | plurale di beveratoio | `beveratoio` | [beveratoi](https://it.wiktionary.org/w/index.php?title=beveratoi&oldid=3384116), [beveratoio](https://it.wiktionary.org/w/index.php?title=beveratoio&oldid=3594248) |
| 78483 | `osteologi` | noun | 0 | plurale di osteologo | `osteologo` | [osteologi](https://it.wiktionary.org/w/index.php?title=osteologi&oldid=3428742), [osteologo](https://it.wiktionary.org/w/index.php?title=osteologo&oldid=3895929) |
| 78485 | `osteologie` | noun | 0 | plurale di osteologia | `osteologia` | [osteologie](https://it.wiktionary.org/w/index.php?title=osteologie&oldid=3428744), [osteologia](https://it.wiktionary.org/w/index.php?title=osteologia&oldid=3972188) |
| 78632 | `posti` | verb | 2 | prima persona singolare del congiuntivo presente di postare | `postare` | [posti](https://it.wiktionary.org/w/index.php?title=posti&oldid=3991124), [postare](https://it.wiktionary.org/w/index.php?title=postare&oldid=3841682) |
| 78632 | `posti` | verb | 3 | seconda persona singolare del congiuntivo presente di postare | `postare` | [posti](https://it.wiktionary.org/w/index.php?title=posti&oldid=3991124), [postare](https://it.wiktionary.org/w/index.php?title=postare&oldid=3841682) |
| 78632 | `posti` | verb | 4 | terza persona singolare del congiuntivo presente di postare | `postare` | [posti](https://it.wiktionary.org/w/index.php?title=posti&oldid=3991124), [postare](https://it.wiktionary.org/w/index.php?title=postare&oldid=3841682) |
| 78632 | `posti` | verb | 5 | terza persona singolare dell'imperativo presente di postare | `postare` | [posti](https://it.wiktionary.org/w/index.php?title=posti&oldid=3991124), [postare](https://it.wiktionary.org/w/index.php?title=postare&oldid=3841682) |
| 78775 | `abiti` | verb | 4 | terza persona singolare dell'imperativo presente di abitare | `abitare` | [abiti](https://it.wiktionary.org/w/index.php?title=abiti&oldid=4016969), [abitare](https://it.wiktionary.org/w/index.php?title=abitare&oldid=3973250) |
| 78778 | `settentrioni` | noun | 0 | plurale di settentrione | `settentrione` | [settentrioni](https://it.wiktionary.org/w/index.php?title=settentrioni&oldid=3097783), [settentrione](https://it.wiktionary.org/w/index.php?title=settentrione&oldid=3895201) |
| 78788 | `logorroici` | noun | 0 | plurale di logorroico | `logorroico` | [logorroici](https://it.wiktionary.org/w/index.php?title=logorroici&oldid=3228928), [logorroico](https://it.wiktionary.org/w/index.php?title=logorroico&oldid=4049081) |
| 78790 | `logorroica` | noun | 0 | femminile di logorroico | `logorroico` | [logorroica](https://it.wiktionary.org/w/index.php?title=logorroica&oldid=3228927), [logorroico](https://it.wiktionary.org/w/index.php?title=logorroico&oldid=4049081) |
| 79607 | `agevolate` | verb | 1 | seconda persona plurale dell'indicativo presente di agevolare | `agevolare` | [agevolate](https://it.wiktionary.org/w/index.php?title=agevolate&oldid=3834870), [agevolare](https://it.wiktionary.org/w/index.php?title=agevolare&oldid=3893371) |
| 79641 | `abbiadato` | adj | 0 | participio passato di abbiadare | `abbiadare` | [abbiadato](https://it.wiktionary.org/w/index.php?title=abbiadato&oldid=2801232), [abbiadare](https://it.wiktionary.org/w/index.php?title=abbiadare&oldid=3366087) |
| 79643 | `abbicato` | adj | 0 | participio passato di abbicare | `abbicare` | [abbicato](https://it.wiktionary.org/w/index.php?title=abbicato&oldid=2801282), [abbicare](https://it.wiktionary.org/w/index.php?title=abbicare&oldid=3366098) |
| 79647 | `abbigliato` | adj | 0 | participio passato di abbigliare | `abbigliare` | [abbigliato](https://it.wiktionary.org/w/index.php?title=abbigliato&oldid=2801351), [abbigliare](https://it.wiktionary.org/w/index.php?title=abbigliare&oldid=3969214) |
| 79907 | `dialoghi` | verb | 1 | prima persona singolare del congiuntivo presente di dialogare | `dialogare` | [dialoghi](https://it.wiktionary.org/w/index.php?title=dialoghi&oldid=3970733), [dialogare](https://it.wiktionary.org/w/index.php?title=dialogare&oldid=3973604) |
| 79907 | `dialoghi` | verb | 2 | seconda persona singolare del congiuntivo presente di dialogare | `dialogare` | [dialoghi](https://it.wiktionary.org/w/index.php?title=dialoghi&oldid=3970733), [dialogare](https://it.wiktionary.org/w/index.php?title=dialogare&oldid=3973604) |
| 79907 | `dialoghi` | verb | 3 | terza persona singolare del congiuntivo presente di dialogare | `dialogare` | [dialoghi](https://it.wiktionary.org/w/index.php?title=dialoghi&oldid=3970733), [dialogare](https://it.wiktionary.org/w/index.php?title=dialogare&oldid=3973604) |
| 79907 | `dialoghi` | verb | 4 | terza persona singolare dell'imperativo presente di dialogare | `dialogare` | [dialoghi](https://it.wiktionary.org/w/index.php?title=dialoghi&oldid=3970733), [dialogare](https://it.wiktionary.org/w/index.php?title=dialogare&oldid=3973604) |
| 79967 | `tumuli` | verb | 1 | prima persona singolare del congiuntivo presente di tumulare | `tumulare` | [tumuli](https://it.wiktionary.org/w/index.php?title=tumuli&oldid=3838074), [tumulare](https://it.wiktionary.org/w/index.php?title=tumulare&oldid=3985839) |
| 79967 | `tumuli` | verb | 2 | seconda persona singolare del congiuntivo presente di tumulare | `tumulare` | [tumuli](https://it.wiktionary.org/w/index.php?title=tumuli&oldid=3838074), [tumulare](https://it.wiktionary.org/w/index.php?title=tumulare&oldid=3985839) |
| 79967 | `tumuli` | verb | 3 | terza persona singolare del congiuntivo presente di tumulare | `tumulare` | [tumuli](https://it.wiktionary.org/w/index.php?title=tumuli&oldid=3838074), [tumulare](https://it.wiktionary.org/w/index.php?title=tumulare&oldid=3985839) |
| 79967 | `tumuli` | verb | 4 | terza persona singolare dell'imperativo presente di tumulare | `tumulare` | [tumuli](https://it.wiktionary.org/w/index.php?title=tumuli&oldid=3838074), [tumulare](https://it.wiktionary.org/w/index.php?title=tumulare&oldid=3985839) |
| 80182 | `apparecchi` | verb | 1 | prima persona singolare del congiuntivo presente di apparecchiare | `apparecchiare` | [apparecchi](https://it.wiktionary.org/w/index.php?title=apparecchi&oldid=3945692), [apparecchiare](https://it.wiktionary.org/w/index.php?title=apparecchiare&oldid=3930713) |
| 80182 | `apparecchi` | verb | 2 | seconda persona singolare del congiuntivo presente di apparecchiare | `apparecchiare` | [apparecchi](https://it.wiktionary.org/w/index.php?title=apparecchi&oldid=3945692), [apparecchiare](https://it.wiktionary.org/w/index.php?title=apparecchiare&oldid=3930713) |
| 80182 | `apparecchi` | verb | 3 | terza persona singolare del congiuntivo presente di apparecchiare | `apparecchiare` | [apparecchi](https://it.wiktionary.org/w/index.php?title=apparecchi&oldid=3945692), [apparecchiare](https://it.wiktionary.org/w/index.php?title=apparecchiare&oldid=3930713) |
| 80182 | `apparecchi` | verb | 4 | terza persona singolare dell'imperativo presente di apparecchiare | `apparecchiare` | [apparecchi](https://it.wiktionary.org/w/index.php?title=apparecchi&oldid=3945692), [apparecchiare](https://it.wiktionary.org/w/index.php?title=apparecchiare&oldid=3930713) |
| 80338 | `cementino` | verb | 1 | terza persona plurale dell'imperativo presente di cementare | `cementare` | [cementino](https://it.wiktionary.org/w/index.php?title=cementino&oldid=4056351), [cementare](https://it.wiktionary.org/w/index.php?title=cementare&oldid=4056352) |
| 80383 | `telefoni` | verb | 1 | prima persona singolare del congiuntivo presente di telefonare | `telefonare` | [telefoni](https://it.wiktionary.org/w/index.php?title=telefoni&oldid=3866989), [telefonare](https://it.wiktionary.org/w/index.php?title=telefonare&oldid=4044395) |
| 80383 | `telefoni` | verb | 2 | seconda persona singolare del congiuntivo presente di telefonare | `telefonare` | [telefoni](https://it.wiktionary.org/w/index.php?title=telefoni&oldid=3866989), [telefonare](https://it.wiktionary.org/w/index.php?title=telefonare&oldid=4044395) |
| 80383 | `telefoni` | verb | 3 | terza persona singolare del congiuntivo presente di telefonare | `telefonare` | [telefoni](https://it.wiktionary.org/w/index.php?title=telefoni&oldid=3866989), [telefonare](https://it.wiktionary.org/w/index.php?title=telefonare&oldid=4044395) |
| 80383 | `telefoni` | verb | 4 | terza persona singolare dell'imperativo presente di telefonare | `telefonare` | [telefoni](https://it.wiktionary.org/w/index.php?title=telefoni&oldid=3866989), [telefonare](https://it.wiktionary.org/w/index.php?title=telefonare&oldid=4044395) |
| 80581 | `dati` | verb | 2 | prima persona singolare del congiuntivo presente di datare | `datare` | [dati](https://it.wiktionary.org/w/index.php?title=dati&oldid=3933689), [datare](https://it.wiktionary.org/w/index.php?title=datare&oldid=3685272) |
| 80581 | `dati` | verb | 3 | seconda persona singolare del congiuntivo presente di datare | `datare` | [dati](https://it.wiktionary.org/w/index.php?title=dati&oldid=3933689), [datare](https://it.wiktionary.org/w/index.php?title=datare&oldid=3685272) |
| 80581 | `dati` | verb | 4 | terza persona singolare del congiuntivo presente di datare | `datare` | [dati](https://it.wiktionary.org/w/index.php?title=dati&oldid=3933689), [datare](https://it.wiktionary.org/w/index.php?title=datare&oldid=3685272) |
| 80581 | `dati` | verb | 5 | terza persona singolare dell'imperativo presente di datare | `datare` | [dati](https://it.wiktionary.org/w/index.php?title=dati&oldid=3933689), [datare](https://it.wiktionary.org/w/index.php?title=datare&oldid=3685272) |
| 80608 | `ricavi` | noun | 0 | plurale di ricavo | `ricavo` | [ricavi](https://it.wiktionary.org/w/index.php?title=ricavi&oldid=3981163), [ricavo](https://it.wiktionary.org/w/index.php?title=ricavo&oldid=3965886) |
| 80820 | `ometti` | verb | 1 | seconda persona singolare dell'imperativo presente di omettere | `omettere` | [ometti](https://it.wiktionary.org/w/index.php?title=ometti&oldid=4056876), [omettere](https://it.wiktionary.org/w/index.php?title=omettere&oldid=3999187) |
| 81037 | `merli` | noun | 2 | plurale di merlo | `merlo` | [merli](https://it.wiktionary.org/w/index.php?title=merli&oldid=3934123), [merlo](https://it.wiktionary.org/w/index.php?title=merlo&oldid=4017187) |
| 81082 | `bruciate` | adj | 0 | femminile plurale di bruciato | `bruciato` | [bruciate](https://it.wiktionary.org/w/index.php?title=bruciate&oldid=3633712), [bruciato](https://it.wiktionary.org/w/index.php?title=bruciato&oldid=4062063) |
| 81239 | `notabili` | noun | 0 | plurale di notabile | `notabile` | [notabili](https://it.wiktionary.org/w/index.php?title=notabili&oldid=3963941), [notabile](https://it.wiktionary.org/w/index.php?title=notabile&oldid=3893141) |
| 81442 | `lucentezze` | noun | 0 | plurale di lucentezza | `lucentezza` | [lucentezze](https://it.wiktionary.org/w/index.php?title=lucentezze&oldid=3919125), [lucentezza](https://it.wiktionary.org/w/index.php?title=lucentezza&oldid=3896751) |
| 81693 | `concisioni` | noun | 0 | plurale di concisione | `concisione` | [concisioni](https://it.wiktionary.org/w/index.php?title=concisioni&oldid=3919085), [concisione](https://it.wiktionary.org/w/index.php?title=concisione&oldid=3995592) |
| 81716 | `sogni` | verb | 2 | seconda persona singolare del congiuntivo presente di sognare | `sognare` | [sogni](https://it.wiktionary.org/w/index.php?title=sogni&oldid=3956514), [sognare](https://it.wiktionary.org/w/index.php?title=sognare&oldid=4039000) |
| 81716 | `sogni` | verb | 3 | terza persona singolare del congiuntivo presente di sognare | `sognare` | [sogni](https://it.wiktionary.org/w/index.php?title=sogni&oldid=3956514), [sognare](https://it.wiktionary.org/w/index.php?title=sognare&oldid=4039000) |
| 81716 | `sogni` | verb | 4 | terza persona singolare dell'imperativo presente di sognare | `sognare` | [sogni](https://it.wiktionary.org/w/index.php?title=sogni&oldid=3956514), [sognare](https://it.wiktionary.org/w/index.php?title=sognare&oldid=4039000) |
| 82116 | `psicologismi` | noun | 0 | plurale di psicologismo | `psicologismo` | [psicologismi](https://it.wiktionary.org/w/index.php?title=psicologismi&oldid=3919160), [psicologismo](https://it.wiktionary.org/w/index.php?title=psicologismo&oldid=3896824) |
| 82516 | `restrittiva` | adj | 0 | femminile di restrittivo | `restrittivo` | [restrittiva](https://it.wiktionary.org/w/index.php?title=restrittiva&oldid=3051168), [restrittivo](https://it.wiktionary.org/w/index.php?title=restrittivo&oldid=3896844) |
| 82517 | `restrittive` | adj | 0 | femminile plurale di restrittivo | `restrittivo` | [restrittive](https://it.wiktionary.org/w/index.php?title=restrittive&oldid=3051169), [restrittivo](https://it.wiktionary.org/w/index.php?title=restrittivo&oldid=3896844) |
| 82724 | `leciti` | noun | 0 | plurale di lecito | `lecito` | [leciti](https://it.wiktionary.org/w/index.php?title=leciti&oldid=3919122), [lecito](https://it.wiktionary.org/w/index.php?title=lecito&oldid=3975337) |
| 82860 | `sottocutanea` | adj | 0 | femminile di sottocutaneo | `sottocutaneo` | [sottocutanea](https://it.wiktionary.org/w/index.php?title=sottocutanea&oldid=3113728), [sottocutaneo](https://it.wiktionary.org/w/index.php?title=sottocutaneo&oldid=3896874) |
| 82917 | `quadre` | adj | 0 | femminile plurale di quadro | `quadro` | [quadre](https://it.wiktionary.org/w/index.php?title=quadre&oldid=3039343), [quadro](https://it.wiktionary.org/w/index.php?title=quadro&oldid=4038884) |
| 83082 | `inibiti` | noun | 0 | plurale di inibito | `inibito` | [inibiti](https://it.wiktionary.org/w/index.php?title=inibiti&oldid=3896914), [inibito](https://it.wiktionary.org/w/index.php?title=inibito&oldid=4067162) |
| 83139 | `scontrosi` | noun | 0 | plurale di scontroso | `scontroso` | [scontrosi](https://it.wiktionary.org/w/index.php?title=scontrosi&oldid=3873050), [scontroso](https://it.wiktionary.org/w/index.php?title=scontroso&oldid=4248878) |
| 83141 | `scontrosa` | noun | 0 | femminile di scontroso | `scontroso` | [scontrosa](https://it.wiktionary.org/w/index.php?title=scontrosa&oldid=3649275), [scontroso](https://it.wiktionary.org/w/index.php?title=scontroso&oldid=4248878) |
| 83145 | `scontrose` | noun | 0 | femminile plurale di scontroso | `scontroso` | [scontrose](https://it.wiktionary.org/w/index.php?title=scontrose&oldid=3824959), [scontroso](https://it.wiktionary.org/w/index.php?title=scontroso&oldid=4248878) |
| 83208 | `brasati` | noun | 0 | plurale di brasato | `brasato` | [brasati](https://it.wiktionary.org/w/index.php?title=brasati&oldid=2853356), [brasato](https://it.wiktionary.org/w/index.php?title=brasato&oldid=4050492) |
| 83228 | `francescani` | noun | 0 | plurale di francescano | `francescano` | [francescani](https://it.wiktionary.org/w/index.php?title=francescani&oldid=3919100), [francescano](https://it.wiktionary.org/w/index.php?title=francescano&oldid=4049438) |
| 83235 | `subcontraenti` | noun | 0 | plurale di subcontraente | `subcontraente` | [subcontraenti](https://it.wiktionary.org/w/index.php?title=subcontraenti&oldid=3228934), [subcontraente](https://it.wiktionary.org/w/index.php?title=subcontraente&oldid=3692237) |
| 83345 | `monti` | verb | 1 | prima persona singolare del congiuntivo presente di montare | `montare` | [monti](https://it.wiktionary.org/w/index.php?title=monti&oldid=4040479), [montare](https://it.wiktionary.org/w/index.php?title=montare&oldid=4022294) |
| 83345 | `monti` | verb | 2 | seconda persona singolare del congiuntivo presente di montare | `montare` | [monti](https://it.wiktionary.org/w/index.php?title=monti&oldid=4040479), [montare](https://it.wiktionary.org/w/index.php?title=montare&oldid=4022294) |
| 83345 | `monti` | verb | 3 | terza persona singolare del congiuntivo presente di montare | `montare` | [monti](https://it.wiktionary.org/w/index.php?title=monti&oldid=4040479), [montare](https://it.wiktionary.org/w/index.php?title=montare&oldid=4022294) |
| 83345 | `monti` | verb | 4 | terza persona singolare dell'imperativo presente di montare | `montare` | [monti](https://it.wiktionary.org/w/index.php?title=monti&oldid=4040479), [montare](https://it.wiktionary.org/w/index.php?title=montare&oldid=4022294) |
| 83349 | `montanari` | noun | 0 | plurale di montanaro | `montanaro` | [montanari](https://it.wiktionary.org/w/index.php?title=montanari&oldid=3980956), [montanaro](https://it.wiktionary.org/w/index.php?title=montanaro&oldid=3676460) |
| 83351 | `montanare` | noun | 0 | femminile plurale di montanaro | `montanaro` | [montanare](https://it.wiktionary.org/w/index.php?title=montanare&oldid=3896970), [montanaro](https://it.wiktionary.org/w/index.php?title=montanaro&oldid=3676460) |
| 83353 | `montanara` | noun | 0 | femminile di montanaro | `montanaro` | [montanara](https://it.wiktionary.org/w/index.php?title=montanara&oldid=3896971), [montanaro](https://it.wiktionary.org/w/index.php?title=montanaro&oldid=3676460) |
| 83434 | `fonemi` | noun | 0 | plurale di fonema | `fonema` | [fonemi](https://it.wiktionary.org/w/index.php?title=fonemi&oldid=3896986), [fonema](https://it.wiktionary.org/w/index.php?title=fonema&oldid=3949273) |
| 83508 | `gasometri` | noun | 0 | plurale di gasometro | `gasometro` | [gasometri](https://it.wiktionary.org/w/index.php?title=gasometri&oldid=3897028), [gasometro](https://it.wiktionary.org/w/index.php?title=gasometro&oldid=3897024) |
| 83509 | `gassometri` | noun | 0 | plurale di gassometro | `gassometro` | [gassometri](https://it.wiktionary.org/w/index.php?title=gassometri&oldid=3897029), [gassometro](https://it.wiktionary.org/w/index.php?title=gassometro&oldid=3897025) |
| 83524 | `aeriformi` | noun | 0 | plurale di aeriforme | `aeriforme` | [aeriformi](https://it.wiktionary.org/w/index.php?title=aeriformi&oldid=3897034), [aeriforme](https://it.wiktionary.org/w/index.php?title=aeriforme&oldid=3897033) |
| 83662 | `faziosi` | adv | 0 | plurale di fazioso | `fazioso` | [faziosi](https://it.wiktionary.org/w/index.php?title=faziosi&oldid=3897122), [fazioso](https://it.wiktionary.org/w/index.php?title=fazioso&oldid=3989505) |
| 83664 | `faziose` | adv | 0 | femminile plurale di fazioso | `fazioso` | [faziose](https://it.wiktionary.org/w/index.php?title=faziose&oldid=3897123), [fazioso](https://it.wiktionary.org/w/index.php?title=fazioso&oldid=3989505) |
| 83848 | `negoziatrici` | noun | 0 | femminile plurale di negoziatore | `negoziatore` | [negoziatrici](https://it.wiktionary.org/w/index.php?title=negoziatrici&oldid=3006441), [negoziatore](https://it.wiktionary.org/w/index.php?title=negoziatore&oldid=4047942) |
| 84140 | `profilattici` | noun | 0 | plurale di profilattico | `profilattico` | [profilattici](https://it.wiktionary.org/w/index.php?title=profilattici&oldid=3173998), [profilattico](https://it.wiktionary.org/w/index.php?title=profilattico&oldid=3890283) |
| 85274 | `spilli` | verb | 1 | prima persona singolare del congiuntivo presente di spillare | `spillare` | [spilli](https://it.wiktionary.org/w/index.php?title=spilli&oldid=4058700), [spillare](https://it.wiktionary.org/w/index.php?title=spillare&oldid=3936353) |
| 85274 | `spilli` | verb | 2 | seconda persona singolare del congiuntivo presente di spillare | `spillare` | [spilli](https://it.wiktionary.org/w/index.php?title=spilli&oldid=4058700), [spillare](https://it.wiktionary.org/w/index.php?title=spillare&oldid=3936353) |
| 85274 | `spilli` | verb | 3 | terza persona singolare del congiuntivo presente di spillare | `spillare` | [spilli](https://it.wiktionary.org/w/index.php?title=spilli&oldid=4058700), [spillare](https://it.wiktionary.org/w/index.php?title=spillare&oldid=3936353) |
| 85274 | `spilli` | verb | 4 | terza persona singolare dell'imperativo presente di spillare | `spillare` | [spilli](https://it.wiktionary.org/w/index.php?title=spilli&oldid=4058700), [spillare](https://it.wiktionary.org/w/index.php?title=spillare&oldid=3936353) |
| 85674 | `mie` | adj | 0 | femminile plurale di mio | `mio` | [mie](https://it.wiktionary.org/w/index.php?title=mie&oldid=3897335), [mio](https://it.wiktionary.org/w/index.php?title=mio&oldid=4011940) |
| 86041 | `Monocotiledoni` | noun | 0 | plurale di monocotiledone | `monocotiledone` | [Monocotiledoni](https://it.wiktionary.org/w/index.php?title=Monocotiledoni&oldid=4023667), [monocotiledone](https://it.wiktionary.org/w/index.php?title=monocotiledone&oldid=3993183) |
| 86568 | `pavimentazioni` | noun | 0 | plurale di pavimentazione | `pavimentazione` | [pavimentazioni](https://it.wiktionary.org/w/index.php?title=pavimentazioni&oldid=3897415), [pavimentazione](https://it.wiktionary.org/w/index.php?title=pavimentazione&oldid=4046509) |
| 86584 | `mandrini` | noun | 0 | plurale di mandrino | `mandrino` | [mandrini](https://it.wiktionary.org/w/index.php?title=mandrini&oldid=3897430), [mandrino](https://it.wiktionary.org/w/index.php?title=mandrino&oldid=3895979) |
| 86918 | `coccolo` | verb | 0 | prima persona singolare dell'indicativo presente di coccolare | `coccolare` | [coccolo](https://it.wiktionary.org/w/index.php?title=coccolo&oldid=3897518), [coccolare](https://it.wiktionary.org/w/index.php?title=coccolare&oldid=3988311) |
| 87588 | `direttrice` | noun | 0 | femminile singolare di direttore | `direttore` | [direttrice](https://it.wiktionary.org/w/index.php?title=direttrice&oldid=3897570), [direttore](https://it.wiktionary.org/w/index.php?title=direttore&oldid=3997678) |
| 87741 | `malfattrice` | noun | 0 | femminile di malfattore | `malfattore` | [malfattrice](https://it.wiktionary.org/w/index.php?title=malfattrice&oldid=3807000), [malfattore](https://it.wiktionary.org/w/index.php?title=malfattore&oldid=4053482) |
| 88043 | `installatori` | noun | 0 | plurale di installatore | `installatore` | [installatori](https://it.wiktionary.org/w/index.php?title=installatori&oldid=3415090), [installatore](https://it.wiktionary.org/w/index.php?title=installatore&oldid=3991830) |
| 88130 | `nitratazioni` | noun | 0 | plurale di nitratazione | `nitratazione` | [nitratazioni](https://it.wiktionary.org/w/index.php?title=nitratazioni&oldid=3426390), [nitratazione](https://it.wiktionary.org/w/index.php?title=nitratazione&oldid=3644764) |
| 88135 | `nutrizioni` | noun | 0 | plurale di nutrizione | `nutrizione` | [nutrizioni](https://it.wiktionary.org/w/index.php?title=nutrizioni&oldid=3426996), [nutrizione](https://it.wiktionary.org/w/index.php?title=nutrizione&oldid=3993982) |
| 88140 | `opposizioni` | noun | 0 | plurale di opposizione | `opposizione` | [opposizioni](https://it.wiktionary.org/w/index.php?title=opposizioni&oldid=3897580), [opposizione](https://it.wiktionary.org/w/index.php?title=opposizione&oldid=4049563) |
| 88161 | `peccatrici` | noun | 0 | femminile plurale di peccatore | `peccatore` | [peccatrici](https://it.wiktionary.org/w/index.php?title=peccatrici&oldid=3645778), [peccatore](https://it.wiktionary.org/w/index.php?title=peccatore&oldid=3873731) |
| 88177 | `posizioni` | verb | 1 | prima persona singolare del congiuntivo presente di posizionare | `posizionare` | [posizioni](https://it.wiktionary.org/w/index.php?title=posizioni&oldid=3920028), [posizionare](https://it.wiktionary.org/w/index.php?title=posizionare&oldid=3778573) |
| 88177 | `posizioni` | verb | 2 | seconda persona singolare del congiuntivo presente di posizionare | `posizionare` | [posizioni](https://it.wiktionary.org/w/index.php?title=posizioni&oldid=3920028), [posizionare](https://it.wiktionary.org/w/index.php?title=posizionare&oldid=3778573) |
| 88177 | `posizioni` | verb | 3 | terza persona singolare del congiuntivo presente di posizionare | `posizionare` | [posizioni](https://it.wiktionary.org/w/index.php?title=posizioni&oldid=3920028), [posizionare](https://it.wiktionary.org/w/index.php?title=posizionare&oldid=3778573) |
| 88177 | `posizioni` | verb | 4 | terza persona singolare dell'imperativo presente di posizionare | `posizionare` | [posizioni](https://it.wiktionary.org/w/index.php?title=posizioni&oldid=3920028), [posizionare](https://it.wiktionary.org/w/index.php?title=posizionare&oldid=3778573) |
| 88217 | `regolarizzazioni` | noun | 0 | plurale di regolarizzazione | `regolarizzazione` | [regolarizzazioni](https://it.wiktionary.org/w/index.php?title=regolarizzazioni&oldid=3436640), [regolarizzazione](https://it.wiktionary.org/w/index.php?title=regolarizzazione&oldid=3838445) |
| 88253 | `sanzioni` | verb | 0 | seconda persona singolare dell'indicativo presente di sanzionare | `sanzionare` | [sanzioni](https://it.wiktionary.org/w/index.php?title=sanzioni&oldid=4245615), [sanzionare](https://it.wiktionary.org/w/index.php?title=sanzionare&oldid=3791489) |
| 88253 | `sanzioni` | verb | 1 | prima persona singolare del congiuntivo presente di sanzionare | `sanzionare` | [sanzioni](https://it.wiktionary.org/w/index.php?title=sanzioni&oldid=4245615), [sanzionare](https://it.wiktionary.org/w/index.php?title=sanzionare&oldid=3791489) |
| 88253 | `sanzioni` | verb | 2 | seconda persona singolare del congiuntivo presente di sanzionare | `sanzionare` | [sanzioni](https://it.wiktionary.org/w/index.php?title=sanzioni&oldid=4245615), [sanzionare](https://it.wiktionary.org/w/index.php?title=sanzionare&oldid=3791489) |
| 88253 | `sanzioni` | verb | 3 | terza persona singolare del congiuntivo presente di sanzionare | `sanzionare` | [sanzioni](https://it.wiktionary.org/w/index.php?title=sanzioni&oldid=4245615), [sanzionare](https://it.wiktionary.org/w/index.php?title=sanzionare&oldid=3791489) |
| 88259 | `segnali` | verb | 1 | prima persona singolare del congiuntivo presente di segnalare | `segnalare` | [segnali](https://it.wiktionary.org/w/index.php?title=segnali&oldid=3934523), [segnalare](https://it.wiktionary.org/w/index.php?title=segnalare&oldid=3935519) |
| 88259 | `segnali` | verb | 2 | seconda persona singolare del congiuntivo presente di segnalare | `segnalare` | [segnali](https://it.wiktionary.org/w/index.php?title=segnali&oldid=3934523), [segnalare](https://it.wiktionary.org/w/index.php?title=segnalare&oldid=3935519) |
| 88259 | `segnali` | verb | 3 | terza persona singolare del congiuntivo presente di segnalare | `segnalare` | [segnali](https://it.wiktionary.org/w/index.php?title=segnali&oldid=3934523), [segnalare](https://it.wiktionary.org/w/index.php?title=segnalare&oldid=3935519) |
| 88259 | `segnali` | verb | 4 | terza persona singolare dell'imperativo presente di segnalare | `segnalare` | [segnali](https://it.wiktionary.org/w/index.php?title=segnali&oldid=3934523), [segnalare](https://it.wiktionary.org/w/index.php?title=segnalare&oldid=3935519) |
| 88302 | `stivali` | noun | 0 | plurale di stivale | `stivale` | [stivali](https://it.wiktionary.org/w/index.php?title=stivali&oldid=3658436), [stivale](https://it.wiktionary.org/w/index.php?title=stivale&oldid=4067881) |
| 88661 | `anticipi` | verb | 1 | prima persona singolare del congiuntivo presente di anticipare | `anticipare` | [anticipi](https://it.wiktionary.org/w/index.php?title=anticipi&oldid=3842279), [anticipare](https://it.wiktionary.org/w/index.php?title=anticipare&oldid=3974335) |
| 88661 | `anticipi` | verb | 2 | seconda persona singolare del congiuntivo presente di anticipare | `anticipare` | [anticipi](https://it.wiktionary.org/w/index.php?title=anticipi&oldid=3842279), [anticipare](https://it.wiktionary.org/w/index.php?title=anticipare&oldid=3974335) |
| 88661 | `anticipi` | verb | 3 | terza persona singolare del congiuntivo presente di anticipare | `anticipare` | [anticipi](https://it.wiktionary.org/w/index.php?title=anticipi&oldid=3842279), [anticipare](https://it.wiktionary.org/w/index.php?title=anticipare&oldid=3974335) |
| 88661 | `anticipi` | verb | 4 | terza persona singolare dell'imperativo presente di anticipare | `anticipare` | [anticipi](https://it.wiktionary.org/w/index.php?title=anticipi&oldid=3842279), [anticipare](https://it.wiktionary.org/w/index.php?title=anticipare&oldid=3974335) |
| 88694 | `avanzi` | verb | 1 | prima persona singolare del congiuntivo presente di avanzare | `avanzare` | [avanzi](https://it.wiktionary.org/w/index.php?title=avanzi&oldid=3835119), [avanzare](https://it.wiktionary.org/w/index.php?title=avanzare&oldid=3995788) |
| 88694 | `avanzi` | verb | 2 | seconda persona singolare del congiuntivo presente di avanzare | `avanzare` | [avanzi](https://it.wiktionary.org/w/index.php?title=avanzi&oldid=3835119), [avanzare](https://it.wiktionary.org/w/index.php?title=avanzare&oldid=3995788) |
| 88694 | `avanzi` | verb | 3 | terza persona singolare del congiuntivo presente di avanzare | `avanzare` | [avanzi](https://it.wiktionary.org/w/index.php?title=avanzi&oldid=3835119), [avanzare](https://it.wiktionary.org/w/index.php?title=avanzare&oldid=3995788) |
| 88694 | `avanzi` | verb | 4 | terza persona singolare dell'imperativo presente di avanzare | `avanzare` | [avanzi](https://it.wiktionary.org/w/index.php?title=avanzi&oldid=3835119), [avanzare](https://it.wiktionary.org/w/index.php?title=avanzare&oldid=3995788) |
| 88732 | `capitani` | verb | 1 | prima persona singolare del congiuntivo presente di capitanare | `capitanare` | [capitani](https://it.wiktionary.org/w/index.php?title=capitani&oldid=3870426), [capitanare](https://it.wiktionary.org/w/index.php?title=capitanare&oldid=3634052) |
| 88732 | `capitani` | verb | 2 | seconda persona singolare del congiuntivo presente di capitanare | `capitanare` | [capitani](https://it.wiktionary.org/w/index.php?title=capitani&oldid=3870426), [capitanare](https://it.wiktionary.org/w/index.php?title=capitanare&oldid=3634052) |
| 88732 | `capitani` | verb | 3 | terza persona singolare del congiuntivo presente di capitanare | `capitanare` | [capitani](https://it.wiktionary.org/w/index.php?title=capitani&oldid=3870426), [capitanare](https://it.wiktionary.org/w/index.php?title=capitanare&oldid=3634052) |
| 88732 | `capitani` | verb | 4 | terza persona singolare dell'imperativo presente di capitanare | `capitanare` | [capitani](https://it.wiktionary.org/w/index.php?title=capitani&oldid=3870426), [capitanare](https://it.wiktionary.org/w/index.php?title=capitanare&oldid=3634052) |
| 88791 | `commenti` | verb | 1 | prima persona singolare del congiuntivo presente di commentare | `commentare` | [commenti](https://it.wiktionary.org/w/index.php?title=commenti&oldid=3959008), [commentare](https://it.wiktionary.org/w/index.php?title=commentare&oldid=3981537) |
| 88791 | `commenti` | verb | 2 | seconda persona singolare del congiuntivo presente di commentare | `commentare` | [commenti](https://it.wiktionary.org/w/index.php?title=commenti&oldid=3959008), [commentare](https://it.wiktionary.org/w/index.php?title=commentare&oldid=3981537) |
| 88791 | `commenti` | verb | 3 | terza persona singolare del congiuntivo presente di commentare | `commentare` | [commenti](https://it.wiktionary.org/w/index.php?title=commenti&oldid=3959008), [commentare](https://it.wiktionary.org/w/index.php?title=commentare&oldid=3981537) |
| 88791 | `commenti` | verb | 4 | terza persona singolare dell'imperativo presente di commentare | `commentare` | [commenti](https://it.wiktionary.org/w/index.php?title=commenti&oldid=3959008), [commentare](https://it.wiktionary.org/w/index.php?title=commentare&oldid=3981537) |
| 88812 | `confronti` | verb | 1 | prima persona singolare del congiuntivo presente di confrontare | `confrontare` | [confronti](https://it.wiktionary.org/w/index.php?title=confronti&oldid=3971150), [confrontare](https://it.wiktionary.org/w/index.php?title=confrontare&oldid=3971146) |
| 88812 | `confronti` | verb | 2 | seconda persona singolare del congiuntivo presente di confrontare | `confrontare` | [confronti](https://it.wiktionary.org/w/index.php?title=confronti&oldid=3971150), [confrontare](https://it.wiktionary.org/w/index.php?title=confrontare&oldid=3971146) |
| 88812 | `confronti` | verb | 3 | terza persona singolare del congiuntivo presente di confrontare | `confrontare` | [confronti](https://it.wiktionary.org/w/index.php?title=confronti&oldid=3971150), [confrontare](https://it.wiktionary.org/w/index.php?title=confrontare&oldid=3971146) |
| 88812 | `confronti` | verb | 4 | terza persona singolare dell'imperativo presente di confrontare | `confrontare` | [confronti](https://it.wiktionary.org/w/index.php?title=confronti&oldid=3971150), [confrontare](https://it.wiktionary.org/w/index.php?title=confrontare&oldid=3971146) |
| 88817 | `consulti` | verb | 0 | seconda persona singolare dell'indicativo presente di consultare | `consultare` | [consulti](https://it.wiktionary.org/w/index.php?title=consulti&oldid=3989525), [consultare](https://it.wiktionary.org/w/index.php?title=consultare&oldid=3996249) |
| 88817 | `consulti` | verb | 3 | terza persona singolare dell'imperativo presente di consultare | `consultare` | [consulti](https://it.wiktionary.org/w/index.php?title=consulti&oldid=3989525), [consultare](https://it.wiktionary.org/w/index.php?title=consultare&oldid=3996249) |
| 88828 | `contrasti` | verb | 0 | seconda persona singolare dell'indicativo presente di contrastare | `contrastare` | [contrasti](https://it.wiktionary.org/w/index.php?title=contrasti&oldid=3857445), [contrastare](https://it.wiktionary.org/w/index.php?title=contrastare&oldid=3999402) |
| 88828 | `contrasti` | verb | 1 | prima persona singolare del congiuntivo presente di contrastare | `contrastare` | [contrasti](https://it.wiktionary.org/w/index.php?title=contrasti&oldid=3857445), [contrastare](https://it.wiktionary.org/w/index.php?title=contrastare&oldid=3999402) |
| 88828 | `contrasti` | verb | 2 | seconda persona singolare del congiuntivo presente di contrastare | `contrastare` | [contrasti](https://it.wiktionary.org/w/index.php?title=contrasti&oldid=3857445), [contrastare](https://it.wiktionary.org/w/index.php?title=contrastare&oldid=3999402) |
| 88911 | `domicili` | verb | 0 | seconda persona singolare dell'indicativo presente di domiciliare | `domiciliare` | [domicili](https://it.wiktionary.org/w/index.php?title=domicili&oldid=3790075), [domiciliare](https://it.wiktionary.org/w/index.php?title=domiciliare&oldid=3894812) |
| 88911 | `domicili` | verb | 1 | prima persona singolare del congiuntivo di domiciliare | `domiciliare` | [domicili](https://it.wiktionary.org/w/index.php?title=domicili&oldid=3790075), [domiciliare](https://it.wiktionary.org/w/index.php?title=domiciliare&oldid=3894812) |
| 88911 | `domicili` | verb | 2 | seconda persona singolare del congiuntivo di domiciliare | `domiciliare` | [domicili](https://it.wiktionary.org/w/index.php?title=domicili&oldid=3790075), [domiciliare](https://it.wiktionary.org/w/index.php?title=domiciliare&oldid=3894812) |
| 88911 | `domicili` | verb | 3 | terza persona singolare del congiuntivo di domiciliare | `domiciliare` | [domicili](https://it.wiktionary.org/w/index.php?title=domicili&oldid=3790075), [domiciliare](https://it.wiktionary.org/w/index.php?title=domiciliare&oldid=3894812) |
| 88911 | `domicili` | verb | 4 | terza persona singolare dell'imperativo di domiciliare | `domiciliare` | [domicili](https://it.wiktionary.org/w/index.php?title=domicili&oldid=3790075), [domiciliare](https://it.wiktionary.org/w/index.php?title=domiciliare&oldid=3894812) |
| 88964 | `fogli` | noun | 0 | plurale di foglio | `foglio` | [fogli](https://it.wiktionary.org/w/index.php?title=fogli&oldid=3293661), [foglio](https://it.wiktionary.org/w/index.php?title=foglio&oldid=4017103) |
| 88968 | `palafreni` | noun | 0 | plurale di palafreno | `palafreno` | [palafreni](https://it.wiktionary.org/w/index.php?title=palafreni&oldid=3016095), [palafreno](https://it.wiktionary.org/w/index.php?title=palafreno&oldid=3836912) |
| 89189 | `alieni` | verb | 1 | prima persona singolare del congiuntivo presente di alienare | `alienare` | [alieni](https://it.wiktionary.org/w/index.php?title=alieni&oldid=4247788), [alienare](https://it.wiktionary.org/w/index.php?title=alienare&oldid=3997827) |
| 89189 | `alieni` | verb | 2 | seconda persona singolare del congiuntivo presente di alienare | `alienare` | [alieni](https://it.wiktionary.org/w/index.php?title=alieni&oldid=4247788), [alienare](https://it.wiktionary.org/w/index.php?title=alienare&oldid=3997827) |
| 89189 | `alieni` | verb | 3 | terza persona singolare del congiuntivo presente di alienare | `alienare` | [alieni](https://it.wiktionary.org/w/index.php?title=alieni&oldid=4247788), [alienare](https://it.wiktionary.org/w/index.php?title=alienare&oldid=3997827) |
| 89189 | `alieni` | verb | 4 | terza persona singolare dell'imperativo presente di alienare | `alienare` | [alieni](https://it.wiktionary.org/w/index.php?title=alieni&oldid=4247788), [alienare](https://it.wiktionary.org/w/index.php?title=alienare&oldid=3997827) |
| 89291 | `getti` | verb | 1 | prima persona singolare del congiuntivo presente di gettare | `gettare` | [getti](https://it.wiktionary.org/w/index.php?title=getti&oldid=3800440), [gettare](https://it.wiktionary.org/w/index.php?title=gettare&oldid=4042424) |
| 89291 | `getti` | verb | 2 | seconda persona singolare del congiuntivo presente di gettare | `gettare` | [getti](https://it.wiktionary.org/w/index.php?title=getti&oldid=3800440), [gettare](https://it.wiktionary.org/w/index.php?title=gettare&oldid=4042424) |
| 89291 | `getti` | verb | 3 | terza persona singolare del congiuntivo presente di gettare | `gettare` | [getti](https://it.wiktionary.org/w/index.php?title=getti&oldid=3800440), [gettare](https://it.wiktionary.org/w/index.php?title=gettare&oldid=4042424) |
| 89291 | `getti` | verb | 4 | terza persona singolare dell'imperativo presente di gettare | `gettare` | [getti](https://it.wiktionary.org/w/index.php?title=getti&oldid=3800440), [gettare](https://it.wiktionary.org/w/index.php?title=gettare&oldid=4042424) |
| 89307 | `glutei` | adj | 0 | plurale di gluteo | `gluteo` | [glutei](https://it.wiktionary.org/w/index.php?title=glutei&oldid=3978084), [gluteo](https://it.wiktionary.org/w/index.php?title=gluteo&oldid=4064052) |
| 89323 | `imbarazzi` | verb | 1 | prima persona singolare del congiuntivo presente di imbarazzare | `imbarazzare` | [imbarazzi](https://it.wiktionary.org/w/index.php?title=imbarazzi&oldid=3790442), [imbarazzare](https://it.wiktionary.org/w/index.php?title=imbarazzare&oldid=3990295) |
| 89323 | `imbarazzi` | verb | 2 | seconda persona singolare del congiuntivo presente di imbarazzare | `imbarazzare` | [imbarazzi](https://it.wiktionary.org/w/index.php?title=imbarazzi&oldid=3790442), [imbarazzare](https://it.wiktionary.org/w/index.php?title=imbarazzare&oldid=3990295) |
| 89323 | `imbarazzi` | verb | 3 | terza persona singolare del congiuntivo presente di imbarazzare | `imbarazzare` | [imbarazzi](https://it.wiktionary.org/w/index.php?title=imbarazzi&oldid=3790442), [imbarazzare](https://it.wiktionary.org/w/index.php?title=imbarazzare&oldid=3990295) |
| 89323 | `imbarazzi` | verb | 4 | terza persona singolare dell'imperativo presente di imbarazzare | `imbarazzare` | [imbarazzi](https://it.wiktionary.org/w/index.php?title=imbarazzi&oldid=3790442), [imbarazzare](https://it.wiktionary.org/w/index.php?title=imbarazzare&oldid=3990295) |
| 89338 | `impiastri` | verb | 1 | prima persona singolare del congiuntivo presente di impiastrare | `impiastrare` | [impiastri](https://it.wiktionary.org/w/index.php?title=impiastri&oldid=4057428), [impiastrare](https://it.wiktionary.org/w/index.php?title=impiastrare&oldid=3692710) |
| 89338 | `impiastri` | verb | 2 | seconda persona singolare del congiuntivo presente di impiastrare | `impiastrare` | [impiastri](https://it.wiktionary.org/w/index.php?title=impiastri&oldid=4057428), [impiastrare](https://it.wiktionary.org/w/index.php?title=impiastrare&oldid=3692710) |
| 89338 | `impiastri` | verb | 3 | terza persona singolare del congiuntivo presente di impiastrare | `impiastrare` | [impiastri](https://it.wiktionary.org/w/index.php?title=impiastri&oldid=4057428), [impiastrare](https://it.wiktionary.org/w/index.php?title=impiastrare&oldid=3692710) |
| 89338 | `impiastri` | verb | 4 | terza persona singolare dell'imperativo presente di impiastrare | `impiastrare` | [impiastri](https://it.wiktionary.org/w/index.php?title=impiastri&oldid=4057428), [impiastrare](https://it.wiktionary.org/w/index.php?title=impiastrare&oldid=3692710) |
| 89347 | `incanti` | verb | 1 | prima persona singolare del congiuntivo presente di incantare | `incantare` | [incanti](https://it.wiktionary.org/w/index.php?title=incanti&oldid=3865623), [incantare](https://it.wiktionary.org/w/index.php?title=incantare&oldid=3968799) |
| 89667 | `situazioni` | noun | 0 | plurale di situazione | `situazione` | [situazioni](https://it.wiktionary.org/w/index.php?title=situazioni&oldid=4247867), [situazione](https://it.wiktionary.org/w/index.php?title=situazione&oldid=4036646) |
| 89968 | `muse` | noun | 0 | plurale di musa | `musa` | [muse](https://it.wiktionary.org/w/index.php?title=muse&oldid=3748474), [musa](https://it.wiktionary.org/w/index.php?title=musa&oldid=3978855) |
| 90034 | `pastorali` | noun | 0 | plurale di pastorale | `pastorale` | [pastorali](https://it.wiktionary.org/w/index.php?title=pastorali&oldid=3897617), [pastorale](https://it.wiktionary.org/w/index.php?title=pastorale&oldid=3975344) |
| 90591 | `ricoverata` | noun | 0 | femminile singolare di ricoverato | `ricoverato` | [ricoverata](https://it.wiktionary.org/w/index.php?title=ricoverata&oldid=3648279), [ricoverato](https://it.wiktionary.org/w/index.php?title=ricoverato&oldid=3887511) |
| 90618 | `immigrata` | noun | 0 | femminile di immigrato | `immigrato` | [immigrata](https://it.wiktionary.org/w/index.php?title=immigrata&oldid=3699486), [immigrato](https://it.wiktionary.org/w/index.php?title=immigrato&oldid=3894174) |
| 90639 | `allegrato` | verb | 0 | participio passato di allegrare | `allegrare` | [allegrato](https://it.wiktionary.org/w/index.php?title=allegrato&oldid=3373371), [allegrare](https://it.wiktionary.org/w/index.php?title=allegrare&oldid=4001665) |
| 91093 | `bela` | verb | 1 | seconda persona singolare dell'imperativo presente di belare | `belare` | [bela](https://it.wiktionary.org/w/index.php?title=bela&oldid=4076786), [belare](https://it.wiktionary.org/w/index.php?title=belare&oldid=3896020) |
| 91388 | `trogloditi` | noun | 0 | plurale maschile di troglodita | `troglodita` | [trogloditi](https://it.wiktionary.org/w/index.php?title=trogloditi&oldid=3828054), [troglodita](https://it.wiktionary.org/w/index.php?title=troglodita&oldid=4007212) |
| 91610 | `districante` | adj | 0 | participio presente di districare | `districare` | [districante](https://it.wiktionary.org/w/index.php?title=districante&oldid=3285784), [districare](https://it.wiktionary.org/w/index.php?title=districare&oldid=3737059) |
| 91802 | `innamorate` | noun | 0 | femminile plurale di innamorato | `innamorato` | [innamorate](https://it.wiktionary.org/w/index.php?title=innamorate&oldid=3836391), [innamorato](https://it.wiktionary.org/w/index.php?title=innamorato&oldid=3939424) |
| 91829 | `medici` | noun | 0 | plurale di medico | `medico` | [medici](https://it.wiktionary.org/w/index.php?title=medici&oldid=4051463), [medico](https://it.wiktionary.org/w/index.php?title=medico&oldid=4066651) |
| 91894 | `marine` | noun | 0 | plurale di marina | `marina` | [marine](https://it.wiktionary.org/w/index.php?title=marine&oldid=4068895), [marina](https://it.wiktionary.org/w/index.php?title=marina&oldid=4054022) |
| 91963 | `soffierie` | noun | 0 | plurale di soffieria | `soffieria` | [soffierie](https://it.wiktionary.org/w/index.php?title=soffierie&oldid=3109462), [soffieria](https://it.wiktionary.org/w/index.php?title=soffieria&oldid=3442775) |
| 91967 | `soffietti` | noun | 0 | plurale di soffietto | `soffietto` | [soffietti](https://it.wiktionary.org/w/index.php?title=soffietti&oldid=3109465), [soffietto](https://it.wiktionary.org/w/index.php?title=soffietto&oldid=3897757) |
| 91971 | `soffioni` | noun | 0 | plurale di soffione | `soffione` | [soffioni](https://it.wiktionary.org/w/index.php?title=soffioni&oldid=3109470), [soffione](https://it.wiktionary.org/w/index.php?title=soffione&oldid=4025907) |
| 91997 | `vigliacca` | noun | 0 | femminile singolare di vigliacco | `vigliacco` | [vigliacca](https://it.wiktionary.org/w/index.php?title=vigliacca&oldid=3838190), [vigliacco](https://it.wiktionary.org/w/index.php?title=vigliacco&oldid=4059680) |
| 92001 | `vigliacchi` | noun | 0 | plurale di vigliacco | `vigliacco` | [vigliacchi](https://it.wiktionary.org/w/index.php?title=vigliacchi&oldid=3664696), [vigliacco](https://it.wiktionary.org/w/index.php?title=vigliacco&oldid=4059680) |
| 92003 | `etimologa` | noun | 0 | femminile di etimologo | `etimologo` | [etimologa](https://it.wiktionary.org/w/index.php?title=etimologa&oldid=2924639), [etimologo](https://it.wiktionary.org/w/index.php?title=etimologo&oldid=3897767) |
| 92004 | `etimologi` | noun | 0 | plurale di etimologo | `etimologo` | [etimologi](https://it.wiktionary.org/w/index.php?title=etimologi&oldid=2924641), [etimologo](https://it.wiktionary.org/w/index.php?title=etimologo&oldid=3897767) |
| 92005 | `etimologhe` | noun | 0 | plurale femminile di etimologo | `etimologo` | [etimologhe](https://it.wiktionary.org/w/index.php?title=etimologhe&oldid=2924640), [etimologo](https://it.wiktionary.org/w/index.php?title=etimologo&oldid=3897767) |
| 92029 | `occulti` | verb | 1 | prima persona singolare del congiuntivo presente di occultare | `occultare` | [occulti](https://it.wiktionary.org/w/index.php?title=occulti&oldid=4058427), [occultare](https://it.wiktionary.org/w/index.php?title=occultare&oldid=3575529) |
| 92029 | `occulti` | verb | 2 | seconda persona singolare del congiuntivo presente di occultare | `occultare` | [occulti](https://it.wiktionary.org/w/index.php?title=occulti&oldid=4058427), [occultare](https://it.wiktionary.org/w/index.php?title=occultare&oldid=3575529) |
| 92029 | `occulti` | verb | 3 | terza persona singolare del congiuntivo presente di occultare | `occultare` | [occulti](https://it.wiktionary.org/w/index.php?title=occulti&oldid=4058427), [occultare](https://it.wiktionary.org/w/index.php?title=occultare&oldid=3575529) |
| 92029 | `occulti` | verb | 4 | terza persona singolare dell'imperativo presente di occultare | `occultare` | [occulti](https://it.wiktionary.org/w/index.php?title=occulti&oldid=4058427), [occultare](https://it.wiktionary.org/w/index.php?title=occultare&oldid=3575529) |
| 92392 | `locelli` | noun | 0 | plurale di locello | `locello` | [locelli](https://it.wiktionary.org/w/index.php?title=locelli&oldid=2989756), [locello](https://it.wiktionary.org/w/index.php?title=locello&oldid=3420222) |
| 92554 | `mesti` | verb | 1 | prima persona singolare del congiuntivo presente di mestare | `mestare` | [mesti](https://it.wiktionary.org/w/index.php?title=mesti&oldid=3790829), [mestare](https://it.wiktionary.org/w/index.php?title=mestare&oldid=3999434) |
| 92554 | `mesti` | verb | 2 | seconda persona singolare del congiuntivo presente di mestare | `mestare` | [mesti](https://it.wiktionary.org/w/index.php?title=mesti&oldid=3790829), [mestare](https://it.wiktionary.org/w/index.php?title=mestare&oldid=3999434) |
| 92554 | `mesti` | verb | 3 | terza persona singolare del congiuntivo presente di mestare | `mestare` | [mesti](https://it.wiktionary.org/w/index.php?title=mesti&oldid=3790829), [mestare](https://it.wiktionary.org/w/index.php?title=mestare&oldid=3999434) |
| 92554 | `mesti` | verb | 4 | terza persona singolare dell'imperativo presente di mestare | `mestare` | [mesti](https://it.wiktionary.org/w/index.php?title=mesti&oldid=3790829), [mestare](https://it.wiktionary.org/w/index.php?title=mestare&oldid=3999434) |
| 92908 | `campana` | adj | 0 | femminile di campano | `campano` | [campana](https://it.wiktionary.org/w/index.php?title=campana&oldid=4046383), [campano](https://it.wiktionary.org/w/index.php?title=campano&oldid=3957894) |
| 93106 | `gropponate` | noun | 0 | plurale di gropponata | `gropponata` | [gropponate](https://it.wiktionary.org/w/index.php?title=gropponate&oldid=2945658), [gropponata](https://it.wiktionary.org/w/index.php?title=gropponata&oldid=3640516) |
| 93139 | `levanti` | noun | 0 | plurale di levante | `levante` | [levanti](https://it.wiktionary.org/w/index.php?title=levanti&oldid=3897801), [levante](https://it.wiktionary.org/w/index.php?title=levante&oldid=3894467) |
| 93938 | `lamenti` | verb | 2 | seconda persona singolare del congiuntivo presente di lamentare | `lamentare` | [lamenti](https://it.wiktionary.org/w/index.php?title=lamenti&oldid=3793322), [lamentare](https://it.wiktionary.org/w/index.php?title=lamentare&oldid=3642814) |
| 93938 | `lamenti` | verb | 3 | terza persona singolare del congiuntivo presente di lamentare | `lamentare` | [lamenti](https://it.wiktionary.org/w/index.php?title=lamenti&oldid=3793322), [lamentare](https://it.wiktionary.org/w/index.php?title=lamentare&oldid=3642814) |
| 93938 | `lamenti` | verb | 4 | terza persona singolare dell'imperativo presente di lamentare | `lamentare` | [lamenti](https://it.wiktionary.org/w/index.php?title=lamenti&oldid=3793322), [lamentare](https://it.wiktionary.org/w/index.php?title=lamentare&oldid=3642814) |
| 93940 | `zampilli` | verb | 4 | terza persona singolare dell'imperativo presente di zampillare | `zampillare` | [zampilli](https://it.wiktionary.org/w/index.php?title=zampilli&oldid=3897862), [zampillare](https://it.wiktionary.org/w/index.php?title=zampillare&oldid=4060273) |
| 96472 | `ubriaca` | noun | 0 | femminile singolare di ubriaco | `ubriaco` | [ubriaca](https://it.wiktionary.org/w/index.php?title=ubriaca&oldid=3850263), [ubriaco](https://it.wiktionary.org/w/index.php?title=ubriaco&oldid=4066548) |
| 96876 | `dilazioni` | verb | 4 | terza persona singolare dell'imperativo presente di dilazionare | `dilazionare` | [dilazioni](https://it.wiktionary.org/w/index.php?title=dilazioni&oldid=3919405), [dilazionare](https://it.wiktionary.org/w/index.php?title=dilazionare&oldid=3850429) |
| 96958 | `emozioni` | verb | 1 | prima persona singolare del congiuntivo presente di emozionare | `emozionare` | [emozioni](https://it.wiktionary.org/w/index.php?title=emozioni&oldid=3842609), [emozionare](https://it.wiktionary.org/w/index.php?title=emozionare&oldid=3989324) |
| 96958 | `emozioni` | verb | 2 | seconda persona singolare del congiuntivo presente di emozionare | `emozionare` | [emozioni](https://it.wiktionary.org/w/index.php?title=emozioni&oldid=3842609), [emozionare](https://it.wiktionary.org/w/index.php?title=emozionare&oldid=3989324) |
| 96958 | `emozioni` | verb | 3 | terza persona singolare del congiuntivo presente di emozionare | `emozionare` | [emozioni](https://it.wiktionary.org/w/index.php?title=emozioni&oldid=3842609), [emozionare](https://it.wiktionary.org/w/index.php?title=emozionare&oldid=3989324) |
| 97073 | `fidelizzazioni` | noun | 0 | plurale di fidelizzazione | `fidelizzazione` | [fidelizzazioni](https://it.wiktionary.org/w/index.php?title=fidelizzazioni&oldid=2929061), [fidelizzazione](https://it.wiktionary.org/w/index.php?title=fidelizzazione&oldid=3639422) |
| 97086 | `flagellazioni` | noun | 0 | plurale di flagellazione | `flagellazione` | [flagellazioni](https://it.wiktionary.org/w/index.php?title=flagellazioni&oldid=3405605), [flagellazione](https://it.wiktionary.org/w/index.php?title=flagellazione&oldid=3928959) |
| 97137 | `funzioni` | verb | 2 | seconda persona singolare del congiuntivo presente di funzionare | `funzionare` | [funzioni](https://it.wiktionary.org/w/index.php?title=funzioni&oldid=3944664), [funzionare](https://it.wiktionary.org/w/index.php?title=funzionare&oldid=4009800) |
| 97137 | `funzioni` | verb | 3 | terza persona singolare del congiuntivo presente di funzionare | `funzionare` | [funzioni](https://it.wiktionary.org/w/index.php?title=funzioni&oldid=3944664), [funzionare](https://it.wiktionary.org/w/index.php?title=funzionare&oldid=4009800) |
| 97137 | `funzioni` | verb | 4 | terza persona singolare dell'imperativo presente di funzionare | `funzionare` | [funzioni](https://it.wiktionary.org/w/index.php?title=funzioni&oldid=3944664), [funzionare](https://it.wiktionary.org/w/index.php?title=funzionare&oldid=4009800) |
| 97158 | `glaciazioni` | noun | 0 | plurale di glaciazione | `glaciazione` | [glaciazioni](https://it.wiktionary.org/w/index.php?title=glaciazioni&oldid=3886596), [glaciazione](https://it.wiktionary.org/w/index.php?title=glaciazione&oldid=4053924) |
| 97370 | `aguzzi` | verb | 1 | prima persona singolare del congiuntivo presente di aguzzare | `aguzzare` | [aguzzi](https://it.wiktionary.org/w/index.php?title=aguzzi&oldid=3944216), [aguzzare](https://it.wiktionary.org/w/index.php?title=aguzzare&oldid=4042482) |
| 97370 | `aguzzi` | verb | 2 | seconda persona singolare del congiuntivo presente di aguzzare | `aguzzare` | [aguzzi](https://it.wiktionary.org/w/index.php?title=aguzzi&oldid=3944216), [aguzzare](https://it.wiktionary.org/w/index.php?title=aguzzare&oldid=4042482) |
| 97370 | `aguzzi` | verb | 3 | terza persona singolare del congiuntivo presente di aguzzare | `aguzzare` | [aguzzi](https://it.wiktionary.org/w/index.php?title=aguzzi&oldid=3944216), [aguzzare](https://it.wiktionary.org/w/index.php?title=aguzzare&oldid=4042482) |
| 97370 | `aguzzi` | verb | 4 | terza persona singolare dell'imperativo presente di aguzzare | `aguzzare` | [aguzzi](https://it.wiktionary.org/w/index.php?title=aguzzi&oldid=3944216), [aguzzare](https://it.wiktionary.org/w/index.php?title=aguzzare&oldid=4042482) |
| 97555 | `legiferazioni` | noun | 0 | plurale di legiferazione | `legiferazione` | [legiferazioni](https://it.wiktionary.org/w/index.php?title=legiferazioni&oldid=2987010), [legiferazione](https://it.wiktionary.org/w/index.php?title=legiferazione&oldid=3419136) |
| 97617 | `meccanizzazioni` | noun | 0 | plurale di meccanizzazione | `meccanizzazione` | [meccanizzazioni](https://it.wiktionary.org/w/index.php?title=meccanizzazioni&oldid=2996581), [meccanizzazione](https://it.wiktionary.org/w/index.php?title=meccanizzazione&oldid=3893243) |
| 97968 | `ominazioni` | noun | 0 | plurale di ominazione | `ominazione` | [ominazioni](https://it.wiktionary.org/w/index.php?title=ominazioni&oldid=3813719), [ominazione](https://it.wiktionary.org/w/index.php?title=ominazione&oldid=3826702) |
| 98215 | `istintivi` | noun | 0 | maschile plurale di istintivo | `istintivo` | [istintivi](https://it.wiktionary.org/w/index.php?title=istintivi&oldid=3927553), [istintivo](https://it.wiktionary.org/w/index.php?title=istintivo&oldid=3984016) |
| 98297 | `protrazioni` | noun | 0 | plurale di protrazione | `protrazione` | [protrazioni](https://it.wiktionary.org/w/index.php?title=protrazioni&oldid=3647497), [protrazione](https://it.wiktionary.org/w/index.php?title=protrazione&oldid=3791214) |
| 98359 | `razioni` | verb | 1 | prima persona singolare del congiuntivo presente di razionare | `razionare` | [razioni](https://it.wiktionary.org/w/index.php?title=razioni&oldid=3837237), [razionare](https://it.wiktionary.org/w/index.php?title=razionare&oldid=3939097) |
| 98359 | `razioni` | verb | 2 | seconda persona singolare del congiuntivo presente di razionare | `razionare` | [razioni](https://it.wiktionary.org/w/index.php?title=razioni&oldid=3837237), [razionare](https://it.wiktionary.org/w/index.php?title=razionare&oldid=3939097) |
| 98359 | `razioni` | verb | 3 | terza persona singolare del congiuntivo presente di razionare | `razionare` | [razioni](https://it.wiktionary.org/w/index.php?title=razioni&oldid=3837237), [razionare](https://it.wiktionary.org/w/index.php?title=razionare&oldid=3939097) |
| 98359 | `razioni` | verb | 4 | terza persona singolare dell'imperativo presente di razionare | `razionare` | [razioni](https://it.wiktionary.org/w/index.php?title=razioni&oldid=3837237), [razionare](https://it.wiktionary.org/w/index.php?title=razionare&oldid=3939097) |
| 98525 | `scomposizioni` | noun | 0 | plurale di scomposizione | `scomposizione` | [scomposizioni](https://it.wiktionary.org/w/index.php?title=scomposizioni&oldid=3091083), [scomposizione](https://it.wiktionary.org/w/index.php?title=scomposizione&oldid=3995517) |
| 98551 | `secrezioni` | noun | 0 | plurale di secrezione | `secrezione` | [secrezioni](https://it.wiktionary.org/w/index.php?title=secrezioni&oldid=3095299), [secrezione](https://it.wiktionary.org/w/index.php?title=secrezione&oldid=4066868) |
| 98671 | `sovrappopolazioni` | noun | 0 | plurale di sovrappopolazione | `sovrappopolazione` | [sovrappopolazioni](https://it.wiktionary.org/w/index.php?title=sovrappopolazioni&oldid=3114766), [sovrappopolazione](https://it.wiktionary.org/w/index.php?title=sovrappopolazione&oldid=3838824) |
| 98677 | `sovvenzioni` | verb | 1 | prima persona singolare del congiuntivo presente di sovvenzionare | `sovvenzionare` | [sovvenzioni](https://it.wiktionary.org/w/index.php?title=sovvenzioni&oldid=3837700), [sovvenzionare](https://it.wiktionary.org/w/index.php?title=sovvenzionare&oldid=3443439) |
| 98677 | `sovvenzioni` | verb | 2 | seconda persona singolare del congiuntivo presente di sovvenzionare | `sovvenzionare` | [sovvenzioni](https://it.wiktionary.org/w/index.php?title=sovvenzioni&oldid=3837700), [sovvenzionare](https://it.wiktionary.org/w/index.php?title=sovvenzionare&oldid=3443439) |
| 98677 | `sovvenzioni` | verb | 3 | terza persona singolare del congiuntivo presente di sovvenzionare | `sovvenzionare` | [sovvenzioni](https://it.wiktionary.org/w/index.php?title=sovvenzioni&oldid=3837700), [sovvenzionare](https://it.wiktionary.org/w/index.php?title=sovvenzionare&oldid=3443439) |
| 98677 | `sovvenzioni` | verb | 4 | terza persona singolare dell'imperativo presente di sovvenzionare | `sovvenzionare` | [sovvenzioni](https://it.wiktionary.org/w/index.php?title=sovvenzioni&oldid=3837700), [sovvenzionare](https://it.wiktionary.org/w/index.php?title=sovvenzionare&oldid=3443439) |
| 98683 | `specificazioni` | noun | 0 | plurale di specificazione | `specificazione` | [specificazioni](https://it.wiktionary.org/w/index.php?title=specificazioni&oldid=3117180), [specificazione](https://it.wiktionary.org/w/index.php?title=specificazione&oldid=3851312) |
| 98697 | `sponsorizzazioni` | noun | 0 | plurale di sponsorizzazione | `sponsorizzazione` | [sponsorizzazioni](https://it.wiktionary.org/w/index.php?title=sponsorizzazioni&oldid=3120458), [sponsorizzazione](https://it.wiktionary.org/w/index.php?title=sponsorizzazione&oldid=4251324) |
| 98699 | `sproporzioni` | noun | 0 | plurale di sproporzione | `sproporzione` | [sproporzioni](https://it.wiktionary.org/w/index.php?title=sproporzioni&oldid=3444050), [sproporzione](https://it.wiktionary.org/w/index.php?title=sproporzione&oldid=4056009) |
| 98748 | `superconduzioni` | noun | 0 | plurale di superconduzione | `superconduzione` | [superconduzioni](https://it.wiktionary.org/w/index.php?title=superconduzioni&oldid=3131128), [superconduzione](https://it.wiktionary.org/w/index.php?title=superconduzione&oldid=3445353) |
| 98768 | `svalutazioni` | noun | 0 | plurale di svalutazione | `svalutazione` | [svalutazioni](https://it.wiktionary.org/w/index.php?title=svalutazioni&oldid=3132449), [svalutazione](https://it.wiktionary.org/w/index.php?title=svalutazione&oldid=3482883) |
| 99119 | `scolte` | noun | 0 | plurale di scolta | `scolta` | [scolte](https://it.wiktionary.org/w/index.php?title=scolte&oldid=3090699), [scolta](https://it.wiktionary.org/w/index.php?title=scolta&oldid=3440106) |
| 102073 | `fantaccina` | noun | 0 | femminile singolare di fantaccino | `fantaccino` | [fantaccina](https://it.wiktionary.org/w/index.php?title=fantaccina&oldid=2926704), [fantaccino](https://it.wiktionary.org/w/index.php?title=fantaccino&oldid=3898145) |
| 102092 | `economa` | adj | 0 | femminile singolare di economo | `economo` | [economa](https://it.wiktionary.org/w/index.php?title=economa&oldid=2915295), [economo](https://it.wiktionary.org/w/index.php?title=economo&oldid=4052935) |
| 102145 | `antenata` | noun | 0 | femminile singolare di antenato | `antenato` | [antenata](https://it.wiktionary.org/w/index.php?title=antenata&oldid=3955230), [antenato](https://it.wiktionary.org/w/index.php?title=antenato&oldid=4012635) |
| 102148 | `predecessora` | noun | 0 | femminile singolare di predecessore | `predecessore` | [predecessora](https://it.wiktionary.org/w/index.php?title=predecessora&oldid=3647022), [predecessore](https://it.wiktionary.org/w/index.php?title=predecessore&oldid=4031631) |
| 102149 | `scultrice` | noun | 0 | femminile singolare di scultore | `scultore` | [scultrice](https://it.wiktionary.org/w/index.php?title=scultrice&oldid=3587436), [scultore](https://it.wiktionary.org/w/index.php?title=scultore&oldid=4054067) |
| 102153 | `avventori` | noun | 0 | maschile plurale di avventore | `avventore` | [avventori](https://it.wiktionary.org/w/index.php?title=avventori&oldid=4075822), [avventore](https://it.wiktionary.org/w/index.php?title=avventore&oldid=4053607) |
| 102154 | `avventrice` | noun | 0 | femminile singolare di avventore | `avventore` | [avventrice](https://it.wiktionary.org/w/index.php?title=avventrice&oldid=2842851), [avventore](https://it.wiktionary.org/w/index.php?title=avventore&oldid=4053607) |
| 102334 | `sudate` | verb | 1 | seconda persona plurale dell'indicativo presente di sudare | `sudare` | [sudate](https://it.wiktionary.org/w/index.php?title=sudate&oldid=3837835), [sudare](https://it.wiktionary.org/w/index.php?title=sudare&oldid=3934644) |
| 102334 | `sudate` | verb | 2 | seconda persona plurale dell'imperativo presente di sudare | `sudare` | [sudate](https://it.wiktionary.org/w/index.php?title=sudate&oldid=3837835), [sudare](https://it.wiktionary.org/w/index.php?title=sudare&oldid=3934644) |
| 102349 | `ottuse` | verb | 0 | participio passato plurale femminile di ottundere | `ottundere` | [ottuse](https://it.wiktionary.org/w/index.php?title=ottuse&oldid=3944214), [ottundere](https://it.wiktionary.org/w/index.php?title=ottundere&oldid=4037938) |
| 102433 | `moli` | verb | 1 | prima persona singolare del congiuntivo presente di molare | `molare` | [moli](https://it.wiktionary.org/w/index.php?title=moli&oldid=3802648), [molare](https://it.wiktionary.org/w/index.php?title=molare&oldid=4008312) |
| 102433 | `moli` | verb | 2 | seconda persona singolare del congiuntivo presente di molare | `molare` | [moli](https://it.wiktionary.org/w/index.php?title=moli&oldid=3802648), [molare](https://it.wiktionary.org/w/index.php?title=molare&oldid=4008312) |
| 102433 | `moli` | verb | 3 | terza persona singolare del congiuntivo presente di molare | `molare` | [moli](https://it.wiktionary.org/w/index.php?title=moli&oldid=3802648), [molare](https://it.wiktionary.org/w/index.php?title=molare&oldid=4008312) |
| 102433 | `moli` | verb | 4 | terza persona singolare dell'imperativo presente di molare | `molare` | [moli](https://it.wiktionary.org/w/index.php?title=moli&oldid=3802648), [molare](https://it.wiktionary.org/w/index.php?title=molare&oldid=4008312) |
| 102544 | `enteroclismi` | noun | 0 | plurale di enteroclisma | `enteroclisma` | [enteroclismi](https://it.wiktionary.org/w/index.php?title=enteroclismi&oldid=2918805), [enteroclisma](https://it.wiktionary.org/w/index.php?title=enteroclisma&oldid=3638627) |
| 102619 | `sprovveduta` | noun | 0 | femminile di sprovveduto | `sprovveduto` | [sprovveduta](https://it.wiktionary.org/w/index.php?title=sprovveduta&oldid=3662377), [sprovveduto](https://it.wiktionary.org/w/index.php?title=sprovveduto&oldid=4048585) |
| 102767 | `pugni` | verb | 1 | prima persona singolare del congiuntivo presente di pugnare | `pugnare` | [pugni](https://it.wiktionary.org/w/index.php?title=pugni&oldid=3934342), [pugnare](https://it.wiktionary.org/w/index.php?title=pugnare&oldid=3944493) |
| 102767 | `pugni` | verb | 2 | seconda persona singolare del congiuntivo presente di pugnare | `pugnare` | [pugni](https://it.wiktionary.org/w/index.php?title=pugni&oldid=3934342), [pugnare](https://it.wiktionary.org/w/index.php?title=pugnare&oldid=3944493) |
| 102767 | `pugni` | verb | 3 | terza persona singolare del congiuntivo presente di pugnare | `pugnare` | [pugni](https://it.wiktionary.org/w/index.php?title=pugni&oldid=3934342), [pugnare](https://it.wiktionary.org/w/index.php?title=pugnare&oldid=3944493) |
| 102863 | `declini` | verb | 1 | prima persona singolare del congiuntivo presente di declinare | `declinare` | [declini](https://it.wiktionary.org/w/index.php?title=declini&oldid=3835625), [declinare](https://it.wiktionary.org/w/index.php?title=declinare&oldid=4000902) |
| 102863 | `declini` | verb | 2 | seconda persona singolare del congiuntivo presente di declinare | `declinare` | [declini](https://it.wiktionary.org/w/index.php?title=declini&oldid=3835625), [declinare](https://it.wiktionary.org/w/index.php?title=declinare&oldid=4000902) |
| 102863 | `declini` | verb | 3 | terza persona singolare del congiuntivo presente di declinare | `declinare` | [declini](https://it.wiktionary.org/w/index.php?title=declini&oldid=3835625), [declinare](https://it.wiktionary.org/w/index.php?title=declinare&oldid=4000902) |
| 102863 | `declini` | verb | 4 | terza persona singolare dell'imperativo presente di declinare | `declinare` | [declini](https://it.wiktionary.org/w/index.php?title=declini&oldid=3835625), [declinare](https://it.wiktionary.org/w/index.php?title=declinare&oldid=4000902) |
| 102910 | `spruzzini` | noun | 0 | plurale di spruzzino | `spruzzino` | [spruzzini](https://it.wiktionary.org/w/index.php?title=spruzzini&oldid=3838854), [spruzzino](https://it.wiktionary.org/w/index.php?title=spruzzino&oldid=4044439) |
| 104992 | `pregio` | verb | 0 | prima persona singolare dell'indicativo presente di pregiare | `pregiare` | [pregio](https://it.wiktionary.org/w/index.php?title=pregio&oldid=4056542), [pregiare](https://it.wiktionary.org/w/index.php?title=pregiare&oldid=3955378) |
| 105019 | `pedagogie` | noun | 0 | plurale di pedagogia | `pedagogia` | [pedagogie](https://it.wiktionary.org/w/index.php?title=pedagogie&oldid=3645789), [pedagogia](https://it.wiktionary.org/w/index.php?title=pedagogia&oldid=4076069) |
| 105922 | `gallato` | adj | 0 | participio passato di gallare | `gallare` | [gallato](https://it.wiktionary.org/w/index.php?title=gallato&oldid=3295393), [gallare](https://it.wiktionary.org/w/index.php?title=gallare&oldid=3407668) |
| 106016 | `smidollata` | noun | 0 | femminile singolare di smidollato | `smidollato` | [smidollata](https://it.wiktionary.org/w/index.php?title=smidollata&oldid=3174042), [smidollato](https://it.wiktionary.org/w/index.php?title=smidollato&oldid=4001627) |
| 106267 | `valichi` | verb | 1 | prima persona singolare del congiuntivo presente di valicare | `valicare` | [valichi](https://it.wiktionary.org/w/index.php?title=valichi&oldid=3792271), [valicare](https://it.wiktionary.org/w/index.php?title=valicare&oldid=4036015) |
| 106267 | `valichi` | verb | 2 | seconda persona singolare del congiuntivo presente di valicare | `valicare` | [valichi](https://it.wiktionary.org/w/index.php?title=valichi&oldid=3792271), [valicare](https://it.wiktionary.org/w/index.php?title=valicare&oldid=4036015) |
| 106267 | `valichi` | verb | 3 | terza persona singolare del congiuntivo presente di valicare | `valicare` | [valichi](https://it.wiktionary.org/w/index.php?title=valichi&oldid=3792271), [valicare](https://it.wiktionary.org/w/index.php?title=valicare&oldid=4036015) |
| 106267 | `valichi` | verb | 4 | terza persona singolare dell'imperativo presente di valicare | `valicare` | [valichi](https://it.wiktionary.org/w/index.php?title=valichi&oldid=3792271), [valicare](https://it.wiktionary.org/w/index.php?title=valicare&oldid=4036015) |
| 106275 | `cisti` | noun | 0 | plurale di ciste | `ciste` | [cisti](https://it.wiktionary.org/w/index.php?title=cisti&oldid=3963998), [ciste](https://it.wiktionary.org/w/index.php?title=ciste&oldid=3893586) |
| 106310 | `assaltatrice` | noun | 0 | femminile singolare di assaltatore | `assaltatore` | [assaltatrice](https://it.wiktionary.org/w/index.php?title=assaltatrice&oldid=3173468), [assaltatore](https://it.wiktionary.org/w/index.php?title=assaltatore&oldid=3952007) |
| 106319 | `appaltatrice` | noun | 0 | femminile singolare di appaltatore | `appaltatore` | [appaltatrice](https://it.wiktionary.org/w/index.php?title=appaltatrice&oldid=3173464), [appaltatore](https://it.wiktionary.org/w/index.php?title=appaltatore&oldid=3890870) |
| 106320 | `asfaltatrice` | noun | 0 | femminile singolare di asfaltatore | `asfaltatore` | [asfaltatrice](https://it.wiktionary.org/w/index.php?title=asfaltatrice&oldid=2836391), [asfaltatore](https://it.wiktionary.org/w/index.php?title=asfaltatore&oldid=3379926) |
| 106394 | `cincischio` | verb | 0 | prima persona singolare dell'indicativo presente di cincischiare | `cincischiare` | [cincischio](https://it.wiktionary.org/w/index.php?title=cincischio&oldid=3898365), [cincischiare](https://it.wiktionary.org/w/index.php?title=cincischiare&oldid=4009277) |
| 106515 | `taggiaschi` | noun | 0 | plurale di taggiasco | `taggiasco` | [taggiaschi](https://it.wiktionary.org/w/index.php?title=taggiaschi&oldid=3651167), [taggiasco](https://it.wiktionary.org/w/index.php?title=taggiasco&oldid=3651168) |
| 106517 | `taggiasche` | noun | 0 | femminile plurale di taggiasco | `taggiasco` | [taggiasche](https://it.wiktionary.org/w/index.php?title=taggiasche&oldid=3651166), [taggiasco](https://it.wiktionary.org/w/index.php?title=taggiasco&oldid=3651168) |
| 106519 | `taggiasca` | noun | 0 | femminile di taggiasco | `taggiasco` | [taggiasca](https://it.wiktionary.org/w/index.php?title=taggiasca&oldid=3135750), [taggiasco](https://it.wiktionary.org/w/index.php?title=taggiasco&oldid=3651168) |
| 107017 | `sbozzo` | verb | 0 | prima persona singolare dell'indicativo presente di sbozzare | `sbozzare` | [sbozzo](https://it.wiktionary.org/w/index.php?title=sbozzo&oldid=4075976), [sbozzare](https://it.wiktionary.org/w/index.php?title=sbozzare&oldid=3769164) |
| 107074 | `colmi` | verb | 1 | prima persona singolare del congiuntivo presente di colmare | `colmare` | [colmi](https://it.wiktionary.org/w/index.php?title=colmi&oldid=3735153), [colmare](https://it.wiktionary.org/w/index.php?title=colmare&oldid=3963326) |
| 107074 | `colmi` | verb | 2 | seconda persona singolare del congiuntivo presente di colmare | `colmare` | [colmi](https://it.wiktionary.org/w/index.php?title=colmi&oldid=3735153), [colmare](https://it.wiktionary.org/w/index.php?title=colmare&oldid=3963326) |
| 107074 | `colmi` | verb | 3 | terza persona singolare del congiuntivo presente di colmare | `colmare` | [colmi](https://it.wiktionary.org/w/index.php?title=colmi&oldid=3735153), [colmare](https://it.wiktionary.org/w/index.php?title=colmare&oldid=3963326) |
| 107074 | `colmi` | verb | 4 | terza persona singolare dell'imperativo presente di colmare | `colmare` | [colmi](https://it.wiktionary.org/w/index.php?title=colmi&oldid=3735153), [colmare](https://it.wiktionary.org/w/index.php?title=colmare&oldid=3963326) |
| 107261 | `dimentica` | verb | 1 | seconda persona singolare dell'imperativo presente di dimenticare | `dimenticare` | [dimentica](https://it.wiktionary.org/w/index.php?title=dimentica&oldid=3879921), [dimenticare](https://it.wiktionary.org/w/index.php?title=dimenticare&oldid=4047464) |
| 107263 | `dimentichi` | verb | 1 | prima persona singolare del congiuntivo presente di dimenticare | `dimenticare` | [dimentichi](https://it.wiktionary.org/w/index.php?title=dimentichi&oldid=3919417), [dimenticare](https://it.wiktionary.org/w/index.php?title=dimenticare&oldid=4047464) |
| 107263 | `dimentichi` | verb | 2 | seconda persona singolare del congiuntivo presente di dimenticare | `dimenticare` | [dimentichi](https://it.wiktionary.org/w/index.php?title=dimentichi&oldid=3919417), [dimenticare](https://it.wiktionary.org/w/index.php?title=dimenticare&oldid=4047464) |
| 107263 | `dimentichi` | verb | 3 | terza persona singolare del congiuntivo presente di dimenticare | `dimenticare` | [dimentichi](https://it.wiktionary.org/w/index.php?title=dimentichi&oldid=3919417), [dimenticare](https://it.wiktionary.org/w/index.php?title=dimenticare&oldid=4047464) |
| 107263 | `dimentichi` | verb | 4 | terza persona singolare dell'imperativo presente di dimenticare | `dimenticare` | [dimentichi](https://it.wiktionary.org/w/index.php?title=dimentichi&oldid=3919417), [dimenticare](https://it.wiktionary.org/w/index.php?title=dimenticare&oldid=4047464) |
| 107335 | `mondano` | verb | 0 | terza persona plurale dell'indicativo presente di mondare | `mondare` | [mondano](https://it.wiktionary.org/w/index.php?title=mondano&oldid=3997525), [mondare](https://it.wiktionary.org/w/index.php?title=mondare&oldid=4012162) |
| 107350 | `fissi` | verb | 2 | prima persona singolare del congiuntivo presente di fissare | `fissare` | [fissi](https://it.wiktionary.org/w/index.php?title=fissi&oldid=3836017), [fissare](https://it.wiktionary.org/w/index.php?title=fissare&oldid=3968788) |
| 107350 | `fissi` | verb | 3 | seconda persona singolare del congiuntivo presente di fissare | `fissare` | [fissi](https://it.wiktionary.org/w/index.php?title=fissi&oldid=3836017), [fissare](https://it.wiktionary.org/w/index.php?title=fissare&oldid=3968788) |
| 107350 | `fissi` | verb | 4 | terza persona singolare del congiuntivo presente di fissare | `fissare` | [fissi](https://it.wiktionary.org/w/index.php?title=fissi&oldid=3836017), [fissare](https://it.wiktionary.org/w/index.php?title=fissare&oldid=3968788) |
| 107350 | `fissi` | verb | 5 | terza persona singolare dell'imperativo presente di fissare | `fissare` | [fissi](https://it.wiktionary.org/w/index.php?title=fissi&oldid=3836017), [fissare](https://it.wiktionary.org/w/index.php?title=fissare&oldid=3968788) |
| 107397 | `scrocconi` | adj | 0 | plurale di scroccone | `scroccone` | [scrocconi](https://it.wiktionary.org/w/index.php?title=scrocconi&oldid=3336389), [scroccone](https://it.wiktionary.org/w/index.php?title=scroccone&oldid=3649357) |
| 107555 | `pippe` | noun | 0 | plurale di pippa | `pippa` | [pippe](https://it.wiktionary.org/w/index.php?title=pippe&oldid=3025356), [pippa](https://it.wiktionary.org/w/index.php?title=pippa&oldid=3947795) |
| 107814 | `estroversa` | noun | 0 | femminile di estroverso | `estroverso` | [estroversa](https://it.wiktionary.org/w/index.php?title=estroversa&oldid=2924128), [estroverso](https://it.wiktionary.org/w/index.php?title=estroverso&oldid=3962911) |
| 108289 | `abitate` | verb | 2 | seconda persona plurale dell'imperativo presente di abitare | `abitare` | [abitate](https://it.wiktionary.org/w/index.php?title=abitate&oldid=3985144), [abitare](https://it.wiktionary.org/w/index.php?title=abitare&oldid=3973250) |
| 108771 | `diciottesima` | adj | 0 | femminile di diciottesimo | `diciottesimo` | [diciottesima](https://it.wiktionary.org/w/index.php?title=diciottesima&oldid=3898682), [diciottesimo](https://it.wiktionary.org/w/index.php?title=diciottesimo&oldid=3898676) |
| 108772 | `diciottesimi` | adj | 0 | plurale di diciottesimo | `diciottesimo` | [diciottesimi](https://it.wiktionary.org/w/index.php?title=diciottesimi&oldid=3898683), [diciottesimo](https://it.wiktionary.org/w/index.php?title=diciottesimo&oldid=3898676) |
| 108773 | `diciottesime` | adj | 0 | femminile plurale di diciottesimo | `diciottesimo` | [diciottesime](https://it.wiktionary.org/w/index.php?title=diciottesime&oldid=3898684), [diciottesimo](https://it.wiktionary.org/w/index.php?title=diciottesimo&oldid=3898676) |
| 108856 | `desti` | verb | 3 | seconda persona singolare del congiuntivo presente di destare | `destare` | [desti](https://it.wiktionary.org/w/index.php?title=desti&oldid=4005545), [destare](https://it.wiktionary.org/w/index.php?title=destare&oldid=3954577) |
| 108856 | `desti` | verb | 4 | terza persona singolare dell'imperativo presente di destare | `destare` | [desti](https://it.wiktionary.org/w/index.php?title=desti&oldid=4005545), [destare](https://it.wiktionary.org/w/index.php?title=destare&oldid=3954577) |
| 108960 | `vieto` | verb | 0 | prima persona singolare dell'indicativo presente di vietare | `vietare` | [vieto](https://it.wiktionary.org/w/index.php?title=vieto&oldid=3971830), [vietare](https://it.wiktionary.org/w/index.php?title=vietare&oldid=4051474) |
| 109586 | `accordi` | verb | 1 | prima persona singolare del congiuntivo di accordare | `accordare` | [accordi](https://it.wiktionary.org/w/index.php?title=accordi&oldid=3979293), [accordare](https://it.wiktionary.org/w/index.php?title=accordare&oldid=3973674) |
| 109586 | `accordi` | verb | 2 | seconda persona singolare del congiuntivo presente di accordare | `accordare` | [accordi](https://it.wiktionary.org/w/index.php?title=accordi&oldid=3979293), [accordare](https://it.wiktionary.org/w/index.php?title=accordare&oldid=3973674) |
| 109586 | `accordi` | verb | 3 | terza persona singolare del congiuntivo presente di accordare | `accordare` | [accordi](https://it.wiktionary.org/w/index.php?title=accordi&oldid=3979293), [accordare](https://it.wiktionary.org/w/index.php?title=accordare&oldid=3973674) |
| 109586 | `accordi` | verb | 4 | terza persona singolare dell'imperativo presente di accordare | `accordare` | [accordi](https://it.wiktionary.org/w/index.php?title=accordi&oldid=3979293), [accordare](https://it.wiktionary.org/w/index.php?title=accordare&oldid=3973674) |
| 109596 | `archivi` | verb | 1 | prima persona singolare del congiuntivo presente di archiviare | `archiviare` | [archivi](https://it.wiktionary.org/w/index.php?title=archivi&oldid=3955185), [archiviare](https://it.wiktionary.org/w/index.php?title=archiviare&oldid=3976564) |
| 109596 | `archivi` | verb | 2 | seconda persona singolare del congiuntivo presente di archiviare | `archiviare` | [archivi](https://it.wiktionary.org/w/index.php?title=archivi&oldid=3955185), [archiviare](https://it.wiktionary.org/w/index.php?title=archiviare&oldid=3976564) |
| 109596 | `archivi` | verb | 3 | terza persona singolare del congiuntivo presente di archiviare | `archiviare` | [archivi](https://it.wiktionary.org/w/index.php?title=archivi&oldid=3955185), [archiviare](https://it.wiktionary.org/w/index.php?title=archiviare&oldid=3976564) |
| 109596 | `archivi` | verb | 4 | terza persona singolare dell'imperativo presente di archiviare | `archiviare` | [archivi](https://it.wiktionary.org/w/index.php?title=archivi&oldid=3955185), [archiviare](https://it.wiktionary.org/w/index.php?title=archiviare&oldid=3976564) |
| 110160 | `tue` | adj | 0 | femminile plurale di tuo | `tuo` | [tue](https://it.wiktionary.org/w/index.php?title=tue&oldid=3898880), [tuo](https://it.wiktionary.org/w/index.php?title=tuo&oldid=4011942) |
| 110803 | `liquidi` | noun | 0 | plurale di liquido | `liquido` | [liquidi](https://it.wiktionary.org/w/index.php?title=liquidi&oldid=3920712), [liquido](https://it.wiktionary.org/w/index.php?title=liquido&oldid=3927657) |
| 110842 | `veicoli` | verb | 1 | prima persona singolare del congiuntivo presente di veicolare | `veicolare` | [veicoli](https://it.wiktionary.org/w/index.php?title=veicoli&oldid=4049592), [veicolare](https://it.wiktionary.org/w/index.php?title=veicolare&oldid=4061117) |
| 110842 | `veicoli` | verb | 2 | seconda persona singolare del congiuntivo presente di veicolare | `veicolare` | [veicoli](https://it.wiktionary.org/w/index.php?title=veicoli&oldid=4049592), [veicolare](https://it.wiktionary.org/w/index.php?title=veicolare&oldid=4061117) |
| 110842 | `veicoli` | verb | 3 | terza persona singolare del congiuntivo presente di veicolare | `veicolare` | [veicoli](https://it.wiktionary.org/w/index.php?title=veicoli&oldid=4049592), [veicolare](https://it.wiktionary.org/w/index.php?title=veicolare&oldid=4061117) |
| 110842 | `veicoli` | verb | 4 | terza persona singolare dell'imperativo presente di veicolare | `veicolare` | [veicoli](https://it.wiktionary.org/w/index.php?title=veicoli&oldid=4049592), [veicolare](https://it.wiktionary.org/w/index.php?title=veicolare&oldid=4061117) |
| 110853 | `biochimica` | adj | 0 | femminile di biochimico | `biochimico` | [biochimica](https://it.wiktionary.org/w/index.php?title=biochimica&oldid=4076026), [biochimico](https://it.wiktionary.org/w/index.php?title=biochimico&oldid=3893458) |
| 111291 | `ciurmatori` | noun | 0 | plurale di ciurmatore | `ciurmatore` | [ciurmatori](https://it.wiktionary.org/w/index.php?title=ciurmatori&oldid=2869740), [ciurmatore](https://it.wiktionary.org/w/index.php?title=ciurmatore&oldid=3634804) |
| 111295 | `ciurmadori` | noun | 0 | plurale di ciurmadore | `ciurmadore` | [ciurmadori](https://it.wiktionary.org/w/index.php?title=ciurmadori&oldid=2869721), [ciurmadore](https://it.wiktionary.org/w/index.php?title=ciurmadore&oldid=2869720) |
| 111518 | `validi` | verb | 2 | seconda persona singolare del congiuntivo presente di validare | `validare` | [validi](https://it.wiktionary.org/w/index.php?title=validi&oldid=3871905), [validare](https://it.wiktionary.org/w/index.php?title=validare&oldid=3739239) |
| 111518 | `validi` | verb | 3 | terza persona singolare del congiuntivo presente di validare | `validare` | [validi](https://it.wiktionary.org/w/index.php?title=validi&oldid=3871905), [validare](https://it.wiktionary.org/w/index.php?title=validare&oldid=3739239) |
| 111518 | `validi` | verb | 4 | terza persona singolare dell'imperativo presente di validare | `validare` | [validi](https://it.wiktionary.org/w/index.php?title=validi&oldid=3871905), [validare](https://it.wiktionary.org/w/index.php?title=validare&oldid=3739239) |
| 111539 | `abbottonate` | verb | 0 | participio passato plurale femminile di abbottonare | `abbottonare` | [abbottonate](https://it.wiktionary.org/w/index.php?title=abbottonate&oldid=3899050), [abbottonare](https://it.wiktionary.org/w/index.php?title=abbottonare&oldid=3963760) |
| 111539 | `abbottonate` | verb | 1 | seconda persona plurale dell'indicativo presente di abbottonare | `abbottonare` | [abbottonate](https://it.wiktionary.org/w/index.php?title=abbottonate&oldid=3899050), [abbottonare](https://it.wiktionary.org/w/index.php?title=abbottonare&oldid=3963760) |
| 111539 | `abbottonate` | verb | 2 | seconda persona plurale dell'imperativo presente di abbottonare | `abbottonare` | [abbottonate](https://it.wiktionary.org/w/index.php?title=abbottonate&oldid=3899050), [abbottonare](https://it.wiktionary.org/w/index.php?title=abbottonare&oldid=3963760) |
| 111582 | `meccaniche` | noun | 0 | femminile plurale di meccanico | `meccanico` | [meccaniche](https://it.wiktionary.org/w/index.php?title=meccaniche&oldid=3996334), [meccanico](https://it.wiktionary.org/w/index.php?title=meccanico&oldid=4027594) |
| 111592 | `motivi` | verb | 1 | prima persona singolare del congiuntivo presente di motivare | `motivare` | [motivi](https://it.wiktionary.org/w/index.php?title=motivi&oldid=3972619), [motivare](https://it.wiktionary.org/w/index.php?title=motivare&oldid=3938670) |
| 111592 | `motivi` | verb | 2 | seconda persona singolare del congiuntivo presente di motivare | `motivare` | [motivi](https://it.wiktionary.org/w/index.php?title=motivi&oldid=3972619), [motivare](https://it.wiktionary.org/w/index.php?title=motivare&oldid=3938670) |
| 111592 | `motivi` | verb | 3 | terza persona singolare del congiuntivo presente di motivare | `motivare` | [motivi](https://it.wiktionary.org/w/index.php?title=motivi&oldid=3972619), [motivare](https://it.wiktionary.org/w/index.php?title=motivare&oldid=3938670) |
| 111592 | `motivi` | verb | 4 | terza persona singolare dell'imperativo presente di motivare | `motivare` | [motivi](https://it.wiktionary.org/w/index.php?title=motivi&oldid=3972619), [motivare](https://it.wiktionary.org/w/index.php?title=motivare&oldid=3938670) |
| 111601 | `binari` | noun | 0 | plurale di binario | `binario` | [binari](https://it.wiktionary.org/w/index.php?title=binari&oldid=4045544), [binario](https://it.wiktionary.org/w/index.php?title=binario&oldid=4075760) |
| 111612 | `scambi` | verb | 0 | seconda persona singolare dell'indicativo presente di scambiare | `scambiare` | [scambi](https://it.wiktionary.org/w/index.php?title=scambi&oldid=3920761), [scambiare](https://it.wiktionary.org/w/index.php?title=scambiare&oldid=3997470) |
| 111612 | `scambi` | verb | 1 | prima persona singolare del congiuntivo presente di scambiare | `scambiare` | [scambi](https://it.wiktionary.org/w/index.php?title=scambi&oldid=3920761), [scambiare](https://it.wiktionary.org/w/index.php?title=scambiare&oldid=3997470) |
| 111612 | `scambi` | verb | 2 | seconda persona singolare del congiuntivo presente di scambiare | `scambiare` | [scambi](https://it.wiktionary.org/w/index.php?title=scambi&oldid=3920761), [scambiare](https://it.wiktionary.org/w/index.php?title=scambiare&oldid=3997470) |
| 111612 | `scambi` | verb | 3 | terza persona singolare del congiuntivo presente di scambiare | `scambiare` | [scambi](https://it.wiktionary.org/w/index.php?title=scambi&oldid=3920761), [scambiare](https://it.wiktionary.org/w/index.php?title=scambiare&oldid=3997470) |
| 111612 | `scambi` | verb | 4 | terza persona singolare dell'imperativo presente di scambiare | `scambiare` | [scambi](https://it.wiktionary.org/w/index.php?title=scambi&oldid=3920761), [scambiare](https://it.wiktionary.org/w/index.php?title=scambiare&oldid=3997470) |
| 111690 | `tappi` | verb | 2 | seconda persona singolare del congiuntivo presente di tappare | `tappare` | [tappi](https://it.wiktionary.org/w/index.php?title=tappi&oldid=3941719), [tappare](https://it.wiktionary.org/w/index.php?title=tappare&oldid=3894169) |
| 111690 | `tappi` | verb | 3 | terza persona singolare del congiuntivo presente di tappare | `tappare` | [tappi](https://it.wiktionary.org/w/index.php?title=tappi&oldid=3941719), [tappare](https://it.wiktionary.org/w/index.php?title=tappare&oldid=3894169) |
| 111690 | `tappi` | verb | 4 | terza persona singolare dell'imperativo presente di tappare | `tappare` | [tappi](https://it.wiktionary.org/w/index.php?title=tappi&oldid=3941719), [tappare](https://it.wiktionary.org/w/index.php?title=tappare&oldid=3894169) |
| 111740 | `secondi` | verb | 1 | prima persona singolare del congiuntivo presente di secondare | `secondare` | [secondi](https://it.wiktionary.org/w/index.php?title=secondi&oldid=4056865), [secondare](https://it.wiktionary.org/w/index.php?title=secondare&oldid=3974770) |
| 111740 | `secondi` | verb | 2 | seconda persona singolare del congiuntivo presente di secondare | `secondare` | [secondi](https://it.wiktionary.org/w/index.php?title=secondi&oldid=4056865), [secondare](https://it.wiktionary.org/w/index.php?title=secondare&oldid=3974770) |
| 111740 | `secondi` | verb | 3 | terza persona singolare del congiuntivo presente di secondare | `secondare` | [secondi](https://it.wiktionary.org/w/index.php?title=secondi&oldid=4056865), [secondare](https://it.wiktionary.org/w/index.php?title=secondare&oldid=3974770) |
| 111740 | `secondi` | verb | 4 | terza persona singolare dell'imperativo presente di secondare | `secondare` | [secondi](https://it.wiktionary.org/w/index.php?title=secondi&oldid=4056865), [secondare](https://it.wiktionary.org/w/index.php?title=secondare&oldid=3974770) |
| 111843 | `volti` | verb | 3 | seconda persona singolare del congiuntivo presente di voltare | `voltare` | [volti](https://it.wiktionary.org/w/index.php?title=volti&oldid=3838219), [voltare](https://it.wiktionary.org/w/index.php?title=voltare&oldid=4038986) |
| 111843 | `volti` | verb | 4 | terza persona singolare del congiuntivo presente di voltare | `voltare` | [volti](https://it.wiktionary.org/w/index.php?title=volti&oldid=3838219), [voltare](https://it.wiktionary.org/w/index.php?title=voltare&oldid=4038986) |
| 111843 | `volti` | verb | 5 | terza persona singolare dell'imperativo presente di voltare | `voltare` | [volti](https://it.wiktionary.org/w/index.php?title=volti&oldid=3838219), [voltare](https://it.wiktionary.org/w/index.php?title=voltare&oldid=4038986) |
| 111867 | `pennelli` | verb | 1 | prima persona singolare del presente semplice congiuntivo di pennellare | `pennellare` | [pennelli](https://it.wiktionary.org/w/index.php?title=pennelli&oldid=3941295), [pennellare](https://it.wiktionary.org/w/index.php?title=pennellare&oldid=3946649) |
| 111867 | `pennelli` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di pennellare | `pennellare` | [pennelli](https://it.wiktionary.org/w/index.php?title=pennelli&oldid=3941295), [pennellare](https://it.wiktionary.org/w/index.php?title=pennellare&oldid=3946649) |
| 111867 | `pennelli` | verb | 3 | terza persona singolare del presente semplice congiuntivo di pennellare | `pennellare` | [pennelli](https://it.wiktionary.org/w/index.php?title=pennelli&oldid=3941295), [pennellare](https://it.wiktionary.org/w/index.php?title=pennellare&oldid=3946649) |
| 111915 | `becchi` | verb | 1 | prima persona singolare del congiuntivo presente di beccare | `beccare` | [becchi](https://it.wiktionary.org/w/index.php?title=becchi&oldid=3950249), [beccare](https://it.wiktionary.org/w/index.php?title=beccare&oldid=4075646) |
| 111915 | `becchi` | verb | 2 | seconda persona singolare del congiuntivo presente di beccare | `beccare` | [becchi](https://it.wiktionary.org/w/index.php?title=becchi&oldid=3950249), [beccare](https://it.wiktionary.org/w/index.php?title=beccare&oldid=4075646) |
| 111915 | `becchi` | verb | 3 | terza persona singolare del congiuntivo presente di beccare | `beccare` | [becchi](https://it.wiktionary.org/w/index.php?title=becchi&oldid=3950249), [beccare](https://it.wiktionary.org/w/index.php?title=beccare&oldid=4075646) |
| 111915 | `becchi` | verb | 4 | terza persona singolare dell'imperativo presente di beccare | `beccare` | [becchi](https://it.wiktionary.org/w/index.php?title=becchi&oldid=3950249), [beccare](https://it.wiktionary.org/w/index.php?title=beccare&oldid=4075646) |
| 111953 | `regali` | verb | 1 | prima persona singolare del congiuntivo di regalare | `regalare` | [regali](https://it.wiktionary.org/w/index.php?title=regali&oldid=3885417), [regalare](https://it.wiktionary.org/w/index.php?title=regalare&oldid=3970248) |
| 111953 | `regali` | verb | 2 | seconda persona singolare del congiuntivo di regalare | `regalare` | [regali](https://it.wiktionary.org/w/index.php?title=regali&oldid=3885417), [regalare](https://it.wiktionary.org/w/index.php?title=regalare&oldid=3970248) |
| 111953 | `regali` | verb | 3 | terza persona singolare del congiuntivo di regalare | `regalare` | [regali](https://it.wiktionary.org/w/index.php?title=regali&oldid=3885417), [regalare](https://it.wiktionary.org/w/index.php?title=regalare&oldid=3970248) |
| 111953 | `regali` | verb | 4 | terza persona singolare dell'imperativo presente di regalare | `regalare` | [regali](https://it.wiktionary.org/w/index.php?title=regali&oldid=3885417), [regalare](https://it.wiktionary.org/w/index.php?title=regalare&oldid=3970248) |
| 111961 | `contorni` | verb | 1 | prima persona singolare del congiuntivo presente di contornare | `contornare` | [contorni](https://it.wiktionary.org/w/index.php?title=contorni&oldid=3961623), [contornare](https://it.wiktionary.org/w/index.php?title=contornare&oldid=3996107) |
| 111961 | `contorni` | verb | 2 | seconda persona singolare del congiuntivo presente di contornare | `contornare` | [contorni](https://it.wiktionary.org/w/index.php?title=contorni&oldid=3961623), [contornare](https://it.wiktionary.org/w/index.php?title=contornare&oldid=3996107) |
| 111961 | `contorni` | verb | 3 | terza persona singolare del congiuntivo presente di contornare | `contornare` | [contorni](https://it.wiktionary.org/w/index.php?title=contorni&oldid=3961623), [contornare](https://it.wiktionary.org/w/index.php?title=contornare&oldid=3996107) |
| 111961 | `contorni` | verb | 4 | terza persona singolare dell'imperativo presente di contornare | `contornare` | [contorni](https://it.wiktionary.org/w/index.php?title=contorni&oldid=3961623), [contornare](https://it.wiktionary.org/w/index.php?title=contornare&oldid=3996107) |
| 112079 | `gusti` | verb | 2 | seconda persona singolare del congiuntivo presente di gustare | `gustare` | [gusti](https://it.wiktionary.org/w/index.php?title=gusti&oldid=4055567), [gustare](https://it.wiktionary.org/w/index.php?title=gustare&oldid=3893629) |
| 112079 | `gusti` | verb | 3 | terza persona singolare del congiuntivo presente di gustare | `gustare` | [gusti](https://it.wiktionary.org/w/index.php?title=gusti&oldid=4055567), [gustare](https://it.wiktionary.org/w/index.php?title=gustare&oldid=3893629) |
| 112079 | `gusti` | verb | 4 | terza persona singolare dell'imperativo presente di gustare | `gustare` | [gusti](https://it.wiktionary.org/w/index.php?title=gusti&oldid=4055567), [gustare](https://it.wiktionary.org/w/index.php?title=gustare&oldid=3893629) |
| 112097 | `ricami` | verb | 4 | terza persona singolare dell'imperativo presente di ricamare | `ricamare` | [ricami](https://it.wiktionary.org/w/index.php?title=ricami&oldid=4034093), [ricamare](https://it.wiktionary.org/w/index.php?title=ricamare&oldid=4058696) |
| 112112 | `interessi` | verb | 0 | seconda persona singolare dell'indicativo presente di interessare | `interessare` | [interessi](https://it.wiktionary.org/w/index.php?title=interessi&oldid=4031243), [interessare](https://it.wiktionary.org/w/index.php?title=interessare&oldid=3949689) |
| 112112 | `interessi` | verb | 2 | seconda persona singolare del congiuntivo presente di interessare | `interessare` | [interessi](https://it.wiktionary.org/w/index.php?title=interessi&oldid=4031243), [interessare](https://it.wiktionary.org/w/index.php?title=interessare&oldid=3949689) |
| 112112 | `interessi` | verb | 3 | terza persona singolare del congiuntivo presente di interessare | `interessare` | [interessi](https://it.wiktionary.org/w/index.php?title=interessi&oldid=4031243), [interessare](https://it.wiktionary.org/w/index.php?title=interessare&oldid=3949689) |
| 112112 | `interessi` | verb | 4 | terza persona singolare dell'imperativo presente di interessare | `interessare` | [interessi](https://it.wiktionary.org/w/index.php?title=interessi&oldid=4031243), [interessare](https://it.wiktionary.org/w/index.php?title=interessare&oldid=3949689) |
| 112138 | `solchi` | verb | 1 | prima persona singolare del congiuntivo presente di solcare | `solcare` | [solchi](https://it.wiktionary.org/w/index.php?title=solchi&oldid=3968630), [solcare](https://it.wiktionary.org/w/index.php?title=solcare&oldid=4034496) |
| 112138 | `solchi` | verb | 2 | seconda persona singolare del congiuntivo presente di solcare | `solcare` | [solchi](https://it.wiktionary.org/w/index.php?title=solchi&oldid=3968630), [solcare](https://it.wiktionary.org/w/index.php?title=solcare&oldid=4034496) |
| 112138 | `solchi` | verb | 3 | terza persona singolare del congiuntivo presente di solcare | `solcare` | [solchi](https://it.wiktionary.org/w/index.php?title=solchi&oldid=3968630), [solcare](https://it.wiktionary.org/w/index.php?title=solcare&oldid=4034496) |
| 112138 | `solchi` | verb | 4 | terza persona singolare dell'imperativo presente di solcare | `solcare` | [solchi](https://it.wiktionary.org/w/index.php?title=solchi&oldid=3968630), [solcare](https://it.wiktionary.org/w/index.php?title=solcare&oldid=4034496) |
| 112153 | `testi` | verb | 0 | seconda persona singolare dell'indicativo presente di testare | `testare` | [testi](https://it.wiktionary.org/w/index.php?title=testi&oldid=3961557), [testare](https://it.wiktionary.org/w/index.php?title=testare&oldid=3961002) |
| 112153 | `testi` | verb | 1 | prima persona singolare del congiuntivo presente di testare | `testare` | [testi](https://it.wiktionary.org/w/index.php?title=testi&oldid=3961557), [testare](https://it.wiktionary.org/w/index.php?title=testare&oldid=3961002) |
| 112153 | `testi` | verb | 3 | terza persona singolare del congiuntivo presente di testare | `testare` | [testi](https://it.wiktionary.org/w/index.php?title=testi&oldid=3961557), [testare](https://it.wiktionary.org/w/index.php?title=testare&oldid=3961002) |
| 112153 | `testi` | verb | 4 | terza persona singolare dell'imperativo presente di testare | `testare` | [testi](https://it.wiktionary.org/w/index.php?title=testi&oldid=3961557), [testare](https://it.wiktionary.org/w/index.php?title=testare&oldid=3961002) |
| 112186 | `appoggi` | verb | 1 | prima persona singolare del congiuntivo presente di appoggiare | `appoggiare` | [appoggi](https://it.wiktionary.org/w/index.php?title=appoggi&oldid=4064330), [appoggiare](https://it.wiktionary.org/w/index.php?title=appoggiare&oldid=4004300) |
| 112186 | `appoggi` | verb | 2 | seconda persona singolare del congiuntivo presente di appoggiare | `appoggiare` | [appoggi](https://it.wiktionary.org/w/index.php?title=appoggi&oldid=4064330), [appoggiare](https://it.wiktionary.org/w/index.php?title=appoggiare&oldid=4004300) |
| 112186 | `appoggi` | verb | 3 | terza persona singolare del congiuntivo presente di appoggiare | `appoggiare` | [appoggi](https://it.wiktionary.org/w/index.php?title=appoggi&oldid=4064330), [appoggiare](https://it.wiktionary.org/w/index.php?title=appoggiare&oldid=4004300) |
| 112186 | `appoggi` | verb | 4 | terza persona singolare dell'imperativo presente di appoggiare | `appoggiare` | [appoggi](https://it.wiktionary.org/w/index.php?title=appoggi&oldid=4064330), [appoggiare](https://it.wiktionary.org/w/index.php?title=appoggiare&oldid=4004300) |
| 112193 | `obblighi` | verb | 1 | prima persona singolare del congiuntivo presente di obbligare | `obbligare` | [obblighi](https://it.wiktionary.org/w/index.php?title=obblighi&oldid=3836817), [obbligare](https://it.wiktionary.org/w/index.php?title=obbligare&oldid=3962602) |
| 112193 | `obblighi` | verb | 2 | seconda persona singolare del congiuntivo presente di obbligare | `obbligare` | [obblighi](https://it.wiktionary.org/w/index.php?title=obblighi&oldid=3836817), [obbligare](https://it.wiktionary.org/w/index.php?title=obbligare&oldid=3962602) |
| 112193 | `obblighi` | verb | 3 | terza persona singolare del congiuntivo presente di obbligare | `obbligare` | [obblighi](https://it.wiktionary.org/w/index.php?title=obblighi&oldid=3836817), [obbligare](https://it.wiktionary.org/w/index.php?title=obbligare&oldid=3962602) |
| 112193 | `obblighi` | verb | 4 | terza persona singolare dell'imperativo presente di obbligare | `obbligare` | [obblighi](https://it.wiktionary.org/w/index.php?title=obblighi&oldid=3836817), [obbligare](https://it.wiktionary.org/w/index.php?title=obbligare&oldid=3962602) |
| 112207 | `parchi` | adj | 0 | plurale di parco | `parco` | [parchi](https://it.wiktionary.org/w/index.php?title=parchi&oldid=4001939), [parco](https://it.wiktionary.org/w/index.php?title=parco&oldid=4248925) |
| 112219 | `attacchi` | verb | 1 | prima persona singolare del congiuntivo presente di attaccare | `attaccare` | [attacchi](https://it.wiktionary.org/w/index.php?title=attacchi&oldid=3867492), [attaccare](https://it.wiktionary.org/w/index.php?title=attaccare&oldid=3978362) |
| 112219 | `attacchi` | verb | 2 | seconda persona singolare del congiuntivo presente di attaccare | `attaccare` | [attacchi](https://it.wiktionary.org/w/index.php?title=attacchi&oldid=3867492), [attaccare](https://it.wiktionary.org/w/index.php?title=attaccare&oldid=3978362) |
| 112219 | `attacchi` | verb | 3 | terza persona singolare del congiuntivo presente di attaccare | `attaccare` | [attacchi](https://it.wiktionary.org/w/index.php?title=attacchi&oldid=3867492), [attaccare](https://it.wiktionary.org/w/index.php?title=attaccare&oldid=3978362) |
| 112226 | `aspetti` | verb | 1 | prima persona singolare del congiuntivo presente di aspettare | `aspettare` | [aspetti](https://it.wiktionary.org/w/index.php?title=aspetti&oldid=4248269), [aspettare](https://it.wiktionary.org/w/index.php?title=aspettare&oldid=4038198) |
| 112226 | `aspetti` | verb | 2 | seconda persona singolare del congiuntivo presente di aspettare | `aspettare` | [aspetti](https://it.wiktionary.org/w/index.php?title=aspetti&oldid=4248269), [aspettare](https://it.wiktionary.org/w/index.php?title=aspettare&oldid=4038198) |
| 112226 | `aspetti` | verb | 3 | terza persona singolare del congiuntivo presente di aspettare | `aspettare` | [aspetti](https://it.wiktionary.org/w/index.php?title=aspetti&oldid=4248269), [aspettare](https://it.wiktionary.org/w/index.php?title=aspettare&oldid=4038198) |
| 112226 | `aspetti` | verb | 4 | terza persona singolare dell'imperativo presente di aspettare | `aspettare` | [aspetti](https://it.wiktionary.org/w/index.php?title=aspetti&oldid=4248269), [aspettare](https://it.wiktionary.org/w/index.php?title=aspettare&oldid=4038198) |
| 112231 | `ferite` | verb | 0 | participio passato plurale femminile di ferire | `ferire` | [ferite](https://it.wiktionary.org/w/index.php?title=ferite&oldid=3881361), [ferire](https://it.wiktionary.org/w/index.php?title=ferire&oldid=4068242) |
| 112231 | `ferite` | verb | 1 | seconda persona plurale dell'indicativo presente di ferire | `ferire` | [ferite](https://it.wiktionary.org/w/index.php?title=ferite&oldid=3881361), [ferire](https://it.wiktionary.org/w/index.php?title=ferire&oldid=4068242) |
| 112231 | `ferite` | verb | 2 | seconda persona plurale dell'imperativo presente di ferire | `ferire` | [ferite](https://it.wiktionary.org/w/index.php?title=ferite&oldid=3881361), [ferire](https://it.wiktionary.org/w/index.php?title=ferire&oldid=4068242) |
| 112242 | `germogli` | verb | 1 | prima persona singolare del congiuntivo presente di germogliare | `germogliare` | [germogli](https://it.wiktionary.org/w/index.php?title=germogli&oldid=4065184), [germogliare](https://it.wiktionary.org/w/index.php?title=germogliare&oldid=4001721) |
| 112242 | `germogli` | verb | 2 | seconda persona singolare del congiuntivo presente di germogliare | `germogliare` | [germogli](https://it.wiktionary.org/w/index.php?title=germogli&oldid=4065184), [germogliare](https://it.wiktionary.org/w/index.php?title=germogliare&oldid=4001721) |
| 112242 | `germogli` | verb | 3 | terza persona singolare del congiuntivo presente di germogliare | `germogliare` | [germogli](https://it.wiktionary.org/w/index.php?title=germogli&oldid=4065184), [germogliare](https://it.wiktionary.org/w/index.php?title=germogliare&oldid=4001721) |
| 112242 | `germogli` | verb | 4 | terza persona singolare dell'imperativo presente di germogliare | `germogliare` | [germogli](https://it.wiktionary.org/w/index.php?title=germogli&oldid=4065184), [germogliare](https://it.wiktionary.org/w/index.php?title=germogliare&oldid=4001721) |
| 112254 | `artigli` | verb | 1 | prima persona singolare del congiuntivo presente di artigliare | `artigliare` | [artigli](https://it.wiktionary.org/w/index.php?title=artigli&oldid=3987213), [artigliare](https://it.wiktionary.org/w/index.php?title=artigliare&oldid=3627526) |
| 112254 | `artigli` | verb | 2 | seconda persona singolare del congiuntivo presente di artigliare | `artigliare` | [artigli](https://it.wiktionary.org/w/index.php?title=artigli&oldid=3987213), [artigliare](https://it.wiktionary.org/w/index.php?title=artigliare&oldid=3627526) |
| 112254 | `artigli` | verb | 3 | terza persona singolare del congiuntivo presente di artigliare | `artigliare` | [artigli](https://it.wiktionary.org/w/index.php?title=artigli&oldid=3987213), [artigliare](https://it.wiktionary.org/w/index.php?title=artigliare&oldid=3627526) |
| 112292 | `frammenti` | verb | 0 | seconda persona singolare dell'indicativo presente di frammentare | `frammentare` | [frammenti](https://it.wiktionary.org/w/index.php?title=frammenti&oldid=4056598), [frammentare](https://it.wiktionary.org/w/index.php?title=frammentare&oldid=3780516) |
| 112292 | `frammenti` | verb | 1 | prima persona singolare del congiuntivo presente di frammentare | `frammentare` | [frammenti](https://it.wiktionary.org/w/index.php?title=frammenti&oldid=4056598), [frammentare](https://it.wiktionary.org/w/index.php?title=frammentare&oldid=3780516) |
| 112292 | `frammenti` | verb | 2 | seconda persona singolare del congiuntivo presente di frammentare | `frammentare` | [frammenti](https://it.wiktionary.org/w/index.php?title=frammenti&oldid=4056598), [frammentare](https://it.wiktionary.org/w/index.php?title=frammentare&oldid=3780516) |
| 112292 | `frammenti` | verb | 3 | terza persona singolare del congiuntivo presente di frammentare | `frammentare` | [frammenti](https://it.wiktionary.org/w/index.php?title=frammenti&oldid=4056598), [frammentare](https://it.wiktionary.org/w/index.php?title=frammentare&oldid=3780516) |
| 112292 | `frammenti` | verb | 4 | terza persona singolare dell'imperativo presente di frammentare | `frammentare` | [frammenti](https://it.wiktionary.org/w/index.php?title=frammenti&oldid=4056598), [frammentare](https://it.wiktionary.org/w/index.php?title=frammentare&oldid=3780516) |
| 112458 | `pesi` | verb | 1 | prima persona singolare del congiuntivo presente di pesare | `pesare` | [pesi](https://it.wiktionary.org/w/index.php?title=pesi&oldid=3981984), [pesare](https://it.wiktionary.org/w/index.php?title=pesare&oldid=3940471) |
| 112458 | `pesi` | verb | 2 | seconda persona singolare del congiuntivo presente di pesare | `pesare` | [pesi](https://it.wiktionary.org/w/index.php?title=pesi&oldid=3981984), [pesare](https://it.wiktionary.org/w/index.php?title=pesare&oldid=3940471) |
| 112458 | `pesi` | verb | 3 | terza persona singolare del congiuntivo presente di pesare | `pesare` | [pesi](https://it.wiktionary.org/w/index.php?title=pesi&oldid=3981984), [pesare](https://it.wiktionary.org/w/index.php?title=pesare&oldid=3940471) |
| 112458 | `pesi` | verb | 4 | terza persona singolare dell'imperativo presente di pesare | `pesare` | [pesi](https://it.wiktionary.org/w/index.php?title=pesi&oldid=3981984), [pesare](https://it.wiktionary.org/w/index.php?title=pesare&oldid=3940471) |
| 112465 | `tagli` | verb | 1 | prima persona singolare del congiuntivo presente di tagliare | `tagliare` | [tagli](https://it.wiktionary.org/w/index.php?title=tagli&oldid=3981012), [tagliare](https://it.wiktionary.org/w/index.php?title=tagliare&oldid=4076610) |
| 112465 | `tagli` | verb | 2 | seconda persona singolare del congiuntivo presente di tagliare | `tagliare` | [tagli](https://it.wiktionary.org/w/index.php?title=tagli&oldid=3981012), [tagliare](https://it.wiktionary.org/w/index.php?title=tagliare&oldid=4076610) |
| 112465 | `tagli` | verb | 3 | terza persona singolare del congiuntivo presente di tagliare | `tagliare` | [tagli](https://it.wiktionary.org/w/index.php?title=tagli&oldid=3981012), [tagliare](https://it.wiktionary.org/w/index.php?title=tagliare&oldid=4076610) |
| 112465 | `tagli` | verb | 4 | terza persona singolare dell'imperativo presente di tagliare | `tagliare` | [tagli](https://it.wiktionary.org/w/index.php?title=tagli&oldid=3981012), [tagliare](https://it.wiktionary.org/w/index.php?title=tagliare&oldid=4076610) |
| 112528 | `utilizzi` | verb | 1 | prima persona singolare del congiuntivo presente di utilizzare | `utilizzare` | [utilizzi](https://it.wiktionary.org/w/index.php?title=utilizzi&oldid=3944785), [utilizzare](https://it.wiktionary.org/w/index.php?title=utilizzare&oldid=4075855) |
| 112528 | `utilizzi` | verb | 2 | seconda persona singolare del congiuntivo presente di utilizzare | `utilizzare` | [utilizzi](https://it.wiktionary.org/w/index.php?title=utilizzi&oldid=3944785), [utilizzare](https://it.wiktionary.org/w/index.php?title=utilizzare&oldid=4075855) |
| 112528 | `utilizzi` | verb | 3 | terza persona singolare del congiuntivo presente di utilizzare | `utilizzare` | [utilizzi](https://it.wiktionary.org/w/index.php?title=utilizzi&oldid=3944785), [utilizzare](https://it.wiktionary.org/w/index.php?title=utilizzare&oldid=4075855) |
| 112528 | `utilizzi` | verb | 4 | terza persona singolare dell'imperativo presente di utilizzare | `utilizzare` | [utilizzi](https://it.wiktionary.org/w/index.php?title=utilizzi&oldid=3944785), [utilizzare](https://it.wiktionary.org/w/index.php?title=utilizzare&oldid=4075855) |
| 112530 | `impieghi` | verb | 0 | seconda persona singolare dell'indicativo presente di impiegare | `impiegare` | [impieghi](https://it.wiktionary.org/w/index.php?title=impieghi&oldid=3920225), [impiegare](https://it.wiktionary.org/w/index.php?title=impiegare&oldid=3974802) |
| 112530 | `impieghi` | verb | 1 | prima persona singolare del congiuntivo presente di impiegare | `impiegare` | [impieghi](https://it.wiktionary.org/w/index.php?title=impieghi&oldid=3920225), [impiegare](https://it.wiktionary.org/w/index.php?title=impiegare&oldid=3974802) |
| 112530 | `impieghi` | verb | 2 | seconda persona singolare del congiuntivo presente di impiegare | `impiegare` | [impieghi](https://it.wiktionary.org/w/index.php?title=impieghi&oldid=3920225), [impiegare](https://it.wiktionary.org/w/index.php?title=impiegare&oldid=3974802) |
| 112530 | `impieghi` | verb | 3 | terza persona singolare del congiuntivo presente di impiegare | `impiegare` | [impieghi](https://it.wiktionary.org/w/index.php?title=impieghi&oldid=3920225), [impiegare](https://it.wiktionary.org/w/index.php?title=impiegare&oldid=3974802) |
| 112530 | `impieghi` | verb | 4 | terza persona singolare dell'imperativo presente di impiegare | `impiegare` | [impieghi](https://it.wiktionary.org/w/index.php?title=impieghi&oldid=3920225), [impiegare](https://it.wiktionary.org/w/index.php?title=impiegare&oldid=3974802) |
| 112690 | `rapaci` | adj | 0 | plurale di rapace | `rapace` | [rapaci](https://it.wiktionary.org/w/index.php?title=rapaci&oldid=3952898), [rapace](https://it.wiktionary.org/w/index.php?title=rapace&oldid=4006864) |
| 112866 | `coloro` | pron | 0 | plurale di colui | `colui` | [coloro](https://it.wiktionary.org/w/index.php?title=coloro&oldid=3392321), [colui](https://it.wiktionary.org/w/index.php?title=colui&oldid=4146234) |
| 112974 | `autunnali` | noun | 0 | plurale di autunnale | `autunnale` | [autunnali](https://it.wiktionary.org/w/index.php?title=autunnali&oldid=3899095), [autunnale](https://it.wiktionary.org/w/index.php?title=autunnale&oldid=3899094) |
| 113020 | `movimenti` | verb | 1 | prima persona singolare del congiuntivo presente di movimentare | `movimentare` | [movimenti](https://it.wiktionary.org/w/index.php?title=movimenti&oldid=4055676), [movimentare](https://it.wiktionary.org/w/index.php?title=movimentare&oldid=3424911) |
| 113020 | `movimenti` | verb | 2 | seconda persona singolare del congiuntivo presente di movimentare | `movimentare` | [movimenti](https://it.wiktionary.org/w/index.php?title=movimenti&oldid=4055676), [movimentare](https://it.wiktionary.org/w/index.php?title=movimentare&oldid=3424911) |
| 113020 | `movimenti` | verb | 3 | terza persona singolare del congiuntivo presente di movimentare | `movimentare` | [movimenti](https://it.wiktionary.org/w/index.php?title=movimenti&oldid=4055676), [movimentare](https://it.wiktionary.org/w/index.php?title=movimentare&oldid=3424911) |
| 113020 | `movimenti` | verb | 4 | terza persona singolare dell'imperativo presente di movimentare | `movimentare` | [movimenti](https://it.wiktionary.org/w/index.php?title=movimenti&oldid=4055676), [movimentare](https://it.wiktionary.org/w/index.php?title=movimentare&oldid=3424911) |
| 113077 | `traghetti` | verb | 1 | prima persona singolare del congiuntivo presente di traghettare | `traghettare` | [traghetti](https://it.wiktionary.org/w/index.php?title=traghetti&oldid=4162935), [traghettare](https://it.wiktionary.org/w/index.php?title=traghettare&oldid=3902141) |
| 113077 | `traghetti` | verb | 2 | seconda persona singolare del congiuntivo presente di traghettare | `traghettare` | [traghetti](https://it.wiktionary.org/w/index.php?title=traghetti&oldid=4162935), [traghettare](https://it.wiktionary.org/w/index.php?title=traghettare&oldid=3902141) |
| 113077 | `traghetti` | verb | 3 | terza persona singolare del congiuntivo presente di traghettare | `traghettare` | [traghetti](https://it.wiktionary.org/w/index.php?title=traghetti&oldid=4162935), [traghettare](https://it.wiktionary.org/w/index.php?title=traghettare&oldid=3902141) |
| 113077 | `traghetti` | verb | 4 | terza persona singolare dell'imperativo presente di traghettare | `traghettare` | [traghetti](https://it.wiktionary.org/w/index.php?title=traghetti&oldid=4162935), [traghettare](https://it.wiktionary.org/w/index.php?title=traghettare&oldid=3902141) |
| 113172 | `calchi` | verb | 0 | seconda persona singolare dell'indicativo presente di calcare | `calcare` | [calchi](https://it.wiktionary.org/w/index.php?title=calchi&oldid=4004347), [calcare](https://it.wiktionary.org/w/index.php?title=calcare&oldid=4053913) |
| 113172 | `calchi` | verb | 1 | prima persona singolare del congiuntivo presente di calcare | `calcare` | [calchi](https://it.wiktionary.org/w/index.php?title=calchi&oldid=4004347), [calcare](https://it.wiktionary.org/w/index.php?title=calcare&oldid=4053913) |
| 113172 | `calchi` | verb | 2 | seconda persona singolare del congiuntivo presente di calcare | `calcare` | [calchi](https://it.wiktionary.org/w/index.php?title=calchi&oldid=4004347), [calcare](https://it.wiktionary.org/w/index.php?title=calcare&oldid=4053913) |
| 113172 | `calchi` | verb | 3 | terza persona singolare del congiuntivo presente di calcare | `calcare` | [calchi](https://it.wiktionary.org/w/index.php?title=calchi&oldid=4004347), [calcare](https://it.wiktionary.org/w/index.php?title=calcare&oldid=4053913) |
| 113172 | `calchi` | verb | 4 | terza persona singolare dell'imperativo presente di calcare | `calcare` | [calchi](https://it.wiktionary.org/w/index.php?title=calchi&oldid=4004347), [calcare](https://it.wiktionary.org/w/index.php?title=calcare&oldid=4053913) |
| 113194 | `architetti` | verb | 1 | prima persona singolare del congiuntivo presente di architettare | `architettare` | [architetti](https://it.wiktionary.org/w/index.php?title=architetti&oldid=3835018), [architettare](https://it.wiktionary.org/w/index.php?title=architettare&oldid=4047568) |
| 113194 | `architetti` | verb | 2 | seconda persona singolare del congiuntivo presente di architettare | `architettare` | [architetti](https://it.wiktionary.org/w/index.php?title=architetti&oldid=3835018), [architettare](https://it.wiktionary.org/w/index.php?title=architettare&oldid=4047568) |
| 113194 | `architetti` | verb | 3 | terza persona singolare del congiuntivo presente di architettare | `architettare` | [architetti](https://it.wiktionary.org/w/index.php?title=architetti&oldid=3835018), [architettare](https://it.wiktionary.org/w/index.php?title=architettare&oldid=4047568) |
| 113194 | `architetti` | verb | 4 | terza persona singolare dell'imperativo presente di architettare | `architettare` | [architetti](https://it.wiktionary.org/w/index.php?title=architetti&oldid=3835018), [architettare](https://it.wiktionary.org/w/index.php?title=architettare&oldid=4047568) |
| 113646 | `entrambe` | pron | 0 | femminile di entrambi | `entrambi` | [entrambe](https://it.wiktionary.org/w/index.php?title=entrambe&oldid=3939345), [entrambi](https://it.wiktionary.org/w/index.php?title=entrambi&oldid=4068866) |
| 113865 | `rinforzi` | verb | 1 | prima persona singolare del congiuntivo presente di rinforzare | `rinforzare` | [rinforzi](https://it.wiktionary.org/w/index.php?title=rinforzi&oldid=3954271), [rinforzare](https://it.wiktionary.org/w/index.php?title=rinforzare&oldid=4003597) |
| 113865 | `rinforzi` | verb | 2 | seconda persona singolare del congiuntivo presente di rinforzare | `rinforzare` | [rinforzi](https://it.wiktionary.org/w/index.php?title=rinforzi&oldid=3954271), [rinforzare](https://it.wiktionary.org/w/index.php?title=rinforzare&oldid=4003597) |
| 113865 | `rinforzi` | verb | 4 | terza persona singolare dell'imperativo presente di rinforzare | `rinforzare` | [rinforzi](https://it.wiktionary.org/w/index.php?title=rinforzi&oldid=3954271), [rinforzare](https://it.wiktionary.org/w/index.php?title=rinforzare&oldid=4003597) |
| 113920 | `mangiate` | noun | 0 | femminile plurale di mangiata | `mangiata` | [mangiate](https://it.wiktionary.org/w/index.php?title=mangiate&oldid=3864473), [mangiata](https://it.wiktionary.org/w/index.php?title=mangiata&oldid=3899279) |
| 113937 | `cristiani` | noun | 0 | plurale di cristiano | `cristiano` | [cristiani](https://it.wiktionary.org/w/index.php?title=cristiani&oldid=4030642), [cristiano](https://it.wiktionary.org/w/index.php?title=cristiano&oldid=3981423) |
| 114006 | `versi` | adj | 0 | plurale di verso | `verso` | [versi](https://it.wiktionary.org/w/index.php?title=versi&oldid=3940460), [verso](https://it.wiktionary.org/w/index.php?title=verso&oldid=4049459) |
| 114128 | `almanacchi` | verb | 1 | prima persona singolare del congiuntivo presente di almanaccare | `almanaccare` | [almanacchi](https://it.wiktionary.org/w/index.php?title=almanacchi&oldid=3834897), [almanaccare](https://it.wiktionary.org/w/index.php?title=almanaccare&oldid=3849088) |
| 114128 | `almanacchi` | verb | 2 | seconda persona singolare del congiuntivo presente di almanaccare | `almanaccare` | [almanacchi](https://it.wiktionary.org/w/index.php?title=almanacchi&oldid=3834897), [almanaccare](https://it.wiktionary.org/w/index.php?title=almanaccare&oldid=3849088) |
| 114128 | `almanacchi` | verb | 3 | terza persona singolare del congiuntivo presente di almanaccare | `almanaccare` | [almanacchi](https://it.wiktionary.org/w/index.php?title=almanacchi&oldid=3834897), [almanaccare](https://it.wiktionary.org/w/index.php?title=almanaccare&oldid=3849088) |
| 114128 | `almanacchi` | verb | 4 | terza persona singolare dell'imperativo presente di almanaccare | `almanaccare` | [almanacchi](https://it.wiktionary.org/w/index.php?title=almanacchi&oldid=3834897), [almanaccare](https://it.wiktionary.org/w/index.php?title=almanaccare&oldid=3849088) |
| 114289 | `argini` | verb | 1 | prima persona singolare del congiuntivo presente di arginare | `arginare` | [argini](https://it.wiktionary.org/w/index.php?title=argini&oldid=3920805), [arginare](https://it.wiktionary.org/w/index.php?title=arginare&oldid=3964157) |
| 114289 | `argini` | verb | 2 | seconda persona singolare del congiuntivo presente di arginare | `arginare` | [argini](https://it.wiktionary.org/w/index.php?title=argini&oldid=3920805), [arginare](https://it.wiktionary.org/w/index.php?title=arginare&oldid=3964157) |
| 114289 | `argini` | verb | 3 | terza persona singolare del congiuntivo presente di arginare | `arginare` | [argini](https://it.wiktionary.org/w/index.php?title=argini&oldid=3920805), [arginare](https://it.wiktionary.org/w/index.php?title=arginare&oldid=3964157) |
| 114289 | `argini` | verb | 4 | terza persona singolare dell'imperativo presente di arginare | `arginare` | [argini](https://it.wiktionary.org/w/index.php?title=argini&oldid=3920805), [arginare](https://it.wiktionary.org/w/index.php?title=arginare&oldid=3964157) |
| 114349 | `romanzi` | verb | 1 | prima persona singolare del congiuntivo presente di romanzare | `romanzare` | [romanzi](https://it.wiktionary.org/w/index.php?title=romanzi&oldid=4056088), [romanzare](https://it.wiktionary.org/w/index.php?title=romanzare&oldid=4056089) |
| 114349 | `romanzi` | verb | 2 | seconda persona singolare del congiuntivo presente di romanzare | `romanzare` | [romanzi](https://it.wiktionary.org/w/index.php?title=romanzi&oldid=4056088), [romanzare](https://it.wiktionary.org/w/index.php?title=romanzare&oldid=4056089) |
| 114349 | `romanzi` | verb | 3 | terza persona singolare del congiuntivo presente di romanzare | `romanzare` | [romanzi](https://it.wiktionary.org/w/index.php?title=romanzi&oldid=4056088), [romanzare](https://it.wiktionary.org/w/index.php?title=romanzare&oldid=4056089) |
| 114349 | `romanzi` | verb | 4 | terza persona singolare dell'imperativo presente di romanzare | `romanzare` | [romanzi](https://it.wiktionary.org/w/index.php?title=romanzi&oldid=4056088), [romanzare](https://it.wiktionary.org/w/index.php?title=romanzare&oldid=4056089) |
| 114526 | `specchi` | verb | 1 | prima persona singolare del congiuntivo presente di specchiare | `specchiare` | [specchi](https://it.wiktionary.org/w/index.php?title=specchi&oldid=3962019), [specchiare](https://it.wiktionary.org/w/index.php?title=specchiare&oldid=4034652) |
| 114526 | `specchi` | verb | 2 | seconda persona singolare del congiuntivo presente di specchiare | `specchiare` | [specchi](https://it.wiktionary.org/w/index.php?title=specchi&oldid=3962019), [specchiare](https://it.wiktionary.org/w/index.php?title=specchiare&oldid=4034652) |
| 114526 | `specchi` | verb | 3 | terza persona singolare del congiuntivo presente di specchiare | `specchiare` | [specchi](https://it.wiktionary.org/w/index.php?title=specchi&oldid=3962019), [specchiare](https://it.wiktionary.org/w/index.php?title=specchiare&oldid=4034652) |
| 114526 | `specchi` | verb | 4 | terza persona singolare dell'imperativo presente di specchiare | `specchiare` | [specchi](https://it.wiktionary.org/w/index.php?title=specchi&oldid=3962019), [specchiare](https://it.wiktionary.org/w/index.php?title=specchiare&oldid=4034652) |
| 114634 | `scavi` | verb | 1 | prima persona singolare del presente semplice congiuntivo di scavare | `scavare` | [scavi](https://it.wiktionary.org/w/index.php?title=scavi&oldid=3881149), [scavare](https://it.wiktionary.org/w/index.php?title=scavare&oldid=4084154) |
| 114634 | `scavi` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di scavare | `scavare` | [scavi](https://it.wiktionary.org/w/index.php?title=scavi&oldid=3881149), [scavare](https://it.wiktionary.org/w/index.php?title=scavare&oldid=4084154) |
| 114634 | `scavi` | verb | 3 | terza persona singolare del presente semplice congiuntivo di scavare | `scavare` | [scavi](https://it.wiktionary.org/w/index.php?title=scavi&oldid=3881149), [scavare](https://it.wiktionary.org/w/index.php?title=scavare&oldid=4084154) |
| 114642 | `spuntino` | verb | 0 | terza persona plurale del congiuntivo presente di spuntare | `spuntare` | [spuntino](https://it.wiktionary.org/w/index.php?title=spuntino&oldid=4076239), [spuntare](https://it.wiktionary.org/w/index.php?title=spuntare&oldid=4061550) |
| 114642 | `spuntino` | verb | 1 | terza persona plurale dell'imperativo presente di spuntare | `spuntare` | [spuntino](https://it.wiktionary.org/w/index.php?title=spuntino&oldid=4076239), [spuntare](https://it.wiktionary.org/w/index.php?title=spuntare&oldid=4061550) |
| 114669 | `cataloghi` | verb | 1 | prima persona singolare del presente semplice congiuntivo di catalogare | `catalogare` | [cataloghi](https://it.wiktionary.org/w/index.php?title=cataloghi&oldid=4052060), [catalogare](https://it.wiktionary.org/w/index.php?title=catalogare&oldid=3965126) |
| 114669 | `cataloghi` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di catalogare | `catalogare` | [cataloghi](https://it.wiktionary.org/w/index.php?title=cataloghi&oldid=4052060), [catalogare](https://it.wiktionary.org/w/index.php?title=catalogare&oldid=3965126) |
| 114669 | `cataloghi` | verb | 3 | terza persona singolare del presente semplice congiuntivo di catalogare | `catalogare` | [cataloghi](https://it.wiktionary.org/w/index.php?title=cataloghi&oldid=4052060), [catalogare](https://it.wiktionary.org/w/index.php?title=catalogare&oldid=3965126) |
| 114747 | `blocchi` | verb | 1 | prima persona singolare del congiuntivo presente di bloccare | `bloccare` | [blocchi](https://it.wiktionary.org/w/index.php?title=blocchi&oldid=3965876), [bloccare](https://it.wiktionary.org/w/index.php?title=bloccare&oldid=4060600) |
| 114747 | `blocchi` | verb | 2 | seconda persona singolare del congiuntivo presente di bloccare | `bloccare` | [blocchi](https://it.wiktionary.org/w/index.php?title=blocchi&oldid=3965876), [bloccare](https://it.wiktionary.org/w/index.php?title=bloccare&oldid=4060600) |
| 114747 | `blocchi` | verb | 3 | terza persona singolare del congiuntivo presente di bloccare | `bloccare` | [blocchi](https://it.wiktionary.org/w/index.php?title=blocchi&oldid=3965876), [bloccare](https://it.wiktionary.org/w/index.php?title=bloccare&oldid=4060600) |
| 114747 | `blocchi` | verb | 4 | terza persona singolare dell'imperativo presente di bloccare | `bloccare` | [blocchi](https://it.wiktionary.org/w/index.php?title=blocchi&oldid=3965876), [bloccare](https://it.wiktionary.org/w/index.php?title=bloccare&oldid=4060600) |
| 115371 | `profeti` | verb | 4 | terza persona singolare dell'imperativo presente di profetare | `profetare` | [profeti](https://it.wiktionary.org/w/index.php?title=profeti&oldid=4052433), [profetare](https://it.wiktionary.org/w/index.php?title=profetare&oldid=3475085) |
| 115532 | `diletto` | verb | 0 | prima persona singolare dell'indicativo presente di dilettare | `dilettare` | [diletto](https://it.wiktionary.org/w/index.php?title=diletto&oldid=3899529), [dilettare](https://it.wiktionary.org/w/index.php?title=dilettare&oldid=3637823) |
| 116280 | `alterchi` | verb | 1 | prima persona singolare del congiuntivo presente di altercare | `altercare` | [alterchi](https://it.wiktionary.org/w/index.php?title=alterchi&oldid=4053116), [altercare](https://it.wiktionary.org/w/index.php?title=altercare&oldid=3550392) |
| 116280 | `alterchi` | verb | 2 | seconda persona singolare del congiuntivo presente di altercare | `altercare` | [alterchi](https://it.wiktionary.org/w/index.php?title=alterchi&oldid=4053116), [altercare](https://it.wiktionary.org/w/index.php?title=altercare&oldid=3550392) |
| 116280 | `alterchi` | verb | 3 | terza persona singolare del congiuntivo presente di altercare | `altercare` | [alterchi](https://it.wiktionary.org/w/index.php?title=alterchi&oldid=4053116), [altercare](https://it.wiktionary.org/w/index.php?title=altercare&oldid=3550392) |
| 116280 | `alterchi` | verb | 4 | terza persona singolare dell'imperativo presente di altercare | `altercare` | [alterchi](https://it.wiktionary.org/w/index.php?title=alterchi&oldid=4053116), [altercare](https://it.wiktionary.org/w/index.php?title=altercare&oldid=3550392) |
| 116527 | `scanni` | verb | 1 | prima persona singolare del presente semplice congiuntivo di scannare | `scannare` | [scanni](https://it.wiktionary.org/w/index.php?title=scanni&oldid=3943811), [scannare](https://it.wiktionary.org/w/index.php?title=scannare&oldid=3985699) |
| 116527 | `scanni` | verb | 2 | seconda persona singolare del presente semplice congiuntivo di scannare | `scannare` | [scanni](https://it.wiktionary.org/w/index.php?title=scanni&oldid=3943811), [scannare](https://it.wiktionary.org/w/index.php?title=scannare&oldid=3985699) |
| 116527 | `scanni` | verb | 3 | terza persona singolare del presente semplice congiuntivo di scannare | `scannare` | [scanni](https://it.wiktionary.org/w/index.php?title=scanni&oldid=3943811), [scannare](https://it.wiktionary.org/w/index.php?title=scannare&oldid=3985699) |
| 117455 | `liberi` | verb | 1 | prima persona singolare del congiuntivo presente di liberare | `liberare` | [liberi](https://it.wiktionary.org/w/index.php?title=liberi&oldid=3872311), [liberare](https://it.wiktionary.org/w/index.php?title=liberare&oldid=3994816) |
| 117455 | `liberi` | verb | 2 | seconda persona singolare del congiuntivo presente di liberare | `liberare` | [liberi](https://it.wiktionary.org/w/index.php?title=liberi&oldid=3872311), [liberare](https://it.wiktionary.org/w/index.php?title=liberare&oldid=3994816) |
| 117455 | `liberi` | verb | 3 | terza persona singolare del congiuntivo presente di liberare | `liberare` | [liberi](https://it.wiktionary.org/w/index.php?title=liberi&oldid=3872311), [liberare](https://it.wiktionary.org/w/index.php?title=liberare&oldid=3994816) |
| 117455 | `liberi` | verb | 4 | terza persona singolare dell'imperativo presente di liberare | `liberare` | [liberi](https://it.wiktionary.org/w/index.php?title=liberi&oldid=3872311), [liberare](https://it.wiktionary.org/w/index.php?title=liberare&oldid=3994816) |
| 118524 | `diletti` | verb | 2 | prima persona singolare del congiuntivo presente di dilettare | `dilettare` | [diletti](https://it.wiktionary.org/w/index.php?title=diletti&oldid=3800341), [dilettare](https://it.wiktionary.org/w/index.php?title=dilettare&oldid=3637823) |
| 118749 | `esamini` | verb | 1 | prima persona singolare del congiuntivo presente di esaminare | `esaminare` | [esamini](https://it.wiktionary.org/w/index.php?title=esamini&oldid=3871500), [esaminare](https://it.wiktionary.org/w/index.php?title=esaminare&oldid=3983502) |
| 118749 | `esamini` | verb | 2 | seconda persona singolare del congiuntivo presente di esaminare | `esaminare` | [esamini](https://it.wiktionary.org/w/index.php?title=esamini&oldid=3871500), [esaminare](https://it.wiktionary.org/w/index.php?title=esaminare&oldid=3983502) |
| 118749 | `esamini` | verb | 3 | terza persona singolare del congiuntivo presente di esaminare | `esaminare` | [esamini](https://it.wiktionary.org/w/index.php?title=esamini&oldid=3871500), [esaminare](https://it.wiktionary.org/w/index.php?title=esaminare&oldid=3983502) |
| 118749 | `esamini` | verb | 4 | terza persona singolare dell'imperativo presente di esaminare | `esaminare` | [esamini](https://it.wiktionary.org/w/index.php?title=esamini&oldid=3871500), [esaminare](https://it.wiktionary.org/w/index.php?title=esaminare&oldid=3983502) |
| 119405 | `oppositrice` | noun | 0 | femminile singolare di oppositore | `oppositore` | [oppositrice](https://it.wiktionary.org/w/index.php?title=oppositrice&oldid=4203230), [oppositore](https://it.wiktionary.org/w/index.php?title=oppositore&oldid=4203244) |
| 119887 | `queste` | pron | 0 | femminile plurale di questo | `questo` | [queste](https://it.wiktionary.org/w/index.php?title=queste&oldid=3711052), [questo](https://it.wiktionary.org/w/index.php?title=questo&oldid=3892270) |
| 120023 | `nona` | adj | 0 | femminile di nono | `nono` | [nona](https://it.wiktionary.org/w/index.php?title=nona&oldid=3991893), [nono](https://it.wiktionary.org/w/index.php?title=nono&oldid=3954986) |
| 120095 | `abalieni` | verb | 2 | seconda persona singolare del congiuntivo presente di abalienare | `abalienare` | [abalieni](https://it.wiktionary.org/w/index.php?title=abalieni&oldid=2799716), [abalienare](https://it.wiktionary.org/w/index.php?title=abalienare&oldid=3625913) |
| 120095 | `abalieni` | verb | 3 | terza persona singolare del congiuntivo presente di abalienare | `abalienare` | [abalieni](https://it.wiktionary.org/w/index.php?title=abalieni&oldid=2799716), [abalienare](https://it.wiktionary.org/w/index.php?title=abalienare&oldid=3625913) |
| 121159 | `cazare` | noun | 0 | plurale di cazara, vedi cazaro | `cazara` | [cazare](https://it.wiktionary.org/w/index.php?title=cazare&oldid=3900235), [cazara](https://it.wiktionary.org/w/index.php?title=cazara&oldid=3900234) |
| 121230 | `avvisi` | verb | 1 | prima persona singolare del congiuntivo presente di avvisare | `avvisare` | [avvisi](https://it.wiktionary.org/w/index.php?title=avvisi&oldid=4068641), [avvisare](https://it.wiktionary.org/w/index.php?title=avvisare&oldid=3901717) |
| 121230 | `avvisi` | verb | 2 | seconda persona singolare del congiuntivo presente di avvisare | `avvisare` | [avvisi](https://it.wiktionary.org/w/index.php?title=avvisi&oldid=4068641), [avvisare](https://it.wiktionary.org/w/index.php?title=avvisare&oldid=3901717) |
| 121230 | `avvisi` | verb | 3 | terza persona singolare del congiuntivo presente di avvisare | `avvisare` | [avvisi](https://it.wiktionary.org/w/index.php?title=avvisi&oldid=4068641), [avvisare](https://it.wiktionary.org/w/index.php?title=avvisare&oldid=3901717) |
| 121230 | `avvisi` | verb | 4 | terza persona singolare dell'imperativo presente di avvisare | `avvisare` | [avvisi](https://it.wiktionary.org/w/index.php?title=avvisi&oldid=4068641), [avvisare](https://it.wiktionary.org/w/index.php?title=avvisare&oldid=3901717) |
| 121383 | `galvani` | noun | 0 | plurale di galvano | `galvano` | [galvani](https://it.wiktionary.org/w/index.php?title=galvani&oldid=2938069), [galvano](https://it.wiktionary.org/w/index.php?title=galvano&oldid=2938113) |
| 121493 | `incessi` | noun | 0 | plurale di incesso | `incesso` | [incessi](https://it.wiktionary.org/w/index.php?title=incessi&oldid=3900288), [incesso](https://it.wiktionary.org/w/index.php?title=incesso&oldid=3900287) |
| 122111 | `urlo` | noun | 1 | prima persona singolare dell'indicativo presente di urlare | `urlare` | [urlo](https://it.wiktionary.org/w/index.php?title=urlo&oldid=3900370), [urlare](https://it.wiktionary.org/w/index.php?title=urlare&oldid=3965902) |
| 122437 | `abbracciati` | verb | 1 | participio passato plurale di abbracciarsi | `abbracciarsi` | [abbracciati](https://it.wiktionary.org/w/index.php?title=abbracciati&oldid=3789215), [abbracciarsi](https://it.wiktionary.org/w/index.php?title=abbracciarsi&oldid=3366314) |
| 122457 | `Cosa` | noun | 0 | femminile di Coso | `Coso` | [Cosa](https://it.wiktionary.org/w/index.php?title=Cosa&oldid=3234399), [Coso](https://it.wiktionary.org/w/index.php?title=Coso&oldid=3234403) |
| 122501 | `sbarrato` | verb | 0 | participio passato di sbarrare | `sbarrare` | [sbarrato](https://it.wiktionary.org/w/index.php?title=sbarrato&oldid=3900405), [sbarrare](https://it.wiktionary.org/w/index.php?title=sbarrare&oldid=3959049) |
| 122503 | `sbarra` | verb | 1 | seconda persona singolare dell'imperativo presente di sbarrare | `sbarrare` | [sbarra](https://it.wiktionary.org/w/index.php?title=sbarra&oldid=3959050), [sbarrare](https://it.wiktionary.org/w/index.php?title=sbarrare&oldid=3959049) |
| 122603 | `arcuato` | verb | 0 | participio passato di arcuare | `arcuare` | [arcuato](https://it.wiktionary.org/w/index.php?title=arcuato&oldid=4075575), [arcuare](https://it.wiktionary.org/w/index.php?title=arcuare&oldid=4010714) |
| 123353 | `pneumatici` | adj | 0 | plurale di pneumatico | `pneumatico` | [pneumatici](https://it.wiktionary.org/w/index.php?title=pneumatici&oldid=4076708), [pneumatico](https://it.wiktionary.org/w/index.php?title=pneumatico&oldid=3975595) |
| 123979 | `plana` | verb | 0 | terza persona singolare dell'indicativo presente di planare | `planare` | [plana](https://it.wiktionary.org/w/index.php?title=plana&oldid=3992112), [planare](https://it.wiktionary.org/w/index.php?title=planare&oldid=3540344) |
| 123979 | `plana` | verb | 1 | seconda persona singolare dell'imperativo presente di planare | `planare` | [plana](https://it.wiktionary.org/w/index.php?title=plana&oldid=3992112), [planare](https://it.wiktionary.org/w/index.php?title=planare&oldid=3540344) |
| 124907 | `olofrastica` | adj | 0 | femminile di olofrastico | `olofrastico` | [olofrastica](https://it.wiktionary.org/w/index.php?title=olofrastica&oldid=3939177), [olofrastico](https://it.wiktionary.org/w/index.php?title=olofrastico&oldid=3645050) |
| 125320 | `destra` | adj | 0 | femminile di destro | `destro` | [destra](https://it.wiktionary.org/w/index.php?title=destra&oldid=4066995), [destro](https://it.wiktionary.org/w/index.php?title=destro&oldid=3954588) |
| 125430 | `schiera` | verb | 1 | seconda persona singolare dell'imperativo presente di schierare | `schierare` | [schiera](https://it.wiktionary.org/w/index.php?title=schiera&oldid=4053759), [schierare](https://it.wiktionary.org/w/index.php?title=schierare&oldid=3920794) |
| 125443 | `curvo` | verb | 0 | prima persona singolare dell'indicativo presente di curvare | `curvare` | [curvo](https://it.wiktionary.org/w/index.php?title=curvo&oldid=3966220), [curvare](https://it.wiktionary.org/w/index.php?title=curvare&oldid=3966214) |
| 125456 | `scanalato` | verb | 0 | participio passato di scanalare | `scanalare` | [scanalato](https://it.wiktionary.org/w/index.php?title=scanalato&oldid=4249748), [scanalare](https://it.wiktionary.org/w/index.php?title=scanalare&oldid=3906783) |
| 125719 | `volontaria` | noun | 0 | femminile di volontario | `volontario` | [volontaria](https://it.wiktionary.org/w/index.php?title=volontaria&oldid=4045160), [volontario](https://it.wiktionary.org/w/index.php?title=volontario&oldid=3955462) |
| 125827 | `nunzia` | noun | 0 | femminile di nunzio | `nunzio` | [nunzia](https://it.wiktionary.org/w/index.php?title=nunzia&oldid=4069535), [nunzio](https://it.wiktionary.org/w/index.php?title=nunzio&oldid=3970718) |
| 125882 | `stolta` | noun | 0 | femminile di stolto | `stolto` | [stolta](https://it.wiktionary.org/w/index.php?title=stolta&oldid=3344179), [stolto](https://it.wiktionary.org/w/index.php?title=stolto&oldid=3922577) |
| 126081 | `ardito` | verb | 0 | participio passato di ardire | `ardire` | [ardito](https://it.wiktionary.org/w/index.php?title=ardito&oldid=4001410), [ardire](https://it.wiktionary.org/w/index.php?title=ardire&oldid=3627368) |
| 126229 | `punteggiato` | verb | 0 | participio passato di punteggiare | `punteggiare` | [punteggiato](https://it.wiktionary.org/w/index.php?title=punteggiato&oldid=3965559), [punteggiare](https://it.wiktionary.org/w/index.php?title=punteggiare&oldid=4015056) |
| 126259 | `sradicato` | verb | 0 | participio passato di sradicare | `sradicare` | [sradicato](https://it.wiktionary.org/w/index.php?title=sradicato&oldid=3882111), [sradicare](https://it.wiktionary.org/w/index.php?title=sradicare&oldid=4032574) |
| 126491 | `rivoltato` | verb | 0 | participio passato di rivoltare | `rivoltare` | [rivoltato](https://it.wiktionary.org/w/index.php?title=rivoltato&oldid=3849975), [rivoltare](https://it.wiktionary.org/w/index.php?title=rivoltare&oldid=3906792) |
| 126548 | `supporti` | noun | 0 | plurale di supporto | `supporto` | [supporti](https://it.wiktionary.org/w/index.php?title=supporti&oldid=3793054), [supporto](https://it.wiktionary.org/w/index.php?title=supporto&oldid=4251320) |
| 127022 | `maritata` | adj | 0 | femminile di maritato | `maritato` | [maritata](https://it.wiktionary.org/w/index.php?title=maritata&oldid=3857935), [maritato](https://it.wiktionary.org/w/index.php?title=maritato&oldid=3776444) |
| 127950 | `ciabatta` | verb | 1 | seconda persona singolare dell'imperativo presente di ciabattare | `ciabattare` | [ciabatta](https://it.wiktionary.org/w/index.php?title=ciabatta&oldid=4003057), [ciabattare](https://it.wiktionary.org/w/index.php?title=ciabattare&oldid=3907806) |
| 129501 | `spazzino` | verb | 0 | terza persona plurale del congiuntivo presente di spazzare | `spazzare` | [spazzino](https://it.wiktionary.org/w/index.php?title=spazzino&oldid=3970020), [spazzare](https://it.wiktionary.org/w/index.php?title=spazzare&oldid=3877037) |
| 129501 | `spazzino` | verb | 1 | terza persona plurale dell'imperativo presente di spazzare | `spazzare` | [spazzino](https://it.wiktionary.org/w/index.php?title=spazzino&oldid=3970020), [spazzare](https://it.wiktionary.org/w/index.php?title=spazzare&oldid=3877037) |
| 129821 | `infilato` | verb | 0 | participio passato di infilare | `infilare` | [infilato](https://it.wiktionary.org/w/index.php?title=infilato&oldid=3790565), [infilare](https://it.wiktionary.org/w/index.php?title=infilare&oldid=3922125) |
| 130141 | `potenziato` | verb | 0 | participio passato di potenziare | `potenziare` | [potenziato](https://it.wiktionary.org/w/index.php?title=potenziato&oldid=3987514), [potenziare](https://it.wiktionary.org/w/index.php?title=potenziare&oldid=3646511) |
| 130322 | `stecchino` | verb | 1 | terza persona plurale dell'imperativo presente di steccare | `steccare` | [stecchino](https://it.wiktionary.org/w/index.php?title=stecchino&oldid=4058695), [steccare](https://it.wiktionary.org/w/index.php?title=steccare&oldid=3444410) |
| 130711 | `circoli` | verb | 2 | seconda persona singolare del congiuntivo presente di circolare | `circolare` | [circoli](https://it.wiktionary.org/w/index.php?title=circoli&oldid=3856896), [circolare](https://it.wiktionary.org/w/index.php?title=circolare&oldid=4014121) |
| 130711 | `circoli` | verb | 3 | terza persona singolare del congiuntivo presente di circolare | `circolare` | [circoli](https://it.wiktionary.org/w/index.php?title=circoli&oldid=3856896), [circolare](https://it.wiktionary.org/w/index.php?title=circolare&oldid=4014121) |
| 130711 | `circoli` | verb | 4 | terza persona singolare dell'imperativo presente di circolare | `circolare` | [circoli](https://it.wiktionary.org/w/index.php?title=circoli&oldid=3856896), [circolare](https://it.wiktionary.org/w/index.php?title=circolare&oldid=4014121) |
| 130769 | `coricato` | verb | 0 | participio passato di coricare | `coricare` | [coricato](https://it.wiktionary.org/w/index.php?title=coricato&oldid=3944315), [coricare](https://it.wiktionary.org/w/index.php?title=coricare&oldid=3926047) |
| 131430 | `piantato` | verb | 0 | participio passato di piantare | `piantare` | [piantato](https://it.wiktionary.org/w/index.php?title=piantato&oldid=4049865), [piantare](https://it.wiktionary.org/w/index.php?title=piantare&oldid=4044350) |
| 131638 | `sfogliato` | verb | 0 | participio passato di sfogliare | `sfogliare` | [sfogliato](https://it.wiktionary.org/w/index.php?title=sfogliato&oldid=3782481), [sfogliare](https://it.wiktionary.org/w/index.php?title=sfogliare&oldid=4048087) |
| 131731 | `cerchiato` | verb | 0 | participio passato di cerchiare | `cerchiare` | [cerchiato](https://it.wiktionary.org/w/index.php?title=cerchiato&oldid=3968574), [cerchiare](https://it.wiktionary.org/w/index.php?title=cerchiare&oldid=3999745) |
| 132187 | `pronunzia` | verb | 1 | seconda persona singolare dell'imperativo presente di pronunziare | `pronunziare` | [pronunzia](https://it.wiktionary.org/w/index.php?title=pronunzia&oldid=3785196), [pronunziare](https://it.wiktionary.org/w/index.php?title=pronunziare&oldid=3785197) |
| 132907 | `ascesa` | adj | 0 | femminile di asceso | `asceso` | [ascesa](https://it.wiktionary.org/w/index.php?title=ascesa&oldid=3983442), [asceso](https://it.wiktionary.org/w/index.php?title=asceso&oldid=4047713) |
| 133160 | `divorzio` | verb | 0 | prima persona singolare dell'indicativo presente di divorziare | `divorziare` | [divorzio](https://it.wiktionary.org/w/index.php?title=divorzio&oldid=4001789), [divorziare](https://it.wiktionary.org/w/index.php?title=divorziare&oldid=3681350) |
| 133240 | `facinorosi` | adj | 0 | plurale di facinoroso, ovvero incline alla violenza e alla ribellione. | `facinoroso` | [facinorosi](https://it.wiktionary.org/w/index.php?title=facinorosi&oldid=3831139), [facinoroso](https://it.wiktionary.org/w/index.php?title=facinoroso&oldid=4003518) |
| 133848 | `gloria` | verb | 1 | seconda persona singolare dell'imperativo presente di gloriare | `gloriare` | [gloria](https://it.wiktionary.org/w/index.php?title=gloria&oldid=3997566), [gloriare](https://it.wiktionary.org/w/index.php?title=gloriare&oldid=3906637) |
| 133892 | `transenna` | verb | 1 | seconda persona singolare dell'imperativo presente di transennare | `transennare` | [transenna](https://it.wiktionary.org/w/index.php?title=transenna&oldid=3999737), [transennare](https://it.wiktionary.org/w/index.php?title=transennare&oldid=3476448) |
| 133949 | `medianici` | noun | 0 | plurale di medianico | `medianico` | [medianici](https://it.wiktionary.org/w/index.php?title=medianici&oldid=2996689), [medianico](https://it.wiktionary.org/w/index.php?title=medianico&oldid=3310730) |
| 133979 | `correlato` | verb | 0 | participio passato di correlare, correlarsi | `correlare` | [correlato](https://it.wiktionary.org/w/index.php?title=correlato&oldid=4053473), [correlare](https://it.wiktionary.org/w/index.php?title=correlare&oldid=4019122) |
| 134107 | `argentino` | verb | 0 | terza persona plurale del congiuntivo presente di argentare | `argentare` | [argentino](https://it.wiktionary.org/w/index.php?title=argentino&oldid=4004302), [argentare](https://it.wiktionary.org/w/index.php?title=argentare&oldid=3907505) |
| 134107 | `argentino` | verb | 1 | terza persona plurale dell'imperativo presente di argentare | `argentare` | [argentino](https://it.wiktionary.org/w/index.php?title=argentino&oldid=4004302), [argentare](https://it.wiktionary.org/w/index.php?title=argentare&oldid=3907505) |
| 134408 | `congegnato` | verb | 0 | participio passato di congegnare | `congegnare` | [congegnato](https://it.wiktionary.org/w/index.php?title=congegnato&oldid=3901355), [congegnare](https://it.wiktionary.org/w/index.php?title=congegnare&oldid=3907936) |
| 135507 | `pelo` | verb | 0 | prima persona singolare dell'indicativo presente di pelare | `pelare` | [pelo](https://it.wiktionary.org/w/index.php?title=pelo&oldid=4063262), [pelare](https://it.wiktionary.org/w/index.php?title=pelare&oldid=4039609) |
| 135511 | `aporetica` | adj | 0 | femminile di aporetico | `aporetico` | [aporetica](https://it.wiktionary.org/w/index.php?title=aporetica&oldid=4245622), [aporetico](https://it.wiktionary.org/w/index.php?title=aporetico&oldid=3627195) |
| 135546 | `tonni` | noun | 0 | plurale di tonno | `tonno` | [tonni](https://it.wiktionary.org/w/index.php?title=tonni&oldid=3798303), [tonno](https://it.wiktionary.org/w/index.php?title=tonno&oldid=3939041) |
| 135546 | `tonni` | noun | 1 | plurale di tonno | `tonno` | [tonni](https://it.wiktionary.org/w/index.php?title=tonni&oldid=3798303), [tonno](https://it.wiktionary.org/w/index.php?title=tonno&oldid=3939041) |
| 135570 | `bagnate` | verb | 1 | seconda persona plurale dell'indicativo presente di bagnare | `bagnare` | [bagnate](https://it.wiktionary.org/w/index.php?title=bagnate&oldid=3859588), [bagnare](https://it.wiktionary.org/w/index.php?title=bagnare&oldid=3991846) |
| 135570 | `bagnate` | verb | 2 | seconda persona plurale dell'imperativo presente di bagnare | `bagnare` | [bagnate](https://it.wiktionary.org/w/index.php?title=bagnate&oldid=3859588), [bagnare](https://it.wiktionary.org/w/index.php?title=bagnare&oldid=3991846) |
| 135796 | `grazia` | verb | 0 | terza persona singolare dell'indicativo presente di graziare | `graziare` | [grazia](https://it.wiktionary.org/w/index.php?title=grazia&oldid=4047940), [graziare](https://it.wiktionary.org/w/index.php?title=graziare&oldid=4000092) |
| 135796 | `grazia` | verb | 1 | seconda persona singolare dell'imperativo presente di graziare | `graziare` | [grazia](https://it.wiktionary.org/w/index.php?title=grazia&oldid=4047940), [graziare](https://it.wiktionary.org/w/index.php?title=graziare&oldid=4000092) |
| 136449 | `fecondo` | verb | 0 | prima persona singolare dell'indicativo presente di fecondare | `fecondare` | [fecondo](https://it.wiktionary.org/w/index.php?title=fecondo&oldid=4057785), [fecondare](https://it.wiktionary.org/w/index.php?title=fecondare&oldid=3974470) |
| 136753 | `destino` | verb | 0 | terza persona plurale del congiuntivo presente di destare | `destare` | [destino](https://it.wiktionary.org/w/index.php?title=destino&oldid=3998136), [destare](https://it.wiktionary.org/w/index.php?title=destare&oldid=3954577) |
| 136753 | `destino` | verb | 1 | terza persona plurale dell'imperativo presente di destare | `destare` | [destino](https://it.wiktionary.org/w/index.php?title=destino&oldid=3998136), [destare](https://it.wiktionary.org/w/index.php?title=destare&oldid=3954577) |
| 136892 | `cooperativa` | adj | 0 | femminile di cooperativo | `cooperativo` | [cooperativa](https://it.wiktionary.org/w/index.php?title=cooperativa&oldid=4036384), [cooperativo](https://it.wiktionary.org/w/index.php?title=cooperativo&oldid=4056731) |
| 137195 | `sposi` | noun | 0 | plurale di sposo | `sposo` | [sposi](https://it.wiktionary.org/w/index.php?title=sposi&oldid=4056412), [sposo](https://it.wiktionary.org/w/index.php?title=sposo&oldid=3937855) |
| 137212 | `annullato` | verb | 0 | participio passato di annullare | `annullare` | [annullato](https://it.wiktionary.org/w/index.php?title=annullato&oldid=3859487), [annullare](https://it.wiktionary.org/w/index.php?title=annullare&oldid=3969090) |
| 137290 | `depravato` | verb | 0 | participio passato di depravare | `depravare` | [depravato](https://it.wiktionary.org/w/index.php?title=depravato&oldid=4056853), [depravare](https://it.wiktionary.org/w/index.php?title=depravare&oldid=3972242) |
| 137525 | `statica` | adj | 0 | femminile di statico | `statico` | [statica](https://it.wiktionary.org/w/index.php?title=statica&oldid=4055885), [statico](https://it.wiktionary.org/w/index.php?title=statico&oldid=4077074) |
| 137691 | `amminoglicosidi` | noun | 0 | plurale di amminoglicoside | `amminoglicoside` | [amminoglicosidi](https://it.wiktionary.org/w/index.php?title=amminoglicosidi&oldid=3825075), [amminoglicoside](https://it.wiktionary.org/w/index.php?title=amminoglicoside&oldid=3825074) |
| 137701 | `recettori` | noun | 0 | plurale di recettore | `recettore` | [recettori](https://it.wiktionary.org/w/index.php?title=recettori&oldid=3047076), [recettore](https://it.wiktionary.org/w/index.php?title=recettore&oldid=3902109) |
| 137702 | `recettrice` | noun | 0 | femminile di recettore | `recettore` | [recettrice](https://it.wiktionary.org/w/index.php?title=recettrice&oldid=3047077), [recettore](https://it.wiktionary.org/w/index.php?title=recettore&oldid=3902109) |
| 137703 | `recettrici` | noun | 0 | femminile plurale di recettore | `recettore` | [recettrici](https://it.wiktionary.org/w/index.php?title=recettrici&oldid=3047078), [recettore](https://it.wiktionary.org/w/index.php?title=recettore&oldid=3902109) |
| 138217 | `cotizzi` | noun | 0 | plurale di cotizzo | `cotizzo` | [cotizzi](https://it.wiktionary.org/w/index.php?title=cotizzi&oldid=2885626), [cotizzo](https://it.wiktionary.org/w/index.php?title=cotizzo&oldid=2885627) |
| 138245 | `frullato` | adj | 0 | participio passato di frullare | `frullare` | [frullato](https://it.wiktionary.org/w/index.php?title=frullato&oldid=3980927), [frullare](https://it.wiktionary.org/w/index.php?title=frullare&oldid=3970934) |
| 138280 | `fiacca` | adj | 0 | femminile di fiacco | `fiacco` | [fiacca](https://it.wiktionary.org/w/index.php?title=fiacca&oldid=4040507), [fiacco](https://it.wiktionary.org/w/index.php?title=fiacco&oldid=3940879) |
| 138375 | `piccato` | adj | 0 | participio passato di piccare | `piccare` | [piccato](https://it.wiktionary.org/w/index.php?title=piccato&oldid=3778840), [piccare](https://it.wiktionary.org/w/index.php?title=piccare&oldid=3506083) |
| 138390 | `fodera` | verb | 1 | seconda persona singolare dell'imperativo presente di foderare | `foderare` | [fodera](https://it.wiktionary.org/w/index.php?title=fodera&oldid=4061209), [foderare](https://it.wiktionary.org/w/index.php?title=foderare&oldid=3743829) |
| 138403 | `pendii` | noun | 0 | plurale di pendio | `pendio` | [pendii](https://it.wiktionary.org/w/index.php?title=pendii&oldid=3020818), [pendio](https://it.wiktionary.org/w/index.php?title=pendio&oldid=3985045) |
| 139073 | `cenci` | noun | 0 | plurale di cencio | `cencio` | [cenci](https://it.wiktionary.org/w/index.php?title=cenci&oldid=3273159), [cencio](https://it.wiktionary.org/w/index.php?title=cencio&oldid=3943528) |
| 139746 | `cuori` | noun | 0 | plurale di cuore | `cuore` | [cuori](https://it.wiktionary.org/w/index.php?title=cuori&oldid=4070638), [cuore](https://it.wiktionary.org/w/index.php?title=cuore&oldid=4040785) |
| 140252 | `sutura` | verb | 1 | seconda persona singolare dell'imperativo presente di suturare | `suturare` | [sutura](https://it.wiktionary.org/w/index.php?title=sutura&oldid=3837859), [suturare](https://it.wiktionary.org/w/index.php?title=suturare&oldid=3464356) |
| 141798 | `abituata` | adj | 0 | femminile di abituato | `abituato` | [abituata](https://it.wiktionary.org/w/index.php?title=abituata&oldid=3982599), [abituato](https://it.wiktionary.org/w/index.php?title=abituato&oldid=3942421) |
| 143112 | `accatastati` | adj | 0 | plurale di accatastato | `accatastato` | [accatastati](https://it.wiktionary.org/w/index.php?title=accatastati&oldid=3927428), [accatastato](https://it.wiktionary.org/w/index.php?title=accatastato&oldid=3867273) |
| 145446 | `bussi` | noun | 0 | plurale di busso | `busso` | [bussi](https://it.wiktionary.org/w/index.php?title=bussi&oldid=4014140), [busso](https://it.wiktionary.org/w/index.php?title=busso&oldid=4014139) |
| 147822 | `illuminata` | adj | 0 | femminile di illuminato | `illuminato` | [illuminata](https://it.wiktionary.org/w/index.php?title=illuminata&oldid=3930078), [illuminato](https://it.wiktionary.org/w/index.php?title=illuminato&oldid=3966688) |
| 150054 | `miniate` | verb | 2 | seconda persona plurale dell'indicativo presente di miniare | `miniare` | [miniate](https://it.wiktionary.org/w/index.php?title=miniate&oldid=3836693), [miniare](https://it.wiktionary.org/w/index.php?title=miniare&oldid=3584266) |
| 150054 | `miniate` | verb | 3 | seconda persona plurale del congiuntivo presente di miniare | `miniare` | [miniate](https://it.wiktionary.org/w/index.php?title=miniate&oldid=3836693), [miniare](https://it.wiktionary.org/w/index.php?title=miniare&oldid=3584266) |
| 150054 | `miniate` | verb | 4 | seconda persona plurale dell'imperativo presente di miniare | `miniare` | [miniate](https://it.wiktionary.org/w/index.php?title=miniate&oldid=3836693), [miniare](https://it.wiktionary.org/w/index.php?title=miniare&oldid=3584266) |
| 150392 | `originata` | adj | 0 | femminile di originato | `originato` | [originata](https://it.wiktionary.org/w/index.php?title=originata&oldid=3811063), [originato](https://it.wiktionary.org/w/index.php?title=originato&oldid=3902705) |
| 150815 | `portate` | adj | 0 | femminile plurale di portato | `portato` | [portate](https://it.wiktionary.org/w/index.php?title=portate&oldid=3875155), [portato](https://it.wiktionary.org/w/index.php?title=portato&oldid=3944898) |
| 152862 | `spariamo` | verb | 3 | prima persona plurale dell'indicativo presente di sparire | `sparire` | [spariamo](https://it.wiktionary.org/w/index.php?title=spariamo&oldid=3341883), [sparire](https://it.wiktionary.org/w/index.php?title=sparire&oldid=3943145) |
| 152862 | `spariamo` | verb | 4 | prima persona plurale del congiuntivo presente di sparire | `sparire` | [spariamo](https://it.wiktionary.org/w/index.php?title=spariamo&oldid=3341883), [sparire](https://it.wiktionary.org/w/index.php?title=sparire&oldid=3943145) |
| 152862 | `spariamo` | verb | 5 | prima persona plurale dell'imperativo di sparire | `sparire` | [spariamo](https://it.wiktionary.org/w/index.php?title=spariamo&oldid=3341883), [sparire](https://it.wiktionary.org/w/index.php?title=sparire&oldid=3943145) |
| 155046 | `alterate` | adj | 0 | femminile plurale di alterato | `alterato` | [alterate](https://it.wiktionary.org/w/index.php?title=alterate&oldid=3920205), [alterato](https://it.wiktionary.org/w/index.php?title=alterato&oldid=3751163) |
| 155562 | `addestrate` | adj | 0 | femminile plurale di addestrato | `addestrato` | [addestrate](https://it.wiktionary.org/w/index.php?title=addestrate&oldid=3867398), [addestrato](https://it.wiktionary.org/w/index.php?title=addestrato&oldid=3789265) |
| 157502 | `confederate` | adj | 0 | femminile plurale di confederato | `confederato` | [confederate](https://it.wiktionary.org/w/index.php?title=confederate&oldid=3768533), [confederato](https://it.wiktionary.org/w/index.php?title=confederato&oldid=3921623) |
| 157763 | `considerata` | adj | 0 | femminile di considerato | `considerato` | [considerata](https://it.wiktionary.org/w/index.php?title=considerata&oldid=3800241), [considerato](https://it.wiktionary.org/w/index.php?title=considerato&oldid=3799738) |
| 157945 | `curata` | adj | 0 | femminile di curato | `curato` | [curata](https://it.wiktionary.org/w/index.php?title=curata&oldid=4049294), [curato](https://it.wiktionary.org/w/index.php?title=curato&oldid=4009520) |
| 159553 | `dorata` | adj | 0 | femminile di dorato | `dorato` | [dorata](https://it.wiktionary.org/w/index.php?title=dorata&oldid=3846652), [dorato](https://it.wiktionary.org/w/index.php?title=dorato&oldid=3970217) |
| 159559 | `dorate` | adj | 0 | femminile plurale di dorato | `dorato` | [dorate](https://it.wiktionary.org/w/index.php?title=dorate&oldid=3937722), [dorato](https://it.wiktionary.org/w/index.php?title=dorato&oldid=3970217) |
| 163343 | `migliorate` | adj | 0 | femminile plurale di migliorato | `migliorato` | [migliorate](https://it.wiktionary.org/w/index.php?title=migliorate&oldid=3859106), [migliorato](https://it.wiktionary.org/w/index.php?title=migliorato&oldid=3859107) |
| 164154 | `oscura` | adj | 0 | femminile di oscuro | `oscuro` | [oscura](https://it.wiktionary.org/w/index.php?title=oscura&oldid=3964732), [oscuro](https://it.wiktionary.org/w/index.php?title=oscuro&oldid=4013761) |
| 164878 | `preparate` | adj | 0 | femminile plurale di preparato | `preparato` | [preparate](https://it.wiktionary.org/w/index.php?title=preparate&oldid=3920102), [preparato](https://it.wiktionary.org/w/index.php?title=preparato&oldid=4050223) |
| 165047 | `prosperi` | adj | 0 | plurale di prospero | `prospero` | [prosperi](https://it.wiktionary.org/w/index.php?title=prosperi&oldid=3934320), [prospero](https://it.wiktionary.org/w/index.php?title=prospero&oldid=3989521) |
| 166870 | `scioperanti` | noun | 0 | plurale di scioperante | `scioperante` | [scioperanti](https://it.wiktionary.org/w/index.php?title=scioperanti&oldid=4050172), [scioperante](https://it.wiktionary.org/w/index.php?title=scioperante&oldid=4050171) |
| 167748 | `sgombri` | adj | 0 | plurale di sgombro | `sgombro` | [sgombri](https://it.wiktionary.org/w/index.php?title=sgombri&oldid=3934550), [sgombro](https://it.wiktionary.org/w/index.php?title=sgombro&oldid=3974440) |
| 167751 | `sgombra` | adj | 0 | femminile di sgombro | `sgombro` | [sgombra](https://it.wiktionary.org/w/index.php?title=sgombra&oldid=3794421), [sgombro](https://it.wiktionary.org/w/index.php?title=sgombro&oldid=3974440) |
| 168580 | `fumò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di fumare | `fumare` | [fumò](https://it.wiktionary.org/w/index.php?title=fum%C3%B2&oldid=3997030), [fumare](https://it.wiktionary.org/w/index.php?title=fumare&oldid=3893627) |
| 168822 | `stemperata` | adj | 0 | femminile di stemperato | `stemperato` | [stemperata](https://it.wiktionary.org/w/index.php?title=stemperata&oldid=3870858), [stemperato](https://it.wiktionary.org/w/index.php?title=stemperato&oldid=3879212) |
| 169589 | `tarata` | noun | 0 | femminile di tarato | `tarato` | [tarata](https://it.wiktionary.org/w/index.php?title=tarata&oldid=3837895), [tarato](https://it.wiktionary.org/w/index.php?title=tarato&oldid=3735800) |
| 169817 | `tirate` | noun | 0 | plurale di tirata | `tirata` | [tirate](https://it.wiktionary.org/w/index.php?title=tirate&oldid=3850233), [tirata](https://it.wiktionary.org/w/index.php?title=tirata&oldid=3963055) |
| 169853 | `tollerata` | adj | 0 | femminile di tollerato | `tollerato` | [tollerata](https://it.wiktionary.org/w/index.php?title=tollerata&oldid=4034143), [tollerato](https://it.wiktionary.org/w/index.php?title=tollerato&oldid=4014209) |
| 169854 | `tollerata` | noun | 0 | femminile di tollerato | `tollerato` | [tollerata](https://it.wiktionary.org/w/index.php?title=tollerata&oldid=4034143), [tollerato](https://it.wiktionary.org/w/index.php?title=tollerato&oldid=4014209) |
| 171144 | `affamati` | adj | 0 | plurale di affamato | `affamato` | [affamati](https://it.wiktionary.org/w/index.php?title=affamati&oldid=3816984), [affamato](https://it.wiktionary.org/w/index.php?title=affamato&oldid=3968648) |
| 171534 | `armate` | adj | 0 | femminile plurale di armato | `armato` | [armate](https://it.wiktionary.org/w/index.php?title=armate&oldid=3879998), [armato](https://it.wiktionary.org/w/index.php?title=armato&oldid=3789425) |
| 173582 | `domi` | adj | 0 | plurale di domo | `domo` | [domi](https://it.wiktionary.org/w/index.php?title=domi&oldid=3751303), [domo](https://it.wiktionary.org/w/index.php?title=domo&oldid=3848634) |
| 175503 | `mima` | noun | 0 | femminile plurale di mimo | `mimo` | [mima](https://it.wiktionary.org/w/index.php?title=mima&oldid=3886181), [mimo](https://it.wiktionary.org/w/index.php?title=mimo&oldid=3902814) |
| 177174 | `bolli` | noun | 0 | plurale di bollo | `bollo` | [bolli](https://it.wiktionary.org/w/index.php?title=bolli&oldid=3960987), [bollo](https://it.wiktionary.org/w/index.php?title=bollo&oldid=4016968) |
| 179690 | `fotografata` | adj | 0 | femminile di fotografato | `fotografato` | [fotografata](https://it.wiktionary.org/w/index.php?title=fotografata&oldid=3887059), [fotografato](https://it.wiktionary.org/w/index.php?title=fotografato&oldid=3902825) |
| 181638 | `russi` | adj | 0 | plurale di russo | `russo` | [russi](https://it.wiktionary.org/w/index.php?title=russi&oldid=3999463), [russo](https://it.wiktionary.org/w/index.php?title=russo&oldid=3957296) |
| 181639 | `russi` | noun | 0 | plurale di russo | `russo` | [russi](https://it.wiktionary.org/w/index.php?title=russi&oldid=3999463), [russo](https://it.wiktionary.org/w/index.php?title=russo&oldid=3957296) |
| 181934 | `trattati` | noun | 0 | plurale di trattato | `trattato` | [trattati](https://it.wiktionary.org/w/index.php?title=trattati&oldid=4055619), [trattato](https://it.wiktionary.org/w/index.php?title=trattato&oldid=4007591) |
| 182647 | `inculate` | noun | 0 | plurale di inculata | `inculata` | [inculate](https://it.wiktionary.org/w/index.php?title=inculate&oldid=3833322), [inculata](https://it.wiktionary.org/w/index.php?title=inculata&oldid=3927067) |
| 182689 | `meditate` | adj | 0 | femminile di meditato | `meditato` | [meditate](https://it.wiktionary.org/w/index.php?title=meditate&oldid=3422545), [meditato](https://it.wiktionary.org/w/index.php?title=meditato&oldid=4031511) |
| 182729 | `presento` | verb | 1 | prima persona singolare dell'indicativo presente di presentire | `presentire` | [presento](https://it.wiktionary.org/w/index.php?title=presento&oldid=4054676), [presentire](https://it.wiktionary.org/w/index.php?title=presentire&oldid=3901786) |
| 182730 | `presenta` | verb | 3 | seconda persona singolare del congiuntivo presente di presentire | `presentire` | [presenta](https://it.wiktionary.org/w/index.php?title=presenta&oldid=3993462), [presentire](https://it.wiktionary.org/w/index.php?title=presentire&oldid=3901786) |
| 182730 | `presenta` | verb | 4 | terza persona singolare del congiuntivo presente di presentire | `presentire` | [presenta](https://it.wiktionary.org/w/index.php?title=presenta&oldid=3993462), [presentire](https://it.wiktionary.org/w/index.php?title=presentire&oldid=3901786) |
| 182730 | `presenta` | verb | 5 | terza persona singolare dell'imperativo presente di presentire | `presentire` | [presenta](https://it.wiktionary.org/w/index.php?title=presenta&oldid=3993462), [presentire](https://it.wiktionary.org/w/index.php?title=presentire&oldid=3901786) |
| 182769 | `vuota` | adj | 0 | femminile di vuoto | `vuoto` | [vuota](https://it.wiktionary.org/w/index.php?title=vuota&oldid=3995449), [vuoto](https://it.wiktionary.org/w/index.php?title=vuoto&oldid=4037657) |
| 184370 | `precipitate` | adj | 0 | femminile plurale di precipitato | `precipitato` | [precipitate](https://it.wiktionary.org/w/index.php?title=precipitate&oldid=3769015), [precipitato](https://it.wiktionary.org/w/index.php?title=precipitato&oldid=3030131) |
| 185260 | `suscitati` | adj | 0 | plurale di suscitato | `suscitato` | [suscitati](https://it.wiktionary.org/w/index.php?title=suscitati&oldid=3837854), [suscitato](https://it.wiktionary.org/w/index.php?title=suscitato&oldid=3837855) |
| 186523 | `aggiogate` | adj | 0 | femminile plurale di aggiogato | `aggiogato` | [aggiogate](https://it.wiktionary.org/w/index.php?title=aggiogate&oldid=3853900), [aggiogato](https://it.wiktionary.org/w/index.php?title=aggiogato&oldid=4007278) |
| 188062 | `bloccata` | adj | 0 | femminile di bloccato | `bloccato` | [bloccata](https://it.wiktionary.org/w/index.php?title=bloccata&oldid=3835237), [bloccato](https://it.wiktionary.org/w/index.php?title=bloccato&oldid=3835238) |
| 189852 | `corrugate` | adj | 0 | femminile plurale di corrugato | `corrugato` | [corrugate](https://it.wiktionary.org/w/index.php?title=corrugate&oldid=3855237), [corrugato](https://it.wiktionary.org/w/index.php?title=corrugato&oldid=2884581) |
| 190984 | `disbrigò` | verb | 1 | seconda persona singolare dell'imperativo presente di disbrigare | `disbrigare` | [disbrigò](https://it.wiktionary.org/w/index.php?title=disbrig%C3%B2&oldid=4007287), [disbrigare](https://it.wiktionary.org/w/index.php?title=disbrigare&oldid=4007288) |
| 191838 | `elencati` | adj | 0 | plurale di elencato | `elencato` | [elencati](https://it.wiktionary.org/w/index.php?title=elencati&oldid=3852584), [elencato](https://it.wiktionary.org/w/index.php?title=elencato&oldid=3852587) |
| 192263 | `essiccati` | adj | 0 | plurale di essiccato | `essiccato` | [essiccati](https://it.wiktionary.org/w/index.php?title=essiccati&oldid=3980100), [essiccato](https://it.wiktionary.org/w/index.php?title=essiccato&oldid=4014648) |
| 193749 | `implicata` | adj | 0 | femminile di implicato | `implicato` | [implicata](https://it.wiktionary.org/w/index.php?title=implicata&oldid=3868039), [implicato](https://it.wiktionary.org/w/index.php?title=implicato&oldid=3778579) |
| 195945 | `negata` | adj | 0 | femminile di negato | `negato` | [negata](https://it.wiktionary.org/w/index.php?title=negata&oldid=3822602), [negato](https://it.wiktionary.org/w/index.php?title=negato&oldid=3902926) |
| 197166 | `prodiga` | adj | 0 | femminile di prodigo | `prodigo` | [prodiga](https://it.wiktionary.org/w/index.php?title=prodiga&oldid=3979311), [prodigo](https://it.wiktionary.org/w/index.php?title=prodigo&oldid=4059870) |
| 197884 | `qualificate` | adj | 0 | femminile plurale di qualificato | `qualificato` | [qualificate](https://it.wiktionary.org/w/index.php?title=qualificate&oldid=3837190), [qualificato](https://it.wiktionary.org/w/index.php?title=qualificato&oldid=3997300) |
| 199639 | `rinnegate` | adj | 0 | femminile plurale di rinnegato | `rinnegato` | [rinnegate](https://it.wiktionary.org/w/index.php?title=rinnegate&oldid=3880859), [rinnegato](https://it.wiktionary.org/w/index.php?title=rinnegato&oldid=3969028) |
| 200772 | `scarichi` | adj | 0 | plurale di scarico | `scarico` | [scarichi](https://it.wiktionary.org/w/index.php?title=scarichi&oldid=3879780), [scarico](https://it.wiktionary.org/w/index.php?title=scarico&oldid=4062191) |
| 200773 | `scarichi` | noun | 0 | plurale di scarico | `scarico` | [scarichi](https://it.wiktionary.org/w/index.php?title=scarichi&oldid=3879780), [scarico](https://it.wiktionary.org/w/index.php?title=scarico&oldid=4062191) |
| 201215 | `sfoghi` | noun | 0 | plurale di sfogo | `sfogo` | [sfoghi](https://it.wiktionary.org/w/index.php?title=sfoghi&oldid=3837583), [sfogo](https://it.wiktionary.org/w/index.php?title=sfogo&oldid=3996046) |
| 201219 | `sfogate` | adj | 0 | femminile plurale di sfogato | `sfogato` | [sfogate](https://it.wiktionary.org/w/index.php?title=sfogate&oldid=3837581), [sfogato](https://it.wiktionary.org/w/index.php?title=sfogato&oldid=3775533) |
| 202081 | `sofisticata` | adj | 0 | femminile di sofisticato | `sofisticato` | [sofisticata](https://it.wiktionary.org/w/index.php?title=sofisticata&oldid=3971355), [sofisticato](https://it.wiktionary.org/w/index.php?title=sofisticato&oldid=4053060) |
| 203045 | `svaghi` | noun | 0 | plurale di svago | `svago` | [svaghi](https://it.wiktionary.org/w/index.php?title=svaghi&oldid=3345810), [svago](https://it.wiktionary.org/w/index.php?title=svago&oldid=4067058) |
| 203448 | `truccati` | adj | 0 | plurale di truccato | `truccato` | [truccati](https://it.wiktionary.org/w/index.php?title=truccati&oldid=3863204), [truccato](https://it.wiktionary.org/w/index.php?title=truccato&oldid=3780155) |
| 205057 | `allacciata` | adj | 0 | femminile di allacciato | `allacciato` | [allacciata](https://it.wiktionary.org/w/index.php?title=allacciata&oldid=3626628), [allacciato](https://it.wiktionary.org/w/index.php?title=allacciato&oldid=3903009) |
| 205349 | `angosciati` | adj | 0 | plurale di angosciato | `angosciato` | [angosciati](https://it.wiktionary.org/w/index.php?title=angosciati&oldid=3933425), [angosciato](https://it.wiktionary.org/w/index.php?title=angosciato&oldid=4043737) |
| 207015 | `crucci` | noun | 0 | plurale di cruccio | `cruccio` | [crucci](https://it.wiktionary.org/w/index.php?title=crucci&oldid=3869189), [cruccio](https://it.wiktionary.org/w/index.php?title=cruccio&oldid=4045292) |
| 209729 | `messaggi` | noun | 0 | plurale di messaggio | `messaggio` | [messaggi](https://it.wiktionary.org/w/index.php?title=messaggi&oldid=3938605), [messaggio](https://it.wiktionary.org/w/index.php?title=messaggio&oldid=4013028) |
| 210055 | `avvocatessa` | noun | 0 | femminile di avvocato | `avvocato` | [avvocatessa](https://it.wiktionary.org/w/index.php?title=avvocatessa&oldid=4014213), [avvocato](https://it.wiktionary.org/w/index.php?title=avvocato&oldid=4250968) |
| 210232 | `parcheggiata` | adj | 0 | femminile di parcheggiato | `parcheggiato` | [parcheggiata](https://it.wiktionary.org/w/index.php?title=parcheggiata&oldid=4033697), [parcheggiato](https://it.wiktionary.org/w/index.php?title=parcheggiato&oldid=3903088) |
| 211614 | `scheggiate` | adj | 0 | femminile plurale di scheggiato | `scheggiato` | [scheggiate](https://it.wiktionary.org/w/index.php?title=scheggiate&oldid=3885722), [scheggiato](https://it.wiktionary.org/w/index.php?title=scheggiato&oldid=3953836) |
| 212725 | `setacciati` | adj | 0 | plurale di setacciato | `setacciato` | [setacciati](https://it.wiktionary.org/w/index.php?title=setacciati&oldid=3921989), [setacciato](https://it.wiktionary.org/w/index.php?title=setacciato&oldid=4014811) |
| 213362 | `sorteggi` | noun | 0 | plurale di sorteggio | `sorteggio` | [sorteggi](https://it.wiktionary.org/w/index.php?title=sorteggi&oldid=3769232), [sorteggio](https://it.wiktionary.org/w/index.php?title=sorteggio&oldid=3903130) |
| 216777 | `esaltata` | adj | 0 | femminile di esaltato | `esaltato` | [esaltata](https://it.wiktionary.org/w/index.php?title=esaltata&oldid=3877267), [esaltato](https://it.wiktionary.org/w/index.php?title=esaltato&oldid=3790174) |
| 216875 | `regnanti` | adj | 0 | plurale di regnante | `regnante` | [regnanti](https://it.wiktionary.org/w/index.php?title=regnanti&oldid=3868621), [regnante](https://it.wiktionary.org/w/index.php?title=regnante&oldid=4004898) |
| 216876 | `regnanti` | noun | 0 | plurale di regnante | `regnante` | [regnanti](https://it.wiktionary.org/w/index.php?title=regnanti&oldid=3868621), [regnante](https://it.wiktionary.org/w/index.php?title=regnante&oldid=4004898) |
| 218134 | `frese` | noun | 0 | plurale di fresa | `fresa` | [frese](https://it.wiktionary.org/w/index.php?title=frese&oldid=2935363), [fresa](https://it.wiktionary.org/w/index.php?title=fresa&oldid=3773296) |
| 218713 | `citerei` | adj | 0 | plurale di citereo | `citereo` | [citerei](https://it.wiktionary.org/w/index.php?title=citerei&oldid=3719625), [citereo](https://it.wiktionary.org/w/index.php?title=citereo&oldid=3918002) |
| 219435 | `carabinieri` | noun | 0 | plurale di carabiniere | `carabiniere` | [carabinieri](https://it.wiktionary.org/w/index.php?title=carabinieri&oldid=3754508), [carabiniere](https://it.wiktionary.org/w/index.php?title=carabiniere&oldid=4049574) |
| 222186 | `forzata` | adj | 0 | femminile di forzato | `forzato` | [forzata](https://it.wiktionary.org/w/index.php?title=forzata&oldid=3883477), [forzato](https://it.wiktionary.org/w/index.php?title=forzato&oldid=4054643) |
| 223772 | `molesti` | adj | 0 | maschile plurale di molesto | `molesto` | [molesti](https://it.wiktionary.org/w/index.php?title=molesti&oldid=3792963), [molesto](https://it.wiktionary.org/w/index.php?title=molesto&oldid=4051984) |
| 224644 | `intarsiata` | adj | 0 | femminile di intarsiato | `intarsiato` | [intarsiata](https://it.wiktionary.org/w/index.php?title=intarsiata&oldid=3836413), [intarsiato](https://it.wiktionary.org/w/index.php?title=intarsiato&oldid=3954883) |
| 225807 | `tributata` | adj | 0 | femminile di tributato | `tributato` | [tributata](https://it.wiktionary.org/w/index.php?title=tributata&oldid=3825682), [tributato](https://it.wiktionary.org/w/index.php?title=tributato&oldid=3825684) |
| 226055 | `vegeti` | adj | 0 | plurale di vegeto | `vegeto` | [vegeti](https://it.wiktionary.org/w/index.php?title=vegeti&oldid=3921346), [vegeto](https://it.wiktionary.org/w/index.php?title=vegeto&oldid=3979104) |
| 226202 | `violati` | adj | 0 | plurale di violato | `violato` | [violati](https://it.wiktionary.org/w/index.php?title=violati&oldid=3718103), [violato](https://it.wiktionary.org/w/index.php?title=violato&oldid=3769899) |
| 227326 | `rifiutata` | adj | 0 | femminile di rifiutato | `rifiutato` | [rifiutata](https://it.wiktionary.org/w/index.php?title=rifiutata&oldid=3822598), [rifiutato](https://it.wiktionary.org/w/index.php?title=rifiutato&oldid=3831305) |
| 227702 | `sospettati` | adj | 0 | plurale di sospettato | `sospettato` | [sospettati](https://it.wiktionary.org/w/index.php?title=sospettati&oldid=3854289), [sospettato](https://it.wiktionary.org/w/index.php?title=sospettato&oldid=3791923) |
| 227871 | `ritrovate` | noun | 0 | plurale di ritrovato | `ritrovato` | [ritrovate](https://it.wiktionary.org/w/index.php?title=ritrovate&oldid=3437971), [ritrovato](https://it.wiktionary.org/w/index.php?title=ritrovato&oldid=3934428) |
| 227953 | `riservata` | adj | 0 | femminile di riservato | `riservato` | [riservata](https://it.wiktionary.org/w/index.php?title=riservata&oldid=3992627), [riservato](https://it.wiktionary.org/w/index.php?title=riservato&oldid=3943505) |
| 228780 | `rappresentate` | adj | 0 | femminile plurale di rappresentato | `rappresentato` | [rappresentate](https://it.wiktionary.org/w/index.php?title=rappresentate&oldid=3880982), [rappresentato](https://it.wiktionary.org/w/index.php?title=rappresentato&oldid=3791263) |
| 229042 | `riposi` | noun | 0 | plurale di riposo | `riposo` | [riposi](https://it.wiktionary.org/w/index.php?title=riposi&oldid=3878379), [riposo](https://it.wiktionary.org/w/index.php?title=riposo&oldid=3920579) |
| 229085 | `sciamannato` | verb | 0 | participio passato passato di sciamannare | `sciamannare` | [sciamannato](https://it.wiktionary.org/w/index.php?title=sciamannato&oldid=4068591), [sciamannare](https://it.wiktionary.org/w/index.php?title=sciamannare&oldid=3988163) |
| 230280 | `posizionati` | adj | 0 | plurale di posizionato | `posizionato` | [posizionati](https://it.wiktionary.org/w/index.php?title=posizionati&oldid=3974791), [posizionato](https://it.wiktionary.org/w/index.php?title=posizionato&oldid=3920026) |
| 231693 | `attrezzata` | adj | 0 | femminile di attrezzato | `attrezzato` | [attrezzata](https://it.wiktionary.org/w/index.php?title=attrezzata&oldid=3946823), [attrezzato](https://it.wiktionary.org/w/index.php?title=attrezzato&oldid=3867497) |
| 232434 | `scheda` | verb | 0 | terza persona singolare dell'indicativo presente di schedare | `schedare` | [scheda](https://it.wiktionary.org/w/index.php?title=scheda&oldid=4068671), [schedare](https://it.wiktionary.org/w/index.php?title=schedare&oldid=3649116) |
| 232434 | `scheda` | verb | 1 | seconda persona singolare dell'imperativo presente di schedare | `schedare` | [scheda](https://it.wiktionary.org/w/index.php?title=scheda&oldid=4068671), [schedare](https://it.wiktionary.org/w/index.php?title=schedare&oldid=3649116) |
| 233091 | `concordata` | adj | 0 | femminile di concordato | `concordato` | [concordata](https://it.wiktionary.org/w/index.php?title=concordata&oldid=4069982), [concordato](https://it.wiktionary.org/w/index.php?title=concordato&oldid=3991646) |
| 235977 | `attenti` | adj | 0 | plurale di attento | `attento` | [attenti](https://it.wiktionary.org/w/index.php?title=attenti&oldid=3903262), [attento](https://it.wiktionary.org/w/index.php?title=attento&oldid=4038567) |
| 237270 | `crostata` | adj | 0 | femminile di crostato | `crostato` | [crostata](https://it.wiktionary.org/w/index.php?title=crostata&oldid=3636816), [crostato](https://it.wiktionary.org/w/index.php?title=crostato&oldid=2887516) |
| 240825 | `sorvoli` | noun | 0 | plurale di sorvolo | `sorvolo` | [sorvoli](https://it.wiktionary.org/w/index.php?title=sorvoli&oldid=3920991), [sorvolo](https://it.wiktionary.org/w/index.php?title=sorvolo&oldid=4052950) |
| 241527 | `meccanizzati` | adj | 0 | plurale di meccanizzato | `meccanizzato` | [meccanizzati](https://it.wiktionary.org/w/index.php?title=meccanizzati&oldid=3991864), [meccanizzato](https://it.wiktionary.org/w/index.php?title=meccanizzato&oldid=3821065) |
| 241743 | `aggiornata` | adj | 0 | femminile di aggiornato | `aggiornato` | [aggiornata](https://it.wiktionary.org/w/index.php?title=aggiornata&oldid=3983136), [aggiornato](https://it.wiktionary.org/w/index.php?title=aggiornato&oldid=4056006) |
| 241916 | `schivi` | adj | 0 | femminile di schivo | `schivo` | [schivi](https://it.wiktionary.org/w/index.php?title=schivi&oldid=3920798), [schivo](https://it.wiktionary.org/w/index.php?title=schivo&oldid=3895456) |
| 241918 | `schiva` | adj | 0 | femminile di schivo | `schivo` | [schiva](https://it.wiktionary.org/w/index.php?title=schiva&oldid=4006510), [schivo](https://it.wiktionary.org/w/index.php?title=schivo&oldid=3895456) |
| 245101 | `scontate` | adj | 0 | femminile plurale di scontato | `scontato` | [scontate](https://it.wiktionary.org/w/index.php?title=scontate&oldid=4247889), [scontato](https://it.wiktionary.org/w/index.php?title=scontato&oldid=4248191) |
| 245950 | `accoltellati` | adj | 0 | plurale di accoltellato | `accoltellato` | [accoltellati](https://it.wiktionary.org/w/index.php?title=accoltellati&oldid=3841160), [accoltellato](https://it.wiktionary.org/w/index.php?title=accoltellato&oldid=3880791) |
| 246088 | `scarti` | adj | 0 | plurale di scarto | `scarto` | [scarti](https://it.wiktionary.org/w/index.php?title=scarti&oldid=3998163), [scarto](https://it.wiktionary.org/w/index.php?title=scarto&oldid=4248249) |
| 246089 | `scarti` | noun | 0 | plurale di scarto | `scarto` | [scarti](https://it.wiktionary.org/w/index.php?title=scarti&oldid=3998163), [scarto](https://it.wiktionary.org/w/index.php?title=scarto&oldid=4248249) |
| 247112 | `congegni` | noun | 0 | plurale di congegno | `congegno` | [congegni](https://it.wiktionary.org/w/index.php?title=congegni&oldid=3692570), [congegno](https://it.wiktionary.org/w/index.php?title=congegno&oldid=4022707) |
| 252362 | `prezzolate` | adj | 0 | femminile plurale di prezzolato | `prezzolato` | [prezzolate](https://it.wiktionary.org/w/index.php?title=prezzolate&oldid=3934300), [prezzolato](https://it.wiktionary.org/w/index.php?title=prezzolato&oldid=4057020) |
| 254085 | `recapitate` | adj | 0 | femminile plurale di recapitato | `recapitato` | [recapitate](https://it.wiktionary.org/w/index.php?title=recapitate&oldid=3807082), [recapitato](https://it.wiktionary.org/w/index.php?title=recapitato&oldid=3776225) |
| 255118 | `civilizzata` | adj | 0 | femminile di civilizzato | `civilizzato` | [civilizzata](https://it.wiktionary.org/w/index.php?title=civilizzata&oldid=3855244), [civilizzato](https://it.wiktionary.org/w/index.php?title=civilizzato&oldid=4060803) |
| 261709 | `compatti` | adj | 0 | plurale di compatto | `compatto` | [compatti](https://it.wiktionary.org/w/index.php?title=compatti&oldid=3921602), [compatto](https://it.wiktionary.org/w/index.php?title=compatto&oldid=4034041) |
| 264079 | `sollecita` | adj | 0 | femminile di sollecito | `sollecito` | [sollecita](https://it.wiktionary.org/w/index.php?title=sollecita&oldid=3800784), [sollecito](https://it.wiktionary.org/w/index.php?title=sollecito&oldid=3903382) |
| 266594 | `cesellati` | adj | 0 | plurale di cesellato | `cesellato` | [cesellati](https://it.wiktionary.org/w/index.php?title=cesellati&oldid=3859655), [cesellato](https://it.wiktionary.org/w/index.php?title=cesellato&oldid=3933592) |
| 269211 | `stonata` | adj | 0 | femminile di stonato | `stonato` | [stonata](https://it.wiktionary.org/w/index.php?title=stonata&oldid=3843476), [stonato](https://it.wiktionary.org/w/index.php?title=stonato&oldid=4019047) |
| 269212 | `stonata` | noun | 0 | femminile di stonato | `stonato` | [stonata](https://it.wiktionary.org/w/index.php?title=stonata&oldid=3843476), [stonato](https://it.wiktionary.org/w/index.php?title=stonato&oldid=4019047) |
| 269297 | `supportata` | adj | 0 | femminile singolare di supportato | `supportato` | [supportata](https://it.wiktionary.org/w/index.php?title=supportata&oldid=4047397), [supportato](https://it.wiktionary.org/w/index.php?title=supportato&oldid=3956831) |
| 272630 | `disusate` | adj | 0 | femminile plurale di disusato | `disusato` | [disusate](https://it.wiktionary.org/w/index.php?title=disusate&oldid=3829008), [disusato](https://it.wiktionary.org/w/index.php?title=disusato&oldid=3829016) |
| 281079 | `compartecipi` | noun | 0 | plurale di compartecipe | `compartecipe` | [compartecipi](https://it.wiktionary.org/w/index.php?title=compartecipi&oldid=4077075), [compartecipe](https://it.wiktionary.org/w/index.php?title=compartecipe&oldid=4032791) |
| 281292 | `connaturata` | adj | 0 | femminile di connaturato | `connaturato` | [connaturata](https://it.wiktionary.org/w/index.php?title=connaturata&oldid=3830963), [connaturato](https://it.wiktionary.org/w/index.php?title=connaturato&oldid=3983225) |
| 283896 | `incurvata` | adj | 0 | femminile di incurvato | `incurvato` | [incurvata](https://it.wiktionary.org/w/index.php?title=incurvata&oldid=3974220), [incurvato](https://it.wiktionary.org/w/index.php?title=incurvato&oldid=4059311) |
| 284925 | `invasi` | adj | 0 | plurale di invaso | `invaso` | [invasi](https://it.wiktionary.org/w/index.php?title=invasi&oldid=3869114), [invaso](https://it.wiktionary.org/w/index.php?title=invaso&oldid=3849629) |
| 285844 | `triti` | adj | 0 | plurale di trito | `trito` | [triti](https://it.wiktionary.org/w/index.php?title=triti&oldid=3921288), [trito](https://it.wiktionary.org/w/index.php?title=trito&oldid=3985660) |
| 288952 | `stipati` | adj | 0 | plurale di stipato | `stipato` | [stipati](https://it.wiktionary.org/w/index.php?title=stipati&oldid=3869781), [stipato](https://it.wiktionary.org/w/index.php?title=stipato&oldid=3792043) |
| 289796 | `vagabondi` | noun | 0 | plurale di vagabondo | `vagabondo` | [vagabondi](https://it.wiktionary.org/w/index.php?title=vagabondi&oldid=3735848), [vagabondo](https://it.wiktionary.org/w/index.php?title=vagabondo&oldid=4052462) |
| 295018 | `sciala` | verb | 0 | terza persona singolare dell'indicativo presente di scialare | `scialare` | [sciala](https://it.wiktionary.org/w/index.php?title=sciala&oldid=4251411), [scialare](https://it.wiktionary.org/w/index.php?title=scialare&oldid=3903761) |
| 298200 | `introiti` | noun | 0 | plurale di introito | `introito` | [introiti](https://it.wiktionary.org/w/index.php?title=introiti&oldid=3870477), [introito](https://it.wiktionary.org/w/index.php?title=introito&oldid=4055424) |
| 332498 | `assennati` | adj | 0 | plurale di assennato | `assennato` | [assennati](https://it.wiktionary.org/w/index.php?title=assennati&oldid=4231714), [assennato](https://it.wiktionary.org/w/index.php?title=assennato&oldid=3961470) |
| 333032 | `cenni` | noun | 0 | plurale di cenno | `cenno` | [cenni](https://it.wiktionary.org/w/index.php?title=cenni&oldid=3940161), [cenno](https://it.wiktionary.org/w/index.php?title=cenno&oldid=4012549) |
| 346324 | `palpeggi` | noun | 0 | plurale di palpeggio | `palpeggio` | [palpeggi](https://it.wiktionary.org/w/index.php?title=palpeggi&oldid=3645503), [palpeggio](https://it.wiktionary.org/w/index.php?title=palpeggio&oldid=4051873) |
| 347526 | `svantaggi` | noun | 0 | plurale di svantaggio | `svantaggio` | [svantaggi](https://it.wiktionary.org/w/index.php?title=svantaggi&oldid=4047634), [svantaggio](https://it.wiktionary.org/w/index.php?title=svantaggio&oldid=4047636) |
| 350612 | `sconcia` | adj | 0 | femminile di sconcio | `sconcio` | [sconcia](https://it.wiktionary.org/w/index.php?title=sconcia&oldid=3850034), [sconcio](https://it.wiktionary.org/w/index.php?title=sconcio&oldid=3903605) |
| 351949 | `odi` | verb | 5 | seconda persona singolare dell'indicativo presente di udire | `udire` | [odi](https://it.wiktionary.org/w/index.php?title=odi&oldid=3931786), [udire](https://it.wiktionary.org/w/index.php?title=udire&oldid=3692947) |
| 351949 | `odi` | verb | 6 | seconda persona singolare dell'imperativo presente di udire | `udire` | [odi](https://it.wiktionary.org/w/index.php?title=odi&oldid=3931786), [udire](https://it.wiktionary.org/w/index.php?title=udire&oldid=3692947) |
| 352421 | `coniati` | adj | 0 | plurale di coniato | `coniato` | [coniati](https://it.wiktionary.org/w/index.php?title=coniati&oldid=3802171), [coniato](https://it.wiktionary.org/w/index.php?title=coniato&oldid=3802377) |
| 352979 | `consigliata` | adj | 0 | femminile di consigliato | `consigliato` | [consigliata](https://it.wiktionary.org/w/index.php?title=consigliata&oldid=3829507), [consigliato](https://it.wiktionary.org/w/index.php?title=consigliato&oldid=4075625) |
| 355382 | `estasiati` | adj | 0 | plurale di estasiato | `estasiato` | [estasiati](https://it.wiktionary.org/w/index.php?title=estasiati&oldid=3848102), [estasiato](https://it.wiktionary.org/w/index.php?title=estasiato&oldid=3985481) |
| 358844 | `attorniata` | adj | 0 | femminile di attorniato | `attorniato` | [attorniata](https://it.wiktionary.org/w/index.php?title=attorniata&oldid=3818386), [attorniato](https://it.wiktionary.org/w/index.php?title=attorniato&oldid=3380813) |
| 362148 | `smaliziati` | adj | 0 | plurale di smaliziato | `smaliziato` | [smaliziati](https://it.wiktionary.org/w/index.php?title=smaliziati&oldid=3837623), [smaliziato](https://it.wiktionary.org/w/index.php?title=smaliziato&oldid=3996785) |
| 362397 | `soverchi` | adj | 0 | plurale di soverchio | `soverchio` | [soverchi](https://it.wiktionary.org/w/index.php?title=soverchi&oldid=3828836), [soverchio](https://it.wiktionary.org/w/index.php?title=soverchio&oldid=4052501) |
| 363503 | `propizia` | adj | 0 | femminile di propizio | `propizio` | [propizia](https://it.wiktionary.org/w/index.php?title=propizia&oldid=3868559), [propizio](https://it.wiktionary.org/w/index.php?title=propizio&oldid=3952606) |
| 369467 | `serva` | verb | 3 | seconda persona singolare dell'imperativo di servire | `servire` | [serva](https://it.wiktionary.org/w/index.php?title=serva&oldid=3779180), [servire](https://it.wiktionary.org/w/index.php?title=servire&oldid=4070800) |
| 371626 | `definite` | adj | 0 | femminile plurale di definito | `definito` | [definite](https://it.wiktionary.org/w/index.php?title=definite&oldid=3835635), [definito](https://it.wiktionary.org/w/index.php?title=definito&oldid=4217053) |
| 372315 | `feriti` | noun | 0 | plurale di ferita | `ferita` | [feriti](https://it.wiktionary.org/w/index.php?title=feriti&oldid=4016981), [ferita](https://it.wiktionary.org/w/index.php?title=ferita&oldid=4004785) |
| 373661 | `spedita` | adj | 0 | femminile singolare di spedito | `spedito` | [spedita](https://it.wiktionary.org/w/index.php?title=spedita&oldid=3792731), [spedito](https://it.wiktionary.org/w/index.php?title=spedito&oldid=4050664) |
| 374669 | `sostituite` | adj | 0 | femminile plurale di sostituito | `sostituito` | [sostituite](https://it.wiktionary.org/w/index.php?title=sostituite&oldid=3850116), [sostituito](https://it.wiktionary.org/w/index.php?title=sostituito&oldid=3998274) |
| 374749 | `smarriti` | adj | 0 | plurale di smarrito | `smarrito` | [smarriti](https://it.wiktionary.org/w/index.php?title=smarriti&oldid=3920939), [smarrito](https://it.wiktionary.org/w/index.php?title=smarrito&oldid=3920940) |
| 378310 | `arditi` | adj | 0 | plurale di ardito | `ardito` | [arditi](https://it.wiktionary.org/w/index.php?title=arditi&oldid=4067409), [ardito](https://it.wiktionary.org/w/index.php?title=ardito&oldid=4001410) |
| 378318 | `ardite` | adj | 0 | femminile plurale di ardito | `ardito` | [ardite](https://it.wiktionary.org/w/index.php?title=ardite&oldid=3978146), [ardito](https://it.wiktionary.org/w/index.php?title=ardito&oldid=4001410) |
| 396238 | `frolla` | adj | 0 | femminile di frollo | `frollo` | [frolla](https://it.wiktionary.org/w/index.php?title=frolla&oldid=3952786), [frollo](https://it.wiktionary.org/w/index.php?title=frollo&oldid=3654068) |
| 396579 | `sfiatate` | noun | 0 | plurale di sfiatata | `sfiatata` | [sfiatate](https://it.wiktionary.org/w/index.php?title=sfiatate&oldid=3662295), [sfiatata](https://it.wiktionary.org/w/index.php?title=sfiatata&oldid=3662296) |
| 398621 | `stramazzi` | noun | 0 | plurale di stramazzo | `stramazzo` | [stramazzi](https://it.wiktionary.org/w/index.php?title=stramazzi&oldid=3943515), [stramazzo](https://it.wiktionary.org/w/index.php?title=stramazzo&oldid=3943516) |
| 400263 | `sbagliate` | adj | 0 | femminile plurale di sbagliato | `sbagliato` | [sbagliate](https://it.wiktionary.org/w/index.php?title=sbagliate&oldid=4003707), [sbagliato](https://it.wiktionary.org/w/index.php?title=sbagliato&oldid=3981996) |
| 400919 | `indotte` | adj | 0 | femminile plurale di indotto | `indotto` | [indotte](https://it.wiktionary.org/w/index.php?title=indotte&oldid=3961869), [indotto](https://it.wiktionary.org/w/index.php?title=indotto&oldid=3888336) |
| 404984 | `angiosperme` | adj | 0 | femminile di angiospermo | `angiospermo` | [angiosperme](https://it.wiktionary.org/w/index.php?title=angiosperme&oldid=3903948), [angiospermo](https://it.wiktionary.org/w/index.php?title=angiospermo&oldid=3907078) |
| 405544 | `alfabloccanti` | noun | 0 | plurale di alfabloccante | `alfabloccante` | [alfabloccanti](https://it.wiktionary.org/w/index.php?title=alfabloccanti&oldid=3252751), [alfabloccante](https://it.wiktionary.org/w/index.php?title=alfabloccante&oldid=3742522) |
| 405855 | `ecclesiastica` | noun | 0 | femminile di ecclesiastico | `ecclesiastico` | [ecclesiastica](https://it.wiktionary.org/w/index.php?title=ecclesiastica&oldid=3831128), [ecclesiastico](https://it.wiktionary.org/w/index.php?title=ecclesiastico&oldid=3835808) |
| 406427 | `impegnati` | adj | 0 | plurale di impegnato | `impegnato` | [impegnati](https://it.wiktionary.org/w/index.php?title=impegnati&oldid=3807628), [impegnato](https://it.wiktionary.org/w/index.php?title=impegnato&oldid=3947816) |
| 406429 | `impegnata` | adj | 0 | femminile di impegnato | `impegnato` | [impegnata](https://it.wiktionary.org/w/index.php?title=impegnata&oldid=3868034), [impegnato](https://it.wiktionary.org/w/index.php?title=impegnato&oldid=3947816) |
| 407500 | `raccolte` | noun | 0 | plurale di raccolta | `raccolta` | [raccolte](https://it.wiktionary.org/w/index.php?title=raccolte&oldid=4048637), [raccolta](https://it.wiktionary.org/w/index.php?title=raccolta&oldid=4076740) |
| 410634 | `scomposti` | adj | 0 | plurale di scomposto | `scomposto` | [scomposti](https://it.wiktionary.org/w/index.php?title=scomposti&oldid=3868756), [scomposto](https://it.wiktionary.org/w/index.php?title=scomposto&oldid=4065800) |
| 410679 | `sottoposti` | adj | 0 | femminile plurale di sottoposto | `sottoposto` | [sottoposti](https://it.wiktionary.org/w/index.php?title=sottoposti&oldid=3838820), [sottoposto](https://it.wiktionary.org/w/index.php?title=sottoposto&oldid=4002135) |
| 412930 | `veterinari` | noun | 0 | plurale di veterinario | `veterinario` | [veterinari](https://it.wiktionary.org/w/index.php?title=veterinari&oldid=3652496), [veterinario](https://it.wiktionary.org/w/index.php?title=veterinario&oldid=3895592) |
| 413664 | `amminozuccheri` | noun | 0 | plurale di amminozucchero | `amminozucchero` | [amminozuccheri](https://it.wiktionary.org/w/index.php?title=amminozuccheri&oldid=2228820), [amminozucchero](https://it.wiktionary.org/w/index.php?title=amminozucchero&oldid=3473791) |
| 414219 | `arancioni` | adj | 0 | plurale di arancione | `arancione` | [arancioni](https://it.wiktionary.org/w/index.php?title=arancioni&oldid=3378750), [arancione](https://it.wiktionary.org/w/index.php?title=arancione&oldid=3942391) |
| 414691 | `protratta` | adj | 0 | femminile di protratto | `protratto` | [protratta](https://it.wiktionary.org/w/index.php?title=protratta&oldid=4047180), [protratto](https://it.wiktionary.org/w/index.php?title=protratto&oldid=3856881) |
| 415251 | `detenuta` | adj | 0 | femminile di detenuto | `detenuto` | [detenuta](https://it.wiktionary.org/w/index.php?title=detenuta&oldid=3977014), [detenuto](https://it.wiktionary.org/w/index.php?title=detenuto&oldid=3983146) |
| 415252 | `detenuta` | noun | 0 | femminile di detenuto | `detenuto` | [detenuta](https://it.wiktionary.org/w/index.php?title=detenuta&oldid=3977014), [detenuto](https://it.wiktionary.org/w/index.php?title=detenuto&oldid=3983146) |
| 416668 | `esploso` | verb | 0 | participio passato di esplodere | `esplodere` | [esploso](https://it.wiktionary.org/w/index.php?title=esploso&oldid=3777860), [esplodere](https://it.wiktionary.org/w/index.php?title=esplodere&oldid=3893601) |
| 417559 | `dossi` | noun | 0 | plurale di dosso | `dosso` | [dossi](https://it.wiktionary.org/w/index.php?title=dossi&oldid=4047405), [dosso](https://it.wiktionary.org/w/index.php?title=dosso&oldid=3970818) |
| 418086 | `mietitrice` | noun | 0 | femminile di mietitore | `mietitore` | [mietitrice](https://it.wiktionary.org/w/index.php?title=mietitrice&oldid=3423514), [mietitore](https://it.wiktionary.org/w/index.php?title=mietitore&oldid=3815722) |
| 418415 | `nubi` | noun | 0 | plurale di nube | `nube` | [nubi](https://it.wiktionary.org/w/index.php?title=nubi&oldid=4017225), [nube](https://it.wiktionary.org/w/index.php?title=nube&oldid=3998878) |
| 419219 | `coltroni` | noun | 0 | plurale di coltrone | `coltrone` | [coltroni](https://it.wiktionary.org/w/index.php?title=coltroni&oldid=2873125), [coltrone](https://it.wiktionary.org/w/index.php?title=coltrone&oldid=3941054) |
| 419220 | `trapunte` | noun | 0 | plurale di trapunta | `trapunta` | [trapunte](https://it.wiktionary.org/w/index.php?title=trapunte&oldid=3144671), [trapunta](https://it.wiktionary.org/w/index.php?title=trapunta&oldid=3941053) |
| 419319 | `visti` | adj | 0 | plurale di visto | `visto` | [visti](https://it.wiktionary.org/w/index.php?title=visti&oldid=3940339), [visto](https://it.wiktionary.org/w/index.php?title=visto&oldid=4048297) |
| 419320 | `visti` | noun | 0 | plurale di visto | `visto` | [visti](https://it.wiktionary.org/w/index.php?title=visti&oldid=3940339), [visto](https://it.wiktionary.org/w/index.php?title=visto&oldid=4048297) |
| 419321 | `visti` | verb | 3 | seconda persona singolare del congiuntivo presente di vistare | `vistare` | [visti](https://it.wiktionary.org/w/index.php?title=visti&oldid=3940339), [vistare](https://it.wiktionary.org/w/index.php?title=vistare&oldid=3776379) |
| 419321 | `visti` | verb | 5 | terza persona singolare dell'imperativo presente di vistare | `vistare` | [visti](https://it.wiktionary.org/w/index.php?title=visti&oldid=3940339), [vistare](https://it.wiktionary.org/w/index.php?title=vistare&oldid=3776379) |
| 419384 | `mormorii` | noun | 0 | plurale di mormorio | `mormorio` | [mormorii](https://it.wiktionary.org/w/index.php?title=mormorii&oldid=3312905), [mormorio](https://it.wiktionary.org/w/index.php?title=mormorio&oldid=3644353) |
| 419518 | `pizzoccheri` | noun | 0 | plurale di pizzocchero | `pizzocchero` | [pizzoccheri](https://it.wiktionary.org/w/index.php?title=pizzoccheri&oldid=3721056), [pizzocchero](https://it.wiktionary.org/w/index.php?title=pizzocchero&oldid=3432021) |
| 419902 | `combinatoria` | adj | 0 | femminile di combinatorio | `combinatorio` | [combinatoria](https://it.wiktionary.org/w/index.php?title=combinatoria&oldid=3392400), [combinatorio](https://it.wiktionary.org/w/index.php?title=combinatorio&oldid=3392401) |
| 419967 | `motociclisti` | noun | 0 | plurale di motociclista | `motociclista` | [motociclisti](https://it.wiktionary.org/w/index.php?title=motociclisti&oldid=4049043), [motociclista](https://it.wiktionary.org/w/index.php?title=motociclista&oldid=4028202) |
| 420445 | `socchiuso` | verb | 0 | participio passato di socchiudere | `socchiudere` | [socchiuso](https://it.wiktionary.org/w/index.php?title=socchiuso&oldid=4052898), [socchiudere](https://it.wiktionary.org/w/index.php?title=socchiudere&oldid=4076247) |
| 420446 | `senziente` | verb | 0 | participio presente di sentire | `sentire` | [senziente](https://it.wiktionary.org/w/index.php?title=senziente&oldid=4069775), [sentire](https://it.wiktionary.org/w/index.php?title=sentire&oldid=4038218) |
| 421214 | `forzature` | noun | 0 | plurale di forzatura | `forzatura` | [forzature](https://it.wiktionary.org/w/index.php?title=forzature&oldid=3406495), [forzatura](https://it.wiktionary.org/w/index.php?title=forzatura&oldid=4057084) |
| 422394 | `pollini` | noun | 0 | plurale di polline | `polline` | [pollini](https://it.wiktionary.org/w/index.php?title=pollini&oldid=3535693), [polline](https://it.wiktionary.org/w/index.php?title=polline&oldid=4075909) |
| 422419 | `attinenze` | noun | 0 | plurale di attinenza | `attinenza` | [attinenze](https://it.wiktionary.org/w/index.php?title=attinenze&oldid=3380773), [attinenza](https://it.wiktionary.org/w/index.php?title=attinenza&oldid=3380772) |
| 422426 | `ripicche` | noun | 0 | plurale di ripicca | `ripicca` | [ripicche](https://it.wiktionary.org/w/index.php?title=ripicche&oldid=3437740), [ripicca](https://it.wiktionary.org/w/index.php?title=ripicca&oldid=3779681) |
| 422436 | `parlamentari` | noun | 0 | plurale di parlamentare | `parlamentare` | [parlamentari](https://it.wiktionary.org/w/index.php?title=parlamentari&oldid=3924360), [parlamentare](https://it.wiktionary.org/w/index.php?title=parlamentare&oldid=3901773) |
| 422899 | `bradicardie` | noun | 0 | plurale di bradicardia | `bradicardia` | [bradicardie](https://it.wiktionary.org/w/index.php?title=bradicardie&oldid=2853029), [bradicardia](https://it.wiktionary.org/w/index.php?title=bradicardia&oldid=3987394) |
| 422990 | `solitudini` | noun | 0 | plurale di solitudine | `solitudine` | [solitudini](https://it.wiktionary.org/w/index.php?title=solitudini&oldid=3838817), [solitudine](https://it.wiktionary.org/w/index.php?title=solitudine&oldid=3999126) |
| 423222 | `intese` | adj | 0 | femminile plurale di inteso | `inteso` | [intese](https://it.wiktionary.org/w/index.php?title=intese&oldid=3972795), [inteso](https://it.wiktionary.org/w/index.php?title=inteso&oldid=3972764) |
| 423300 | `ragionamenti` | noun | 0 | plurale di ragionamento | `ragionamento` | [ragionamenti](https://it.wiktionary.org/w/index.php?title=ragionamenti&oldid=3936412), [ragionamento](https://it.wiktionary.org/w/index.php?title=ragionamento&oldid=3948316) |
| 423353 | `ominidi` | noun | 0 | plurale di ominide | `ominide` | [ominidi](https://it.wiktionary.org/w/index.php?title=ominidi&oldid=3619457), [ominide](https://it.wiktionary.org/w/index.php?title=ominide&oldid=3901599) |
| 423726 | `gladiatrice` | noun | 0 | femminile di gladiatore | `gladiatore` | [gladiatrice](https://it.wiktionary.org/w/index.php?title=gladiatrice&oldid=3975094), [gladiatore](https://it.wiktionary.org/w/index.php?title=gladiatore&oldid=4010129) |
| 423879 | `assistiti` | noun | 0 | plurale di assistito | `assistito` | [assistiti](https://it.wiktionary.org/w/index.php?title=assistiti&oldid=3847033), [assistito](https://it.wiktionary.org/w/index.php?title=assistito&oldid=4052135) |
| 423880 | `assistiti` | noun | 0 | plurale di assistito | `assistito` | [assistiti](https://it.wiktionary.org/w/index.php?title=assistiti&oldid=3847033), [assistito](https://it.wiktionary.org/w/index.php?title=assistito&oldid=4052135) |
| 424198 | `persistenti` | verb | 0 | participio presente plurale di persistente | `persistente` | [persistenti](https://it.wiktionary.org/w/index.php?title=persistenti&oldid=4049201), [persistente](https://it.wiktionary.org/w/index.php?title=persistente&oldid=3968490) |
| 425090 | `apologisti` | noun | 0 | plurale di apologista | `apologista` | [apologisti](https://it.wiktionary.org/w/index.php?title=apologisti&oldid=3378238), [apologista](https://it.wiktionary.org/w/index.php?title=apologista&oldid=4045411) |
| 425091 | `apologiste` | noun | 0 | plurale di apologista | `apologista` | [apologiste](https://it.wiktionary.org/w/index.php?title=apologiste&oldid=3378237), [apologista](https://it.wiktionary.org/w/index.php?title=apologista&oldid=4045411) |
| 425139 | `fanciulle` | noun | 0 | plurale di fanciulla | `fanciulla` | [fanciulle](https://it.wiktionary.org/w/index.php?title=fanciulle&oldid=3855027), [fanciulla](https://it.wiktionary.org/w/index.php?title=fanciulla&oldid=3933824) |
| 427564 | `scuri` | noun | 0 | plurale di scuro | `scuro` | [scuri](https://it.wiktionary.org/w/index.php?title=scuri&oldid=3964207), [scuro](https://it.wiktionary.org/w/index.php?title=scuro&oldid=3936535) |
| 429547 | `mutamenti` | noun | 0 | plurale di mutamento | `mutamento` | [mutamenti](https://it.wiktionary.org/w/index.php?title=mutamenti&oldid=3313421), [mutamento](https://it.wiktionary.org/w/index.php?title=mutamento&oldid=4033845) |
| 429556 | `vendite` | noun | 0 | plurale di vendita | `vendita` | [vendite](https://it.wiktionary.org/w/index.php?title=vendite&oldid=3817395), [vendita](https://it.wiktionary.org/w/index.php?title=vendita&oldid=4058748) |
| 431077 | `puliture` | noun | 0 | plurale di pulitura | `pulitura` | [puliture](https://it.wiktionary.org/w/index.php?title=puliture&oldid=3323579), [pulitura](https://it.wiktionary.org/w/index.php?title=pulitura&oldid=3647591) |
| 431125 | `invase` | adj | 0 | femminile plurale di invaso | `invaso` | [invase](https://it.wiktionary.org/w/index.php?title=invase&oldid=3836447), [invaso](https://it.wiktionary.org/w/index.php?title=invaso&oldid=3849629) |
| 432027 | `fraintese` | verb | 1 | participio passato plurale femminile di fraintendere | `fraintendere` | [fraintese](https://it.wiktionary.org/w/index.php?title=fraintese&oldid=3979467), [fraintendere](https://it.wiktionary.org/w/index.php?title=fraintendere&oldid=4042429) |
| 432148 | `pretese` | noun | 0 | plurale di pretesa | `pretesa` | [pretese](https://it.wiktionary.org/w/index.php?title=pretese&oldid=4042620), [pretesa](https://it.wiktionary.org/w/index.php?title=pretesa&oldid=4010274) |
| 432991 | `dipendenti` | adj | 0 | femminile di dipendente | `dipendente` | [dipendenti](https://it.wiktionary.org/w/index.php?title=dipendenti&oldid=3869607), [dipendente](https://it.wiktionary.org/w/index.php?title=dipendente&oldid=4007092) |
| 433810 | `anatemi` | noun | 0 | plurale di anatema | `anatema` | [anatemi](https://it.wiktionary.org/w/index.php?title=anatemi&oldid=3259925), [anatema](https://it.wiktionary.org/w/index.php?title=anatema&oldid=4046278) |
| 434213 | `vissuta` | adj | 0 | femminile di vissuto | `vissuto` | [vissuta](https://it.wiktionary.org/w/index.php?title=vissuta&oldid=3861835), [vissuto](https://it.wiktionary.org/w/index.php?title=vissuto&oldid=3842204) |
| 435320 | `percorsi` | adj | 0 | plurale di percorso | `percorso` | [percorsi](https://it.wiktionary.org/w/index.php?title=percorsi&oldid=3972637), [percorso](https://it.wiktionary.org/w/index.php?title=percorso&oldid=3994005) |
| 435412 | `ricorrenti` | noun | 0 | plurale di ricorrente | `ricorrente` | [ricorrenti](https://it.wiktionary.org/w/index.php?title=ricorrenti&oldid=3920479), [ricorrente](https://it.wiktionary.org/w/index.php?title=ricorrente&oldid=3868649) |
| 441222 | `ettolitri` | noun | 0 | plurale di ettolitro | `ettolitro` | [ettolitri](https://it.wiktionary.org/w/index.php?title=ettolitri&oldid=3639017), [ettolitro](https://it.wiktionary.org/w/index.php?title=ettolitro&oldid=4023785) |
| 442025 | `dotti` | noun | 0 | plurale di dotto | `dotto` | [dotti](https://it.wiktionary.org/w/index.php?title=dotti&oldid=3905432), [dotto](https://it.wiktionary.org/w/index.php?title=dotto&oldid=3891920) |
| 442032 | `studiosa` | noun | 0 | femminile di studioso | `studioso` | [studiosa](https://it.wiktionary.org/w/index.php?title=studiosa&oldid=3905435), [studioso](https://it.wiktionary.org/w/index.php?title=studioso&oldid=3895310) |
| 442034 | `studiosi` | noun | 0 | plurale di studioso | `studioso` | [studiosi](https://it.wiktionary.org/w/index.php?title=studiosi&oldid=3930207), [studioso](https://it.wiktionary.org/w/index.php?title=studioso&oldid=3895310) |
| 442036 | `studiose` | noun | 0 | femminile plurale di studioso | `studioso` | [studiose](https://it.wiktionary.org/w/index.php?title=studiose&oldid=3905437), [studioso](https://it.wiktionary.org/w/index.php?title=studioso&oldid=3895310) |
| 442121 | `gioiosi` | adj | 0 | plurale di gioioso | `gioioso` | [gioiosi](https://it.wiktionary.org/w/index.php?title=gioiosi&oldid=3936902), [gioioso](https://it.wiktionary.org/w/index.php?title=gioioso&oldid=4008416) |
| 442122 | `gioiosa` | adj | 0 | femminile di gioioso | `gioioso` | [gioiosa](https://it.wiktionary.org/w/index.php?title=gioiosa&oldid=3905449), [gioioso](https://it.wiktionary.org/w/index.php?title=gioioso&oldid=4008416) |
| 442123 | `gioiose` | adj | 0 | plurale di gioioso | `gioioso` | [gioiose](https://it.wiktionary.org/w/index.php?title=gioiose&oldid=3905450), [gioioso](https://it.wiktionary.org/w/index.php?title=gioioso&oldid=4008416) |
| 442241 | `interessamenti` | noun | 0 | plurale di interessamento | `interessamento` | [interessamenti](https://it.wiktionary.org/w/index.php?title=interessamenti&oldid=3304961), [interessamento](https://it.wiktionary.org/w/index.php?title=interessamento&oldid=3949684) |
| 444509 | `sorrette` | adj | 0 | femminile plurale di sorretto | `sorretto` | [sorrette](https://it.wiktionary.org/w/index.php?title=sorrette&oldid=3851992), [sorretto](https://it.wiktionary.org/w/index.php?title=sorretto&oldid=2713718) |
| 446357 | `disfatte` | noun | 0 | plurale di disfatta | `disfatta` | [disfatte](https://it.wiktionary.org/w/index.php?title=disfatte&oldid=3284582), [disfatta](https://it.wiktionary.org/w/index.php?title=disfatta&oldid=3893914) |
| 446969 | `sinestesie` | noun | 0 | plurale di sinestesia | `sinestesia` | [sinestesie](https://it.wiktionary.org/w/index.php?title=sinestesie&oldid=3339055), [sinestesia](https://it.wiktionary.org/w/index.php?title=sinestesia&oldid=3891960) |
| 446999 | `iodoformi` | noun | 0 | plurale di iodoformio | `iodoformio` | [iodoformi](https://it.wiktionary.org/w/index.php?title=iodoformi&oldid=3642357), [iodoformio](https://it.wiktionary.org/w/index.php?title=iodoformio&oldid=3863143) |
| 447061 | `fauni` | noun | 0 | plurale di fauno | `fauno` | [fauni](https://it.wiktionary.org/w/index.php?title=fauni&oldid=3404505), [fauno](https://it.wiktionary.org/w/index.php?title=fauno&oldid=3936402) |
| 447065 | `assiomi` | noun | 0 | plurale di assioma | `assioma` | [assiomi](https://it.wiktionary.org/w/index.php?title=assiomi&oldid=3380243), [assioma](https://it.wiktionary.org/w/index.php?title=assioma&oldid=4015861) |
| 447342 | `genetiche` | adj | 0 | femminile plurale di genetico | `genetico` | [genetiche](https://it.wiktionary.org/w/index.php?title=genetiche&oldid=3967308), [genetico](https://it.wiktionary.org/w/index.php?title=genetico&oldid=4002735) |
| 447352 | `eugenetiche` | noun | 0 | femminile di eugenetica | `eugenetica` | [eugenetiche](https://it.wiktionary.org/w/index.php?title=eugenetiche&oldid=3639027), [eugenetica](https://it.wiktionary.org/w/index.php?title=eugenetica&oldid=4012015) |
| 447543 | `scheletrica` | adj | 0 | femminile di scheletrico | `scheletrico` | [scheletrica](https://it.wiktionary.org/w/index.php?title=scheletrica&oldid=4066660), [scheletrico](https://it.wiktionary.org/w/index.php?title=scheletrico&oldid=4009886) |
| 447544 | `scheletrici` | adj | 0 | plurale di scheletrico | `scheletrico` | [scheletrici](https://it.wiktionary.org/w/index.php?title=scheletrici&oldid=3888476), [scheletrico](https://it.wiktionary.org/w/index.php?title=scheletrico&oldid=4009886) |
| 447650 | `agostiniani` | noun | 0 | plurale di agostiniano | `agostiniano` | [agostiniani](https://it.wiktionary.org/w/index.php?title=agostiniani&oldid=4031019), [agostiniano](https://it.wiktionary.org/w/index.php?title=agostiniano&oldid=4033322) |
| 447726 | `anatomisti` | noun | 0 | plurale di anatomista | `anatomista` | [anatomisti](https://it.wiktionary.org/w/index.php?title=anatomisti&oldid=3287228), [anatomista](https://it.wiktionary.org/w/index.php?title=anatomista&oldid=3862024) |
| 447727 | `anatomiste` | noun | 0 | femminile plurale di anatomista | `anatomista` | [anatomiste](https://it.wiktionary.org/w/index.php?title=anatomiste&oldid=3626912), [anatomista](https://it.wiktionary.org/w/index.php?title=anatomista&oldid=3862024) |
| 447757 | `retriva` | adj | 0 | femminile di retrivo | `retrivo` | [retriva](https://it.wiktionary.org/w/index.php?title=retriva&oldid=3437031), [retrivo](https://it.wiktionary.org/w/index.php?title=retrivo&oldid=4011902) |
| 447758 | `retrivi` | adj | 0 | plurale di retrivo | `retrivo` | [retrivi](https://it.wiktionary.org/w/index.php?title=retrivi&oldid=3437033), [retrivo](https://it.wiktionary.org/w/index.php?title=retrivo&oldid=4011902) |
| 447797 | `contrafforti` | noun | 0 | plurale di contrafforte | `contrafforte` | [contrafforti](https://it.wiktionary.org/w/index.php?title=contrafforti&oldid=4046341), [contrafforte](https://it.wiktionary.org/w/index.php?title=contrafforte&oldid=3965038) |
| 448422 | `darviniana` | noun | 0 | femminile di darviniano | `darviniano` | [darviniana](https://it.wiktionary.org/w/index.php?title=darviniana&oldid=3665810), [darviniano](https://it.wiktionary.org/w/index.php?title=darviniano&oldid=3636119) |
| 448428 | `darwinisti` | noun | 0 | plurale di darwinista | `darwinista` | [darwinisti](https://it.wiktionary.org/w/index.php?title=darwinisti&oldid=3636125), [darwinista](https://it.wiktionary.org/w/index.php?title=darwinista&oldid=3974127) |
| 448430 | `darwiniste` | noun | 0 | plurale di darwinista | `darwinista` | [darwiniste](https://it.wiktionary.org/w/index.php?title=darwiniste&oldid=3636124), [darwinista](https://it.wiktionary.org/w/index.php?title=darwinista&oldid=3974127) |
| 448443 | `redivivi` | noun | 0 | plurale di redivivo | `redivivo` | [redivivi](https://it.wiktionary.org/w/index.php?title=redivivi&oldid=3648030), [redivivo](https://it.wiktionary.org/w/index.php?title=redivivo&oldid=3901423) |
| 448566 | `cartucce` | noun | 0 | plurale di cartuccia | `cartuccia` | [cartucce](https://it.wiktionary.org/w/index.php?title=cartucce&oldid=3272453), [cartuccia](https://it.wiktionary.org/w/index.php?title=cartuccia&oldid=3952517) |
| 448599 | `pieghevoli` | noun | 0 | plurale di pieghevole | `pieghevole` | [pieghevoli](https://it.wiktionary.org/w/index.php?title=pieghevoli&oldid=3905668), [pieghevole](https://it.wiktionary.org/w/index.php?title=pieghevole&oldid=3902454) |
| 449134 | `antropofagie` | noun | 0 | plurale di antropofagia | `antropofagia` | [antropofagie](https://it.wiktionary.org/w/index.php?title=antropofagie&oldid=3627150), [antropofagia](https://it.wiktionary.org/w/index.php?title=antropofagia&oldid=3905621) |
| 449340 | `crotonesi` | noun | 0 | plurale di crotonese | `crotonese` | [crotonesi](https://it.wiktionary.org/w/index.php?title=crotonesi&oldid=3665809), [crotonese](https://it.wiktionary.org/w/index.php?title=crotonese&oldid=4248008) |
| 449508 | `costruttori` | noun | 0 | plurale di costruttore | `costruttore` | [costruttori](https://it.wiktionary.org/w/index.php?title=costruttori&oldid=3635849), [costruttore](https://it.wiktionary.org/w/index.php?title=costruttore&oldid=3782550) |
| 449660 | `ambientalisti` | noun | 0 | plurale di ambientalista | `ambientalista` | [ambientalisti](https://it.wiktionary.org/w/index.php?title=ambientalisti&oldid=3626764), [ambientalista](https://it.wiktionary.org/w/index.php?title=ambientalista&oldid=3883079) |
| 449662 | `ambientaliste` | noun | 0 | plurale di ambientalista | `ambientalista` | [ambientaliste](https://it.wiktionary.org/w/index.php?title=ambientaliste&oldid=3626763), [ambientalista](https://it.wiktionary.org/w/index.php?title=ambientalista&oldid=3883079) |
| 449680 | `leghisti` | noun | 0 | plurale di leghista | `leghista` | [leghisti](https://it.wiktionary.org/w/index.php?title=leghisti&oldid=3642932), [leghista](https://it.wiktionary.org/w/index.php?title=leghista&oldid=3705063) |
| 449682 | `leghiste` | noun | 0 | plurale di leghista | `leghista` | [leghiste](https://it.wiktionary.org/w/index.php?title=leghiste&oldid=3642931), [leghista](https://it.wiktionary.org/w/index.php?title=leghista&oldid=3705063) |
| 449703 | `mongole` | noun | 0 | plurale di mongola | `mongola` | [mongole](https://it.wiktionary.org/w/index.php?title=mongole&oldid=3644269), [mongola](https://it.wiktionary.org/w/index.php?title=mongola&oldid=3851575) |
| 449770 | `scriteriata` | noun | 0 | femminile di scriteriato | `scriteriato` | [scriteriata](https://it.wiktionary.org/w/index.php?title=scriteriata&oldid=3649348), [scriteriato](https://it.wiktionary.org/w/index.php?title=scriteriato&oldid=3975367) |
| 449772 | `scriteriati` | noun | 0 | plurale di scriteriato | `scriteriato` | [scriteriati](https://it.wiktionary.org/w/index.php?title=scriteriati&oldid=4076868), [scriteriato](https://it.wiktionary.org/w/index.php?title=scriteriato&oldid=3975367) |
| 449774 | `scriteriate` | noun | 0 | plurale di scriteriata | `scriteriata` | [scriteriate](https://it.wiktionary.org/w/index.php?title=scriteriate&oldid=3649349), [scriteriata](https://it.wiktionary.org/w/index.php?title=scriteriata&oldid=3649348) |
| 449820 | `neorealiste` | adj | 0 | femminile plurale di neorealista | `neorealista` | [neorealiste](https://it.wiktionary.org/w/index.php?title=neorealiste&oldid=3487982), [neorealista](https://it.wiktionary.org/w/index.php?title=neorealista&oldid=3426014) |
| 449821 | `neorealiste` | noun | 0 | femminile plurale di neorealista | `neorealista` | [neorealiste](https://it.wiktionary.org/w/index.php?title=neorealiste&oldid=3487982), [neorealista](https://it.wiktionary.org/w/index.php?title=neorealista&oldid=3426014) |
| 449878 | `botanici` | noun | 0 | plurale di botanico | `botanico` | [botanici](https://it.wiktionary.org/w/index.php?title=botanici&oldid=3633614), [botanico](https://it.wiktionary.org/w/index.php?title=botanico&oldid=3902455) |
| 449880 | `botaniche` | noun | 0 | femminile plurale di botanico | `botanico` | [botaniche](https://it.wiktionary.org/w/index.php?title=botaniche&oldid=3942060), [botanico](https://it.wiktionary.org/w/index.php?title=botanico&oldid=3902455) |
| 449890 | `contestatori` | noun | 0 | plurale di contestatore | `contestatore` | [contestatori](https://it.wiktionary.org/w/index.php?title=contestatori&oldid=3635530), [contestatore](https://it.wiktionary.org/w/index.php?title=contestatore&oldid=4053267) |
| 449892 | `contestatrice` | noun | 0 | femminile di contestatore | `contestatore` | [contestatrice](https://it.wiktionary.org/w/index.php?title=contestatrice&oldid=3635531), [contestatore](https://it.wiktionary.org/w/index.php?title=contestatore&oldid=4053267) |
| 449894 | `contestatrici` | noun | 0 | plurale di contestatrice | `contestatrice` | [contestatrici](https://it.wiktionary.org/w/index.php?title=contestatrici&oldid=3635532), [contestatrice](https://it.wiktionary.org/w/index.php?title=contestatrice&oldid=3635531) |
| 449979 | `affascinatori` | noun | 0 | plurale di affascinatore | `affascinatore` | [affascinatori](https://it.wiktionary.org/w/index.php?title=affascinatori&oldid=3626379), [affascinatore](https://it.wiktionary.org/w/index.php?title=affascinatore&oldid=3504489) |
| 449981 | `affascinatrice` | noun | 0 | femminile di affascinatore | `affascinatore` | [affascinatrice](https://it.wiktionary.org/w/index.php?title=affascinatrice&oldid=3626380), [affascinatore](https://it.wiktionary.org/w/index.php?title=affascinatore&oldid=3504489) |
| 449983 | `affascinatrici` | noun | 0 | plurale di affascinatrice | `affascinatrice` | [affascinatrici](https://it.wiktionary.org/w/index.php?title=affascinatrici&oldid=3626381), [affascinatrice](https://it.wiktionary.org/w/index.php?title=affascinatrice&oldid=3626380) |
| 450161 | `masticatori` | noun | 0 | plurale di masticatore | `masticatore` | [masticatori](https://it.wiktionary.org/w/index.php?title=masticatori&oldid=3823676), [masticatore](https://it.wiktionary.org/w/index.php?title=masticatore&oldid=3310486) |
| 450163 | `masticatrice` | noun | 0 | femminile di masticatore | `masticatore` | [masticatrice](https://it.wiktionary.org/w/index.php?title=masticatrice&oldid=3665343), [masticatore](https://it.wiktionary.org/w/index.php?title=masticatore&oldid=3310486) |
| 450165 | `masticatrici` | noun | 0 | plurale di masticatrice | `masticatrice` | [masticatrici](https://it.wiktionary.org/w/index.php?title=masticatrici&oldid=3661648), [masticatrice](https://it.wiktionary.org/w/index.php?title=masticatrice&oldid=3665343) |
| 450209 | `progressiste` | noun | 0 | plurale di progressista | `progressista` | [progressiste](https://it.wiktionary.org/w/index.php?title=progressiste&oldid=3647363), [progressista](https://it.wiktionary.org/w/index.php?title=progressista&oldid=3952865) |
| 450323 | `precambriani` | noun | 0 | plurale di precambriano | `precambriano` | [precambriani](https://it.wiktionary.org/w/index.php?title=precambriani&oldid=3661841), [precambriano](https://it.wiktionary.org/w/index.php?title=precambriano&oldid=3831151) |
| 450327 | `archeozoici` | noun | 0 | plurale di archeozoico | `archeozoico` | [archeozoici](https://it.wiktionary.org/w/index.php?title=archeozoici&oldid=3627338), [archeozoico](https://it.wiktionary.org/w/index.php?title=archeozoico&oldid=3378893) |
| 450412 | `terminali` | noun | 0 | plurale di terminale | `terminale` | [terminali](https://it.wiktionary.org/w/index.php?title=terminali&oldid=3662406), [terminale](https://it.wiktionary.org/w/index.php?title=terminale&oldid=4047359) |
| 450531 | `panamensi` | noun | 0 | plurale di panamense | `panamense` | [panamensi](https://it.wiktionary.org/w/index.php?title=panamensi&oldid=3645515), [panamense](https://it.wiktionary.org/w/index.php?title=panamense&oldid=3957446) |
| 450535 | `siberiane` | noun | 0 | plurale di siberiana | `siberiana` | [siberiane](https://it.wiktionary.org/w/index.php?title=siberiane&oldid=3649747), [siberiana](https://it.wiktionary.org/w/index.php?title=siberiana&oldid=3810233) |
| 450537 | `siberiana` | noun | 0 | femminile di siberiano | `siberiano` | [siberiana](https://it.wiktionary.org/w/index.php?title=siberiana&oldid=3810233), [siberiano](https://it.wiktionary.org/w/index.php?title=siberiano&oldid=3895210) |
| 450539 | `siberiani` | noun | 0 | plurale di siberiano | `siberiano` | [siberiani](https://it.wiktionary.org/w/index.php?title=siberiani&oldid=3649748), [siberiano](https://it.wiktionary.org/w/index.php?title=siberiano&oldid=3895210) |
| 450546 | `cilena` | adj | 0 | femminile di cileno | `cileno` | [cilena](https://it.wiktionary.org/w/index.php?title=cilena&oldid=3724404), [cileno](https://it.wiktionary.org/w/index.php?title=cileno&oldid=3957414) |
| 450547 | `cilena` | noun | 0 | femminile di cileno | `cileno` | [cilena](https://it.wiktionary.org/w/index.php?title=cilena&oldid=3724404), [cileno](https://it.wiktionary.org/w/index.php?title=cileno&oldid=3957414) |
| 450561 | `teoretiche` | noun | 0 | plurale di teoretica | `teoretica` | [teoretiche](https://it.wiktionary.org/w/index.php?title=teoretiche&oldid=3651395), [teoretica](https://it.wiktionary.org/w/index.php?title=teoretica&oldid=4037782) |
| 450760 | `penitenziari` | noun | 0 | plurale di penitenziario | `penitenziario` | [penitenziari](https://it.wiktionary.org/w/index.php?title=penitenziari&oldid=3958080), [penitenziario](https://it.wiktionary.org/w/index.php?title=penitenziario&oldid=3897560) |
| 450776 | `protettori` | noun | 0 | plurale di protettore | `protettore` | [protettori](https://it.wiktionary.org/w/index.php?title=protettori&oldid=3323166), [protettore](https://it.wiktionary.org/w/index.php?title=protettore&oldid=4007468) |
| 450778 | `protettrice` | noun | 0 | femminile di protettore | `protettore` | [protettrice](https://it.wiktionary.org/w/index.php?title=protettrice&oldid=3323167), [protettore](https://it.wiktionary.org/w/index.php?title=protettore&oldid=4007468) |
| 450942 | `bloggisti` | noun | 0 | plurale di bloggista | `bloggista` | [bloggisti](https://it.wiktionary.org/w/index.php?title=bloggisti&oldid=3269708), [bloggista](https://it.wiktionary.org/w/index.php?title=bloggista&oldid=3682026) |
| 450943 | `bloggiste` | noun | 0 | plurale di bloggista | `bloggista` | [bloggiste](https://it.wiktionary.org/w/index.php?title=bloggiste&oldid=3269707), [bloggista](https://it.wiktionary.org/w/index.php?title=bloggista&oldid=3682026) |
| 450953 | `turistica` | adj | 0 | femminile di turistico | `turistico` | [turistica](https://it.wiktionary.org/w/index.php?title=turistica&oldid=3662434), [turistico](https://it.wiktionary.org/w/index.php?title=turistico&oldid=4037499) |
| 451007 | `tribune` | noun | 0 | plurale di tribuna | `tribuna` | [tribune](https://it.wiktionary.org/w/index.php?title=tribune&oldid=3988499), [tribuna](https://it.wiktionary.org/w/index.php?title=tribuna&oldid=3506825) |
| 451041 | `collettivisti` | noun | 0 | plurale di collettivista | `collettivista` | [collettivisti](https://it.wiktionary.org/w/index.php?title=collettivisti&oldid=3634973), [collettivista](https://it.wiktionary.org/w/index.php?title=collettivista&oldid=3392211) |
| 451043 | `collettiviste` | noun | 0 | plurale di collettivista | `collettivista` | [collettiviste](https://it.wiktionary.org/w/index.php?title=collettiviste&oldid=3634972), [collettivista](https://it.wiktionary.org/w/index.php?title=collettivista&oldid=3392211) |
| 451502 | `inaridimenti` | noun | 0 | plurale di inaridimento | `inaridimento` | [inaridimenti](https://it.wiktionary.org/w/index.php?title=inaridimenti&oldid=3641135), [inaridimento](https://it.wiktionary.org/w/index.php?title=inaridimento&oldid=3975534) |
| 451522 | `rachitica` | noun | 0 | femminile di rachitico | `rachitico` | [rachitica](https://it.wiktionary.org/w/index.php?title=rachitica&oldid=3647781), [rachitico](https://it.wiktionary.org/w/index.php?title=rachitico&oldid=4035778) |
| 451524 | `rachitiche` | noun | 0 | plurale di rachitica | `rachitica` | [rachitiche](https://it.wiktionary.org/w/index.php?title=rachitiche&oldid=4028052), [rachitica](https://it.wiktionary.org/w/index.php?title=rachitica&oldid=3647781) |
| 451526 | `rachitici` | noun | 0 | plurale di rachitico | `rachitico` | [rachitici](https://it.wiktionary.org/w/index.php?title=rachitici&oldid=3647783), [rachitico](https://it.wiktionary.org/w/index.php?title=rachitico&oldid=4035778) |
| 451616 | `interconnessioni` | noun | 0 | plurale di interconnessione | `interconnessione` | [interconnessioni](https://it.wiktionary.org/w/index.php?title=interconnessioni&oldid=3304930), [interconnessione](https://it.wiktionary.org/w/index.php?title=interconnessione&oldid=3415302) |
| 451624 | `pigmei` | noun | 0 | plurale di pigmeo | `pigmeo` | [pigmei](https://it.wiktionary.org/w/index.php?title=pigmei&oldid=3646115), [pigmeo](https://it.wiktionary.org/w/index.php?title=pigmeo&oldid=4053089) |
| 451628 | `pigmea` | noun | 0 | femminile di pigmeo | `pigmeo` | [pigmea](https://it.wiktionary.org/w/index.php?title=pigmea&oldid=3960228), [pigmeo](https://it.wiktionary.org/w/index.php?title=pigmeo&oldid=4053089) |
| 452175 | `omofobi` | noun | 0 | plurale di omofobo | `omofobo` | [omofobi](https://it.wiktionary.org/w/index.php?title=omofobi&oldid=3645083), [omofobo](https://it.wiktionary.org/w/index.php?title=omofobo&oldid=4027874) |
| 452177 | `omofobe` | noun | 0 | plurale di omofoba | `omofoba` | [omofobe](https://it.wiktionary.org/w/index.php?title=omofobe&oldid=3645082), [omofoba](https://it.wiktionary.org/w/index.php?title=omofoba&oldid=3645081) |
| 452179 | `omofoba` | noun | 0 | femminile di omofobo | `omofobo` | [omofoba](https://it.wiktionary.org/w/index.php?title=omofoba&oldid=3645081), [omofobo](https://it.wiktionary.org/w/index.php?title=omofobo&oldid=4027874) |
| 452181 | `pinete` | noun | 0 | plurale di pineta | `pineta` | [pinete](https://it.wiktionary.org/w/index.php?title=pinete&oldid=3319673), [pineta](https://it.wiktionary.org/w/index.php?title=pineta&oldid=3646132) |
| 452321 | `scissionisti` | noun | 0 | plurale di scissionista | `scissionista` | [scissionisti](https://it.wiktionary.org/w/index.php?title=scissionisti&oldid=3649208), [scissionista](https://it.wiktionary.org/w/index.php?title=scissionista&oldid=4076536) |
| 452323 | `scissioniste` | noun | 0 | plurale di scissionista | `scissionista` | [scissioniste](https://it.wiktionary.org/w/index.php?title=scissioniste&oldid=3649207), [scissionista](https://it.wiktionary.org/w/index.php?title=scissionista&oldid=4076536) |
| 452541 | `regressioni` | noun | 0 | plurale di regressione | `regressione` | [regressioni](https://it.wiktionary.org/w/index.php?title=regressioni&oldid=3326322), [regressione](https://it.wiktionary.org/w/index.php?title=regressione&oldid=3974097) |
| 453214 | `graduali` | noun | 0 | plurale di graduale | `graduale` | [graduali](https://it.wiktionary.org/w/index.php?title=graduali&oldid=3661477), [graduale](https://it.wiktionary.org/w/index.php?title=graduale&oldid=3979333) |
| 453381 | `atea` | noun | 0 | femminile di ateo | `ateo` | [atea](https://it.wiktionary.org/w/index.php?title=atea&oldid=3664730), [ateo](https://it.wiktionary.org/w/index.php?title=ateo&oldid=3942419) |
| 453412 | `eclittiche` | noun | 0 | plurale di eclittica | `eclittica` | [eclittiche](https://it.wiktionary.org/w/index.php?title=eclittiche&oldid=3288568), [eclittica](https://it.wiktionary.org/w/index.php?title=eclittica&oldid=3901035) |
| 453456 | `capitalisti` | noun | 0 | plurale di capitalista | `capitalista` | [capitalisti](https://it.wiktionary.org/w/index.php?title=capitalisti&oldid=3634051), [capitalista](https://it.wiktionary.org/w/index.php?title=capitalista&oldid=4054605) |
| 453460 | `capitaliste` | noun | 0 | plurale di capitalista | `capitalista` | [capitaliste](https://it.wiktionary.org/w/index.php?title=capitaliste&oldid=3634050), [capitalista](https://it.wiktionary.org/w/index.php?title=capitalista&oldid=4054605) |
| 454086 | `populisti` | noun | 0 | plurale di populista | `populista` | [populisti](https://it.wiktionary.org/w/index.php?title=populisti&oldid=3646414), [populista](https://it.wiktionary.org/w/index.php?title=populista&oldid=3902344) |
| 454088 | `populiste` | noun | 0 | plurale di populista | `populista` | [populiste](https://it.wiktionary.org/w/index.php?title=populiste&oldid=3646413), [populista](https://it.wiktionary.org/w/index.php?title=populista&oldid=3902344) |
| 454449 | `precettori` | noun | 0 | plurale di precettore | `precettore` | [precettori](https://it.wiktionary.org/w/index.php?title=precettori&oldid=3872480), [precettore](https://it.wiktionary.org/w/index.php?title=precettore&oldid=3954892) |
| 454743 | `fidi` | noun | 0 | plurale di fido | `fido` | [fidi](https://it.wiktionary.org/w/index.php?title=fidi&oldid=3835994), [fido](https://it.wiktionary.org/w/index.php?title=fido&oldid=4054167) |
| 454746 | `fida` | verb | 1 | seconda persona singolare dell'imperativo presente di fidare | `fidare` | [fida](https://it.wiktionary.org/w/index.php?title=fida&oldid=3835988), [fidare](https://it.wiktionary.org/w/index.php?title=fidare&oldid=3778587) |
| 454937 | `posteri` | noun | 0 | plurale di postero | `postero` | [posteri](https://it.wiktionary.org/w/index.php?title=posteri&oldid=4041006), [postero](https://it.wiktionary.org/w/index.php?title=postero&oldid=3646492) |
| 454939 | `postera` | noun | 0 | femminile di postero | `postero` | [postera](https://it.wiktionary.org/w/index.php?title=postera&oldid=3646487), [postero](https://it.wiktionary.org/w/index.php?title=postero&oldid=3646492) |
| 454941 | `postere` | noun | 0 | plurale di postera | `postera` | [postere](https://it.wiktionary.org/w/index.php?title=postere&oldid=3646488), [postera](https://it.wiktionary.org/w/index.php?title=postera&oldid=3646487) |
| 454946 | `arcieri` | noun | 0 | plurale di arciere | `arciere` | [arcieri](https://it.wiktionary.org/w/index.php?title=arcieri&oldid=3855250), [arciere](https://it.wiktionary.org/w/index.php?title=arciere&oldid=3905931) |
| 455130 | `britannici` | noun | 0 | plurale di britannico | `britannico` | [britannici](https://it.wiktionary.org/w/index.php?title=britannici&oldid=3924127), [britannico](https://it.wiktionary.org/w/index.php?title=britannico&oldid=3957353) |
| 455135 | `endocardi` | noun | 0 | plurale di endocardio | `endocardio` | [endocardi](https://it.wiktionary.org/w/index.php?title=endocardi&oldid=3289667), [endocardio](https://it.wiktionary.org/w/index.php?title=endocardio&oldid=3940526) |
| 455163 | `ripetitori` | noun | 0 | plurale di ripetitore | `ripetitore` | [ripetitori](https://it.wiktionary.org/w/index.php?title=ripetitori&oldid=3330770), [ripetitore](https://it.wiktionary.org/w/index.php?title=ripetitore&oldid=4010016) |
| 455180 | `formatrici` | noun | 0 | plurale di formatrice | `formatrice` | [formatrici](https://it.wiktionary.org/w/index.php?title=formatrici&oldid=3582979), [formatrice](https://it.wiktionary.org/w/index.php?title=formatrice&oldid=3582978) |
| 455183 | `formatori` | noun | 0 | plurale di formatore | `formatore` | [formatori](https://it.wiktionary.org/w/index.php?title=formatori&oldid=3582980), [formatore](https://it.wiktionary.org/w/index.php?title=formatore&oldid=3764107) |
| 455876 | `manicomi` | noun | 0 | plurale di manicomio | `manicomio` | [manicomi](https://it.wiktionary.org/w/index.php?title=manicomi&oldid=3309885), [manicomio](https://it.wiktionary.org/w/index.php?title=manicomio&oldid=3985823) |
| 455882 | `selvaggi` | noun | 0 | plurale di selvaggio | `selvaggio` | [selvaggi](https://it.wiktionary.org/w/index.php?title=selvaggi&oldid=3994294), [selvaggio](https://it.wiktionary.org/w/index.php?title=selvaggio&oldid=4004927) |
| 455884 | `selvagge` | noun | 0 | plurale di selvaggia | `selvaggia` | [selvagge](https://it.wiktionary.org/w/index.php?title=selvagge&oldid=3942549), [selvaggia](https://it.wiktionary.org/w/index.php?title=selvaggia&oldid=3649476) |
| 456098 | `radioripetitori` | noun | 0 | plurale di radioripetitore | `radioripetitore` | [radioripetitori](https://it.wiktionary.org/w/index.php?title=radioripetitori&oldid=3324675), [radioripetitore](https://it.wiktionary.org/w/index.php?title=radioripetitore&oldid=4010018) |
| 457416 | `angolari` | adj | 0 | plurale di angolare | `angolare` | [angolari](https://it.wiktionary.org/w/index.php?title=angolari&oldid=3993746), [angolare](https://it.wiktionary.org/w/index.php?title=angolare&oldid=4001066) |
| 457542 | `soprammobili` | noun | 0 | plurale di soprammobile | `soprammobile` | [soprammobili](https://it.wiktionary.org/w/index.php?title=soprammobili&oldid=3340834), [soprammobile](https://it.wiktionary.org/w/index.php?title=soprammobile&oldid=3997418) |
| 457602 | `missilistiche` | noun | 0 | plurale di missilistica | `missilistica` | [missilistiche](https://it.wiktionary.org/w/index.php?title=missilistiche&oldid=3423912), [missilistica](https://it.wiktionary.org/w/index.php?title=missilistica&oldid=3967811) |
| 457628 | `Rotiferi` | noun | 0 | plurale di rotifero | `rotifero` | [Rotiferi](https://it.wiktionary.org/w/index.php?title=Rotiferi&oldid=3363663), [rotifero](https://it.wiktionary.org/w/index.php?title=rotifero&oldid=3438358) |
| 457690 | `universi` | noun | 0 | plurale di universo | `universo` | [universi](https://it.wiktionary.org/w/index.php?title=universi&oldid=3449474), [universo](https://it.wiktionary.org/w/index.php?title=universo&oldid=4043267) |
| 457733 | `microstrisce` | noun | 0 | plurale di microstriscia | `microstriscia` | [microstrisce](https://it.wiktionary.org/w/index.php?title=microstrisce&oldid=3838258), [microstriscia](https://it.wiktionary.org/w/index.php?title=microstriscia&oldid=3489885) |
| 458098 | `realisti` | adj | 0 | plurale di realista | `realista` | [realisti](https://it.wiktionary.org/w/index.php?title=realisti&oldid=3873344), [realista](https://it.wiktionary.org/w/index.php?title=realista&oldid=3879527) |
| 458099 | `realisti` | noun | 0 | plurale di realista | `realista` | [realisti](https://it.wiktionary.org/w/index.php?title=realisti&oldid=3873344), [realista](https://it.wiktionary.org/w/index.php?title=realista&oldid=3879527) |
| 458737 | `gastronomi` | noun | 0 | plurale di gastronomo | `gastronomo` | [gastronomi](https://it.wiktionary.org/w/index.php?title=gastronomi&oldid=3295675), [gastronomo](https://it.wiktionary.org/w/index.php?title=gastronomo&oldid=3706854) |
| 458738 | `gastronome` | noun | 0 | plurale di gastronoma | `gastronoma` | [gastronome](https://it.wiktionary.org/w/index.php?title=gastronome&oldid=3295673), [gastronoma](https://it.wiktionary.org/w/index.php?title=gastronoma&oldid=3295672) |
| 459140 | `urbanistiche` | noun | 0 | plurale di urbanistica | `urbanistica` | [urbanistiche](https://it.wiktionary.org/w/index.php?title=urbanistiche&oldid=3652188), [urbanistica](https://it.wiktionary.org/w/index.php?title=urbanistica&oldid=4067208) |
| 459349 | `antibiotici` | noun | 0 | plurale di antibiotico | `antibiotico` | [antibiotici](https://it.wiktionary.org/w/index.php?title=antibiotici&oldid=3677128), [antibiotico](https://it.wiktionary.org/w/index.php?title=antibiotico&oldid=3742612) |
| 459971 | `prevaricatrice` | noun | 0 | femminile di prevaricatore | `prevaricatore` | [prevaricatrice](https://it.wiktionary.org/w/index.php?title=prevaricatrice&oldid=3858615), [prevaricatore](https://it.wiktionary.org/w/index.php?title=prevaricatore&oldid=3868549) |
| 460461 | `pensatoi` | noun | 0 | plurale di pensatoio | `pensatoio` | [pensatoi](https://it.wiktionary.org/w/index.php?title=pensatoi&oldid=3205855), [pensatoio](https://it.wiktionary.org/w/index.php?title=pensatoio&oldid=3645848) |
| 460637 | `superpoteri` | noun | 0 | plurale di superpotere | `superpotere` | [superpoteri](https://it.wiktionary.org/w/index.php?title=superpoteri&oldid=3475447), [superpotere](https://it.wiktionary.org/w/index.php?title=superpotere&oldid=3785650) |
| 461267 | `sepolto` | verb | 0 | participio passato di seppellire | `seppellire` | [sepolto](https://it.wiktionary.org/w/index.php?title=sepolto&oldid=3791789), [seppellire](https://it.wiktionary.org/w/index.php?title=seppellire&oldid=4044614) |
| 462355 | `sferoidi` | noun | 0 | plurale di sferoide | `sferoide` | [sferoidi](https://it.wiktionary.org/w/index.php?title=sferoidi&oldid=3441429), [sferoide](https://it.wiktionary.org/w/index.php?title=sferoide&oldid=3955487) |
| 462388 | `arie` | noun | 0 | plurale di aria | `aria` | [arie](https://it.wiktionary.org/w/index.php?title=arie&oldid=3969456), [aria](https://it.wiktionary.org/w/index.php?title=aria&oldid=4045603) |
| 462606 | `guantoni` | noun | 0 | plurale di guantone | `guantone` | [guantoni](https://it.wiktionary.org/w/index.php?title=guantoni&oldid=3640543), [guantone](https://it.wiktionary.org/w/index.php?title=guantone&oldid=3906312) |
| 462926 | `bufaghe` | noun | 0 | plurale di bufaga | `bufaga` | [bufaghe](https://it.wiktionary.org/w/index.php?title=bufaghe&oldid=3481743), [bufaga](https://it.wiktionary.org/w/index.php?title=bufaga&oldid=3906516) |
| 463049 | `lattaia` | noun | 0 | femminile di lattaio | `lattaio` | [lattaia](https://it.wiktionary.org/w/index.php?title=lattaia&oldid=3307720), [lattaio](https://it.wiktionary.org/w/index.php?title=lattaio&oldid=3683845) |
| 463176 | `bastoncelli` | noun | 0 | plurale di bastoncello | `bastoncello` | [bastoncelli](https://it.wiktionary.org/w/index.php?title=bastoncelli&oldid=3268246), [bastoncello](https://it.wiktionary.org/w/index.php?title=bastoncello&oldid=3906538) |
| 463321 | `traci` | noun | 0 | plurale di trace | `trace` | [traci](https://it.wiktionary.org/w/index.php?title=traci&oldid=3906556), [trace](https://it.wiktionary.org/w/index.php?title=trace&oldid=3995605) |
| 463329 | `massicce` | adj | 0 | femminile plurale di massiccio | `massiccio` | [massicce](https://it.wiktionary.org/w/index.php?title=massicce&oldid=3881186), [massiccio](https://it.wiktionary.org/w/index.php?title=massiccio&oldid=3996662) |
| 463471 | `longitudini` | noun | 0 | plurale di longitudine | `longitudine` | [longitudini](https://it.wiktionary.org/w/index.php?title=longitudini&oldid=3233142), [longitudine](https://it.wiktionary.org/w/index.php?title=longitudine&oldid=4014983) |
| 463516 | `concitamenti` | noun | 0 | plurale di concitamento | `concitamento` | [concitamenti](https://it.wiktionary.org/w/index.php?title=concitamenti&oldid=3233654), [concitamento](https://it.wiktionary.org/w/index.php?title=concitamento&oldid=3906569) |
| 463531 | `prosillogismi` | noun | 0 | plurale di prosillogismo | `prosillogismo` | [prosillogismi](https://it.wiktionary.org/w/index.php?title=prosillogismi&oldid=3838408), [prosillogismo](https://it.wiktionary.org/w/index.php?title=prosillogismo&oldid=3906573) |
| 463577 | `eurocrati` | noun | 0 | plurale di eurocrate | `eurocrate` | [eurocrati](https://it.wiktionary.org/w/index.php?title=eurocrati&oldid=3403511), [eurocrate](https://it.wiktionary.org/w/index.php?title=eurocrate&oldid=3403509) |
| 463586 | `boccioli` | noun | 0 | plurale di bocciolo | `bocciolo` | [boccioli](https://it.wiktionary.org/w/index.php?title=boccioli&oldid=4247820), [bocciolo](https://it.wiktionary.org/w/index.php?title=bocciolo&oldid=3981886) |
| 463591 | `triumviri` | noun | 0 | plurale di triumviro | `triumviro` | [triumviri](https://it.wiktionary.org/w/index.php?title=triumviri&oldid=3886160), [triumviro](https://it.wiktionary.org/w/index.php?title=triumviro&oldid=3475544) |
| 463751 | `vedremo` | verb | 0 | prima persona plurale dell'indicativo futuro semplice di vedere | `vedere` | [vedremo](https://it.wiktionary.org/w/index.php?title=vedremo&oldid=4051886), [vedere](https://it.wiktionary.org/w/index.php?title=vedere&oldid=4042937) |
| 463799 | `microbiologa` | noun | 0 | femminile di microbiologo | `microbiologo` | [microbiologa](https://it.wiktionary.org/w/index.php?title=microbiologa&oldid=3906598), [microbiologo](https://it.wiktionary.org/w/index.php?title=microbiologo&oldid=3905791) |
| 463886 | `catapecchie` | noun | 0 | plurale di catapecchia | `catapecchia` | [catapecchie](https://it.wiktionary.org/w/index.php?title=catapecchie&oldid=3933573), [catapecchia](https://it.wiktionary.org/w/index.php?title=catapecchia&oldid=4044464) |
| 463968 | `assisa` | adj | 0 | femminile di assiso | `assiso` | [assisa](https://it.wiktionary.org/w/index.php?title=assisa&oldid=3818129), [assiso](https://it.wiktionary.org/w/index.php?title=assiso&oldid=3776475) |
| 464042 | `prosapie` | noun | 0 | plurale di prosapia | `prosapia` | [prosapie](https://it.wiktionary.org/w/index.php?title=prosapie&oldid=3287375), [prosapia](https://it.wiktionary.org/w/index.php?title=prosapia&oldid=4058467) |
| 464513 | `gluoni` | noun | 0 | plurale di gluone | `gluone` | [gluoni](https://it.wiktionary.org/w/index.php?title=gluoni&oldid=3804038), [gluone](https://it.wiktionary.org/w/index.php?title=gluone&oldid=3988746) |
| 464514 | `muoni` | noun | 0 | plurale di muone | `muone` | [muoni](https://it.wiktionary.org/w/index.php?title=muoni&oldid=3425120), [muone](https://it.wiktionary.org/w/index.php?title=muone&oldid=4034633) |
| 464708 | `metropolitani` | noun | 0 | plurale di metropolitano | `metropolitano` | [metropolitani](https://it.wiktionary.org/w/index.php?title=metropolitani&oldid=3643999), [metropolitano](https://it.wiktionary.org/w/index.php?title=metropolitano&oldid=3766273) |
| 464836 | `monorotaie` | noun | 0 | plurale di monorotaia | `monorotaia` | [monorotaie](https://it.wiktionary.org/w/index.php?title=monorotaie&oldid=3464152), [monorotaia](https://it.wiktionary.org/w/index.php?title=monorotaia&oldid=3843925) |
| 465008 | `capite` | verb | 2 | seconda persona plurale dell'imperativo presente di capire | `capire` | [capite](https://it.wiktionary.org/w/index.php?title=capite&oldid=4035273), [capire](https://it.wiktionary.org/w/index.php?title=capire&oldid=4043205) |
| 465599 | `discepola` | noun | 0 | femminile di discepolo | `discepolo` | [discepola](https://it.wiktionary.org/w/index.php?title=discepola&oldid=3474254), [discepolo](https://it.wiktionary.org/w/index.php?title=discepolo&oldid=4069710) |
| 465611 | `simulatrice` | noun | 0 | femminile di simulatore | `simulatore` | [simulatrice](https://it.wiktionary.org/w/index.php?title=simulatrice&oldid=3806942), [simulatore](https://it.wiktionary.org/w/index.php?title=simulatore&oldid=4054991) |
| 465685 | `biofarmaci` | noun | 0 | plurale di biofarmaco | `biofarmaco` | [biofarmaci](https://it.wiktionary.org/w/index.php?title=biofarmaci&oldid=3473459), [biofarmaco](https://it.wiktionary.org/w/index.php?title=biofarmaco&oldid=3742769) |
| 465706 | `barbara` | noun | 0 | femminile di barbaro | `barbaro` | [barbara](https://it.wiktionary.org/w/index.php?title=barbara&oldid=3974314), [barbaro](https://it.wiktionary.org/w/index.php?title=barbaro&oldid=4026388) |
| 465884 | `dogmatica` | adj | 0 | femminile di dogmatico | `dogmatico` | [dogmatica](https://it.wiktionary.org/w/index.php?title=dogmatica&oldid=3971454), [dogmatico](https://it.wiktionary.org/w/index.php?title=dogmatico&oldid=4052548) |
| 466129 | `Crocodili` | noun | 0 | plurale di crocodilio | `crocodilio` | [Crocodili](https://it.wiktionary.org/w/index.php?title=Crocodili&oldid=3492937), [crocodilio](https://it.wiktionary.org/w/index.php?title=crocodilio&oldid=3493708) |
| 466141 | `Crotalidi` | noun | 0 | plurale di crotalide | `crotalide` | [Crotalidi](https://it.wiktionary.org/w/index.php?title=Crotalidi&oldid=3622131), [crotalide](https://it.wiktionary.org/w/index.php?title=crotalide&oldid=3635982) |
| 466151 | `Alligatoridi` | noun | 0 | plurale di alligatoride | `alligatoride` | [Alligatoridi](https://it.wiktionary.org/w/index.php?title=Alligatoridi&oldid=3906869), [alligatoride](https://it.wiktionary.org/w/index.php?title=alligatoride&oldid=3906868) |
| 466154 | `Didelfidi` | noun | 0 | plurale di didelfide | `didelfide` | [Didelfidi](https://it.wiktionary.org/w/index.php?title=Didelfidi&oldid=3658450), [didelfide](https://it.wiktionary.org/w/index.php?title=didelfide&oldid=3658445) |
| 466157 | `Macropodidi` | noun | 0 | plurale di macropodide | `macropodide` | [Macropodidi](https://it.wiktionary.org/w/index.php?title=Macropodidi&oldid=3622401), [macropodide](https://it.wiktionary.org/w/index.php?title=macropodide&oldid=3784096) |
| 466160 | `Falangeridi` | noun | 0 | plurale di falangeride | `falangeride` | [Falangeridi](https://it.wiktionary.org/w/index.php?title=Falangeridi&oldid=3906872), [falangeride](https://it.wiktionary.org/w/index.php?title=falangeride&oldid=3906871) |
| 466178 | `Struzioniformi` | noun | 0 | plurale di struzioniforme | `struzioniforme` | [Struzioniformi](https://it.wiktionary.org/w/index.php?title=Struzioniformi&oldid=3768259), [struzioniforme](https://it.wiktionary.org/w/index.php?title=struzioniforme&oldid=3763632) |
| 466234 | `Gasteropodi` | noun | 0 | plurale di gasteropode | `gasteropode` | [Gasteropodi](https://it.wiktionary.org/w/index.php?title=Gasteropodi&oldid=3786529), [gasteropode](https://it.wiktionary.org/w/index.php?title=gasteropode&oldid=4052263) |
| 466239 | `Lacertidi` | noun | 0 | plurale di lacertide | `lacertide` | [Lacertidi](https://it.wiktionary.org/w/index.php?title=Lacertidi&oldid=3906892), [lacertide](https://it.wiktionary.org/w/index.php?title=lacertide&oldid=3906893) |
| 494768 | `orate` | noun | 0 | plurale di orata | `orata` | [orate](https://it.wiktionary.org/w/index.php?title=orate&oldid=3985000), [orata](https://it.wiktionary.org/w/index.php?title=orata&oldid=4049894) |
| 497906 | `legioni` | noun | 0 | plurale di legione | `legione` | [legioni](https://it.wiktionary.org/w/index.php?title=legioni&oldid=4045407), [legione](https://it.wiktionary.org/w/index.php?title=legione&oldid=4063788) |
| 504208 | `celebratori` | noun | 0 | plurale di celebratore | `celebratore` | [celebratori](https://it.wiktionary.org/w/index.php?title=celebratori&oldid=3706693), [celebratore](https://it.wiktionary.org/w/index.php?title=celebratore&oldid=3935191) |
| 527971 | `dalmatica` | adj | 0 | femminile di dalmatico | `dalmatico` | [dalmatica](https://it.wiktionary.org/w/index.php?title=dalmatica&oldid=3636086), [dalmatico](https://it.wiktionary.org/w/index.php?title=dalmatico&oldid=3957584) |
| 527972 | `dalmatica` | noun | 0 | femminile di dalmatico | `dalmatico` | [dalmatica](https://it.wiktionary.org/w/index.php?title=dalmatica&oldid=3636086), [dalmatico](https://it.wiktionary.org/w/index.php?title=dalmatico&oldid=3957584) |
| 528242 | `saprei` | verb | 0 | prima persona singolare del condizionale presente di sapere | `sapere` | [saprei](https://it.wiktionary.org/w/index.php?title=saprei&oldid=4001793), [sapere](https://it.wiktionary.org/w/index.php?title=sapere&oldid=4066625) |
| 534049 | `concesse` | adj | 0 | femminile plurale di concesso | `concesso` | [concesse](https://it.wiktionary.org/w/index.php?title=concesse&oldid=3844838), [concesso](https://it.wiktionary.org/w/index.php?title=concesso&oldid=4060278) |
| 534590 | `rogatori` | noun | 0 | plurale di rogatore | `rogatore` | [rogatori](https://it.wiktionary.org/w/index.php?title=rogatori&oldid=4076124), [rogatore](https://it.wiktionary.org/w/index.php?title=rogatore&oldid=4076123) |
| 535698 | `rimpatriata` | adj | 0 | femminile di rimpatriato | `rimpatriato` | [rimpatriata](https://it.wiktionary.org/w/index.php?title=rimpatriata&oldid=4066870), [rimpatriato](https://it.wiktionary.org/w/index.php?title=rimpatriato&oldid=3837337) |
| 537829 | `Amnioti` | noun | 0 | plurale di amniote | `amniote` | [Amnioti](https://it.wiktionary.org/w/index.php?title=Amnioti&oldid=3628258), [amniote](https://it.wiktionary.org/w/index.php?title=amniote&oldid=4007975) |
| 537830 | `amnioti` | noun | 0 | plurale di amniote | `amniote` | [amnioti](https://it.wiktionary.org/w/index.php?title=amnioti&oldid=3628260), [amniote](https://it.wiktionary.org/w/index.php?title=amniote&oldid=4007975) |
| 538028 | `capisce` | verb | 0 | terza persona singolare dell'indicativo presente di capire | `capire` | [capisce](https://it.wiktionary.org/w/index.php?title=capisce&oldid=3964431), [capire](https://it.wiktionary.org/w/index.php?title=capire&oldid=4043205) |
| 538251 | `vostre` | adj | 0 | femminile plurale di vostro | `vostro` | [vostre](https://it.wiktionary.org/w/index.php?title=vostre&oldid=4034886), [vostro](https://it.wiktionary.org/w/index.php?title=vostro&oldid=3901575) |
| 538252 | `vostre` | pron | 0 | femminile plurale di vostro | `vostro` | [vostre](https://it.wiktionary.org/w/index.php?title=vostre&oldid=4034886), [vostro](https://it.wiktionary.org/w/index.php?title=vostro&oldid=3901575) |
| 538552 | `vostra` | adj | 0 | femminile singolare di vostro | `vostro` | [vostra](https://it.wiktionary.org/w/index.php?title=vostra&oldid=3908064), [vostro](https://it.wiktionary.org/w/index.php?title=vostro&oldid=3901575) |
| 538553 | `vostra` | pron | 0 | femminile singolare di vostro | `vostro` | [vostra](https://it.wiktionary.org/w/index.php?title=vostra&oldid=3908064), [vostro](https://it.wiktionary.org/w/index.php?title=vostro&oldid=3901575) |
| 538558 | `vostri` | adj | 0 | maschile plurale di vostro | `vostro` | [vostri](https://it.wiktionary.org/w/index.php?title=vostri&oldid=3908065), [vostro](https://it.wiktionary.org/w/index.php?title=vostro&oldid=3901575) |
| 538559 | `vostri` | pron | 0 | maschile plurale di vostro | `vostro` | [vostri](https://it.wiktionary.org/w/index.php?title=vostri&oldid=3908065), [vostro](https://it.wiktionary.org/w/index.php?title=vostro&oldid=3901575) |
| 539099 | `servali` | noun | 0 | plurale di servalo | `servalo` | [servali](https://it.wiktionary.org/w/index.php?title=servali&oldid=3661167), [servalo](https://it.wiktionary.org/w/index.php?title=servalo&oldid=3938023) |
| 540780 | `amebe` | noun | 0 | plurale di ameba | `ameba` | [amebe](https://it.wiktionary.org/w/index.php?title=amebe&oldid=3658383), [ameba](https://it.wiktionary.org/w/index.php?title=ameba&oldid=4070405) |
| 540864 | `privative` | noun | 0 | plurale di privativa | `privativa` | [privative](https://it.wiktionary.org/w/index.php?title=privative&oldid=3658810), [privativa](https://it.wiktionary.org/w/index.php?title=privativa&oldid=3904949) |
| 541042 | `burocratismi` | noun | 0 | plurale di burocratismo | `burocratismo` | [burocratismi](https://it.wiktionary.org/w/index.php?title=burocratismi&oldid=3660714), [burocratismo](https://it.wiktionary.org/w/index.php?title=burocratismo&oldid=3904056) |
| 541133 | `acciughine` | noun | 0 | plurale di acciughina | `acciughina` | [acciughine](https://it.wiktionary.org/w/index.php?title=acciughine&oldid=4014840), [acciughina](https://it.wiktionary.org/w/index.php?title=acciughina&oldid=3899548) |
| 541143 | `formicaleoni` | noun | 0 | plurale di formicaleone | `formicaleone` | [formicaleoni](https://it.wiktionary.org/w/index.php?title=formicaleoni&oldid=3661863), [formicaleone](https://it.wiktionary.org/w/index.php?title=formicaleone&oldid=4006469) |
| 541146 | `macaoni` | noun | 0 | plurale di macaone | `macaone` | [macaoni](https://it.wiktionary.org/w/index.php?title=macaoni&oldid=3960893), [macaone](https://it.wiktionary.org/w/index.php?title=macaone&oldid=3786607) |
| 541171 | `anofeli` | noun | 0 | plurale di anofele | `anofele` | [anofeli](https://it.wiktionary.org/w/index.php?title=anofeli&oldid=3669129), [anofele](https://it.wiktionary.org/w/index.php?title=anofele&oldid=3661989) |
| 541192 | `forfecchie` | noun | 0 | plurale di forfecchia | `forfecchia` | [forfecchie](https://it.wiktionary.org/w/index.php?title=forfecchie&oldid=3795719), [forfecchia](https://it.wiktionary.org/w/index.php?title=forfecchia&oldid=3795718) |
| 541208 | `mugnaiacci` | noun | 0 | plurale di mugnaiaccio | `mugnaiaccio` | [mugnaiacci](https://it.wiktionary.org/w/index.php?title=mugnaiacci&oldid=3768893), [mugnaiaccio](https://it.wiktionary.org/w/index.php?title=mugnaiaccio&oldid=3908664) |
| 541594 | `fonopatie` | noun | 0 | plurale di fonopatia | `fonopatia` | [fonopatie](https://it.wiktionary.org/w/index.php?title=fonopatie&oldid=3662904), [fonopatia](https://it.wiktionary.org/w/index.php?title=fonopatia&oldid=3406144) |
| 543341 | `gassometrie` | noun | 0 | plurale di gassometria | `gassometria` | [gassometrie](https://it.wiktionary.org/w/index.php?title=gassometrie&oldid=3664935), [gassometria](https://it.wiktionary.org/w/index.php?title=gassometria&oldid=3660986) |
| 543438 | `riesci` | verb | 0 | seconda persona singolare dell'indicativo presente di riuscire | `riuscire` | [riesci](https://it.wiktionary.org/w/index.php?title=riesci&oldid=3972321), [riuscire](https://it.wiktionary.org/w/index.php?title=riuscire&oldid=3941454) |
| 544549 | `salsicce` | noun | 0 | plurale di salsiccia | `salsiccia` | [salsicce](https://it.wiktionary.org/w/index.php?title=salsicce&oldid=3669527), [salsiccia](https://it.wiktionary.org/w/index.php?title=salsiccia&oldid=3438984) |
| 544656 | `labronici` | adj | 0 | plurale di labronico | `labronico` | [labronici](https://it.wiktionary.org/w/index.php?title=labronici&oldid=3669955), [labronico](https://it.wiktionary.org/w/index.php?title=labronico&oldid=3868134) |
| 545062 | `bariatrici` | adj | 0 | plurale di bariatrico | `bariatrico` | [bariatrici](https://it.wiktionary.org/w/index.php?title=bariatrici&oldid=3671060), [bariatrico](https://it.wiktionary.org/w/index.php?title=bariatrico&oldid=3671058) |
| 545063 | `bariatriche` | adj | 0 | femminile plurale di bariatrico | `bariatrico` | [bariatriche](https://it.wiktionary.org/w/index.php?title=bariatriche&oldid=3671061), [bariatrico](https://it.wiktionary.org/w/index.php?title=bariatrico&oldid=3671058) |
| 545064 | `bariatrica` | adj | 0 | femminile di bariatrico | `bariatrico` | [bariatrica](https://it.wiktionary.org/w/index.php?title=bariatrica&oldid=3671062), [bariatrico](https://it.wiktionary.org/w/index.php?title=bariatrico&oldid=3671058) |
| 545081 | `quadrupedi` | adj | 0 | plurale di quadrupede | `quadrupede` | [quadrupedi](https://it.wiktionary.org/w/index.php?title=quadrupedi&oldid=3958463), [quadrupede](https://it.wiktionary.org/w/index.php?title=quadrupede&oldid=4013329) |
| 545082 | `quadrupedi` | noun | 0 | plurale di quadrupede | `quadrupede` | [quadrupedi](https://it.wiktionary.org/w/index.php?title=quadrupedi&oldid=3958463), [quadrupede](https://it.wiktionary.org/w/index.php?title=quadrupede&oldid=4013329) |
| 545105 | `eporediesi` | noun | 0 | plurale di eporediese | `eporediese` | [eporediesi](https://it.wiktionary.org/w/index.php?title=eporediesi&oldid=3671417), [eporediese](https://it.wiktionary.org/w/index.php?title=eporediese&oldid=3671416) |
| 545152 | `ingannatori` | noun | 0 | plurale di ingannatore | `ingannatore` | [ingannatori](https://it.wiktionary.org/w/index.php?title=ingannatori&oldid=3864799), [ingannatore](https://it.wiktionary.org/w/index.php?title=ingannatore&oldid=3906448) |
| 545154 | `ingannatrice` | noun | 0 | femminile di ingannatore | `ingannatore` | [ingannatrice](https://it.wiktionary.org/w/index.php?title=ingannatrice&oldid=3720830), [ingannatore](https://it.wiktionary.org/w/index.php?title=ingannatore&oldid=3906448) |
| 545156 | `ingannatrici` | noun | 0 | plurale di ingannatore | `ingannatore` | [ingannatrici](https://it.wiktionary.org/w/index.php?title=ingannatrici&oldid=3675071), [ingannatore](https://it.wiktionary.org/w/index.php?title=ingannatore&oldid=3906448) |
| 545171 | `tirsi` | noun | 0 | plurale di tirso | `tirso` | [tirsi](https://it.wiktionary.org/w/index.php?title=tirsi&oldid=3671663), [tirso](https://it.wiktionary.org/w/index.php?title=tirso&oldid=3985041) |
| 545172 | `tirinzia` | adj | 0 | femminile di tirinzio | `tirinzio` | [tirinzia](https://it.wiktionary.org/w/index.php?title=tirinzia&oldid=3671664), [tirinzio](https://it.wiktionary.org/w/index.php?title=tirinzio&oldid=3794542) |
| 545173 | `tirinzi` | adj | 0 | femminile di tirinzio | `tirinzio` | [tirinzi](https://it.wiktionary.org/w/index.php?title=tirinzi&oldid=3671665), [tirinzio](https://it.wiktionary.org/w/index.php?title=tirinzio&oldid=3794542) |
| 545174 | `tirinzie` | adj | 0 | plurale di tirinzio | `tirinzio` | [tirinzie](https://it.wiktionary.org/w/index.php?title=tirinzie&oldid=3671666), [tirinzio](https://it.wiktionary.org/w/index.php?title=tirinzio&oldid=3794542) |
| 545184 | `morigerate` | adj | 0 | femminile plurale di morigerato | `morigerato` | [morigerate](https://it.wiktionary.org/w/index.php?title=morigerate&oldid=3671693), [morigerato](https://it.wiktionary.org/w/index.php?title=morigerato&oldid=4041413) |
| 545198 | `autoguide` | noun | 0 | plurale di autoguida | `autoguida` | [autoguide](https://it.wiktionary.org/w/index.php?title=autoguide&oldid=3671805), [autoguida](https://it.wiktionary.org/w/index.php?title=autoguida&oldid=3909581) |
| 545235 | `romanziera` | noun | 0 | femminile di romanziere | `romanziere` | [romanziera](https://it.wiktionary.org/w/index.php?title=romanziera&oldid=3803845), [romanziere](https://it.wiktionary.org/w/index.php?title=romanziere&oldid=3937116) |
| 545279 | `bottegai` | noun | 0 | plurale di bottegaio | `bottegaio` | [bottegai](https://it.wiktionary.org/w/index.php?title=bottegai&oldid=3909597), [bottegaio](https://it.wiktionary.org/w/index.php?title=bottegaio&oldid=4053611) |
| 545281 | `bottegaie` | noun | 0 | plurale femminile di bottegaio | `bottegaio` | [bottegaie](https://it.wiktionary.org/w/index.php?title=bottegaie&oldid=4047178), [bottegaio](https://it.wiktionary.org/w/index.php?title=bottegaio&oldid=4053611) |
| 545297 | `denigratoria` | adj | 0 | femminile di denigratorio | `denigratorio` | [denigratoria](https://it.wiktionary.org/w/index.php?title=denigratoria&oldid=3909601), [denigratorio](https://it.wiktionary.org/w/index.php?title=denigratorio&oldid=3898031) |
| 546166 | `riottenuto` | verb | 0 | participio passato di riottenere | `riottenere` | [riottenuto](https://it.wiktionary.org/w/index.php?title=riottenuto&oldid=3817697), [riottenere](https://it.wiktionary.org/w/index.php?title=riottenere&oldid=3849960) |
| 546829 | `naiadi` | noun | 0 | plurale di naiade | `naiade` | [naiadi](https://it.wiktionary.org/w/index.php?title=naiadi&oldid=3720019), [naiade](https://it.wiktionary.org/w/index.php?title=naiade&oldid=4077303) |
| 546832 | `prospettive` | noun | 0 | plurale di prospettiva | `prospettiva` | [prospettive](https://it.wiktionary.org/w/index.php?title=prospettive&oldid=3675361), [prospettiva](https://it.wiktionary.org/w/index.php?title=prospettiva&oldid=3976709) |
| 547317 | `frenature` | noun | 0 | plurale di frenatura | `frenatura` | [frenature](https://it.wiktionary.org/w/index.php?title=frenature&oldid=3676136), [frenatura](https://it.wiktionary.org/w/index.php?title=frenatura&oldid=3678347) |
| 547324 | `sepolti` | adj | 0 | plurale di sepolto | `sepolto` | [sepolti](https://it.wiktionary.org/w/index.php?title=sepolti&oldid=3879025), [sepolto](https://it.wiktionary.org/w/index.php?title=sepolto&oldid=3791789) |
| 547325 | `sepolti` | noun | 0 | plurale di sepolto | `sepolto` | [sepolti](https://it.wiktionary.org/w/index.php?title=sepolti&oldid=3879025), [sepolto](https://it.wiktionary.org/w/index.php?title=sepolto&oldid=3791789) |
| 547372 | `livree` | noun | 0 | plurale di livrea | `livrea` | [livree](https://it.wiktionary.org/w/index.php?title=livree&oldid=3833610), [livrea](https://it.wiktionary.org/w/index.php?title=livrea&oldid=3962224) |
| 547378 | `pontificali` | adj | 0 | plurale di pontificale | `pontificale` | [pontificali](https://it.wiktionary.org/w/index.php?title=pontificali&oldid=3676492), [pontificale](https://it.wiktionary.org/w/index.php?title=pontificale&oldid=4026288) |
| 547379 | `pontificali` | noun | 0 | plurale di pontificale | `pontificale` | [pontificali](https://it.wiktionary.org/w/index.php?title=pontificali&oldid=3676492), [pontificale](https://it.wiktionary.org/w/index.php?title=pontificale&oldid=4026288) |
| 547390 | `soddisfatta` | adj | 0 | femminile di soddisfatto | `soddisfatto` | [soddisfatta](https://it.wiktionary.org/w/index.php?title=soddisfatta&oldid=3910631), [soddisfatto](https://it.wiktionary.org/w/index.php?title=soddisfatto&oldid=4055409) |
| 547406 | `stami` | noun | 0 | plurale di stame | `stame` | [stami](https://it.wiktionary.org/w/index.php?title=stami&oldid=3676660), [stame](https://it.wiktionary.org/w/index.php?title=stame&oldid=3931674) |
| 547543 | `facevano` | verb | 0 | terza persona plurale dell'indicativo imperfetto di fare | `fare` | [facevano](https://it.wiktionary.org/w/index.php?title=facevano&oldid=3677490), [fare](https://it.wiktionary.org/w/index.php?title=fare&oldid=4066784) |
| 548531 | `scucita` | adj | 0 | femminile di scucito | `scucito` | [scucita](https://it.wiktionary.org/w/index.php?title=scucita&oldid=3684544), [scucito](https://it.wiktionary.org/w/index.php?title=scucito&oldid=3910665) |
| 548533 | `scuciti` | adj | 0 | plurale di scucito | `scucito` | [scuciti](https://it.wiktionary.org/w/index.php?title=scuciti&oldid=3684546), [scucito](https://it.wiktionary.org/w/index.php?title=scucito&oldid=3910665) |
| 548535 | `scucite` | adj | 0 | plurale di scucito | `scucito` | [scucite](https://it.wiktionary.org/w/index.php?title=scucite&oldid=4049293), [scucito](https://it.wiktionary.org/w/index.php?title=scucito&oldid=3910665) |
| 548709 | `urbisagliesi` | adj | 0 | plurale di urbisagliese | `urbisagliese` | [urbisagliesi](https://it.wiktionary.org/w/index.php?title=urbisagliesi&oldid=3822587), [urbisagliese](https://it.wiktionary.org/w/index.php?title=urbisagliese&oldid=3681827) |
| 548722 | `insidie` | noun | 0 | plurale di insidia | `insidia` | [insidie](https://it.wiktionary.org/w/index.php?title=insidie&oldid=3681949), [insidia](https://it.wiktionary.org/w/index.php?title=insidia&oldid=4004264) |
| 548732 | `astrofisici` | adj | 0 | plurale di astrofisico | `astrofisico` | [astrofisici](https://it.wiktionary.org/w/index.php?title=astrofisici&oldid=3934791), [astrofisico](https://it.wiktionary.org/w/index.php?title=astrofisico&oldid=3933465) |
| 548733 | `astrofisici` | noun | 0 | plurale di astrofisico | `astrofisico` | [astrofisici](https://it.wiktionary.org/w/index.php?title=astrofisici&oldid=3934791), [astrofisico](https://it.wiktionary.org/w/index.php?title=astrofisico&oldid=3933465) |
| 548734 | `astrofisiche` | adj | 0 | plurale di astrofisico | `astrofisico` | [astrofisiche](https://it.wiktionary.org/w/index.php?title=astrofisiche&oldid=3682035), [astrofisico](https://it.wiktionary.org/w/index.php?title=astrofisico&oldid=3933465) |
| 548761 | `stravaganti` | noun | 0 | plurale di stravagante | `stravagante` | [stravaganti](https://it.wiktionary.org/w/index.php?title=stravaganti&oldid=3921111), [stravagante](https://it.wiktionary.org/w/index.php?title=stravagante&oldid=4014399) |
| 549098 | `risalgono` | verb | 0 | terza persona plurale dell'indicativo presente di risalire | `risalire` | [risalgono](https://it.wiktionary.org/w/index.php?title=risalgono&oldid=4248471), [risalire](https://it.wiktionary.org/w/index.php?title=risalire&oldid=3940544) |
| 549226 | `accessi` | noun | 0 | plurale di accesso | `accesso` | [accessi](https://it.wiktionary.org/w/index.php?title=accessi&oldid=3910748), [accesso](https://it.wiktionary.org/w/index.php?title=accesso&oldid=4049698) |
| 550014 | `pornografica` | adj | 0 | femminile singolare di pornografico | `pornografico` | [pornografica](https://it.wiktionary.org/w/index.php?title=pornografica&oldid=3911038), [pornografico](https://it.wiktionary.org/w/index.php?title=pornografico&oldid=3994035) |
| 550016 | `scabrosa` | adj | 0 | femminile singolare di scabroso | `scabroso` | [scabrosa](https://it.wiktionary.org/w/index.php?title=scabrosa&oldid=3935938), [scabroso](https://it.wiktionary.org/w/index.php?title=scabroso&oldid=3869509) |
| 550064 | `vocali` | adj | 0 | plurale di vocale | `vocale` | [vocali](https://it.wiktionary.org/w/index.php?title=vocali&oldid=3687475), [vocale](https://it.wiktionary.org/w/index.php?title=vocale&oldid=4005776) |
| 551282 | `romanesca` | adj | 0 | femminile di romanesco | `romanesco` | [romanesca](https://it.wiktionary.org/w/index.php?title=romanesca&oldid=3783078), [romanesco](https://it.wiktionary.org/w/index.php?title=romanesco&oldid=4065564) |
| 551365 | `raccoglitrice` | noun | 0 | femminile di raccoglitore | `raccoglitore` | [raccoglitrice](https://it.wiktionary.org/w/index.php?title=raccoglitrice&oldid=3693382), [raccoglitore](https://it.wiktionary.org/w/index.php?title=raccoglitore&oldid=4035767) |
| 551370 | `sassate` | noun | 0 | plurale di sassata | `sassata` | [sassate](https://it.wiktionary.org/w/index.php?title=sassate&oldid=3693442), [sassata](https://it.wiktionary.org/w/index.php?title=sassata&oldid=3553554) |
| 552872 | `crematistica` | adj | 0 | femminile singolare di crematistico | `crematistico` | [crematistica](https://it.wiktionary.org/w/index.php?title=crematistica&oldid=3697628), [crematistico](https://it.wiktionary.org/w/index.php?title=crematistico&oldid=3706737) |
| 552927 | `naumachie` | noun | 0 | plurale di naumachia | `naumachia` | [naumachie](https://it.wiktionary.org/w/index.php?title=naumachie&oldid=3698046), [naumachia](https://it.wiktionary.org/w/index.php?title=naumachia&oldid=4034058) |
| 552970 | `visitatrice` | noun | 0 | femminile di visitatore | `visitatore` | [visitatrice](https://it.wiktionary.org/w/index.php?title=visitatrice&oldid=3911705), [visitatore](https://it.wiktionary.org/w/index.php?title=visitatore&oldid=3981906) |
| 560503 | `vana` | adj | 0 | femminile di vano | `vano` | [vana](https://it.wiktionary.org/w/index.php?title=vana&oldid=3720745), [vano](https://it.wiktionary.org/w/index.php?title=vano&oldid=4050242) |
| 560504 | `vane` | adj | 0 | femminile plurale di vano | `vano` | [vane](https://it.wiktionary.org/w/index.php?title=vane&oldid=3720746), [vano](https://it.wiktionary.org/w/index.php?title=vano&oldid=4050242) |
| 560509 | `pianistica` | adj | 0 | femminile di pianistico | `pianistico` | [pianistica](https://it.wiktionary.org/w/index.php?title=pianistica&oldid=3720089), [pianistico](https://it.wiktionary.org/w/index.php?title=pianistico&oldid=4245930) |
| 560510 | `pianistici` | adj | 0 | plurale di pianistico | `pianistico` | [pianistici](https://it.wiktionary.org/w/index.php?title=pianistici&oldid=3720091), [pianistico](https://it.wiktionary.org/w/index.php?title=pianistico&oldid=4245930) |
| 560511 | `pianistiche` | adj | 0 | femminile plurale di pianistico | `pianistico` | [pianistiche](https://it.wiktionary.org/w/index.php?title=pianistiche&oldid=3720090), [pianistico](https://it.wiktionary.org/w/index.php?title=pianistico&oldid=4245930) |
| 561954 | `girovaghe` | noun | 0 | femminile plurale di girovago | `girovago` | [girovaghe](https://it.wiktionary.org/w/index.php?title=girovaghe&oldid=3720833), [girovago](https://it.wiktionary.org/w/index.php?title=girovago&oldid=3900653) |
| 561960 | `piccine` | adj | 0 | plurale femminile di piccino | `piccino` | [piccine](https://it.wiktionary.org/w/index.php?title=piccine&oldid=3913150), [piccino](https://it.wiktionary.org/w/index.php?title=piccino&oldid=4075931) |
| 561961 | `piccine` | noun | 0 | plurale femminile di piccino | `piccino` | [piccine](https://it.wiktionary.org/w/index.php?title=piccine&oldid=3913150), [piccino](https://it.wiktionary.org/w/index.php?title=piccino&oldid=4075931) |
| 561965 | `censori` | noun | 0 | plurale di censore | `censore` | [censori](https://it.wiktionary.org/w/index.php?title=censori&oldid=3968086), [censore](https://it.wiktionary.org/w/index.php?title=censore&oldid=3968088) |
| 564295 | `selvatica` | adj | 0 | femminile di selvatico | `selvatico` | [selvatica](https://it.wiktionary.org/w/index.php?title=selvatica&oldid=3724421), [selvatico](https://it.wiktionary.org/w/index.php?title=selvatico&oldid=3962088) |
| 564296 | `selvatica` | noun | 0 | femminile di selvatico | `selvatico` | [selvatica](https://it.wiktionary.org/w/index.php?title=selvatica&oldid=3724421), [selvatico](https://it.wiktionary.org/w/index.php?title=selvatico&oldid=3962088) |
| 565047 | `frigi` | adj | 0 | plurale di frigio | `frigio` | [frigi](https://it.wiktionary.org/w/index.php?title=frigi&oldid=3914154), [frigio](https://it.wiktionary.org/w/index.php?title=frigio&oldid=3985047) |
| 565048 | `frigi` | noun | 0 | plurale di frigio | `frigio` | [frigi](https://it.wiktionary.org/w/index.php?title=frigi&oldid=3914154), [frigio](https://it.wiktionary.org/w/index.php?title=frigio&oldid=3985047) |
| 566866 | `soddisfatte` | adj | 0 | femminile plurale di soddisfatto | `soddisfatto` | [soddisfatte](https://it.wiktionary.org/w/index.php?title=soddisfatte&oldid=3914996), [soddisfatto](https://it.wiktionary.org/w/index.php?title=soddisfatto&oldid=4055409) |
| 568465 | `mentitori` | noun | 0 | plurale di mentitore | `mentitore` | [mentitori](https://it.wiktionary.org/w/index.php?title=mentitori&oldid=3732206), [mentitore](https://it.wiktionary.org/w/index.php?title=mentitore&oldid=3984984) |
| 569852 | `confidenze` | noun | 0 | plurale di confidenza | `confidenza` | [confidenze](https://it.wiktionary.org/w/index.php?title=confidenze&oldid=3734813), [confidenza](https://it.wiktionary.org/w/index.php?title=confidenza&oldid=4041294) |
| 569991 | `consentiti` | adj | 0 | plurale di consentito | `consentito` | [consentiti](https://it.wiktionary.org/w/index.php?title=consentiti&oldid=3840511), [consentito](https://it.wiktionary.org/w/index.php?title=consentito&oldid=3982731) |
| 570042 | `pandemie` | noun | 0 | plurale di pandemia | `pandemia` | [pandemie](https://it.wiktionary.org/w/index.php?title=pandemie&oldid=3736511), [pandemia](https://it.wiktionary.org/w/index.php?title=pandemia&oldid=3811254) |
| 571660 | `brecce` | noun | 0 | plurale di breccia | `breccia` | [brecce](https://it.wiktionary.org/w/index.php?title=brecce&oldid=3738931), [breccia](https://it.wiktionary.org/w/index.php?title=breccia&oldid=4027331) |
| 571749 | `valdostane` | noun | 0 | plurale di valdostana | `valdostana` | [valdostane](https://it.wiktionary.org/w/index.php?title=valdostane&oldid=3869033), [valdostana](https://it.wiktionary.org/w/index.php?title=valdostana&oldid=3869032) |
| 571887 | `fessa` | noun | 0 | femminile singolare di fesso | `fesso` | [fessa](https://it.wiktionary.org/w/index.php?title=fessa&oldid=3938535), [fesso](https://it.wiktionary.org/w/index.php?title=fesso&oldid=3978033) |
| 571892 | `fessi` | noun | 0 | maschile plurale di fesso | `fesso` | [fessi](https://it.wiktionary.org/w/index.php?title=fessi&oldid=3915873), [fesso](https://it.wiktionary.org/w/index.php?title=fesso&oldid=3978033) |
| 573802 | `tare` | noun | 0 | plurale di tara | `tara` | [tare](https://it.wiktionary.org/w/index.php?title=tare&oldid=3837897), [tara](https://it.wiktionary.org/w/index.php?title=tara&oldid=4009594) |
| 573808 | `peponidi` | noun | 0 | plurale di peponide | `peponide` | [peponidi](https://it.wiktionary.org/w/index.php?title=peponidi&oldid=3744959), [peponide](https://it.wiktionary.org/w/index.php?title=peponide&oldid=3744958) |
| 576040 | `conserve` | noun | 0 | plurale di conserva | `conserva` | [conserve](https://it.wiktionary.org/w/index.php?title=conserve&oldid=3748278), [conserva](https://it.wiktionary.org/w/index.php?title=conserva&oldid=4037392) |
| 576980 | `tessalonicesi` | noun | 0 | plurale di tessalonicese | `tessalonicese` | [tessalonicesi](https://it.wiktionary.org/w/index.php?title=tessalonicesi&oldid=3750113), [tessalonicese](https://it.wiktionary.org/w/index.php?title=tessalonicese&oldid=3911903) |
| 576984 | `Impenni` | noun | 0 | plurale di impenne | `impenne` | [Impenni](https://it.wiktionary.org/w/index.php?title=Impenni&oldid=3750183), [impenne](https://it.wiktionary.org/w/index.php?title=impenne&oldid=3751412) |
| 577008 | `colombi` | noun | 0 | plurale di colombo | `colombo` | [colombi](https://it.wiktionary.org/w/index.php?title=colombi&oldid=3928915), [colombo](https://it.wiktionary.org/w/index.php?title=colombo&oldid=3928916) |
| 577070 | `parresie` | noun | 0 | plurale di parresia | `parresia` | [parresie](https://it.wiktionary.org/w/index.php?title=parresie&oldid=3750750), [parresia](https://it.wiktionary.org/w/index.php?title=parresia&oldid=4068654) |
| 577080 | `legacci` | noun | 0 | plurale di legaccio | `legaccio` | [legacci](https://it.wiktionary.org/w/index.php?title=legacci&oldid=3751004), [legaccio](https://it.wiktionary.org/w/index.php?title=legaccio&oldid=3975326) |
| 577158 | `seriemi` | noun | 0 | plurale di seriema | `seriema` | [seriemi](https://it.wiktionary.org/w/index.php?title=seriemi&oldid=3838797), [seriema](https://it.wiktionary.org/w/index.php?title=seriema&oldid=3769204) |
| 577604 | `omotermi` | adj | 0 | plurale di omotermo | `omotermo` | [omotermi](https://it.wiktionary.org/w/index.php?title=omotermi&oldid=3754201), [omotermo](https://it.wiktionary.org/w/index.php?title=omotermo&oldid=3662449) |
| 578493 | `preconcetti` | noun | 0 | plurale di preconcetto | `preconcetto` | [preconcetti](https://it.wiktionary.org/w/index.php?title=preconcetti&oldid=3963058), [preconcetto](https://it.wiktionary.org/w/index.php?title=preconcetto&oldid=3966173) |
| 578494 | `proponimenti` | noun | 0 | plurale di proponimento | `proponimento` | [proponimenti](https://it.wiktionary.org/w/index.php?title=proponimenti&oldid=3763713), [proponimento](https://it.wiktionary.org/w/index.php?title=proponimento&oldid=4051239) |
| 578511 | `balestrucci` | noun | 0 | plurale di balestruccio | `balestruccio` | [balestrucci](https://it.wiktionary.org/w/index.php?title=balestrucci&oldid=3763965), [balestruccio](https://it.wiktionary.org/w/index.php?title=balestruccio&oldid=3917724) |
| 579137 | `dettami` | noun | 0 | plurale di dettame | `dettame` | [dettami](https://it.wiktionary.org/w/index.php?title=dettami&oldid=3765203), [dettame](https://it.wiktionary.org/w/index.php?title=dettame&oldid=3765201) |
| 579179 | `fontanili` | noun | 0 | plurale di fontanile | `fontanile` | [fontanili](https://it.wiktionary.org/w/index.php?title=fontanili&oldid=3765517), [fontanile](https://it.wiktionary.org/w/index.php?title=fontanile&oldid=4011475) |
| 579233 | `morisse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di morire | `morire` | [morisse](https://it.wiktionary.org/w/index.php?title=morisse&oldid=3975129), [morire](https://it.wiktionary.org/w/index.php?title=morire&oldid=4042614) |
| 579258 | `roventi` | adj | 0 | plurale di rovente | `rovente` | [roventi](https://it.wiktionary.org/w/index.php?title=roventi&oldid=3769147), [rovente](https://it.wiktionary.org/w/index.php?title=rovente&oldid=3984394) |
| 579322 | `proroghe` | noun | 0 | plurale di proroga | `proroga` | [proroghe](https://it.wiktionary.org/w/index.php?title=proroghe&oldid=3766813), [proroga](https://it.wiktionary.org/w/index.php?title=proroga&oldid=3971199) |
| 579356 | `scoprite` | verb | 0 | seconda persona plurale dell'indicativo presente di scoprire | `scoprire` | [scoprite](https://it.wiktionary.org/w/index.php?title=scoprite&oldid=3880880), [scoprire](https://it.wiktionary.org/w/index.php?title=scoprire&oldid=4059950) |
| 579356 | `scoprite` | verb | 1 | seconda persona plurale dell'imperativo presente di scoprire | `scoprire` | [scoprite](https://it.wiktionary.org/w/index.php?title=scoprite&oldid=3880880), [scoprire](https://it.wiktionary.org/w/index.php?title=scoprire&oldid=4059950) |
| 579438 | `saprà` | verb | 0 | terza persona singolare dell'indicativo futuro semplice di sapere | `sapere` | [saprà](https://it.wiktionary.org/w/index.php?title=sapr%C3%A0&oldid=3767992), [sapere](https://it.wiktionary.org/w/index.php?title=sapere&oldid=4066625) |
| 579487 | `nociuto` | verb | 0 | participio passato di nuocere | `nuocere` | [nociuto](https://it.wiktionary.org/w/index.php?title=nociuto&oldid=3917803), [nuocere](https://it.wiktionary.org/w/index.php?title=nuocere&oldid=4059238) |
| 579523 | `arabesche` | adj | 0 | femminile plurale di arabesco | `arabesco` | [arabesche](https://it.wiktionary.org/w/index.php?title=arabesche&oldid=4152082), [arabesco](https://it.wiktionary.org/w/index.php?title=arabesco&oldid=4014704) |
| 579525 | `gineconomi` | noun | 0 | maschile plurale di gineconomo | `gineconomo` | [gineconomi](https://it.wiktionary.org/w/index.php?title=gineconomi&oldid=3790364), [gineconomo](https://it.wiktionary.org/w/index.php?title=gineconomo&oldid=3790365) |
| 579535 | `ardiglioni` | noun | 0 | maschile plurale di ardiglione | `ardiglione` | [ardiglioni](https://it.wiktionary.org/w/index.php?title=ardiglioni&oldid=3789421), [ardiglione](https://it.wiktionary.org/w/index.php?title=ardiglione&oldid=3789420) |
| 579541 | `scopriamo` | verb | 1 | prima persona plurale del congiuntivo presente di scoprire | `scoprire` | [scopriamo](https://it.wiktionary.org/w/index.php?title=scopriamo&oldid=4001434), [scoprire](https://it.wiktionary.org/w/index.php?title=scoprire&oldid=4059950) |
| 579541 | `scopriamo` | verb | 2 | prima persona plurale dell'imperativo presente di scoprire | `scoprire` | [scopriamo](https://it.wiktionary.org/w/index.php?title=scopriamo&oldid=4001434), [scoprire](https://it.wiktionary.org/w/index.php?title=scoprire&oldid=4059950) |
| 579580 | `vistò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di vistare | `vistare` | [vistò](https://it.wiktionary.org/w/index.php?title=vist%C3%B2&oldid=3792319), [vistare](https://it.wiktionary.org/w/index.php?title=vistare&oldid=3776379) |
| 579590 | `provenienze` | noun | 0 | plurale di provenienza | `provenienza` | [provenienze](https://it.wiktionary.org/w/index.php?title=provenienze&oldid=3770594), [provenienza](https://it.wiktionary.org/w/index.php?title=provenienza&oldid=3894797) |
| 579693 | `vedete` | verb | 0 | seconda persona plurale dell'indicativo presente di vedere | `vedere` | [vedete](https://it.wiktionary.org/w/index.php?title=vedete&oldid=4013021), [vedere](https://it.wiktionary.org/w/index.php?title=vedere&oldid=4042937) |
| 579693 | `vedete` | verb | 1 | seconda persona plurale dell'imperativo presente di vedere | `vedere` | [vedete](https://it.wiktionary.org/w/index.php?title=vedete&oldid=4013021), [vedere](https://it.wiktionary.org/w/index.php?title=vedere&oldid=4042937) |
| 581574 | `volesse` | verb | 0 | terza persona singolare del congiuntivo imperfetto di volere | `volere` | [volesse](https://it.wiktionary.org/w/index.php?title=volesse&oldid=3792328), [volere](https://it.wiktionary.org/w/index.php?title=volere&oldid=3994228) |
| 581575 | `potranno` | verb | 0 | terza persona plurale dell'indicativo futuro semplice di potere | `potere` | [potranno](https://it.wiktionary.org/w/index.php?title=potranno&oldid=3847034), [potere](https://it.wiktionary.org/w/index.php?title=potere&oldid=4011699) |
| 581576 | `dovessero` | verb | 0 | terza persona plurale del congiuntivo imperfetto di dovere | `dovere` | [dovessero](https://it.wiktionary.org/w/index.php?title=dovessero&oldid=3790083), [dovere](https://it.wiktionary.org/w/index.php?title=dovere&oldid=3987633) |
| 581907 | `logorò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di logorare | `logorare` | [logorò](https://it.wiktionary.org/w/index.php?title=logor%C3%B2&oldid=4048254), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 581993 | `soppresse` | adj | 0 | femminile plurale di soppresso | `soppresso` | [soppresse](https://it.wiktionary.org/w/index.php?title=soppresse&oldid=3853365), [soppresso](https://it.wiktionary.org/w/index.php?title=soppresso&oldid=3971823) |
| 582539 | `trasandati` | adj | 0 | plurale di trasandato | `trasandato` | [trasandati](https://it.wiktionary.org/w/index.php?title=trasandati&oldid=3821672), [trasandato](https://it.wiktionary.org/w/index.php?title=trasandato&oldid=3926288) |
| 582753 | `aranciate` | noun | 0 | plurale di aranciata | `aranciata` | [aranciate](https://it.wiktionary.org/w/index.php?title=aranciate&oldid=3779480), [aranciata](https://it.wiktionary.org/w/index.php?title=aranciata&oldid=3890256) |
| 582783 | `logorate` | verb | 0 | participio passato plurale femminile di logorare | `logorare` | [logorate](https://it.wiktionary.org/w/index.php?title=logorate&oldid=3790749), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 582783 | `logorate` | verb | 1 | seconda persona plurale dell'indicativo presente di logorare | `logorare` | [logorate](https://it.wiktionary.org/w/index.php?title=logorate&oldid=3790749), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 582783 | `logorate` | verb | 2 | seconda persona plurale dell'imperativo presente di logorare | `logorare` | [logorate](https://it.wiktionary.org/w/index.php?title=logorate&oldid=3790749), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 582787 | `insufficienze` | noun | 0 | plurale di insufficienza | `insufficienza` | [insufficienze](https://it.wiktionary.org/w/index.php?title=insufficienze&oldid=3779960), [insufficienza](https://it.wiktionary.org/w/index.php?title=insufficienza&oldid=4050541) |
| 582803 | `piace` | verb | 0 | terza persona singolare dell'indicativo presente di piacere | `piacere` | [piace](https://it.wiktionary.org/w/index.php?title=piace&oldid=3850874), [piacere](https://it.wiktionary.org/w/index.php?title=piacere&oldid=3981533) |
| 582870 | `ascetica` | noun | 0 | femminile di ascetico | `ascetico` | [ascetica](https://it.wiktionary.org/w/index.php?title=ascetica&oldid=3789446), [ascetico](https://it.wiktionary.org/w/index.php?title=ascetico&oldid=3903218) |
| 582959 | `locande` | noun | 0 | plurale di locanda | `locanda` | [locande](https://it.wiktionary.org/w/index.php?title=locande&oldid=3849663), [locanda](https://it.wiktionary.org/w/index.php?title=locanda&oldid=4045729) |
| 582960 | `balere` | noun | 0 | plurale di balera | `balera` | [balere](https://it.wiktionary.org/w/index.php?title=balere&oldid=3835152), [balera](https://it.wiktionary.org/w/index.php?title=balera&oldid=3980771) |
| 583025 | `consentono` | verb | 0 | terza persona plurale dell'indicativo presente di consentire | `consentire` | [consentono](https://it.wiktionary.org/w/index.php?title=consentono&oldid=3789820), [consentire](https://it.wiktionary.org/w/index.php?title=consentire&oldid=3995551) |
| 583033 | `motovedette` | noun | 0 | plurale di motovedetta | `motovedetta` | [motovedette](https://it.wiktionary.org/w/index.php?title=motovedette&oldid=3804131), [motovedetta](https://it.wiktionary.org/w/index.php?title=motovedetta&oldid=3781605) |
| 583044 | `annessa` | adj | 0 | femminile di annesso | `annesso` | [annessa](https://it.wiktionary.org/w/index.php?title=annessa&oldid=3844373), [annesso](https://it.wiktionary.org/w/index.php?title=annesso&oldid=3972696) |
| 583176 | `ragguardevoli` | adj | 0 | plurale di ragguardevole | `ragguardevole` | [ragguardevoli](https://it.wiktionary.org/w/index.php?title=ragguardevoli&oldid=3877276), [ragguardevole](https://it.wiktionary.org/w/index.php?title=ragguardevole&oldid=4004425) |
| 583184 | `nutritivi` | adj | 0 | plurale di nutritivo | `nutritivo` | [nutritivi](https://it.wiktionary.org/w/index.php?title=nutritivi&oldid=3782415), [nutritivo](https://it.wiktionary.org/w/index.php?title=nutritivo&oldid=4059234) |
| 583186 | `nutritive` | adj | 0 | femminile plurale di nutritivo | `nutritivo` | [nutritive](https://it.wiktionary.org/w/index.php?title=nutritive&oldid=3782417), [nutritivo](https://it.wiktionary.org/w/index.php?title=nutritivo&oldid=4059234) |
| 583231 | `diamo` | verb | 0 | prima persona plurale dell'indicativo presente di dare | `dare` | [diamo](https://it.wiktionary.org/w/index.php?title=diamo&oldid=3797324), [dare](https://it.wiktionary.org/w/index.php?title=dare&oldid=4068088) |
| 583231 | `diamo` | verb | 2 | prima persona plurale dell'imperativo presente di dare | `dare` | [diamo](https://it.wiktionary.org/w/index.php?title=diamo&oldid=3797324), [dare](https://it.wiktionary.org/w/index.php?title=dare&oldid=4068088) |
| 583232 | `offriamo` | verb | 1 | prima persona plurale del congiuntivo presente di offrire | `offrire` | [offriamo](https://it.wiktionary.org/w/index.php?title=offriamo&oldid=3790963), [offrire](https://it.wiktionary.org/w/index.php?title=offrire&oldid=4013049) |
| 583232 | `offriamo` | verb | 2 | prima persona plurale dell'imperativo presente di offrire | `offrire` | [offriamo](https://it.wiktionary.org/w/index.php?title=offriamo&oldid=3790963), [offrire](https://it.wiktionary.org/w/index.php?title=offrire&oldid=4013049) |
| 583233 | `consentite` | verb | 1 | seconda persona plurale dell'indicativo presente di consentire | `consentire` | [consentite](https://it.wiktionary.org/w/index.php?title=consentite&oldid=3789819), [consentire](https://it.wiktionary.org/w/index.php?title=consentire&oldid=3995551) |
| 583233 | `consentite` | verb | 2 | seconda persona plurale dell'imperativo presente di consentire | `consentire` | [consentite](https://it.wiktionary.org/w/index.php?title=consentite&oldid=3789819), [consentire](https://it.wiktionary.org/w/index.php?title=consentire&oldid=3995551) |
| 583269 | `dispiace` | verb | 0 | terza persona singolare dell'indicativo presente di dispiacere | `dispiacere` | [dispiace](https://it.wiktionary.org/w/index.php?title=dispiace&oldid=3790031), [dispiacere](https://it.wiktionary.org/w/index.php?title=dispiacere&oldid=3893563) |
| 583336 | `aurea` | adj | 0 | femminile di aureo | `aureo` | [aurea](https://it.wiktionary.org/w/index.php?title=aurea&oldid=3874897), [aureo](https://it.wiktionary.org/w/index.php?title=aureo&oldid=3719532) |
| 583345 | `immodesti` | adj | 0 | plurale di immodesto | `immodesto` | [immodesti](https://it.wiktionary.org/w/index.php?title=immodesti&oldid=4068065), [immodesto](https://it.wiktionary.org/w/index.php?title=immodesto&oldid=3901437) |
| 583373 | `rilassa` | verb | 1 | seconda persona singolare dell'imperativo presente di rilassare | `rilassare` | [rilassa](https://it.wiktionary.org/w/index.php?title=rilassa&oldid=3849942), [rilassare](https://it.wiktionary.org/w/index.php?title=rilassare&oldid=3948075) |
| 583413 | `udiamo` | verb | 1 | prima persona plurale del congiuntivo presente di udire | `udire` | [udiamo](https://it.wiktionary.org/w/index.php?title=udiamo&oldid=3792251), [udire](https://it.wiktionary.org/w/index.php?title=udire&oldid=3692947) |
| 583413 | `udiamo` | verb | 2 | prima persona plurale dell'imperativo presente di udire | `udire` | [udiamo](https://it.wiktionary.org/w/index.php?title=udiamo&oldid=3792251), [udire](https://it.wiktionary.org/w/index.php?title=udire&oldid=3692947) |
| 583414 | `patiamo` | verb | 1 | prima persona plurale del congiuntivo presente di patire | `patire` | [patiamo](https://it.wiktionary.org/w/index.php?title=patiamo&oldid=3791036), [patire](https://it.wiktionary.org/w/index.php?title=patire&oldid=3947208) |
| 583414 | `patiamo` | verb | 2 | prima persona plurale dell'imperativo presente di patire | `patire` | [patiamo](https://it.wiktionary.org/w/index.php?title=patiamo&oldid=3791036), [patire](https://it.wiktionary.org/w/index.php?title=patire&oldid=3947208) |
| 583415 | `prevediamo` | verb | 1 | prima persona plurale del congiuntivo presente di prevedere | `prevedere` | [prevediamo](https://it.wiktionary.org/w/index.php?title=prevediamo&oldid=3791175), [prevedere](https://it.wiktionary.org/w/index.php?title=prevedere&oldid=3893786) |
| 583415 | `prevediamo` | verb | 2 | prima persona plurale dell'imperativo presente di prevedere | `prevedere` | [prevediamo](https://it.wiktionary.org/w/index.php?title=prevediamo&oldid=3791175), [prevedere](https://it.wiktionary.org/w/index.php?title=prevedere&oldid=3893786) |
| 583416 | `capiamo` | verb | 0 | prima persona plurale dell'indicativo presente di capire | `capire` | [capiamo](https://it.wiktionary.org/w/index.php?title=capiamo&oldid=3789660), [capire](https://it.wiktionary.org/w/index.php?title=capire&oldid=4043205) |
| 583416 | `capiamo` | verb | 1 | prima persona plurale del congiuntivo presente di capire | `capire` | [capiamo](https://it.wiktionary.org/w/index.php?title=capiamo&oldid=3789660), [capire](https://it.wiktionary.org/w/index.php?title=capire&oldid=4043205) |
| 583416 | `capiamo` | verb | 2 | prima persona plurale dell'imperativo presente di capire | `capire` | [capiamo](https://it.wiktionary.org/w/index.php?title=capiamo&oldid=3789660), [capire](https://it.wiktionary.org/w/index.php?title=capire&oldid=4043205) |
| 583419 | `visitatrici` | noun | 0 | femminile plurale di visitatore | `visitatore` | [visitatrici](https://it.wiktionary.org/w/index.php?title=visitatrici&oldid=3917954), [visitatore](https://it.wiktionary.org/w/index.php?title=visitatore&oldid=3981906) |
| 583420 | `visitatori` | noun | 0 | plurale di visitatore | `visitatore` | [visitatori](https://it.wiktionary.org/w/index.php?title=visitatori&oldid=3783702), [visitatore](https://it.wiktionary.org/w/index.php?title=visitatore&oldid=3981906) |
| 583523 | `custodie` | noun | 0 | plurale di custodia | `custodia` | [custodie](https://it.wiktionary.org/w/index.php?title=custodie&oldid=3784077), [custodia](https://it.wiktionary.org/w/index.php?title=custodia&oldid=3964509) |
| 583780 | `soppressi` | adj | 0 | plurale di soppresso | `soppresso` | [soppressi](https://it.wiktionary.org/w/index.php?title=soppressi&oldid=3840521), [soppresso](https://it.wiktionary.org/w/index.php?title=soppresso&oldid=3971823) |
| 583942 | `realistici` | adj | 0 | plurale di realistico | `realistico` | [realistici](https://it.wiktionary.org/w/index.php?title=realistici&oldid=3791270), [realistico](https://it.wiktionary.org/w/index.php?title=realistico&oldid=4014481) |
| 583943 | `irrealistici` | adj | 0 | plurale di irrealistico | `irrealistico` | [irrealistici](https://it.wiktionary.org/w/index.php?title=irrealistici&oldid=3785392), [irrealistico](https://it.wiktionary.org/w/index.php?title=irrealistico&oldid=3963518) |
| 583944 | `irrealistica` | adj | 0 | femminile di irrealistico | `irrealistico` | [irrealistica](https://it.wiktionary.org/w/index.php?title=irrealistica&oldid=3785393), [irrealistico](https://it.wiktionary.org/w/index.php?title=irrealistico&oldid=3963518) |
| 583948 | `ricciuti` | adj | 0 | plurale di ricciuto | `ricciuto` | [ricciuti](https://it.wiktionary.org/w/index.php?title=ricciuti&oldid=3917967), [ricciuto](https://it.wiktionary.org/w/index.php?title=ricciuto&oldid=3905376) |
| 584029 | `accigliate` | verb | 1 | seconda persona plurale dell'indicativo presente di accigliare | `accigliare` | [accigliate](https://it.wiktionary.org/w/index.php?title=accigliate&oldid=3917981), [accigliare](https://it.wiktionary.org/w/index.php?title=accigliare&oldid=3905932) |
| 584029 | `accigliate` | verb | 2 | seconda persona plurale del congiuntivo presente di accigliare | `accigliare` | [accigliate](https://it.wiktionary.org/w/index.php?title=accigliate&oldid=3917981), [accigliare](https://it.wiktionary.org/w/index.php?title=accigliare&oldid=3905932) |
| 584029 | `accigliate` | verb | 3 | seconda persona plurale dell'imperativo presente di accigliare | `accigliare` | [accigliate](https://it.wiktionary.org/w/index.php?title=accigliate&oldid=3917981), [accigliare](https://it.wiktionary.org/w/index.php?title=accigliare&oldid=3905932) |
| 584075 | `soddisfatti` | adj | 0 | plurale di soddisfatto | `soddisfatto` | [soddisfatti](https://it.wiktionary.org/w/index.php?title=soddisfatti&oldid=3917983), [soddisfatto](https://it.wiktionary.org/w/index.php?title=soddisfatto&oldid=4055409) |
| 584100 | `odontoiatri` | noun | 0 | plurale di odontoiatra | `odontoiatra` | [odontoiatri](https://it.wiktionary.org/w/index.php?title=odontoiatri&oldid=3829636), [odontoiatra](https://it.wiktionary.org/w/index.php?title=odontoiatra&oldid=4059965) |
| 584107 | `semenzai` | noun | 0 | plurale di semenzaio | `semenzaio` | [semenzai](https://it.wiktionary.org/w/index.php?title=semenzai&oldid=3786321), [semenzaio](https://it.wiktionary.org/w/index.php?title=semenzaio&oldid=3786320) |
| 584181 | `tacque` | verb | 0 | terza persona singolare dell'indicativo passato remoto di tacere | `tacere` | [tacque](https://it.wiktionary.org/w/index.php?title=tacque&oldid=4007072), [tacere](https://it.wiktionary.org/w/index.php?title=tacere&oldid=4009121) |
| 584200 | `folignati` | adj | 0 | plurale di folignate | `folignate` | [folignati](https://it.wiktionary.org/w/index.php?title=folignati&oldid=3787259), [folignate](https://it.wiktionary.org/w/index.php?title=folignate&oldid=3787260) |
| 584221 | `cooperatori` | noun | 0 | plurale di cooperatore | `cooperatore` | [cooperatori](https://it.wiktionary.org/w/index.php?title=cooperatori&oldid=3789865), [cooperatore](https://it.wiktionary.org/w/index.php?title=cooperatore&oldid=4054666) |
| 584242 | `mucose` | noun | 0 | plurale di mucosa | `mucosa` | [mucose](https://it.wiktionary.org/w/index.php?title=mucose&oldid=3790898), [mucosa](https://it.wiktionary.org/w/index.php?title=mucosa&oldid=3859677) |
| 584243 | `rivide` | verb | 0 | terza persona singolare dell'indicativo passato remoto di rivedere | `rivedere` | [rivide](https://it.wiktionary.org/w/index.php?title=rivide&oldid=3791448), [rivedere](https://it.wiktionary.org/w/index.php?title=rivedere&oldid=4009290) |
| 584244 | `epigone` | noun | 0 | femminile plurale di epigono | `epigono` | [epigone](https://it.wiktionary.org/w/index.php?title=epigone&oldid=3790157), [epigono](https://it.wiktionary.org/w/index.php?title=epigono&oldid=3892192) |
| 584249 | `epigona` | noun | 0 | femminile di epigono | `epigono` | [epigona](https://it.wiktionary.org/w/index.php?title=epigona&oldid=3790156), [epigono](https://it.wiktionary.org/w/index.php?title=epigono&oldid=3892192) |
| 584275 | `esecutivi` | adj | 0 | plurale di esecutivo | `esecutivo` | [esecutivi](https://it.wiktionary.org/w/index.php?title=esecutivi&oldid=3787838), [esecutivo](https://it.wiktionary.org/w/index.php?title=esecutivo&oldid=3967016) |
| 584282 | `umanitarie` | noun | 0 | femminile plurale di umanitario | `umanitario` | [umanitarie](https://it.wiktionary.org/w/index.php?title=umanitarie&oldid=3917992), [umanitario](https://it.wiktionary.org/w/index.php?title=umanitario&oldid=4031302) |
| 584284 | `umanitari` | noun | 0 | femminile plurale di umanitario | `umanitario` | [umanitari](https://it.wiktionary.org/w/index.php?title=umanitari&oldid=4007171), [umanitario](https://it.wiktionary.org/w/index.php?title=umanitario&oldid=4031302) |
| 584293 | `consente` | verb | 0 | terza persona singolare dell'indicativo presente di consentire | `consentire` | [consente](https://it.wiktionary.org/w/index.php?title=consente&oldid=3965177), [consentire](https://it.wiktionary.org/w/index.php?title=consentire&oldid=3995551) |
| 584892 | `rischiò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di rischiare | `rischiare` | [rischiò](https://it.wiktionary.org/w/index.php?title=rischi%C3%B2&oldid=4155380), [rischiare](https://it.wiktionary.org/w/index.php?title=rischiare&oldid=3896717) |
| 584901 | `imbrogliona` | noun | 0 | femminile di imbroglione | `imbroglione` | [imbrogliona](https://it.wiktionary.org/w/index.php?title=imbrogliona&oldid=3800464), [imbroglione](https://it.wiktionary.org/w/index.php?title=imbroglione&oldid=3933930) |
| 584902 | `imbroglioni` | noun | 0 | plurale di imbroglione | `imbroglione` | [imbroglioni](https://it.wiktionary.org/w/index.php?title=imbroglioni&oldid=3800465), [imbroglione](https://it.wiktionary.org/w/index.php?title=imbroglione&oldid=3933930) |
| 584929 | `convalide` | noun | 0 | plurale di convalida | `convalida` | [convalide](https://it.wiktionary.org/w/index.php?title=convalide&oldid=3800303), [convalida](https://it.wiktionary.org/w/index.php?title=convalida&oldid=3995458) |
| 584972 | `soddisfece` | verb | 0 | terza persona singolare dell'indicativo passato remoto di soddisfare | `soddisfare` | [soddisfece](https://it.wiktionary.org/w/index.php?title=soddisfece&oldid=3793573), [soddisfare](https://it.wiktionary.org/w/index.php?title=soddisfare&oldid=3892253) |
| 584974 | `godette` | verb | 0 | terza persona singolare dell'indicativo passato remoto di godere | `godere` | [godette](https://it.wiktionary.org/w/index.php?title=godette&oldid=4048381), [godere](https://it.wiktionary.org/w/index.php?title=godere&oldid=3967668) |
| 585045 | `salirebbe` | verb | 0 | terza persona singolare del condizionale presente di salire | `salire` | [salirebbe](https://it.wiktionary.org/w/index.php?title=salirebbe&oldid=3793798), [salire](https://it.wiktionary.org/w/index.php?title=salire&oldid=3958977) |
| 585047 | `sindacaliste` | noun | 0 | femminile plurale di sindacalista | `sindacalista` | [sindacaliste](https://it.wiktionary.org/w/index.php?title=sindacaliste&oldid=3918013), [sindacalista](https://it.wiktionary.org/w/index.php?title=sindacalista&oldid=3902779) |
| 585193 | `biscrome` | noun | 0 | plurale di biscroma | `biscroma` | [biscrome](https://it.wiktionary.org/w/index.php?title=biscrome&oldid=3930648), [biscroma](https://it.wiktionary.org/w/index.php?title=biscroma&oldid=3930650) |
| 585195 | `piacete` | verb | 1 | seconda persona plurale dell'imperativo presente di piacere | `piacere` | [piacete](https://it.wiktionary.org/w/index.php?title=piacete&oldid=3800617), [piacere](https://it.wiktionary.org/w/index.php?title=piacere&oldid=3981533) |
| 585224 | `logori` | verb | 1 | prima persona singolare del congiuntivo presente di logorare | `logorare` | [logori](https://it.wiktionary.org/w/index.php?title=logori&oldid=3878527), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 585224 | `logori` | verb | 2 | seconda persona singolare del congiuntivo presente di logorare | `logorare` | [logori](https://it.wiktionary.org/w/index.php?title=logori&oldid=3878527), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 585224 | `logori` | verb | 3 | terza persona singolare del congiuntivo presente di logorare | `logorare` | [logori](https://it.wiktionary.org/w/index.php?title=logori&oldid=3878527), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 585224 | `logori` | verb | 4 | terza persona singolare dell'imperativo presente di logorare | `logorare` | [logori](https://it.wiktionary.org/w/index.php?title=logori&oldid=3878527), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 585240 | `riscosse` | verb | 1 | terza persona singolare dell'indicativo passato remoto di riscuotere | `riscuotere` | [riscosse](https://it.wiktionary.org/w/index.php?title=riscosse&oldid=4053358), [riscuotere](https://it.wiktionary.org/w/index.php?title=riscuotere&oldid=3970258) |
| 585261 | `bassopiani` | noun | 0 | plurale di bassopiano | `bassopiano` | [bassopiani](https://it.wiktionary.org/w/index.php?title=bassopiani&oldid=3794814), [bassopiano](https://it.wiktionary.org/w/index.php?title=bassopiano&oldid=3756823) |
| 585282 | `asili` | noun | 0 | plurale di asilo | `asilo` | [asili](https://it.wiktionary.org/w/index.php?title=asili&oldid=3800123), [asilo](https://it.wiktionary.org/w/index.php?title=asilo&oldid=4060028) |
| 585314 | `incolpevoli` | adj | 0 | plurale di incolpevole | `incolpevole` | [incolpevoli](https://it.wiktionary.org/w/index.php?title=incolpevoli&oldid=3800483), [incolpevole](https://it.wiktionary.org/w/index.php?title=incolpevole&oldid=3641236) |
| 585319 | `piaci` | verb | 1 | seconda persona singolare dell'imperativo presente di piacere | `piacere` | [piaci](https://it.wiktionary.org/w/index.php?title=piaci&oldid=3837009), [piacere](https://it.wiktionary.org/w/index.php?title=piacere&oldid=3981533) |
| 585324 | `morrai` | verb | 0 | seconda persona singolare dell'indicativo futuro semplice di morire | `morire` | [morrai](https://it.wiktionary.org/w/index.php?title=morrai&oldid=3795336), [morire](https://it.wiktionary.org/w/index.php?title=morire&oldid=4042614) |
| 585338 | `traspari` | verb | 1 | seconda persona singolare dell'imperativo presente di trasparire | `trasparire` | [traspari](https://it.wiktionary.org/w/index.php?title=traspari&oldid=3800880), [trasparire](https://it.wiktionary.org/w/index.php?title=trasparire&oldid=3448149) |
| 585367 | `spense` | verb | 0 | terza persona singolare dell'indicativo passato remoto di spegnere | `spegnere` | [spense](https://it.wiktionary.org/w/index.php?title=spense&oldid=4056008), [spegnere](https://it.wiktionary.org/w/index.php?title=spegnere&oldid=4144844) |
| 585402 | `vedranno` | verb | 0 | terza persona plurale dell'indicativo futuro semplice di vedere | `vedere` | [vedranno](https://it.wiktionary.org/w/index.php?title=vedranno&oldid=3796413), [vedere](https://it.wiktionary.org/w/index.php?title=vedere&oldid=4042937) |
| 585450 | `uccisori` | noun | 0 | plurale di uccisore | `uccisore` | [uccisori](https://it.wiktionary.org/w/index.php?title=uccisori&oldid=3918022), [uccisore](https://it.wiktionary.org/w/index.php?title=uccisore&oldid=4000172) |
| 585451 | `uccisora` | noun | 0 | femminile singolare di uccisore | `uccisore` | [uccisora](https://it.wiktionary.org/w/index.php?title=uccisora&oldid=3963449), [uccisore](https://it.wiktionary.org/w/index.php?title=uccisore&oldid=4000172) |
| 585579 | `condizionamenti` | noun | 0 | plurale di condizionamento | `condizionamento` | [condizionamenti](https://it.wiktionary.org/w/index.php?title=condizionamenti&oldid=3797028), [condizionamento](https://it.wiktionary.org/w/index.php?title=condizionamento&oldid=3984846) |
| 585591 | `spruzzate` | verb | 0 | participio passato plurale femminile di spruzzare | `spruzzare` | [spruzzate](https://it.wiktionary.org/w/index.php?title=spruzzate&oldid=3800808), [spruzzare](https://it.wiktionary.org/w/index.php?title=spruzzare&oldid=3850141) |
| 585712 | `stazionaria` | adj | 0 | femminile di stazionario | `stazionario` | [stazionaria](https://it.wiktionary.org/w/index.php?title=stazionaria&oldid=3838873), [stazionario](https://it.wiktionary.org/w/index.php?title=stazionario&oldid=3963517) |
| 585717 | `logora` | verb | 0 | terza persona singolare dell'indicativo presente di logorare | `logorare` | [logora](https://it.wiktionary.org/w/index.php?title=logora&oldid=3878528), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 585717 | `logora` | verb | 1 | seconda persona singolare dell'imperativo presente di logorare | `logorare` | [logora](https://it.wiktionary.org/w/index.php?title=logora&oldid=3878528), [logorare](https://it.wiktionary.org/w/index.php?title=logorare&oldid=4038166) |
| 585728 | `trasandata` | adj | 0 | femminile di trasandato | `trasandato` | [trasandata](https://it.wiktionary.org/w/index.php?title=trasandata&oldid=3821674), [trasandato](https://it.wiktionary.org/w/index.php?title=trasandato&oldid=3926288) |
| 585730 | `rimbomba` | verb | 0 | terza persona singolare dell'indicativo presente di rimbombare | `rimbombare` | [rimbomba](https://it.wiktionary.org/w/index.php?title=rimbomba&oldid=4059059), [rimbombare](https://it.wiktionary.org/w/index.php?title=rimbombare&oldid=3837332) |
| 585730 | `rimbomba` | verb | 1 | seconda persona singolare dell'imperativo presente di rimbombare | `rimbombare` | [rimbomba](https://it.wiktionary.org/w/index.php?title=rimbomba&oldid=4059059), [rimbombare](https://it.wiktionary.org/w/index.php?title=rimbombare&oldid=3837332) |
| 585765 | `punse` | verb | 0 | terza persona singolare dell'indicativo passato remoto di pungere | `pungere` | [punse](https://it.wiktionary.org/w/index.php?title=punse&oldid=4055533), [pungere](https://it.wiktionary.org/w/index.php?title=pungere&oldid=3941051) |
| 585827 | `connetti` | verb | 1 | seconda persona singolare dell'imperativo presente di connettere | `connettere` | [connetti](https://it.wiktionary.org/w/index.php?title=connetti&oldid=3854931), [connettere](https://it.wiktionary.org/w/index.php?title=connettere&oldid=3635387) |
| 586043 | `prevedessi` | verb | 0 | prima persona singolare del congiuntivo imperfetto di prevedere | `prevedere` | [prevedessi](https://it.wiktionary.org/w/index.php?title=prevedessi&oldid=3837117), [prevedere](https://it.wiktionary.org/w/index.php?title=prevedere&oldid=3893786) |
| 586043 | `prevedessi` | verb | 1 | seconda persona singolare del congiuntivo imperfetto di prevedere | `prevedere` | [prevedessi](https://it.wiktionary.org/w/index.php?title=prevedessi&oldid=3837117), [prevedere](https://it.wiktionary.org/w/index.php?title=prevedere&oldid=3893786) |
| 586190 | `celestiali` | noun | 0 | plurale di celestiale | `celestiale` | [celestiali](https://it.wiktionary.org/w/index.php?title=celestiali&oldid=3961317), [celestiale](https://it.wiktionary.org/w/index.php?title=celestiale&oldid=4010947) |
| 586209 | `aurei` | adj | 0 | plurale di aureo | `aureo` | [aurei](https://it.wiktionary.org/w/index.php?title=aurei&oldid=3835115), [aureo](https://it.wiktionary.org/w/index.php?title=aureo&oldid=3719532) |
| 586696 | `invaghite` | verb | 0 | participio passato plurale femminile di invaghire | `invaghire` | [invaghite](https://it.wiktionary.org/w/index.php?title=invaghite&oldid=3836445), [invaghire](https://it.wiktionary.org/w/index.php?title=invaghire&oldid=3836443) |
| 586696 | `invaghite` | verb | 1 | seconda persona plurale dell'indicativo presente di invaghire | `invaghire` | [invaghite](https://it.wiktionary.org/w/index.php?title=invaghite&oldid=3836445), [invaghire](https://it.wiktionary.org/w/index.php?title=invaghire&oldid=3836443) |
| 586696 | `invaghite` | verb | 2 | seconda persona plurale dell'imperativo presente di invaghire | `invaghire` | [invaghite](https://it.wiktionary.org/w/index.php?title=invaghite&oldid=3836445), [invaghire](https://it.wiktionary.org/w/index.php?title=invaghire&oldid=3836443) |
| 586701 | `stentata` | adj | 0 | femminile di stentato | `stentato` | [stentata](https://it.wiktionary.org/w/index.php?title=stentata&oldid=4069280), [stentato](https://it.wiktionary.org/w/index.php?title=stentato&oldid=4076401) |
| 586706 | `estimatori` | noun | 0 | plurale di estimatore | `estimatore` | [estimatori](https://it.wiktionary.org/w/index.php?title=estimatori&oldid=3918046), [estimatore](https://it.wiktionary.org/w/index.php?title=estimatore&oldid=3994856) |
| 587266 | `burberi` | noun | 0 | plurale di burbero | `burbero` | [burberi](https://it.wiktionary.org/w/index.php?title=burberi&oldid=3918057), [burbero](https://it.wiktionary.org/w/index.php?title=burbero&oldid=4249755) |
| 587740 | `lestofanti` | noun | 0 | plurale di lestofante | `lestofante` | [lestofanti](https://it.wiktionary.org/w/index.php?title=lestofanti&oldid=3918060), [lestofante](https://it.wiktionary.org/w/index.php?title=lestofante&oldid=3966423) |
| 587778 | `cafoni` | adj | 0 | plurale di cafone | `cafone` | [cafoni](https://it.wiktionary.org/w/index.php?title=cafoni&oldid=3918062), [cafone](https://it.wiktionary.org/w/index.php?title=cafone&oldid=4052025) |
| 587779 | `cafoni` | noun | 0 | plurale di cafone | `cafone` | [cafoni](https://it.wiktionary.org/w/index.php?title=cafoni&oldid=3918062), [cafone](https://it.wiktionary.org/w/index.php?title=cafone&oldid=4052025) |
| 587780 | `cafona` | adj | 0 | femminile di cafone | `cafone` | [cafona](https://it.wiktionary.org/w/index.php?title=cafona&oldid=3918063), [cafone](https://it.wiktionary.org/w/index.php?title=cafone&oldid=4052025) |
| 587781 | `cafona` | noun | 0 | femminile di cafone | `cafone` | [cafona](https://it.wiktionary.org/w/index.php?title=cafona&oldid=3918063), [cafone](https://it.wiktionary.org/w/index.php?title=cafone&oldid=4052025) |
| 587782 | `zotica` | adj | 0 | femminile di zotico | `zotico` | [zotica](https://it.wiktionary.org/w/index.php?title=zotica&oldid=3807128), [zotico](https://it.wiktionary.org/w/index.php?title=zotico&oldid=4250840) |
| 587783 | `zotica` | noun | 0 | femminile di zotico | `zotico` | [zotica](https://it.wiktionary.org/w/index.php?title=zotica&oldid=3807128), [zotico](https://it.wiktionary.org/w/index.php?title=zotico&oldid=4250840) |
| 587792 | `asprigni` | adj | 0 | plurale di asprigno | `asprigno` | [asprigni](https://it.wiktionary.org/w/index.php?title=asprigni&oldid=3807197), [asprigno](https://it.wiktionary.org/w/index.php?title=asprigno&oldid=3807190) |
| 587817 | `libbre` | noun | 0 | plurale di libbra | `libbra` | [libbre](https://it.wiktionary.org/w/index.php?title=libbre&oldid=3836542), [libbra](https://it.wiktionary.org/w/index.php?title=libbra&oldid=4046196) |
| 587845 | `arbitraria` | adj | 0 | femminile di arbitrario | `arbitrario` | [arbitraria](https://it.wiktionary.org/w/index.php?title=arbitraria&oldid=4055396), [arbitrario](https://it.wiktionary.org/w/index.php?title=arbitrario&oldid=4047573) |
| 587847 | `arbitrarie` | adj | 0 | femminile plurale di arbitrario | `arbitrario` | [arbitrarie](https://it.wiktionary.org/w/index.php?title=arbitrarie&oldid=3952611), [arbitrario](https://it.wiktionary.org/w/index.php?title=arbitrario&oldid=4047573) |
| 587848 | `soggettive` | adj | 0 | plurale femminile di soggettivo | `soggettivo` | [soggettive](https://it.wiktionary.org/w/index.php?title=soggettive&oldid=4049291), [soggettivo](https://it.wiktionary.org/w/index.php?title=soggettivo&oldid=4058588) |
| 587948 | `copertoni` | noun | 0 | plurale di copertone | `copertone` | [copertoni](https://it.wiktionary.org/w/index.php?title=copertoni&oldid=3807788), [copertone](https://it.wiktionary.org/w/index.php?title=copertone&oldid=4007628) |
| 588280 | `terrori` | noun | 0 | plurale di terrore | `terrore` | [terrori](https://it.wiktionary.org/w/index.php?title=terrori&oldid=3918075), [terrore](https://it.wiktionary.org/w/index.php?title=terrore&oldid=4007569) |
| 588314 | `spirali` | noun | 0 | plurale di spirale | `spirale` | [spirali](https://it.wiktionary.org/w/index.php?title=spirali&oldid=3808935), [spirale](https://it.wiktionary.org/w/index.php?title=spirale&oldid=3934606) |
| 588352 | `scellerata` | noun | 0 | femminile di scellerato | `scellerato` | [scellerata](https://it.wiktionary.org/w/index.php?title=scellerata&oldid=3865250), [scellerato](https://it.wiktionary.org/w/index.php?title=scellerato&oldid=3957951) |
| 588362 | `malefica` | noun | 0 | femminile di malefico | `malefico` | [malefica](https://it.wiktionary.org/w/index.php?title=malefica&oldid=3918087), [malefico](https://it.wiktionary.org/w/index.php?title=malefico&oldid=3892235) |
| 588364 | `malefiche` | noun | 0 | femminile plurale di malefico | `malefico` | [malefiche](https://it.wiktionary.org/w/index.php?title=malefiche&oldid=3836599), [malefico](https://it.wiktionary.org/w/index.php?title=malefico&oldid=3892235) |
| 588416 | `riformisti` | adj | 0 | plurale di riformista | `riformista` | [riformisti](https://it.wiktionary.org/w/index.php?title=riformisti&oldid=3837321), [riformista](https://it.wiktionary.org/w/index.php?title=riformista&oldid=3799722) |
| 588417 | `riformisti` | noun | 0 | plurale di riformista | `riformista` | [riformisti](https://it.wiktionary.org/w/index.php?title=riformisti&oldid=3837321), [riformista](https://it.wiktionary.org/w/index.php?title=riformista&oldid=3799722) |
| 588543 | `atipica` | adj | 0 | femminile di atipico | `atipico` | [atipica](https://it.wiktionary.org/w/index.php?title=atipica&oldid=3810216), [atipico](https://it.wiktionary.org/w/index.php?title=atipico&oldid=3880258) |
| 588580 | `lussuriosa` | adj | 0 | femminile di lussurioso | `lussurioso` | [lussuriosa](https://it.wiktionary.org/w/index.php?title=lussuriosa&oldid=3810454), [lussurioso](https://it.wiktionary.org/w/index.php?title=lussurioso&oldid=3934069) |
| 588673 | `malinconica` | adj | 0 | femminile di malinconico | `malinconico` | [malinconica](https://it.wiktionary.org/w/index.php?title=malinconica&oldid=4026067), [malinconico](https://it.wiktionary.org/w/index.php?title=malinconico&oldid=3885443) |
| 588941 | `rapinatori` | noun | 0 | plurale di rapinatore | `rapinatore` | [rapinatori](https://it.wiktionary.org/w/index.php?title=rapinatori&oldid=3918106), [rapinatore](https://it.wiktionary.org/w/index.php?title=rapinatore&oldid=3901925) |
| 589039 | `taccheggiatori` | noun | 0 | plurale di taccheggiatore | `taccheggiatore` | [taccheggiatori](https://it.wiktionary.org/w/index.php?title=taccheggiatori&oldid=3837882), [taccheggiatore](https://it.wiktionary.org/w/index.php?title=taccheggiatore&oldid=3837881) |
| 589039 | `taccheggiatori` | noun | 1 | plurale di taccheggiatore | `taccheggiatore` | [taccheggiatori](https://it.wiktionary.org/w/index.php?title=taccheggiatori&oldid=3837882), [taccheggiatore](https://it.wiktionary.org/w/index.php?title=taccheggiatore&oldid=3837881) |
| 589050 | `alluvioni` | noun | 0 | plurale di alluvione | `alluvione` | [alluvioni](https://it.wiktionary.org/w/index.php?title=alluvioni&oldid=3834896), [alluvione](https://it.wiktionary.org/w/index.php?title=alluvione&oldid=4000636) |
| 589050 | `alluvioni` | noun | 1 | plurale di alluvione | `alluvione` | [alluvioni](https://it.wiktionary.org/w/index.php?title=alluvioni&oldid=3834896), [alluvione](https://it.wiktionary.org/w/index.php?title=alluvione&oldid=4000636) |
| 589116 | `manate` | noun | 0 | plurale di manata | `manata` | [manate](https://it.wiktionary.org/w/index.php?title=manate&oldid=3836611), [manata](https://it.wiktionary.org/w/index.php?title=manata&oldid=4212003) |
| 589117 | `dominatori` | noun | 0 | plurale di dominatore | `dominatore` | [dominatori](https://it.wiktionary.org/w/index.php?title=dominatori&oldid=3813249), [dominatore](https://it.wiktionary.org/w/index.php?title=dominatore&oldid=4015476) |
| 589253 | `multimiliardari` | noun | 0 | plurale di multimiliardario | `multimiliardario` | [multimiliardari](https://it.wiktionary.org/w/index.php?title=multimiliardari&oldid=3836747), [multimiliardario](https://it.wiktionary.org/w/index.php?title=multimiliardario&oldid=3813785) |
| 589257 | `multimiliardarie` | noun | 0 | femminile plurale di multimiliardario | `multimiliardario` | [multimiliardarie](https://it.wiktionary.org/w/index.php?title=multimiliardarie&oldid=3974309), [multimiliardario](https://it.wiktionary.org/w/index.php?title=multimiliardario&oldid=3813785) |
| 589737 | `leziosa` | adj | 0 | femminile di lezioso | `lezioso` | [leziosa](https://it.wiktionary.org/w/index.php?title=leziosa&oldid=3836539), [lezioso](https://it.wiktionary.org/w/index.php?title=lezioso&oldid=4250766) |
| 589912 | `scellerate` | noun | 0 | plurale femminile di scellerato | `scellerato` | [scellerate](https://it.wiktionary.org/w/index.php?title=scellerate&oldid=3837469), [scellerato](https://it.wiktionary.org/w/index.php?title=scellerato&oldid=3957951) |
| 589942 | `grinzosa` | adj | 0 | femminile di grinzoso | `grinzoso` | [grinzosa](https://it.wiktionary.org/w/index.php?title=grinzosa&oldid=3919035), [grinzoso](https://it.wiktionary.org/w/index.php?title=grinzoso&oldid=4056430) |
| 589944 | `grinzose` | adj | 0 | femminile di grinzoso | `grinzoso` | [grinzose](https://it.wiktionary.org/w/index.php?title=grinzose&oldid=3919037), [grinzoso](https://it.wiktionary.org/w/index.php?title=grinzoso&oldid=4056430) |
| 589984 | `riavuta` | adj | 0 | femminile di riavuto | `riavuto` | [riavuta](https://it.wiktionary.org/w/index.php?title=riavuta&oldid=3837297), [riavuto](https://it.wiktionary.org/w/index.php?title=riavuto&oldid=3837300) |
| 589986 | `riavuti` | adj | 0 | plurale di riavuto | `riavuto` | [riavuti](https://it.wiktionary.org/w/index.php?title=riavuti&oldid=3837299), [riavuto](https://it.wiktionary.org/w/index.php?title=riavuto&oldid=3837300) |
| 589988 | `riavute` | adj | 0 | plurale femminile di riavuto | `riavuto` | [riavute](https://it.wiktionary.org/w/index.php?title=riavute&oldid=3837298), [riavuto](https://it.wiktionary.org/w/index.php?title=riavuto&oldid=3837300) |
| 590029 | `superstiti` | noun | 0 | plurale di superstite | `superstite` | [superstiti](https://it.wiktionary.org/w/index.php?title=superstiti&oldid=3921143), [superstite](https://it.wiktionary.org/w/index.php?title=superstite&oldid=4019606) |
| 590103 | `appariscenti` | adj | 0 | plurale di appariscente | `appariscente` | [appariscenti](https://it.wiktionary.org/w/index.php?title=appariscenti&oldid=3834984), [appariscente](https://it.wiktionary.org/w/index.php?title=appariscente&oldid=3930720) |
| 590166 | `indossatori` | noun | 0 | plurale di indossatore | `indossatore` | [indossatori](https://it.wiktionary.org/w/index.php?title=indossatori&oldid=3836349), [indossatore](https://it.wiktionary.org/w/index.php?title=indossatore&oldid=3969506) |
| 590207 | `mandrie` | noun | 0 | plurale di mandria | `mandria` | [mandrie](https://it.wiktionary.org/w/index.php?title=mandrie&oldid=3962848), [mandria](https://it.wiktionary.org/w/index.php?title=mandria&oldid=3896028) |
| 590275 | `persuasive` | noun | 0 | femminile plurale di persuasivo | `persuasivo` | [persuasive](https://it.wiktionary.org/w/index.php?title=persuasive&oldid=3836981), [persuasivo](https://it.wiktionary.org/w/index.php?title=persuasivo&oldid=3623414) |
| 590309 | `musi` | noun | 0 | plurale di muso | `muso` | [musi](https://it.wiktionary.org/w/index.php?title=musi&oldid=3918231), [muso](https://it.wiktionary.org/w/index.php?title=muso&oldid=4043272) |
| 590346 | `armeggiona` | noun | 0 | femminile di armeggione | `armeggione` | [armeggiona](https://it.wiktionary.org/w/index.php?title=armeggiona&oldid=3918241), [armeggione](https://it.wiktionary.org/w/index.php?title=armeggione&oldid=4002108) |
| 590347 | `armeggioni` | noun | 0 | plurale di armeggione | `armeggione` | [armeggioni](https://it.wiktionary.org/w/index.php?title=armeggioni&oldid=3918242), [armeggione](https://it.wiktionary.org/w/index.php?title=armeggione&oldid=4002108) |
| 590370 | `partirei` | verb | 0 | prima persona singolare del condizionale presente di partire | `partire` | [partirei](https://it.wiktionary.org/w/index.php?title=partirei&oldid=3820934), [partire](https://it.wiktionary.org/w/index.php?title=partire&oldid=4049871) |
| 590381 | `iconica` | noun | 0 | femminile di iconico | `iconico` | [iconica](https://it.wiktionary.org/w/index.php?title=iconica&oldid=3836230), [iconico](https://it.wiktionary.org/w/index.php?title=iconico&oldid=3961727) |
| 590383 | `iconiche` | noun | 0 | femminile plurale di iconico | `iconico` | [iconiche](https://it.wiktionary.org/w/index.php?title=iconiche&oldid=3836231), [iconico](https://it.wiktionary.org/w/index.php?title=iconico&oldid=3961727) |
| 590426 | `ostacolisti` | noun | 0 | plurale di ostacolista | `ostacolista` | [ostacolisti](https://it.wiktionary.org/w/index.php?title=ostacolisti&oldid=3821584), [ostacolista](https://it.wiktionary.org/w/index.php?title=ostacolista&oldid=3836880) |
| 590449 | `balorda` | adj | 0 | femminile di balordo | `balordo` | [balorda](https://it.wiktionary.org/w/index.php?title=balorda&oldid=3918245), [balordo](https://it.wiktionary.org/w/index.php?title=balordo&oldid=4053784) |
| 590452 | `balordi` | adj | 0 | plurale di balordo | `balordo` | [balordi](https://it.wiktionary.org/w/index.php?title=balordi&oldid=3918247), [balordo](https://it.wiktionary.org/w/index.php?title=balordo&oldid=4053784) |
| 590453 | `balorde` | adj | 0 | femminile plurale di balordo | `balordo` | [balorde](https://it.wiktionary.org/w/index.php?title=balorde&oldid=3918248), [balordo](https://it.wiktionary.org/w/index.php?title=balordo&oldid=4053784) |
| 590488 | `rovinò` | verb | 0 | terza persona singolare dell'indicativo passato remoto di rovinare | `rovinare` | [rovinò](https://it.wiktionary.org/w/index.php?title=rovin%C3%B2&oldid=3844114), [rovinare](https://it.wiktionary.org/w/index.php?title=rovinare&oldid=4038845) |
| 590489 | `intendimenti` | noun | 0 | plurale di intendimento | `intendimento` | [intendimenti](https://it.wiktionary.org/w/index.php?title=intendimenti&oldid=3918257), [intendimento](https://it.wiktionary.org/w/index.php?title=intendimento&oldid=3894308) |
| 590497 | `imbevuti` | adj | 0 | plurale di imbevuto | `imbevuto` | [imbevuti](https://it.wiktionary.org/w/index.php?title=imbevuti&oldid=3822323), [imbevuto](https://it.wiktionary.org/w/index.php?title=imbevuto&oldid=4054413) |
| 590569 | `elitaria` | adj | 0 | femminile di elitario | `elitario` | [elitaria](https://it.wiktionary.org/w/index.php?title=elitaria&oldid=3835850), [elitario](https://it.wiktionary.org/w/index.php?title=elitario&oldid=3638502) |
| 591073 | `possediamo` | verb | 1 | prima persona plurale del congiuntivo presente di possedere | `possedere` | [possediamo](https://it.wiktionary.org/w/index.php?title=possediamo&oldid=3837078), [possedere](https://it.wiktionary.org/w/index.php?title=possedere&oldid=3982176) |
| 591073 | `possediamo` | verb | 2 | prima persona plurale dell'imperativo presente di possedere | `possedere` | [possediamo](https://it.wiktionary.org/w/index.php?title=possediamo&oldid=3837078), [possedere](https://it.wiktionary.org/w/index.php?title=possedere&oldid=3982176) |
| 591187 | `chiarificatori` | noun | 0 | plurale di chiarificatore | `chiarificatore` | [chiarificatori](https://it.wiktionary.org/w/index.php?title=chiarificatori&oldid=3827060), [chiarificatore](https://it.wiktionary.org/w/index.php?title=chiarificatore&oldid=4054474) |
| 591188 | `chiarificatori` | noun | 0 | plurale di chiarificatore | `chiarificatore` | [chiarificatori](https://it.wiktionary.org/w/index.php?title=chiarificatori&oldid=3827060), [chiarificatore](https://it.wiktionary.org/w/index.php?title=chiarificatore&oldid=4054474) |
| 591708 | `disfai` | verb | 1 | seconda persona singolare dell'imperativo presente di disfare | `disfare` | [disfai](https://it.wiktionary.org/w/index.php?title=disfai&oldid=3835727), [disfare](https://it.wiktionary.org/w/index.php?title=disfare&oldid=3981874) |
| 591715 | `speranzosa` | adj | 0 | femminile di speranzoso | `speranzoso` | [speranzosa](https://it.wiktionary.org/w/index.php?title=speranzosa&oldid=3837722), [speranzoso](https://it.wiktionary.org/w/index.php?title=speranzoso&oldid=4009081) |
| 591716 | `speranzosi` | adj | 0 | plurale di speranzoso | `speranzoso` | [speranzosi](https://it.wiktionary.org/w/index.php?title=speranzosi&oldid=3837724), [speranzoso](https://it.wiktionary.org/w/index.php?title=speranzoso&oldid=4009081) |
| 591717 | `speranzose` | adj | 0 | femminile plurale di speranzoso | `speranzoso` | [speranzose](https://it.wiktionary.org/w/index.php?title=speranzose&oldid=3837723), [speranzoso](https://it.wiktionary.org/w/index.php?title=speranzoso&oldid=4009081) |
| 591772 | `nullatenenti` | noun | 0 | plurale di nullatenente | `nullatenente` | [nullatenenti](https://it.wiktionary.org/w/index.php?title=nullatenenti&oldid=3829400), [nullatenente](https://it.wiktionary.org/w/index.php?title=nullatenente&oldid=4059250) |
| 591790 | `altaici` | adj | 0 | plurale di altaico | `altaico` | [altaici](https://it.wiktionary.org/w/index.php?title=altaici&oldid=3829511), [altaico](https://it.wiktionary.org/w/index.php?title=altaico&oldid=3834902) |
| 591881 | `ferraresi` | adj | 0 | plurale di ferrarese | `ferrarese` | [ferraresi](https://it.wiktionary.org/w/index.php?title=ferraresi&oldid=3957656), [ferrarese](https://it.wiktionary.org/w/index.php?title=ferrarese&oldid=4067902) |
| 591882 | `ferraresi` | noun | 0 | plurale di ferrarese | `ferrarese` | [ferraresi](https://it.wiktionary.org/w/index.php?title=ferraresi&oldid=3957656), [ferrarese](https://it.wiktionary.org/w/index.php?title=ferrarese&oldid=4067902) |
| 592298 | `polpette` | noun | 0 | plurale di polpetta | `polpetta` | [polpette](https://it.wiktionary.org/w/index.php?title=polpette&oldid=3832016), [polpetta](https://it.wiktionary.org/w/index.php?title=polpetta&oldid=4000105) |
| 592338 | `radiata` | adj | 0 | femminile di radiato | `radiato` | [radiata](https://it.wiktionary.org/w/index.php?title=radiata&oldid=3837210), [radiato](https://it.wiktionary.org/w/index.php?title=radiato&oldid=3958421) |
| 592370 | `rimarchevoli` | adj | 0 | plurale di rimarchevole | `rimarchevole` | [rimarchevoli](https://it.wiktionary.org/w/index.php?title=rimarchevoli&oldid=3832460), [rimarchevole](https://it.wiktionary.org/w/index.php?title=rimarchevole&oldid=4064249) |
| 592382 | `distensioni` | noun | 0 | plurale di distensione | `distensione` | [distensioni](https://it.wiktionary.org/w/index.php?title=distensioni&oldid=3835756), [distensione](https://it.wiktionary.org/w/index.php?title=distensione&oldid=3398904) |
| 592399 | `udite` | verb | 1 | seconda persona plurale dell'indicativo presente di udire | `udire` | [udite](https://it.wiktionary.org/w/index.php?title=udite&oldid=3838091), [udire](https://it.wiktionary.org/w/index.php?title=udire&oldid=3692947) |
| 592399 | `udite` | verb | 2 | seconda persona plurale dell'imperativo presente di udire | `udire` | [udite](https://it.wiktionary.org/w/index.php?title=udite&oldid=3838091), [udire](https://it.wiktionary.org/w/index.php?title=udire&oldid=3692947) |
| 592523 | `cerimoniosa` | adj | 0 | femminile di cerimonioso | `cerimonioso` | [cerimoniosa](https://it.wiktionary.org/w/index.php?title=cerimoniosa&oldid=3918330), [cerimonioso](https://it.wiktionary.org/w/index.php?title=cerimonioso&oldid=3906451) |
| 592710 | `quelli` | pron | 0 | plurale di quello | `quello` | [quelli](https://it.wiktionary.org/w/index.php?title=quelli&oldid=3840092), [quello](https://it.wiktionary.org/w/index.php?title=quello&oldid=4042892) |
| 592768 | `clausole` | noun | 0 | plurale di clausola | `clausola` | [clausole](https://it.wiktionary.org/w/index.php?title=clausole&oldid=3840833), [clausola](https://it.wiktionary.org/w/index.php?title=clausola&oldid=3995346) |
| 592778 | `sbieca` | noun | 0 | femminile di sbieco | `sbieco` | [sbieca](https://it.wiktionary.org/w/index.php?title=sbieca&oldid=3918339), [sbieco](https://it.wiktionary.org/w/index.php?title=sbieco&oldid=4048355) |
| 592826 | `atipici` | adj | 0 | plurale di atipico | `atipico` | [atipici](https://it.wiktionary.org/w/index.php?title=atipici&oldid=3841715), [atipico](https://it.wiktionary.org/w/index.php?title=atipico&oldid=3880258) |
| 592827 | `atipiche` | adj | 0 | femminile plurale di atipico | `atipico` | [atipiche](https://it.wiktionary.org/w/index.php?title=atipiche&oldid=3841716), [atipico](https://it.wiktionary.org/w/index.php?title=atipico&oldid=3880258) |
| 592828 | `anormali` | adj | 0 | plurale di anormale | `anormale` | [anormali](https://it.wiktionary.org/w/index.php?title=anormali&oldid=3841717), [anormale](https://it.wiktionary.org/w/index.php?title=anormale&oldid=3627052) |
| 592829 | `anormali` | noun | 0 | plurale di anormale | `anormale` | [anormali](https://it.wiktionary.org/w/index.php?title=anormali&oldid=3841717), [anormale](https://it.wiktionary.org/w/index.php?title=anormale&oldid=3627052) |
| 592832 | `devianti` | adj | 0 | plurale di deviante | `deviante` | [devianti](https://it.wiktionary.org/w/index.php?title=devianti&oldid=3849340), [deviante](https://it.wiktionary.org/w/index.php?title=deviante&oldid=4030759) |
| 592873 | `artiglieri` | noun | 0 | plurale di artigliere | `artigliere` | [artiglieri](https://it.wiktionary.org/w/index.php?title=artiglieri&oldid=3874732), [artigliere](https://it.wiktionary.org/w/index.php?title=artigliere&oldid=3835054) |
| 592884 | `sapesti` | verb | 0 | seconda persona singolare dell'indicativo passato remoto di sapere | `sapere` | [sapesti](https://it.wiktionary.org/w/index.php?title=sapesti&oldid=3842255), [sapere](https://it.wiktionary.org/w/index.php?title=sapere&oldid=4066625) |
| 592966 | `destri` | noun | 0 | plurale di destro | `destro` | [destri](https://it.wiktionary.org/w/index.php?title=destri&oldid=3849333), [destro](https://it.wiktionary.org/w/index.php?title=destro&oldid=3954588) |
| 593042 | `comporti` | verb | 4 | terza persona singolare dell'imperativo presente di comportare | `comportare` | [comporti](https://it.wiktionary.org/w/index.php?title=comporti&oldid=3849255), [comportare](https://it.wiktionary.org/w/index.php?title=comportare&oldid=3972009) |
| 593043 | `stracotti` | adj | 0 | plurale di stracotto | `stracotto` | [stracotti](https://it.wiktionary.org/w/index.php?title=stracotti&oldid=3850164), [stracotto](https://it.wiktionary.org/w/index.php?title=stracotto&oldid=3976236) |
| 593044 | `stracotti` | noun | 0 | plurale di stracotto | `stracotto` | [stracotti](https://it.wiktionary.org/w/index.php?title=stracotti&oldid=3850164), [stracotto](https://it.wiktionary.org/w/index.php?title=stracotto&oldid=3976236) |
| 593064 | `lodigiana` | noun | 0 | femminile di lodigiano | `lodigiano` | [lodigiana](https://it.wiktionary.org/w/index.php?title=lodigiana&oldid=3918348), [lodigiano](https://it.wiktionary.org/w/index.php?title=lodigiano&oldid=4067890) |
| 593270 | `prevedendo` | verb | 0 | gerundio presente di prevedere | `prevedere` | [prevedendo](https://it.wiktionary.org/w/index.php?title=prevedendo&oldid=3872806), [prevedere](https://it.wiktionary.org/w/index.php?title=prevedere&oldid=3893786) |
| 593742 | `sottosviluppati` | adj | 0 | plurale di sottosviluppato | `sottosviluppato` | [sottosviluppati](https://it.wiktionary.org/w/index.php?title=sottosviluppati&oldid=3921003), [sottosviluppato](https://it.wiktionary.org/w/index.php?title=sottosviluppato&oldid=4005849) |
| 593774 | `vanagloriosi` | noun | 0 | plurale di vanaglorioso | `vanaglorioso` | [vanagloriosi](https://it.wiktionary.org/w/index.php?title=vanagloriosi&oldid=3918365), [vanaglorioso](https://it.wiktionary.org/w/index.php?title=vanaglorioso&oldid=4058621) |
| 594612 | `monocordi` | adj | 0 | plurale di monocorde | `monocorde` | [monocordi](https://it.wiktionary.org/w/index.php?title=monocordi&oldid=3852992), [monocorde](https://it.wiktionary.org/w/index.php?title=monocorde&oldid=3852991) |
| 594618 | `stazionarie` | adj | 0 | femminile plurale di stazionario | `stazionario` | [stazionarie](https://it.wiktionary.org/w/index.php?title=stazionarie&oldid=3852999), [stazionario](https://it.wiktionary.org/w/index.php?title=stazionario&oldid=3963517) |
| 594672 | `reclusioni` | noun | 0 | plurale di reclusione | `reclusione` | [reclusioni](https://it.wiktionary.org/w/index.php?title=reclusioni&oldid=3853090), [reclusione](https://it.wiktionary.org/w/index.php?title=reclusione&oldid=3991113) |
| 594725 | `giostraia` | noun | 0 | plurale di giostrai | `giostrai` | [giostraia](https://it.wiktionary.org/w/index.php?title=giostraia&oldid=3867974), [giostrai](https://it.wiktionary.org/w/index.php?title=giostrai&oldid=3867973) |
| 594747 | `giostraie` | noun | 0 | femminile plurale di giostrai | `giostrai` | [giostraie](https://it.wiktionary.org/w/index.php?title=giostraie&oldid=3939226), [giostrai](https://it.wiktionary.org/w/index.php?title=giostrai&oldid=3867973) |
| 594783 | `vanagloriose` | noun | 0 | femminile plurale di vanaglorioso | `vanaglorioso` | [vanagloriose](https://it.wiktionary.org/w/index.php?title=vanagloriose&oldid=3918380), [vanaglorioso](https://it.wiktionary.org/w/index.php?title=vanaglorioso&oldid=4058621) |
| 595129 | `sovvertitori` | noun | 0 | plurale di sovvertitore | `sovvertitore` | [sovvertitori](https://it.wiktionary.org/w/index.php?title=sovvertitori&oldid=4068912), [sovvertitore](https://it.wiktionary.org/w/index.php?title=sovvertitore&oldid=4053264) |
| 595452 | `sapevamo` | verb | 0 | prima persona plurale dell'indicativo imperfetto di sapere | `sapere` | [sapevamo](https://it.wiktionary.org/w/index.php?title=sapevamo&oldid=3857352), [sapere](https://it.wiktionary.org/w/index.php?title=sapere&oldid=4066625) |
| 595532 | `colombiana` | noun | 0 | femminile di colombiano | `colombiano` | [colombiana](https://it.wiktionary.org/w/index.php?title=colombiana&oldid=3857814), [colombiano](https://it.wiktionary.org/w/index.php?title=colombiano&oldid=4031172) |
| 595533 | `piacque` | verb | 0 | terza persona singolare dell'indicativo passato remoto di piacere | `piacere` | [piacque](https://it.wiktionary.org/w/index.php?title=piacque&oldid=3857827), [piacere](https://it.wiktionary.org/w/index.php?title=piacere&oldid=3981533) |
| 595582 | `eleatica` | adj | 0 | femminile di eleatico | `eleatico` | [eleatica](https://it.wiktionary.org/w/index.php?title=eleatica&oldid=3858115), [eleatico](https://it.wiktionary.org/w/index.php?title=eleatico&oldid=3846811) |
| 595608 | `debbo` | verb | 0 | prima persona singolare dell'indicativo presente di dovere | `dovere` | [debbo](https://it.wiktionary.org/w/index.php?title=debbo&oldid=3858479), [dovere](https://it.wiktionary.org/w/index.php?title=dovere&oldid=3987633) |
| 595618 | `tettoie` | noun | 0 | plurale di tettoia | `tettoia` | [tettoie](https://it.wiktionary.org/w/index.php?title=tettoie&oldid=3858753), [tettoia](https://it.wiktionary.org/w/index.php?title=tettoia&oldid=4011778) |
| 595661 | `propizie` | adj | 0 | femminile plurale di propizio | `propizio` | [propizie](https://it.wiktionary.org/w/index.php?title=propizie&oldid=3868561), [propizio](https://it.wiktionary.org/w/index.php?title=propizio&oldid=3952606) |
| 595736 | `mulattiere` | noun | 0 | plurale di mulattiera | `mulattiera` | [mulattiere](https://it.wiktionary.org/w/index.php?title=mulattiere&oldid=3868357), [mulattiera](https://it.wiktionary.org/w/index.php?title=mulattiera&oldid=3949429) |
| 595906 | `soffitti` | noun | 0 | plurale di soffitto | `soffitto` | [soffitti](https://it.wiktionary.org/w/index.php?title=soffitti&oldid=3860033), [soffitto](https://it.wiktionary.org/w/index.php?title=soffitto&oldid=4002171) |
| 596369 | `accaldata` | adj | 0 | femminile di accaldato | `accaldato` | [accaldata](https://it.wiktionary.org/w/index.php?title=accaldata&oldid=3863723), [accaldato](https://it.wiktionary.org/w/index.php?title=accaldato&oldid=3369186) |
| 596659 | `endovenosa` | adj | 0 | femminile di endovenoso | `endovenoso` | [endovenosa](https://it.wiktionary.org/w/index.php?title=endovenosa&oldid=3866582), [endovenoso](https://it.wiktionary.org/w/index.php?title=endovenoso&oldid=3742981) |
| 597092 | `assembleari` | adj | 0 | plurale di assembleare | `assembleare` | [assembleari](https://it.wiktionary.org/w/index.php?title=assembleari&oldid=3920942), [assembleare](https://it.wiktionary.org/w/index.php?title=assembleare&oldid=3872498) |
| 597327 | `taxa` | noun | 0 | plurale di taxon | `taxon` | [taxa](https://it.wiktionary.org/w/index.php?title=taxa&oldid=4007739), [taxon](https://it.wiktionary.org/w/index.php?title=taxon&oldid=3961137) |
| 597799 | `sbieche` | noun | 0 | femminile plurale di sbieco | `sbieco` | [sbieche](https://it.wiktionary.org/w/index.php?title=sbieche&oldid=3920744), [sbieco](https://it.wiktionary.org/w/index.php?title=sbieco&oldid=4048355) |
| 598163 | `decennali` | adj | 0 | plurale di decennale | `decennale` | [decennali](https://it.wiktionary.org/w/index.php?title=decennali&oldid=3880824), [decennale](https://it.wiktionary.org/w/index.php?title=decennale&oldid=3919282) |
| 598176 | `scollacciata` | adj | 0 | femminile di scollacciato | `scollacciato` | [scollacciata](https://it.wiktionary.org/w/index.php?title=scollacciata&oldid=4068085), [scollacciato](https://it.wiktionary.org/w/index.php?title=scollacciato&oldid=4245560) |
| 598977 | `simmetrica` | adj | 0 | femminile di simmetrico | `simmetrico` | [simmetrica](https://it.wiktionary.org/w/index.php?title=simmetrica&oldid=3920916), [simmetrico](https://it.wiktionary.org/w/index.php?title=simmetrico&oldid=3557713) |
| 598978 | `simmetrici` | adj | 0 | plurale di simmetrico | `simmetrico` | [simmetrici](https://it.wiktionary.org/w/index.php?title=simmetrici&oldid=3920917), [simmetrico](https://it.wiktionary.org/w/index.php?title=simmetrico&oldid=3557713) |
| 599171 | `robacce` | noun | 0 | plurale di robaccia | `robaccia` | [robacce](https://it.wiktionary.org/w/index.php?title=robacce&oldid=3886630), [robaccia](https://it.wiktionary.org/w/index.php?title=robaccia&oldid=4066900) |
| 599391 | `rauca` | adj | 0 | femminile di rauco | `rauco` | [rauca](https://it.wiktionary.org/w/index.php?title=rauca&oldid=4046364), [rauco](https://it.wiktionary.org/w/index.php?title=rauco&oldid=4046365) |
| 599425 | `tradizionalisti` | adj | 0 | plurale di tradizionalista | `tradizionalista` | [tradizionalisti](https://it.wiktionary.org/w/index.php?title=tradizionalisti&oldid=3888860), [tradizionalista](https://it.wiktionary.org/w/index.php?title=tradizionalista&oldid=4053268) |
| 599426 | `tradizionalisti` | noun | 0 | plurale di tradizionalista | `tradizionalista` | [tradizionalisti](https://it.wiktionary.org/w/index.php?title=tradizionalisti&oldid=3888860), [tradizionalista](https://it.wiktionary.org/w/index.php?title=tradizionalista&oldid=4053268) |
| 599427 | `tradizionaliste` | adj | 0 | femminile plurale di tradizionalista | `tradizionalista` | [tradizionaliste](https://it.wiktionary.org/w/index.php?title=tradizionaliste&oldid=3921251), [tradizionalista](https://it.wiktionary.org/w/index.php?title=tradizionalista&oldid=4053268) |
| 599428 | `tradizionaliste` | noun | 0 | femminile plurale di tradizionalista | `tradizionalista` | [tradizionaliste](https://it.wiktionary.org/w/index.php?title=tradizionaliste&oldid=3921251), [tradizionalista](https://it.wiktionary.org/w/index.php?title=tradizionalista&oldid=4053268) |
| 599493 | `sonetti` | noun | 0 | plurale di sonetto | `sonetto` | [sonetti](https://it.wiktionary.org/w/index.php?title=sonetti&oldid=3889829), [sonetto](https://it.wiktionary.org/w/index.php?title=sonetto&oldid=3936953) |
| 599524 | `Ostreidi` | noun | 0 | plurale di ostreide | `ostreide` | [Ostreidi](https://it.wiktionary.org/w/index.php?title=Ostreidi&oldid=3989639), [ostreide](https://it.wiktionary.org/w/index.php?title=ostreide&oldid=3919721) |
| 599551 | `duomi` | noun | 0 | plurale di duomo | `duomo` | [duomi](https://it.wiktionary.org/w/index.php?title=duomi&oldid=3909681), [duomo](https://it.wiktionary.org/w/index.php?title=duomo&oldid=4041879) |
| 599608 | `burrascosa` | adj | 0 | femminile di burrascoso | `burrascoso` | [burrascosa](https://it.wiktionary.org/w/index.php?title=burrascosa&oldid=3972443), [burrascoso](https://it.wiktionary.org/w/index.php?title=burrascoso&oldid=4009547) |
| 599719 | `lipomi` | noun | 0 | plurale di lipoma | `lipoma` | [lipomi](https://it.wiktionary.org/w/index.php?title=lipomi&oldid=3922888), [lipoma](https://it.wiktionary.org/w/index.php?title=lipoma&oldid=4007033) |
| 599720 | `mixomi` | noun | 0 | plurale di mixoma | `mixoma` | [mixomi](https://it.wiktionary.org/w/index.php?title=mixomi&oldid=3922889), [mixoma](https://it.wiktionary.org/w/index.php?title=mixoma&oldid=4007032) |
| 599769 | `avicola` | adj | 0 | femminile di avicolo | `avicolo` | [avicola](https://it.wiktionary.org/w/index.php?title=avicola&oldid=3933477), [avicolo](https://it.wiktionary.org/w/index.php?title=avicolo&oldid=3933480) |
| 599770 | `avicoli` | adj | 0 | plurale di avicolo | `avicolo` | [avicoli](https://it.wiktionary.org/w/index.php?title=avicoli&oldid=3933479), [avicolo](https://it.wiktionary.org/w/index.php?title=avicolo&oldid=3933480) |
| 599771 | `avicole` | adj | 0 | femminile plurale di avicolo | `avicolo` | [avicole](https://it.wiktionary.org/w/index.php?title=avicole&oldid=3933478), [avicolo](https://it.wiktionary.org/w/index.php?title=avicolo&oldid=3933480) |
| 599802 | `visigota` | adj | 0 | femminile di visigoto | `visigoto` | [visigota](https://it.wiktionary.org/w/index.php?title=visigota&oldid=3934759), [visigoto](https://it.wiktionary.org/w/index.php?title=visigoto&oldid=4042661) |
| 599803 | `visigota` | noun | 0 | femminile di visigoto | `visigoto` | [visigota](https://it.wiktionary.org/w/index.php?title=visigota&oldid=3934759), [visigoto](https://it.wiktionary.org/w/index.php?title=visigoto&oldid=4042661) |
| 599880 | `nodali` | adj | 0 | plurale di nodale | `nodale` | [nodali](https://it.wiktionary.org/w/index.php?title=nodali&oldid=3934185), [nodale](https://it.wiktionary.org/w/index.php?title=nodale&oldid=4075498) |
| 599881 | `zampogne` | noun | 0 | plurale di zampogna | `zampogna` | [zampogne](https://it.wiktionary.org/w/index.php?title=zampogne&oldid=3924466), [zampogna](https://it.wiktionary.org/w/index.php?title=zampogna&oldid=4011900) |
| 599922 | `rispettiva` | adj | 0 | femminile di rispettivo | `rispettivo` | [rispettiva](https://it.wiktionary.org/w/index.php?title=rispettiva&oldid=3934423), [rispettivo](https://it.wiktionary.org/w/index.php?title=rispettivo&oldid=3611031) |
| 599974 | `vetuste` | adj | 0 | femminile plurale di vetusto | `vetusto` | [vetuste](https://it.wiktionary.org/w/index.php?title=vetuste&oldid=3934747), [vetusto](https://it.wiktionary.org/w/index.php?title=vetusto&oldid=4048253) |
| 600253 | `sotterranei` | adj | 0 | plurale di sotterraneo | `sotterraneo` | [sotterranei](https://it.wiktionary.org/w/index.php?title=sotterranei&oldid=4097139), [sotterraneo](https://it.wiktionary.org/w/index.php?title=sotterraneo&oldid=4058525) |
| 600742 | `comizianti` | noun | 0 | plurale di comiziante | `comiziante` | [comizianti](https://it.wiktionary.org/w/index.php?title=comizianti&oldid=3933628), [comiziante](https://it.wiktionary.org/w/index.php?title=comiziante&oldid=3933627) |
| 600839 | `vicari` | noun | 0 | plurale di vicario | `vicario` | [vicari](https://it.wiktionary.org/w/index.php?title=vicari&oldid=4056195), [vicario](https://it.wiktionary.org/w/index.php?title=vicario&oldid=3652528) |
| 600857 | `microbi` | noun | 0 | plurale di microbo | `microbo` | [microbi](https://it.wiktionary.org/w/index.php?title=microbi&oldid=3931649), [microbo](https://it.wiktionary.org/w/index.php?title=microbo&oldid=4201863) |
| 600878 | `corsive` | adj | 0 | femminile plurale di corsivo | `corsivo` | [corsive](https://it.wiktionary.org/w/index.php?title=corsive&oldid=3933667), [corsivo](https://it.wiktionary.org/w/index.php?title=corsivo&oldid=3970769) |
| 600905 | `anteroposteriori` | adj | 0 | plurale di anteroposteriore | `anteroposteriore` | [anteroposteriori](https://it.wiktionary.org/w/index.php?title=anteroposteriori&oldid=3931825), [anteroposteriore](https://it.wiktionary.org/w/index.php?title=anteroposteriore&oldid=3933428) |
| 601288 | `espansionismi` | noun | 0 | plurale di espansionismo | `espansionismo` | [espansionismi](https://it.wiktionary.org/w/index.php?title=espansionismi&oldid=3935513), [espansionismo](https://it.wiktionary.org/w/index.php?title=espansionismo&oldid=3835900) |
| 601614 | `milionari` | adj | 0 | plurale di milionario | `milionario` | [milionari](https://it.wiktionary.org/w/index.php?title=milionari&oldid=3938149), [milionario](https://it.wiktionary.org/w/index.php?title=milionario&oldid=3950667) |
| 601743 | `bubbonica` | adj | 0 | femminile di bubbonico | `bubbonico` | [bubbonica](https://it.wiktionary.org/w/index.php?title=bubbonica&oldid=3938834), [bubbonico](https://it.wiktionary.org/w/index.php?title=bubbonico&oldid=3693839) |
| 602075 | `malvoni` | noun | 0 | plurale di malvone | `malvone` | [malvoni](https://it.wiktionary.org/w/index.php?title=malvoni&oldid=3941402), [malvone](https://it.wiktionary.org/w/index.php?title=malvone&oldid=4016815) |
| 602223 | `disumane` | adj | 0 | femminile plurale di disumano | `disumano` | [disumane](https://it.wiktionary.org/w/index.php?title=disumane&oldid=3942548), [disumano](https://it.wiktionary.org/w/index.php?title=disumano&oldid=4077085) |
| 602625 | `globose` | adj | 0 | femminile plurale di globoso | `globoso` | [globose](https://it.wiktionary.org/w/index.php?title=globose&oldid=3944601), [globoso](https://it.wiktionary.org/w/index.php?title=globoso&oldid=3836150) |
| 602980 | `avvelenatrice` | noun | 0 | femminile di avvelenatore | `avvelenatore` | [avvelenatrice](https://it.wiktionary.org/w/index.php?title=avvelenatrice&oldid=3946499), [avvelenatore](https://it.wiktionary.org/w/index.php?title=avvelenatore&oldid=3632966) |
| 603062 | `maestranze` | noun | 0 | plurale di maestranza | `maestranza` | [maestranze](https://it.wiktionary.org/w/index.php?title=maestranze&oldid=4005766), [maestranza](https://it.wiktionary.org/w/index.php?title=maestranza&oldid=4005765) |
| 603291 | `inavveduti` | adj | 0 | plurale di inavveduto | `inavveduto` | [inavveduti](https://it.wiktionary.org/w/index.php?title=inavveduti&oldid=3947842), [inavveduto](https://it.wiktionary.org/w/index.php?title=inavveduto&oldid=3675057) |
| 603915 | `pediatri` | noun | 0 | plurale di pediatra | `pediatra` | [pediatri](https://it.wiktionary.org/w/index.php?title=pediatri&oldid=3950078), [pediatra](https://it.wiktionary.org/w/index.php?title=pediatra&oldid=3926131) |
| 604022 | `neonatologi` | noun | 0 | plurale di neonatologo | `neonatologo` | [neonatologi](https://it.wiktionary.org/w/index.php?title=neonatologi&oldid=3950368), [neonatologo](https://it.wiktionary.org/w/index.php?title=neonatologo&oldid=3993023) |
| 604464 | `alfanumerici` | adj | 0 | plurale di alfanumerico | `alfanumerico` | [alfanumerici](https://it.wiktionary.org/w/index.php?title=alfanumerici&oldid=3952022), [alfanumerico](https://it.wiktionary.org/w/index.php?title=alfanumerico&oldid=4014125) |
| 604526 | `dovremmo` | verb | 0 | prima persona plurale del condizionale presente di dovere | `dovere` | [dovremmo](https://it.wiktionary.org/w/index.php?title=dovremmo&oldid=3952359), [dovere](https://it.wiktionary.org/w/index.php?title=dovere&oldid=3987633) |
| 604673 | `proprietari` | noun | 0 | plurale di proprietario | `proprietario` | [proprietari](https://it.wiktionary.org/w/index.php?title=proprietari&oldid=3953176), [proprietario](https://it.wiktionary.org/w/index.php?title=proprietario&oldid=3993725) |
| 604674 | `proprietaria` | noun | 0 | femminile di proprietario | `proprietario` | [proprietaria](https://it.wiktionary.org/w/index.php?title=proprietaria&oldid=3960740), [proprietario](https://it.wiktionary.org/w/index.php?title=proprietario&oldid=3993725) |
| 604714 | `compié` | verb | 0 | terza persona singolare dell'indicativo passato remoto di compiere | `compiere` | [compié](https://it.wiktionary.org/w/index.php?title=compi%C3%A9&oldid=3953610), [compiere](https://it.wiktionary.org/w/index.php?title=compiere&oldid=3996312) |
| 604882 | `semiliquidi` | adj | 0 | plurale di semiliquido | `semiliquido` | [semiliquidi](https://it.wiktionary.org/w/index.php?title=semiliquidi&oldid=3955343), [semiliquido](https://it.wiktionary.org/w/index.php?title=semiliquido&oldid=3506496) |
| 605173 | `bucanieri` | noun | 0 | plurale di bucaniere | `bucaniere` | [bucanieri](https://it.wiktionary.org/w/index.php?title=bucanieri&oldid=3956057), [bucaniere](https://it.wiktionary.org/w/index.php?title=bucaniere&oldid=3956058) |
| 605175 | `bucaniera` | noun | 0 | plurale di bucaniere | `bucaniere` | [bucaniera](https://it.wiktionary.org/w/index.php?title=bucaniera&oldid=3956059), [bucaniere](https://it.wiktionary.org/w/index.php?title=bucaniere&oldid=3956058) |
| 605283 | `farmacologica` | adj | 0 | femminile di farmacologico | `farmacologico` | [farmacologica](https://it.wiktionary.org/w/index.php?title=farmacologica&oldid=3957234), [farmacologico](https://it.wiktionary.org/w/index.php?title=farmacologico&oldid=3903915) |
| 605296 | `geologa` | noun | 0 | femminile di geologo | `geologo` | [geologa](https://it.wiktionary.org/w/index.php?title=geologa&oldid=3957746), [geologo](https://it.wiktionary.org/w/index.php?title=geologo&oldid=4001439) |
| 605376 | `tossica` | adj | 0 | femminile di tossico | `tossico` | [tossica](https://it.wiktionary.org/w/index.php?title=tossica&oldid=3958586), [tossico](https://it.wiktionary.org/w/index.php?title=tossico&oldid=4059582) |
| 605458 | `scabrosi` | adj | 0 | plurale di scabroso | `scabroso` | [scabrosi](https://it.wiktionary.org/w/index.php?title=scabrosi&oldid=3959264), [scabroso](https://it.wiktionary.org/w/index.php?title=scabroso&oldid=3869509) |
| 605504 | `distensive` | adj | 0 | femminile plurale di distensivo | `distensivo` | [distensive](https://it.wiktionary.org/w/index.php?title=distensive&oldid=3959427), [distensivo](https://it.wiktionary.org/w/index.php?title=distensivo&oldid=3989995) |
| 605576 | `hawaiana` | adj | 0 | femminile di hawaiano | `hawaiano` | [hawaiana](https://it.wiktionary.org/w/index.php?title=hawaiana&oldid=3960285), [hawaiano](https://it.wiktionary.org/w/index.php?title=hawaiano&oldid=3735932) |
| 605618 | `atte` | adj | 0 | femminile plurale di atto | `atto` | [atte](https://it.wiktionary.org/w/index.php?title=atte&oldid=3960575), [atto](https://it.wiktionary.org/w/index.php?title=atto&oldid=4043224) |
| 605647 | `asessuata` | adj | 0 | femminile di asessuato | `asessuato` | [asessuata](https://it.wiktionary.org/w/index.php?title=asessuata&oldid=3960853), [asessuato](https://it.wiktionary.org/w/index.php?title=asessuato&oldid=3842795) |
| 605696 | `incastellature` | noun | 0 | plurale di incastellatura | `incastellatura` | [incastellature](https://it.wiktionary.org/w/index.php?title=incastellature&oldid=3961915), [incastellatura](https://it.wiktionary.org/w/index.php?title=incastellatura&oldid=3868054) |
| 605723 | `pseudoscientifica` | adj | 0 | femminile di pseudoscientifico | `pseudoscientifico` | [pseudoscientifica](https://it.wiktionary.org/w/index.php?title=pseudoscientifica&oldid=3962520), [pseudoscientifico](https://it.wiktionary.org/w/index.php?title=pseudoscientifico&oldid=3869599) |
| 605724 | `gerarchica` | adj | 0 | femminile di gerarchico | `gerarchico` | [gerarchica](https://it.wiktionary.org/w/index.php?title=gerarchica&oldid=3962522), [gerarchico](https://it.wiktionary.org/w/index.php?title=gerarchico&oldid=3906397) |
| 605784 | `programmatrice` | noun | 0 | femminile di programmatore | `programmatore` | [programmatrice](https://it.wiktionary.org/w/index.php?title=programmatrice&oldid=3963474), [programmatore](https://it.wiktionary.org/w/index.php?title=programmatore&oldid=3963473) |
| 605877 | `mammarie` | adj | 0 | femminile plurale di mammario | `mammario` | [mammarie](https://it.wiktionary.org/w/index.php?title=mammarie&oldid=3963836), [mammario](https://it.wiktionary.org/w/index.php?title=mammario&oldid=3963835) |
| 605983 | `psicoattiva` | adj | 0 | femminile di psicoattivo | `psicoattivo` | [psicoattiva](https://it.wiktionary.org/w/index.php?title=psicoattiva&oldid=3965481), [psicoattivo](https://it.wiktionary.org/w/index.php?title=psicoattivo&oldid=3744786) |
| 606010 | `teologica` | adj | 0 | femminile di teologico | `teologico` | [teologica](https://it.wiktionary.org/w/index.php?title=teologica&oldid=3965887), [teologico](https://it.wiktionary.org/w/index.php?title=teologico&oldid=3906561) |
| 606060 | `calcagni` | noun | 0 | plurale di calcagno | `calcagno` | [calcagni](https://it.wiktionary.org/w/index.php?title=calcagni&oldid=3975214), [calcagno](https://it.wiktionary.org/w/index.php?title=calcagno&oldid=4003813) |
| 606152 | `castani` | noun | 0 | plurale di castano | `castano` | [castani](https://it.wiktionary.org/w/index.php?title=castani&oldid=3966880), [castano](https://it.wiktionary.org/w/index.php?title=castano&oldid=3797016) |
| 606286 | `aviatrici` | noun | 0 | femminile plurale di aviatore | `aviatore` | [aviatrici](https://it.wiktionary.org/w/index.php?title=aviatrici&oldid=3967868), [aviatore](https://it.wiktionary.org/w/index.php?title=aviatore&oldid=4028216) |
| 606320 | `elicotteriste` | noun | 0 | femminile plurale di elicotterista | `elicotterista` | [elicotteriste](https://it.wiktionary.org/w/index.php?title=elicotteriste&oldid=4031979), [elicotterista](https://it.wiktionary.org/w/index.php?title=elicotterista&oldid=3967978) |
| 606339 | `figurativa` | adj | 0 | femminile di figurativo | `figurativo` | [figurativa](https://it.wiktionary.org/w/index.php?title=figurativa&oldid=3968067), [figurativo](https://it.wiktionary.org/w/index.php?title=figurativo&oldid=4040813) |
| 606427 | `camioniste` | noun | 0 | femminile plurale di camionista | `camionista` | [camioniste](https://it.wiktionary.org/w/index.php?title=camioniste&oldid=3968856), [camionista](https://it.wiktionary.org/w/index.php?title=camionista&oldid=3968855) |
| 606430 | `lanciatrice` | noun | 0 | femminile di lanciatore | `lanciatore` | [lanciatrice](https://it.wiktionary.org/w/index.php?title=lanciatrice&oldid=3968870), [lanciatore](https://it.wiktionary.org/w/index.php?title=lanciatore&oldid=4017558) |
| 606431 | `battitrice` | noun | 0 | femminile di battitore | `battitore` | [battitrice](https://it.wiktionary.org/w/index.php?title=battitrice&oldid=3968872), [battitore](https://it.wiktionary.org/w/index.php?title=battitore&oldid=4017303) |
| 606481 | `cantautrice` | noun | 0 | femminile di cantautore | `cantautore` | [cantautrice](https://it.wiktionary.org/w/index.php?title=cantautrice&oldid=4047677), [cantautore](https://it.wiktionary.org/w/index.php?title=cantautore&oldid=4248056) |
| 606485 | `fotomodella` | noun | 0 | femminile di fotomodello | `fotomodello` | [fotomodella](https://it.wiktionary.org/w/index.php?title=fotomodella&oldid=3999255), [fotomodello](https://it.wiktionary.org/w/index.php?title=fotomodello&oldid=3969503) |
| 606701 | `luccichii` | noun | 0 | plurale di luccichio | `luccichio` | [luccichii](https://it.wiktionary.org/w/index.php?title=luccichii&oldid=3972813), [luccichio](https://it.wiktionary.org/w/index.php?title=luccichio&oldid=4013512) |
| 606702 | `lampeggiamenti` | noun | 0 | plurale di lampeggiamento | `lampeggiamento` | [lampeggiamenti](https://it.wiktionary.org/w/index.php?title=lampeggiamenti&oldid=3972814), [lampeggiamento](https://it.wiktionary.org/w/index.php?title=lampeggiamento&oldid=3996959) |
| 606776 | `sommaria` | adj | 0 | femminile di sommario | `sommario` | [sommaria](https://it.wiktionary.org/w/index.php?title=sommaria&oldid=4069551), [sommario](https://it.wiktionary.org/w/index.php?title=sommario&oldid=3945286) |
| 607002 | `carpentiera` | noun | 0 | femminile di carpentiere | `carpentiere` | [carpentiera](https://it.wiktionary.org/w/index.php?title=carpentiera&oldid=3975792), [carpentiere](https://it.wiktionary.org/w/index.php?title=carpentiere&oldid=4031988) |
| 607070 | `indulgenze` | noun | 0 | plurale di indulgenza | `indulgenza` | [indulgenze](https://it.wiktionary.org/w/index.php?title=indulgenze&oldid=3976746), [indulgenza](https://it.wiktionary.org/w/index.php?title=indulgenza&oldid=3990750) |
| 607075 | `prati` | noun | 0 | plurale di prato | `prato` | [prati](https://it.wiktionary.org/w/index.php?title=prati&oldid=3976761), [prato](https://it.wiktionary.org/w/index.php?title=prato&oldid=3894748) |
| 607112 | `tarassachi` | noun | 0 | plurale di tarassaco | `tarassaco` | [tarassachi](https://it.wiktionary.org/w/index.php?title=tarassachi&oldid=3977078), [tarassaco](https://it.wiktionary.org/w/index.php?title=tarassaco&oldid=4025854) |
| 609948 | `subacquea` | adj | 0 | femminile di subacqueo | `subacqueo` | [subacquea](https://it.wiktionary.org/w/index.php?title=subacquea&oldid=3987927), [subacqueo](https://it.wiktionary.org/w/index.php?title=subacqueo&oldid=3792074) |
| 609992 | `chirurga` | noun | 0 | femminile di chirurgo | `chirurgo` | [chirurga](https://it.wiktionary.org/w/index.php?title=chirurga&oldid=3988363), [chirurgo](https://it.wiktionary.org/w/index.php?title=chirurgo&oldid=4005410) |
| 610041 | `pretensioni` | noun | 0 | plurale di pretensione | `pretensione` | [pretensioni](https://it.wiktionary.org/w/index.php?title=pretensioni&oldid=3988828), [pretensione](https://it.wiktionary.org/w/index.php?title=pretensione&oldid=3988827) |
| 610042 | `alterigie` | noun | 0 | plurale di alterigia | `alterigia` | [alterigie](https://it.wiktionary.org/w/index.php?title=alterigie&oldid=3988829), [alterigia](https://it.wiktionary.org/w/index.php?title=alterigia&oldid=3900333) |
| 610060 | `semidei` | noun | 0 | plurale di semidio | `semidio` | [semidei](https://it.wiktionary.org/w/index.php?title=semidei&oldid=3989171), [semidio](https://it.wiktionary.org/w/index.php?title=semidio&oldid=4068643) |
| 610882 | `discorsiva` | adj | 0 | femminile di discorsivo | `discorsivo` | [discorsiva](https://it.wiktionary.org/w/index.php?title=discorsiva&oldid=3992776), [discorsivo](https://it.wiktionary.org/w/index.php?title=discorsivo&oldid=4052856) |
| 611108 | `attoriali` | adj | 0 | plurale di attoriale | `attoriale` | [attoriali](https://it.wiktionary.org/w/index.php?title=attoriali&oldid=3994040), [attoriale](https://it.wiktionary.org/w/index.php?title=attoriale&oldid=4051304) |
| 611364 | `elettriciste` | noun | 0 | femminile plurale di elettricista | `elettricista` | [elettriciste](https://it.wiktionary.org/w/index.php?title=elettriciste&oldid=3996332), [elettricista](https://it.wiktionary.org/w/index.php?title=elettricista&oldid=3966687) |
| 611365 | `idrauliche` | adj | 0 | femminile plurale di idraulico | `idraulico` | [idrauliche](https://it.wiktionary.org/w/index.php?title=idrauliche&oldid=3996331), [idraulico](https://it.wiktionary.org/w/index.php?title=idraulico&oldid=4055244) |
| 611366 | `idrauliche` | noun | 0 | femminile plurale di idraulico | `idraulico` | [idrauliche](https://it.wiktionary.org/w/index.php?title=idrauliche&oldid=3996331), [idraulico](https://it.wiktionary.org/w/index.php?title=idraulico&oldid=4055244) |
| 611444 | `espungo` | verb | 0 | prima persona singolare dell'indicativo presente di espungere | `espungere` | [espungo](https://it.wiktionary.org/w/index.php?title=espungo&oldid=3997274), [espungere](https://it.wiktionary.org/w/index.php?title=espungere&oldid=4048532) |
| 611766 | `cianfrusaglie` | noun | 0 | plurale di cianfrusaglia | `cianfrusaglia` | [cianfrusaglie](https://it.wiktionary.org/w/index.php?title=cianfrusaglie&oldid=4001300), [cianfrusaglia](https://it.wiktionary.org/w/index.php?title=cianfrusaglia&oldid=3922668) |
| 612215 | `siede` | verb | 0 | terza persona singolare dell'indicativo presente di sedere | `sedere` | [siede](https://it.wiktionary.org/w/index.php?title=siede&oldid=4004563), [sedere](https://it.wiktionary.org/w/index.php?title=sedere&oldid=4029969) |
| 612274 | `offrirò` | verb | 0 | prima persona singolare dell'indicativo futuro semplice di offrire | `offrire` | [offrirò](https://it.wiktionary.org/w/index.php?title=offrir%C3%B2&oldid=4005014), [offrire](https://it.wiktionary.org/w/index.php?title=offrire&oldid=4013049) |
| 612362 | `fondatrice` | noun | 0 | femminile di fondatore | `fondatore` | [fondatrice](https://it.wiktionary.org/w/index.php?title=fondatrice&oldid=4005408), [fondatore](https://it.wiktionary.org/w/index.php?title=fondatore&oldid=3993133) |
| 612861 | `membranose` | adj | 0 | femminile plurale di membranoso | `membranoso` | [membranose](https://it.wiktionary.org/w/index.php?title=membranose&oldid=4007991), [membranoso](https://it.wiktionary.org/w/index.php?title=membranoso&oldid=4007990) |
| 613704 | `sottace` | verb | 0 | terza persona singolare dell'indicativo presente di sottacere | `sottacere` | [sottace](https://it.wiktionary.org/w/index.php?title=sottace&oldid=4011428), [sottacere](https://it.wiktionary.org/w/index.php?title=sottacere&oldid=4011429) |
| 613988 | `pungi` | verb | 0 | seconda persona singolare dell'indicativo presente di pungere | `pungere` | [pungi](https://it.wiktionary.org/w/index.php?title=pungi&oldid=4012973), [pungere](https://it.wiktionary.org/w/index.php?title=pungere&oldid=3941051) |
| 613988 | `pungi` | verb | 1 | seconda persona singolare dell'imperativo presente di pungere | `pungere` | [pungi](https://it.wiktionary.org/w/index.php?title=pungi&oldid=4012973), [pungere](https://it.wiktionary.org/w/index.php?title=pungere&oldid=3941051) |
| 614288 | `gentilizi` | adj | 0 | plurale di gentilizio | `gentilizio` | [gentilizi](https://it.wiktionary.org/w/index.php?title=gentilizi&oldid=4014634), [gentilizio](https://it.wiktionary.org/w/index.php?title=gentilizio&oldid=3974090) |
| 615146 | `picciotti` | noun | 0 | plurale di picciotto | `picciotto` | [picciotti](https://it.wiktionary.org/w/index.php?title=picciotti&oldid=4070286), [picciotto](https://it.wiktionary.org/w/index.php?title=picciotto&oldid=3896538) |
| 615178 | `lecitine` | noun | 0 | plurale di lecitina | `lecitina` | [lecitine](https://it.wiktionary.org/w/index.php?title=lecitine&oldid=4020648), [lecitina](https://it.wiktionary.org/w/index.php?title=lecitina&oldid=4020645) |
| 615245 | `ranuncoli` | noun | 0 | plurale di ranuncolo; la sua classificazione scientifica è Ranunculus acer ( tassonomia) | `ranuncolo` | [ranuncoli](https://it.wiktionary.org/w/index.php?title=ranuncoli&oldid=4021267), [ranuncolo](https://it.wiktionary.org/w/index.php?title=ranuncolo&oldid=4025266) |
| 615331 | `vecce` | noun | 0 | plurale di veccia; la sua classificazione scientifica è Vicia sativa ( tassonomia) | `veccia` | [vecce](https://it.wiktionary.org/w/index.php?title=vecce&oldid=4022182), [veccia](https://it.wiktionary.org/w/index.php?title=veccia&oldid=4021358) |
| 615406 | `eucalipti` | noun | 0 | plurale di eucalipto | `eucalipto` | [eucalipti](https://it.wiktionary.org/w/index.php?title=eucalipti&oldid=4023041), [eucalipto](https://it.wiktionary.org/w/index.php?title=eucalipto&oldid=4023042) |
| 616507 | `saponarie` | noun | 0 | plurale di saponaria | `saponaria` | [saponarie](https://it.wiktionary.org/w/index.php?title=saponarie&oldid=4026997), [saponaria](https://it.wiktionary.org/w/index.php?title=saponaria&oldid=4249573) |
| 616514 | `cicerchie` | noun | 0 | plurale di cicerchia; la sua classificazione scientifica è Lathyrus sativus ( tassonomia) | `cicerchia` | [cicerchie](https://it.wiktionary.org/w/index.php?title=cicerchie&oldid=4026481), [cicerchia](https://it.wiktionary.org/w/index.php?title=cicerchia&oldid=4203029) |
| 616597 | `consessi` | noun | 0 | plurale di consesso | `consesso` | [consessi](https://it.wiktionary.org/w/index.php?title=consessi&oldid=4027008), [consesso](https://it.wiktionary.org/w/index.php?title=consesso&oldid=3851548) |
| 617313 | `protodiaconi` | noun | 0 | plurale di protodiacono | `protodiacono` | [protodiaconi](https://it.wiktionary.org/w/index.php?title=protodiaconi&oldid=4028265), [protodiacono](https://it.wiktionary.org/w/index.php?title=protodiacono&oldid=4028210) |
| 618628 | `certosini` | noun | 0 | plurale di certosino | `certosino` | [certosini](https://it.wiktionary.org/w/index.php?title=certosini&oldid=4030225), [certosino](https://it.wiktionary.org/w/index.php?title=certosino&oldid=4033118) |
| 621170 | `scemenze` | noun | 0 | plurale di scemenza | `scemenza` | [scemenze](https://it.wiktionary.org/w/index.php?title=scemenze&oldid=4035448), [scemenza](https://it.wiktionary.org/w/index.php?title=scemenza&oldid=3710551) |
| 621745 | `divelta` | adj | 0 | femminile di divelto | `divelto` | [divelta](https://it.wiktionary.org/w/index.php?title=divelta&oldid=4037242), [divelto](https://it.wiktionary.org/w/index.php?title=divelto&oldid=3932611) |
| 622011 | `cioccolati` | noun | 0 | Plurale di cioccolato | `cioccolato` | [cioccolati](https://it.wiktionary.org/w/index.php?title=cioccolati&oldid=4038421), [cioccolato](https://it.wiktionary.org/w/index.php?title=cioccolato&oldid=4038422) |
| 622063 | `rocchetti` | noun | 0 | Plurale di rocchetto | `rocchetto` | [rocchetti](https://it.wiktionary.org/w/index.php?title=rocchetti&oldid=4038615), [rocchetto](https://it.wiktionary.org/w/index.php?title=rocchetto&oldid=4029917) |
| 622270 | `fortunelle` | noun | 0 | Plurale di fortunella | `fortunella` | [fortunelle](https://it.wiktionary.org/w/index.php?title=fortunelle&oldid=4039680), [fortunella](https://it.wiktionary.org/w/index.php?title=fortunella&oldid=4028357) |
| 622278 | `pompelmi` | noun | 0 | Plurale di pompelmo | `pompelmo` | [pompelmi](https://it.wiktionary.org/w/index.php?title=pompelmi&oldid=4039724), [pompelmo](https://it.wiktionary.org/w/index.php?title=pompelmo&oldid=4023991) |
| 622418 | `vampira` | noun | 0 | femminile di vampiro | `vampiro` | [vampira](https://it.wiktionary.org/w/index.php?title=vampira&oldid=4040448), [vampiro](https://it.wiktionary.org/w/index.php?title=vampiro&oldid=4040500) |
| 622627 | `callistenie` | noun | 0 | Plurale di callistenia | `callistenia` | [callistenie](https://it.wiktionary.org/w/index.php?title=callistenie&oldid=4041451), [callistenia](https://it.wiktionary.org/w/index.php?title=callistenia&oldid=4056684) |
| 622631 | `malformativa` | adj | 0 | femminile di malformativo | `malformativo` | [malformativa](https://it.wiktionary.org/w/index.php?title=malformativa&oldid=4041523), [malformativo](https://it.wiktionary.org/w/index.php?title=malformativo&oldid=4041522) |
| 622632 | `malformative` | adj | 0 | femminile plurale di malformativo | `malformativo` | [malformative](https://it.wiktionary.org/w/index.php?title=malformative&oldid=4041524), [malformativo](https://it.wiktionary.org/w/index.php?title=malformativo&oldid=4041522) |
| 622687 | `autoservizi` | noun | 0 | Plurale di autoservizio | `autoservizio` | [autoservizi](https://it.wiktionary.org/w/index.php?title=autoservizi&oldid=4041857), [autoservizio](https://it.wiktionary.org/w/index.php?title=autoservizio&oldid=4041851) |
| 623667 | `svizzerine` | noun | 0 | plurale di svizzerina | `svizzerina` | [svizzerine](https://it.wiktionary.org/w/index.php?title=svizzerine&oldid=4044555), [svizzerina](https://it.wiktionary.org/w/index.php?title=svizzerina&oldid=4044554) |
| 623668 | `amburghesi` | noun | 0 | plurale di amburghese | `amburghese` | [amburghesi](https://it.wiktionary.org/w/index.php?title=amburghesi&oldid=4044556), [amburghese](https://it.wiktionary.org/w/index.php?title=amburghese&oldid=3998428) |
| 623669 | `svizzeri` | noun | 0 | plurale di svizzero | `svizzero` | [svizzeri](https://it.wiktionary.org/w/index.php?title=svizzeri&oldid=4044557), [svizzero](https://it.wiktionary.org/w/index.php?title=svizzero&oldid=4043857) |
| 623670 | `svizzere` | noun | 0 | plurale di svizzera | `svizzera` | [svizzere](https://it.wiktionary.org/w/index.php?title=svizzere&oldid=4044558), [svizzera](https://it.wiktionary.org/w/index.php?title=svizzera&oldid=3991804) |
| 623671 | `medaglioni` | noun | 0 | plurale di medaglione | `medaglione` | [medaglioni](https://it.wiktionary.org/w/index.php?title=medaglioni&oldid=4044559), [medaglione](https://it.wiktionary.org/w/index.php?title=medaglione&oldid=4032977) |
| 624014 | `superette` | noun | 0 | Plurale di superetta | `superetta` | [superette](https://it.wiktionary.org/w/index.php?title=superette&oldid=4045344), [superetta](https://it.wiktionary.org/w/index.php?title=superetta&oldid=4062256) |
| 624044 | `gronde` | noun | 0 | plurale di gronda | `gronda` | [gronde](https://it.wiktionary.org/w/index.php?title=gronde&oldid=4045802), [gronda](https://it.wiktionary.org/w/index.php?title=gronda&oldid=3977309) |
| 624141 | `bancali` | noun | 0 | plurale di bancale | `bancale` | [bancali](https://it.wiktionary.org/w/index.php?title=bancali&oldid=4047020), [bancale](https://it.wiktionary.org/w/index.php?title=bancale&oldid=4047018) |
| 624156 | `favoni` | noun | 0 | plurale di favonio | `favonio` | [favoni](https://it.wiktionary.org/w/index.php?title=favoni&oldid=4047065), [favonio](https://it.wiktionary.org/w/index.php?title=favonio&oldid=3984854) |
| 624196 | `fratercule` | noun | 0 | Plurale di fratercula | `fratercula` | [fratercule](https://it.wiktionary.org/w/index.php?title=fratercule&oldid=4047750), [fratercula](https://it.wiktionary.org/w/index.php?title=fratercula&oldid=3757000) |
| 624325 | `mezzoradi` | noun | 0 | plurale di mezzorado | `mezzorado` | [mezzoradi](https://it.wiktionary.org/w/index.php?title=mezzoradi&oldid=4048868), [mezzorado](https://it.wiktionary.org/w/index.php?title=mezzorado&oldid=4048867) |
| 624327 | `strucoli` | noun | 0 | plurale di strucolo | `strucolo` | [strucoli](https://it.wiktionary.org/w/index.php?title=strucoli&oldid=4048871), [strucolo](https://it.wiktionary.org/w/index.php?title=strucolo&oldid=4048872) |
| 624348 | `esorcisti` | noun | 0 | plurale di esorcista | `esorcista` | [esorcisti](https://it.wiktionary.org/w/index.php?title=esorcisti&oldid=4049060), [esorcista](https://it.wiktionary.org/w/index.php?title=esorcista&oldid=4049059) |
| 624363 | `acquaerobiche` | noun | 0 | Plurale di acquaerobica | `acquaerobica` | [acquaerobiche](https://it.wiktionary.org/w/index.php?title=acquaerobiche&oldid=4049169), [acquaerobica](https://it.wiktionary.org/w/index.php?title=acquaerobica&oldid=4049171) |
| 624364 | `idroginnastiche` | noun | 0 | Plurale di idroginnastica | `idroginnastica` | [idroginnastiche](https://it.wiktionary.org/w/index.php?title=idroginnastiche&oldid=4049170), [idroginnastica](https://it.wiktionary.org/w/index.php?title=idroginnastica&oldid=4174510) |
| 624367 | `acquaginnastiche` | noun | 0 | Plurale di acquaginnastica | `acquaginnastica` | [acquaginnastiche](https://it.wiktionary.org/w/index.php?title=acquaginnastiche&oldid=4049176), [acquaginnastica](https://it.wiktionary.org/w/index.php?title=acquaginnastica&oldid=4049175) |
| 624368 | `idroaerobiche` | noun | 0 | Plurale di idroaerobica | `idroaerobica` | [idroaerobiche](https://it.wiktionary.org/w/index.php?title=idroaerobiche&oldid=4049177), [idroaerobica](https://it.wiktionary.org/w/index.php?title=idroaerobica&oldid=4049174) |
| 624609 | `scansionatori` | noun | 0 | plurale di scansionatore | `scansionatore` | [scansionatori](https://it.wiktionary.org/w/index.php?title=scansionatori&oldid=4050912), [scansionatore](https://it.wiktionary.org/w/index.php?title=scansionatore&oldid=4052205) |
| 624611 | `tracciatori` | noun | 0 | plurale di tracciatore | `tracciatore` | [tracciatori](https://it.wiktionary.org/w/index.php?title=tracciatori&oldid=4050916), [tracciatore](https://it.wiktionary.org/w/index.php?title=tracciatore&oldid=4050951) |
| 624614 | `diagrammatori` | noun | 0 | plurale di diagrammatore | `diagrammatore` | [diagrammatori](https://it.wiktionary.org/w/index.php?title=diagrammatori&oldid=4050921), [diagrammatore](https://it.wiktionary.org/w/index.php?title=diagrammatore&oldid=4050952) |
| 624615 | `graficatori` | noun | 0 | plurale di graficatore | `graficatore` | [graficatori](https://it.wiktionary.org/w/index.php?title=graficatori&oldid=4050922), [graficatore](https://it.wiktionary.org/w/index.php?title=graficatore&oldid=4055414) |
| 624620 | `telecopiatrici` | noun | 0 | plurale di telecopiatrice | `telecopiatrice` | [telecopiatrici](https://it.wiktionary.org/w/index.php?title=telecopiatrici&oldid=4050933), [telecopiatrice](https://it.wiktionary.org/w/index.php?title=telecopiatrice&oldid=4050932) |
| 624621 | `telecopiatori` | noun | 0 | plurale di telecopiatore | `telecopiatore` | [telecopiatori](https://it.wiktionary.org/w/index.php?title=telecopiatori&oldid=4050934), [telecopiatore](https://it.wiktionary.org/w/index.php?title=telecopiatore&oldid=4050930) |
| 624622 | `telecopie` | noun | 0 | plurale di telecopia | `telecopia` | [telecopie](https://it.wiktionary.org/w/index.php?title=telecopie&oldid=4050935), [telecopia](https://it.wiktionary.org/w/index.php?title=telecopia&oldid=4050926) |
| 624623 | `telecopiature` | noun | 0 | plurale di telecopiatura | `telecopiatura` | [telecopiature](https://it.wiktionary.org/w/index.php?title=telecopiature&oldid=4050936), [telecopiatura](https://it.wiktionary.org/w/index.php?title=telecopiatura&oldid=4050938) |
| 624676 | `tecnofinanze` | noun | 0 | Plurale di tecnofinanza | `tecnofinanza` | [tecnofinanze](https://it.wiktionary.org/w/index.php?title=tecnofinanze&oldid=4051642), [tecnofinanza](https://it.wiktionary.org/w/index.php?title=tecnofinanza&oldid=4056682) |
| 624679 | `discorsive` | adj | 0 | femminile plurale di discorsivo | `discorsivo` | [discorsive](https://it.wiktionary.org/w/index.php?title=discorsive&oldid=4051671), [discorsivo](https://it.wiktionary.org/w/index.php?title=discorsivo&oldid=4052856) |
| 624821 | `combusti` | adj | 0 | plurale di combusto | `combusto` | [combusti](https://it.wiktionary.org/w/index.php?title=combusti&oldid=4053664), [combusto](https://it.wiktionary.org/w/index.php?title=combusto&oldid=4053663) |
| 624841 | `flautiste` | noun | 0 | femminile plurale di flautista | `flautista` | [flautiste](https://it.wiktionary.org/w/index.php?title=flautiste&oldid=4059907), [flautista](https://it.wiktionary.org/w/index.php?title=flautista&oldid=4047659) |
| 624893 | `scanditori` | noun | 0 | plurale di scanditore | `scanditore` | [scanditori](https://it.wiktionary.org/w/index.php?title=scanditori&oldid=4054293), [scanditore](https://it.wiktionary.org/w/index.php?title=scanditore&oldid=4054291) |
| 624894 | `scansori` | noun | 0 | plurale di scansore | `scansore` | [scansori](https://it.wiktionary.org/w/index.php?title=scansori&oldid=4054294), [scansore](https://it.wiktionary.org/w/index.php?title=scansore&oldid=4054292) |
| 624895 | `scannerizzatori` | noun | 0 | plurale di scannerizzatore | `scannerizzatore` | [scannerizzatori](https://it.wiktionary.org/w/index.php?title=scannerizzatori&oldid=4054296), [scannerizzatore](https://it.wiktionary.org/w/index.php?title=scannerizzatore&oldid=4054295) |
| 624898 | `indirizzatori` | noun | 0 | plurale di indirizzatore | `indirizzatore` | [indirizzatori](https://it.wiktionary.org/w/index.php?title=indirizzatori&oldid=4054301), [indirizzatore](https://it.wiktionary.org/w/index.php?title=indirizzatore&oldid=4054352) |
| 624899 | `smistatori` | noun | 0 | plurale di smistatore | `smistatore` | [smistatori](https://it.wiktionary.org/w/index.php?title=smistatori&oldid=4054302), [smistatore](https://it.wiktionary.org/w/index.php?title=smistatore&oldid=4067414) |
| 624914 | `sedioli` | noun | 0 | plurale di sediolo | `sediolo` | [sedioli](https://it.wiktionary.org/w/index.php?title=sedioli&oldid=4054452), [sediolo](https://it.wiktionary.org/w/index.php?title=sediolo&oldid=4054451) |
| 624933 | `scuotitoi` | noun | 0 | plurale di scuotitoio | `scuotitoio` | [scuotitoi](https://it.wiktionary.org/w/index.php?title=scuotitoi&oldid=4054610), [scuotitoio](https://it.wiktionary.org/w/index.php?title=scuotitoio&oldid=4054614) |
| 624935 | `scuotitori` | noun | 0 | plurale di scuotitore | `scuotitore` | [scuotitori](https://it.wiktionary.org/w/index.php?title=scuotitori&oldid=4054615), [scuotitore](https://it.wiktionary.org/w/index.php?title=scuotitore&oldid=4054613) |
| 625220 | `adempi` | verb | 1 | seconda persona singolare dell'imperativo presente di adempiere | `adempiere` | [adempi](https://it.wiktionary.org/w/index.php?title=adempi&oldid=4056875), [adempiere](https://it.wiktionary.org/w/index.php?title=adempiere&oldid=4062419) |
| 625221 | `sottaci` | verb | 1 | seconda persona singolare dell'imperativo presente di sottacere | `sottacere` | [sottaci](https://it.wiktionary.org/w/index.php?title=sottaci&oldid=4056877), [sottacere](https://it.wiktionary.org/w/index.php?title=sottacere&oldid=4011429) |
| 625604 | `rabbiosi` | adj | 0 | plurale di rabbioso | `rabbioso` | [rabbiosi](https://it.wiktionary.org/w/index.php?title=rabbiosi&oldid=4059340), [rabbioso](https://it.wiktionary.org/w/index.php?title=rabbioso&oldid=4059341) |
| 625785 | `devio` | verb | 0 | prima persona persona singolare dell'indicativo presente di deviare | `deviare` | [devio](https://it.wiktionary.org/w/index.php?title=devio&oldid=4060850), [deviare](https://it.wiktionary.org/w/index.php?title=deviare&oldid=4248989) |
| 625853 | `imprevidenti` | adj | 0 | plurale di imprevidente | `imprevidente` | [imprevidenti](https://it.wiktionary.org/w/index.php?title=imprevidenti&oldid=4061733), [imprevidente](https://it.wiktionary.org/w/index.php?title=imprevidente&oldid=4061732) |
| 625854 | `imprevidenti` | noun | 0 | plurale di imprevidente | `imprevidente` | [imprevidenti](https://it.wiktionary.org/w/index.php?title=imprevidenti&oldid=4061733), [imprevidente](https://it.wiktionary.org/w/index.php?title=imprevidente&oldid=4061732) |
| 626823 | `mangiatori` | noun | 0 | plurale di mangiatore | `mangiatore` | [mangiatori](https://it.wiktionary.org/w/index.php?title=mangiatori&oldid=4065023), [mangiatore](https://it.wiktionary.org/w/index.php?title=mangiatore&oldid=4047974) |
| 627259 | `assalitrice` | adj | 0 | femminile di assalitore | `assalitore` | [assalitrice](https://it.wiktionary.org/w/index.php?title=assalitrice&oldid=4067437), [assalitore](https://it.wiktionary.org/w/index.php?title=assalitore&oldid=4053835) |
| 627260 | `assalitrice` | noun | 0 | femminile di assalitore | `assalitore` | [assalitrice](https://it.wiktionary.org/w/index.php?title=assalitrice&oldid=4067437), [assalitore](https://it.wiktionary.org/w/index.php?title=assalitore&oldid=4053835) |
| 627291 | `gerosolimitana` | adj | 0 | femminile di gerosolimitano | `gerosolimitano` | [gerosolimitana](https://it.wiktionary.org/w/index.php?title=gerosolimitana&oldid=4070060), [gerosolimitano](https://it.wiktionary.org/w/index.php?title=gerosolimitano&oldid=3957887) |
| 627292 | `gerosolimitana` | noun | 0 | femminile di gerosolimitano | `gerosolimitano` | [gerosolimitana](https://it.wiktionary.org/w/index.php?title=gerosolimitana&oldid=4070060), [gerosolimitano](https://it.wiktionary.org/w/index.php?title=gerosolimitano&oldid=3957887) |
| 627573 | `fletti` | verb | 1 | seconda persona singolare dell'imperativo presente di flettere | `flettere` | [fletti](https://it.wiktionary.org/w/index.php?title=fletti&oldid=4070130), [flettere](https://it.wiktionary.org/w/index.php?title=flettere&oldid=3980725) |
| 627589 | `farmacologa` | noun | 0 | femminile di farmacologo | `farmacologo` | [farmacologa](https://it.wiktionary.org/w/index.php?title=farmacologa&oldid=4070248), [farmacologo](https://it.wiktionary.org/w/index.php?title=farmacologo&oldid=3903956) |
| 627594 | `espungi` | verb | 1 | seconda persona singolare dell'imperativo presente di espungere | `espungere` | [espungi](https://it.wiktionary.org/w/index.php?title=espungi&oldid=4070442), [espungere](https://it.wiktionary.org/w/index.php?title=espungere&oldid=4048532) |
| 627625 | `tigliosa` | adj | 0 | femminile di tiglioso | `tiglioso` | [tigliosa](https://it.wiktionary.org/w/index.php?title=tigliosa&oldid=4070523), [tiglioso](https://it.wiktionary.org/w/index.php?title=tiglioso&oldid=4070510) |
| 627626 | `tigliosi` | adj | 0 | plurale di tiglioso | `tiglioso` | [tigliosi](https://it.wiktionary.org/w/index.php?title=tigliosi&oldid=4070524), [tiglioso](https://it.wiktionary.org/w/index.php?title=tiglioso&oldid=4070510) |
| 627627 | `tigliose` | adj | 0 | femminile plurale di tiglioso | `tiglioso` | [tigliose](https://it.wiktionary.org/w/index.php?title=tigliose&oldid=4070525), [tiglioso](https://it.wiktionary.org/w/index.php?title=tiglioso&oldid=4070510) |
| 632430 | `riscuoti` | verb | 1 | seconda persona singolare dell'imperativo presente di riscuotere | `riscuotere` | [riscuoti](https://it.wiktionary.org/w/index.php?title=riscuoti&oldid=4077339), [riscuotere](https://it.wiktionary.org/w/index.php?title=riscuotere&oldid=3970258) |
| 632434 | `malfidi` | adj | 0 | plurale di malfido | `malfido` | [malfidi](https://it.wiktionary.org/w/index.php?title=malfidi&oldid=4077373), [malfido](https://it.wiktionary.org/w/index.php?title=malfido&oldid=3421400) |
| 632435 | `malfida` | adj | 0 | femminile di malfido | `malfido` | [malfida](https://it.wiktionary.org/w/index.php?title=malfida&oldid=4077375), [malfido](https://it.wiktionary.org/w/index.php?title=malfido&oldid=3421400) |
| 632436 | `malfide` | adj | 0 | femminile plurale di malfido | `malfido` | [malfide](https://it.wiktionary.org/w/index.php?title=malfide&oldid=4077376), [malfido](https://it.wiktionary.org/w/index.php?title=malfido&oldid=3421400) |
| 660874 | `dismossioni` | noun | 0 | Plurale di dismossione. | `dismossione` | [dismossioni](https://it.wiktionary.org/w/index.php?title=dismossioni&oldid=4106215), [dismossione](https://it.wiktionary.org/w/index.php?title=dismossione&oldid=4099444) |
| 683904 | `forche` | noun | 0 | plurale di forca | `forca` | [forche](https://it.wiktionary.org/w/index.php?title=forche&oldid=4129495), [forca](https://it.wiktionary.org/w/index.php?title=forca&oldid=4043772) |
| 731653 | `veliche` | adj | 0 | femminile plurale di velico | `velico` | [veliche](https://it.wiktionary.org/w/index.php?title=veliche&oldid=4179300), [velico](https://it.wiktionary.org/w/index.php?title=velico&oldid=4179340) |
| 798262 | `tensive` | adj | 0 | femminile plurale di tensivo | `tensivo` | [tensive](https://it.wiktionary.org/w/index.php?title=tensive&oldid=4248788), [tensivo](https://it.wiktionary.org/w/index.php?title=tensivo&oldid=4248963) |

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
