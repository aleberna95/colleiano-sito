// Replica di firestore.rules e dei controlli delle Functions, solo per decidere cosa mostrare.
// La fonte di verità restano le regole: tests/rules/permissions.test.ts verifica che coincidano.
import type { Festa, Membro, RuoloFesta } from "./schemas";

export type Io = { uid: string; superadmin: boolean; membro?: Membro };

const membroAttivo = (io: Io) => (io.membro?.attivo ? io.membro : undefined);

export function isAdmin(io: Io): boolean {
  return io.superadmin || membroAttivo(io)?.ruoloFesta === "admin";
}

export function isReferente(io: Io, commId: string): boolean {
  return membroAttivo(io)?.commissioni[commId] === "referente";
}

export function scrivibile(io: Io, festa: Pick<Festa, "stato">): boolean {
  return io.superadmin || festa.stato !== "archiviata";
}

export const puoCreareFesta = (io: Io) => io.superadmin;
export const puoArchiviareFesta = (io: Io) => io.superadmin;

export function puoModificareFesta(io: Io, festa: Pick<Festa, "stato">): boolean {
  return io.superadmin || (isAdmin(io) && festa.stato !== "archiviata");
}

export function puoAggiungerePersone(io: Io, festa: Pick<Festa, "stato">): boolean {
  return isAdmin(io) && scrivibile(io, festa);
}

export function ruoliFestaAssegnabili(io: Io): RuoloFesta[] {
  return io.superadmin ? ["membro", "admin"] : ["membro"];
}

/** Ruolo nella festa, disattivazione, nuova password. */
export function puoGestirePersona(io: Io, festa: Pick<Festa, "stato">, target: Pick<Membro, "uid" | "ruoloFesta">): boolean {
  if (!scrivibile(io, festa) || target.uid === io.uid) return false;
  return io.superadmin || (isAdmin(io) && target.ruoloFesta !== "admin");
}

/** Commissioni in cui io posso aggiungere/togliere persone. */
export function puoGestireMembriCommissione(io: Io, festa: Pick<Festa, "stato">, commId: string): boolean {
  return scrivibile(io, festa) && (isAdmin(io) || isReferente(io, commId));
}

export const puoCreareCommissione = (io: Io, festa: Pick<Festa, "stato">) => isAdmin(io) && scrivibile(io, festa);

/** "tutto" per l'admin, "descrizione" per il referente, null altrimenti. */
export function modificaCommissione(io: Io, festa: Pick<Festa, "stato">, commId: string): "tutto" | "descrizione" | null {
  if (!scrivibile(io, festa)) return null;
  if (isAdmin(io)) return "tutto";
  if (isReferente(io, commId)) return "descrizione";
  return null;
}
