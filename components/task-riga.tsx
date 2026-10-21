"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Etichetta } from "@/components/comuni";
import { aggiornaTask } from "@/lib/data/tasks";
import { useFesta } from "@/lib/festa-context";
import { permessiTask } from "@/lib/permissions";
import { CLASSI_STATO, giorniAllaScadenza, NOMI_STATO, testoScadenza, type TaskConId } from "@/lib/tasks";
import type { StatoTask } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function BadgeStato({ stato }: { stato: StatoTask }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.95rem] font-medium", CLASSI_STATO[stato])}>
      {NOMI_STATO[stato]}
    </span>
  );
}

export function Scadenza({ task }: { task: TaskConId }) {
  const giorni = giorniAllaScadenza(task);
  if (giorni === undefined) return null;
  const urgente = giorni <= 0;
  return (
    <span className={cn("inline-flex items-center gap-1", urgente ? "font-semibold text-colleiano-danger" : "text-muted-foreground")}>
      {urgente ? <TriangleAlert className="size-4" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
      {testoScadenza(giorni)}
    </span>
  );
}

/** Una riga di task; con `azioniRapide` mostra "Inizio" e "Fatto" (SPEC 6.2). */
export function TaskRiga({ task, azioniRapide = false, mostraResponsabile = true }: {
  task: TaskConId;
  azioniRapide?: boolean;
  mostraResponsabile?: boolean;
}) {
  const { festa, festaId, commissioni, io, nomeDi } = useFesta();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  const comm = commissioni.find((c) => c.id === task.commissioneId);
  const stati = permessiTask(io, festa, task).stati;
  const conResponsabile = task.responsabileUid !== null;

  async function passaA(stato: StatoTask) {
    setInCorso(true);
    setErrore(false);
    try {
      await aggiornaTask(festaId, task.id, io.uid, { stato });
    } catch {
      setErrore(true);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-colleiano-surface p-4 shadow-xs">
      <Link href={`/gestione/f/${festa.slug}/task/${task.id}`} className="flex flex-col gap-2">
        <span className="flex items-start justify-between gap-3">
          <span className="text-lg font-semibold text-colleiano-forest underline-offset-4 hover:underline">{task.titolo}</span>
          <BadgeStato stato={task.stato} />
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {comm && <Etichetta colore={comm.colore}>{comm.nome}</Etichetta>}
          {task.priorita === "urgente" && <span className="font-semibold text-colleiano-danger">Urgente</span>}
          {mostraResponsabile && (
            <span className="text-muted-foreground">{conResponsabile ? nomeDi(task.responsabileUid) : "Da assegnare"}</span>
          )}
          <Scadenza task={task} />
        </span>
      </Link>
      {azioniRapide && conResponsabile && (
        <div className="flex flex-wrap gap-2">
          {task.stato === "da_fare" && stati.includes("in_corso") && (
            <Button variant="outline" size="lg" disabled={inCorso} onClick={() => passaA("in_corso")}>
              <Play aria-hidden />
              Inizio
            </Button>
          )}
          {task.stato !== "fatto" && stati.includes("fatto") && (
            <Button size="lg" disabled={inCorso} onClick={() => passaA("fatto")}>
              <Check aria-hidden />
              Fatto
            </Button>
          )}
        </div>
      )}
      {errore && <p className="text-colleiano-danger">Non sono riuscito a salvare. Riprova.</p>}
    </li>
  );
}

export function ListaTask({ tasks, ...props }: { tasks: TaskConId[]; azioniRapide?: boolean; mostraResponsabile?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((t) => (
        <TaskRiga key={t.id} task={t} {...props} />
      ))}
    </ul>
  );
}
