import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { creaAmbiente } from "./setup";
import * as perm from "@/lib/permissions";
import type { Festa, Membro, Movimento } from "@/lib/schemas";

let env: RulesTestEnvironment;
const t = Timestamp.now();
const audit = { createdAt: t, createdBy: "seed", updatedAt: t, updatedBy: "seed" };

const membri: Record<string, Partial<Membro> & { festa: string }> = {
  admin: { festa: "f1", ruoloFesta: "admin", commissioni: {} },
  ref: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "referente" } },
  comp: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "componente" } },
  cucina: { festa: "f1", ruoloFesta: "membro", commissioni: { c2: "componente" } },
  spento: { festa: "f1", ruoloFesta: "admin", commissioni: {}, attivo: false },
  altro: { festa: "f2", ruoloFesta: "membro", commissioni: {} },
};

type SpesaSeed = Pick<Movimento, "commissioneId" | "stato" | "createdBy"> & { rimborsoId?: string };
const spese: Record<string, SpesaSeed> = {
  attesa: { commissioneId: "c1", stato: "in_attesa", createdBy: "comp" },
  rifiutata: { commissioneId: "c1", stato: "rifiutata", createdBy: "comp" },
  approvata: { commissioneId: "c1", stato: "approvata", createdBy: "comp" },
  rimborsata: { commissioneId: "c1", stato: "rimborsata", createdBy: "comp", rimborsoId: "r1" },
};

const spesaDoc = (s: SpesaSeed) => ({
  tipo: "spesa", descrizione: "Corde", importoCents: 2550, categoria: "Altro", dataSpesa: t,
  pagatoDa: { tipo: "anticipata", beneficiarioUid: s.createdBy }, scontrini: [], eliminato: false, ...audit, ...s,
});

async function seed(statoF1: Festa["stato"] = "preparazione") {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const festa = (nome: string, stato: Festa["stato"]) => ({ nome, slug: nome, stato, categorieSpesa: ["Altro", "Cibo"], ...audit });
    await setDoc(doc(db, "feste/f1"), festa("uno", statoF1));
    await setDoc(doc(db, "feste/f2"), festa("due", "preparazione"));
    const comm = { icona: "music", colore: "blu", ordine: 1, referentiUids: [], componentiUids: [], generale: false, ...audit };
    await setDoc(doc(db, "feste/f1/commissioni/c1"), { ...comm, nome: "Musica" });
    await setDoc(doc(db, "feste/f1/commissioni/c2"), { ...comm, nome: "Cucina" });
    await setDoc(doc(db, "feste/f1/commissioni/generale"), { ...comm, nome: "Generale", generale: true });
    for (const [uid, m] of Object.entries(membri)) {
      const { festa: f, ...dati } = m;
      await setDoc(doc(db, `feste/${f}/membri/${uid}`), { uid, nomeVisualizzato: uid, telefono: "3330000000", attivo: true, ...dati, ...audit });
    }
    for (const [id, s] of Object.entries(spese)) await setDoc(doc(db, `feste/f1/movimenti/${id}`), spesaDoc(s));
    await setDoc(doc(db, "feste/f1/rimborsi/r1"), { beneficiarioNome: "comp", movimentiIds: ["rimborsata"], totaleCents: 2550, modalita: "contanti", data: t, ...audit });
  });
}

const db = (uid: string) =>
  uid === "super" ? env.authenticatedContext("super", { superadmin: true }).firestore() : env.authenticatedContext(uid).firestore();
const upd = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });

function nuovaSpesa(uid: string, extra: Record<string, unknown> = {}) {
  return {
    tipo: "spesa", commissioneId: "c1", descrizione: "Prolunghe", importoCents: 1200, categoria: "Altro",
    dataSpesa: Timestamp.now(), pagatoDa: { tipo: "cassa" }, stato: "in_attesa", scontrini: [], eliminato: false,
    createdAt: serverTimestamp(), createdBy: uid, ...upd(uid), ...extra,
  };
}
const crea = (uid: string, extra: Record<string, unknown> = {}) => addDoc(collection(db(uid), "feste/f1/movimenti"), nuovaSpesa(uid, extra));
const modifica = (uid: string, id: string, dati: Record<string, unknown>) =>
  updateDoc(doc(db(uid), `feste/f1/movimenti/${id}`), { ...dati, ...upd(uid) });
const ripristina = (id: string) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `feste/f1/movimenti/${id}`), spesaDoc(spese[id])));

beforeAll(async () => {
  env = await creaAmbiente();
});
beforeEach(() => seed());
afterAll(() => env.cleanup());

