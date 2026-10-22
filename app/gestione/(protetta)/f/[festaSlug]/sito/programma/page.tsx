"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, MapPin, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, ConfermaAzione, Selezione, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { aggiornaEvento, creaEvento, eliminaEvento, useProgramma, usePunti, type EventoConId } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { dataPerInput, formatData, formatOra } from "@/lib/format";
import { puoModificareProgramma } from "@/lib/permissions";
import { perGiorno } from "@/lib/programma";
import { eventoFormSchema, type EventoForm, type Punto } from "@/lib/schemas";

type Esito = { tipo: "ok" | "errore"; testo: string };

// Editor del programma (SPEC 7.1): ora, titolo, luogo sulla mappa, breve descrizione.
export default function ProgrammaEditorPage() {
  const { festa, festaId, io } = useFesta();
  const programma = useProgramma(festaId);
  const punti = usePunti(festaId);
  // "nuovo" = form vuoto aperto; un id = evento in modifica.
  const [aperto, setAperto] = useState<string>();
  const [esito, setEsito] = useState<Esito>();
  const indietro = `/gestione/f/${festa.slug}/sito`;

  if (!puoModificareProgramma(io, festa)) {
    return (
      <>
        <TitoloPagina titolo="Programma" indietro={indietro} />
        <Avviso tipo="errore">Solo gli admin della festa possono cambiare il programma.</Avviso>
      </>
    );
  }
  if (programma.stato === "caricamento" || punti.stato === "caricamento") return <Caricamento />;
  if (programma.stato === "errore" || punti.stato === "errore") return <Avviso tipo="errore">Non riesco a caricare il programma. Riprova.</Avviso>;

  const eventi = programma.dati;
  const inModifica = eventi.find((e) => e.id === aperto);
  const ultimo = eventi.at(-1);

  async function prova(azione: () => Promise<unknown>, conferma: string) {
    setEsito(undefined);
    try {
      await azione();
      setAperto(undefined);
      setEsito({ tipo: "ok", testo: conferma });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  }

  const form = (evento?: EventoConId) => (
    <FormEvento
      key={evento?.id ?? "nuovo"}
      evento={evento}
      // Un evento nuovo parte dal giorno dell'ultimo, o dal giorno della festa.
      giorno={dataPerInput(ultimo?.inizio ?? festa.dataFesta)}
      punti={punti.dati}
      onSalva={(v) =>
        evento
          ? prova(() => aggiornaEvento(festaId, evento.id, io.uid, v), "Evento salvato.")
          : prova(() => creaEvento(festaId, io.uid, v, eventi.length), "Evento aggiunto al programma.")
      }
      onAnnulla={() => setAperto(undefined)}
      onElimina={evento && (() => prova(() => eliminaEvento(festaId, evento.id), "Evento tolto dal programma."))}
    />
  );

  return (
    <>
      <TitoloPagina titolo="Programma" indietro={indietro} />
      <p className="text-muted-foreground">Gli eventi compaiono sul sito in ordine di orario. Tocca un evento per cambiarlo.</p>
      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}

      {aperto === "nuovo" ? (
        form()
      ) : (
        <Button size="lg" onClick={() => (setEsito(undefined), setAperto("nuovo"))}>
          <Plus aria-hidden />
          Aggiungi un evento
        </Button>
      )}

      {eventi.length === 0 && aperto !== "nuovo" && (
        <StatoVuoto titolo="Il programma è vuoto">Aggiungi gli eventi della festa: messa, pranzo, giochi, musica...</StatoVuoto>
      )}

      {perGiorno(eventi.map((e) => ({ id: e.id, inizio: e.inizio.toMillis() }))).map(({ giorno, eventi: delGiorno }) => (
        <section key={giorno} aria-label={formatData(new Date(delGiorno[0].inizio))} className="flex flex-col gap-2">
          <h2 className="text-xl font-bold first-letter:uppercase">{formatData(new Date(delGiorno[0].inizio))}</h2>
          <ul className="flex flex-col gap-2">
            {delGiorno.map(({ id }) => {
              const e = eventi.find((x) => x.id === id)!;
              if (inModifica?.id === id) return <li key={id}>{form(e)}</li>;
              const luogo = punti.dati.find((p) => p.id === e.puntoId)?.nome;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => (setEsito(undefined), setAperto(id))}
                    className="flex min-h-14 w-full items-start gap-4 rounded-lg bg-card p-4 text-left shadow-sm ring-1 ring-foreground/10"
                  >
                    <span className="w-24 shrink-0 font-bold text-colleiano-rust">
                      {formatOra(e.inizio)}
                      {e.fine && ` – ${formatOra(e.fine)}`}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-lg">{e.titolo}</span>
                      {luogo && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="size-4" aria-hidden />
                          {luogo}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function FormEvento({
  evento,
  giorno,
  punti,
  onSalva,
  onAnnulla,
  onElimina,
}: {
  evento?: EventoConId;
  giorno: string;
  punti: (Punto & { id: string })[];
  onSalva: (v: EventoForm) => Promise<void>;
  onAnnulla: () => void;
  onElimina?: () => Promise<void>;
}) {
  const form = useForm<EventoForm>({
    resolver: zodResolver(eventoFormSchema),
    defaultValues: {
      titolo: evento?.titolo ?? "",
      giorno: evento ? dataPerInput(evento.inizio) : giorno,
      inizio: evento ? formatOra(evento.inizio) : "",
      fine: evento?.fine ? formatOra(evento.fine) : "",
      puntoId: evento?.puntoId ?? "",
      descrizione: evento?.descrizione ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{evento ? "Cambia l'evento" : "Nuovo evento"}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={form.handleSubmit(onSalva)} className="flex flex-col gap-5" noValidate>
          <Campo id="evento-titolo" label="Cosa succede" placeholder="es. Pranzo in piazza" errore={errors.titolo?.message} {...form.register("titolo")} />
          <Campo id="evento-giorno" label="Giorno" type="date" errore={errors.giorno?.message} {...form.register("giorno")} />
          <div className="grid grid-cols-2 gap-3">
            <Campo id="evento-inizio" label="Inizio" type="time" errore={errors.inizio?.message} {...form.register("inizio")} />
            <Campo id="evento-fine" label="Fine (facoltativa)" type="time" errore={errors.fine?.message} {...form.register("fine")} />
          </div>
          <Selezione id="evento-luogo" label="Dove (punto della mappa)" {...form.register("puntoId")}>
            <option value="">Nessun punto</option>
            {punti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selezione>
          <AreaTesto id="evento-descrizione" label="Descrizione (facoltativa)" rows={3} errore={errors.descrizione?.message} {...form.register("descrizione")} />
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Check aria-hidden />
            {isSubmitting ? "Salvataggio..." : evento ? "Salva l'evento" : "Aggiungi al programma"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onAnnulla}>
            <X aria-hidden />
            Annulla
          </Button>
        </form>
        {onElimina && (
          <ConfermaAzione
            etichetta="Togli dal programma"
            domanda={`Togliere "${evento?.titolo}" dal programma?`}
            conferma="Sì, togli"
            icona={<Trash2 aria-hidden />}
            onConferma={onElimina}
          />
        )}
      </CardContent>
    </Card>
  );
}
