import { randomBytes } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, type WriteBatch } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  aggiornaRuoliInput,
  creaPersonaInput,
  disattivaPersonaInput,
  impostaSuperadminInput,
  nuovaPasswordInput,
  type Membro,
  type RuoloCommissione,
  type User,
} from "../../lib/schemas";
import {
  chiamante,
  contestoFesta,
  db,
  liberaTask,
  membroDa,
  ora,
  passwordTemporanea,
  storico,
  valida,
  vietato,
} from "./util";

type Ruoli = Record<string, RuoloCommissione>;

/** Allinea referentiUids/componentiUids delle commissioni toccate (denormalizzati, SPEC 5). */
function allineaCommissioni(
  w: WriteBatch,
  festaId: string,
  uid: string,
  vecchi: Ruoli,
  nuovi: Ruoli,
  attoreUid: string,
) {
  const toccate = new Set([...Object.keys(vecchi), ...Object.keys(nuovi)]);
  for (const commId of toccate) {
    if (vecchi[commId] === nuovi[commId]) continue;
    const ref = db().doc(`feste/${festaId}/commissioni/${commId}`);
    const ruolo = nuovi[commId];
    // Due update separati: arrayUnion e arrayRemove sullo stesso campo non si combinano.
    w.update(ref, {
      referentiUids: FieldValue.arrayRemove(uid),
      componentiUids: FieldValue.arrayRemove(uid),
    });
    if (ruolo) {
      w.update(ref, {
        [ruolo === "referente" ? "referentiUids" : "componentiUids"]: FieldValue.arrayUnion(uid),
        updatedAt: ora(),
        updatedBy: attoreUid,
      });
    }
  }
}

async function verificaCommissioni(festaId: string, ruoli: Ruoli) {
  const ids = Object.keys(ruoli);
  if (!ids.length) return;
  const snaps = await db().getAll(...ids.map((id) => db().doc(`feste/${festaId}/commissioni/${id}`)));
  for (const s of snaps) {
    if (!s.exists) throw new HttpsError("not-found", "Commissione non trovata.");
    if (s.get("generale") === true) throw new HttpsError("invalid-argument", "La commissione Generale non ha componenti.");
  }
}

/**
 * Nuova persona nella festa (SPEC 4.3, 6.5). Un account nuovo nasce con una password casuale che nessuno vede:
 * la persona sceglie la sua dal link dell'email di Firebase, che il client fa partire subito dopo.
 */
