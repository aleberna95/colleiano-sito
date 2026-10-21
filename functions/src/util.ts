import { randomInt } from "node:crypto";
import { FieldValue, getFirestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { z } from "zod";
import type { Festa, Membro } from "../../lib/schemas";

export const db = () => getFirestore();
export const ora = () => FieldValue.serverTimestamp();

/** Valida l'input con lo schema Zod condiviso; errore leggibile in italiano. */
export function valida<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpsError("invalid-argument", r.error.issues[0]?.message ?? "Dati non validi");
  }
  return r.data;
}

export function chiamante(req: CallableRequest) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Devi prima entrare nel gestionale.");
  return { uid: req.auth.uid, superadmin: req.auth.token.superadmin === true };
}

export function vietato(msg = "Non hai i permessi per farlo."): never {
  throw new HttpsError("permission-denied", msg);
}

/** Festa + membro del chiamante. Blocca le feste archiviate (tranne superadmin) e i membri disattivati. */
export async function contestoFesta(req: CallableRequest, festaId: string) {
  const io = chiamante(req);
  const [festaSnap, membroSnap] = await Promise.all([
    db().doc(`feste/${festaId}`).get(),
    db().doc(`feste/${festaId}/membri/${io.uid}`).get(),
  ]);
  if (!festaSnap.exists) throw new HttpsError("not-found", "Festa non trovata.");
  const festa = festaSnap.data() as Festa;
  const membro = membroSnap.exists ? (membroSnap.data() as Membro) : undefined;
  const attivo = membro?.attivo === true;
  if (!io.superadmin && !attivo) vietato();
  if (!io.superadmin && festa.stato === "archiviata") vietato("La festa è archiviata: si può solo consultare.");
  const admin = io.superadmin || (attivo && membro?.ruoloFesta === "admin");
  return { ...io, festa, membro: attivo ? membro : undefined, admin };
}

export function membroDa(snap: DocumentSnapshot): Membro | undefined {
  return snap.exists ? (snap.data() as Membro) : undefined;
}

/** Password temporanea facile da copiare dal telefono: 3 gruppi da 4, senza caratteri ambigui. */
export function passwordTemporanea(): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  const gruppo = () => Array.from({ length: 4 }, () => alfabeto[randomInt(alfabeto.length)]).join("");
  return `${gruppo()}-${gruppo()}-${gruppo()}`;
}

export function slugify(testo: string): string {
  return (
    testo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "festa"
  );
}

/** Data "AAAA-MM-GG" a mezzogiorno UTC: resta lo stesso giorno in Italia. */
export function dataDaGiorno(giorno: string): Date {
  return new Date(`${giorno}T12:00:00Z`);
}

export function storico(
  festaId: string,
  voce: { entita: "task" | "movimento" | "membro"; entitaId: string; azione: string; attoreUid: string; diff?: Record<string, unknown> },
) {
  return db().collection(`feste/${festaId}/storico`).doc().create({ ...voce, at: ora() });
}

/** Task aperti della persona in una festa tornano "da assegnare" (SPEC 4.3). */
export async function liberaTask(festaId: string, uid: string, attoreUid: string) {
  const snap = await db()
    .collection(`feste/${festaId}/tasks`)
    .where("responsabileUid", "==", uid)
    .where("stato", "in", ["da_fare", "in_corso", "bloccato"])
    .get();
  const batch = db().batch();
  for (const d of snap.docs) {
    batch.update(d.ref, { responsabileUid: null, stato: "da_fare", updatedAt: ora(), updatedBy: attoreUid });
  }
  await batch.commit();
  return snap.size;
}
