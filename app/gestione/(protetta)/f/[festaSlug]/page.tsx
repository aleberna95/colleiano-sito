"use client";

import Link from "next/link";
import { CalendarDays, ClipboardCheck, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatoVuoto } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { ListaSpese } from "@/components/spesa-riga";
import { ListaTask } from "@/components/task-riga";
import { useUtente } from "@/lib/auth-context";
import { useMovimenti } from "@/lib/data/spese";
import { useTasks } from "@/lib/data/tasks";
import { useFesta } from "@/lib/festa-context";
import { formatData, formatEuro, giorniAlla } from "@/lib/format";
import { commissioniPerSpesa, commissioniPerTask, permessiTask, puoDecidereSpesa } from "@/lib/permissions";
import { chiaveUrl, crediti } from "@/lib/spese";
import { aperto, ordinaPerScadenza } from "@/lib/tasks";

// "Le mie cose" (SPEC 6.2).
export default function LeMieCose() {
  const { profilo } = useUtente();
  const { festa, festaId, commissioni, membri, io } = useFesta();
  const stato = useTasks(festaId);
  const soldi = useMovimenti(festaId);
  const giorni = festa.dataFesta ? giorniAlla(festa.dataFesta) : undefined;
  const base = `/gestione/f/${festa.slug}`;

  const tasks = stato.stato === "ok" ? stato.dati : [];
  // Da gestire: richieste arrivate alle commissioni che gestisco.
  const daGestire = tasks.filter((t) => t.stato === "richiesta" && permessiTask(io, festa, t).gestisce);
  const miei = ordinaPerScadenza(tasks.filter((t) => t.responsabileUid === io.uid && aperto(t)));
  const datiAdAltri = ordinaPerScadenza(
    tasks.filter(
      (t) =>
        (t.createdBy === io.uid || t.richiestoDa === io.uid) &&
        t.responsabileUid !== io.uid &&
        (aperto(t) || t.stato === "richiesta"),
    ),
  );
  const puoCreare = commissioniPerTask(io, festa, commissioni).length > 0;

  const movimenti = soldi.stato === "ok" ? soldi.dati : [];
  const unicoAdmin = io.superadmin && !membri.some((m) => m.attivo && m.ruoloFesta === "admin" && m.uid !== io.uid);
  const daApprovare = movimenti.filter((m) => puoDecidereSpesa(io, festa, m, unicoAdmin)).length;
  // I miei soldi: le spese che ho segnato o pagato io, ancora da chiudere, e quanto devo ricevere.
  const mieSpese = movimenti
    .filter(
      (m) =>
        m.tipo === "spesa" &&
        (m.createdBy === io.uid || m.pagatoDa.beneficiarioUid === io.uid) &&
        ["in_attesa", "rifiutata", "approvata"].includes(m.stato),
    )
    .sort((a, b) => b.dataSpesa.toMillis() - a.dataSpesa.toMillis());
  const mioCredito = crediti(movimenti, membri).find((c) => c.beneficiarioUid === io.uid);
  const puoSpendere = commissioniPerSpesa(io, festa, commissioni).length > 0;

  return (
    <>
      <h1 className="text-3xl">Ciao {profilo?.nome}!</h1>

      {stato.stato === "caricamento" && <Caricamento />}
      {stato.stato === "errore" && <Avviso tipo="errore">Non riesco a caricare i task. Controlla la connessione e riprova.</Avviso>}

      {(daGestire.length > 0 || daApprovare > 0) && (
        <section className="flex flex-col gap-3" aria-labelledby="da-gestire">
          <h2 id="da-gestire" className="flex items-center gap-2 text-2xl">
            Da gestire
            <span className="rounded-full bg-colleiano-rust px-2.5 text-base font-semibold text-white">{daGestire.length + daApprovare}</span>
          </h2>
          {daApprovare > 0 && (
            <Button asChild size="lg" variant="secondary">
              <Link href={`${base}/spese/da-approvare`}>
                <ClipboardCheck aria-hidden />
                {daApprovare === 1 ? "1 spesa da approvare" : `${daApprovare} spese da approvare`}
              </Link>
            </Button>
          )}
          {daGestire.length > 0 && (
            <>
              <p className="text-muted-foreground">Richieste arrivate alle tue commissioni: accettale o rifiutale.</p>
              <ListaTask tasks={daGestire} />
            </>
          )}
        </section>
      )}

      {stato.stato === "ok" && (
        <section className="flex flex-col gap-3" aria-labelledby="miei-task">
          <h2 id="miei-task" className="text-2xl">I miei task</h2>
          {miei.length ? (
            <ListaTask tasks={miei} azioniRapide mostraResponsabile={false} />
          ) : (
            <StatoVuoto titolo="Nessun task per te">
              Quando qualcuno ti darà un task lo troverai qui{puoCreare ? ", oppure creane uno tu." : "."}
            </StatoVuoto>
          )}
          {puoCreare && (
            <Button asChild size="lg" variant="outline">
              <Link href={`${base}/task/nuovo`}>
                <Plus aria-hidden />
                Nuovo task
              </Link>
            </Button>
          )}
        </section>
      )}

      {datiAdAltri.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="dati-ad-altri">
          <h2 id="dati-ad-altri" className="text-2xl">Task che ho dato ad altri</h2>
          <ListaTask tasks={datiAdAltri} />
        </section>
      )}

      {soldi.stato === "ok" && (mieSpese.length > 0 || mioCredito || puoSpendere) && (
        <section className="flex flex-col gap-3" aria-labelledby="miei-soldi">
          <h2 id="miei-soldi" className="text-2xl">I miei soldi</h2>
          {mioCredito && mioCredito.daRimborsareCents > 0 && (
            <Link
              href={`${base}/rimborsi/${chiaveUrl(mioCredito.chiave)}`}
              className="flex items-center justify-between gap-3 rounded-lg border-2 border-colleiano-rust/30 bg-colleiano-rust/5 p-4"
            >
              <span className="text-lg">Devi ricevere</span>
              <span className="font-heading text-3xl text-colleiano-rust tabular-nums">{formatEuro(mioCredito.daRimborsareCents)}</span>
            </Link>
          )}
          {mieSpese.length > 0 ? <ListaSpese movimenti={mieSpese} /> : <p className="text-muted-foreground">Nessuna spesa in sospeso.</p>}
          {puoSpendere && (
            <Button asChild size="lg" variant="outline">
              <Link href={`${base}/spese/nuova`}>
                <Receipt aria-hidden />
                Nuova spesa
              </Link>
            </Button>
          )}
        </section>
      )}

      {festa.dataFesta && giorni !== undefined && giorni >= 0 && (
        <Card>
          <CardContent className="flex items-center gap-4">
            <CalendarDays className="size-8 shrink-0 text-colleiano-rust" aria-hidden />
            <div>
              <p className="font-heading text-2xl text-colleiano-forest">
                {giorni === 0 ? "La festa è oggi!" : giorni === 1 ? "Manca 1 giorno" : `Mancano ${giorni} giorni`}
              </p>
              <p className="text-muted-foreground first-letter:uppercase">{formatData(festa.dataFesta)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
