"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaTesto, ConfermaAzione, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { creaAvviso, eliminaAvviso, mostraAvviso, useAvvisi, type AvvisoConId } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { formatQuando } from "@/lib/format";
import { puoModificareProgramma } from "@/lib/permissions";
import { avvisoFormSchema, type AvvisoForm } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Esito = { tipo: "ok" | "errore"; testo: string };

// Avvisi (SPEC 7.1): in evidenza sulla home in modalità festa, es. "Spettacolo spostato in piazza".
export default function AvvisiPage() {
  const { festa, festaId, io } = useFesta();
  const avvisi = useAvvisi(festaId);
  const [esito, setEsito] = useState<Esito>();
  const form = useForm<AvvisoForm>({ resolver: zodResolver(avvisoFormSchema), defaultValues: { testo: "", tipo: "info" } });
  const { errors, isSubmitting } = form.formState;
  const indietro = `/gestione/f/${festa.slug}/sito`;

  if (!puoModificareProgramma(io, festa)) {
    return (
      <>
        <TitoloPagina titolo="Avvisi" indietro={indietro} />
        <Avviso tipo="errore">Solo gli admin della festa possono scrivere gli avvisi.</Avviso>
      </>
    );
  }

  async function prova(azione: () => Promise<unknown>, conferma: string) {
    setEsito(undefined);
    try {
      await azione();
      setEsito({ tipo: "ok", testo: conferma });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  }

  const pubblica = form.handleSubmit((v) =>
    prova(async () => {
      await creaAvviso(festaId, io.uid, v);
      form.reset({ testo: "", tipo: v.tipo });
    }, "Avviso pubblicato. Sul sito compare entro un minuto."),
  );

  return (
    <>
      <TitoloPagina titolo="Avvisi" indietro={indietro} />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Nuovo avviso</h2>
          </CardTitle>
          <CardDescription>Compare in cima alla home del sito quando la modalità festa è accesa.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={pubblica} className="flex flex-col gap-5" noValidate>
            <AreaTesto
              id="avviso-testo"
              label="Avviso"
              placeholder="es. Lo spettacolo è spostato in piazza"
              maxLength={500}
              errore={errors.testo?.message}
              {...form.register("testo")}
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">Quanto è importante?</legend>
              <label className="flex min-h-12 items-center gap-3 text-lg">
                <input type="radio" value="info" className="size-6 accent-colleiano-forest" {...form.register("tipo")} />
                Informazione
              </label>
              <label className="flex min-h-12 items-center gap-3 text-lg">
                <input type="radio" value="importante" className="size-6 accent-colleiano-forest" {...form.register("tipo")} />
                Importante (in rosso)
              </label>
            </fieldset>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              <Megaphone aria-hidden />
              {isSubmitting ? "Pubblico..." : "Pubblica l'avviso"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}

      {avvisi.stato === "caricamento" ? (
        <Caricamento />
      ) : avvisi.stato === "errore" ? (
        <Avviso tipo="errore">Non riesco a caricare gli avvisi. Riprova.</Avviso>
      ) : avvisi.dati.length === 0 ? (
        <StatoVuoto titolo="Nessun avviso">Scrivi qui le novità del giorno: cambi di orario, di posto, pioggia...</StatoVuoto>
      ) : (
        <ul className="flex flex-col gap-3">
          {avvisi.dati.map((a) => (
            <RigaAvviso
              key={a.id}
              avviso={a}
              onMostra={(attivo) =>
                prova(() => mostraAvviso(festaId, a.id, io.uid, attivo), attivo ? "Avviso di nuovo sul sito." : "Avviso nascosto dal sito.")
              }
              onElimina={() => prova(() => eliminaAvviso(festaId, a.id), "Avviso eliminato.")}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function RigaAvviso({
  avviso,
  onMostra,
  onElimina,
}: {
  avviso: AvvisoConId;
  onMostra: (attivo: boolean) => Promise<void>;
  onElimina: () => Promise<void>;
}) {
  const importante = avviso.tipo === "importante";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border-l-4 bg-card p-4 shadow-sm ring-1 ring-foreground/10",
        importante ? "border-colleiano-danger" : "border-colleiano-forest",
        !avviso.attivo && "opacity-70",
      )}
    >
      <p className="text-sm text-muted-foreground">
        {importante ? "Importante" : "Informazione"}
        {avviso.createdAt && ` · ${formatQuando(avviso.createdAt)}`}
        {avviso.attivo ? " · sul sito" : " · nascosto"}
      </p>
      <p className="text-lg whitespace-pre-line">{avviso.testo}</p>
      <Button variant="outline" size="lg" onClick={() => onMostra(!avviso.attivo)}>
        {avviso.attivo ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        {avviso.attivo ? "Nascondi dal sito" : "Rimetti sul sito"}
      </Button>
      <ConfermaAzione etichetta="Elimina" domanda="Eliminare questo avviso?" conferma="Sì, elimina" icona={<Trash2 aria-hidden />} onConferma={onElimina} />
    </li>
  );
}
