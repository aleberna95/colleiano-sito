import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
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
export const db = getFirestore(app);
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
