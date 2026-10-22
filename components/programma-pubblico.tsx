"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { Testo } from "@/components/pubblico";
import { formatData, formatOra } from "@/lib/format";
import { adessoEDopo, perGiorno, statoEvento } from "@/lib/programma";
import type { EventoPubblico } from "@/lib/sito-pubblico";
import { cn } from "@/lib/utils";

/** Nome dei punti della mappa, per id: il luogo di un evento si apre sulla mappa. */
export type Luoghi = Record<string, string>;

/**
 * L'ora che conta è quella del telefono: la pagina può arrivare dalla cache (o, offline, dal service worker).
 * Il primo disegno usa l'ora del server, così non cambia nulla durante l'idratazione.
 */
function useOra(iniziale: number): number {
  const [ora, setOra] = useState(iniziale);
  useEffect(() => {
    const aggiorna = () => setOra(Date.now());
    aggiorna();
    const timer = setInterval(aggiorna, 30_000);
    return () => clearInterval(timer);
  }, []);
  return ora;
}

const orario = (e: EventoPubblico) => `${formatOra(new Date(e.inizio))}${e.fine ? ` – ${formatOra(new Date(e.fine))}` : ""}`;

function Luogo({ puntoId, luoghi, chiaro = false }: { puntoId?: string; luoghi: Luoghi; chiaro?: boolean }) {
  const nome = puntoId && luoghi[puntoId];
  if (!nome) return null;
  return (
    <Link
      href={`/mappa?punto=${puntoId}`}
      className={cn(
        "flex min-h-12 items-center gap-2 self-start font-medium underline underline-offset-4",
        chiaro ? "text-colleiano-linen" : "text-colleiano-forest",
      )}
    >
      <MapPin className="size-5 shrink-0" aria-hidden />
      {nome}
    </Link>
  );
}

/** Programma per orario (SPEC 7.1): ciò che è in corso è evidenziato, ciò che è finito è attenuato. */
export function ProgrammaVivo({ eventi, luoghi, ora: iniziale }: { eventi: EventoPubblico[]; luoghi: Luoghi; ora: number }) {
  const ora = useOra(iniziale);
  const giorni = perGiorno(eventi);
  return (
    <div className="flex flex-col gap-8">
      {giorni.map(({ giorno, eventi: delGiorno }) => {
        const titolo = formatData(new Date(delGiorno[0].inizio));
        return (
          <section key={giorno} aria-label={titolo} className="flex flex-col gap-3">
            {giorni.length > 1 && <h2 className="text-2xl font-bold first-letter:uppercase">{titolo}</h2>}
            <ol className="flex flex-col gap-3">
              {delGiorno.map((e) => {
                const stato = statoEvento(e, eventi, ora);
                return (
                  <li
                    key={e.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg bg-white p-5 shadow-sm ring-1 ring-colleiano-forest/10",
                      stato === "in_corso" && "ring-4 ring-colleiano-rust",
                      stato === "finito" && "bg-white/60 shadow-none",
                    )}
                  >
                    <p className="flex flex-wrap items-center gap-2 font-bold tracking-wide text-colleiano-rust">
                      <Clock className="size-5" aria-hidden />
                      {orario(e)}
                      {stato === "in_corso" && <span className="rounded-full bg-colleiano-rust px-3 py-0.5 text-sm text-white">Adesso</span>}
                      {stato === "finito" && <span className="text-sm font-medium text-colleiano-slate/80">Finito</span>}
                    </p>
                    <h3 className={cn("text-2xl font-bold", stato === "finito" && "text-colleiano-slate/80")}>{e.titolo}</h3>
                    <Luogo puntoId={e.puntoId} luoghi={luoghi} />
                    {e.descrizione && <Testo testo={e.descrizione} className={cn("gap-2 text-base", stato === "finito" && "text-colleiano-slate/80")} />}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

/** In cima alla home in modalità festa: cosa sta succedendo adesso e cosa c'è dopo. */
export function AdessoDopo({ eventi, luoghi, ora: iniziale }: { eventi: EventoPubblico[]; luoghi: Luoghi; ora: number }) {
  const ora = useOra(iniziale);
  const { adesso, dopo } = adessoEDopo(eventi, ora);
  if (eventi.length === 0) return null;
  if (adesso.length === 0 && dopo.length === 0) {
    return <p className="text-xl text-colleiano-linen">Il programma di oggi è finito. Grazie di essere stati con noi!</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {adesso.length > 0 && <Riquadro titolo="Adesso" eventi={adesso} luoghi={luoghi} />}
      {dopo.length > 0 && <Riquadro titolo="Dopo" eventi={dopo} luoghi={luoghi} />}
    </div>
  );
}

function Riquadro({ titolo, eventi, luoghi }: { titolo: string; eventi: EventoPubblico[]; luoghi: Luoghi }) {
  return (
    <section aria-label={titolo} className="flex flex-col gap-2 rounded-lg bg-colleiano-linen/10 p-4 ring-1 ring-colleiano-linen/30">
      <h2 className="text-sm font-bold tracking-widest text-colleiano-linen/90 uppercase">{titolo}</h2>
      <ul className="flex flex-col gap-2">
        {eventi.map((e) => (
          <li key={e.id} className="flex flex-col">
            <p className="text-2xl font-bold text-colleiano-linen">
              <span className="text-colleiano-linen/90">{formatOra(new Date(e.inizio))}</span> {e.titolo}
            </p>
            <Luogo puntoId={e.puntoId} luoghi={luoghi} chiaro />
          </li>
        ))}
      </ul>
    </section>
  );
}
