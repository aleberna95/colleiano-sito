/**
 * Crea (o aggiorna) il superadmin. Idempotente. SPEC 8.1.
 *
 * Emulatore:   pnpm bootstrap:superadmin --emulator --email ... --nome ... --cognome ... --telefono ...
 * Produzione:  pnpm bootstrap:superadmin --project colleiano --email ... --nome ... --cognome ... --telefono ...
 *              (credenziali via Application Default Credentials, mai nel repo)
 *
 * Se l'utente non esiste genera una password casuale di 24 caratteri e la stampa UNA volta.
 * Non crea nient'altro.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    nome: { type: "string" },
    cognome: { type: "string" },
    telefono: { type: "string" },
    project: { type: "string" },
    emulator: { type: "boolean", default: false },
  },
});

function esci(messaggio: string): never {
  console.error(`Errore: ${messaggio}`);
  process.exit(1);
}

const { email, nome, cognome, telefono, emulator } = values;
if (!email || !nome || !cognome || !telefono) {
  esci("servono --email, --nome, --cognome e --telefono");
}

let projectId: string;
if (emulator) {
  projectId = "demo-colleiano";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
} else {
  if (!values.project) esci("indica --project (produzione) oppure --emulator");
  projectId = values.project;
}

/** 24 caratteri da un alfabeto senza caratteri ambigui (0/O, 1/l/I). */
function passwordCasuale(lunghezza = 24): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";
  const out: string[] = [];
  while (out.length < lunghezza) {
    for (const b of randomBytes(lunghezza * 2)) {
      // scarta i byte oltre il multiplo più grande per evitare bias
      if (b < 256 - (256 % alfabeto.length) && out.length < lunghezza) out.push(alfabeto[b % alfabeto.length]);
    }
  }
  return out.join("");
}

async function main() {
  initializeApp({ projectId });
  const auth = getAuth();
  const db = getFirestore();

  let uid: string;
  let password: string | undefined;
  try {
    uid = (await auth.getUserByEmail(email!)).uid;
    console.log(`L'utente ${email} esiste già (uid ${uid}): aggiorno claim e profilo, password invariata.`);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    password = passwordCasuale();
    uid = (await auth.createUser({ email, password, displayName: `${nome} ${cognome}` })).uid;
    console.log(`Creato l'utente ${email} (uid ${uid}).`);
  }

  await auth.setCustomUserClaims(uid, { superadmin: true });

  const ref = db.doc(`users/${uid}`);
  const esistente = await ref.get();
  await ref.set(
    {
      nome,
      cognome,
      nomeVisualizzato: nome,
      email,
      telefono,
      superadmin: true,
      attivo: true,
      ...(esistente.exists ? {} : { devoCambiarePassword: true, createdAt: FieldValue.serverTimestamp(), createdBy: "bootstrap" }),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "bootstrap",
    },
    { merge: true },
  );

  console.log(`Superadmin pronto su ${projectId}.`);
  if (password) {
    console.log("\nPassword temporanea (mostrata solo ora, copiala adesso):\n");
    console.log(`    ${password}\n`);
    console.log("Al primo accesso il gestionale chiede di cambiarla.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
