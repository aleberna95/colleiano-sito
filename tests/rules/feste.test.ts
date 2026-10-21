import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { creaAmbiente } from "./setup";
import * as perm from "@/lib/permissions";
import type { Festa, Membro } from "@/lib/schemas";

let env: RulesTestEnvironment;
const t = Timestamp.now();
const audit = { createdAt: t, createdBy: "seed", updatedAt: t, updatedBy: "seed" };

const membri: Record<string, Partial<Membro> & { festa: string }> = {
  admin: { festa: "f1", ruoloFesta: "admin", commissioni: {} },
  ref: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "referente" } },
  comp: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "componente" } },
  altro: { festa: "f2", ruoloFesta: "membro", commissioni: {} },
  spento: { festa: "f1", ruoloFesta: "admin", commissioni: { c1: "referente" }, attivo: false },
};

function festaDoc(nome: string, stato: Festa["stato"] = "preparazione") {
  return { nome, slug: nome, stato, categorieSpesa: ["Altro"], ...audit };
}

async function seed(statoF1: Festa["stato"] = "preparazione") {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "feste/f1"), festaDoc("festa-uno", statoF1));
    await setDoc(doc(db, "feste/f2"), festaDoc("festa-due"));
    const comm = { icona: "music", colore: "blu", ordine: 1, referentiUids: [], componentiUids: [], ...audit };
    await setDoc(doc(db, "feste/f1/commissioni/c1"), { ...comm, nome: "Musica", generale: false });
    await setDoc(doc(db, "feste/f1/commissioni/generale"), { ...comm, nome: "Generale", generale: true });
    await setDoc(doc(db, "feste/f1/storico/s1"), { entita: "membro", entitaId: "ref", azione: "aggiunto", attoreUid: "admin", at: t });
    for (const [uid, m] of Object.entries(membri)) {
      const { festa, ...dati } = m;
      await setDoc(doc(db, `feste/${festa}/membri/${uid}`), {
        uid, nomeVisualizzato: uid, telefono: "3330000000", attivo: true, ...dati, ...audit,
      });
    }
  });
}

const db = (uid: string): Firestore =>
  uid === "super"
    ? env.authenticatedContext("super", { superadmin: true }).firestore()
    : env.authenticatedContext(uid).firestore();

const upd = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });
const nuovaCommissione = (uid: string, extra: Record<string, unknown> = {}) => ({
  nome: "Cucina", icona: "utensils", colore: "giallo", ordine: 2, generale: false,
  referentiUids: [], componentiUids: [],
  createdAt: serverTimestamp(), createdBy: uid, ...upd(uid), ...extra,
});

beforeAll(async () => {
  env = await creaAmbiente();
});
beforeEach(() => seed());
afterAll(() => env.cleanup());

describe("vedere (SPEC 4.7 n.1)", () => {
  it("un membro legge tutto della sua festa e nulla delle altre", async () => {
    const d = db("comp");
    await assertSucceeds(getDoc(doc(d, "feste/f1")));
    await assertSucceeds(getDocs(collection(d, "feste/f1/commissioni")));
    await assertSucceeds(getDocs(collection(d, "feste/f1/membri")));
    await assertSucceeds(getDocs(collection(d, "feste/f1/storico")));
    await assertFails(getDoc(doc(d, "feste/f2")));
    await assertFails(getDocs(collection(d, "feste/f2/membri")));
  });

  it("il superadmin legge tutte le feste", async () => {
    await assertSucceeds(getDocs(collection(db("super"), "feste")));
    await assertSucceeds(getDocs(collection(db("super"), "feste/f2/membri")));
  });

  it("ognuno trova le proprie feste con la query sui membri, non quelle degli altri", async () => {
    const d = db("ref");
    const mie = await assertSucceeds(getDocs(query(collectionGroup(d, "membri"), where("uid", "==", "ref"))));
    expect(mie.size).toBe(1);
    await assertFails(getDocs(query(collectionGroup(d, "membri"), where("uid", "==", "admin"))));
    await assertFails(getDocs(collectionGroup(d, "membri")));
  });
});

describe("disattivati e scritture riservate (SPEC 4.7 n.10, n.12)", () => {
  it("un membro disattivato non legge né scrive nulla", async () => {
    const d = db("spento");
    await assertFails(getDoc(doc(d, "feste/f1")));
    await assertFails(getDocs(collection(d, "feste/f1/commissioni")));
    await assertFails(updateDoc(doc(d, "feste/f1/commissioni/c1"), { descrizione: "x", ...upd("spento") }));
  });

  it("nessun client scrive su membri o storico, nemmeno admin e superadmin", async () => {
    for (const uid of ["admin", "super"]) {
      await assertFails(setDoc(doc(db(uid), "feste/f1/membri/nuovo"), { uid: "nuovo", ruoloFesta: "admin" }));
      await assertFails(updateDoc(doc(db(uid), "feste/f1/membri/comp"), { ruoloFesta: "admin" }));
      await assertFails(addDoc(collection(db(uid), "feste/f1/storico"), { azione: "x" }));
    }
  });

  it("nessun client crea feste", async () => {
    await assertFails(setDoc(doc(db("super"), "feste/f3"), festaDoc("tre")));
  });
});

