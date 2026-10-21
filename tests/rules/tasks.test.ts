import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { creaAmbiente } from "./setup";
import * as perm from "@/lib/permissions";
import type { Festa, Membro, Task } from "@/lib/schemas";

let env: RulesTestEnvironment;
const t = Timestamp.now();
const audit = { createdAt: t, createdBy: "seed", updatedAt: t, updatedBy: "seed" };

// c1 = Musica, c2 = Cucina. "cucina" e "refcucina" non fanno parte di Musica.
const membri: Record<string, Partial<Membro> & { festa: string }> = {
  admin: { festa: "f1", ruoloFesta: "admin", commissioni: {} },
  ref: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "referente" } },
  ref2: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "referente" } },
  comp: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "componente" } },
  comp2: { festa: "f1", ruoloFesta: "membro", commissioni: { c1: "componente" } },
  cucina: { festa: "f1", ruoloFesta: "membro", commissioni: { c2: "componente" } },
  refcucina: { festa: "f1", ruoloFesta: "membro", commissioni: { c2: "referente" } },
  spento: { festa: "f1", ruoloFesta: "admin", commissioni: { c1: "referente" }, attivo: false },
  altro: { festa: "f2", ruoloFesta: "membro", commissioni: {} },
};

type TaskSeed = Pick<Task, "commissioneId" | "responsabileUid" | "stato" | "createdBy"> & { richiestoDa?: string };

// Task di partenza: chi l'ha creato, a chi è assegnato, in che stato.
const tasks: Record<string, TaskSeed> = {
  daRef: { commissioneId: "c1", responsabileUid: "comp", stato: "da_fare", createdBy: "ref" },
  proprio: { commissioneId: "c1", responsabileUid: "comp", stato: "da_fare", createdBy: "comp" },
  dato: { commissioneId: "c1", responsabileUid: "comp2", stato: "da_fare", createdBy: "comp" },
  datoInCorso: { commissioneId: "c1", responsabileUid: "comp2", stato: "in_corso", createdBy: "comp" },
  fatto: { commissioneId: "c1", responsabileUid: "comp", stato: "fatto", createdBy: "ref" },
  richiesta: { commissioneId: "c1", responsabileUid: null, stato: "richiesta", createdBy: "cucina", richiestoDa: "cucina" },
};

function taskDoc(s: TaskSeed) {
  return {
    titolo: "Montare il palco", priorita: "normale", checklist: [], link: [], eliminato: false,
    ...audit, ...s,
  };
}

async function seed(statoF1: Festa["stato"] = "preparazione") {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const festa = (nome: string, stato: Festa["stato"]) => ({ nome, slug: nome, stato, categorieSpesa: ["Altro"], ...audit });
    await setDoc(doc(db, "feste/f1"), festa("festa-uno", statoF1));
    await setDoc(doc(db, "feste/f2"), festa("festa-due", "preparazione"));
    const comm = { icona: "music", colore: "blu", ordine: 1, referentiUids: [], componentiUids: [], generale: false, ...audit };
    await setDoc(doc(db, "feste/f1/commissioni/c1"), { ...comm, nome: "Musica" });
    await setDoc(doc(db, "feste/f1/commissioni/c2"), { ...comm, nome: "Cucina" });
    await setDoc(doc(db, "feste/f1/commissioni/generale"), { ...comm, nome: "Generale", generale: true });
    for (const [uid, m] of Object.entries(membri)) {
      const { festa: f, ...dati } = m;
      await setDoc(doc(db, `feste/${f}/membri/${uid}`), {
        uid, nomeVisualizzato: uid, telefono: "3330000000", attivo: true, ...dati, ...audit,
      });
    }
    for (const [id, s] of Object.entries(tasks)) await setDoc(doc(db, `feste/f1/tasks/${id}`), taskDoc(s));
    const vecchio = Timestamp.fromMillis(Date.now() - 20 * 60_000);
    await setDoc(doc(db, "feste/f1/tasks/daRef/commenti/vecchio"), { testo: "Ciao", autoreUid: "comp", createdAt: vecchio });
    await setDoc(doc(db, "feste/f1/tasks/daRef/commenti/nuovo"), { testo: "Ciao", autoreUid: "comp", createdAt: Timestamp.now() });
    await setDoc(doc(db, "feste/f1/tasks/daRef/allegati/a0"), {
      nome: "foto.png", mime: "image/png", path: "feste/f1/tasks/daRef/a0", createdAt: t, createdBy: "comp",
    });
    await ctx.storage().ref("feste/f1/tasks/daRef/a0").put(new Uint8Array([1, 2, 3]), { contentType: "image/png" });
  });
}

