import { z } from "zod";
import { auditSchema, centsSchema, uidSchema } from "./common";

// Lista chiusa di tinte pastello (SPEC 9.2)
export const coloreCommissioneSchema = z.enum([
  "giallo",
  "arancio",
  "viola",
  "verde",
  "rosso",
  "blu",
  "teal",
  "grigio",
]);
export type ColoreCommissione = z.infer<typeof coloreCommissioneSchema>;

// feste/{f}/commissioni/{commId}
export const commissioneSchema = auditSchema.extend({
  nome: z.string().trim().min(1),
  descrizione: z.string().optional(),
  icona: z.string().min(1),
  colore: coloreCommissioneSchema,
  ordine: z.number().int(),
  generale: z.boolean(),
  budgetCents: centsSchema.optional(),
  // denormalizzati da membri, via Function
  referentiUids: z.array(uidSchema),
  componentiUids: z.array(uidSchema),
});
export type Commissione = z.infer<typeof commissioneSchema>;
