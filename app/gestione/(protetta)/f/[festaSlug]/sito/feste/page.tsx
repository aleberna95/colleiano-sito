"use client";

import { useState } from "react";
import { Archive, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { aggiornaFestaSito, salvaSitoConfig, useSitoConfig } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { useFeste } from "@/lib/feste-context";
import { puoModificareSito } from "@/lib/permissions";

// Schede globali del superadmin (SPEC 7.1): quale festa mostra la home, quali feste sono tra le edizioni passate.
export default function FesteSitoPage() {
  const { festa, io } = useFesta();
  const config = useSitoConfig();
  const feste = useFeste();
  const [scelta, setScelta] = useState<string>();
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string }>();
  const [inCorso, setInCorso] = useState<string>();
  const indietro = `/gestione/f/${festa.slug}/sito`;

  if (!puoModificareSito(io)) {
    return (
      <>
        <TitoloPagina titolo="Festa in evidenza e archivio" indietro={indietro} />
        <Avviso tipo="errore">Solo i superadmin possono cambiare queste impostazioni.</Avviso>
      </>
    );
  }
  if (config.stato === "caricamento" || feste.status === "loading") return <Caricamento />;
  if (config.stato === "errore" || feste.status === "errore") return <Avviso tipo="errore">Non riesco a caricare i dati. Riprova.</Avviso>;

  const evidenza = scelta ?? config.dati.festaInEvidenzaId ?? "";

  async function esegui(chiave: string, azione: () => Promise<void>, conferma: string) {
    setEsito(undefined);
    setInCorso(chiave);
    try {
      await azione();
      setEsito({ tipo: "ok", testo: conferma });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    } finally {
      setInCorso(undefined);
    }
  }

  return (
    <>
      <TitoloPagina titolo="Festa in evidenza e archivio" indietro={indietro} />
      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Festa in evidenza</h2>
          </CardTitle>
          <CardDescription>È la prossima festa: la home del sito mostra il suo nome, la data e il conto alla rovescia.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Selezione id="evidenza" label="Quale festa" value={evidenza} onChange={(e) => setScelta(e.target.value)}>
            <option value="">Nessuna (la home dice &quot;In preparazione&quot;)</option>
            {feste.feste.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selezione>
          <Button
            size="lg"
            disabled={inCorso !== undefined || evidenza === (config.dati.festaInEvidenzaId ?? "")}
            onClick={() =>
              esegui("evidenza", () => salvaSitoConfig(io.uid, { ...config.dati, festaInEvidenzaId: evidenza || undefined }), "Festa in evidenza salvata.")
            }
          >
            <Check aria-hidden />
            {inCorso === "evidenza" ? "Salvataggio..." : "Salva"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Edizioni passate</h2>
          </CardTitle>
          <CardDescription>Le feste nell&apos;archivio hanno una pagina tra le edizioni del sito.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {feste.feste.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  {f.id === config.dati.festaInEvidenzaId && <Star className="size-5 text-colleiano-rust" aria-label="In evidenza" />}
                  <span className="text-lg font-medium">{f.nome}</span>
                </div>
                <p className="text-muted-foreground">{f.inArchivioPubblico ? "È tra le edizioni passate." : "Non è tra le edizioni passate."}</p>
                <Button
                  variant={f.inArchivioPubblico ? "outline" : "secondary"}
                  size="lg"
                  disabled={inCorso !== undefined}
                  onClick={() =>
                    esegui(
                      f.id,
                      () => aggiornaFestaSito(f.id, io.uid, { inArchivioPubblico: !f.inArchivioPubblico }),
                      f.inArchivioPubblico ? `${f.nome} tolta dalle edizioni passate.` : `${f.nome} aggiunta alle edizioni passate.`,
                    )
                  }
                >
                  <Archive aria-hidden />
                  {inCorso === f.id ? "Attendi..." : f.inArchivioPubblico ? "Togli dalle edizioni" : "Metti tra le edizioni"}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