/** Rimette il task com'era dopo una modifica riuscita. */
const ripristina = (id: string) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `feste/f1/tasks/${id}`), taskDoc(tasks[id])));

const db = (uid: string) =>
  uid === "super"
    ? env.authenticatedContext("super", { superadmin: true }).firestore()
    : env.authenticatedContext(uid).firestore();
const storage = (uid: string) =>
  uid === "super"
    ? env.authenticatedContext("super", { superadmin: true }).storage()
    : env.authenticatedContext(uid).storage();

const upd = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });

function nuovoTask(uid: string, extra: Record<string, unknown> = {}) {
  return {
    titolo: "Comprare le luci", commissioneId: "c1", responsabileUid: uid, stato: "da_fare",
    priorita: "normale", checklist: [], link: [], eliminato: false,
    createdAt: serverTimestamp(), createdBy: uid, ...upd(uid), ...extra,
  };
}
const crea = (uid: string, extra: Record<string, unknown> = {}) =>
  addDoc(collection(db(uid), "feste/f1/tasks"), nuovoTask(uid, extra));
const richiesta = (uid: string, extra: Record<string, unknown> = {}) =>
  crea(uid, { stato: "richiesta", responsabileUid: null, richiestoDa: uid, ...extra });
const modifica = (uid: string, id: string, dati: Record<string, unknown>) =>
  updateDoc(doc(db(uid), `feste/f1/tasks/${id}`), { ...dati, ...upd(uid) });

beforeAll(async () => {
  env = await creaAmbiente();
});
beforeEach(() => seed());
afterAll(() => env.cleanup());

describe("creare e assegnare (SPEC 4.7 n.2, n.3)", () => {
  it("un componente di A assegna a un altro componente di A, non a un referente di A né in B", async () => {
    await assertSucceeds(crea("comp", { responsabileUid: "comp2" }));
    await assertSucceeds(crea("comp"));
    await assertFails(crea("comp", { responsabileUid: "ref" }));
    await assertFails(crea("comp", { commissioneId: "c2", responsabileUid: "cucina" }));
    await assertFails(crea("comp", { responsabileUid: null }));
  });

  it("un referente di A assegna a co-referenti e componenti di A, non fuori da A", async () => {
    await assertSucceeds(crea("ref", { responsabileUid: "ref2" }));
    await assertSucceeds(crea("ref", { responsabileUid: "comp" }));
    await assertSucceeds(crea("ref", { responsabileUid: null }));
    await assertFails(crea("ref", { responsabileUid: "cucina" }));
    await assertFails(crea("ref", { commissioneId: "c2", responsabileUid: "cucina" }));
  });

  it("l'admin crea ovunque e assegna a chiunque della festa, non a chi è fuori o disattivato", async () => {
    await assertSucceeds(crea("admin", { commissioneId: "generale", responsabileUid: "cucina" }));
    await assertSucceeds(crea("admin", { commissioneId: "c2", responsabileUid: null }));
    await assertFails(crea("admin", { responsabileUid: "altro" }));
    await assertFails(crea("admin", { responsabileUid: "spento" }));
    await assertFails(crea("admin", { commissioneId: "inesistente" }));
  });

  it("dati non validi o firmati da altri vengono rifiutati", async () => {
    await assertFails(crea("ref", { createdBy: "admin" }));
    await assertFails(crea("ref", { stato: "in_corso" }));
    await assertFails(crea("ref", { titolo: "" }));
    await assertFails(crea("ref", { extra: true }));
    await assertFails(crea("ref", { priorita: "altissima" }));
    await assertFails(crea("ref", { eliminato: true }));
  });
});

