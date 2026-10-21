"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownLeft, Receipt } from "lucide-react";
import { Etichetta } from "@/components/comuni";
import { useFesta } from "@/lib/festa-context";
import { formatEuro, formatGiorno } from "@/lib/format";
import type { StatoMovimento } from "@/lib/schemas";
import { CLASSI_STATO_SPESA, NOMI_STATO_SPESA, pagatoDaTesto, type MovimentoConId, type Riepilogo } from "@/lib/spese";
import { cn } from "@/lib/utils";

export function BadgeStatoSpesa({ stato }: { stato: StatoMovimento }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.95rem] font-medium", CLASSI_STATO_SPESA[stato])}>
      {NOMI_STATO_SPESA[stato]}
    </span>
  );
}

/** Una spesa o un'entrata; `prima` per una casella di selezione. */
export function SpesaRiga({ m, prima }: { m: MovimentoConId; prima?: ReactNode }) {
  const { festa, commissioni, nomeDi } = useFesta();
  const comm = commissioni.find((c) => c.id === m.commissioneId);
  const entrata = m.tipo === "entrata";
  const Icona = entrata ? ArrowDownLeft : Receipt;

  return (
    <li className="flex items-start gap-3 rounded-lg border bg-colleiano-surface p-4 shadow-xs">
      {prima}
      <Link href={`/gestione/f/${festa.slug}/spese/${m.id}`} className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <Icona className={cn("size-5 shrink-0", entrata ? "text-colleiano-success" : "text-colleiano-rust")} aria-hidden />
            <span className="truncate text-lg font-semibold text-colleiano-forest underline-offset-4 hover:underline">{m.descrizione}</span>
          </span>
          <span className={cn("shrink-0 text-lg font-semibold tabular-nums", entrata && "text-colleiano-success")}>
            {entrata ? "+" : ""}
            {formatEuro(m.importoCents)}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <BadgeStatoSpesa stato={m.stato} />
          {comm && <Etichetta colore={comm.colore}>{comm.nome}</Etichetta>}
          <span className="text-muted-foreground">
            {formatGiorno(m.dataSpesa)}
            {!entrata && ` · ${m.pagatoDa.tipo === "cassa" ? "cassa" : `pagata da ${pagatoDaTesto(m, nomeDi)}`}`}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function ListaSpese({ movimenti }: { movimenti: MovimentoConId[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {movimenti.map((m) => (
        <SpesaRiga key={m.id} m={m} />
      ))}
    </ul>
  );
}

function Voce({ etichetta, valore, evidenza }: { etichetta: string; valore: number; evidenza?: boolean }) {
  return (
    <div className="flex flex-col rounded-md bg-muted/60 p-3">
      <span className="text-muted-foreground">{etichetta}</span>
      <span className={cn("text-xl font-semibold tabular-nums", evidenza && valore < 0 && "text-colleiano-danger")}>{formatEuro(valore)}</span>
    </div>
  );
}

/** Budget, approvato, in attesa, entrate, saldo; per commissione se c'è un budget (SPEC 6.4). */
export function RiepilogoSpese({ r }: { r: Riepilogo }) {
  const { commissioni } = useFesta();
  return (
    <section aria-labelledby="riepilogo" className="flex flex-col gap-3 rounded-lg border bg-colleiano-surface p-4 shadow-xs">
      <h2 id="riepilogo" className="text-2xl">Riepilogo</h2>
      <div className="grid grid-cols-2 gap-2">
        {r.budgetCents !== undefined && <Voce etichetta="Budget" valore={r.budgetCents} />}
        <Voce etichetta="Spese approvate" valore={r.approvatoCents} />
        <Voce etichetta="In attesa" valore={r.inAttesaCents} />
        <Voce etichetta="Entrate" valore={r.entrateCents} />
        <Voce etichetta="Saldo (entrate − spese)" valore={r.saldoCents} evidenza />
        {r.budgetCents !== undefined && <Voce etichetta="Budget rimasto" valore={r.budgetCents - r.approvatoCents} evidenza />}
      </div>
      {r.perCommissione.length > 0 && (
        <ul className="flex flex-col gap-2">
          {r.perCommissione.map((c) => {
            const nome = commissioni.find((x) => x.id === c.commissioneId)?.nome ?? "";
            const percento = c.budgetCents ? Math.min(100, Math.round((c.approvatoCents / c.budgetCents) * 100)) : 100;
            const oltre = c.approvatoCents > c.budgetCents;
            return (
              <li key={c.commissioneId} className="flex flex-col gap-1">
                <span className="flex justify-between gap-2">
                  <span>{nome}</span>
                  <span className={cn("tabular-nums", oltre && "font-semibold text-colleiano-danger")}>
                    {formatEuro(c.approvatoCents)} su {formatEuro(c.budgetCents)}
                  </span>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className={cn("block h-full", oltre ? "bg-colleiano-danger" : "bg-colleiano-forest")} style={{ width: `${percento}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
