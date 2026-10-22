/**
 * Inserisce l'edizione 2026 (la prima del sito, SPEC 7.1) riprendendo i contenuti del sito 2026
 * (ramo sito-2026): festa archiviata e nell'archivio pubblico, testo, programma con gli artisti.
 * Se sito/config non c'è ancora, lo crea con i testi del sito 2026 (chi siamo, come arrivare, FAQ).
 * Idempotente: se l'edizione esiste già non tocca nulla.
 *
 * Emulatore:   pnpm edizione-2026 --emulator
 * Produzione:  pnpm edizione-2026 --project colleiano   (credenziali via Application Default Credentials)
 */
import { parseArgs } from "node:util";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const { values } = parseArgs({
  options: { project: { type: "string" }, emulator: { type: "boolean", default: false } },
});

let projectId: string;
if (values.emulator) {
  projectId = "demo-colleiano";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
} else if (values.project) {
  projectId = values.project;
} else {
  console.error("Errore: indica --project (produzione) oppure --emulator");
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();

const FESTA_ID = "edizione-2026";
const ora = FieldValue.serverTimestamp();
const audit = { createdAt: ora, createdBy: "script", updatedAt: ora, updatedBy: "script" };
/** Orario del 17 maggio 2026, ora italiana (CEST, UTC+2). */
const alle = (hhmm: string) => Timestamp.fromDate(new Date(`2026-05-17T${hhmm}:00+02:00`));

const TESTO = `Un ritorno alle radici. Dove il respiro delle montagne incontra la memoria delle nostre mani, celebrando un'eredità che non sfiorisce.

Domenica 17 maggio 2026 a Colleiano: messa e processione, giochi popolari, pranzo di comunità e musica dal vivo fino a sera.

«Nel bal folk non si balla per esibirsi, si balla per ricordare: che il ritmo è già dentro di noi, che il tempo può essere condiviso. È una festa gentile, dove ogni passo è un invito e ogni errore diventa sorriso.»
Piano Folk Trio`;

const PROGRAMMA = [
  { inizio: "09:00", fine: "10:30", titolo: "Messa e Processione", descrizione: "Apertura della giornata con la Santa Messa e la processione nel paese." },
  { inizio: "10:30", fine: "15:30", titolo: "Giochi Popolari", descrizione: "Giochi popolari per tutte le età!" },
  { inizio: "13:00", titolo: "Pranzo di Comunità", descrizione: "Pranzo di comunità gratuito per tutti." },
  {
    inizio: "15:30",
    fine: "16:30",
    titolo: "\"Il Fiore che Illumina il Mondo\"",
    descrizione:
      "Spettacolo itinerante. Ricordi del paese, da chi non c'è più e da chi il paese lo ha vissuto con gli occhi del bambino. Dalla piazza fino al prato più bello del mondo.",
  },
  {
    inizio: "15:30",
    fine: "16:30",
    titolo: "Lab Bimbi 3–6 Anni",
    descrizione: "Piccoli esploratori della natura: raccolta di materiali naturali e composizioni artistiche. Prenotazione obbligatoria.",
  },
  {
    inizio: "17:00",
    titolo: "Festa a Ballo",
    descrizione:
      "…quando il pianoforte ha voglia di ballare! Piano Folk Trio + Canti al Tramonto.\n\nMarco Fermani: pianoforte\nRaffaele Catà: basso elettrico\nMarco Lorenzetti: percussioni",
  },
  {
    inizio: "20:00",
    titolo: "Apericena",
    descrizione:
      "A cura di Osteria in Cammino. Su prenotazione a pagamento.\nMenù: Cous Cous di verdure + Castagnaccio Napoletano + vino (o birra), 10€.",
  },
];

const CONFIG = {
  chiSiamo:
    "Un ritorno alle radici. Dove il respiro delle montagne incontra la memoria delle nostre mani, celebrando un'eredità che non sfiorisce.",
  comeArrivare:
    "L'evento si svolge interamente nel cuore dell'antico paese di Colleiano. Consigliamo di arrivare entro le ore 10:00 per usufruire dei parcheggi gratuiti designati all'ingresso del paese.",
  indirizzo: "Colleiano, 63093 Roccafluvione (AP)",
  linkMappe: "https://maps.app.goo.gl/etLLkKWMANxE5Vrq5",
  faq: [
    {
      domanda: "Posso portare il mio cane?",
      risposta:
        "Assolutamente sì! I cani al guinzaglio sono i benvenuti in tutto il paese. Ricordiamo solo di avere sempre con sé i sacchetti per la raccolta delle deiezioni.",
    },
    {
      domanda: "Come si prenota il Lab Bimbi o l'Apericena?",
      risposta:
        "Di solito il Lab Bimbi (3–6 anni) richiede prenotazione obbligatoria e l'Apericena è su prenotazione a pagamento. I dettagli e i canali di prenotazione della prossima edizione verranno pubblicati qui appena disponibili.",
    },
    {
      domanda: "Ingresso a pagamento?",
      risposta:
        "L'ingresso al paese, gli spettacoli, i giochi popolari e il pranzo di comunità delle 13:00 sono completamente gratuiti. L'Apericena serale è a pagamento (10€ su prenotazione).",
    },
    {
      domanda: "Cosa succede in caso di pioggia?",
      risposta: "In caso di pioggia l'evento verrà rimandato. Segui i nostri canali per aggiornamenti.",
    },
  ],
};

async function main() {
  const festaRef = db.doc(`feste/${FESTA_ID}`);
  if ((await festaRef.get()).exists) {
    console.log("L'edizione 2026 c'è già: non tocco nulla.");
  } else {
    const batch = db.batch();
    batch.create(festaRef, {
      nome: "Festa del Paese 2026",
      slug: "festa-2026",
      dataFesta: Timestamp.fromDate(new Date("2026-05-17T12:00:00Z")),
      luogo: "Colleiano",
      stato: "archiviata",
      categorieSpesa: ["Altro"],
      modalitaFesta: false,
      inArchivioPubblico: true,
      paginaPubblica: { testo: TESTO, galleria: [] },
      ...audit,
    });
    // Come ogni festa (SPEC 6.5): così si apre anche dal gestionale.
    batch.create(festaRef.collection("commissioni").doc("generale"), {
      nome: "Generale", descrizione: "Spese e cose che riguardano tutta la festa.", icona: "house", colore: "grigio",
      ordine: 0, generale: true, referentiUids: [], componentiUids: [], ...audit,
    });
    PROGRAMMA.forEach((e, ordine) => {
      batch.create(festaRef.collection("programma").doc(), {
        titolo: e.titolo,
        inizio: alle(e.inizio),
        ...(e.fine ? { fine: alle(e.fine) } : {}),
        descrizione: e.descrizione,
        ordine,
        ...audit,
      });
    });
    await batch.commit();
    console.log(`Edizione 2026 creata (${PROGRAMMA.length} eventi): /edizioni/festa-2026`);
  }

  const configRef = db.doc("sito/config");
  if ((await configRef.get()).exists) {
    console.log("sito/config c'è già: lo lascio com'è.");
  } else {
    await configRef.create({ ...CONFIG, updatedAt: ora, updatedBy: "script" });
    console.log("Testi del sito creati da quelli del sito 2026.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
