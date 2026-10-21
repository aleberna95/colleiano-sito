"use client";

import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatoVuoto } from "@/components/comuni";
import { useUtente } from "@/lib/auth-context";
import { useFesta } from "@/lib/festa-context";
import { formatData, giorniAlla } from "@/lib/format";

// "Le mie cose" (SPEC 6.2). Task e soldi arrivano con M3 e M4.
export default function LeMieCose() {
  const { profilo } = useUtente();
  const { festa } = useFesta();
  const giorni = festa.dataFesta ? giorniAlla(festa.dataFesta) : undefined;

  return (
    <>
      <h1 className="text-3xl">Ciao {profilo?.nome}!</h1>

      <StatoVuoto titolo="Per ora niente da fare">
        Qui troverai i tuoi task, le richieste da gestire e le tue spese.
      </StatoVuoto>

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
