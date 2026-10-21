import { readFileSync } from "node:fs";
import { setLogLevel } from "firebase/firestore";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

export const PROJECT_ID = "demo-colleiano";

// I permessi negati sono attesi: niente avvisi a ogni scrittura rifiutata.
setLogLevel("silent");

/** Ambiente di test sugli emulatori Firestore e Storage avviati da `pnpm test:rules`. */
export function creaAmbiente(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
}
