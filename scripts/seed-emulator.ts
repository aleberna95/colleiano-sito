/**
 * Dati finti per provare il gestionale sull'emulatore (SPEC 8.1). MAI in produzione.
 *
 *   pnpm emulators        (in un altro terminale)
 *   pnpm seed
 *
 * Svuota Auth e Firestore dell'emulatore e crea una festa con persone, commissioni, task e spese.
 * Tutti entrano con la password "password-prova".
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "demo-colleiano";
const AUTH = "127.0.0.1:9099";
const FIRESTORE = "127.0.0.1:8080";
const PASSWORD = "password-prova";

function esci(messaggio: string): never {
  console.error(`Errore: ${messaggio}`);
  process.exit(1);
}

// Blocco per la produzione: progetto finto e solo emulatori, qualunque cosa ci sia nell'ambiente.
if (process.argv.some((a) => a.startsWith("--project"))) esci("lo script funziona solo sull'emulatore.");
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const giorno = 24 * 3600 * 1000;
const tra = (giorni: number) => Timestamp.fromMillis(Date.now() + giorni * giorno);

async function main() {
  const prova = await fetch(`http://${FIRESTORE}/`).catch(() => null);
  if (!prova) esci("emulatore Firestore non raggiungibile: lancia prima `pnpm emulators`.");

  const h = { method: "DELETE", headers: { Authorization: "Bearer owner" } };
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, h);
  await fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, h);

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();
  const ora = FieldValue.serverTimestamp();

  const persone = [
    { chiave: "alessio", nome: "Alessio", superadmin: true, ruolo: "admin", commissioni: {} },
    { chiave: "anna", nome: "Anna", ruolo: "admin", commissioni: {} },
    { chiave: "mario", nome: "Mario", ruolo: "membro", commissioni: { musica: "referente" } },
    { chiave: "luca", nome: "Luca", ruolo: "membro", commissioni: { musica: "componente", logistica: "componente" } },
    { chiave: "toto", nome: "Toto", ruolo: "membro", commissioni: { cucina: "referente" } },
    { chiave: "gina", nome: "Gina", ruolo: "membro", commissioni: { cucina: "componente" } },
  ] as const;

  const uid: Record<string, string> = {};
  for (const p of persone) {
    const email = `${p.chiave}@colleiano.test`;
    const u = await auth.createUser({ email, password: PASSWORD, displayName: `${p.nome} Prova` });
    uid[p.chiave] = u.uid;
    if ("superadmin" in p) await auth.setCustomUserClaims(u.uid, { superadmin: true });
    await db.doc(`users/${u.uid}`).set({
      nome: p.nome, cognome: "Prova", nomeVisualizzato: p.nome, email, telefono: "333 123 4567",
      superadmin: "superadmin" in p, attivo: true, devoCambiarePassword: false,
      createdAt: ora, createdBy: "seed", updatedAt: ora, updatedBy: "seed",
    });
  }

  const audit = (chi = uid.alessio) => ({ createdAt: ora, createdBy: chi, updatedAt: ora, updatedBy: chi });
  const festa = db.collection("feste").doc();
  const f = `feste/${festa.id}`;
  await festa.set({
    nome: "Festa di Colleiano 2027", slug: "festa-di-colleiano-2027", dataFesta: tra(290), luogo: "Piazza di Colleiano",
    stato: "preparazione", budgetTotaleCents: 500000,
    categorieSpesa: ["Cibo e bevande", "Attrezzatura", "Musica e spettacoli", "Allestimento", "Pubblicità e stampa", "Permessi", "Altro"],
    ...audit(),
  });

  const commissioni = [
    { id: "generale", nome: "Generale", colore: "grigio", icona: "house", generale: true, descrizione: "Spese e cose che riguardano tutta la festa." },
    { id: "musica", nome: "Musica", colore: "viola", icona: "music", budgetCents: 150000, descrizione: "Palco, impianto e gruppi." },
    { id: "cucina", nome: "Cucina", colore: "arancio", icona: "utensils", budgetCents: 200000, descrizione: "Menù, spesa e stand." },
    { id: "logistica", nome: "Logistica", colore: "blu", icona: "truck", descrizione: "Tavoli, corrente, permessi." },
  ];
  for (const [i, c] of commissioni.entries()) {
    const { id, ...dati } = c;
    const referenti = persone.filter((p) => (p.commissioni as Record<string, string>)[id] === "referente").map((p) => uid[p.chiave]);
    const componenti = persone.filter((p) => (p.commissioni as Record<string, string>)[id] === "componente").map((p) => uid[p.chiave]);
    await db.doc(`${f}/commissioni/${id}`).set({
      generale: false, ...dati, ordine: i, referentiUids: referenti, componentiUids: componenti, ...audit(),
    });
  }
  for (const p of persone) {
    await db.doc(`${f}/membri/${uid[p.chiave]}`).set({
      uid: uid[p.chiave], nomeVisualizzato: p.nome, telefono: "333 123 4567", ruoloFesta: p.ruolo,
      commissioni: p.commissioni, attivo: true, ...audit(),
    });
  }

  const task = (t: Record<string, unknown>) =>
    db.collection(`${f}/tasks`).add({ priorita: "normale", checklist: [], link: [], eliminato: false, ...audit(uid.mario), ...t });
  await task({ titolo: "Prenotare il gruppo per la sera", commissioneId: "musica", responsabileUid: uid.mario, stato: "in_corso", scadenza: tra(20) });
  await task({
    titolo: "Montare il palco", commissioneId: "musica", responsabileUid: uid.luca, stato: "da_fare", scadenza: tra(-2), priorita: "urgente",
    checklist: [{ id: "a1", testo: "Ritirare le pedane", fatto: true }, { id: "a2", testo: "Trovare 4 persone", fatto: false }],
  });
  await task({ titolo: "Provare l'impianto audio", commissioneId: "musica", responsabileUid: null, stato: "da_fare", scadenza: tra(0) });
  await task({ titolo: "Chiedere il permesso al Comune", commissioneId: "logistica", responsabileUid: uid.anna, stato: "bloccato", motivoBlocco: "Ufficio chiuso fino a lunedì", ...audit(uid.anna) });
  await task({ titolo: "Comprare il carbone", commissioneId: "cucina", responsabileUid: uid.gina, stato: "fatto", ...audit(uid.toto) });
  await task({ titolo: "Servono due prolunghe per lo stand", commissioneId: "logistica", responsabileUid: null, stato: "richiesta", richiestoDa: uid.toto, ...audit(uid.toto) });

  const spesa = (s: Record<string, unknown>) =>
    db.collection(`${f}/movimenti`).add({ tipo: "spesa", categoria: "Altro", dataSpesa: tra(-5), scontrini: [], eliminato: false, ...s });
  await spesa({ commissioneId: "musica", descrizione: "Corde per chitarra", importoCents: 2550, pagatoDa: { tipo: "anticipata", beneficiarioUid: uid.luca }, stato: "in_attesa", ...audit(uid.luca) });
  await spesa({ commissioneId: "cucina", descrizione: "Carbone e accendini", importoCents: 4800, categoria: "Cibo e bevande", pagatoDa: { tipo: "anticipata", beneficiarioUid: uid.gina }, stato: "approvata", approvatoDa: uid.anna, approvatoAt: ora, ...audit(uid.gina) });
  await spesa({ commissioneId: "generale", descrizione: "Volantini", importoCents: 9000, categoria: "Pubblicità e stampa", pagatoDa: { tipo: "cassa" }, stato: "approvata", approvatoDa: uid.alessio, approvatoAt: ora, ...audit(uid.anna) });
  await spesa({ commissioneId: "logistica", descrizione: "Nastro e fascette", importoCents: 1200, pagatoDa: { tipo: "anticipata", beneficiarioNome: "Zio Peppe" }, stato: "rifiutata", motivo: "Manca lo scontrino", ...audit(uid.luca) });
  await spesa({ tipo: "entrata", commissioneId: "generale", descrizione: "Sponsor Bar Centrale", importoCents: 30000, pagatoDa: { tipo: "cassa" }, stato: "approvata", approvatoDa: uid.alessio, approvatoAt: ora, ...audit() });

  console.log("Dati di prova pronti sull'emulatore.");
  console.log("Apri http://localhost:3000/gestione e entra con una di queste email (password: password-prova):");
  for (const p of persone) console.log(`  ${p.chiave}@colleiano.test  ${p.nome} (${p.ruolo}${"superadmin" in p ? ", superadmin" : ""})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
