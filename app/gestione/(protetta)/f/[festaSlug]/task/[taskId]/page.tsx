"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { Ban, Check, CircleSlash, Pause, Pencil, Play, RotateCcw, Undo2, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, BottoneWhatsApp, ConfermaAzione, Etichetta, Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { BadgeStato, Scadenza } from "@/components/task-riga";
import { Checklist, Commenti, LinkEAllegati, StoricoTask } from "@/components/task-sezioni";
import { aggiornaTask, useTasks } from "@/lib/data/tasks";
import { useFesta } from "@/lib/festa-context";
import { dataDaInput, dataPerInput, formatGiorno } from "@/lib/format";
import { assegnabili, permessiTask } from "@/lib/permissions";
import type { Membro, StatoTask, Task } from "@/lib/schemas";
import { NOMI_STATO, type TaskConId } from "@/lib/tasks";
import { linkPagina, testi } from "@/lib/whatsapp";

export default function TaskDettaglioPage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <TaskDettaglio />
    </Suspense>
  );
}

function TaskDettaglio() {
  const { taskId } = useParams<{ taskId: string }>();
  const { festa, festaId, io } = useFesta();
  const stato = useTasks(festaId);
  const indietro = `/gestione/f/${festa.slug}/task`;

  if (stato.stato === "caricamento") return <Caricamento />;
  if (stato.stato === "errore") return <Avviso tipo="errore">Non riesco a caricare il task. Controlla la connessione e riprova.</Avviso>;
  const task = stato.dati.find((t) => t.id === taskId);
  if (!task) {
    return (
      <>
        <TitoloPagina titolo="Task" indietro={indietro} />
        <Avviso tipo="errore">Questo task non esiste più.</Avviso>
      </>
    );
  }
  const permessi = permessiTask(io, festa, task);

  return (
    <>
      <TitoloPagina titolo={task.titolo} indietro={indietro} />
      <Riepilogo task={task} />
      <Azioni task={task} />
      <Checklist task={task} puo={permessi.lavoro} />
      <LinkEAllegati task={task} puoLink={permessi.lavoro} puoAllegati={permessi.allegati} />
      <Commenti task={task} />
      <StoricoTask task={task} />
    </>
  );
}

