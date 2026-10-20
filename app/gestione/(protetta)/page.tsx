"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { PartyPopper, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avviso, Caricamento } from "@/components/stato";
import { db } from "@/lib/firebase";
import { useUtente } from "@/lib/auth-context";

export default function GestioneHome() {
  const { superadmin, profilo } = useUtente();
  const [numFeste, setNumFeste] = useState<number | "errore">();

  useEffect(() => {
    if (!superadmin) return;
    getDocs(collection(db, "feste"))
      .then((snap) => setNumFeste(snap.size))
      .catch(() => setNumFeste("errore"));
  }, [superadmin]);

  if (!superadmin) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>Ciao {profilo?.nome}!</h1>
          </CardTitle>
          <CardDescription>
            Non fai ancora parte di nessuna festa. Chiedi a un admin del comitato di aggiungerti.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (numFeste === undefined) return <Caricamento />;
  if (numFeste === "errore") return <Avviso tipo="errore">Non riesco a caricare le feste. Riprova.</Avviso>;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 className="text-3xl">Ciao {profilo?.nome}!</h1>
      {numFeste === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Crea la prima festa</h2>
            </CardTitle>
            <CardDescription>
              Ancora non c&apos;è nessuna festa. Creala: insieme nasce la commissione Generale, poi
              potrai aggiungere le persone del comitato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link href="/gestione/admin">
                <PartyPopper aria-hidden />
                Crea la prima festa
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button asChild size="lg" variant="outline">
          <Link href="/gestione/admin">
            <ShieldCheck aria-hidden />
            Account e feste
          </Link>
        </Button>
      )}
    </div>
  );
}
