import { z } from "zod";
import { auditSchema, timestampSchema, uidSchema } from "./common";
import { dataGiornoSchema } from "./callable";

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
  modificatoAt: timestampSchema.optional(),
});
export type Commento = z.infer<typeof commentoSchema>;

// feste/{f}/tasks/{taskId}/allegati/{id}
export const allegatoSchema = z.object({
  nome: z.string().min(1),
  mime: z.string().min(1),
  path: z.string().min(1),
  createdAt: timestampSchema,
  createdBy: uidSchema,
});
export type Allegato = z.infer<typeof allegatoSchema>;

/** Stati in cui un task è ancora da chiudere. */
export const STATI_APERTI: StatoTask[] = ["da_fare", "in_corso", "bloccato"];

/** Form "Nuovo task" (scrittura diretta su Firestore, protetta dalle regole). */
export const taskFormSchema = z.object({
  titolo: z.string().trim().min(1, "Scrivi cosa c'è da fare").max(200),
  commissioneId: z.string().min(1, "Scegli la commissione"),
  /** "" = da assegnare */
  responsabileUid: z.string(),
  scadenza: z.union([dataGiornoSchema, z.literal("")]),
  descrizione: z.string().trim().max(2000).optional(),
  urgente: z.boolean(),
});
export type TaskForm = z.infer<typeof taskFormSchema>;

export const commentoFormSchema = z.object({
  testo: z.string().trim().min(1, "Scrivi qualcosa").max(2000),
});

/** Link aggiunto a un task: l'indirizzo deve essere completo. */
export const linkFormSchema = z.object({
  titolo: z.string().trim().min(1, "Scrivi un nome per il link").max(100),
  url: z.url({ protocol: /^https?$/, error: "Scrivi un indirizzo completo, es. https://..." }),
});
