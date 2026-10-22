import {
  Accessibility,
  Beer,
  HeartPulse,
  Info,
  MapPin,
  Music,
  SquareParking,
  Toilet,
  Utensils,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { CategoriaPunto } from "./schemas";

/** Nome, icona e colore di ogni categoria (testo bianco su colore pieno: contrasto AA). */
export const CATEGORIE: Record<CategoriaPunto, { nome: string; icona: LucideIcon; colore: string }> = {
  bagni: { nome: "Bagni", icona: Toilet, colore: "#1d4ed8" },
  mangiare: { nome: "Mangiare", icona: Utensils, colore: "#c2410c" },
  bere: { nome: "Bere", icona: Beer, colore: "#7e22ce" },
  eventi: { nome: "Eventi", icona: Music, colore: "#A0522D" },
  parcheggio: { nome: "Parcheggio", icona: SquareParking, colore: "#334155" },
  info: { nome: "Info", icona: Info, colore: "#1B3022" },
  soccorso: { nome: "Primo soccorso", icona: HeartPulse, colore: "#b91c1c" },
  wifi: { nome: "Wi-Fi", icona: Wifi, colore: "#0f766e" },
  altro: { nome: "Altro", icona: MapPin, colore: "#57534e" },
};

/** Bottoni filtro della mappa pubblica, nell'ordine della SPEC 7.1. */
export type Filtro = CategoriaPunto | "accessibile";
export const FILTRI: { id: Filtro; nome: string; icona: LucideIcon; colore: string }[] = [
  ...(["bagni", "mangiare", "bere", "eventi", "parcheggio", "info", "soccorso"] as const).map((c) => ({ id: c, ...CATEGORIE[c] })),
  { id: "accessibile", nome: "Accessibile", icona: Accessibility, colore: "#1d4ed8" },
  { id: "wifi", ...CATEGORIE.wifi },
];

export function passaFiltro(p: { categoria: CategoriaPunto; accessibile: boolean }, filtro: Filtro | null): boolean {
  if (!filtro) return true;
  return filtro === "accessibile" ? p.accessibile : p.categoria === filtro;
}

/** Testo del QR per collegarsi al Wi-Fi (formato letto dalle fotocamere di iPhone e Android). */
export function testoQrWifi(wifi: { nomeRete: string; password?: string }): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
  return wifi.password ? `WIFI:T:WPA;S:${esc(wifi.nomeRete)};P:${esc(wifi.password)};;` : `WIFI:T:nopass;S:${esc(wifi.nomeRete)};;`;
}