describe("modificare (SPEC 4.7 n.4, n.5, n.6)", () => {
  it("nessuno modifica un task di altri senza esserne referente o admin", async () => {
    await assertFails(modifica("comp2", "daRef", { titolo: "Altro" }));
    await assertFails(modifica("cucina", "daRef", { titolo: "Altro" }));
    await assertFails(modifica("refcucina", "daRef", { stato: "in_corso" }));
    await assertSucceeds(modifica("ref", "daRef", { titolo: "Altro", responsabileUid: "comp2" }));
    await assertSucceeds(modifica("admin", "daRef", { commissioneId: "c2", responsabileUid: "cucina" }));
  });

  it("il referente non sposta il task e non lo assegna fuori dalla commissione", async () => {
    await assertFails(modifica("ref", "daRef", { commissioneId: "c2" }));
    await assertFails(modifica("ref", "daRef", { responsabileUid: "cucina" }));
    await assertSucceeds(modifica("ref", "daRef", { responsabileUid: null }));
  });

  it("il responsabile cambia lo stato, ma non il responsabile né la commissione", async () => {
    await assertSucceeds(modifica("comp", "daRef", { stato: "in_corso" }));
    await assertSucceeds(modifica("comp", "daRef", { stato: "bloccato", motivoBlocco: "Manca il furgone" }));
    await assertSucceeds(modifica("comp", "daRef", { checklist: [{ id: "1", testo: "Viti", fatto: true }] }));
    await assertFails(modifica("comp", "daRef", { responsabileUid: "comp2" }));
    await assertFails(modifica("comp", "daRef", { commissioneId: "c2" }));
    await assertFails(modifica("comp", "daRef", { titolo: "Altro" }));
    await assertFails(modifica("comp", "daRef", { stato: "annullato" }));
  });

  it("chi si è dato un task da solo ne modifica anche i dati", async () => {
    await assertSucceeds(modifica("comp", "proprio", { titolo: "Altro", priorita: "urgente" }));
    await assertSucceeds(modifica("comp", "proprio", { stato: "annullato" }));
  });

  it("un task fatto lo riapre il responsabile", async () => {
    await assertSucceeds(modifica("comp", "fatto", { stato: "in_corso" }));
  });

  it("il creatore modifica un task 'Da fare' ma non uno 'In corso'", async () => {
    await assertSucceeds(modifica("comp", "dato", { titolo: "Altro" }));
    await assertSucceeds(modifica("comp", "dato", { stato: "annullato" }));
    await assertFails(modifica("comp", "dato", { responsabileUid: "comp" }));
    await assertFails(modifica("comp", "datoInCorso", { titolo: "Altro" }));
    await assertFails(modifica("comp", "datoInCorso", { stato: "annullato" }));
  });

  it("un task iniziato deve avere un responsabile; creatore e richiedente restano quelli", async () => {
    await assertFails(modifica("admin", "daRef", { stato: "in_corso", responsabileUid: null }));
    await assertFails(modifica("admin", "daRef", { createdBy: "admin" }));
    await assertFails(modifica("admin", "richiesta", { richiestoDa: "admin" }));
  });
});

describe("richieste tra commissioni (SPEC 4.7 n.7)", () => {
  it("la invia chiunque a una commissione di cui non fa parte (l'admin crea direttamente il task)", async () => {
    await assertSucceeds(richiesta("cucina"));
    await assertFails(richiesta("admin"));
    await assertFails(richiesta("comp"));
    await assertFails(richiesta("cucina", { richiestoDa: "comp" }));
    await assertFails(richiesta("cucina", { responsabileUid: "comp" }));
    await assertFails(richiesta("altro"));
  });

  it("la accetta solo un referente o un admin della commissione destinataria", async () => {
    const accetta = { stato: "da_fare", responsabileUid: "comp" };
    await assertFails(modifica("cucina", "richiesta", accetta));
    await assertFails(modifica("comp", "richiesta", accetta));
    await assertFails(modifica("refcucina", "richiesta", accetta));
    await assertSucceeds(modifica("ref", "richiesta", accetta));
    await seed();
    await assertSucceeds(modifica("admin", "richiesta", accetta));
  });

  it("il referente la rifiuta con un motivo", async () => {
    await assertSucceeds(modifica("ref", "richiesta", { stato: "annullato", motivoRifiuto: "Non abbiamo tempo" }));
  });

  it("il richiedente la modifica o la ritira finché è in richiesta", async () => {
    await assertSucceeds(modifica("cucina", "richiesta", { titolo: "Servono due casse" }));
    await assertFails(modifica("cucina", "richiesta", { commissioneId: "c2" }));
    await assertSucceeds(modifica("cucina", "richiesta", { stato: "annullato" }));
    await seed();
    await modifica("ref", "richiesta", { stato: "da_fare", responsabileUid: "comp" });
    await assertFails(modifica("cucina", "richiesta", { titolo: "Altro" }));
  });
});

