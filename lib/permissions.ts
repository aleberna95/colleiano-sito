// Replica di firestore.rules e dei controlli delle Functions, solo per decidere cosa mostrare.
// La fonte di verità restano le regole: tests/rules/permissions.test.ts verifica che coincidano.
import type { Commento, Festa, Membro, Movimento, RuoloFesta, StatoTask, Task } from "./schemas";

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

// ---- Task e richieste (SPEC 4.4) ----

type TaskPerPermessi = Pick<Task, "commissioneId" | "responsabileUid" | "stato" | "createdBy" | "richiestoDa">;

/** Persone a cui posso dare un task della commissione; `daAssegnare`: posso lasciarlo senza responsabile. */
export function assegnabili(io: Io, membri: Membro[], commId: string): { persone: Membro[]; daAssegnare: boolean } {
  const attivi = membri.filter((m) => m.attivo);
  if (isAdmin(io)) return { persone: attivi, daAssegnare: true };
  const mio = membroAttivo(io)?.commissioni[commId];
  if (mio === "referente") return { persone: attivi.filter((m) => m.commissioni[commId]), daAssegnare: true };
  if (mio === "componente") return { persone: attivi.filter((m) => m.commissioni[commId] === "componente"), daAssegnare: false };
  return { persone: [], daAssegnare: false };
}

/** "task" se posso creare un task nella commissione, "richiesta" se posso solo chiederlo a loro. */
export function creazioneTask(io: Io, festa: Pick<Festa, "stato">, commId: string): "task" | "richiesta" | null {
  if (!scrivibile(io, festa)) return null;
  if (isAdmin(io)) return "task";
  const membro = membroAttivo(io);
  if (!membro) return null;
  return membro.commissioni[commId] ? "task" : "richiesta";
}

export type PermessiTask = {
  /** Admin o referente della commissione: tutto, anche assegnare e accettare le richieste. */
  gestisce: boolean;
  spostaCommissione: boolean;
  /** Stati in cui posso portare il task. */
  stati: StatoTask[];
  /** Titolo, descrizione, scadenza, priorità. */
  dati: boolean;
  /** Checklist e link. */
  lavoro: boolean;
  allegati: boolean;
};

const TUTTI_GLI_STATI: StatoTask[] = ["richiesta", "da_fare", "in_corso", "bloccato", "fatto", "annullato"];
const STATI_RESPONSABILE: StatoTask[] = ["da_fare", "in_corso", "bloccato", "fatto"];

export function permessiTask(io: Io, festa: Pick<Festa, "stato">, task: TaskPerPermessi): PermessiTask {
  const p: PermessiTask = { gestisce: false, spostaCommissione: false, stati: [], dati: false, lavoro: false, allegati: false };
  if (!scrivibile(io, festa)) return p;
  const membro = membroAttivo(io);
  const stati = new Set<StatoTask>();

  if (isAdmin(io) || isReferente(io, task.commissioneId)) {
    TUTTI_GLI_STATI.forEach((s) => stati.add(s));
    Object.assign(p, { gestisce: true, spostaCommissione: isAdmin(io), dati: true, lavoro: true, allegati: true });
  }
  if (membro) {
    const proprio = task.createdBy === io.uid && !task.richiestoDa;
    if (task.responsabileUid === io.uid) {
      p.allegati = true;
      if (STATI_RESPONSABILE.includes(task.stato)) {
        STATI_RESPONSABILE.forEach((s) => stati.add(s));
        if (proprio) stati.add("annullato");
        p.lavoro = true;
        p.dati ||= proprio;
      }
    }
    if (proprio && task.stato === "da_fare") {
      stati.add("da_fare").add("annullato");
      p.dati = p.lavoro = true;
    }
    if (task.richiestoDa === io.uid && task.stato === "richiesta") {
      stati.add("richiesta").add("annullato");
      p.dati = p.lavoro = true;
    }
  }
  p.stati = TUTTI_GLI_STATI.filter((s) => stati.has(s));
  return p;
}

export function puoCommentare(io: Io, festa: Pick<Festa, "stato">): boolean {
  return scrivibile(io, festa) && (io.superadmin || !!membroAttivo(io));
}

export const MINUTI_MODIFICA_COMMENTO = 15;

