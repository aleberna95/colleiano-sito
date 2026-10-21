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

export type DiffCampo = { prima?: unknown; dopo?: unknown };

const CAMPI_TASK = [
  "titolo", "descrizione", "commissioneId", "responsabileUid", "stato", "priorita", "scadenza",
  "motivoBlocco", "motivoRifiuto", "checklist", "link", "eliminato",
] as const;

type ValoriTask = Partial<Record<(typeof CAMPI_TASK)[number], unknown>>;

function confrontabile(v: unknown): unknown {
  if (v && typeof v === "object" && "toMillis" in v && typeof v.toMillis === "function") return v.toMillis();
  return v === undefined ? null : JSON.stringify(v);
}

/** Valore da salvare nello storico: per checklist e link basta il conteggio. */
function riassunto(campo: string, v: unknown): unknown {
  if (campo === "checklist" && Array.isArray(v)) return `${v.filter((x) => x?.fatto).length}/${v.length}`;
  if ((campo === "link" || campo === "scontrini") && Array.isArray(v)) return v.length;
  return v ?? null;
}

type Voce = { azione: string; diff?: Record<string, DiffCampo> };

function differenze(campi: readonly string[], prima: Record<string, unknown>, dopo: Record<string, unknown>) {
  const diff: Record<string, DiffCampo> = {};
  for (const campo of campi) {
    if (confrontabile(prima[campo]) !== confrontabile(dopo[campo])) {
      diff[campo] = { prima: riassunto(campo, prima[campo]), dopo: riassunto(campo, dopo[campo]) };
    }
  }
  return diff;
}

/** Voce di storico per una scrittura su un task (la usa il trigger delle Functions). null = niente da registrare. */
export function vocePerTask(prima: ValoriTask | undefined, dopo: ValoriTask): Voce | null {
  if (!prima) return { azione: dopo.stato === "richiesta" ? "richiesta" : "creato" };
  const diff = differenze(CAMPI_TASK, prima, dopo);
  if (!Object.keys(diff).length) return null;
  const azione = diff.stato ? "stato" : diff.responsabileUid ? "assegnato" : diff.commissioneId ? "spostato" : "modificato";
  return { azione, diff };
}

const CAMPI_MOVIMENTO = [
  "commissioneId", "descrizione", "importoCents", "categoria", "dataSpesa", "pagatoDa",
  "stato", "motivo", "autoApprovata", "rimborsoId", "scontrini", "eliminato",
] as const;

/** Voce di storico per una scrittura su un movimento. */
export function vocePerMovimento(prima: Record<string, unknown> | undefined, dopo: Record<string, unknown>): Voce | null {
  if (!prima) return { azione: "creato" };
  const diff = differenze(CAMPI_MOVIMENTO, prima, dopo);
  if (!Object.keys(diff).length) return null;
  const azione = diff.stato ? "stato" : diff.eliminato ? "ritirato" : "modificato";
  return { azione, diff };
}
