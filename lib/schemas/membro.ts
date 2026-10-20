import { z } from "zod";
import { auditSchema, uidSchema } from "./common";

export const ruoloFestaSchema = z.enum(["admin", "membro"]);
export const ruoloCommissioneSchema = z.enum(["referente", "componente"]);
export type RuoloFesta = z.infer<typeof ruoloFestaSchema>;
export type RuoloCommissione = z.infer<typeof ruoloCommissioneSchema>;

// feste/{f}/membri/{uid} (scrittura solo Functions)
export const membroSchema = auditSchema.extend({
  uid: uidSchema,
  nomeVisualizzato: z.string().trim().min(1),
  telefono: z.string().trim().min(6),
  ruoloFesta: ruoloFestaSchema,
  commissioni: z.record(z.string(), ruoloCommissioneSchema),
  attivo: z.boolean(),
});
export type Membro = z.infer<typeof membroSchema>;