describe("inserire spese (SPEC 4.7 n.11)", () => {
  it("un componente inserisce spese sulle sue commissioni e su Generale, non altrove", async () => {
    await assertSucceeds(crea("comp"));
    await assertSucceeds(crea("comp", { commissioneId: "generale" }));
    await assertFails(crea("comp", { commissioneId: "c2" }));
    await assertSucceeds(crea("admin", { commissioneId: "c2" }));
    await assertFails(crea("altro"));
    await assertFails(crea("spento", { commissioneId: "generale" }));
  });

  it("chi ha pagato: cassa, una persona della festa o un nome scritto a mano", async () => {
    await assertSucceeds(crea("comp", { pagatoDa: { tipo: "anticipata", beneficiarioUid: "comp" } }));
    await assertSucceeds(crea("comp", { pagatoDa: { tipo: "anticipata", beneficiarioUid: "cucina" } }));
    await assertSucceeds(crea("comp", { pagatoDa: { tipo: "anticipata", beneficiarioNome: "Zio Peppe" } }));
    await assertFails(crea("comp", { pagatoDa: { tipo: "anticipata", beneficiarioUid: "altro" } }));
    await assertFails(crea("comp", { pagatoDa: { tipo: "anticipata", beneficiarioUid: "spento" } }));
    await assertFails(crea("comp", { pagatoDa: { tipo: "anticipata" } }));
    await assertFails(crea("comp", { pagatoDa: { tipo: "cassa", beneficiarioNome: "x" } }));
  });

  it("dati non validi vengono rifiutati", async () => {
    await assertFails(crea("comp", { importoCents: 0 }));
    await assertFails(crea("comp", { importoCents: 12.5 }));
    await assertFails(crea("comp", { categoria: "Inventata" }));
    await assertFails(crea("comp", { tipo: "entrata" }));
    await assertFails(crea("comp", { createdBy: "admin" }));
    await assertFails(crea("comp", { eliminato: true }));
  });
});

describe("stato dei movimenti solo dalle Functions (SPEC 4.7 n.10)", () => {
  it("nessun client crea spese già approvate o con campi di approvazione", async () => {
    for (const uid of ["comp", "admin", "super"]) {
      await assertFails(crea(uid, { stato: "approvata" }));
      await assertFails(crea(uid, { approvatoDa: uid }));
      await assertFails(crea(uid, { rimborsoId: "r9" }));
    }
  });

  it("nessun client cambia stato, approvazione o rimborso, nemmeno admin e superadmin", async () => {
    for (const uid of ["comp", "admin", "super"]) {
      await assertFails(modifica(uid, "attesa", { stato: "approvata" }));
      await assertFails(modifica(uid, "attesa", { approvatoDa: uid }));
      await assertFails(modifica(uid, "rifiutata", { stato: "in_attesa" }));
      await assertFails(modifica(uid, "approvata", { rimborsoId: "r9" }));
    }
  });

  it("nessun client scrive i rimborsi", async () => {
    await assertFails(setDoc(doc(db("admin"), "feste/f1/rimborsi/r2"), { totaleCents: 1 }));
    await assertFails(updateDoc(doc(db("super"), "feste/f1/rimborsi/r1"), { totaleCents: 1 }));
    await assertSucceeds(getDocs(collection(db("comp"), "feste/f1/rimborsi")));
  });
});

describe("modificare prima dell'approvazione (SPEC 4.5)", () => {
  it("autore, referenti e admin modificano o ritirano una spesa in attesa o rifiutata", async () => {
    await assertSucceeds(modifica("comp", "attesa", { importoCents: 3000 }));
    await assertSucceeds(modifica("ref", "attesa", { descrizione: "Corde nuove" }));
    await assertSucceeds(modifica("admin", "rifiutata", { categoria: "Cibo" }));
    await assertSucceeds(modifica("comp", "rifiutata", { eliminato: true }));
    await assertFails(modifica("cucina", "attesa", { importoCents: 1 }));
  });

  it("dopo l'approvazione nessuno la modifica dal client", async () => {
    await assertFails(modifica("comp", "approvata", { importoCents: 1 }));
    await assertFails(modifica("admin", "approvata", { eliminato: true }));
    await assertFails(modifica("admin", "rimborsata", { descrizione: "x" }));
  });

  it("l'autore non sposta la spesa su una commissione di cui non fa parte", async () => {
    await assertSucceeds(modifica("comp", "attesa", { commissioneId: "generale" }));
    await seed();
    await assertFails(modifica("comp", "attesa", { commissioneId: "c2" }));
  });

  it("festa archiviata: nessuna scrittura tranne il superadmin", async () => {
    await seed("archiviata");
    await assertFails(crea("admin"));
    await assertFails(modifica("comp", "attesa", { importoCents: 1 }));
    await assertSucceeds(crea("super"));
  });
});

describe("permissions.ts coincide con le regole sulle spese", () => {
  const attori = ["admin", "ref", "comp", "cucina", "spento", "altro", "super"];
  const tutti = Object.entries(membri)
    .filter(([, m]) => m.festa === "f1")
    .map(([uid, m]) => ({ uid, attivo: true, ...m }) as unknown as Membro);
  const io = (uid: string): perm.Io => ({ uid, superadmin: uid === "super", membro: tutti.find((m) => m.uid === uid) });
  const commissioni = [{ id: "c1", generale: false }, { id: "c2", generale: false }, { id: "generale", generale: true }];

  async function esito(p: () => Promise<unknown>) {
    try {
      await p();
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
        for (const c of commissioni) {
          expect(await esito(() => crea(uid, { commissioneId: c.id })), `${uid} spende in ${c.id}`).toBe(perm.puoInserireSpesa(io(uid), festa, c));
        }
        for (const [id, s] of Object.entries(spese)) {
          const m = { ...s, tipo: "spesa" as const, pagatoDa: { tipo: "anticipata" as const, beneficiarioUid: s.createdBy } };
          const ok = await esito(() => modifica(uid, id, { descrizione: `da ${uid}` }));
          expect(ok, `${uid} modifica ${id}`).toBe(perm.puoModificareSpesa(io(uid), festa, m));
          if (ok) await ripristina(id);
        }
      }
    });
  }
});
