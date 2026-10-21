import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  annullaMovimentoInput,
  annullaRimborsoInput,
  chiaveBeneficiario,
  decidiSpeseInput,
  movimentoInput,
  registraEntrataInput,
  registraRimborsoInput,
  vocePerMovimento,
  type Movimento,
  type Rimborso,
} from "../../lib/schemas";
import { contestoFesta, dataDaGiorno, db, ora, storico, valida, vietato } from "./util";

type Ctx = Awaited<ReturnType<typeof contestoFesta>>;

const movimenti = (festaId: string) => db().collection(`feste/${festaId}/movimenti`);

/**
 * "Mai la propria spesa", con un'eccezione: c'è un solo superadmin e nessun altro admin nella festa (SPEC 4.5).
 * Restituisce true se la deve approvare da solo (lo storico lo mostra).
 */
async function puoDecidere(ctx: Ctx, festaId: string, m: Movimento): Promise<boolean> {
  const propria = m.createdBy === ctx.uid || m.pagatoDa.beneficiarioUid === ctx.uid;
  if (!propria) return false;
  if (!ctx.superadmin) vietato("Non puoi approvare o rifiutare una tua spesa: deve farlo un altro admin.");
  const [superadmin, admin] = await Promise.all([
    db().collection("users").where("superadmin", "==", true).where("attivo", "==", true).count().get(),
    db().collection(`feste/${festaId}/membri`).where("ruoloFesta", "==", "admin").where("attivo", "==", true).get(),
  ]);
  const altriAdmin = admin.docs.filter((d) => d.id !== ctx.uid).length;
  if (superadmin.data().count > 1 || altriAdmin > 0) {
    vietato("Non puoi approvare o rifiutare una tua spesa: deve farlo un altro admin.");
  }
  return true;
}

