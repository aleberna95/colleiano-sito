import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { account, admin, chiudiClient, client, svuota } from "./setup";

type Call = Awaited<ReturnType<typeof client>>;

let sa: Call;
let saUid: string;
let festaId: string;

beforeEach(async () => {
  await svuota();
  const s = await account("alessio", { superadmin: true });
  saUid = s.uid;
  sa = await client(s.email);
  ({ festaId } = await sa<{ festaId: string }>("creaFesta", { nome: "Festa 2027" }));
});

afterEach(() => chiudiClient());

async function entra(nome: string, extra: Record<string, unknown> = {}) {
  const r = await sa<{ uid: string }>("creaPersona", {
    festaId, nome, cognome: "Test", email: `${nome}@test.it`, telefono: "333 1234567", ruoloFesta: "membro", commissioni: {}, ...extra,
  });
  await admin().auth.updateUser(r.uid, { password: "password-test" });
  return { uid: r.uid, call: await client(`${nome}@test.it`) };
}

/** Spesa scritta come la scrive il client (le regole sono testate a parte). */
async function spesa(autore: string, extra: Record<string, unknown> = {}) {
  const ref = admin().db.collection(`feste/${festaId}/movimenti`).doc();
  await ref.set({
    tipo: "spesa", commissioneId: "generale", descrizione: "Corde", importoCents: 2550, categoria: "Altro",
    dataSpesa: Timestamp.now(), pagatoDa: { tipo: "anticipata", beneficiarioUid: autore }, stato: "in_attesa",
    scontrini: [], eliminato: false,
    createdAt: FieldValue.serverTimestamp(), createdBy: autore, updatedAt: FieldValue.serverTimestamp(), updatedBy: autore,
    ...extra,
  });
  return ref.id;
}
const leggi = async (id: string) => (await admin().db.doc(`feste/${festaId}/movimenti/${id}`).get()).data()!;

describe("approvare e rifiutare (SPEC 4.5, 4.7 n.9)", () => {
  it("un admin approva le spese degli altri, anche più insieme, ma non le proprie", async () => {
    const anna = await entra("anna", { ruoloFesta: "admin" });
    const luca = await entra("luca");
    const s1 = await spesa(luca.uid);
    const s2 = await spesa(luca.uid, { pagatoDa: { tipo: "cassa" } });
    await anna.call("decidiSpese", { festaId, movimentiIds: [s1, s2], azione: "approva" });
    expect((await leggi(s1)).stato).toBe("approvata");
    expect((await leggi(s2)).approvatoDa).toBe(anna.uid);

    const propria = await spesa(anna.uid);
    await expect(anna.call("decidiSpese", { festaId, movimentiIds: [propria], azione: "approva" })).rejects.toThrow(/tua spesa/);
    // Anche se l'ha segnata un altro, ma i soldi li riceve lei.
    const perLei = await spesa(luca.uid, { pagatoDa: { tipo: "anticipata", beneficiarioUid: anna.uid } });
    await expect(anna.call("decidiSpese", { festaId, movimentiIds: [perLei], azione: "rifiuta", motivo: "Doppia" })).rejects.toThrow(/tua spesa/);
  });

  it("un membro non approva; il rifiuto vuole un motivo", async () => {
    const luca = await entra("luca");
    const s = await spesa(saUid);
    await expect(luca.call("decidiSpese", { festaId, movimentiIds: [s], azione: "approva" })).rejects.toThrow(/admin/);
    const anna = await entra("anna", { ruoloFesta: "admin" });
    await expect(anna.call("decidiSpese", { festaId, movimentiIds: [s], azione: "rifiuta" })).rejects.toThrow(/motivo/);
    await anna.call("decidiSpese", { festaId, movimentiIds: [s], azione: "rifiuta", motivo: "Manca lo scontrino" });
    expect(await leggi(s)).toMatchObject({ stato: "rifiutata", motivo: "Manca lo scontrino" });
  });

  it("l'unico superadmin senza altri admin approva le proprie, e resta segnato", async () => {
    const s = await spesa(saUid);
    await sa("decidiSpese", { festaId, movimentiIds: [s], azione: "approva" });
    expect(await leggi(s)).toMatchObject({ stato: "approvata", autoApprovata: true });
    // Con un altro admin nella festa non può più.
    await entra("anna", { ruoloFesta: "admin" });
    const s2 = await spesa(saUid);
    await expect(sa("decidiSpese", { festaId, movimentiIds: [s2], azione: "approva" })).rejects.toThrow(/tua spesa/);
  });

  it("l'autore corregge una spesa rifiutata e la rimanda in approvazione", async () => {
    const luca = await entra("luca");
    const s = await spesa(luca.uid, { stato: "rifiutata", motivo: "Importo sbagliato" });
    await luca.call("ripresentaSpesa", { festaId, movimentoId: s });
    const m = await leggi(s);
    expect(m.stato).toBe("in_attesa");
    expect(m.motivo).toBeUndefined();
  });

  it("l'admin annulla una spesa approvata non rimborsata, con motivo", async () => {
    const luca = await entra("luca");
    const s = await spesa(luca.uid, { stato: "approvata" });
    await expect(luca.call("annullaMovimento", { festaId, movimentoId: s, motivo: "Errore" })).rejects.toThrow(/admin/);
    await sa("annullaMovimento", { festaId, movimentoId: s, motivo: "Comprata due volte" });
    expect((await leggi(s)).stato).toBe("annullata");
    const r = await spesa(luca.uid, { stato: "rimborsata", rimborsoId: "x" });
    await expect(sa("annullaMovimento", { festaId, movimentoId: r, motivo: "Errore" })).rejects.toThrow(/rimborsate/);
  });
});

