"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { orariDaInput } from "@/lib/programma";
import {
  CONFIG_SITO_VUOTA,
  type AvvisoForm,
  type AvvisoSito,
  type EventoForm,
  type EventoProgramma,
  type MappaConfig,
  type PaginaPubblica,
  type Punto,
  type PuntoForm,
  type SitoConfig,
  type WifiForm,
} from "@/lib/schemas";
import { useLista, type Caricato } from "./tasks";

export type DatiSitoConfig = Omit<SitoConfig, "updatedAt" | "updatedBy">;

/** sito/config in tempo reale; se non esiste ancora, i campi vuoti. */
export function useSitoConfig(): Caricato<DatiSitoConfig> {
  const [stato, setStato] = useState<Caricato<DatiSitoConfig>>({ stato: "caricamento" });
  useEffect(
    () =>
      onSnapshot(
        doc(db, "sito", "config"),
        (s) => setStato({ stato: "ok", dati: s.exists() ? (s.data() as SitoConfig) : CONFIG_SITO_VUOTA }),
        () => setStato({ stato: "errore" }),
      ),
    [],
  );
  return stato;
}

/** Riscrive tutto sito/config (solo superadmin). I campi facoltativi vuoti non si mandano. */
export function salvaSitoConfig(uid: string, dati: DatiSitoConfig) {
  const { festaInEvidenzaId, immagineCopertina, ...resto } = dati;
  return setDoc(doc(db, "sito", "config"), {
    ...resto,
    ...(festaInEvidenzaId ? { festaInEvidenzaId } : {}),
    ...(immagineCopertina ? { immagineCopertina } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

/** Campi del sito sul documento della festa; la Function li copia in sitoFeste. */
export function aggiornaFestaSito(
  festaId: string,
  uid: string,
  modifiche: { paginaPubblica?: PaginaPubblica; modalitaFesta?: boolean; inArchivioPubblico?: boolean },
) {
  const pagina = modifiche.paginaPubblica;
  return updateDoc(doc(db, "feste", festaId), {
    ...modifiche,
    ...(pagina && {
      paginaPubblica: {
        ...(pagina.testo ? { testo: pagina.testo } : {}),
        ...(pagina.copertina ? { copertina: pagina.copertina } : {}),
        galleria: pagina.galleria,
      },
    }),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

/** Riduce l'immagine (WebP, lato lungo al massimo `latoMax`): il sito deve restare leggero (SPEC 7.2). */
async function riduci(file: File, latoMax: number): Promise<{ blob: Blob; larghezza: number; altezza: number }> {
  const bitmap = await createImageBitmap(file);
  const scala = Math.min(1, latoMax / Math.max(bitmap.width, bitmap.height));
  const larghezza = Math.round(bitmap.width * scala);
  const altezza = Math.round(bitmap.height * scala);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = larghezza;
    canvas.height = altezza;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, larghezza, altezza);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
    if (blob && (blob.size < file.size || scala < 1)) return { blob, larghezza, altezza };
  } catch {
    // Browser senza WebP: si carica l'originale.
  }
  return { blob: file, larghezza: bitmap.width, altezza: bitmap.height };
}

async function carica(cartella: string, blob: Blob) {
  const r = ref(storage, `${cartella}/${Date.now()}`);
  await uploadBytes(r, blob, { contentType: blob.type, cacheControl: "public, max-age=31536000" });
  return getDownloadURL(r);
}

/** Carica una foto pubblica (lato lungo 1600 px) in `cartella` (sito/feste/{f} o sito/generale) e ne restituisce l'indirizzo. */
export async function caricaImmagineSito(cartella: string, file: File): Promise<string> {
  const { blob } = await riduci(file, 1600).catch(() => ({ blob: file as Blob }));
  return carica(cartella, blob);
}

// ---- Mappa (SPEC 7.1) ----

/** Il disegno della mappa: versione leggera per il telefono (lato lungo 2560 px). */
export async function caricaMappa(festaId: string, uid: string, file: File) {
  const { blob, larghezza, altezza } = await riduci(file, 2560);
  const url = await carica(`sito/feste/${festaId}`, blob);
  // mergeFields: il Wi-Fi, che sta nello stesso documento, resta com'è.
  await setDoc(
    doc(db, "feste", festaId, "mappa", "config"),
    { immagine: { url, larghezza, altezza }, updatedAt: serverTimestamp(), updatedBy: uid },
    { mergeFields: ["immagine", "updatedAt", "updatedBy"] },
  );
}

/** Wi-Fi della festa (SPEC 7.1): i campi vuoti non si salvano. */
export function salvaWifi(festaId: string, uid: string, { nomeRete, password, puntoId }: WifiForm) {
  return setDoc(
    doc(db, "feste", festaId, "mappa", "config"),
    {
      wifi: { nomeRete: nomeRete.trim(), ...(password ? { password } : {}), ...(puntoId ? { puntoId } : {}) },
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    },
    { mergeFields: ["wifi", "updatedAt", "updatedBy"] },
  );
}

export function useMappa(festaId: string): Caricato<MappaConfig | null> {
  const [stato, setStato] = useState<Caricato<MappaConfig | null>>({ stato: "caricamento" });
  useEffect(
    () =>
      onSnapshot(
        doc(db, "feste", festaId, "mappa", "config"),
        (s) => setStato({ stato: "ok", dati: s.exists() ? (s.data() as MappaConfig) : null }),
        () => setStato({ stato: "errore" }),
      ),
    [festaId],
  );
  return stato;
}

export function usePunti(festaId: string) {
  return useLista<Punto>(["feste", festaId, "mappa", "config", "punti"], [], (a, b) => a.nome.localeCompare(b.nome));
}

const punti = (festaId: string) => collection(db, "feste", festaId, "mappa", "config", "punti");

/** Nuovo punto al centro del disegno: poi lo si trascina dove serve. */
export async function aggiungiPunto(festaId: string, uid: string): Promise<string> {
  const ora = serverTimestamp();
  const r = await addDoc(punti(festaId), {
    nome: "Nuovo punto", categoria: "altro", x: 0.5, y: 0.5, accessibile: false,
    createdAt: ora, createdBy: uid, updatedAt: ora, updatedBy: uid,
  });
  return r.id;
}

export function aggiornaPunto(
  festaId: string,
  id: string,
  uid: string,
  modifiche: Partial<PuntoForm> & { x?: number; y?: number; foto?: string | null },
) {
  const { descrizione, orari, foto, ...resto } = modifiche;
  const vuoto = (v: string | null | undefined) => (v ? v : deleteField());
  return updateDoc(doc(punti(festaId), id), {
    ...resto,
    ...(descrizione !== undefined && { descrizione: vuoto(descrizione) }),
    ...(orari !== undefined && { orari: vuoto(orari) }),
    ...(foto !== undefined && { foto: vuoto(foto) }),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export const eliminaPunto = (festaId: string, id: string) => deleteDoc(doc(punti(festaId), id));

/** Toglie il file da Storage; se non ci riesce pazienza, il documento conta di più. */
export async function togliImmagineSito(url: string) {
  await deleteObject(ref(storage, url)).catch(() => {});
}

// ---- Programma (SPEC 7.1) ----

export type EventoConId = EventoProgramma & { id: string };

export function useProgramma(festaId: string) {
  return useLista<EventoProgramma>(["feste", festaId, "programma"], [], (a, b) => a.inizio.toMillis() - b.inizio.toMillis() || a.ordine - b.ordine);
}

function datiEvento(v: EventoForm) {
  const { inizio, fine } = orariDaInput(v.giorno, v.inizio, v.fine);
  return {
    titolo: v.titolo.trim(),
    inizio: Timestamp.fromDate(inizio),
    fine: fine ? Timestamp.fromDate(fine) : undefined,
    puntoId: v.puntoId || undefined,
    descrizione: v.descrizione.trim() || undefined,
  };
}

export async function creaEvento(festaId: string, uid: string, v: EventoForm, ordine: number) {
  const ora = serverTimestamp();
  const dati = Object.fromEntries(Object.entries(datiEvento(v)).filter(([, x]) => x !== undefined));
  await addDoc(collection(db, "feste", festaId, "programma"), { ...dati, ordine, createdAt: ora, createdBy: uid, updatedAt: ora, updatedBy: uid });
}

export function aggiornaEvento(festaId: string, id: string, uid: string, v: EventoForm) {
  const dati = Object.fromEntries(Object.entries(datiEvento(v)).map(([k, x]) => [k, x ?? deleteField()]));
  return updateDoc(doc(db, "feste", festaId, "programma", id), { ...dati, updatedAt: serverTimestamp(), updatedBy: uid });
}

export const eliminaEvento = (festaId: string, id: string) => deleteDoc(doc(db, "feste", festaId, "programma", id));

// ---- Avvisi (SPEC 7.1) ----

export type AvvisoConId = AvvisoSito & { id: string };

/** Dal più recente. */
export function useAvvisi(festaId: string) {
  return useLista<AvvisoSito>(["feste", festaId, "avvisi"], [], (a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()));
}

export async function creaAvviso(festaId: string, uid: string, { testo, tipo }: AvvisoForm) {
  const ora = serverTimestamp();
  await addDoc(collection(db, "feste", festaId, "avvisi"), {
    testo: testo.trim(), tipo, attivo: true, createdAt: ora, createdBy: uid, updatedAt: ora, updatedBy: uid,
  });
}

export const mostraAvviso = (festaId: string, id: string, uid: string, attivo: boolean) =>
  updateDoc(doc(db, "feste", festaId, "avvisi", id), { attivo, updatedAt: serverTimestamp(), updatedBy: uid });

export const eliminaAvviso = (festaId: string, id: string) => deleteDoc(doc(db, "feste", festaId, "avvisi", id));