/** Approva o rifiuta una o più spese in attesa (SPEC 4.5, 6.4). Solo admin. */
export const decidiSpese = onCall(async (req) => {
  const input = valida(decidiSpeseInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  if (!ctx.admin) vietato("Solo un admin può approvare le spese.");
  if (input.azione === "rifiuta" && !input.motivo) throw new HttpsError("invalid-argument", "Scrivi il motivo del rifiuto.");

  const refs = [...new Set(input.movimentiIds)].map((id) => movimenti(input.festaId).doc(id));
  await db().runTransaction(async (tx) => {
    const snaps = await tx.getAll(...refs);
    const decisioni: { ref: DocumentReference; auto: boolean }[] = [];
    for (const s of snaps) {
      const m = s.data() as Movimento | undefined;
      if (!m || m.eliminato || m.tipo !== "spesa") throw new HttpsError("not-found", "Spesa non trovata.");
      if (m.stato !== "in_attesa") throw new HttpsError("failed-precondition", `"${m.descrizione}" non è più in attesa.`);
      decisioni.push({ ref: s.ref, auto: await puoDecidere(ctx, input.festaId, m) });
    }
    for (const { ref, auto } of decisioni) {
      tx.update(
        ref,
        input.azione === "approva"
          ? {
              stato: "approvata",
              approvatoDa: ctx.uid,
              approvatoAt: ora(),
              motivo: FieldValue.delete(),
              ...(auto && { autoApprovata: true }),
              updatedAt: ora(),
              updatedBy: ctx.uid,
            }
          : { stato: "rifiutata", motivo: input.motivo, updatedAt: ora(), updatedBy: ctx.uid },
      );
    }
  });
  return { ok: true as const, quante: refs.length };
});

/** L'autore ha corretto una spesa rifiutata e la rimanda in approvazione. */
export const ripresentaSpesa = onCall(async (req) => {
  const input = valida(movimentoInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  const ref = movimenti(input.festaId).doc(input.movimentoId);
  const m = (await ref.get()).data() as Movimento | undefined;
  if (!m || m.eliminato) throw new HttpsError("not-found", "Spesa non trovata.");
  const referente = ctx.membro?.commissioni[m.commissioneId] === "referente";
  if (!(m.createdBy === ctx.uid || ctx.admin || referente)) vietato();
  if (m.stato !== "rifiutata") throw new HttpsError("failed-precondition", "La spesa non è stata rifiutata.");
  await ref.update({ stato: "in_attesa", motivo: FieldValue.delete(), updatedAt: ora(), updatedBy: ctx.uid });
  return { ok: true as const };
});

/** Annulla una spesa (o un'entrata) approvata e non ancora rimborsata. Solo admin, con motivo. */
export const annullaMovimento = onCall(async (req) => {
  const input = valida(annullaMovimentoInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  if (!ctx.admin) vietato("Solo un admin può annullare una spesa approvata.");
  const ref = movimenti(input.festaId).doc(input.movimentoId);
  await db().runTransaction(async (tx) => {
    const m = (await tx.get(ref)).data() as Movimento | undefined;
    if (!m || m.eliminato) throw new HttpsError("not-found", "Movimento non trovato.");
    if (m.stato !== "approvata" || m.rimborsoId) {
      throw new HttpsError("failed-precondition", "Si annullano solo spese approvate e non ancora rimborsate.");
    }
    tx.update(ref, { stato: "annullata", motivo: input.motivo, updatedAt: ora(), updatedBy: ctx.uid });
  });
  return { ok: true as const };
});

/** Entrata (sponsor, contributi, incassi): la registra un admin, già approvata. */
export const registraEntrata = onCall(async (req) => {
  const input = valida(registraEntrataInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  if (!ctx.admin) vietato("Solo un admin può registrare le entrate.");
  const comm = await db().doc(`feste/${input.festaId}/commissioni/${input.commissioneId}`).get();
  if (!comm.exists) throw new HttpsError("not-found", "Commissione non trovata.");
  if (!ctx.festa.categorieSpesa.includes(input.categoria)) throw new HttpsError("invalid-argument", "Categoria non valida.");
  const ref = movimenti(input.festaId).doc();
  await ref.create({
    tipo: "entrata",
    commissioneId: input.commissioneId,
    descrizione: input.descrizione,
    importoCents: input.importoCents,
    categoria: input.categoria,
    dataSpesa: Timestamp.fromDate(dataDaGiorno(input.dataSpesa)),
    pagatoDa: { tipo: "cassa" },
    stato: "approvata",
    approvatoDa: ctx.uid,
    approvatoAt: ora(),
    scontrini: [],
    eliminato: false,
    createdAt: ora(),
    createdBy: ctx.uid,
    updatedAt: ora(),
    updatedBy: ctx.uid,
  });
  return { movimentoId: ref.id };
});

/** Rimborso a una persona di una o più spese anticipate e approvate (SPEC 6.4). Il totale lo calcola il server. */
export const registraRimborso = onCall(async (req) => {
  const input = valida(registraRimborsoInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  if (!ctx.admin) vietato("Solo un admin può registrare i rimborsi.");
  const rimborsoRef = db().collection(`feste/${input.festaId}/rimborsi`).doc();
  const refs = [...new Set(input.movimentiIds)].map((id) => movimenti(input.festaId).doc(id));

  const totaleCents = await db().runTransaction(async (tx) => {
    const snaps = await tx.getAll(...refs);
    const spese = snaps.map((s) => {
      const m = s.data() as Movimento | undefined;
      if (!m || m.eliminato || m.tipo !== "spesa") throw new HttpsError("not-found", "Spesa non trovata.");
      if (m.stato !== "approvata" || m.rimborsoId) throw new HttpsError("failed-precondition", `"${m.descrizione}" non è da rimborsare.`);
      if (m.pagatoDa.tipo !== "anticipata") throw new HttpsError("failed-precondition", `"${m.descrizione}" è stata pagata dalla cassa.`);
      return m;
    });
    const chiavi = new Set(spese.map(chiaveBeneficiario));
    if (chiavi.size !== 1) throw new HttpsError("invalid-argument", "Un rimborso è per una persona sola.");
    const primo = spese[0].pagatoDa;
    let beneficiarioNome = primo.beneficiarioNome?.trim() ?? "";
    if (primo.beneficiarioUid) {
      const membro = await tx.get(db().doc(`feste/${input.festaId}/membri/${primo.beneficiarioUid}`));
      beneficiarioNome = String(membro.get("nomeVisualizzato") ?? (beneficiarioNome || "Persona"));
    }
    const totale = spese.reduce((t, m) => t + m.importoCents, 0);
    tx.create(rimborsoRef, {
      ...(primo.beneficiarioUid && { beneficiarioUid: primo.beneficiarioUid }),
      beneficiarioNome,
      movimentiIds: refs.map((r) => r.id),
      totaleCents: totale,
      modalita: input.modalita,
      data: Timestamp.fromDate(dataDaGiorno(input.data)),
      ...(input.nota && { nota: input.nota }),
      createdAt: ora(),
      createdBy: ctx.uid,
      updatedAt: ora(),
      updatedBy: ctx.uid,
    });
    for (const r of refs) tx.update(r, { stato: "rimborsata", rimborsoId: rimborsoRef.id, updatedAt: ora(), updatedBy: ctx.uid });
    return totale;
  });
  return { rimborsoId: rimborsoRef.id, totaleCents };
});

/** Rimborso registrato per sbaglio: solo superadmin, con motivo. Le spese tornano da rimborsare. */
export const annullaRimborso = onCall(async (req) => {
  const input = valida(annullaRimborsoInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  if (!ctx.superadmin) vietato("Solo un superadmin può annullare un rimborso.");
  const ref = db().doc(`feste/${input.festaId}/rimborsi/${input.rimborsoId}`);
  await db().runTransaction(async (tx) => {
    const r = (await tx.get(ref)).data() as Rimborso | undefined;
    if (!r) throw new HttpsError("not-found", "Rimborso non trovato.");
    if (r.annullato) throw new HttpsError("failed-precondition", "Il rimborso è già annullato.");
    const spese = await tx.getAll(...r.movimentiIds.map((id) => movimenti(input.festaId).doc(id)));
    tx.update(ref, { annullato: true, motivoAnnullamento: input.motivo, updatedAt: ora(), updatedBy: ctx.uid });
    for (const s of spese) {
      if (s.get("rimborsoId") !== input.rimborsoId) continue;
      tx.update(s.ref, { stato: "approvata", rimborsoId: FieldValue.delete(), updatedAt: ora(), updatedBy: ctx.uid });
    }
  });
  return { ok: true as const };
});

/** Storico dei movimenti: una voce per ogni modifica (SPEC 3). */
export const storicoMovimento = onDocumentWritten("feste/{festaId}/movimenti/{movimentoId}", async (event) => {
  const prima = event.data?.before.data();
  const dopo = event.data?.after.data();
  if (!dopo) return;
  const voce = vocePerMovimento(prima, dopo);
  if (!voce) return;
  await storico(event.params.festaId, {
    entita: "movimento",
    entitaId: event.params.movimentoId,
    attoreUid: String(dopo.updatedBy ?? dopo.createdBy ?? "sistema"),
    ...voce,
  });
});
