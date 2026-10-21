import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { account, admin, chiudiClient, client, svuota } from "./setup";

let festaId: string;
let uid: string;

beforeEach(async () => {
  await svuota();
  const s = await account("alessio", { superadmin: true });
  uid = s.uid;
  const sa = await client(s.email);
  ({ festaId } = await sa<{ festaId: string }>("creaFesta", { nome: "Festa di Colleiano 2027" }));
});

afterEach(() => chiudiClient());

/** Il trigger è asincrono: aspetta che lo storico abbia `n` voci per il task. */
async function storico(taskId: string, n: number) {
  const q = admin().db.collection(`feste/${festaId}/storico`).where("entita", "==", "task").where("entitaId", "==", taskId);
  for (let i = 0; i < 40; i++) {
    const s = await q.get();
    if (s.size >= n) return s.docs.map((d) => d.data()).sort((a, b) => a.at.toMillis() - b.at.toMillis());
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Storico incompleto per ${taskId}`);
}

describe("storico dei task (trigger)", () => {
  it("registra creazione e cambio di stato con chi l'ha fatto", async () => {
    const ref = admin().db.collection(`feste/${festaId}/tasks`).doc();
    const base = { createdAt: FieldValue.serverTimestamp(), createdBy: uid, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid };
    await ref.set({
      titolo: "Palco", commissioneId: "generale", responsabileUid: uid, stato: "da_fare", priorita: "normale",
      checklist: [], link: [], eliminato: false, ...base,
    });
    await storico(ref.id, 1);
    await ref.update({ stato: "in_corso", updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
    const voci = await storico(ref.id, 2);
    expect(voci.map((v) => v.azione)).toEqual(["creato", "stato"]);
    expect(voci[1].attoreUid).toBe(uid);
    expect(voci[1].diff).toEqual({ stato: { prima: "da_fare", dopo: "in_corso" } });
  });
});