export const creaPersona = onCall(async (req) => {
  const input = valida(creaPersonaInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  if (!ctx.admin) vietato("Solo un admin può aggiungere persone.");
  if (input.ruoloFesta === "admin" && !ctx.superadmin) vietato("Solo un superadmin può nominare un admin.");
  await verificaCommissioni(input.festaId, input.commissioni);

  const auth = getAuth();
  const email = input.email.trim().toLowerCase();
  let uid: string;
  let nuovoAccount = false;
  let profilo: User | undefined;

  try {
    uid = (await auth.getUserByEmail(email)).uid;
    const snap = await db().doc(`users/${uid}`).get();
    profilo = snap.exists ? (snap.data() as User) : undefined;
    if (profilo && !profilo.attivo) {
      vietato("Questo account è disattivato. Chiedi a un superadmin di riattivarlo.");
    }
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    nuovoAccount = true;
    const password = randomBytes(24).toString("base64url");
    uid = (await auth.createUser({ email, password, displayName: `${input.nome} ${input.cognome}` })).uid;
  }

  const membroRef = db().doc(`feste/${input.festaId}/membri/${uid}`);
  const esistente = membroDa(await membroRef.get());
  if (esistente?.attivo) throw new HttpsError("already-exists", "Questa persona è già nella festa.");
  if (esistente?.ruoloFesta === "admin" && !ctx.superadmin) vietato("Solo un superadmin può riattivare un admin.");

  const audit = { updatedAt: ora(), updatedBy: ctx.uid };
  const batch = db().batch();
  if (!profilo) {
    batch.set(db().doc(`users/${uid}`), {
      nome: input.nome,
      cognome: input.cognome,
      nomeVisualizzato: input.nome,
      email,
      telefono: input.telefono,
      superadmin: false,
      attivo: true,
      // La password la sceglie dall'email: niente cambio obbligato al primo accesso.
      devoCambiarePassword: false,
      createdAt: ora(),
      createdBy: ctx.uid,
      ...audit,
    });
  }
  const nomeVisualizzato = profilo?.nomeVisualizzato ?? input.nome;
  const telefono = profilo?.telefono ?? input.telefono;
  batch.set(membroRef, {
    uid,
    nomeVisualizzato,
    telefono,
    ruoloFesta: input.ruoloFesta,
    commissioni: input.commissioni,
    attivo: true,
    createdAt: esistente ? (esistente.createdAt as unknown) : ora(),
    createdBy: esistente ? esistente.createdBy : ctx.uid,
    ...audit,
  });
  allineaCommissioni(batch, input.festaId, uid, {}, input.commissioni, ctx.uid);
  await batch.commit();
  await storico(input.festaId, {
    entita: "membro",
    entitaId: uid,
    azione: esistente ? "riattivato" : "aggiunto",
    attoreUid: ctx.uid,
    diff: { ruoloFesta: input.ruoloFesta, commissioni: input.commissioni },
  });

  return { uid, nomeVisualizzato, telefono, email, nuovoAccount };
});

/** Cambia ruolo nella festa e ruoli nelle commissioni (SPEC 4.3). */
export const aggiornaRuoli = onCall(async (req) => {
  const input = valida(aggiornaRuoliInput, req.data);
  const ctx = await contestoFesta(req, input.festaId);
  const ref = db().doc(`feste/${input.festaId}/membri/${input.uid}`);
  const target = membroDa(await ref.get());
  if (!target?.attivo) throw new HttpsError("not-found", "Persona non trovata nella festa.");
  await verificaCommissioni(input.festaId, input.commissioni);

  const nuovoRuoloFesta = input.ruoloFesta ?? target.ruoloFesta;
  const cambiaRuoloFesta = nuovoRuoloFesta !== target.ruoloFesta;

  if (ctx.superadmin) {
    // tutto permesso
  } else if (ctx.admin) {
    if (target.ruoloFesta === "admin" || nuovoRuoloFesta === "admin") {
      vietato("Solo un superadmin può gestire gli admin.");
    }
  } else {
    // Referente: solo le commissioni in cui è referente, mai il ruolo nella festa.
    if (cambiaRuoloFesta) vietato();
    const mie = ctx.membro?.commissioni ?? {};
    const toccate = new Set([...Object.keys(target.commissioni), ...Object.keys(input.commissioni)]);
    for (const commId of toccate) {
      if (target.commissioni[commId] === input.commissioni[commId]) continue;
      if (mie[commId] !== "referente") vietato("Puoi gestire solo le commissioni di cui sei referente.");
    }
  }

  const batch = db().batch();
  batch.update(ref, {
    ruoloFesta: nuovoRuoloFesta,
    commissioni: input.commissioni,
    updatedAt: ora(),
    updatedBy: ctx.uid,
  });
  allineaCommissioni(batch, input.festaId, input.uid, target.commissioni, input.commissioni, ctx.uid);
  await batch.commit();
  await storico(input.festaId, {
    entita: "membro",
    entitaId: input.uid,
    azione: "ruoli",
    attoreUid: ctx.uid,
    diff: { ruoloFesta: nuovoRuoloFesta, commissioni: input.commissioni },
  });
  return { ok: true };
});

/** Disattiva una persona in una festa, o l'intero account se manca festaId (SPEC 4.3). */
export const disattivaPersona = onCall(async (req) => {
  const input = valida(disattivaPersonaInput, req.data);

  if (input.festaId) {
    const ctx = await contestoFesta(req, input.festaId);
    if (!ctx.admin) vietato();
    if (input.uid === ctx.uid) vietato("Non puoi toglierti da solo dalla festa.");
    const ref = db().doc(`feste/${input.festaId}/membri/${input.uid}`);
    const target = membroDa(await ref.get());
    if (!target?.attivo) throw new HttpsError("not-found", "Persona non trovata nella festa.");
    if (target.ruoloFesta === "admin" && !ctx.superadmin) vietato("Solo un superadmin può disattivare un admin.");
    if (!ctx.proprietario && (await db().doc(`users/${input.uid}`).get()).get("proprietario") === true) {
      vietato("Il proprietario non si può togliere dalla festa.");
    }
    await disattivaInFesta(input.festaId, input.uid, target, ctx.uid);
    return { ok: true };
  }

  const io = chiamante(req);
  if (!io.superadmin) vietato("Solo un superadmin può disattivare un account.");
  if (input.uid === io.uid) vietato("Non puoi disattivare il tuo account.");
  const userRef = db().doc(`users/${input.uid}`);
  const user = (await userRef.get()).data() as User | undefined;
  if (!user) throw new HttpsError("not-found", "Account non trovato.");
  if (user.superadmin) vietato("Prima togli il ruolo di superadmin.");

  await getAuth().updateUser(input.uid, { disabled: true });
  await getAuth().revokeRefreshTokens(input.uid);
  await userRef.update({ attivo: false, updatedAt: ora(), updatedBy: io.uid });
  const membri = await db().collectionGroup("membri").where("uid", "==", input.uid).get();
  for (const m of membri.docs) {
    const festaId = m.ref.parent.parent!.id;
    const target = m.data() as Membro;
    if (target.attivo) await disattivaInFesta(festaId, input.uid, target, io.uid);
  }
  return { ok: true };
});

async function disattivaInFesta(festaId: string, uid: string, target: Membro, attoreUid: string) {
  const batch = db().batch();
  batch.update(db().doc(`feste/${festaId}/membri/${uid}`), { attivo: false, updatedAt: ora(), updatedBy: attoreUid });
  // Il ruolo resta salvato nel membro, ma la persona sparisce dalle card delle commissioni.
  allineaCommissioni(batch, festaId, uid, target.commissioni, {}, attoreUid);
  await batch.commit();
  const liberati = await liberaTask(festaId, uid, attoreUid);
  await storico(festaId, { entita: "membro", entitaId: uid, azione: "disattivato", attoreUid, diff: { taskLiberati: liberati } });
}

/** Nuova password temporanea da mandare su WhatsApp (SPEC 6.7). */
export const nuovaPasswordTemporanea = onCall(async (req) => {
  const input = valida(nuovaPasswordInput, req.data);
  const io = chiamante(req);
  if (!io.superadmin) {
    if (!input.festaId) vietato();
    const ctx = await contestoFesta(req, input.festaId);
    if (!ctx.admin) vietato();
    const target = membroDa(await db().doc(`feste/${input.festaId}/membri/${input.uid}`).get());
    if (!target?.attivo) throw new HttpsError("not-found", "Persona non trovata nella festa.");
    if (target.ruoloFesta === "admin") vietato("Solo un superadmin può cambiare la password di un admin.");
  }
  const userRef = db().doc(`users/${input.uid}`);
  const user = (await userRef.get()).data() as User | undefined;
  if (!user?.attivo) throw new HttpsError("not-found", "Account non trovato o disattivato.");
  if (user.superadmin && input.uid !== io.uid && !io.superadmin) vietato();
  // La password di un altro superadmin la cambia solo il proprietario: nessuno può prendersi il suo account.
  if (user.superadmin && input.uid !== io.uid && !io.proprietario) vietato("Solo il proprietario può cambiare la password di un superadmin.");

  const password = passwordTemporanea();
  await getAuth().updateUser(input.uid, { password });
  await userRef.update({ devoCambiarePassword: true, updatedAt: ora(), updatedBy: io.uid });
  return { password, email: user.email, telefono: user.telefono, nome: user.nomeVisualizzato };
});

/** Nomina o toglie un superadmin: solo il proprietario. Mai lasciare il sistema senza superadmin (SPEC 4.3). */
export const impostaSuperadmin = onCall(async (req) => {
  const input = valida(impostaSuperadminInput, req.data);
  const io = chiamante(req);
  if (!io.superadmin || !io.proprietario) vietato("Solo il proprietario può nominare o togliere un superadmin.");
  const userRef = db().doc(`users/${input.uid}`);
  const user = (await userRef.get()).data() as User | undefined;
  if (!user?.attivo) throw new HttpsError("not-found", "Account non trovato o disattivato.");
  if (user.proprietario) vietato("Il proprietario resta sempre superadmin.");

  if (!input.superadmin) {
    const altri = await db().collection("users").where("superadmin", "==", true).where("attivo", "==", true).get();
    if (altri.docs.filter((d) => d.id !== input.uid).length === 0) {
      vietato("Deve restare almeno un superadmin.");
    }
  }
  const auth = getAuth();
  const { customClaims } = await auth.getUser(input.uid);
  await auth.setCustomUserClaims(input.uid, { ...customClaims, superadmin: input.superadmin });
  await userRef.update({ superadmin: input.superadmin, updatedAt: ora(), updatedBy: io.uid });
  return { ok: true };
});