describe("commissioni (SPEC 4.6)", () => {
  it("le crea solo l'admin, vuote e non Generale", async () => {
    await assertSucceeds(addDoc(collection(db("admin"), "feste/f1/commissioni"), nuovaCommissione("admin")));
    await assertFails(addDoc(collection(db("ref"), "feste/f1/commissioni"), nuovaCommissione("ref")));
    await assertFails(addDoc(collection(db("admin"), "feste/f1/commissioni"), nuovaCommissione("admin", { generale: true })));
    await assertFails(
      addDoc(collection(db("admin"), "feste/f1/commissioni"), nuovaCommissione("admin", { referentiUids: ["comp"] })),
    );
    await assertFails(addDoc(collection(db("admin"), "feste/f1/commissioni"), nuovaCommissione("admin", { colore: "fucsia" })));
  });

  it("l'admin modifica tutto tranne i membri denormalizzati e il nome di Generale", async () => {
    const d = db("admin");
    await assertSucceeds(updateDoc(doc(d, "feste/f1/commissioni/c1"), { nome: "Musica e balli", budgetCents: 50000, ...upd("admin") }));
    await assertFails(updateDoc(doc(d, "feste/f1/commissioni/c1"), { referentiUids: ["admin"], ...upd("admin") }));
    await assertFails(updateDoc(doc(d, "feste/f1/commissioni/generale"), { nome: "Tutto", ...upd("admin") }));
    await assertSucceeds(updateDoc(doc(d, "feste/f1/commissioni/generale"), { descrizione: "Spese comuni", ...upd("admin") }));
  });

  it("il referente modifica solo la descrizione della sua commissione", async () => {
    const d = db("ref");
    await assertSucceeds(updateDoc(doc(d, "feste/f1/commissioni/c1"), { descrizione: "Palco e luci", ...upd("ref") }));
    await assertFails(updateDoc(doc(d, "feste/f1/commissioni/c1"), { nome: "Altro", ...upd("ref") }));
    await assertFails(updateDoc(doc(d, "feste/f1/commissioni/generale"), { descrizione: "x", ...upd("ref") }));
  });

  it("il componente non modifica la commissione", async () => {
    await assertFails(updateDoc(doc(db("comp"), "feste/f1/commissioni/c1"), { descrizione: "x", ...upd("comp") }));
  });

  it("chi scrive deve firmare la modifica con sé stesso", async () => {
    await assertFails(updateDoc(doc(db("ref"), "feste/f1/commissioni/c1"), { descrizione: "x", ...upd("admin") }));
  });
});

describe("festa (SPEC 4.6, 4.7 n.12)", () => {
  it("l'admin modifica i dati ma non archivia; il superadmin archivia", async () => {
    await assertSucceeds(updateDoc(doc(db("admin"), "feste/f1"), { luogo: "Piazza", ...upd("admin") }));
    await assertFails(updateDoc(doc(db("admin"), "feste/f1"), { stato: "archiviata", ...upd("admin") }));
    await assertFails(updateDoc(doc(db("admin"), "feste/f1"), { slug: "altro", ...upd("admin") }));
    await assertFails(updateDoc(doc(db("ref"), "feste/f1"), { luogo: "Piazza", ...upd("ref") }));
    await assertSucceeds(updateDoc(doc(db("super"), "feste/f1"), { stato: "archiviata", ...upd("super") }));
  });

  it("festa archiviata: zero scritture, tranne il superadmin", async () => {
    await seed("archiviata");
    await assertSucceeds(getDoc(doc(db("comp"), "feste/f1")));
    await assertFails(updateDoc(doc(db("admin"), "feste/f1"), { luogo: "Piazza", ...upd("admin") }));
    await assertFails(addDoc(collection(db("admin"), "feste/f1/commissioni"), nuovaCommissione("admin")));
    await assertFails(updateDoc(doc(db("ref"), "feste/f1/commissioni/c1"), { descrizione: "x", ...upd("ref") }));
    await assertSucceeds(updateDoc(doc(db("super"), "feste/f1/commissioni/c1"), { descrizione: "x", ...upd("super") }));
    await assertSucceeds(updateDoc(doc(db("super"), "feste/f1"), { stato: "conclusa", ...upd("super") }));
  });
});

// lib/permissions.ts deve dare gli stessi risultati delle regole (SPEC 3).
describe("permissions.ts coincide con le regole", () => {
  const attori = ["admin", "ref", "comp", "altro", "spento", "super"];

  function io(uid: string): perm.Io {
    const m = membri[uid];
    const membro =
      m && m.festa === "f1" ? ({ uid, attivo: true, ...m } as unknown as Membro) : undefined;
    return { uid, superadmin: uid === "super", membro };
  }

  async function esito(p: Promise<unknown>) {
    try {
      await p;
      return true;
    } catch {
      return false;
    }
  }

  for (const stato of ["preparazione", "archiviata"] as const) {
    it(`festa in stato ${stato}`, async () => {
      await seed(stato);
      const festa = { stato };
      for (const uid of attori) {
        const d = db(uid);
        const chi = io(uid);
        const casi: [string, boolean, () => Promise<unknown>][] = [
          ["crea commissione", perm.puoCreareCommissione(chi, festa),
            () => addDoc(collection(d, "feste/f1/commissioni"), nuovaCommissione(uid))],
          ["rinomina commissione", perm.modificaCommissione(chi, festa, "c1") === "tutto",
            () => updateDoc(doc(d, "feste/f1/commissioni/c1"), { nome: `Musica ${uid}`, ...upd(uid) })],
          ["descrizione commissione", perm.modificaCommissione(chi, festa, "c1") !== null,
            () => updateDoc(doc(d, "feste/f1/commissioni/c1"), { descrizione: uid, ...upd(uid) })],
          ["modifica festa", perm.puoModificareFesta(chi, festa),
            () => updateDoc(doc(d, "feste/f1"), { luogo: uid, ...upd(uid) })],
        ];
        for (const [nome, atteso, op] of casi) {
          expect(await esito(op()), `${uid}: ${nome}`).toBe(atteso);
        }
      }
    });
  }
});
