"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, BottoneWhatsApp, Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { creaTask } from "@/lib/data/tasks";
import { useFesta } from "@/lib/festa-context";
import { dataDaInput, formatGiorno } from "@/lib/format";
import { assegnabili, commissioniPerTask, creazioneTask } from "@/lib/permissions";
import { taskFormSchema, type Membro, type TaskForm } from "@/lib/schemas";
import { destinatariRichiesta } from "@/lib/tasks";
import { linkPagina, testi } from "@/lib/whatsapp";

type Creato = { id: string; titolo: string; richiesta: boolean; commissioneId: string; commissione: string; responsabile?: Membro; scadenza?: string };

// Creazione in un solo form corto (SPEC 6.3): titolo, commissione, responsabile, scadenza.
export default function NuovoTaskPage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <NuovoTask />
    </Suspense>
  );
}

function NuovoTask() {
  const { festa, festaId, commissioni, membri, io } = useFesta();
  const base = `/gestione/f/${festa.slug}`;
  const iniziale = useSearchParams().get("commissione");
  const [errore, setErrore] = useState<string>();
  const [creato, setCreato] = useState<Creato>();

  const sceglibili = commissioniPerTask(io, festa, commissioni);
  const commIniziale = sceglibili.find((c) => c.id === iniziale) ?? sceglibili.find((c) => io.membro?.commissioni[c.id]) ?? sceglibili[0];

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      titolo: "",
      commissioneId: commIniziale?.id ?? "",
      responsabileUid: commIniziale && assegnabili(io, membri, commIniziale.id).persone.some((m) => m.uid === io.uid) ? io.uid : "",
      scadenza: "",
      descrizione: "",
      urgente: false,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const commissioneId = useWatch({ control: form.control, name: "commissioneId" });
  const tipo = creazioneTask(io, festa, commissioneId);
  const { persone, daAssegnare } = assegnabili(io, membri, commissioneId);
  const ordinate = [...persone].sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato));

  if (!sceglibili.length) {
    return <Avviso tipo="errore">Non puoi creare task in questa festa.</Avviso>;
  }

  const onSubmit = form.handleSubmit(async (v) => {
    setErrore(undefined);
    const richiesta = tipo === "richiesta";
    if (!richiesta && !v.responsabileUid && !daAssegnare) {
      form.setError("responsabileUid", { message: "Scegli chi se ne occupa" });
      return;
    }
    try {
      const id = await creaTask(festaId, io.uid, {
        titolo: v.titolo,
        commissioneId: v.commissioneId,
        responsabileUid: v.responsabileUid || null,
        priorita: v.urgente ? "urgente" : "normale",
        descrizione: v.descrizione || undefined,
        scadenza: v.scadenza ? dataDaInput(v.scadenza) : undefined,
        richiesta,
      });
      setCreato({
        id,
        titolo: v.titolo,
        richiesta,
        commissioneId: v.commissioneId,
        commissione: commissioni.find((c) => c.id === v.commissioneId)?.nome ?? "",
        responsabile: membri.find((m) => m.uid === v.responsabileUid),
        scadenza: v.scadenza ? formatGiorno(dataDaInput(v.scadenza)) : undefined,
      });
    } catch {
      setErrore("Non sono riuscito a salvare il task. Controlla la connessione e riprova.");
    }
  });

  if (creato) {
    const link = linkPagina(`${base}/task/${creato.id}`);
    const avvisare = creato.richiesta
      ? destinatariRichiesta(membri, creato.commissioneId)
      : creato.responsabile && creato.responsabile.uid !== io.uid
        ? [creato.responsabile]
        : [];
    return (
      <>
        <TitoloPagina titolo={creato.richiesta ? "Richiesta inviata" : "Task creato"} indietro={`${base}/task`} />
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{creato.titolo}</h2>
            </CardTitle>
            <CardDescription>
              {creato.richiesta
                ? `La commissione ${creato.commissione} deve accettarla. Avvisa chi la gestisce:`
                : creato.responsabile && creato.responsabile.uid !== io.uid
                  ? `Avvisa ${creato.responsabile.nomeVisualizzato} su WhatsApp?`
                  : "Lo trovi tra i task."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {avvisare.map((m) => (
              <BottoneWhatsApp
                key={m.uid}
                telefono={m.telefono}
                testo={
                  creato.richiesta
                    ? testi.richiestaInviata({ nome: m.nomeVisualizzato, commissione: creato.commissione, titolo: creato.titolo, link })
                    : testi.taskAssegnato({ nome: m.nomeVisualizzato, titolo: creato.titolo, scadenza: creato.scadenza, link })
                }
              >
                Avvisa {m.nomeVisualizzato} su WhatsApp
              </BottoneWhatsApp>
            ))}
            <Button asChild variant="outline" size="lg">
              <Link href={`${base}/task/${creato.id}`}>
                <ArrowRight aria-hidden />
                Apri il task
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                form.reset({ ...form.getValues(), titolo: "", descrizione: "", scadenza: "", urgente: false });
                setCreato(undefined);
              }}
            >
              <Plus aria-hidden />
              Crea un altro task
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <TitoloPagina titolo="Nuovo task" indietro={`${base}/task`} />
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            <Campo id="titolo" label="Cosa c'è da fare" autoComplete="off" errore={errors.titolo?.message} {...form.register("titolo")} />
            <Selezione
              id="commissione"
              label="Commissione"
              errore={errors.commissioneId?.message}
              {...form.register("commissioneId", {
                onChange: (e) => {
                  const lista = assegnabili(io, membri, e.target.value).persone;
                  form.setValue("responsabileUid", lista.some((m) => m.uid === io.uid) ? io.uid : "");
                },
              })}
            >
              {sceglibili.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {creazioneTask(io, festa, c.id) === "richiesta" ? " (richiesta)" : ""}
                </option>
              ))}
            </Selezione>

            {tipo === "richiesta" ? (
              <p className="rounded-md bg-colleiano-rust/10 p-3 text-colleiano-slate">
                Non fai parte di questa commissione: sarà una <strong>richiesta</strong>. Un referente la accetta e decide chi se ne occupa.
              </p>
            ) : (
              <Selezione id="responsabile" label="Chi se ne occupa" errore={errors.responsabileUid?.message} {...form.register("responsabileUid")}>
                {daAssegnare ? <option value="">Da assegnare</option> : <option value="">Scegli...</option>}
                {ordinate.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.uid === io.uid ? `Io (${m.nomeVisualizzato})` : m.nomeVisualizzato}
                  </option>
                ))}
              </Selezione>
            )}

            <Campo id="scadenza" label="Entro quando (facoltativo)" type="date" errore={errors.scadenza?.message} {...form.register("scadenza")} />
            <AreaTesto id="descrizione" label="Dettagli (facoltativo)" errore={errors.descrizione?.message} {...form.register("descrizione")} />
            <label className="flex min-h-12 items-center gap-3">
              <input type="checkbox" className="size-6 accent-colleiano-danger" {...form.register("urgente")} />
              <span>È urgente</span>
            </label>

            {errore && <Avviso tipo="errore">{errore}</Avviso>}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {tipo === "richiesta" ? <Send aria-hidden /> : <Check aria-hidden />}
              {isSubmitting ? "Salvataggio..." : tipo === "richiesta" ? "Invia la richiesta" : "Crea il task"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
