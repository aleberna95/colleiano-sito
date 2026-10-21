"use client";

import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatoVuoto, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { useMovimenti, useRimborsi } from "@/lib/data/spese";
import { useFesta } from "@/lib/festa-context";
import { formatEuro, formatGiorno } from "@/lib/format";
import { chiaveUrl, crediti, NOMI_MODALITA, rimborsiCsv, scaricaFile } from "@/lib/spese";
import { cn } from "@/lib/utils";

// Rimborsi, "chi deve ricevere quanto" (SPEC 6.4).
export default function RimborsiPage() {
  const { festa, festaId, membri, nomeDi } = useFesta();
  const movimenti = useMovimenti(festaId);
  const rimborsi = useRimborsi(festaId);
  const base = `/gestione/f/${festa.slug}`;

  if (movimenti.stato === "caricamento" || rimborsi.stato === "caricamento") return <Caricamento />;
  if (movimenti.stato === "errore" || rimborsi.stato === "errore") {
    return <Avviso tipo="errore">Non riesco a caricare i rimborsi. Controlla la connessione e riprova.</Avviso>;
  }
  const righe = crediti(movimenti.dati, membri);
  const registrati = [...rimborsi.dati].sort((a, b) => b.data.toMillis() - a.data.toMillis());

  return (
    <>
      <TitoloPagina titolo="Rimborsi" indietro={`${base}/altro`} />
      <p className="text-muted-foreground">Chi ha anticipato soldi per la festa e quanto deve ancora ricevere. Tocca una persona per vedere le sue spese.</p>

      {righe.length ? (
        <ul className="flex flex-col gap-3">
          {righe.map((c) => (
            <li key={c.chiave}>
              <Link href={`${base}/rimborsi/${chiaveUrl(c.chiave)}`} className="flex items-center gap-3 rounded-lg border bg-colleiano-surface p-4 shadow-xs">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-lg font-semibold text-colleiano-forest">{c.nome}</span>
                  <span className="text-muted-foreground">
                    Anticipato {formatEuro(c.anticipatoCents)} · già rimborsato {formatEuro(c.rimborsatoCents)}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-[0.95rem] text-muted-foreground">Da rimborsare</span>
                  <span className={cn("text-2xl font-semibold tabular-nums", c.daRimborsareCents ? "text-colleiano-rust" : "text-colleiano-success")}>
                    {formatEuro(c.daRimborsareCents)}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <StatoVuoto titolo="Nessuno deve ricevere soldi">
          Qui compaiono le spese pagate di tasca propria, dopo che un admin le ha approvate.
        </StatoVuoto>
      )}

      {registrati.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="rimborsi-fatti">
          <h2 id="rimborsi-fatti" className="text-2xl">Rimborsi fatti</h2>
          <ul className="flex flex-col divide-y rounded-lg border bg-colleiano-surface">
            {registrati.map((r) => (
              <li key={r.id} className={cn("flex items-center justify-between gap-3 p-4", r.annullato && "text-muted-foreground line-through")}>
                <span>
                  <span className="font-medium">{r.beneficiarioNome}</span>
                  <span className="block text-[0.95rem] text-muted-foreground no-underline">
                    {formatGiorno(r.data)} · {NOMI_MODALITA[r.modalita]}
                    {r.annullato && " · annullato"}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatEuro(r.totaleCents)}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="lg" onClick={() => scaricaFile(`rimborsi-${festa.slug}.csv`, rimborsiCsv(registrati, nomeDi))}>
            <Download aria-hidden />
            Scarica i rimborsi (CSV)
          </Button>
        </section>
      )}
    </>
  );
}
