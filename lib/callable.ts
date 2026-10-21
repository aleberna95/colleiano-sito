import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type {
  AggiornaRuoliInput,
  CreaFestaInput,
  CreaPersonaInput,
  DisattivaPersonaInput,
  ImpostaSuperadminInput,
  NuovaPasswordInput,
} from "./schemas";

function callable<I, O>(nome: string) {
  const fn = httpsCallable<I, O>(functions, nome);
  return async (input: I): Promise<O> => (await fn(input)).data;
}

type Credenziali = { email: string; telefono: string; password?: string };

export const creaFesta = callable<CreaFestaInput, { festaId: string; slug: string }>("creaFesta");
export const creaPersona = callable<
  CreaPersonaInput,
  Credenziali & { uid: string; nomeVisualizzato: string; nuovoAccount: boolean }
>("creaPersona");
export const aggiornaRuoli = callable<AggiornaRuoliInput, { ok: true }>("aggiornaRuoli");
export const disattivaPersona = callable<DisattivaPersonaInput, { ok: true }>("disattivaPersona");
export const nuovaPasswordTemporanea = callable<NuovaPasswordInput, Credenziali & { password: string; nome: string }>(
  "nuovaPasswordTemporanea",
);
export const impostaSuperadmin = callable<ImpostaSuperadminInput, { ok: true }>("impostaSuperadmin");

/** Messaggio da mostrare: le Functions rispondono già in italiano. */
export function erroreCallable(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "functions/unavailable" || err.code === "functions/deadline-exceeded") {
      return "Sei offline o la connessione è debole. Riprova.";
    }
    if (err.code !== "functions/internal" && err.message) return err.message;
  }
  return "Qualcosa è andato storto. Riprova.";
}
