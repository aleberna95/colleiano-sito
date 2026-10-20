import { z } from "zod";
import { auditSchema, timestampSchema, uidSchema } from "./common";

export const statoTaskSchema = z.enum([
  "richiesta",
  "da_fare",
  "in_corso",
  "bloccato",
  "fatto",
  "annullato",
]);
export type StatoTask = z.infer<typeof statoTaskSchema>;

export const prioritaSchema = z.enum(["normale", "urgente"]);

// feste/{f}/tasks/{taskId}
export const taskSchema = auditSchema.extend({
  titolo: z.string().trim().min(1).max(200),
  descrizione: z.string().optional(),
  commissioneId: z.string().min(1),
  responsabileUid: uidSchema.nullable(),
  stato: statoTaskSchema,
  richiestoDa: uidSchema.optional(),
  motivoBlocco: z.string().optional(),
  motivoRifiuto: z.string().optional(),
  priorita: prioritaSchema,
  scadenza: timestampSchema.optional(),
  checklist: z.array(
    z.object({ id: z.string(), testo: z.string().trim().min(1), fatto: z.boolean() }),
  ),
  link: z.array(z.object({ titolo: z.string().trim().min(1), url: z.url() })),
  eliminato: z.boolean(),
});
export type Task = z.infer<typeof taskSchema>;

// feste/{f}/tasks/{taskId}/commenti/{id}
export const commentoSchema = z.object({
  testo: z.string().trim().min(1),
  autoreUid: uidSchema,
  createdAt: timestampSchema,
});
export type Commento = z.infer<typeof commentoSchema>;

// feste/{f}/tasks/{taskId}/allegati/{id}
export const allegatoSchema = z.object({
  nome: z.string().min(1),
  mime: z.string().min(1),
  path: z.string().min(1),
});
export type Allegato = z.infer<typeof allegatoSchema>;
