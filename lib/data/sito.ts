"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { CONFIG_SITO_VUOTA, type MappaConfig, type PaginaPubblica, type Punto, type PuntoForm, type SitoConfig } from "@/lib/schemas";
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
  await setDoc(doc(db, "feste", festaId, "mappa", "config"), {
    immagine: { url, larghezza, altezza },
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
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
