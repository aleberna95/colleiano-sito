import { z } from "zod";
import { coloreCommissioneSchema } from "./commissione";
import { ruoloCommissioneSchema, ruoloFestaSchema } from "./membro";

// Input delle callable Functions: stessi schemi per i form del client e per il server.

/** Data del calendario "AAAA-MM-GG" (dagli <input type="date">). */
export const dataGiornoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");

/** Telefono italiano o internazionale: solo cifre, spazi e un + iniziale. */
export const telefonoSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s]{6,20}$/, "Scrivi un numero di telefono valido");

export const creaFestaInput = z.object({
  nome: z.string().trim().min(3, "Almeno 3 caratteri").max(80),
  dataFesta: dataGiornoSchema.optional(),
  luogo: z.string().trim().max(120).optional(),
});
export type CreaFestaInput = z.infer<typeof creaFestaInput>;

export const commissioniRuoliSchema = z.record(z.string().min(1), ruoloCommissioneSchema);

export const creaPersonaInput = z.object({
  festaId: z.string().min(1),
  nome: z.string().trim().min(1, "Scrivi il nome").max(60),
  cognome: z.string().trim().min(1, "Scrivi il cognome").max(60),
  email: z.email("Scrivi un'email valida"),
  telefono: telefonoSchema,
  ruoloFesta: ruoloFestaSchema,
  commissioni: commissioniRuoliSchema,
});
export type CreaPersonaInput = z.infer<typeof creaPersonaInput>;

export const aggiornaRuoliInput = z.object({
  festaId: z.string().min(1),
  uid: z.string().min(1),
  ruoloFesta: ruoloFestaSchema.optional(),
  /** Mappa completa desiderata. */
  commissioni: commissioniRuoliSchema,
});
export type AggiornaRuoliInput = z.infer<typeof aggiornaRuoliInput>;

export const disattivaPersonaInput = z.object({
  /** Con festaId: tolta da quella festa. Senza: account disattivato ovunque (solo superadmin). */
  festaId: z.string().min(1).optional(),
  uid: z.string().min(1),
});
export type DisattivaPersonaInput = z.infer<typeof disattivaPersonaInput>;

export const nuovaPasswordInput = z.object({
  festaId: z.string().min(1).optional(),
  uid: z.string().min(1),
});
export type NuovaPasswordInput = z.infer<typeof nuovaPasswordInput>;

export const impostaSuperadminInput = z.object({
  uid: z.string().min(1),
  superadmin: z.boolean(),
});
export type ImpostaSuperadminInput = z.infer<typeof impostaSuperadminInput>;

/** Form commissione (scrittura diretta su Firestore, non callable). */
export const commissioneFormSchema = z.object({
  nome: z.string().trim().min(2, "Almeno 2 caratteri").max(40),
  descrizione: z.string().trim().max(500).optional(),
  colore: coloreCommissioneSchema,
  budgetEuro: z.string().trim().regex(/^(\d+([.,]\d{1,2})?)?$/, "Scrivi un importo, es. 150 o 150,50").optional(),
});
export type CommissioneForm = z.infer<typeof commissioneFormSchema>;

// ---- Spese e rimborsi (SPEC 4.5, 6.4) ----

const idsSchema = z.array(z.string().min(1)).min(1, "Scegli almeno una spesa").max(100);
const motivoSchema = z.string().trim().min(3, "Scrivi il motivo").max(500);

/** Importo scritto in euro: "25", "25,50", "25.5". */
export const importoEuroSchema = z
  .string()
  .trim()
  .regex(/^\d{1,6}([.,]\d{1,2})?$/, "Scrivi l'importo, es. 25 o 25,50")
  .refine((v) => Number(v.replace(",", ".")) > 0, "L'importo deve essere più di zero");

export const decidiSpeseInput = z.object({
  festaId: z.string().min(1),
  movimentiIds: idsSchema,
  azione: z.enum(["approva", "rifiuta"]),
  motivo: motivoSchema.optional(),
});
export type DecidiSpeseInput = z.infer<typeof decidiSpeseInput>;

export const movimentoInput = z.object({ festaId: z.string().min(1), movimentoId: z.string().min(1) });
export type MovimentoInput = z.infer<typeof movimentoInput>;

export const annullaMovimentoInput = movimentoInput.extend({ motivo: motivoSchema });
export type AnnullaMovimentoInput = z.infer<typeof annullaMovimentoInput>;

export const registraEntrataInput = z.object({
  festaId: z.string().min(1),
  commissioneId: z.string().min(1),
  descrizione: z.string().trim().min(1, "Scrivi da dove arrivano i soldi").max(200),
  importoCents: z.number().int().positive().max(10_000_000),
  categoria: z.string().trim().min(1).max(60),
  dataSpesa: dataGiornoSchema,
});
export type RegistraEntrataInput = z.infer<typeof registraEntrataInput>;

export const registraRimborsoInput = z.object({
  festaId: z.string().min(1),
  movimentiIds: idsSchema,
  modalita: z.enum(["contanti", "bonifico", "altro"]),
  data: dataGiornoSchema,
  nota: z.string().trim().max(300).optional(),
});
export type RegistraRimborsoInput = z.infer<typeof registraRimborsoInput>;

export const annullaRimborsoInput = z.object({ festaId: z.string().min(1), rimborsoId: z.string().min(1), motivo: motivoSchema });
export type AnnullaRimborsoInput = z.infer<typeof annullaRimborsoInput>;

/** Form "Nuova spesa" (scrittura diretta su Firestore, protetta dalle regole). */
export const spesaFormSchema = z.object({
  importoEuro: importoEuroSchema,
  descrizione: z.string().trim().min(1, "Scrivi cosa hai comprato").max(200),
  commissioneId: z.string().min(1, "Scegli la commissione"),
  categoria: z.string().min(1),
  dataSpesa: dataGiornoSchema,
  chiHaPagato: z.enum(["cassa", "io", "altro"]),
  /** Con "altro": uid scelto dall'elenco oppure "" e nome scritto a mano. */
  beneficiarioUid: z.string(),
  beneficiarioNome: z.string().trim().max(80),
});
export type SpesaForm = z.infer<typeof spesaFormSchema>;
