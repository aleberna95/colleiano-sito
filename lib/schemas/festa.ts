import { z } from "zod";
import { auditSchema, centsSchema, timestampSchema } from "./common";

export const statoFestaSchema = z.enum([
  "preparazione",
  "in_corso",
  "conclusa",
  "archiviata",
]);
export type StatoFesta = z.infer<typeof statoFestaSchema>;

export const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// feste/{festaId}
export const festaSchema = auditSchema.extend({
  nome: z.string().trim().min(1),
  slug: slugSchema,
  dataFesta: timestampSchema.optional(),
  luogo: z.string().optional(),
  stato: statoFestaSchema,
  budgetTotaleCents: centsSchema.optional(),
  categorieSpesa: z.array(z.string().trim().min(1)),
});
export type Festa = z.infer<typeof festaSchema>;
