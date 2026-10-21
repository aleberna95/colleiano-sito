"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Selezione, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { ListaTask } from "@/components/task-riga";
import { Avviso, Caricamento } from "@/components/stato";
import { useTasks } from "@/lib/data/tasks";
import { useFesta } from "@/lib/festa-context";
import { commissioniPerTask } from "@/lib/permissions";
import { filtraTask, NOMI_FILTRO, ordinaPerScadenza, type FiltroTask } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const FILTRI = Object.keys(NOMI_FILTRO) as FiltroTask[];

// Lista unica con filtri a bottoni (SPEC 6.3).
export default function TaskPage() {
  const { festa, festaId, commissioni, membri, io } = useFesta();
  const stato = useTasks(festaId);
  const [filtro, setFiltro] = useState<FiltroTask>("aperti");
  const [commissioneId, setCommissioneId] = useState("");
  const [persona, setPersona] = useState("");
  const puoCreare = commissioniPerTask(io, festa, commissioni).length > 0;

  const tasks = stato.stato === "ok" ? ordinaPerScadenza(filtraTask(stato.dati, { filtro, commissioneId, persona })) : [];
  const conteggi = stato.stato === "ok"
    ? Object.fromEntries(FILTRI.map((f) => [f, filtraTask(stato.dati, { filtro: f, commissioneId, persona }).length]))
    : {};

  return (
    <>
      <TitoloPagina titolo="Task">
        {puoCreare && (
          <Button asChild size="lg">
            <Link href={`/gestione/f/${festa.slug}/task/nuovo${commissioneId ? `?commissione=${commissioneId}` : ""}`}>
              <Plus aria-hidden />
              Nuovo task
            </Link>
          </Button>
        )}
      </TitoloPagina>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Quali task mostrare">
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
            {NOMI_FILTRO[f]}
            {conteggi[f] ? ` (${conteggi[f]})` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Selezione id="filtro-commissione" label="Commissione" value={commissioneId} onChange={(e) => setCommissioneId(e.target.value)}>
          <option value="">Tutte</option>
          {commissioni.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selezione>
        <Selezione id="filtro-persona" label="Chi se ne occupa" value={persona} onChange={(e) => setPersona(e.target.value)}>
          <option value="">Tutti</option>
          <option value={io.uid}>Io</option>
          {membri
            .filter((m) => m.attivo && m.uid !== io.uid)
            .sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato))
            .map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.nomeVisualizzato}
              </option>
            ))}
        </Selezione>
      </div>

      {stato.stato === "caricamento" && <Caricamento />}
      {stato.stato === "errore" && <Avviso tipo="errore">Non riesco a caricare i task. Controlla la connessione e riprova.</Avviso>}
      {stato.stato === "ok" && tasks.length === 0 && (
        <StatoVuoto titolo={stato.dati.length ? "Nessun task con questi filtri" : "Ancora nessun task"}>
          {stato.dati.length
            ? "Prova a cambiare i filtri qui sopra."
            : puoCreare
              ? "Premi \"Nuovo task\" per scrivere la prima cosa da fare."
              : "Quando qualcuno creerà un task lo vedrai qui."}
        </StatoVuoto>
      )}
      {tasks.length > 0 && <ListaTask tasks={tasks} />}
    </>
  );
}
