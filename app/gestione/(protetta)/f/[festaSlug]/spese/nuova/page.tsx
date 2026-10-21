"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Camera, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { BottoneWhatsApp, Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { MAX_ALLEGATO_MB } from "@/lib/data/tasks";
import { inviaSpesa } from "@/lib/data/spese";
import { useFesta } from "@/lib/festa-context";
import { dataDaInput, formatEuro, oggiPerInput, parseEuro } from "@/lib/format";
import { commissioniPerSpesa } from "@/lib/permissions";
import { spesaFormSchema, type Membro, type PagatoDa, type SpesaForm } from "@/lib/schemas";
import { linkPagina, testi } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type Inviata = { id: string; descrizione: string; importo: string };

// "Nuova spesa in 30 secondi" dal telefono (SPEC 6.4).
export default function NuovaSpesaPage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <NuovaSpesa />
    </Suspense>
  );
}

function NuovaSpesa() {
  const { festa, festaId, commissioni, membri, io } = useFesta();
  const base = `/gestione/f/${festa.slug}`;
  const iniziale = useSearchParams().get("commissione");
  const sceglibili = commissioniPerSpesa(io, festa, commissioni);
  const commIniziale =
    sceglibili.find((c) => c.id === iniziale) ?? sceglibili.find((c) => io.membro?.commissioni[c.id]) ?? sceglibili[0];
  const [foto, setFoto] = useState<File>();
  const [errore, setErrore] = useState<string>();
  const [inviata, setInviata] = useState<Inviata>();

  const valoriIniziali = (): SpesaForm => ({
    importoEuro: "",
    descrizione: "",
    commissioneId: commIniziale?.id ?? "",
    categoria: festa.categorieSpesa.includes("Altro") ? "Altro" : (festa.categorieSpesa[0] ?? ""),
    dataSpesa: oggiPerInput(),
    chiHaPagato: "io",
    beneficiarioUid: "",
    beneficiarioNome: "",
  });
  const form = useForm<SpesaForm>({ resolver: zodResolver(spesaFormSchema), defaultValues: valoriIniziali() });
  const { errors, isSubmitting } = form.formState;
  const chiHaPagato = useWatch({ control: form.control, name: "chiHaPagato" });
  const beneficiarioUid = useWatch({ control: form.control, name: "beneficiarioUid" });
  const altri = membri.filter((m) => m.attivo && m.uid !== io.uid).sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato));
  // Gli admin da avvisare (SPEC 6.6): tutti tranne me.
  const admin = membri.filter((m) => m.attivo && m.ruoloFesta === "admin" && m.uid !== io.uid);

  if (!sceglibili.length) return <Avviso tipo="errore">Non puoi segnare spese in questa festa.</Avviso>;

  const onSubmit = form.handleSubmit(async (v) => {
    setErrore(undefined);
    let pagatoDa: PagatoDa = { tipo: "cassa" };
    if (v.chiHaPagato === "io") pagatoDa = { tipo: "anticipata", beneficiarioUid: io.uid };
    if (v.chiHaPagato === "altro") {
      if (v.beneficiarioUid) pagatoDa = { tipo: "anticipata", beneficiarioUid: v.beneficiarioUid };
      else if (v.beneficiarioNome) pagatoDa = { tipo: "anticipata", beneficiarioNome: v.beneficiarioNome };
      else return form.setError("beneficiarioNome", { message: "Scegli o scrivi chi ha pagato" });
    }
    const importoCents = parseEuro(v.importoEuro)!;
    try {
      const id = await inviaSpesa(
        festaId,
        io.uid,
        {
          commissioneId: v.commissioneId,
          descrizione: v.descrizione,
          importoCents,
          categoria: v.categoria,
          dataSpesa: dataDaInput(v.dataSpesa),
          pagatoDa,
        },
        foto,
      );
      setInviata({ id, descrizione: v.descrizione, importo: formatEuro(importoCents) });
    } catch {
      setErrore("Non sono riuscito a inviare la spesa. Controlla la connessione e riprova.");
    }
  });

  if (inviata) {
    const link = linkPagina(`${base}/spese/${inviata.id}`);
    return (
      <>
        <TitoloPagina titolo="Spesa inviata" indietro={`${base}/spese`} />
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>
                {inviata.descrizione}: {inviata.importo}
              </h2>
            </CardTitle>
            <CardDescription>
              {admin.length ? "Ora un admin deve approvarla. Avvisalo su WhatsApp?" : "Ora va approvata da un admin."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {admin.map((m: Membro) => (
              <BottoneWhatsApp
                key={m.uid}
                telefono={m.telefono}
                testo={testi.spesaInviata({ nome: m.nomeVisualizzato, descrizione: inviata.descrizione, importo: inviata.importo, link })}
              >
                Avvisa {m.nomeVisualizzato} su WhatsApp
              </BottoneWhatsApp>
            ))}
            <Button asChild variant="outline" size="lg">
              <Link href={`${base}/spese/${inviata.id}`}>
                <ArrowRight aria-hidden />
                Apri la spesa
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                form.reset({ ...valoriIniziali(), commissioneId: form.getValues("commissioneId") });
                setFoto(undefined);
                setInviata(undefined);
              }}
            >
              <Plus aria-hidden />
              Segna un&apos;altra spesa
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const SCELTE = [
    { valore: "cassa", label: "Cassa" },
    { valore: "io", label: "Io" },
    { valore: "altro", label: "Un'altra persona" },
  ] as const;

  return (
    <>
      <TitoloPagina titolo="Nuova spesa" indietro={`${base}/spese`} />
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            {/* 1. Foto dello scontrino */}
            {foto ? (
              <div className="flex items-center gap-3 rounded-md bg-muted/60 p-3">
                <Camera className="size-5 shrink-0 text-colleiano-forest" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{foto.name || "Scontrino"}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFoto(undefined)}>
                  <X aria-hidden />
                  Togli
                </Button>
              </div>
            ) : (
              <label className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-colleiano-forest/40 bg-white px-4 text-lg font-medium text-colleiano-forest has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                <Camera className="size-6" aria-hidden />
                Fotografa lo scontrino
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    if (f.size >= MAX_ALLEGATO_MB * 1024 * 1024) return setErrore(`La foto è troppo grande: massimo ${MAX_ALLEGATO_MB} MB.`);
                    setErrore(undefined);
                    setFoto(f);
                  }}
                />
              </label>
            )}

            {/* 2-4. Importo, cosa è, commissione */}
            <Campo id="importo" label="Quanto hai speso (euro)" inputMode="decimal" placeholder="es. 25,50" autoComplete="off" errore={errors.importoEuro?.message} {...form.register("importoEuro")} />
            <Campo id="descrizione" label="Cosa hai comprato" autoComplete="off" errore={errors.descrizione?.message} {...form.register("descrizione")} />
            <Selezione id="commissione-spesa" label="Per quale commissione" errore={errors.commissioneId?.message} {...form.register("commissioneId")}>
              {sceglibili.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selezione>

            {/* 5. Chi ha pagato? */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">Chi ha pagato?</legend>
              <div className="grid grid-cols-3 gap-2">
                {SCELTE.map((s) => (
                  <label
                    key={s.valore}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center justify-center rounded-md border px-2 text-center has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      chiHaPagato === s.valore ? "border-colleiano-forest bg-colleiano-forest text-white" : "border-colleiano-forest/25 bg-white text-colleiano-forest",
                    )}
                  >
                    <input type="radio" value={s.valore} className="sr-only" {...form.register("chiHaPagato")} />
                    {s.label}
                  </label>
                ))}
              </div>
              {chiHaPagato === "io" && <p className="text-muted-foreground">Ti verrà rimborsata dopo l&apos;approvazione.</p>}
            </fieldset>
            {chiHaPagato === "altro" && (
              <div className="flex flex-col gap-3 rounded-md bg-muted/60 p-4">
                <Selezione id="beneficiario" label="Scegli la persona" {...form.register("beneficiarioUid")}>
                  <option value="">Non è nell&apos;elenco: scrivo il nome</option>
                  {altri.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.nomeVisualizzato}
                    </option>
                  ))}
                </Selezione>
                {!beneficiarioUid && (
                  <Campo id="beneficiario-nome" label="Nome di chi ha pagato" autoComplete="off" errore={errors.beneficiarioNome?.message} {...form.register("beneficiarioNome")} />
                )}
              </div>
            )}

            {festa.categorieSpesa.length > 1 && (
              <Selezione id="categoria" label="Tipo di spesa" {...form.register("categoria")}>
                {festa.categorieSpesa.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Selezione>
            )}
            <Campo id="data-spesa" label="Quando" type="date" errore={errors.dataSpesa?.message} {...form.register("dataSpesa")} />

            {errore && <Avviso tipo="errore">{errore}</Avviso>}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              <Send aria-hidden />
              {isSubmitting ? "Invio in corso..." : "Invia la spesa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
