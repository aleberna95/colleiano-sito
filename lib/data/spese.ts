"use client";

import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Movimento, PagatoDa, Rimborso, Storico } from "@/lib/schemas";
import type { MovimentoConId, RimborsoConId } from "@/lib/spese";
import { useLista, type Caricato } from "./tasks";

/** Tutti i movimenti della festa (qualche centinaio al massimo, SPEC 1.3). */
export function useMovimenti(festaId: string): Caricato<MovimentoConId[]> {
  return useLista<Movimento>(["feste", festaId, "movimenti"], [["eliminato", false]]);
}

export function useRimborsi(festaId: string): Caricato<RimborsoConId[]> {
  return useLista<Rimborso>(["feste", festaId, "rimborsi"]);
}

export function useStoricoMovimento(festaId: string, movimentoId: string) {
  return useLista<Storico>(
    ["feste", festaId, "storico"],
    [["entita", "movimento"], ["entitaId", movimentoId]],
    (a, b) => (b.at?.toMillis() ?? Date.now()) - (a.at?.toMillis() ?? Date.now()),
  );
}

export type DatiSpesa = Pick<Movimento, "commissioneId" | "descrizione" | "importoCents" | "categoria"> & {
  dataSpesa: Date;
  pagatoDa: PagatoDa;
};

/** Nuova spesa "in attesa": prima la foto dello scontrino in Storage, poi il documento (SPEC 6.4). */
export async function inviaSpesa(festaId: string, uid: string, dati: DatiSpesa, foto?: File): Promise<string> {
  const d = doc(collection(db, "feste", festaId, "movimenti"));
  const scontrini = [];
  if (foto) {
    const path = `feste/${festaId}/movimenti/${d.id}/${Date.now()}`;
    await uploadBytes(ref(storage, path), foto, { contentType: foto.type });
    scontrini.push({ path, nome: foto.name.slice(0, 200) || "scontrino", mime: foto.type });
  }
  const ora = serverTimestamp();
  await setDoc(d, {
    tipo: "spesa",
    ...dati,
    stato: "in_attesa",
    scontrini,
    eliminato: false,
    createdAt: ora,
    createdBy: uid,
    updatedAt: ora,
    updatedBy: uid,
  });
  return d.id;
}

/** Modifica o ritiro (eliminato) prima dell'approvazione. Lo stato lo cambiano solo le Functions. */
export function aggiornaSpesa(festaId: string, id: string, uid: string, modifiche: Partial<DatiSpesa & { eliminato: boolean }>) {
  return updateDoc(doc(db, "feste", festaId, "movimenti", id), { ...modifiche, updatedAt: serverTimestamp(), updatedBy: uid });
}
