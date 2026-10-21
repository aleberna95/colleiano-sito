import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { account, admin, chiudiClient, client, svuota } from "./setup";

type Call = Awaited<ReturnType<typeof client>>;
const persona = (festaId: string, nome: string, extra: Record<string, unknown> = {}) => ({
  festaId, nome, cognome: "Test", email: `${nome}@test.it`, telefono: "333 1234567",
  ruoloFesta: "membro", commissioni: {}, ...extra,
});

let sa: Call;
let festaId: string;

beforeEach(async () => {
  await svuota();
  const s = await account("alessio", { superadmin: true });
  sa = await client(s.email);
  ({ festaId } = await sa<{ festaId: string }>("creaFesta", { nome: "Festa di Colleiano 2027", dataFesta: "2027-08-14" }));
});

afterEach(() => chiudiClient());

/** Crea una persona e restituisce un client autenticato come lei. */
async function entra(nome: string, extra: Record<string, unknown> = {}, da: Call = sa) {
  const r = await da<{ uid: string; password: string }>("creaPersona", persona(festaId, nome, extra));
  await admin().auth.updateUser(r.uid, { password: "password-test" });
  return { uid: r.uid, call: await client(`${nome}@test.it`) };
}

async function commissione(nome: string) {
  const ref = admin().db.collection(`feste/${festaId}/commissioni`).doc();
  await ref.set({ nome, icona: "music", colore: "blu", ordine: 1, generale: false, referentiUids: [], componentiUids: [] });
  return ref.id;
}

describe("creaFesta", () => {
  it("crea festa, commissione Generale e il creatore come admin", async () => {
    const { db } = admin();
    const festa = (await db.doc(`feste/${festaId}`).get()).data()!;
    expect(festa.slug).toBe("festa-di-colleiano-2027");
    expect(festa.stato).toBe("preparazione");
    expect((await db.doc(`feste/${festaId}/commissioni/generale`).get()).get("generale")).toBe(true);
    const membri = await db.collection(`feste/${festaId}/membri`).get();
    expect(membri.docs.map((d) => d.get("ruoloFesta"))).toEqual(["admin"]);
  });

  it("solo il superadmin crea feste; lo slug resta unico", async () => {
    const a = await entra("anna", { ruoloFesta: "admin" });
    await expect(a.call("creaFesta", { nome: "Altra festa" })).rejects.toThrow(/superadmin/);
    const r = await sa<{ slug: string }>("creaFesta", { nome: "Festa di Colleiano 2027" });
    expect(r.slug).toBe("festa-di-colleiano-2027-2");
  });
});

describe("persone e ruoli (SPEC 4.3, 4.7 n.8)", () => {
  it("il superadmin crea un admin, l'admin crea un membro ma non un admin", async () => {
    const r = await sa<Record<string, unknown>>("creaPersona", persona(festaId, "anna", { ruoloFesta: "admin" }));
    expect(r.nuovoAccount).toBe(true);
    // La password la sceglie la persona dall'email: nessuno la vede, niente cambio obbligato.
    expect(r).not.toHaveProperty("password");
    const { db } = admin();
    const anna = await admin().auth.getUserByEmail("anna@test.it");
    expect((await db.doc(`users/${anna.uid}`).get()).get("devoCambiarePassword")).toBe(false);

    await admin().auth.updateUser(anna.uid, { password: "password-test" });
    const annaCall = await client("anna@test.it");
    await expect(annaCall("creaPersona", persona(festaId, "mario"))).resolves.toMatchObject({ nuovoAccount: true });
    await expect(annaCall("creaPersona", persona(festaId, "luca", { ruoloFesta: "admin" }))).rejects.toThrow(/superadmin/);
  });

  it("un membro non crea persone", async () => {
    const m = await entra("mario");
    await expect(m.call("creaPersona", persona(festaId, "luca"))).rejects.toThrow(/admin/);
  });

  it("una persona già presente non si aggiunge due volte", async () => {
    await entra("mario");
    await expect(sa("creaPersona", persona(festaId, "mario"))).rejects.toThrow(/già nella festa/);
  });

  it("i ruoli nelle commissioni si riflettono sulle card", async () => {
    const c1 = await commissione("Musica");
    const m = await entra("mario", { commissioni: { [c1]: "referente" } });
    const c = (await admin().db.doc(`feste/${festaId}/commissioni/${c1}`).get()).data()!;
    expect(c.referentiUids).toEqual([m.uid]);
    expect(c.componentiUids).toEqual([]);
  });

  it("il referente gestisce solo la sua commissione, il componente niente", async () => {
    const c1 = await commissione("Musica");
    const c2 = await commissione("Cucina");
    const ref = await entra("rita", { commissioni: { [c1]: "referente" } });
    const comp = await entra("carlo", { commissioni: { [c1]: "componente" } });
    const altro = await entra("piero");

    await expect(
      ref.call("aggiornaRuoli", { festaId, uid: altro.uid, commissioni: { [c1]: "componente" } }),
    ).resolves.toEqual({ ok: true });
    const card = (await admin().db.doc(`feste/${festaId}/commissioni/${c1}`).get()).data()!;
    expect(card.componentiUids).toContain(altro.uid);

    await expect(
      ref.call("aggiornaRuoli", { festaId, uid: altro.uid, commissioni: { [c1]: "componente", [c2]: "componente" } }),
    ).rejects.toThrow(/referente/);
    await expect(ref.call("aggiornaRuoli", { festaId, uid: altro.uid, ruoloFesta: "admin", commissioni: { [c1]: "componente" } })).rejects.toThrow();
    await expect(comp.call("aggiornaRuoli", { festaId, uid: altro.uid, commissioni: {} })).rejects.toThrow();
  });

  it("un admin non promuove ad admin e non tocca gli admin; il superadmin sì", async () => {
    const a = await entra("anna", { ruoloFesta: "admin" });
    const b = await entra("bruno", { ruoloFesta: "admin" });
    const m = await entra("mario");
    await expect(a.call("aggiornaRuoli", { festaId, uid: m.uid, ruoloFesta: "admin", commissioni: {} })).rejects.toThrow(/superadmin/);
    await expect(a.call("aggiornaRuoli", { festaId, uid: b.uid, ruoloFesta: "membro", commissioni: {} })).rejects.toThrow(/superadmin/);
    await expect(sa("aggiornaRuoli", { festaId, uid: m.uid, ruoloFesta: "admin", commissioni: {} })).resolves.toEqual({ ok: true });
  });
});

