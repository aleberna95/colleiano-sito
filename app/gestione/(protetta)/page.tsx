"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreaFestaForm } from "@/components/crea-festa-form";
import { Avviso, Caricamento } from "@/components/stato";
import { useUtente } from "@/lib/auth-context";
import { useFeste } from "@/lib/feste-context";

// Porta d'ingresso: apre l'ultima festa usata, altrimenti fa scegliere.
export default function GestioneHome() {
  const { superadmin, profilo } = useUtente();
  const stato = useFeste();
  const router = useRouter();

  const feste = stato.status === "ok" ? stato.feste : undefined;
  const destinazione =
    feste?.find((f) => f.id === profilo?.ultimaFestaId) ?? (feste?.length === 1 ? feste[0] : undefined);

  useEffect(() => {
    if (destinazione) router.replace(`/gestione/f/${destinazione.slug}`);
  }, [destinazione, router]);

  if (stato.status === "loading" || destinazione) return <Caricamento />;
  if (stato.status === "errore") return <Avviso tipo="errore">Non riesco a caricare le feste. Riprova.</Avviso>;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 className="text-3xl">Ciao {profilo?.nome}!</h1>

      {feste!.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Scegli la festa</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {feste!.map((f) => (
              <Button key={f.id} asChild variant="outline" size="lg" className="justify-between">
                <Link href={`/gestione/f/${f.slug}`}>
                  {f.nome}
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {feste!.length === 0 && !superadmin && (
        <Card>
          <CardHeader>
            <CardDescription>
              Non fai ancora parte di nessuna festa. Chiedi a un admin del comitato di aggiungerti.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {feste!.length === 0 && superadmin && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Crea la prima festa</h2>
            </CardTitle>
            <CardDescription>
              Ancora non c&apos;è nessuna festa. Creala: insieme nasce la commissione Generale, poi potrai
              aggiungere le persone del comitato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreaFestaForm />
          </CardContent>
        </Card>
      )}

      {superadmin && (
        <Button asChild size="lg" variant="ghost">
          <Link href="/gestione/admin">
            <ShieldCheck aria-hidden />
            Account e feste
          </Link>
        </Button>
      )}
    </div>
  );
}
