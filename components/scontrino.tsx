"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Caricamento } from "@/components/stato";
import { indirizzoAllegato } from "@/lib/data/tasks";
import { cn } from "@/lib/utils";

/** Foto (o PDF) di uno scontrino da Storage; `piccolo` per gli elenchi. */
export function Scontrino({ path, nome, mime, piccolo = false }: { path: string; nome: string; mime: string; piccolo?: boolean }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let attivo = true;
    indirizzoAllegato(path).then((u) => attivo && setUrl(u)).catch(() => {});
    return () => {
      attivo = false;
    };
  }, [path]);
  if (!url) return <Caricamento testo="Carico lo scontrino..." />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagine da Storage, URL firmato
        <img src={url} alt={`Scontrino: ${nome}`} className={cn("rounded-md border object-contain", piccolo ? "size-20" : "max-h-96 w-full")} />
      ) : (
        <span className="inline-flex min-h-12 items-center gap-2 text-colleiano-forest underline underline-offset-4">
          <FileText className="size-5" aria-hidden />
          {nome}
        </span>
      )}
    </a>
  );
}

