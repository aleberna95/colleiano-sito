"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ClipboardCheck, Download, HandCoins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Selezione, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { ListaSpese, RiepilogoSpese } from "@/components/spesa-riga";
import { Avviso, Caricamento } from "@/components/stato";
import { useMovimenti } from "@/lib/data/spese";
import { useFesta } from "@/lib/festa-context";
import { commissioniPerSpesa, puoGestireCassa } from "@/lib/permissions";
import type { StatoMovimento } from "@/lib/schemas";
import { movimentiCsv, NOMI_STATO_SPESA, riepilogo, scaricaFile } from "@/lib/spese";
import { cn } from "@/lib/utils";

const FILTRI: (StatoMovimento | "tutte")[] = ["tutte", "in_attesa", "approvata", "rifiutata", "rimborsata", "annullata"];

// Spese ed entrate della festa (SPEC 6.4).
export default function SpesePage() {
  const { festa, festaId, commissioni, io, nomeDi } = useFesta();
  const stato = useMovimenti(festaId);
  const [filtro, setFiltro] = useState<StatoMovimento | "tutte">("tutte");
  const [commissioneId, setCommissioneId] = useState("");
  const base = `/gestione/f/${festa.slug}`;
  const puoInserire = commissioniPerSpesa(io, festa, commissioni).length > 0;
  const admin = puoGestireCassa(io, festa);

  const tutti = stato.stato === "ok" ? stato.dati : [];
  const lista = tutti
    .filter((m) => (filtro === "tutte" || m.stato === filtro) && (!commissioneId || m.commissioneId === commissioneId))
    .sort((a, b) => b.dataSpesa.toMillis() - a.dataSpesa.toMillis() || b.createdAt.toMillis() - a.createdAt.toMillis());
  const inAttesa = tutti.filter((m) => m.tipo === "spesa" && m.stato === "in_attesa").length;
  const nomeCommissione = (id: string) => commissioni.find((c) => c.id === id)?.nome ?? "";

  return (
    <>
      <TitoloPagina titolo="Spese">
        {puoInserire && (
          <Button asChild size="lg">
            <Link href={`${base}/spese/nuova${commissioneId ? `?commissione=${commissioneId}` : ""}`}>
              <Plus aria-hidden />
              Nuova spesa
            </Link>
          </Button>
        )}
      </TitoloPagina>

      {admin && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild size="lg" variant={inAttesa ? "secondary" : "outline"}>
            <Link href={`${base}/spese/da-approvare`}>
              <ClipboardCheck aria-hidden />
              Da approvare{inAttesa ? ` (${inAttesa})` : ""}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`${base}/rimborsi`}>
              <HandCoins aria-hidden />
              Rimborsi
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`${base}/spese/entrata`}>
              <ArrowDownLeft aria-hidden />
              Registra un&apos;entrata
            </Link>
          </Button>
        </div>
      )}

      {stato.stato === "caricamento" && <Caricamento />}
      {stato.stato === "errore" && <Avviso tipo="errore">Non riesco a caricare le spese. Controlla la connessione e riprova.</Avviso>}

      {stato.stato === "ok" && (
        <>
          <RiepilogoSpese r={riepilogo(tutti, festa.budgetTotaleCents, commissioni)} />

          <div className="flex flex-wrap gap-2" role="group" aria-label="Quali spese mostrare">
            {FILTRI.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className={cn(
                  "min-h-12 rounded-full border px-4 text-base",
                  filtro === f ? "border-colleiano-forest bg-colleiano-forest text-white" : "border-colleiano-forest/25 bg-white text-colleiano-forest",
                )}
              >
                {f === "tutte" ? "Tutte" : NOMI_STATO_SPESA[f]}
              </button>
            ))}
          </div>
          <Selezione id="filtro-commissione-spese" label="Commissione" value={commissioneId} onChange={(e) => setCommissioneId(e.target.value)}>
            <option value="">Tutte</option>
            {commissioni.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selezione>

          {lista.length ? (
            <ListaSpese movimenti={lista} />
          ) : (
            <StatoVuoto titolo={tutti.length ? "Nessuna spesa con questi filtri" : "Ancora nessuna spesa"}>
              {tutti.length
                ? "Prova a cambiare i filtri qui sopra."
                : puoInserire
                  ? "Hai comprato qualcosa per la festa? Premi \"Nuova spesa\" e fotografa lo scontrino."
                  : "Quando qualcuno segnerà una spesa la vedrai qui."}
            </StatoVuoto>
          )}

          {tutti.length > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => scaricaFile(`spese-${festa.slug}.csv`, movimentiCsv(tutti, nomeDi, nomeCommissione))}
            >
              <Download aria-hidden />
              Scarica tutte le spese (CSV)
            </Button>
          )}
        </>
      )}
    </>
  );
}