describe("disattivati e festa archiviata (SPEC 4.7 n.12)", () => {
  it("un membro disattivato non legge né scrive task", async () => {
    await assertFails(getDocs(collection(db("spento"), "feste/f1/tasks")));
    await assertFails(crea("spento", { responsabileUid: null }));
    await assertFails(getDocs(collection(db("altro"), "feste/f1/tasks")));
  });

  it("festa archiviata: nessuna scrittura tranne il superadmin", async () => {
    await seed("archiviata");
    await assertSucceeds(getDocs(collection(db("comp"), "feste/f1/tasks")));
    await assertFails(crea("admin"));
    await assertFails(modifica("comp", "daRef", { stato: "in_corso" }));
    await assertFails(addDoc(collection(db("comp"), "feste/f1/tasks/daRef/commenti"), commento("comp")));
    await assertSucceeds(modifica("super", "daRef", { stato: "in_corso" }));
  });
});

function commento(uid: string, extra: Record<string, unknown> = {}) {
  return { testo: "Ci penso io", autoreUid: uid, createdAt: serverTimestamp(), ...extra };
}
const modificaCommento = (uid: string, id: string) =>
  updateDoc(doc(db(uid), `feste/f1/tasks/daRef/commenti/${id}`), { testo: "Corretto", modificatoAt: serverTimestamp() });

describe("commenti (SPEC 4.6)", () => {
  it("li scrive chiunque nella festa, a proprio nome", async () => {
    await assertSucceeds(addDoc(collection(db("cucina"), "feste/f1/tasks/daRef/commenti"), commento("cucina")));
    await assertFails(addDoc(collection(db("cucina"), "feste/f1/tasks/daRef/commenti"), commento("comp")));
    await assertFails(addDoc(collection(db("altro"), "feste/f1/tasks/daRef/commenti"), commento("altro")));
  });

  it("l'autore li modifica entro 15 minuti, referenti e admin sempre", async () => {
    await assertSucceeds(modificaCommento("comp", "nuovo"));
    await assertFails(modificaCommento("comp", "vecchio"));
    await assertFails(modificaCommento("comp2", "nuovo"));
    await assertSucceeds(modificaCommento("ref", "vecchio"));
    await assertSucceeds(modificaCommento("admin", "vecchio"));
  });
});

function allegato(uid: string, id: string, extra: Record<string, unknown> = {}) {
  return setDoc(doc(db(uid), `feste/f1/tasks/daRef/allegati/${id}`), {
    nome: "preventivo.pdf", mime: "application/pdf", path: `feste/f1/tasks/daRef/${id}`,
    createdAt: serverTimestamp(), createdBy: uid, ...extra,
  });
}
const carica = (uid: string, id: string, contentType = "image/png") =>
  storage(uid).ref(`feste/f1/tasks/daRef/${id}`).put(new Uint8Array([1, 2, 3]), { contentType }).then(() => undefined);

describe("allegati (Firestore e Storage)", () => {
  it("li aggiungono responsabile, referenti e admin, nel percorso del task", async () => {
    await assertSucceeds(allegato("comp", "a1"));
    await assertSucceeds(allegato("ref", "a2"));
    await assertSucceeds(allegato("admin", "a3"));
    await assertFails(allegato("comp2", "a4"));
    await assertFails(allegato("comp", "a5", { path: "feste/f1/tasks/altro/a5" }));
    await assertSucceeds(deleteDoc(doc(db("ref"), "feste/f1/tasks/daRef/allegati/a0")));
  });

  it("Storage: carica chi può allegare, solo foto e PDF; la festa li vede", async () => {
    await assertSucceeds(carica("comp", "s1"));
    await assertSucceeds(carica("ref", "s2", "application/pdf"));
    await assertFails(carica("comp2", "s3"));
    await assertFails(carica("comp", "s4", "text/html"));
    await assertFails(carica("altro", "s5"));
    await assertSucceeds(storage("cucina").ref("feste/f1/tasks/daRef/a0").getMetadata());
    await assertFails(storage("altro").ref("feste/f1/tasks/daRef/a0").getMetadata());
    await assertFails(storage("spento").ref("feste/f1/tasks/daRef/a0").getMetadata());
    await assertFails(storage("comp2").ref("feste/f1/tasks/daRef/a0").delete());
    await assertSucceeds(storage("comp").ref("feste/f1/tasks/daRef/a0").delete());
  });
});

