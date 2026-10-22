"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORIE } from "@/lib/mappa";
import type { CategoriaPunto } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type PuntoMappa = { id: string; nome: string; categoria: CategoriaPunto; x: number; y: number; accessibile: boolean };
export type ImmagineMappa = { url: string; larghezza: number; altezza: number };

/**
 * Mappa illustrata (SPEC 7.1): il disegno come sfondo (Leaflet, CRS.Simple) e i punti con coordinate 0..1.
 * Stessa vista nell'editor del gestionale (`spostabili`) e sul sito pubblico.
 */
export function Mappa({
  immagine,
  punti,
  selezionato,
  onSeleziona,
  spostabili = false,
  onSposta,
  pulsano = false,
  className,
}: {
  immagine: ImmagineMappa;
  punti: PuntoMappa[];
  selezionato?: string;
  onSeleziona?: (id: string) => void;
  spostabili?: boolean;
  onSposta?: (id: string, x: number, y: number) => void;
  /** I punti rimasti dopo un filtro pulsano. */
  pulsano?: boolean;
  className?: string;
}) {
  const contenitore = useRef<HTMLDivElement>(null);
  const [mappa, setMappa] = useState<{ map: LeafletMap; L: typeof import("leaflet") }>();
  const [segnaposti, setSegnaposti] = useState<{ punto: PuntoMappa; el: HTMLElement }[]>([]);
  // Le funzioni cambiano a ogni render: i marker leggono sempre l'ultima.
  const azioni = useRef({ onSeleziona, onSposta });
  useEffect(() => {
    azioni.current = { onSeleziona, onSposta };
  });

  const { url, larghezza, altezza } = immagine;

  // Mappa e sfondo (Leaflet si carica solo nel browser).
  useEffect(() => {
    let map: LeafletMap | undefined;
    let osservatore: ResizeObserver | undefined;
    let annullato = false;
    import("leaflet").then(({ default: L }) => {
      if (annullato || !contenitore.current) return;
      const limiti = L.latLngBounds([0, 0], [altezza, larghezza]);
      map = L.map(contenitore.current, {
        crs: L.CRS.Simple,
        zoomSnap: 0.25,
        attributionControl: false,
        maxBounds: limiti.pad(0.2),
        maxBoundsViscosity: 1,
      });
      L.imageOverlay(url, limiti).addTo(map);
      // Si inquadra il disegno intero quando il contenitore ha la sua misura vera (CSS e layout pronti).
      let inquadrata = false;
      osservatore = new ResizeObserver(() => {
        if (!map || !contenitore.current?.clientWidth) return;
        map.invalidateSize();
        if (inquadrata) return;
        inquadrata = true;
        const zoom = map.getBoundsZoom(limiti);
        map.setMinZoom(zoom - 0.5);
        map.setMaxZoom(zoom + 4);
        map.fitBounds(limiti);
      });
      osservatore.observe(contenitore.current);
      map.setView(limiti.getCenter(), 0);
      setMappa({ map, L });
    });
    return () => {
      annullato = true;
      osservatore?.disconnect();
      map?.remove();
      setMappa(undefined);
    };
  }, [url, larghezza, altezza]);

  // Un marker per punto; il contenuto lo disegna React dentro l'elemento del marker.
  const chiavePunti = JSON.stringify(punti);
  useEffect(() => {
    if (!mappa) return;
    const { map, L } = mappa;
    const markers: Marker[] = [];
    const nuovi: { punto: PuntoMappa; el: HTMLElement }[] = [];
    for (const punto of punti) {
      const marker = L.marker([(1 - punto.y) * altezza, punto.x * larghezza], {
        icon: L.divIcon({ className: "", html: "", iconSize: [48, 48], iconAnchor: [24, 24] }),
        draggable: spostabili,
        keyboard: true,
        title: punto.nome,
      }).addTo(map);
      marker.on("click", () => azioni.current.onSeleziona?.(punto.id));
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        const x = Math.min(1, Math.max(0, lng / larghezza));
        const y = Math.min(1, Math.max(0, 1 - lat / altezza));
        azioni.current.onSposta?.(punto.id, Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000);
      });
      const el = marker.getElement();
      if (el) {
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `${punto.nome} (${CATEGORIE[punto.categoria].nome})`);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") azioni.current.onSeleziona?.(punto.id);
        });
        nuovi.push({ punto, el });
      }
      markers.push(marker);
    }
    map.whenReady(() => setSegnaposti(nuovi));
    return () => markers.forEach((m) => m.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chiavePunti riassume i punti
  }, [mappa, chiavePunti, spostabili, altezza, larghezza]);

  return (
    <div className={cn("mappa-colleiano relative isolate overflow-hidden rounded-lg bg-colleiano-forest/10", className)}>
      <div ref={contenitore} className="size-full" />
      {segnaposti.map(({ punto, el }) =>
        createPortal(<Segnaposto punto={punto} attivo={punto.id === selezionato} pulsa={pulsano} />, el, punto.id),
      )}
    </div>
  );
}

function Segnaposto({ punto, attivo, pulsa }: { punto: PuntoMappa; attivo: boolean; pulsa: boolean }) {
  const { icona: Icona, colore } = CATEGORIE[punto.categoria];
  return (
    <span className="relative flex size-12 items-center justify-center">
      {pulsa && <span className="absolute inset-0 animate-ping rounded-full opacity-50" style={{ backgroundColor: colore }} />}
      <span
        className={cn(
          "relative flex size-11 items-center justify-center rounded-full border-[3px] border-white text-white shadow-md",
          attivo && "scale-125 ring-4 ring-colleiano-rust",
        )}
        style={{ backgroundColor: colore }}
      >
        <Icona className="size-6" aria-hidden />
      </span>
    </span>
  );
}
