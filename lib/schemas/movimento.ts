import { z } from "zod";
import { auditSchema, centsSchema, timestampSchema, uidSchema } from "./common";

export const tipoMovimentoSchema = z.enum(["spesa", "entrata"]);
export const statoMovimentoSchema = z.enum([
  "in_attesa",
  "approvata",
  "rifiutata",
  "rimborsata",
  "annullata",
]);
export type StatoMovimento = z.infer<typeof statoMovimentoSchema>;

export const pagatoDaSchema = z.object({
  tipo: z.enum(["cassa", "anticipata"]),
  beneficiarioUid: uidSchema.optional(),
  beneficiarioNome: z.string().optional(),
});

// feste/{f}/movimenti/{movId}
// stato, approvatoDa e rimborsoId li scrivono solo le Functions (SPEC 4.6)
export const movimentoSchema = auditSchema.extend({
  tipo: tipoMovimentoSchema,
  commissioneId: z.string().min(1),
  descrizione: z.string().trim().min(1),
  importoCents: centsSchema.positive(),
  categoria: z.string().min(1),
  dataSpesa: timestampSchema,
  pagatoDa: pagatoDaSchema,
  stato: statoMovimentoSchema,
  motivo: z.string().optional(),
  approvatoDa: uidSchema.optional(),
  approvatoAt: timestampSchema.optional(),
  rimborsoId: z.string().optional(),
  scontrini: z.array(z.object({ path: z.string(), nome: z.string(), mime: z.string() })),
  eliminato: z.boolean(),
});
export type Movimento = z.infer<typeof movimentoSchema>;
