"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Clock, LayoutGrid, X } from "lucide-react";
import { Mappa } from "@/components/mappa";
import { formatOra } from "@/lib/format";
import { CATEGORIE, FILTRI, passaFiltro, type Filtro } from "@/lib/mappa";
import type { EventoPubblico, MappaPubblica } from "@/lib/sito-pubblico";
import { cn } from "@/lib/utils";

/** Mappa del sito (SPEC 7.1): bottoni enormi per filtrare, punti che pulsano, scheda grande dal basso. */
export function MappaPubblicaVista({ mappa, eventi }: { mappa: MappaPubblica; eventi: EventoPubblico[] }) {
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [selezionato, setSelezionato] = useState<string>();
  const visibili = mappa.punti.filter((p) => passaFiltro(p, filtro));
  // Solo i filtri che hanno almeno un punto.
  const filtri = FILTRI.filter((f) => mappa.punti.some((p) => passaFiltro(p, f.id)));
  const punto = mappa.punti.find((p) => p.id === selezionato);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Cosa cerchi?" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <BottoneFiltro attivo={filtro === null} onClick={() => setFiltro(null)} nome="Tutto" icona={LayoutGrid} colore="#1B3022" />
        {filtri.map((f) => (
          <BottoneFiltro key={f.id} attivo={filtro === f.id} onClick={() => setFiltro(f.id)} nome={f.nome} icona={f.icona} colore={f.colore} />
        ))}
      </div>

      <Mappa
        immagine={mappa.immagine}
        punti={visibili}
        selezionato={selezionato}
        onSeleziona={setSelezionato}
        pulsano={filtro !== null}
        className="h-[65svh] min-h-80"
      />

      <section aria-labelledby="titolo-punti" className="flex flex-col gap-3">
        <h2 id="titolo-punti" className="text-2xl font-bold">
          {filtro ? FILTRI.find((f) => f.id === filtro)?.nome : "Tutti i punti"}
        </h2>
        <ul className="flex flex-col gap-2">
          {visibili.map((p) => {
            const { icona: Icona, colore, nome } = CATEGORIE[p.categoria];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelezionato(p.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg bg-white px-4 text-left shadow-sm ring-1 ring-colleiano-forest/10"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: colore }}>
                    <Icona className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1 text-lg font-medium">{p.nome}</span>
                  <span className="text-colleiano-slate/80">{nome}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {punto && (
        <SchedaPunto
          key={punto.id}
          punto={punto}
          eventi={eventi.filter((e) => e.puntoId === punto.id)}
          onChiudi={() => setSelezionato(undefined)}
        />
      )}
    </div>
  );
}

function BottoneFiltro({
  attivo,
  onClick,
  nome,
  icona: Icona,
  colore,
}: {
  attivo: boolean;
  onClick: () => void;
  nome: string;
  icona: typeof LayoutGrid;
  colore: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={attivo}
      onClick={onClick}
      className={cn(
        "flex min-h-16 min-w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 text-base font-medium",
        attivo ? "border-transparent text-white" : "border-colleiano-forest/15 bg-white text-colleiano-slate",
      )}
      style={attivo ? { backgroundColor: colore } : undefined}
    >
      <Icona className="size-6" style={attivo ? undefined : { color: colore }} aria-hidden />
      {nome}
    </button>
  );
}

function SchedaPunto({
  punto,
  eventi,
  onChiudi,
}: {
  punto: MappaPubblica["punti"][number];
  eventi: EventoPubblico[];
  onChiudi: () => void;
}) {
  const titolo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titolo.current?.focus(), []);
  const { icona: Icona, colore, nome } = CATEGORIE[punto.categoria];

  return (
    <section
      aria-labelledby="titolo-scheda"
      className="fixed inset-x-0 bottom-0 z-[1000] max-h-[75svh] overflow-y-auto rounded-t-2xl bg-white shadow-lg ring-1 ring-colleiano-forest/15"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-8">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: colore }}>
            <Icona className="size-6" aria-hidden />
          </span>
          <div className="flex flex-1 flex-col">
            <h2 id="titolo-scheda" ref={titolo} tabIndex={-1} className="text-2xl font-bold outline-none">
              {punto.nome}
            </h2>
            <p className="text-colleiano-slate/80">{nome}</p>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            className="flex min-h-12 items-center gap-1 rounded-lg px-3 font-medium text-colleiano-forest ring-1 ring-colleiano-forest/20"
          >
            <X className="size-5" aria-hidden />
            Chiudi
          </button>
        </div>
        {punto.foto && (
          // eslint-disable-next-line @next/next/no-img-element -- immagine pubblica da Storage
          <img src={punto.foto} alt={`Foto: ${punto.nome}`} className="max-h-60 w-full rounded-lg object-cover" />
        )}
        {punto.descrizione && <p className="text-lg whitespace-pre-line">{punto.descrizione}</p>}
        {punto.orari && (
          <p className="flex items-center gap-2 text-lg">
            <Clock className="size-5 text-colleiano-rust" aria-hidden />
            {punto.orari}
          </p>
        )}
        {punto.accessibile && (
          <p className="flex items-center gap-2 text-lg">
            <Accessibility className="size-5 text-colleiano-rust" aria-hidden />
            Accessibile in carrozzina
          </p>
        )}
        {eventi.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold">Qui nel programma</h3>
            <ul className="flex flex-col gap-1">
              {eventi.map((e) => (
                <li key={e.id} className="text-lg">
                  <span className="font-bold text-colleiano-rust">{formatOra(new Date(e.inizio))}</span> {e.titolo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
