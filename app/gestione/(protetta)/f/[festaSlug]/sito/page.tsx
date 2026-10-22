"use client";

import Link from "next/link";
import { ChevronRight, ExternalLink, FileText, Star, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { useSitoConfig } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { puoModificarePaginaFesta, puoModificareSito } from "@/lib/permissions";

// Voce "Sito" del gestionale (SPEC 7.1): da qui si cura il sito pubblico.
export default function SitoPage() {
  const { festa, festaId, io } = useFesta();
  const config = useSitoConfig();
  const base = `/gestione/f/${festa.slug}/sito`;

  const voci = [
    ...(puoModificarePaginaFesta(io, festa) ? [{ href: `${base}/pagina`, label: "Pagina di questa festa", icona: FileText }] : []),
    ...(puoModificareSito(io)
      ? [
          { href: `${base}/feste`, label: "Festa in evidenza e archivio", icona: Star },
          { href: `${base}/testi`, label: "Testi del sito", icona: Type },
        ]
      : []),
  ];

  if (config.stato === "caricamento") return <Caricamento />;
  if (config.stato === "errore") return <Avviso tipo="errore">Non riesco a caricare i dati del sito. Riprova.</Avviso>;

  const inEvidenza = config.dati.festaInEvidenzaId === festaId;
  const presenza = inEvidenza
    ? "Questa festa è in evidenza: la home del sito parla di lei."
    : festa.inArchivioPubblico
      ? "Questa festa è tra le edizioni passate del sito."
      : "Questa festa non compare ancora sul sito.";

  return (
    <>
      <TitoloPagina titolo="Sito" indietro={`/gestione/f/${festa.slug}/altro`} />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <p className="text-lg">{presenza}</p>
          {!inEvidenza && !festa.inArchivioPubblico && (
            <p className="text-muted-foreground">
              {puoModificareSito(io)
                ? "Per mostrarla scegli \"Festa in evidenza e archivio\"."
                : "Per mostrarla chiedi a un superadmin di metterla in evidenza."}
            </p>
          )}
          <Button asChild variant="outline" size="lg">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Apri il sito
            </a>
          </Button>
        </CardContent>
      </Card>

      {voci.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg bg-card shadow-sm ring-1 ring-foreground/10">
          {voci.map(({ href, label, icona: Icona }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-16 items-center gap-4 px-5">
                <Icona className="size-6 text-colleiano-forest" aria-hidden />
                <span className="flex-1 text-lg">{label}</span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">La festa è archiviata: la sua pagina la può cambiare solo un superadmin.</p>
      )}
    </>
  );
}
