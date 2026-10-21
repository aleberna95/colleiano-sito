"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { ChevronRight, KeyRound, ShieldCheck, ShieldOff, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BottoneWhatsApp, ConfermaAzione, Etichetta, TitoloPagina } from "@/components/comuni";
import { CreaFestaForm } from "@/components/crea-festa-form";
import { Avviso, Caricamento } from "@/components/stato";
import { disattivaPersona, erroreCallable, impostaSuperadmin, nuovaPasswordTemporanea } from "@/lib/callable";
import { db } from "@/lib/firebase";
import { useUtente } from "@/lib/auth-context";
import { useFeste } from "@/lib/feste-context";
import type { User } from "@/lib/schemas";
import { testi } from "@/lib/whatsapp";

type Utente = User & { id: string };

// Area del superadmin: account e feste (SPEC 3, gestione/admin).
export default function AdminPage() {
  const { superadmin } = useUtente();
  const router = useRouter();
  const feste = useFeste();
  const [utenti, setUtenti] = useState<Utente[] | "errore">();

  useEffect(() => {
    if (!superadmin) {
      router.replace("/gestione");
      return;
    }
    return onSnapshot(
      collection(db, "users"),
      (s) =>
        setUtenti(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as User) }))
            .sort((a, b) => Number(b.attivo) - Number(a.attivo) || a.nome.localeCompare(b.nome)),
        ),
      () => setUtenti("errore"),
    );
  }, [superadmin, router]);

  if (!superadmin || utenti === undefined || feste.status === "loading") return <Caricamento />;
  if (utenti === "errore" || feste.status === "errore") return <Avviso tipo="errore">Non riesco a caricare i dati. Riprova.</Avviso>;

  return (
    <>
      <TitoloPagina titolo="Account e feste" indietro="/gestione" />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Feste</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {feste.feste.map((f) => (
            <Button key={f.id} asChild variant="outline" size="lg" className="justify-between">
              <Link href={`/gestione/f/${f.slug}`}>
                <span>
                  {f.nome}
                  {f.stato === "archiviata" && <span className="text-muted-foreground"> · archiviata</span>}
                </span>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ))}
          <details className="rounded-md border p-4">
            <summary className="min-h-8 cursor-pointer font-medium text-colleiano-forest">Crea una nuova festa</summary>
            <div className="pt-4">
              <CreaFestaForm />
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Account</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="pb-3 text-muted-foreground">
            Le persone si aggiungono dalla pagina Persone di ogni festa. Conviene avere almeno due superadmin.
          </p>
          <ul className="flex flex-col divide-y">
            {utenti.map((u) => (
              <RigaAccount key={u.id} u={u} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function RigaAccount({ u }: { u: Utente }) {
  const { user } = useUtente();
  const [errore, setErrore] = useState<string>();
  const [password, setPassword] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const io = u.id === user.uid;

  async function esegui(azione: () => Promise<unknown>) {
    setErrore(undefined);
    setInCorso(true);
    try {
      await azione();
    } catch (err) {
      setErrore(erroreCallable(err));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-lg font-medium">
          {u.nome} {u.cognome}
          {io && <span className="font-normal text-muted-foreground"> (tu)</span>}
        </span>
        {u.superadmin && <Etichetta>Superadmin</Etichetta>}
        {!u.attivo && <span className="text-colleiano-danger">Disattivato</span>}
      </div>
      <span className="break-all text-muted-foreground">{u.email}</span>

      {u.attivo && !io && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            size="lg"
            disabled={inCorso}
            onClick={() => esegui(() => impostaSuperadmin({ uid: u.id, superadmin: !u.superadmin }))}
          >
            {u.superadmin ? <ShieldOff aria-hidden /> : <ShieldCheck aria-hidden />}
            {u.superadmin ? "Togli superadmin" : "Rendi superadmin"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={inCorso}
            onClick={() => esegui(async () => setPassword((await nuovaPasswordTemporanea({ uid: u.id })).password))}
          >
            <KeyRound aria-hidden />
            Nuova password
          </Button>
          {!u.superadmin && (
            <ConfermaAzione
              etichetta="Disattiva account"
              domanda={`Disattivare l'account di ${u.nome}? Non potrà più entrare in nessuna festa.`}
              conferma="Sì, disattiva"
              icona={<UserX aria-hidden />}
              disabled={inCorso}
              onConferma={() => esegui(() => disattivaPersona({ uid: u.id }))}
            />
          )}
        </div>
      )}
      {password && (
        <div className="flex flex-col gap-3">
          <p className="rounded-md bg-muted p-3">
            Nuova password temporanea: <strong className="font-mono text-lg">{password}</strong>
          </p>
          <BottoneWhatsApp telefono={u.telefono} testo={testi.nuovaPassword({ nome: u.nomeVisualizzato, email: u.email, password })}>
            Manda la password su WhatsApp
          </BottoneWhatsApp>
        </div>
      )}
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
    </li>
  );
}