describe("disattivazione (SPEC 4.3, 4.7 n.8)", () => {
  it("un admin non disattiva un admin, il superadmin sì", async () => {
    const a = await entra("anna", { ruoloFesta: "admin" });
    const b = await entra("bruno", { ruoloFesta: "admin" });
    await expect(a.call("disattivaPersona", { festaId, uid: b.uid })).rejects.toThrow(/superadmin/);
    await expect(sa("disattivaPersona", { festaId, uid: b.uid })).resolves.toEqual({ ok: true });
    const membro = (await admin().db.doc(`feste/${festaId}/membri/${b.uid}`).get()).data()!;
    expect(membro.attivo).toBe(false);
  });

  it("l'admin disattiva un membro: i suoi task aperti tornano da assegnare", async () => {
    const a = await entra("anna", { ruoloFesta: "admin" });
    const c1 = await commissione("Musica");
    const m = await entra("mario", { commissioni: { [c1]: "componente" } });
    const { db } = admin();
    const task = (stato: string) => ({ titolo: "x", commissioneId: c1, responsabileUid: m.uid, stato, updatedAt: FieldValue.serverTimestamp() });
    const aperto = await db.collection(`feste/${festaId}/tasks`).add(task("in_corso"));
    const fatto = await db.collection(`feste/${festaId}/tasks`).add(task("fatto"));

    await a.call("disattivaPersona", { festaId, uid: m.uid });
    expect((await aperto.get()).get("responsabileUid")).toBeNull();
    expect((await aperto.get()).get("stato")).toBe("da_fare");
    expect((await fatto.get()).get("responsabileUid")).toBe(m.uid);
    const card = (await db.doc(`feste/${festaId}/commissioni/${c1}`).get()).data()!;
    expect(card.componentiUids).not.toContain(m.uid);
  });

  it("riaggiungere una persona disattivata la riattiva", async () => {
    const m = await entra("mario");
    await sa("disattivaPersona", { festaId, uid: m.uid });
    const r = await sa<{ nuovoAccount: boolean }>("creaPersona", persona(festaId, "mario"));
    expect(r.nuovoAccount).toBe(false);
  });

  it("disattivare l'account lo blocca ovunque; solo il superadmin lo fa", async () => {
    const a = await entra("anna", { ruoloFesta: "admin" });
    const m = await entra("mario");
    await expect(a.call("disattivaPersona", { uid: m.uid })).rejects.toThrow(/superadmin/);
    await sa("disattivaPersona", { uid: m.uid });
    expect((await admin().auth.getUser(m.uid)).disabled).toBe(true);
  });
});

describe("password e superadmin (SPEC 6.7, 8.1)", () => {
  it("l'admin rigenera la password di un membro ma non di un admin", async () => {
    const a = await entra("anna", { ruoloFesta: "admin" });
    const b = await entra("bruno", { ruoloFesta: "admin" });
    const m = await entra("mario");
    await expect(a.call("nuovaPasswordTemporanea", { festaId, uid: m.uid })).resolves.toMatchObject({ email: "mario@test.it" });
    await expect(a.call("nuovaPasswordTemporanea", { festaId, uid: b.uid })).rejects.toThrow(/superadmin/);
  });

  it("si nomina un secondo superadmin; l'ultimo non si può togliere", async () => {
    const a = await entra("anna", { ruoloFesta: "admin" });
    const io = (await admin().auth.getUserByEmail("alessio@test.it")).uid;
    await expect(sa("impostaSuperadmin", { uid: io, superadmin: false })).rejects.toThrow(/almeno un superadmin/);
    await sa("impostaSuperadmin", { uid: a.uid, superadmin: true });
    expect((await admin().auth.getUser(a.uid)).customClaims?.superadmin).toBe(true);
  });
});
