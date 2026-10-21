import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { creaFestaInput, type User } from "../../lib/schemas";
import { chiamante, dataDaGiorno, db, ora, slugify, valida, vietato } from "./util";

const CATEGORIE_DEFAULT = [
  "Cibo e bevande",
  "Attrezzatura",
  "Musica e spettacoli",
  "Allestimento",
  "Pubblicità e stampa",
  "Permessi",
  "Altro",
];

/** Crea una festa con la commissione Generale. Solo superadmin (SPEC 4.6, 6.5). */
export const creaFesta = onCall(async (req) => {
  const io = chiamante(req);
  if (!io.superadmin) vietato("Solo un superadmin può creare una festa.");
  const input = valida(creaFestaInput, req.data);

  const userSnap = await db().doc(`users/${io.uid}`).get();
  if (!userSnap.exists) throw new HttpsError("failed-precondition", "Profilo non trovato.");
  const user = userSnap.data() as User;

  const base = slugify(input.nome);
  let slug = base;
  for (let i = 2; !(await db().collection("feste").where("slug", "==", slug).limit(1).get()).empty; i++) {
    slug = `${base}-${i}`;
  }

  const festaRef = db().collection("feste").doc();
  const generaleRef = festaRef.collection("commissioni").doc("generale");
  const audit = { createdAt: ora(), createdBy: io.uid, updatedAt: ora(), updatedBy: io.uid };

  const batch = db().batch();
  batch.create(festaRef, {
    nome: input.nome,
    slug,
    ...(input.dataFesta ? { dataFesta: Timestamp.fromDate(dataDaGiorno(input.dataFesta)) } : {}),
    ...(input.luogo ? { luogo: input.luogo } : {}),
    stato: "preparazione",
    categorieSpesa: CATEGORIE_DEFAULT,
    ...audit,
  });
  batch.create(generaleRef, {
    nome: "Generale",
    descrizione: "Spese e cose che riguardano tutta la festa.",
    icona: "house",
    colore: "grigio",
    ordine: 0,
    generale: true,
    referentiUids: [],
    componentiUids: [],
    ...audit,
  });
  // Chi crea la festa ne è admin, così compare tra le persone e può ricevere task.
  batch.create(festaRef.collection("membri").doc(io.uid), {
    uid: io.uid,
    nomeVisualizzato: user.nomeVisualizzato,
    telefono: user.telefono,
    ruoloFesta: "admin",
    commissioni: {},
    attivo: true,
    ...audit,
  });
  batch.update(userSnap.ref, { ultimaFestaId: festaRef.id });
  await batch.commit();

  return { festaId: festaRef.id, slug };
});