export function puoModificareCommento(
  io: Io,
  festa: Pick<Festa, "stato">,
  task: Pick<Task, "commissioneId">,
  commento: Pick<Commento, "autoreUid" | "createdAt">,
  adesso = Date.now(),
): boolean {
  if (!scrivibile(io, festa)) return false;
  if (isAdmin(io) || isReferente(io, task.commissioneId)) return true;
  return !!membroAttivo(io) && commento.autoreUid === io.uid && adesso < commento.createdAt.toMillis() + MINUTI_MODIFICA_COMMENTO * 60_000;
}

/** Commissioni in cui posso creare un task o mandare una richiesta. */
export function commissioniPerTask<C extends { id: string }>(io: Io, festa: Pick<Festa, "stato">, commissioni: C[]): C[] {
  return commissioni.filter((c) => creazioneTask(io, festa, c.id));
}

// ---- Spese e rimborsi (SPEC 4.5) ----

type MovimentoPerPermessi = Pick<Movimento, "tipo" | "stato" | "createdBy" | "commissioneId" | "rimborsoId" | "pagatoDa">;

/** Spese sulle commissioni di cui faccio parte o su "Generale"; l'admin ovunque. */
export function puoInserireSpesa(io: Io, festa: Pick<Festa, "stato">, comm: { id: string; generale: boolean }): boolean {
  if (!scrivibile(io, festa)) return false;
  if (isAdmin(io)) return true;
  const membro = membroAttivo(io);
  return !!membro && (!!membro.commissioni[comm.id] || comm.generale);
}

export function commissioniPerSpesa<C extends { id: string; generale: boolean }>(io: Io, festa: Pick<Festa, "stato">, commissioni: C[]): C[] {
  return commissioni.filter((c) => puoInserireSpesa(io, festa, c));
}

/** Modificare o ritirare prima dell'approvazione: l'autore, i referenti della commissione, gli admin. */
export function puoModificareSpesa(io: Io, festa: Pick<Festa, "stato">, m: MovimentoPerPermessi): boolean {
  if (!scrivibile(io, festa) || m.tipo !== "spesa" || !["in_attesa", "rifiutata"].includes(m.stato)) return false;
  return (!!membroAttivo(io) && m.createdBy === io.uid) || isAdmin(io) || isReferente(io, m.commissioneId);
}

export const puoRipresentareSpesa = (io: Io, festa: Pick<Festa, "stato">, m: MovimentoPerPermessi) =>
  m.stato === "rifiutata" && puoModificareSpesa(io, festa, m);

export const spesaPropria = (io: Io, m: MovimentoPerPermessi) => m.createdBy === io.uid || m.pagatoDa.beneficiarioUid === io.uid;

/**
 * Approvare o rifiutare: admin, mai la propria spesa. `unicoAdmin`: c'è un solo superadmin e nessun altro admin,
 * allora può approvare anche le sue (lo decide la Function, qui serve solo per mostrare i pulsanti).
 */
export function puoDecidereSpesa(io: Io, festa: Pick<Festa, "stato">, m: MovimentoPerPermessi, unicoAdmin = false): boolean {
  if (!scrivibile(io, festa) || !isAdmin(io) || m.tipo !== "spesa" || m.stato !== "in_attesa") return false;
  return !spesaPropria(io, m) || (io.superadmin && unicoAdmin);
}

export const puoAnnullareMovimento = (io: Io, festa: Pick<Festa, "stato">, m: MovimentoPerPermessi) =>
  scrivibile(io, festa) && isAdmin(io) && m.stato === "approvata" && !m.rimborsoId;

/** Entrate, budget e rimborsi: admin. */
export const puoGestireCassa = (io: Io, festa: Pick<Festa, "stato">) => scrivibile(io, festa) && isAdmin(io);

export const puoAnnullareRimborso = (io: Io, festa: Pick<Festa, "stato">) => scrivibile(io, festa) && io.superadmin;

// ---- Sito pubblico (SPEC 7.1) ----

/** Testi del sito, festa in evidenza e archivio: solo superadmin. */
export const puoModificareSito = (io: Io) => io.superadmin;

/** Pagina pubblica (e modalità festa) di una festa: i suoi admin, finché non è archiviata. */
export function puoModificarePaginaFesta(io: Io, festa: Pick<Festa, "stato">): boolean {
  return io.superadmin || (isAdmin(io) && festa.stato !== "archiviata");
}

/** Programma, avvisi e mappa della festa: i suoi admin (SPEC 7.1). */
export const puoModificareProgramma = (io: Io, festa: Pick<Festa, "stato">) => scrivibile(io, festa) && isAdmin(io);
