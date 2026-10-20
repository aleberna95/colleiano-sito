import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// In sviluppo si usano gli emulatori (progetto finto demo-colleiano).
// Su App Hosting la configurazione arriva da sola: initializeApp() senza argomenti.
const useEmulators =
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
  (process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_EMULATORS !== "false");

export const REGION = "europe-west1";

function createApp(): FirebaseApp {
  if (getApps().length) return getApp();
  if (useEmulators) {
    return initializeApp({ apiKey: "demo-key", projectId: "demo-colleiano" });
  }
  return initializeApp();
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