// lib/permissions.ts deve dare gli stessi risultati delle regole (SPEC 3).
describe("permissions.ts coincide con le regole sui task", () => {
  const attori = ["admin", "ref", "comp", "comp2", "cucina", "spento", "altro", "super"];
  const tutti = Object.entries(membri)
    .filter(([, m]) => m.festa === "f1")
    .map(([uid, m]) => ({ uid, attivo: true, ...m }) as unknown as Membro);

  function io(uid: string): perm.Io {
    return { uid, superadmin: uid === "super", membro: tutti.find((m) => m.uid === uid) };
  }

  async function esito(p: () => Promise<unknown>) {
    try {
      await p();
      return true;
    } catch {
      return false;
    }
  }

  it("creare: commissioni e persone assegnabili", async () => {
    const festa = { stato: "preparazione" } as const;
    for (const uid of attori) {
      for (const comm of ["c1", "c2", "generale"]) {
        const tipo = perm.creazioneTask(io(uid), festa, comm);
        const { persone, daAssegnare } = perm.assegnabili(io(uid), tutti, comm);
        for (const resp of ["comp2", "ref2", "cucina", "spento", null]) {
          const atteso = tipo === "task" && (resp === null ? daAssegnare : persone.some((p) => p.uid === resp));
          expect(await esito(() => crea(uid, { commissioneId: comm, responsabileUid: resp })), `${uid} crea in ${comm} per ${resp}`)
            .toBe(atteso);
        }
        expect(await esito(() => richiesta(uid, { commissioneId: comm })), `${uid} chiede a ${comm}`).toBe(tipo === "richiesta");
      }
    }
  });

  for (const stato of ["preparazione", "archiviata"] as const) {
    it(`modificare, festa in stato ${stato}`, async () => {
      const festa = { stato };
      const ops: [string, (p: perm.PermessiTask) => boolean, Record<string, unknown>, boolean][] = [
        // nome, permesso atteso, modifica, vale anche per le richieste (senza responsabile)
        ["titolo", (p) => p.dati, { titolo: "Nuovo titolo" }, true],
        ["checklist", (p) => p.lavoro, { checklist: [{ id: "1", testo: "Viti", fatto: false }] }, true],
        ["annulla", (p) => p.stati.includes("annullato"), { stato: "annullato" }, true],
        ["sposta", (p) => p.spostaCommissione, { commissioneId: "c2" }, true],
        ["fatto", (p) => p.stati.includes("fatto"), { stato: "fatto" }, false],
        ["in corso", (p) => p.stati.includes("in_corso"), { stato: "in_corso" }, false],
        ["riassegna", (p) => p.gestisce, { responsabileUid: "ref2" }, false],
      ];
      await seed(stato);
      for (const [id, s] of Object.entries(tasks)) {
        for (const [nome, permesso, dati, ancheRichiesta] of ops) {
          if (s.stato === "richiesta" && !ancheRichiesta) continue;
          if (s.stato === "in_corso" && nome === "in corso") continue;
          if (s.stato === "fatto" && nome === "fatto") continue;
          for (const uid of attori) {
            const p = perm.permessiTask(io(uid), festa, s);
            expect(await esito(() => modifica(uid, id, dati)), `${uid}: ${nome} su ${id}`).toBe(permesso(p));
            if (permesso(p)) await ripristina(id);
          }
        }
      }
    }, 600_000);
  }

  it("commenti e allegati", async () => {
    const festa = { stato: "preparazione" } as const;
    const daRef = tasks.daRef;
    const commenti = {
      vecchio: { autoreUid: "comp", createdAt: Timestamp.fromMillis(Date.now() - 20 * 60_000) },
      nuovo: { autoreUid: "comp", createdAt: Timestamp.now() },
    };
    for (const uid of attori) {
      for (const [id, c] of Object.entries(commenti)) {
        expect(await esito(() => modificaCommento(uid, id)), `${uid}: modifica commento ${id}`)
          .toBe(perm.puoModificareCommento(io(uid), festa, daRef, c));
      }
      expect(await esito(() => addDoc(collection(db(uid), "feste/f1/tasks/daRef/commenti"), commento(uid))), `${uid}: commenta`)
        .toBe(perm.puoCommentare(io(uid), festa));
      expect(await esito(() => allegato(uid, `a-${uid}`)), `${uid}: allega`).toBe(perm.permessiTask(io(uid), festa, daRef).allegati);
    }
  });
});
