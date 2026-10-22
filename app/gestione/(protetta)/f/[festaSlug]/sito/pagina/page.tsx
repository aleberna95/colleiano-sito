"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaTesto, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { FotoSito, ScegliFoto } from "@/components/foto-sito";
import { Avviso } from "@/components/stato";
import { aggiornaFestaSito, togliImmagineSito } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { puoModificarePaginaFesta } from "@/lib/permissions";
import type { PaginaPubblica } from "@/lib/schemas";

const MAX_GALLERIA = 30;

// "Pagina della festa" (SPEC 7.1): testo, foto di copertina e galleria.
export default function PaginaFestaPage() {
  const { festa, festaId, io } = useFesta();
  const pagina: PaginaPubblica = { galleria: [], ...festa.paginaPubblica };
  const [testo, setTesto] = useState(pagina.testo ?? "");
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string }>();
  const [salvando, setSalvando] = useState(false);
  const cartella = `sito/feste/${festaId}`;
  const indietro = `/gestione/f/${festa.slug}/sito`;

  if (!puoModificarePaginaFesta(io, festa)) {
    return (
      <>
        <TitoloPagina titolo="Pagina della festa" indietro={indietro} />
        <Avviso tipo="errore">Solo gli admin della festa possono cambiare la sua pagina.</Avviso>
      </>
    );
  }

  async function salva(nuova: PaginaPubblica, conferma: string) {
    setEsito(undefined);
    try {
      await aggiornaFestaSito(festaId, io.uid, { paginaPubblica: nuova });
      setEsito({ tipo: "ok", testo: conferma });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  }

  async function togli(url: string, nuova: PaginaPubblica) {
    await salva(nuova, "Foto tolta.");
    await togliImmagineSito(url);
  }

  return (
    <>
      <TitoloPagina titolo="Pagina della festa" indietro={indietro} />
      <p className="text-muted-foreground">Quello che scrivi qui lo vede chiunque apre il sito.</p>
      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Testo</h2>
          </CardTitle>
          <CardDescription>Cos&apos;è la festa, cosa si fa, chi ringraziare.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AreaTesto
            id="testo-pagina"
            label="Testo della pagina"
            rows={10}
            maxLength={5000}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
          <Button
            size="lg"
            disabled={salvando}
            onClick={async () => {
              setSalvando(true);
              await salva({ ...pagina, testo: testo.trim() || undefined }, "Testo salvato.");
              setSalvando(false);
            }}
          >
            <Check aria-hidden />
            {salvando ? "Salvataggio..." : "Salva il testo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Foto di copertina</h2>
          </CardTitle>
          <CardDescription>La foto grande in cima alla pagina. Meglio orizzontale.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pagina.copertina ? (
            <FotoSito
              url={pagina.copertina}
              alt="Copertina della festa"
              onTogli={() => togli(pagina.copertina!, { ...pagina, copertina: undefined })}
            />
          ) : (
            <ScegliFoto
              etichetta="Scegli la copertina"
              cartella={cartella}
              onCaricate={([url]) => salva({ ...pagina, copertina: url }, "Copertina salvata.")}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Galleria</h2>
          </CardTitle>
          <CardDescription>Le foto della festa, fino a {MAX_GALLERIA}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pagina.galleria.length === 0 && <StatoVuoto titolo="Nessuna foto">Aggiungi le foto più belle della festa.</StatoVuoto>}
          {pagina.galleria.map((url, i) => (
            <FotoSito
              key={url}
              url={url}
              alt={`Foto ${i + 1} della galleria`}
              onTogli={() => togli(url, { ...pagina, galleria: pagina.galleria.filter((u) => u !== url) })}
            />
          ))}
          {pagina.galleria.length < MAX_GALLERIA && (
            <ScegliFoto
              etichetta="Aggiungi foto"
              cartella={cartella}
              multipla
              onCaricate={(urls) =>
                salva({ ...pagina, galleria: [...pagina.galleria, ...urls].slice(0, MAX_GALLERIA) }, "Foto aggiunte.")
              }
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
