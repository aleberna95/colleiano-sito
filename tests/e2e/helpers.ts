import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

const PROJECT_ID = "demo-colleiano";

function admin() {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return { auth: getAuth(), db: getFirestore() };
}

/** Svuota Auth e Firestore dell'emulatore. */
export async function svuotaEmulatori() {
  const base = { method: "DELETE", headers: { Authorization: "Bearer owner" } };
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, base);
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, base);
}

/** Crea un utente come farebbe lo script di bootstrap o la Function. */
export async function creaUtente(opz: {
  email: string;
  password: string;
  nome: string;
  superadmin?: boolean;
  devoCambiarePassword?: boolean;
}) {
  const { auth, db } = admin();
  const { uid } = await auth.createUser({ email: opz.email, password: opz.password });
  if (opz.superadmin) await auth.setCustomUserClaims(uid, { superadmin: true });
  await db.doc(`users/${uid}`).set({
    nome: opz.nome,
    cognome: "Test",
    nomeVisualizzato: opz.nome,
    email: opz.email,
    telefono: "3330000000",
    superadmin: opz.superadmin ?? false,
    attivo: true,
    devoCambiarePassword: opz.devoCambiarePassword ?? true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "test",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "test",
  });
  return uid;
}
