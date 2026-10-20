import { z } from "zod";
import { timestampSchema, uidSchema } from "./common";

// feste/{f}/storico/{id} (solo Functions, append-only)
export const storicoSchema = z.object({
  entita: z.enum(["task", "movimento", "membro"]),
  entitaId: z.string(),
  azione: z.string(),
  attoreUid: uidSchema,
  diff: z.record(z.string(), z.unknown()).optional(),
  at: timestampSchema,
});
export type Storico = z.infer<typeof storicoSchema>;
