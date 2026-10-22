"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { CONFIG_SITO_VUOTA, type PaginaPubblica, type SitoConfig } from "@/lib/schemas";
import type { Caricato } from "./tasks";

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

const LATO_MAX = 1600;

/** Riduce la foto (lato lungo 1600 px, WebP): il sito deve restare leggero (SPEC 7.2). */
async function riduci(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scala = Math.min(1, LATO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scala);
    canvas.height = Math.round(bitmap.height * scala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Carica un'immagine pubblica in `cartella` (sito/feste/{f} o sito/generale) e ne restituisce l'indirizzo. */
export async function caricaImmagineSito(cartella: string, file: File): Promise<string> {
  const blob = await riduci(file);
  const r = ref(storage, `${cartella}/${Date.now()}`);
  await uploadBytes(r, blob, { contentType: blob.type || file.type, cacheControl: "public, max-age=31536000" });
  return getDownloadURL(r);
}

/** Toglie il file da Storage; se non ci riesce pazienza, il documento conta di più. */
export async function togliImmagineSito(url: string) {
  await deleteObject(ref(storage, url)).catch(() => {});
}
