import { deleteApp, initializeApp as initClient, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth as getClientAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export const PROJECT_ID = "demo-colleiano";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

export function admin() {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return { auth: getAuth(), db: getFirestore() };
}

export async function svuota() {
  const h = { method: "DELETE", headers: { Authorization: "Bearer owner" } };
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, h);
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, h);
}

/** Crea un account (come lo script di bootstrap) e restituisce uid ed email. */
export async function account(nome: string, opz: { superadmin?: boolean; proprietario?: boolean } = {}) {
  const { auth, db } = admin();
  const email = `${nome}@test.it`;
  const { uid } = await auth.createUser({ email, password: "password-test" });
  if (opz.superadmin) await auth.setCustomUserClaims(uid, { superadmin: true, ...(opz.proprietario && { proprietario: true }) });
  await db.doc(`users/${uid}`).set({
    nome, cognome: "Test", nomeVisualizzato: nome, email, telefono: "3330000000",
    superadmin: !!opz.superadmin, ...(opz.proprietario && { proprietario: true }), attivo: true, devoCambiarePassword: false,
    createdAt: FieldValue.serverTimestamp(), createdBy: "test",
    updatedAt: FieldValue.serverTimestamp(), updatedBy: "test",
  });
  return { uid, email };
}

const apps: FirebaseApp[] = [];

/** Client autenticato come `email`, con una funzione per chiamare le callable. */
export async function client(email: string) {
  const app = initClient({ apiKey: "demo-key", projectId: PROJECT_ID }, `c-${email}-${apps.length}`);
  apps.push(app);
  const auth = getClientAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email, "password-test");
  const functions = getFunctions(app, "europe-west1");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  return <O = Record<string, unknown>>(nome: string, data: unknown) =>
    httpsCallable<unknown, O>(functions, nome)(data).then((r) => r.data);
}

export async function chiudiClient() {
  await Promise.all(apps.splice(0).map((a) => deleteApp(a)));
}
