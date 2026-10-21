import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type {
  AggiornaRuoliInput,
  AnnullaMovimentoInput,
  AnnullaRimborsoInput,
  DecidiSpeseInput,
  MovimentoInput,
  RegistraEntrataInput,
  RegistraRimborsoInput,
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
  { uid: string; nomeVisualizzato: string; email: string; telefono: string; nuovoAccount: boolean }
>("creaPersona");
export const aggiornaRuoli = callable<AggiornaRuoliInput, { ok: true }>("aggiornaRuoli");
export const disattivaPersona = callable<DisattivaPersonaInput, { ok: true }>("disattivaPersona");
export const nuovaPasswordTemporanea = callable<NuovaPasswordInput, Credenziali & { password: string; nome: string }>(
  "nuovaPasswordTemporanea",
);
export const impostaSuperadmin = callable<ImpostaSuperadminInput, { ok: true }>("impostaSuperadmin");

export const decidiSpese = callable<DecidiSpeseInput, { ok: true; quante: number }>("decidiSpese");
export const ripresentaSpesa = callable<MovimentoInput, { ok: true }>("ripresentaSpesa");
export const annullaMovimento = callable<AnnullaMovimentoInput, { ok: true }>("annullaMovimento");
export const registraEntrata = callable<RegistraEntrataInput, { movimentoId: string }>("registraEntrata");
export const registraRimborso = callable<RegistraRimborsoInput, { rimborsoId: string; totaleCents: number }>("registraRimborso");
export const annullaRimborso = callable<AnnullaRimborsoInput, { ok: true }>("annullaRimborso");

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
