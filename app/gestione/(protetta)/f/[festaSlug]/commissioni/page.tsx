"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatoVuoto, TitoloPagina } from "@/components/comuni";
import { useFesta } from "@/lib/festa-context";
import { COLORI_COMMISSIONE, formatEuro } from "@/lib/format";
import { puoCreareCommissione } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export default function CommissioniPage() {
  const { festa, commissioni, io, nomeDi } = useFesta();
  const base = `/gestione/f/${festa.slug}`;
  const nomi = (uids: string[]) => uids.map(nomeDi).join(", ");

  return (
    <>
      <TitoloPagina titolo="Commissioni" indietro={`${base}/altro`}>
        {puoCreareCommissione(io, festa) && (
          <Button asChild size="lg">
            <Link href={`${base}/commissioni/nuova`}>
              <Plus aria-hidden />
              Nuova commissione
            </Link>
          </Button>
        )}
      </TitoloPagina>

      {commissioni.length <= 1 && (
        <StatoVuoto titolo="Solo la commissione Generale">
          {puoCreareCommissione(io, festa)
            ? "Crea le commissioni (Cucina, Musica, Logistica...) e poi assegna le persone."
            : "Gli admin creeranno le commissioni."}
        </StatoVuoto>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {commissioni.map((c) => (
          <li key={c.id}>
            <Link
              href={`${base}/commissioni/${c.id}`}
              className={cn("flex h-full flex-col gap-2 rounded-lg border-2 p-5 shadow-xs", COLORI_COMMISSIONE[c.colore].classi)}
            >
              <span className="font-heading text-2xl">{c.nome}</span>
              {c.descrizione && <span>{c.descrizione}</span>}
              {!c.generale && (
                <>
                  <span>
                    <strong>Referenti:</strong> {c.referentiUids.length ? nomi(c.referentiUids) : "nessuno"}
                  </span>
                  <span>
                    <strong>Componenti:</strong> {c.componentiUids.length ? nomi(c.componentiUids) : "nessuno"}
                  </span>
                </>
              )}
              {c.budgetCents !== undefined && (
                <span>
                  <strong>Budget:</strong> {formatEuro(c.budgetCents)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
