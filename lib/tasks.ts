import { STATI_APERTI, type Membro, type StatoTask, type Task } from "./schemas";
import { giorniAlla } from "./format";

export type TaskConId = Task & { id: string };

/** Parole di tutti i giorni (SPEC 9.1). */
export const NOMI_STATO: Record<StatoTask, string> = {
  richiesta: "Richiesta",
  da_fare: "Da fare",
  in_corso: "Ci sto lavorando",
  bloccato: "Bloccato",
  fatto: "Fatto",
  annullato: "Annullato",
};

export const CLASSI_STATO: Record<StatoTask, string> = {
  richiesta: "border-colleiano-rust/40 bg-colleiano-rust/10 text-colleiano-rust",
  da_fare: "border-colleiano-forest/25 bg-colleiano-forest/5 text-colleiano-forest",
  in_corso: "border-blue-300 bg-blue-50 text-blue-900",
  bloccato: "border-red-300 bg-red-50 text-red-900",
  fatto: "border-green-300 bg-green-50 text-green-900",
  annullato: "border-stone-300 bg-stone-100 text-stone-700",
};

export const aperto = (t: Pick<Task, "stato">) => STATI_APERTI.includes(t.stato);

/** Giorni alla scadenza (negativi = scaduto), solo per i task aperti. */
export function giorniAllaScadenza(t: Pick<Task, "stato" | "scadenza">): number | undefined {
  return t.scadenza && aperto(t) ? giorniAlla(t.scadenza) : undefined;
}

export const scaduto = (t: Pick<Task, "stato" | "scadenza">) => (giorniAllaScadenza(t) ?? 0) < 0;

/** Scaduti, poi di oggi, poi per scadenza; gli urgenti prima a parità. */
export function ordinaPerScadenza<T extends Pick<Task, "stato" | "scadenza" | "priorita" | "titolo">>(tasks: T[]): T[] {
  const chiave = (t: T) => giorniAllaScadenza(t) ?? Number.MAX_SAFE_INTEGER;
  return [...tasks].sort(
    (a, b) =>
      chiave(a) - chiave(b) ||
      (a.priorita === "urgente" ? -1 : 0) - (b.priorita === "urgente" ? -1 : 0) ||
      a.titolo.localeCompare(b.titolo),
  );
}

export type FiltroTask = "aperti" | "scaduti" | "da_assegnare" | "richieste" | "chiusi";

export const NOMI_FILTRO: Record<FiltroTask, string> = {
  aperti: "Da chiudere",
  scaduti: "Scaduti",
  da_assegnare: "Da assegnare",
  richieste: "Richieste",
  chiusi: "Fatti e annullati",
};

export function filtraTask(
  tasks: TaskConId[],
  f: { filtro: FiltroTask; commissioneId?: string; persona?: string },
): TaskConId[] {
  return tasks.filter((t) => {
    if (t.eliminato) return false;
    if (f.commissioneId && t.commissioneId !== f.commissioneId) return false;
    if (f.persona && t.responsabileUid !== f.persona) return false;
    switch (f.filtro) {
      case "aperti":
        return aperto(t);
      case "scaduti":
        return scaduto(t);
      case "da_assegnare":
        return t.stato === "da_fare" && t.responsabileUid === null;
      case "richieste":
        return t.stato === "richiesta";
      case "chiusi":
        return t.stato === "fatto" || t.stato === "annullato";
    }
  });
}

/** "Scaduto da 2 giorni", "Oggi", "Domani", "Tra 5 giorni". */
export function testoScadenza(giorni: number): string {
  if (giorni < -1) return `Scaduto da ${-giorni} giorni`;
  if (giorni === -1) return "Scaduto ieri";
  if (giorni === 0) return "Scade oggi";
  if (giorni === 1) return "Scade domani";
  return `Tra ${giorni} giorni`;
}

/** Chi avvisare di una richiesta: i referenti della commissione, se non ce ne sono gli admin. */
export function destinatariRichiesta(membri: Membro[], commissioneId: string): Membro[] {
  const attivi = membri.filter((m) => m.attivo);
  const referenti = attivi.filter((m) => m.commissioni[commissioneId] === "referente");
  return referenti.length ? referenti : attivi.filter((m) => m.ruoloFesta === "admin");
}
