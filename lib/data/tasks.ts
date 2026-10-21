"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type FieldValue,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Allegato, Commento, Storico, Task } from "@/lib/schemas";
import type { TaskConId } from "@/lib/tasks";

export type Caricato<T> = { stato: "caricamento" } | { stato: "errore" } | { stato: "ok"; dati: T };

/** Lista in tempo reale, con l'id di ogni documento. */
export function useLista<T>(
  percorso: string[] | null,
  filtri: [string, unknown][] = [],
  ordina?: (a: T & { id: string }, b: T & { id: string }) => number,
): Caricato<(T & { id: string })[]> {
  const [stato, setStato] = useState<Caricato<(T & { id: string })[]>>({ stato: "caricamento" });
  const chiave = JSON.stringify([percorso, filtri]);
  useEffect(() => {
    if (!percorso) return;
    const [primo, ...resto] = percorso;
    const q = query(collection(db, primo, ...resto), ...filtri.map(([k, v]) => where(k, "==", v)));
    return onSnapshot(
      q,
      (s) => {
        const dati = s.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
        setStato({ stato: "ok", dati: ordina ? dati.sort(ordina) : dati });
      },
      () => setStato({ stato: "errore" }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la chiave riassume percorso e filtri
  }, [chiave]);
  return stato;
}

/** Tutti i task della festa (pochi: si filtrano sul telefono, SPEC 1.3). */
export function useTasks(festaId: string): Caricato<TaskConId[]> {
  return useLista<Task>(["feste", festaId, "tasks"], [["eliminato", false]]);
}

const perData = (a: { createdAt?: { toMillis(): number } }, b: { createdAt?: { toMillis(): number } }) =>
  (a.createdAt?.toMillis() ?? Date.now()) - (b.createdAt?.toMillis() ?? Date.now());

export function useCommenti(festaId: string, taskId: string) {
  return useLista<Commento>(["feste", festaId, "tasks", taskId, "commenti"], [], perData);
}

export function useAllegati(festaId: string, taskId: string) {
  return useLista<Allegato>(["feste", festaId, "tasks", taskId, "allegati"], [], perData);
}

export function useStoricoTask(festaId: string, taskId: string) {
  return useLista<Storico>(
    ["feste", festaId, "storico"],
    [["entita", "task"], ["entitaId", taskId]],
    (a, b) => (b.at?.toMillis() ?? Date.now()) - (a.at?.toMillis() ?? Date.now()),
  );
}

// ---- Scritture: dirette su Firestore, i permessi li controllano le regole ----

type Modifiche = { [K in keyof Task]?: Task[K] | FieldValue | null };

export type NuovoTask = Pick<Task, "titolo" | "commissioneId" | "responsabileUid" | "priorita"> & {
  descrizione?: string;
  scadenza?: Date;
  richiesta: boolean;
};

export async function creaTask(festaId: string, uid: string, t: NuovoTask): Promise<string> {
  const ora = serverTimestamp();
  const r = await addDoc(collection(db, "feste", festaId, "tasks"), {
    titolo: t.titolo,
    commissioneId: t.commissioneId,
    responsabileUid: t.richiesta ? null : t.responsabileUid,
    stato: t.richiesta ? "richiesta" : "da_fare",
    priorita: t.priorita,
    checklist: [],
    link: [],
    eliminato: false,
    ...(t.richiesta && { richiestoDa: uid }),
    ...(t.descrizione && { descrizione: t.descrizione }),
    ...(t.scadenza && { scadenza: t.scadenza }),
    createdAt: ora,
    createdBy: uid,
    updatedAt: ora,
    updatedBy: uid,
  });
  return r.id;
}

/** Campi `undefined` = da togliere. */
export function aggiornaTask(festaId: string, taskId: string, uid: string, modifiche: Modifiche) {
  const dati = Object.fromEntries(Object.entries(modifiche).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
  return updateDoc(doc(db, "feste", festaId, "tasks", taskId), { ...dati, updatedAt: serverTimestamp(), updatedBy: uid });
}

export function aggiungiCommento(festaId: string, taskId: string, uid: string, testo: string) {
  return addDoc(collection(db, "feste", festaId, "tasks", taskId, "commenti"), {
    testo,
    autoreUid: uid,
    createdAt: serverTimestamp(),
  });
}

export function modificaCommento(festaId: string, taskId: string, commentoId: string, testo: string) {
  return updateDoc(doc(db, "feste", festaId, "tasks", taskId, "commenti", commentoId), {
    testo,
    modificatoAt: serverTimestamp(),
  });
}

export const MAX_ALLEGATO_MB = 10;

/** Prima il file in Storage, poi il documento: stesso percorso, stessi permessi. */
export async function caricaAllegato(festaId: string, taskId: string, uid: string, file: File) {
  const d = doc(collection(db, "feste", festaId, "tasks", taskId, "allegati"));
  const path = `feste/${festaId}/tasks/${taskId}/${d.id}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  await setDoc(d, { nome: file.name.slice(0, 200), mime: file.type, path, createdAt: serverTimestamp(), createdBy: uid });
}

export async function togliAllegato(festaId: string, taskId: string, a: Allegato & { id: string }) {
  await deleteDoc(doc(db, "feste", festaId, "tasks", taskId, "allegati", a.id));
  await deleteObject(ref(storage, a.path)).catch(() => {});
}

export const indirizzoAllegato = (path: string) => getDownloadURL(ref(storage, path));
