import { addDays, format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { FUSO } from "./format";

// Il programma della festa nel tempo (SPEC 7.1): cosa è in corso, cosa è finito, cosa c'è dopo.
// Le date sono millisecondi: così funziona uguale sul server, nel browser e offline.

type Evento = { inizio: number; fine?: number };
export type StatoEvento = "finito" | "in_corso" | "futuro";

/** Un evento senza fine dura fino al successivo, ma al massimo due ore. */
export const DURATA_MASSIMA = 2 * 60 * 60 * 1000;

export function fineStimata(e: Evento, eventi: Evento[]): number {
  if (e.fine !== undefined) return e.fine;
  const prossimo = eventi.reduce<number | undefined>((min, x) => (x.inizio > e.inizio && (min === undefined || x.inizio < min) ? x.inizio : min), undefined);
  return Math.min(prossimo ?? Infinity, e.inizio + DURATA_MASSIMA);
}

export function statoEvento(e: Evento, eventi: Evento[], ora: number): StatoEvento {
  if (ora < e.inizio) return "futuro";
  return ora < fineStimata(e, eventi) ? "in_corso" : "finito";
}

/** Per la home in modalità festa: gli eventi in corso e quelli che iniziano subito dopo (alla stessa ora). */
export function adessoEDopo<E extends Evento>(eventi: E[], ora: number): { adesso: E[]; dopo: E[] } {
  const adesso = eventi.filter((e) => statoEvento(e, eventi, ora) === "in_corso");
  const futuri = eventi.filter((e) => e.inizio > ora);
  const prossimo = Math.min(...futuri.map((e) => e.inizio));
  return { adesso, dopo: futuri.filter((e) => e.inizio === prossimo) };
}

/** Eventi divisi per giorno (in Italia), nell'ordine dato. */
export function perGiorno<E extends Evento>(eventi: E[]): { giorno: string; eventi: E[] }[] {
  const gruppi: { giorno: string; eventi: E[] }[] = [];
  for (const e of eventi) {
    const giorno = format(new TZDate(e.inizio, FUSO), "yyyy-MM-dd");
    const ultimo = gruppi.at(-1);
    if (ultimo?.giorno === giorno) ultimo.eventi.push(e);
    else gruppi.push({ giorno, eventi: [e] });
  }
  return gruppi;
}

/** Giorno ("AAAA-MM-GG") e ora ("HH:mm") italiani → istante. */
export function momentoDaInput(giorno: string, ora: string): Date {
  const [a, m, g] = giorno.split("-").map(Number);
  const [h, min] = ora.split(":").map(Number);
  return new Date(new TZDate(a, m - 1, g, h, min, FUSO).getTime());
}

/** Inizio e fine dal form: se la fine viene prima dell'inizio, è dopo mezzanotte. */
export function orariDaInput(giorno: string, inizio: string, fine: string): { inizio: Date; fine?: Date } {
  const da = momentoDaInput(giorno, inizio);
  if (!fine) return { inizio: da };
  let a = momentoDaInput(giorno, fine);
  if (a <= da) a = momentoDaInput(format(addDays(new TZDate(da.getTime(), FUSO), 1), "yyyy-MM-dd"), fine);
  return { inizio: da, fine: a };
}

/** L'ora della richiesta, per il primo disegno delle pagine dinamiche (dopo connection()). */
export const oraDelServer = () => Date.now();
