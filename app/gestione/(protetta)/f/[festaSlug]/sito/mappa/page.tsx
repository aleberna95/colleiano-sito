"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, ConfermaAzione, Selezione, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { FotoSito, ScegliFoto } from "@/components/foto-sito";
import { Mappa } from "@/components/mappa";
import { Avviso, Caricamento } from "@/components/stato";
import { aggiornaPunto, aggiungiPunto, caricaMappa, eliminaPunto, togliImmagineSito, useMappa, usePunti } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { CATEGORIE } from "@/lib/mappa";
import { puoModificareProgramma } from "@/lib/permissions";
import { categoriaPuntoSchema, puntoFormSchema, type Punto, type PuntoForm } from "@/lib/schemas";

type Esito = { tipo: "ok" | "errore"; testo: string };

// Editor della mappa (SPEC 7.1): il disegno, i punti trascinabili e la loro scheda.
export default function MappaEditorPage() {
  const { festa, festaId, io } = useFesta();
  const mappa = useMappa(festaId);
  const punti = usePunti(festaId);
  const [selezionato, setSelezionato] = useState<string>();
  const [esito, setEsito] = useState<Esito>();
  const indietro = `/gestione/f/${festa.slug}/sito`;

  if (!puoModificareProgramma(io, festa)) {
    return (
      <>
        <TitoloPagina titolo="Mappa" indietro={indietro} />
        <Avviso tipo="errore">Solo gli admin della festa possono cambiare la mappa.</Avviso>
      </>
    );
  }
  if (mappa.stato === "caricamento" || punti.stato === "caricamento") return <Caricamento />;
  if (mappa.stato === "errore" || punti.stato === "errore") return <Avviso tipo="errore">Non riesco a caricare la mappa. Riprova.</Avviso>;

  async function prova(azione: () => Promise<unknown>, conferma?: string) {
    setEsito(undefined);
    try {
      await azione();
      if (conferma) setEsito({ tipo: "ok", testo: conferma });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  }

  const punto = punti.dati.find((p) => p.id === selezionato);

  return (
    <>
      <TitoloPagina titolo="Mappa" indietro={indietro} />

      {!mappa.dati?.immagine ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Il disegno della mappa</h2>
            </CardTitle>
            <CardDescription>
              Un disegno del paese visto dall&apos;alto, orizzontale. Finché non c&apos;è quello definitivo va bene anche uno screenshot della
              mappa: i punti restano al loro posto quando lo sostituisci, se inquadra la stessa zona.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CaricaDisegno etichetta="Carica il disegno" onFile={(f) => prova(() => caricaMappa(festaId, io.uid, f), "Disegno caricato.")} />
            {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground">Trascina i punti per spostarli. Tocca un punto per scriverne la scheda.</p>
          <Mappa
            immagine={mappa.dati.immagine}
            punti={punti.dati}
            selezionato={selezionato}
            onSeleziona={setSelezionato}
            spostabili
            onSposta={(id, x, y) => prova(() => aggiornaPunto(festaId, id, io.uid, { x, y }))}
            className="h-[60svh] min-h-80"
          />
          <Button
            size="lg"
            onClick={() =>
              prova(async () => {
                setSelezionato(await aggiungiPunto(festaId, io.uid));
              }, "Punto aggiunto al centro della mappa: trascinalo dove serve.")
            }
          >
            <Plus aria-hidden />
            Aggiungi un punto
          </Button>
          {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}

          {punto && (
            <SchedaPunto
              key={punto.id}
              punto={punto}
              cartella={`sito/feste/${festaId}`}
              onSalva={(v) => prova(() => aggiornaPunto(festaId, punto.id, io.uid, v), "Punto salvato.")}
              onFoto={(foto) => prova(() => aggiornaPunto(festaId, punto.id, io.uid, { foto }))}
              onElimina={() =>
                prova(async () => {
                  await eliminaPunto(festaId, punto.id);
                  if (punto.foto) await togliImmagineSito(punto.foto);
                  setSelezionato(undefined);
                }, "Punto tolto.")
              }
            />
          )}
          <ElencoPunti punti={punti.dati} onSeleziona={setSelezionato} />

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Cambia il disegno</h2>
              </CardTitle>
              <CardDescription>I punti restano dove sono, purché il disegno nuovo inquadri la stessa zona con le stesse proporzioni.</CardDescription>
            </CardHeader>
            <CardContent>
              <CaricaDisegno etichetta="Carica un altro disegno" onFile={(f) => prova(() => caricaMappa(festaId, io.uid, f), "Disegno sostituito.")} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function CaricaDisegno({ etichetta, onFile }: { etichetta: string; onFile: (f: File) => Promise<void> }) {
  const [inCorso, setInCorso] = useState(false);
  return (
    <label
      aria-disabled={inCorso}
      className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-colleiano-forest/40 bg-white px-4 text-lg font-medium text-colleiano-forest has-focus-visible:ring-3 has-focus-visible:ring-ring/50 aria-disabled:cursor-wait aria-disabled:opacity-60"
    >
      {inCorso ? <LoaderCircle className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
      {inCorso ? "Carico..." : etichetta}
      <input
        type="file"
        accept="image/png,image/webp,image/jpeg"
        disabled={inCorso}
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setInCorso(true);
          await onFile(f);
          setInCorso(false);
        }}
      />
    </label>
  );
}

function ElencoPunti({ punti, onSeleziona }: { punti: (Punto & { id: string })[]; onSeleziona: (id: string) => void }) {
  if (punti.length === 0) {
    return <StatoVuoto titolo="Nessun punto">Aggiungi bagni, stand, parcheggi... e trascinali al loro posto.</StatoVuoto>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>I punti</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {punti.map((p) => {
            const { icona: Icona, colore, nome } = CATEGORIE[p.categoria];
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onSeleziona(p.id)} className="flex min-h-14 w-full items-center gap-3 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: colore }}>
                    <Icona className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1 text-lg">{p.nome}</span>
                  <span className="text-muted-foreground">{nome}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function SchedaPunto({
  punto,
  cartella,
  onSalva,
  onFoto,
  onElimina,
}: {
  punto: Punto & { id: string };
  cartella: string;
  onSalva: (v: PuntoForm) => Promise<void>;
  onFoto: (foto: string | null) => Promise<void>;
  onElimina: () => Promise<void>;
}) {
  const form = useForm<PuntoForm>({
    resolver: zodResolver(puntoFormSchema),
    defaultValues: {
      nome: punto.nome,
      categoria: punto.categoria,
      descrizione: punto.descrizione ?? "",
      orari: punto.orari ?? "",
      accessibile: punto.accessibile,
    },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Scheda del punto</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={form.handleSubmit(onSalva)} className="flex flex-col gap-5" noValidate>
          <Campo id="punto-nome" label="Nome" errore={errors.nome?.message} {...form.register("nome")} />
          <Selezione id="punto-categoria" label="Cosa c'è" {...form.register("categoria")}>
            {categoriaPuntoSchema.options.map((c) => (
              <option key={c} value={c}>
                {CATEGORIE[c].nome}
              </option>
            ))}
          </Selezione>
          <AreaTesto id="punto-descrizione" label="Descrizione (facoltativa)" errore={errors.descrizione?.message} {...form.register("descrizione")} />
          <Campo id="punto-orari" label="Orari (facoltativi)" placeholder="es. 12:00 – 23:00" errore={errors.orari?.message} {...form.register("orari")} />
          <label className="flex min-h-12 items-center gap-3 text-lg">
            <input type="checkbox" className="size-6 accent-colleiano-forest" {...form.register("accessibile")} />
            Accessibile in carrozzina
          </label>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Check aria-hidden />
            {isSubmitting ? "Salvataggio..." : "Salva il punto"}
          </Button>
        </form>

        {punto.foto ? (
          <FotoSito
            url={punto.foto}
            alt={`Foto di ${punto.nome}`}
            onTogli={async () => {
              const vecchia = punto.foto!;
              await onFoto(null);
              await togliImmagineSito(vecchia);
            }}
          />
        ) : (
          <ScegliFoto etichetta="Aggiungi una foto" cartella={cartella} onCaricate={([url]) => onFoto(url)} />
        )}

        <ConfermaAzione
          etichetta="Togli il punto"
          domanda={`Togliere "${punto.nome}" dalla mappa?`}
          conferma="Sì, togli"
          icona={<Trash2 aria-hidden />}
          onConferma={onElimina}
        />
      </CardContent>
    </Card>
  );
}
