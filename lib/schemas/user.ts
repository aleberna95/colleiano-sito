import { z } from "zod";
import { auditSchema } from "./common";

// users/{uid}
export const userSchema = auditSchema.extend({
  nome: z.string().trim().min(1),
  cognome: z.string().trim().min(1),
  nomeVisualizzato: z.string().trim().min(1),
  email: z.email(),
  telefono: z.string().trim().min(6), // obbligatorio: serve per WhatsApp
  superadmin: z.boolean(),
  attivo: z.boolean(),
  devoCambiarePassword: z.boolean(),
  ultimaFestaId: z.string().optional(),
});
export type User = z.infer<typeof userSchema>;
