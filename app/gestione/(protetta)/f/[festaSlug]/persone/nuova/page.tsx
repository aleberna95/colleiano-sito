"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { Check, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { BottoneWhatsApp, Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso } from "@/components/stato";
import { creaPersona, erroreCallable } from "@/lib/callable";
import { auth } from "@/lib/firebase";
import { useFesta } from "@/lib/festa-context";
import { NOMI_RUOLO_FESTA } from "@/lib/format";
import { puoAggiungerePersone, ruoliFestaAssegnabili } from "@/lib/permissions";
import { creaPersonaInput } from "@/lib/schemas";
import { testi } from "@/lib/whatsapp";

const formSchema = creaPersonaInput.omit({ festaId: true, commissioni: true });
type Form = z.input<typeof formSchema>;
type Risultato = Awaited<ReturnType<typeof creaPersona>>;
type Invio = "inviata" | "errore" | "in_corso";

/** Email nativa di Firebase con il link per scegliere la password (SPEC 6.5). */
async function mandaEmail(email: string): Promise<Invio> {
  try {
    await sendPasswordResetEmail(auth, email);
    return "inviata";
  } catch {
    return "errore";
  }
}

// Nuova persona: nome, telefono, email (SPEC 6.5). Riceve un'email per scegliere la password; i ruoli si danno dopo.
export default function NuovaPersonaPage() {
  const { festa, festaId, io } = useFesta();
  const base = `/gestione/f/${festa.slug}`;
  const [errore, setErrore] = useState<string>();
  const [fatto, setFatto] = useState<Risultato>();
  const [invio, setInvio] = useState<Invio>();
  const ruoli = ruoliFestaAssegnabili(io);

  const form = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome: "", cognome: "", telefono: "", email: "", ruoloFesta: "membro" },
  });
  const { errors, isSubmitting } = form.formState;

  if (!puoAggiungerePersone(io, festa)) {
    return <Avviso tipo="errore">Solo un admin può aggiungere persone.</Avviso>;
  }

  const onSubmit = form.handleSubmit(async (v) => {
    setErrore(undefined);
    try {
      const r = await creaPersona({ ...v, ruoloFesta: v.ruoloFesta ?? "membro", festaId, commissioni: {} });
      setFatto(r);
      if (r.nuovoAccount) setInvio(await mandaEmail(r.email));
    } catch (err) {
      setErrore(erroreCallable(err));
    }
  });

  if (fatto) {
    const nome = fatto.nomeVisualizzato;
    return (
      <>
        <TitoloPagina titolo="Persona aggiunta" indietro={`${base}/persone`} />
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{nome} è nella festa</h2>
            </CardTitle>
            <CardDescription>
              {fatto.nuovoAccount
                ? `Le arriva un'email a ${fatto.email} con un link per scegliere la sua password. Avvisala anche su WhatsApp.`
                : "Aveva già un account: può entrare con le sue solite credenziali."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {fatto.nuovoAccount && invio === "inviata" && <Avviso tipo="ok">Email inviata a {fatto.email}.</Avviso>}
            {fatto.nuovoAccount && invio === "errore" && (
              <Avviso tipo="errore">Non sono riuscito a mandare l&apos;email. Riprova con il pulsante qui sotto.</Avviso>
            )}
            <BottoneWhatsApp
              telefono={fatto.telefono}
              testo={fatto.nuovoAccount ? testi.invito({ nome, email: fatto.email }) : testi.aggiuntoAllaFesta({ nome, festa: festa.nome })}
            />
            {fatto.nuovoAccount && (
              <Button
                variant="outline"
                size="lg"
                disabled={invio === "in_corso"}
                onClick={async () => {
                  setInvio("in_corso");
                  setInvio(await mandaEmail(fatto.email));
                }}
              >
                <Mail aria-hidden />
                {invio === "in_corso" ? "Invio..." : "Rimanda l'email"}
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link href={`${base}/persone/${fatto.uid}`}>Assegna le commissioni</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                form.reset();
                setFatto(undefined);
                setInvio(undefined);
              }}
            >
              <UserPlus aria-hidden />
              Aggiungi un&apos;altra persona
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <TitoloPagina titolo="Nuova persona" indietro={`${base}/persone`} />
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            <Campo id="nome" label="Nome" autoComplete="off" errore={errors.nome?.message} {...form.register("nome")} />
            <Campo id="cognome" label="Cognome" autoComplete="off" errore={errors.cognome?.message} {...form.register("cognome")} />
            <Campo
              id="telefono"
              label="Telefono (per WhatsApp)"
              type="tel"
              inputMode="tel"
              placeholder="333 123 4567"
              errore={errors.telefono?.message}
              {...form.register("telefono")}
            />
            <Campo
              id="email"
              label="Email (per entrare)"
              type="email"
              inputMode="email"
              autoComplete="off"
              errore={errors.email?.message}
              {...form.register("email")}
            />
            {ruoli.length > 1 && (
              <Selezione id="ruolo" label="Ruolo nella festa" {...form.register("ruoloFesta")}>
                {ruoli.map((r) => (
                  <option key={r} value={r}>
                    {NOMI_RUOLO_FESTA[r]}
                  </option>
                ))}
              </Selezione>
            )}
            {errore && <Avviso tipo="errore">{errore}</Avviso>}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              <Check aria-hidden />
              {isSubmitting ? "Creazione in corso..." : "Aggiungi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
