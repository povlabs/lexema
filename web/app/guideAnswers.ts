// Whole answers the guide pages of the docs print folded (guidePanels.ts), as
// the API gives them for their requests over release it-0c432803. They are
// here in full so each page folds the real answer rather than restate a
// shorter one; `id` numbers are the lines those records sit on in that
// release's archive. web/test/developers.test.tsx sends each request to
// `handleApi` and fails when an answer drifts.

/** `lookup?q=andavano&pos=verb&mood=indicativo&tense=imperfetto`. */
export const ANDAVANO_AS_VERB: unknown = {
  "query": "andavano",
  "release_id": "it-0c432803",
  "results": [
    {
      "id": "it-0c432803:2345",
      "word": "andare",
      "pos": "verb",
      "pos_title": "Verbo",
      "match": {
        "surface": "andavano",
        "via": "form_of",
        "grammar": [{ "mood": "indicativo", "tense": "imperfetto", "person": "loro" }]
      },
      "pronunciations": [{ "ipa": "/anˈda.re/", "note": null }],
      "definitions": [
        {
          "definition": "muoversi da un luogo verso un altro luogo",
          "labels": [],
          "examples": ["ogni mattina devo andare a scuola"],
          "items": []
        },
        { "definition": "partire", "labels": [], "examples": ["\"Coraggio, vai!\""], "items": [] },
        {
          "definition": "essere destinato a esser messo in una data posizione",
          "labels": [],
          "examples": ["quell'elettrodomestico va in cucina"],
          "items": []
        },
        {
          "definition": "dover essere (con un participio passato), dover subire una certa azione (usato prevalentemente alla terza persona, singolare o plurale)",
          "labels": [],
          "examples": ["quel documento va portato dall'avvocato", "quei furfanti andrebbero acciuffati"],
          "items": []
        },
        {
          "definition": "necessità fisiche naturali, in particolare con riferimento all'evacuazione",
          "labels": ["rare"],
          "examples": [
            "Molto mestamente ma con rispetto, disse al medico: \"Vado regolarmente, non è un problema\""
          ],
          "items": []
        }
      ],
      "examples": [],
      "forms": {
        "type": "conjugation",
        "moods": {
          "indicativo": {
            "imperfetto": {
              "io": ["andavo"],
              "tu": ["andavi"],
              "lui, lei": ["andava"],
              "noi": ["andavamo"],
              "voi": ["andavate"],
              "loro": ["andavano"]
            }
          }
        }
      },
      "etymology": "Devoto/Oli: dal latino ambitare, forma intensiva di ambire, andare in giro\nTreccani: etimo incerto; nella coniugazione, il tema and- si alterna in alcune forme con il tema vad- del latino vadere\ndal latino \"vadere\" ossia \"andare\" derivano le forme suppletive della coniugazione del verbo.\nIncerto l'etimo delle altre forme:\nc'è chi propone \"aditare\" (frequentativo) o un volgare \"*adare\" come varianti di \"adīre\" ossia \"andare verso\", proponendo come similitudine il modo in cui \"aditu(m)\" (anche questo derivato da \"adīre\") ha dato origine a \"andito\";\naltri propongono il latino \"ambitāre\" (frequentativo) o un volgare \"*ambare\" derivati di \"ambīre\" ossia \"andare intorno\";\naltri suggeriscono il latino \"* ad- nare\" ossia \"nuotare verso\", proponendo come similitudine \"arrivare\" derivato da \"* ad- ripare\" ossia \"giungere a riva\"",
      "synonyms": [
        "andata", "andatura", "camminata", "portamento", "viaggio", "avanzare", "avviarsi", "camminare",
        "dirigersi", "incamminarsi", "procedere", "recarsi", "allontanarsi", "andarsene", "emigrare",
        "espatriare", "partire", "uscire", "consumarsi", "fluire", "fuggire", "passare", "scorrere",
        "trascorrere", "volare", "continuare", "funzionare", "progredire", "proseguire", "svolgere",
        "condursi", "inoltrarsi", "marciare", "muoversi", "penetrare", "peregrinare", "portarsi", "spostarsi",
        "trasferirsi", "traslocare", "aggirarsi", "circolare", "errare", "gironzolare", "passeggiare",
        "vagabondare", "vagare", "condurre", "confluire", "portare", "sboccare", "sfociare", "avere successo",
        "essere di moda", "essere venduto", "avere corso", "valere", "essere necessario", "occorrere",
        "essere gradito", "gustare", "piacere", "essere destinato", "essere collocato"
      ],
      "antonyms": [
        "fermarsi", "restare fermo", "restare immobile", "sostare", "trattenersi", "entrare", "rientrare",
        "ritornare", "tornare", "arrestarsi", "bloccarsi", "essere guasto", "venire", "arrivare", "stare",
        "rimanere", "restare", "ire", "gire", "essere fuori corso", "dispiacere", "disgustare"
      ],
      "derived": ["andato", "riandare", "andarsene"],
      "attribution": {
        "licence": "CC BY-SA 4.0",
        "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "source": "Wikizionario",
        "source_url": "https://it.wiktionary.org/wiki/andare"
      }
    }
  ]
};

