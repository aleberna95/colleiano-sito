"use client";

import Link from "next/link";
import { ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Etichetta, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { useFesta } from "@/lib/festa-context";
import { puoAggiungerePersone } from "@/lib/permissions";

export default function PersonePage() {
  const { festa, membri, commissioni, io } = useFesta();
  const base = `/gestione/f/${festa.slug}`;
  const attivi = membri
    .filter((m) => m.attivo)
    .sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato));
  const commPerId = new Map(commissioni.map((c) => [c.id, c]));

  return (
    <>
      <TitoloPagina titolo="Persone" indietro={`${base}/altro`}>
        {puoAggiungerePersone(io, festa) && (
          <Button asChild size="lg">
            <Link href={`${base}/persone/nuova`}>
              <UserPlus aria-hidden />
              Nuova persona
            </Link>
          </Button>
        )}
      </TitoloPagina>

      {attivi.length === 0 ? (
        <StatoVuoto titolo="Nessuna persona">Aggiungi le persone del comitato con &quot;Nuova persona&quot;.</StatoVuoto>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg bg-card shadow-sm ring-1 ring-foreground/10">
          {attivi.map((m) => (
            <li key={m.uid}>
              <Link href={`${base}/persone/${m.uid}`} className="flex min-h-16 items-center gap-3 px-5 py-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="text-lg font-medium">
                    {m.nomeVisualizzato}
                    {m.uid === io.uid && <span className="font-normal text-muted-foreground"> (tu)</span>}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {m.ruoloFesta === "admin" && <Etichetta>Admin</Etichetta>}
                    {Object.entries(m.commissioni).map(([id, ruolo]) => {
                      const c = commPerId.get(id);
                      return c ? (
                        <Etichetta key={id} colore={c.colore}>
                          {c.nome}
                          {ruolo === "referente" ? " · referente" : ""}
                        </Etichetta>
                      ) : null;
                    })}
                  </span>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