function Riepilogo({ task }: { task: TaskConId }) {
  const { festa, commissioni, nomeDi } = useFesta();
  const comm = commissioni.find((c) => c.id === task.commissioneId);
  const [modifica, setModifica] = useState(false);
  const permessi = permessiTask(useFesta().io, festa, task);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <BadgeStato stato={task.stato} />
          {comm && <Etichetta colore={comm.colore}>{comm.nome}</Etichetta>}
          {task.priorita === "urgente" && <span className="font-semibold text-colleiano-danger">Urgente</span>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Chi se ne occupa</dt>
          <dd className="font-medium">{task.responsabileUid ? nomeDi(task.responsabileUid) : task.stato === "richiesta" ? "Da decidere" : "Da assegnare"}</dd>
          {task.scadenza && (
            <>
              <dt className="text-muted-foreground">Entro</dt>
              <dd>
                <span className="first-letter:uppercase">{formatGiorno(task.scadenza)}</span> <Scadenza task={task} />
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">{task.richiestoDa ? "Chiesto da" : "Creato da"}</dt>
          <dd>{nomeDi(task.richiestoDa ?? task.createdBy)}</dd>
        </dl>
        {task.stato === "bloccato" && task.motivoBlocco && (
          <p className="rounded-md bg-colleiano-danger/5 p-3 text-colleiano-danger">
            <strong>Perché è bloccato:</strong> {task.motivoBlocco}
          </p>
        )}
        {task.motivoRifiuto && task.stato === "annullato" && (
          <p className="rounded-md bg-muted p-3">
            <strong>Richiesta rifiutata:</strong> {task.motivoRifiuto}
          </p>
        )}
        {task.descrizione && !modifica && <p className="whitespace-pre-wrap">{task.descrizione}</p>}
        {permessi.dati && !modifica && (
          <Button variant="outline" size="lg" onClick={() => setModifica(true)}>
            <Pencil aria-hidden />
            Modifica
          </Button>
        )}
        {modifica && <ModificaDati task={task} spostaCommissione={permessi.spostaCommissione} onFine={() => setModifica(false)} />}
        <BottoneWhatsApp
          testo={testi.condividiTask({
            titolo: task.titolo,
            commissione: comm?.nome ?? "",
            stato: NOMI_STATO[task.stato],
            responsabile: task.responsabileUid ? nomeDi(task.responsabileUid) : "da assegnare",
            scadenza: task.scadenza ? formatGiorno(task.scadenza) : undefined,
            link: linkPagina(`/gestione/f/${festa.slug}/task/${task.id}`),
          })}
        />
      </CardContent>
    </Card>
  );
}

function ModificaDati({ task, spostaCommissione, onFine }: { task: TaskConId; spostaCommissione: boolean; onFine: () => void }) {
  const { festaId, commissioni, io } = useFesta();
  const [v, setV] = useState({
    titolo: task.titolo,
    descrizione: task.descrizione ?? "",
    scadenza: dataPerInput(task.scadenza),
    urgente: task.priorita === "urgente",
    commissioneId: task.commissioneId,
  });
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);

  async function salva() {
    if (!v.titolo.trim()) return setErrore("Scrivi cosa c'è da fare.");
    setInCorso(true);
    setErrore(undefined);
    try {
      await aggiornaTask(festaId, task.id, io.uid, {
        titolo: v.titolo.trim(),
        descrizione: v.descrizione.trim() || undefined,
        scadenza: v.scadenza ? dataDaInput(v.scadenza) : undefined,
        priorita: v.urgente ? "urgente" : "normale",
        ...(spostaCommissione && v.commissioneId !== task.commissioneId && { commissioneId: v.commissioneId }),
      } as Parameters<typeof aggiornaTask>[3]);
      onFine();
    } catch {
      setErrore("Non sono riuscito a salvare. Riprova.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md bg-muted/60 p-4">
      <Campo id="mod-titolo" label="Cosa c'è da fare" value={v.titolo} maxLength={200} onChange={(e) => setV({ ...v, titolo: e.target.value })} />
      {spostaCommissione && (
        <Selezione id="mod-commissione" label="Commissione" value={v.commissioneId} onChange={(e) => setV({ ...v, commissioneId: e.target.value })}>
          {commissioni.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selezione>
      )}
      <Campo id="mod-scadenza" label="Entro quando" type="date" value={v.scadenza} onChange={(e) => setV({ ...v, scadenza: e.target.value })} />
      <AreaTesto id="mod-descrizione" label="Dettagli" value={v.descrizione} maxLength={2000} onChange={(e) => setV({ ...v, descrizione: e.target.value })} />
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" className="size-6 accent-colleiano-danger" checked={v.urgente} onChange={(e) => setV({ ...v, urgente: e.target.checked })} />
        <span>È urgente</span>
      </label>
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={salva} disabled={inCorso}>
          <Check aria-hidden />
          {inCorso ? "Salvataggio..." : "Salva"}
        </Button>
        <Button size="lg" variant="ghost" onClick={onFine} disabled={inCorso}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

type Esito = { testo: string; avvisi: { persona: Membro; testo: string }[] };

/** La cosa principale da fare sul task, in base allo stato e ai permessi. */
function Azioni({ task }: { task: TaskConId }) {
  const { festa, festaId, membri, io, nomeDi } = useFesta();
  const [esito, setEsito] = useState<Esito>();
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const [blocco, setBlocco] = useState<string>();
  const [rifiuto, setRifiuto] = useState<string>();
  const permessi = permessiTask(io, festa, task);
  const { persone, daAssegnare } = assegnabili(io, membri, task.commissioneId);
  const [scelta, setScelta] = useState(task.responsabileUid ?? "");

  const link = linkPagina(`/gestione/f/${festa.slug}/task/${task.id}`);
  const persona = (uid: string | null | undefined) => membri.find((m) => m.uid === uid && m.attivo);
  const scadenza = task.scadenza ? formatGiorno(task.scadenza) : undefined;
  const avvisoAssegnato = (uid: string | null) => {
    const p = persona(uid);
    return p && p.uid !== io.uid ? [{ persona: p, testo: testi.taskAssegnato({ nome: p.nomeVisualizzato, titolo: task.titolo, scadenza, link }) }] : [];
  };

  async function salva(modifiche: Partial<Record<keyof Task, unknown>>, nuovoEsito?: Esito) {
    setInCorso(true);
    setErrore(undefined);
    setEsito(undefined);
    try {
      await aggiornaTask(festaId, task.id, io.uid, modifiche as Parameters<typeof aggiornaTask>[3]);
      setEsito(nuovoEsito);
      setBlocco(undefined);
      setRifiuto(undefined);
    } catch {
      setErrore("Non sono riuscito a salvare. Controlla la connessione e riprova.");
    } finally {
      setInCorso(false);
    }
  }

  const puoStato = (s: StatoTask) => permessi.stati.includes(s) && task.stato !== s;
  const conResponsabile = task.responsabileUid !== null;
  const ordinate = [...persone].sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato));
  const richiedente = persona(task.richiestoDa);

  const sceltaPersona = (id: string, label: string) => (
    <Selezione id={id} label={label} value={scelta} onChange={(e) => setScelta(e.target.value)}>
      {daAssegnare ? <option value="">Da assegnare</option> : <option value="">Scegli...</option>}
      {ordinate.map((m) => (
        <option key={m.uid} value={m.uid}>
          {m.uid === io.uid ? `Io (${m.nomeVisualizzato})` : m.nomeVisualizzato}
        </option>
      ))}
    </Selezione>
  );

  const contenuto = [];

  if (task.stato === "richiesta" && permessi.gestisce) {
    contenuto.push(
      <div key="accetta" className="flex flex-col gap-3">
        <p className="font-medium">
          Richiesta di {nomeDi(task.richiestoDa)}. La accetti?
        </p>
        {sceltaPersona("accetta-persona", "Chi se ne occupa")}
        <Button
          size="lg"
          disabled={inCorso || (!scelta && !daAssegnare)}
          onClick={() =>
            salva({ stato: "da_fare", responsabileUid: scelta || null }, {
              testo: "Richiesta accettata.",
              avvisi: [
                ...(richiedente && richiedente.uid !== io.uid
                  ? [{ persona: richiedente, testo: testi.richiestaAccettata({ nome: richiedente.nomeVisualizzato, titolo: task.titolo, responsabile: scelta ? nomeDi(scelta) : "la commissione", link }) }]
                  : []),
                ...avvisoAssegnato(scelta || null),
              ],
            })
          }
        >
          <UserCheck aria-hidden />
          Accetta
        </Button>
        {rifiuto === undefined ? (
          <Button variant="outline" size="lg" onClick={() => setRifiuto("")}>
            <X aria-hidden />
            Rifiuta
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-colleiano-danger/30 bg-colleiano-danger/5 p-4">
            <AreaTesto id="motivo-rifiuto" label="Perché la rifiuti?" value={rifiuto} maxLength={500} onChange={(e) => setRifiuto(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                className="bg-colleiano-danger text-white hover:bg-colleiano-danger/90"
                disabled={inCorso || !rifiuto.trim()}
                onClick={() =>
                  salva({ stato: "annullato", motivoRifiuto: rifiuto.trim() }, {
                    testo: "Richiesta rifiutata.",
                    avvisi: richiedente && richiedente.uid !== io.uid
                      ? [{ persona: richiedente, testo: testi.richiestaRifiutata({ nome: richiedente.nomeVisualizzato, titolo: task.titolo, motivo: rifiuto.trim(), link }) }]
                      : [],
                  })
                }
              >
                <Ban aria-hidden />
                Rifiuta la richiesta
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setRifiuto(undefined)}>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </div>,
    );
  } else if (task.stato === "richiesta" && task.richiestoDa === io.uid && puoStato("annullato")) {
    contenuto.push(
      <p key="attesa" className="text-muted-foreground">
        In attesa che la commissione accetti la tua richiesta.
      </p>,
      <ConfermaAzione
        key="ritira"
        etichetta="Ritira la richiesta"
        domanda="Vuoi davvero ritirare la richiesta?"
        conferma="Sì, ritira"
        icona={<Undo2 aria-hidden />}
        onConferma={() => salva({ stato: "annullato" }, { testo: "Richiesta ritirata.", avvisi: [] })}
      />,
    );
  }

  if (task.stato !== "richiesta" && conResponsabile) {
    const bottoni = [];
    if (task.stato === "da_fare" && puoStato("in_corso"))
      bottoni.push(<Button key="inizio" size="lg" variant="outline" disabled={inCorso} onClick={() => salva({ stato: "in_corso" })}><Play aria-hidden />Inizio</Button>);
    if (task.stato === "bloccato" && puoStato("in_corso"))
      bottoni.push(<Button key="riprendo" size="lg" variant="outline" disabled={inCorso} onClick={() => salva({ stato: "in_corso", motivoBlocco: undefined })}><Play aria-hidden />Riprendo</Button>);
    if (["da_fare", "in_corso", "bloccato"].includes(task.stato) && puoStato("fatto"))
      bottoni.push(<Button key="fatto" size="lg" disabled={inCorso} onClick={() => salva({ stato: "fatto", motivoBlocco: undefined }, { testo: "Ottimo, task fatto!", avvisi: [] })}><Check aria-hidden />Fatto</Button>);
    if (["da_fare", "in_corso"].includes(task.stato) && puoStato("bloccato") && blocco === undefined)
      bottoni.push(<Button key="blocca" size="lg" variant="outline" disabled={inCorso} onClick={() => setBlocco("")}><Pause aria-hidden />Sono bloccato</Button>);
    if (task.stato === "fatto" && puoStato("in_corso"))
      bottoni.push(<Button key="riapri" size="lg" variant="outline" disabled={inCorso} onClick={() => salva({ stato: "in_corso" })}><RotateCcw aria-hidden />Riapri</Button>);
    if (bottoni.length) contenuto.push(<div key="stati" className="flex flex-wrap gap-2">{bottoni}</div>);
  }

  if (blocco !== undefined) {
    contenuto.push(
      <div key="blocco" className="flex flex-col gap-3 rounded-md bg-muted/60 p-4">
        <AreaTesto id="motivo-blocco" label="Cosa ti blocca?" value={blocco} maxLength={500} onChange={(e) => setBlocco(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={inCorso || !blocco.trim()} onClick={() => salva({ stato: "bloccato", motivoBlocco: blocco.trim() })}>
            <Pause aria-hidden />
            Segna come bloccato
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setBlocco(undefined)}>
            Annulla
          </Button>
        </div>
      </div>,
    );
  }

  // Assegnare o riassegnare: referenti e admin.
  if (permessi.gestisce && ["da_fare", "in_corso", "bloccato"].includes(task.stato)) {
    contenuto.push(
      <div key="assegna" className="flex flex-col gap-3 rounded-md bg-muted/60 p-4">
        {sceltaPersona("assegna-persona", task.responsabileUid ? "Passa il task a" : "Assegna il task a")}
        <Button
          size="lg"
          variant="outline"
          disabled={inCorso || scelta === (task.responsabileUid ?? "") || (!scelta && !daAssegnare)}
          onClick={() =>
            salva(
              { responsabileUid: scelta || null, ...(!scelta && { stato: "da_fare", motivoBlocco: undefined }) },
              { testo: scelta ? `Assegnato a ${nomeDi(scelta)}.` : "Ora il task è da assegnare.", avvisi: avvisoAssegnato(scelta || null) },
            )
          }
        >
          <UserCheck aria-hidden />
          {scelta ? "Assegna" : "Lascia da assegnare"}
        </Button>
      </div>,
    );
  }

  if (task.stato === "annullato" && permessi.gestisce && !task.motivoRifiuto) {
    contenuto.push(
      <Button key="ripristina" size="lg" variant="outline" disabled={inCorso} onClick={() => salva({ stato: "da_fare" })}>
        <RotateCcw aria-hidden />
        Rimetti da fare
      </Button>,
    );
  }

  if (!["richiesta", "annullato"].includes(task.stato) && puoStato("annullato")) {
    contenuto.push(
      <ConfermaAzione
        key="annulla"
        etichetta="Annulla il task"
        domanda="Vuoi davvero annullare questo task?"
        conferma="Sì, annulla"
        icona={<CircleSlash aria-hidden />}
        onConferma={() => salva({ stato: "annullato" }, { testo: "Task annullato.", avvisi: [] })}
      />,
    );
  }

  if (!contenuto.length && !esito && !errore) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {esito && (
          <div className="flex flex-col gap-3">
            <Avviso tipo="ok">{esito.testo}</Avviso>
            {esito.avvisi.map((a) => (
              <BottoneWhatsApp key={a.persona.uid} telefono={a.persona.telefono} testo={a.testo}>
                Avvisa {a.persona.nomeVisualizzato} su WhatsApp
              </BottoneWhatsApp>
            ))}
          </div>
        )}
        {contenuto}
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
      </CardContent>
    </Card>
  );
}
