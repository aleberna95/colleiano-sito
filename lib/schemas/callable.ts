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