/** `lookup?q=sale`. */
export const SALE: unknown = {
  "query": "sale",
  "release_id": "it-0c432803",
  "results": [
    {
      "id": "it-0c432803:21651",
      "word": "sale",
      "pos": "noun",
      "pos_title": "Sostantivo",
      "match": {
        "surface": "sale",
        "via": "headword",
        "grammar": [{ "gender": "maschile", "number": "singolare" }]
      },
      "pronunciations": [{ "ipa": "/ˈsaːle/", "note": null }],
      "definitions": [
        {
          "definition": "sostanza denominata anche cloruro di sodio che si presenta sotto forma di cristalli biancastri con diversi utilizzi tra cui quello culinario",
          "labels": [],
          "examples": [],
          "items": []
        },
        { "definition": "composto costituito da cationi e anioni", "labels": [], "examples": [], "items": [] },
        { "definition": "buon senso", "labels": ["figuratively"], "examples": [], "items": [] },
        { "definition": "arguzia", "labels": ["figuratively"], "examples": [], "items": [] },
        { "definition": "sale aromatico", "labels": [], "examples": [], "items": [] }
      ],
      "examples": [],
      "forms": {
        "type": "gender_number",
        "grid": { "maschile": { "singolare": ["sale"], "plurale": ["sali"] } },
        "superlativo": null
      },
      "etymology": "(sostantivo singolare) derivato dal greco ἅλς (hals), in origine σάλς (sals), da cui il latino salis\n(sostantivo plurale) vedi sala",
      "synonyms": [
        "composto chimico", "cloruro di sodio", "cloruro sodico", "salgemma", "acume", "assennatezza",
        "avvedutezza", "brio", "buon senso", "cervello", "criterio", "discernimento", "equilibrio",
        "giudizio", "intelligenza", "prudenza", "sagacia", "saggezza", "sapidità", "senno", "vivacità",
        "arguzia", "causticità", "facezia", "frizzo", "ironia", "lazzo", "lepidezza", "mordacità",
        "originalità", "pepe", "salacità", "sarcasmo", "spirito", "spiritosaggine", "percorre", "in salita",
        "ascende", "balza", "su", "dà", "la scalata", "monta", "rimonta", "risale", "si", "alza", "arrampica",
        "dirige", "in alto", "innalza", "installa", "issa", "inerpica", "solleva", "spinge", "va",
        "si  leva all’orizzonte", "sorge", "migliora", "progredisce", "raggiunge un grado elevato", "eleva",
        "aumenta", "cresce", "allarga", "amplia", "espande", "estende", "rincara"
      ],
      "antonyms": [
        "avventatezza", "dissennatezza", "insensatezza", "insipienza", "leggerezza", "mancanza di cervello",
        "mancanza di giudizio", "stoltezza", "stupidità", "sventatezza", "banalità", "insulsaggine",
        "melensaggine", "mollezza", "scipitaggine", "crolla", "discende", "precipita", "scende", "si",
        "abbassa", "piega", "smonta", "tramonta", "decade", "peggiora", "regredisce", "decresce", "attenua",
        "contrae", "ribassa", "riduce", "smorza", "cala", "diminuisce"
      ],
      "derived": ["insalare", "salario", "salina", "saliera", "spargisale"],
      "attribution": {
        "licence": "CC BY-SA 4.0",
        "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "source": "Wikizionario",
        "source_url": "https://it.wiktionary.org/wiki/sale"
      }
    },
    {
      "id": "it-0c432803:41460",
      "word": "sala",
      "pos": "noun",
      "pos_title": "Sostantivo",
      "match": {
        "surface": "sale",
        "via": "form_of",
        "grammar": [{ "gender": "femminile", "number": "plurale" }]
      },
      "pronunciations": [{ "ipa": "/ˈsala/", "note": null }],
      "definitions": [
        {
          "definition": "locale di un edificio adibito a riunioni ovvero, in senso ampio, a ospitare anche temporaneamente più persone",
          "labels": [],
          "examples": ["sala da ballo, sala d'aspetto o d'attesa, sala riunioni, sala da pranzo"],
          "items": []
        },
        {
          "definition": "definizione mancante; se vuoi, aggiungila tu",
          "labels": ["broadly"],
          "examples": [],
          "items": []
        },
        {
          "definition": "locale di una nave adibito a particolari funzioni",
          "labels": [],
          "examples": ["sala macchine"],
          "items": []
        },
        { "definition": "abitazione longobarda", "labels": ["arcaico"], "examples": [], "items": [] },
        {
          "definition": "(ruota)definizione mancante; se vuoi, aggiungila tu",
          "labels": [],
          "examples": [],
          "items": []
        },
        {
          "definition": "nome generico di diverse specie di piante lacustri o paludicole con foglie strette e lunghe, usate per intessere le sedie e rivestire i fiaschi",
          "labels": [],
          "examples": [],
          "items": []
        },
        { "definition": "pinta di palude", "labels": [], "examples": [], "items": [] },
        {
          "definition": "asse delle ruote di un veicolo ferroviario",
          "labels": [],
          "examples": [],
          "items": []
        }
      ],
      "examples": [],
      "forms": {
        "type": "gender_number",
        "grid": { "femminile": { "singolare": ["sala"], "plurale": ["sale"] } },
        "superlativo": null
      },
      "etymology": "(vano) dal germanico-longobardo sala, abitazione\n(pianta) forse collegato al latino salum e al greco antico σάλος (salos, \"mare\") come \"alga\" al greco ἅλς (als, \"mare\") o derivante dal longobardo salaha",
      "synonyms": [
        "soggiorno", "salotto", "salone", "stanza", "atrio", "hall", "sala di spettacolo", "auditorium",
        "pubblico", "spettatori", "presenti", "uditorio", "casa di campagna", "insediamento"
      ],
      "antonyms": [],
      "derived": ["caposala"],
      "attribution": {
        "licence": "CC BY-SA 4.0",
        "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "source": "Wikizionario",
        "source_url": "https://it.wiktionary.org/wiki/sala"
      }
    },
    {
      "id": "it-0c432803:49483",
      "word": "salire",
      "pos": "verb",
      "pos_title": "Verbo",
      "match": {
        "surface": "sale",
        "via": "form_of",
        "grammar": [{ "mood": "indicativo", "tense": "presente", "person": "lui, lei" }]
      },
      "pronunciations": [{ "ipa": "/saˈlire/", "note": null }],
      "definitions": [
        { "definition": "fare un movimento verso l'alto", "labels": [], "examples": [], "items": [] },
        {
          "definition": "arrampicarsi, seguito da su",
          "labels": [],
          "examples": ["Ieri sono salito su quell'albero"],
          "items": []
        },
        {
          "definition": "andare sopra qualcosa, montare, seguito da su o seguito da a",
          "labels": [],
          "examples": ["La parte più difficile dell'ippica, secondo me, è salire a o sul cavallo"],
          "items": []
        }
      ],
      "examples": [],
      "forms": {
        "type": "conjugation",
        "gerundio": ["salendo"],
        "participio presente": ["salente"],
        "participio": ["salito"],
        "ausiliare": ["avere o essere"],
        "moods": {
          "indicativo": {
            "presente": {
              "io": ["salgo"],
              "tu": ["sali"],
              "lui, lei": ["sale"],
              "noi": ["saliamo"],
              "voi": ["salite"],
              "loro": ["salgono"]
            },
            "imperfetto": {
              "io": ["salivo"],
              "tu": ["salivi"],
              "lui, lei": ["saliva"],
              "noi": ["salivamo"],
              "voi": ["salivate"],
              "loro": ["salivano"]
            },
            "passato remoto": {
              "io": ["salii"],
              "tu": ["salisti"],
              "lui, lei": ["salì"],
              "noi": ["salimmo"],
              "voi": ["saliste"],
              "loro": ["salirono"]
            },
            "futuro semplice": {
              "io": ["salirò"],
              "tu": ["salirai"],
              "lui, lei": ["salirà"],
              "noi": ["saliremo"],
              "voi": ["salirete"],
              "loro": ["saliranno"]
            },
            "passato prossimo": {
              "io": ["ho salito", "sono salito"],
              "tu": ["hai salito", "sei salito"],
              "lui, lei": ["ha salito", "è salito"],
              "noi": ["abbiamo salito", "siamo saliti"],
              "voi": ["avete salito", "siete saliti"],
              "loro": ["hanno salito", "sono saliti"]
            },
            "trapassato prossimo": {
              "io": ["avevo salito", "ero salito"],
              "tu": ["avevi salito", "eri salito"],
              "lui, lei": ["aveva salito", "era salito"],
              "noi": ["avevamo salito", "eravamo saliti"],
              "voi": ["avevate salito", "eravate saliti"],
              "loro": ["avevano salito", "erano saliti"]
            },
            "trapassato remoto": {
              "io": ["ebbi salito", "fui salito"],
              "tu": ["avesti salito", "fosti salito"],
              "lui, lei": ["ebbe salito", "fu salito"],
              "noi": ["avemmo salito", "fummo saliti"],
              "voi": ["aveste salito", "foste saliti"],
              "loro": ["ebbero salito", "furono saliti"]
            },
            "futuro anteriore": {
              "io": ["avrò salito", "sarò salito"],
              "tu": ["avrai salito", "sarai salito"],
              "lui, lei": ["avrà salito", "sarà salito"],
              "noi": ["avremo salito", "saremo saliti"],
              "voi": ["avrete salito", "sarete saliti"],
              "loro": ["avranno salito", "saranno saliti"]
            }
          },
          "congiuntivo": {
            "presente": {
              "io": ["salga"],
              "tu": ["salga"],
              "lui, lei": ["salga"],
              "noi": ["saliamo"],
              "voi": ["saliate"],
              "loro": ["salgano"]
            },
            "imperfetto": {
              "io": ["salissi"],
              "tu": ["salissi"],
              "lui, lei": ["salisse"],
              "noi": ["salissimo"],
              "voi": ["saliste"],
              "loro": ["salissero"]
            },
            "passato": {
              "io": ["abbia salito", "sia salito"],
              "tu": ["abbia salito", "sia salito"],
              "lui, lei": ["abbia salito", "sia salito"],
              "noi": ["abbiamo salito", "siamo saliti"],
              "voi": ["abbiate salito", "siate saliti"],
              "loro": ["abbiano salito", "siano saliti"]
            },
            "trapassato": {
              "io": ["avessi salito", "fossi salito"],
              "tu": ["avessi salito", "fossi salito"],
              "lui, lei": ["avesse salito", "fosse salito"],
              "noi": ["avessimo salito", "fossimo saliti"],
              "voi": ["aveste salito", "foste saliti"],
              "loro": ["avessero salito", "fossero saliti"]
            }
          },
          "condizionale": {
            "presente": {
              "io": ["salirei"],
              "tu": ["saliresti"],
              "lui, lei": ["salirebbe"],
              "noi": ["saliremmo"],
              "voi": ["salireste"],
              "loro": ["salirebbero"]
            },
            "passato": {
              "io": ["avrei salito", "sarei salito"],
              "tu": ["avresti salito", "saresti salito"],
              "lui, lei": ["avrebbe salito", "sarebbe salito"],
              "noi": ["avremmo salito", "saremmo saliti"],
              "voi": ["avreste salito", "sareste saliti"],
              "loro": ["avrebbero salito", "sarebbero saliti"]
            }
          },
          "imperativo": {
            "presente": {
              "tu": ["sali", "non salire"],
              "lui, lei": ["salga"],
              "noi": ["saliamo"],
              "voi": ["salite"],
              "loro": ["salgano"]
            }
          }
        }
      },
      "etymology": "dal latino salire ovvero \"saltare\"",
      "synonyms": [
        "alzarsi", "arrampicarsi", "ascendere", "elevarsi", "inerpicarsi", "innalzarsi", "montare",
        "aumentare", "crescere", "gonfiarsi", "sollevarsi", "lievitare", "risalire", "rimontare", "andare su",
        "issarsi", "sorgere", "spuntare", "levarsi all’orizzonte", "levarsi", "essere in salita",
        "fare carriera", "progredire", "migliorare", "accrescersi", "ingrandirsi", "allargarsi", "estendersi",
        "ampliarsi", "espandersi", "rincarare", "ergersi", "spingersi", "scalare"
      ],
      "antonyms": [
        "abbassarsi", "discendere", "scendere", "smontare", "calare", "decrescere", "diminuire", "ridursi",
        "piegarsi", "atterrare", "precipitare", "tramontare", "essere in discesa", "peggiorare", "regredire",
        "attenuarsi", "ribassare"
      ],
      "derived": ["risalire"],
      "attribution": {
        "licence": "CC BY-SA 4.0",
        "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "source": "Wikizionario",
        "source_url": "https://it.wiktionary.org/wiki/salire"
      }
    }
  ]
};
