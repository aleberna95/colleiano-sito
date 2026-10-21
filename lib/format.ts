import { differenceInCalendarDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";
import type { ColoreCommissione, RuoloCommissione, RuoloFesta, TimestampLike } from "./schemas";

export const FUSO = "Europe/Rome";

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

/** "150", "150,5", "150.50" → 15050. Stringa vuota → undefined. */
export function parseEuro(testo: string | undefined): number | undefined {
  const t = testo?.trim().replace(",", ".");
  if (!t) return undefined;
  return Math.round(Number(t) * 100);
}

export function centsInEuroTesto(cents: number | undefined): string {
  return cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
}

const inItalia = (ts: TimestampLike | Date) => new TZDate(ts instanceof Date ? ts : ts.toDate(), FUSO);

export function formatData(ts: TimestampLike | Date): string {
  return format(inItalia(ts), "EEEE d MMMM yyyy", { locale: it });
}

/** "AAAA-MM-GG" per <input type="date">. */
export function dataPerInput(ts: TimestampLike | undefined): string {
  return ts ? format(inItalia(ts), "yyyy-MM-dd") : "";
}

/** Giorno del calendario salvato a mezzogiorno UTC: resta lo stesso giorno in Italia. */
export function dataDaInput(giorno: string): Date {
  return new Date(`${giorno}T12:00:00Z`);
}

export function giorniAlla(ts: TimestampLike): number {
  return differenceInCalendarDays(inItalia(ts), inItalia(new Date()));
}

export const NOMI_RUOLO_FESTA: Record<RuoloFesta, string> = { admin: "Admin", membro: "Membro" };
export const NOMI_RUOLO_COMMISSIONE: Record<RuoloCommissione, string> = {
  referente: "Referente",
  componente: "Componente",
};

/** Tinte pastello con testo scuro, contrasto AA (SPEC 9.2). */
export const COLORI_COMMISSIONE: Record<ColoreCommissione, { nome: string; classi: string }> = {
  giallo: { nome: "Giallo", classi: "bg-yellow-100 text-yellow-900 border-yellow-300" },
  arancio: { nome: "Arancio", classi: "bg-orange-100 text-orange-900 border-orange-300" },
  viola: { nome: "Viola", classi: "bg-violet-100 text-violet-900 border-violet-300" },
  verde: { nome: "Verde", classi: "bg-green-100 text-green-900 border-green-300" },
  rosso: { nome: "Rosso", classi: "bg-red-100 text-red-900 border-red-300" },
  blu: { nome: "Blu", classi: "bg-blue-100 text-blue-900 border-blue-300" },
  teal: { nome: "Teal", classi: "bg-teal-100 text-teal-900 border-teal-300" },
  grigio: { nome: "Grigio", classi: "bg-stone-100 text-stone-800 border-stone-300" },
};

/** "ven 14 ago" */
export function formatGiorno(ts: TimestampLike | Date): string {
  return format(inItalia(ts), "EEE d MMM", { locale: it });
}

/** "14 ago, 18:30" */
export function formatQuando(ts: TimestampLike | Date): string {
  return format(inItalia(ts), "d MMM, HH:mm", { locale: it });
}
