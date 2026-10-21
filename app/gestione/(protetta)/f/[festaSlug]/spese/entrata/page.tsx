"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso } from "@/components/stato";
import { erroreCallable, registraEntrata } from "@/lib/callable";
import { useFesta } from "@/lib/festa-context";
import { formatEuro, oggiPerInput, parseEuro } from "@/lib/format";
import { puoGestireCassa } from "@/lib/permissions";
import { importoEuroSchema } from "@/lib/schemas";

// Entrate (sponsor, contributi, incassi): le registra un admin (SPEC 4.5).
export default function EntrataPage() {
  const { festa, festaId, commissioni, io } = useFesta();
  const base = `/gestione/f/${festa.slug}`;
  const generale = commissioni.find((c) => c.generale) ?? commissioni[0];
  const iniziali = {
    importo: "",
    descrizione: "",
    commissioneId: generale?.id ?? "",
    categoria: festa.categorieSpesa.includes("Altro") ? "Altro" : (festa.categorieSpesa[0] ?? "Altro"),
    data: oggiPerInput(),
  };
  const [v, setV] = useState(iniziali);
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const [fatta, setFatta] = useState<{ id: string; testo: string }>();

  if (!puoGestireCassa(io, festa)) return <Avviso tipo="errore">Solo un admin registra le entrate.</Avviso>;

  async function salva() {
    const importo = importoEuroSchema.safeParse(v.importo);
    if (!importo.success) return setErrore(importo.error.issues[0]?.message);
    if (!v.descrizione.trim()) return setErrore("Scrivi da dove arrivano i soldi.");
    setInCorso(true);
    setErrore(undefined);
    try {
      const importoCents = parseEuro(importo.data)!;
      const r = await registraEntrata({
        festaId,
        commissioneId: v.commissioneId,
        descrizione: v.descrizione.trim(),
        importoCents,
        categoria: v.categoria,
        dataSpesa: v.data,
      });
      setFatta({ id: r.movimentoId, testo: `${v.descrizione.trim()}: ${formatEuro(importoCents)}` });
    } catch (err) {
      setErrore(erroreCallable(err));
    } finally {
      setInCorso(false);
    }
  }

  if (fatta) {
    return (
      <>
        <TitoloPagina titolo="Entrata registrata" indietro={`${base}/spese`} />
        <Avviso tipo="ok">{fatta.testo}</Avviso>
        <Button asChild variant="outline" size="lg">
          <Link href={`${base}/spese/${fatta.id}`}>
            <ArrowRight aria-hidden />
            Apri l&apos;entrata
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            setV(iniziali);
            setFatta(undefined);
          }}
        >
          <Plus aria-hidden />
          Registra un&apos;altra entrata
        </Button>
      </>
    );
  }

  return (
    <>
      <TitoloPagina titolo="Nuova entrata" indietro={`${base}/spese`} />
      <Card>
        <CardContent className="flex flex-col gap-5">
          <Campo id="entrata-importo" label="Quanto (euro)" inputMode="decimal" placeholder="es. 200" value={v.importo} onChange={(e) => setV({ ...v, importo: e.target.value })} />
          <Campo id="entrata-descrizione" label="Da dove arrivano (es. sponsor Bar Centrale)" value={v.descrizione} maxLength={200} onChange={(e) => setV({ ...v, descrizione: e.target.value })} />
          <Selezione id="entrata-commissione" label="Commissione" value={v.commissioneId} onChange={(e) => setV({ ...v, commissioneId: e.target.value })}>
            {commissioni.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selezione>
          {festa.categorieSpesa.length > 1 && (
            <Selezione id="entrata-categoria" label="Categoria" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })}>
              {festa.categorieSpesa.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Selezione>
          )}
          <Campo id="entrata-data" label="Quando" type="date" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
          {errore && <Avviso tipo="errore">{errore}</Avviso>}
          <Button size="lg" onClick={salva} disabled={inCorso}>
            <Check aria-hidden />
            {inCorso ? "Salvataggio..." : "Registra l'entrata"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
