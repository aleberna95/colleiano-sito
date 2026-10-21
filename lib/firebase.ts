import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signOut } from "firebase/auth";
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// In sviluppo si usano gli emulatori (progetto finto demo-colleiano).
// In produzione la configurazione web (pubblica, non segreta) arriva da apphosting.yaml.
const useEmulators =
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
  (process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_EMULATORS !== "false");

export const REGION = "europe-west1";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function createApp(): FirebaseApp {
  if (getApps().length) return getApp();
  // Senza configurazione (es. build in CI) si usa il progetto finto: nessuna chiamata reale.
  if (useEmulators || !config.apiKey) {
    return initializeApp({
      apiKey: "demo-key",
      projectId: "demo-colleiano",
      storageBucket: "demo-colleiano.appspot.com",
    });
  }
  return initializeApp(config);
}

export const app = createApp();
export const auth = getAuth(app);
/** Nel browser i dati restano sul telefono: si consulta e si scrive anche senza rete (SPEC 9.1). */
function createDb(): Firestore {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    // Già inizializzato (ricaricamento a caldo in sviluppo).
    return getFirestore(app);
  }
}

export const db = createDb();

/** Esci e cancella i dati della festa salvati sul telefono (che può essere di qualcun altro). */
export async function esci() {
  await signOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Se non si riesce a cancellare la copia locale, l'uscita vale comunque.
  }
  // Ricaricamento completo: Firestore è chiuso e va riaperto da zero.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/gestione/login");
}
export const storage = getStorage(app);
export const functions = getFunctions(app, REGION);

const globalForEmulators = globalThis as { __emulatorsConnected?: boolean };
if (useEmulators && !globalForEmulators.__emulatorsConnected) {
  globalForEmulators.__emulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
