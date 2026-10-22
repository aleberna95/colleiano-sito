"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { conServiceWorker } from "@/components/pwa";
import { formatOra } from "@/lib/format";

const CHIAVE = "colleiano-sito-salvato-alle";
/** Con la rete, le copie salvate si rinfrescano al massimo ogni 5 minuti. */
const OGNI = 5 * 60 * 1000;

function letto(): number | undefined {
  try {
    return Number(localStorage.getItem(CHIAVE)) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Alla prima apertura (in piazza, sul Wi-Fi) chiede al service worker di salvare le pagine della festa
 * con immagini e risorse (SPEC 7.2); poi dice che il sito funziona anche senza segnale.
 */
export function SalvaOffline({ pagine, immagini }: { pagine: string[]; immagini: string[] }) {
  const [salvato, setSalvato] = useState<number>();
  const chiave = JSON.stringify([pagine, immagini]);

  useEffect(() => {
    if (!conServiceWorker()) return;
    const prima = letto();
    // Lettura del browser una volta sola, dopo il primo render (non esiste sul server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSalvato(prima);
    if (!navigator.onLine || (prima && Date.now() - prima < OGNI)) return;
    let annullato = false;
    // Il pezzo di Leaflet si carica solo aprendo la mappa: lo si scarica adesso, così il service worker lo tiene.
    import("leaflet").catch(() => {});
    navigator.serviceWorker.ready.then((reg) => {
      if (annullato || !reg.active) return;
      const canale = new MessageChannel();
      canale.port1.onmessage = (e: MessageEvent<{ ok: boolean }>) => {
        if (!e.data.ok || annullato) return;
        const ora = Date.now();
        try {
          localStorage.setItem(CHIAVE, String(ora));
        } catch {}
        setSalvato(ora);
      };
      reg.active.postMessage({ tipo: "salva-sito", pagine, immagini }, [canale.port2]);
    });
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la chiave riassume pagine e immagini
  }, [chiave]);

  if (!salvato) return null;
  return (
    <p className="flex items-center gap-2 text-colleiano-linen/90">
      <CircleCheck className="size-5 shrink-0" aria-hidden />
      Salvato sul telefono: funziona anche senza segnale.
    </p>
  );
}

/**
 * "Aggiornato alle 15:32" (SPEC 7.2): l'ora in cui la pagina è arrivata dal server.
 * Offline la pagina arriva dalla copia salvata e l'ora resta quella vera; dopo una navigazione riuscita è adesso.
 */
export function Aggiornato({ ora: iniziale }: { ora: number }) {
  const pathname = usePathname();
  const [ora, setOra] = useState(iniziale);
  const primo = useRef(pathname);
  useEffect(() => {
    if (pathname === primo.current) return;
    primo.current = pathname;
    setOra(Date.now());
  }, [pathname]);
  return <p className="text-colleiano-linen/90">Aggiornato alle {formatOra(new Date(ora))}</p>;
}
