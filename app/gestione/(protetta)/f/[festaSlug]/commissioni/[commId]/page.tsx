"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Selezione, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { CommissioneForm } from "@/components/commissione-form";
import { ListaTask } from "@/components/task-riga";
import { Avviso, Caricamento } from "@/components/stato";
import { aggiornaRuoli, erroreCallable } from "@/lib/callable";
import { useTasks } from "@/lib/data/tasks";
import { db } from "@/lib/firebase";
import { useFesta, type CommissioneConId } from "@/lib/festa-context";
import { COLORI_COMMISSIONE, formatEuro } from "@/lib/format";
import { creazioneTask, modificaCommissione, puoGestireMembriCommissione } from "@/lib/permissions";
import type { Membro, RuoloCommissione } from "@/lib/schemas";
import { aperto, ordinaPerScadenza } from "@/lib/tasks";
import { cn, senza } from "@/lib/utils";

export default function CommissionePage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <CommissioneDettaglio />
    </Suspense>
  );
}

function CommissioneDettaglio() {
  const { commId } = useParams<{ commId: string }>();
  const { festa, festaId, commissioni, io } = useFesta();
  const c = commissioni.find((x) => x.id === commId);
  const [modifica, setModifica] = useState(false);
  if (!c) return <Avviso tipo="errore">Commissione non trovata.</Avviso>;

  const permesso = modificaCommissione(io, festa, c.id);

  return (
    <>
      <TitoloPagina titolo={c.nome} indietro={`/gestione/f/${festa.slug}/commissioni`} />

      <div className={cn("flex flex-col gap-2 rounded-lg border-2 p-5", COLORI_COMMISSIONE[c.colore].classi)}>
        <p>{c.descrizione || "Nessuna descrizione."}</p>
        {c.budgetCents !== undefined && (
          <p>
            <strong>Budget:</strong> {formatEuro(c.budgetCents)}
          </p>
        )}
      </div>

      {permesso && !modifica && (
        <Button variant="outline" size="lg" onClick={() => setModifica(true)}>
          {permesso === "tutto" ? "Modifica la commissione" : "Modifica la descrizione"}
        </Button>
      )}
      {permesso && modifica && (
        <Card>
          <CardContent>
            <CommissioneForm
              iniziale={c}
              soloDescrizione={permesso === "descrizione"}
              nomeBloccato={c.generale}
              etichetta="Salva"
              onSalva={async (d) => {
                const audit = { updatedAt: serverTimestamp(), updatedBy: io.uid };
                const descrizione = d.descrizione ?? deleteField();
                await updateDoc(
                  doc(db, "feste", festaId, "commissioni", c.id),
                  permesso === "descrizione"
                    ? { descrizione, ...audit }
                    : {
                        nome: d.nome,
                        descrizione,
                        colore: d.colore,
                        budgetCents: d.budgetCents ?? deleteField(),
                        ...audit,
                      },
                );
                setModifica(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      {!c.generale && <Persone c={c} />}

      <TaskCommissione c={c} />
    </>
  );
}

function Persone({ c }: { c: CommissioneConId }) {
  const { festa, festaId, membri, io } = useFesta();
  const [errore, setErrore] = useState<string>();
  const [nuovo, setNuovo] = useState("");
  const [ruolo, setRuolo] = useState<RuoloCommissione>("componente");
  const [inCorso, setInCorso] = useState(false);
  const puo = puoGestireMembriCommissione(io, festa, c.id);

  const attivi = membri.filter((m) => m.attivo);
  const dentro = attivi.filter((m) => m.commissioni[c.id]);
  const fuori = attivi.filter((m) => !m.commissioni[c.id]).sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato));

  async function cambia(m: Membro, nuovoRuolo: RuoloCommissione | null) {
    setErrore(undefined);
    setInCorso(true);
    const resto = senza(m.commissioni, c.id);
    try {
      await aggiornaRuoli({ festaId, uid: m.uid, commissioni: nuovoRuolo ? { ...resto, [c.id]: nuovoRuolo } : resto });
      setNuovo("");
    } catch (err) {
      setErrore(erroreCallable(err));
    } finally {
      setInCorso(false);
    }
  }

  const ordinati = [...dentro].sort(
    (a, b) => (a.commissioni[c.id] === "referente" ? -1 : 1) - (b.commissioni[c.id] === "referente" ? -1 : 1),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Persone</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {dentro.length === 0 && <p className="text-muted-foreground">Nessuno ancora.</p>}
        <ul className="flex flex-col divide-y">
          {ordinati.map((m) => (
            <li key={m.uid} className="flex min-h-14 items-center gap-3 py-2">
              <span className="flex-1">
                <span className="font-medium">{m.nomeVisualizzato}</span>{" "}
                <span className="text-muted-foreground">· {m.commissioni[c.id] === "referente" ? "referente" : "componente"}</span>
              </span>
              {puo && (
                <Button variant="ghost" size="sm" disabled={inCorso} onClick={() => cambia(m, null)} aria-label={`Togli ${m.nomeVisualizzato}`}>
                  <X aria-hidden />
                  Togli
                </Button>
              )}
            </li>
          ))}
        </ul>

        {puo && fuori.length > 0 && (
          <div className="flex flex-col gap-3 rounded-md bg-muted/60 p-4">
            <Selezione id="nuovo-membro" label="Aggiungi una persona" value={nuovo} onChange={(e) => setNuovo(e.target.value)}>
              <option value="">Scegli...</option>
              {fuori.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.nomeVisualizzato}
                </option>
              ))}
            </Selezione>
            <Selezione id="nuovo-ruolo" label="Come" value={ruolo} onChange={(e) => setRuolo(e.target.value as RuoloCommissione)}>
              <option value="componente">Componente</option>
              <option value="referente">Referente</option>
            </Selezione>
            <Button
              size="lg"
              disabled={!nuovo || inCorso}
              onClick={() => {
                const m = fuori.find((x) => x.uid === nuovo);
                if (m) void cambia(m, ruolo);
              }}
            >
              <UserPlus aria-hidden />
              Aggiungi
            </Button>
          </div>
        )}
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
      </CardContent>
    </Card>
  );
}

function TaskCommissione({ c }: { c: CommissioneConId }) {
  const { festa, festaId, io } = useFesta();
  const stato = useTasks(festaId);
  const tipo = creazioneTask(io, festa, c.id);
  const tasks = stato.stato === "ok" ? ordinaPerScadenza(stato.dati.filter((t) => t.commissioneId === c.id && (aperto(t) || t.stato === "richiesta"))) : [];

  return (
    <section className="flex flex-col gap-3" aria-labelledby="task-commissione">
      <h2 id="task-commissione" className="text-2xl">Task da chiudere</h2>
      {stato.stato === "caricamento" && <Caricamento />}
      {stato.stato === "errore" && <Avviso tipo="errore">Non riesco a caricare i task.</Avviso>}
      {stato.stato === "ok" && !tasks.length && <StatoVuoto titolo="Niente in sospeso">Questa commissione non ha task aperti.</StatoVuoto>}
      {tasks.length > 0 && <ListaTask tasks={tasks} />}
      {tipo && (
        <Button asChild size="lg" variant="outline">
          <Link href={`/gestione/f/${festa.slug}/task/nuovo?commissione=${c.id}`}>
            <Plus aria-hidden />
            {tipo === "richiesta" ? "Chiedi qualcosa a questa commissione" : "Nuovo task"}
          </Link>
        </Button>
      )}
    </section>
  );
}
