import { z } from "zod";
import { auditSchema, centsSchema, timestampSchema, urlImmagineSchema } from "./common";

export const statoFestaSchema = z.enum([
  "preparazione",
  "in_corso",
  "conclusa",
  "archiviata",
]);
export type StatoFesta = z.infer<typeof statoFestaSchema>;

export const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// Campo paginaPubblica di feste/{f} (Fase 2, SPEC 7.3): lo modificano gli admin della festa.
export const paginaPubblicaSchema = z.object({
  testo: z.string().max(5000).optional(),
  copertina: urlImmagineSchema.optional(),
  galleria: z.array(urlImmagineSchema).max(30),
});
export type PaginaPubblica = z.infer<typeof paginaPubblicaSchema>;

// feste/{festaId}
export const festaSchema = auditSchema.extend({
  nome: z.string().trim().min(1),
  slug: slugSchema,
  dataFesta: timestampSchema.optional(),
  luogo: z.string().optional(),
  stato: statoFestaSchema,
  budgetTotaleCents: centsSchema.optional(),
  categorieSpesa: z.array(z.string().trim().min(1)),
  // Sito pubblico (Fase 2): copiati da una Function in sitoFeste/{festaId}.
  modalitaFesta: z.boolean().optional(),
  inArchivioPubblico: z.boolean().optional(),
  paginaPubblica: paginaPubblicaSchema.optional(),
});
export type Festa = z.infer<typeof festaSchema>;