describe("entrate e rimborsi (SPEC 4.5, 6.4)", () => {
  it("le entrate le registra solo l'admin, già approvate", async () => {
    const luca = await entra("luca");
    const input = { festaId, commissioneId: "generale", descrizione: "Sponsor", importoCents: 20000, categoria: "Altro", dataSpesa: "2027-05-01" };
    await expect(luca.call("registraEntrata", input)).rejects.toThrow(/admin/);
    const { movimentoId } = await sa<{ movimentoId: string }>("registraEntrata", input);
    expect(await leggi(movimentoId)).toMatchObject({ tipo: "entrata", stato: "approvata", importoCents: 20000 });
  });

  it("il rimborso calcola il totale sul server e segna le spese come rimborsate", async () => {
    const luca = await entra("luca");
    const a = await spesa(luca.uid, { stato: "approvata", importoCents: 1000 });
    const b = await spesa(luca.uid, { stato: "approvata", importoCents: 550 });
    const r = await sa<{ rimborsoId: string; totaleCents: number }>("registraRimborso", {
      festaId, movimentiIds: [a, b], modalita: "contanti", data: "2027-05-02",
    });
    expect(r.totaleCents).toBe(1550);
    const rimborso = (await admin().db.doc(`feste/${festaId}/rimborsi/${r.rimborsoId}`).get()).data()!;
    expect(rimborso).toMatchObject({ beneficiarioUid: luca.uid, beneficiarioNome: "luca", totaleCents: 1550 });
    expect(await leggi(a)).toMatchObject({ stato: "rimborsata", rimborsoId: r.rimborsoId });
    // Non si rimborsa due volte.
    await expect(sa("registraRimborso", { festaId, movimentiIds: [a], modalita: "contanti", data: "2027-05-02" })).rejects.toThrow(/non è da rimborsare/);
  });

  it("un rimborso è per una persona sola e solo per spese anticipate approvate", async () => {
    const luca = await entra("luca");
    const gina = await entra("gina");
    const a = await spesa(luca.uid, { stato: "approvata" });
    const b = await spesa(gina.uid, { stato: "approvata" });
    const c = await spesa(luca.uid, { stato: "approvata", pagatoDa: { tipo: "cassa" } });
    const d = await spesa(luca.uid);
    const base = { festaId, modalita: "bonifico", data: "2027-05-02" };
    await expect(sa("registraRimborso", { ...base, movimentiIds: [a, b] })).rejects.toThrow(/persona sola/);
    await expect(sa("registraRimborso", { ...base, movimentiIds: [c] })).rejects.toThrow(/cassa/);
    await expect(sa("registraRimborso", { ...base, movimentiIds: [d] })).rejects.toThrow(/non è da rimborsare/);
    await expect(luca.call("registraRimborso", { ...base, movimentiIds: [a] })).rejects.toThrow(/admin/);
  });

  it("solo il superadmin annulla un rimborso: le spese tornano da rimborsare", async () => {
    const anna = await entra("anna", { ruoloFesta: "admin" });
    const luca = await entra("luca");
    const a = await spesa(luca.uid, { stato: "approvata" });
    const { rimborsoId } = await anna.call<{ rimborsoId: string }>("registraRimborso", { festaId, movimentiIds: [a], modalita: "contanti", data: "2027-05-02" });
    await expect(anna.call("annullaRimborso", { festaId, rimborsoId, motivo: "Sbagliato" })).rejects.toThrow(/superadmin/);
    await sa("annullaRimborso", { festaId, rimborsoId, motivo: "Persona sbagliata" });
    const m = await leggi(a);
    expect(m.stato).toBe("approvata");
    expect(m.rimborsoId).toBeUndefined();
    expect((await admin().db.doc(`feste/${festaId}/rimborsi/${rimborsoId}`).get()).get("annullato")).toBe(true);
  });
});

describe("storico dei movimenti (trigger)", () => {
  it("registra la creazione e l'approvazione con chi l'ha fatta", async () => {
    const luca = await entra("luca");
    const s = await spesa(luca.uid);
    await sa("decidiSpese", { festaId, movimentiIds: [s], azione: "approva" });
    const q = admin().db.collection(`feste/${festaId}/storico`).where("entita", "==", "movimento").where("entitaId", "==", s);
    let voci: FirebaseFirestore.DocumentData[] = [];
    for (let i = 0; i < 40 && voci.length < 2; i++) {
      voci = (await q.get()).docs.map((d) => d.data());
      if (voci.length < 2) await new Promise((r) => setTimeout(r, 500));
    }
    voci.sort((a, b) => a.at.toMillis() - b.at.toMillis());
    expect(voci.map((v) => v.azione)).toEqual(["creato", "stato"]);
    expect(voci[1]).toMatchObject({ attoreUid: saUid, diff: { stato: { prima: "in_attesa", dopo: "approvata" } } });
  });
});
