import { z } from "zod";
import { auditSchema, centsSchema, timestampSchema, uidSchema } from "./common";

// feste/{f}/rimborsi/{id}
export const rimborsoSchema = auditSchema.extend({
  beneficiarioUid: uidSchema.optional(),
  beneficiarioNome: z.string().trim().min(1),
  movimentiIds: z.array(z.string()).min(1),
  totaleCents: centsSchema, // calcolato dalla Function
  modalita: z.enum(["contanti", "bonifico", "altro"]),
  data: timestampSchema,
  nota: z.string().optional(),
});
export type Rimborso = z.infer<typeof rimborsoSchema>;
