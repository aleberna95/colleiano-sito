"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avviso } from "@/components/stato";
import { caricaImmagineSito } from "@/lib/data/sito";

const MAX_MB = 10;

/** Pulsante per caricare una o più foto pubbliche in `cartella`; restituisce gli indirizzi. */
export function ScegliFoto({
  etichetta,
  cartella,
  multipla = false,
  onCaricate,
}: {
  etichetta: string;
  cartella: string;
  multipla?: boolean;
  onCaricate: (urls: string[]) => Promise<void> | void;
}) {
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();

  async function carica(files: File[]) {
    if (files.some((f) => f.size >= MAX_MB * 1024 * 1024)) return setErrore(`Una foto è troppo grande: massimo ${MAX_MB} MB.`);
    setErrore(undefined);
    setInCorso(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await caricaImmagineSito(cartella, f));
      await onCaricate(urls);
    } catch {
      setErrore("Non sono riuscito a caricare la foto. Riprova.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        aria-disabled={inCorso}
        className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-colleiano-forest/40 bg-white px-4 text-lg font-medium text-colleiano-forest has-focus-visible:ring-3 has-focus-visible:ring-ring/50 aria-disabled:cursor-wait aria-disabled:opacity-60"
      >
        {inCorso ? <LoaderCircle className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
        {inCorso ? "Carico..." : etichetta}
        <input
          type="file"
          accept="image/*"
          multiple={multipla}
          disabled={inCorso}
          className="sr-only"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) void carica(files);
          }}
        />
      </label>
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
    </div>
  );
}

/** Anteprima di una foto pubblica con il pulsante "Togli". */
export function FotoSito({ url, alt, onTogli }: { url: string; alt: string; onTogli?: () => void }) {
  return (
    <figure className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- immagine pubblica da Storage */}
      <img src={url} alt={alt} className="aspect-video w-full rounded-md border bg-muted object-cover" loading="lazy" />
      {onTogli && (
        <Button type="button" variant="outline" size="lg" onClick={onTogli}>
          <X aria-hidden />
          Togli la foto
        </Button>
      )}
    </figure>
  );
}
