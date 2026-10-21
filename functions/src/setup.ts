import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";

// Importato per primo da index.ts: le opzioni devono valere prima che le funzioni vengano definite.
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });
initializeApp();
