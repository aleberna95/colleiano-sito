import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { creaAmbiente } from "./setup";
import * as perm from "@/lib/permissions";
import type { Festa, Membro } from "@/lib/schemas";

let env: RulesTestEnvironment;
const t = Timestamp.now();
const audit = { createdAt: t, createdBy: "seed", updatedAt: t, updatedBy: "seed" };

const membri: Record<string, Partial<Membro>> = {
  admin: { ruoloFesta: "admin", commissioni: {} },
  ref: { ruoloFesta: "membro", commissioni: { c1: "referente" } },
};

const config = (extra: Record<string, unknown> = {}) => ({
  chiSiamo: "Un paese che fa festa.", comeArrivare: "Da Ascoli, seguire per Colleiano.",
  indirizzo: "Piazza di Colleiano", linkMappe: "https://maps.google.com/?q=Colleiano",
  faq: [{ domanda: "Si paga?", risposta: "No." }],
  updatedAt: serverTimestamp(), updatedBy: "super", ...extra,
});

const pubblica = (f: string, extra: Record<string, unknown> = {}) => ({
  nome: f, slug: f, modalitaFesta: false, inArchivioPubblico: false, paginaPubblica: { galleria: [] }, ...extra,
});

async function seed(statoF1: Festa["stato"] = "preparazione") {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const f of ["f1", "f2", "f3"]) {
      await setDoc(doc(db, `feste/${f}`), { nome: f, slug: f, stato: f === "f1" ? statoF1 : "archiviata", categorieSpesa: ["Altro"], ...audit });
    }
    await setDoc(doc(db, "sitoFeste/f1"), pubblica("f1"));
    await setDoc(doc(db, "sitoFeste/f2"), pubblica("f2", { inArchivioPubblico: true }));
    await setDoc(doc(db, "sitoFeste/f3"), pubblica("f3"));
    await setDoc(doc(db, "sito/config"), { ...config(), festaInEvidenzaId: "f1", updatedAt: t });
    for (const f of ["f1", "f2", "f3"]) {
      await setDoc(doc(db, `feste/${f}/programma/e1`), { titolo: "Messa", inizio: t, ordine: 0, ...audit });
      await setDoc(doc(db, `feste/${f}/mappa/config`), { immagine: { url: "https://example.com/m.webp", larghezza: 2000, altezza: 1000 }, updatedAt: t, updatedBy: "seed" });
      await setDoc(doc(db, `feste/${f}/mappa/config/punti/p1`), { nome: "Bagni", categoria: "bagni", x: 0.5, y: 0.5, accessibile: true, ...audit });
    }
    for (const [uid, m] of Object.entries(membri)) {
      await setDoc(doc(db, `feste/f1/membri/${uid}`), { uid, nomeVisualizzato: uid, telefono: "3330000000", attivo: true, ...m, ...audit });
    }
  });
}

const contesto = (uid: string | null) =>
  uid === null
    ? env.unauthenticatedContext()
    : uid === "super"
      ? env.authenticatedContext("super", { superadmin: true })
      : env.authenticatedContext(uid);
const db = (uid: string | null) => contesto(uid).firestore();
const carica = (uid: string | null, path: string, contentType = "image/png") =>
  contesto(uid).storage().ref(path).put(new Uint8Array([1, 2, 3]), { contentType }).then(() => undefined);
const upd = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });
const evento = (uid: string, extra: Record<string, unknown> = {}) => ({
  titolo: "Festa a ballo", inizio: Timestamp.fromMillis(t.toMillis() + 3_600_000), ordine: 1,
  createdAt: serverTimestamp(), createdBy: uid, ...upd(uid), ...extra,
});

beforeAll(async () => {
  env = await creaAmbiente();
});
beforeEach(() => seed());
afterAll(() => env.cleanup());

describe("il visitatore (senza login)", () => {
  it("legge i testi del sito e le feste in evidenza o in archivio, nient'altro", async () => {
    const d = db(null);
    await assertSucceeds(getDoc(doc(d, "sito/config")));
    await assertSucceeds(getDoc(doc(d, "sitoFeste/f1")));
    await assertSucceeds(getDoc(doc(d, "sitoFeste/f2")));
    await assertFails(getDoc(doc(d, "sitoFeste/f3")));
    await assertFails(getDoc(doc(d, "feste/f1")));
    await assertFails(getDocs(collection(d, "feste/f1/membri")));
    await assertFails(getDoc(doc(d, "sito/altro")));
  });

  it("elenca le edizioni in archivio ma non tutte le feste", async () => {
    const d = db(null);
    const archivio = await assertSucceeds(getDocs(query(collection(d, "sitoFeste"), where("inArchivioPubblico", "==", true))));
    expect(archivio.docs.map((x) => x.id)).toEqual(["f2"]);
    await assertSucceeds(getDocs(query(collection(d, "sitoFeste"), where("inArchivioPubblico", "==", true), where("slug", "==", "f2"))));
    await assertFails(getDocs(collection(d, "sitoFeste")));
  });

  it("non scrive nulla", async () => {
    const d = db(null);
    await assertFails(setDoc(doc(d, "sito/config"), config()));
    await assertFails(setDoc(doc(d, "sitoFeste/f3"), pubblica("f3", { inArchivioPubblico: true })));
  });

  it("i membri vedono la copia della loro festa anche se non è pubblica (anteprima)", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "sito/config"), { ...config(), updatedAt: t }));
    await assertFails(getDoc(doc(db(null), "sitoFeste/f1")));
    await assertSucceeds(getDoc(doc(db("ref"), "sitoFeste/f1")));
    await assertSucceeds(getDoc(doc(db("super"), "sitoFeste/f3")));
  });
});

describe("sito/config (solo superadmin)", () => {
  it("il superadmin scrive testi e festa in evidenza; nessun altro", async () => {
    await assertSucceeds(setDoc(doc(db("super"), "sito/config"), config({ festaInEvidenzaId: "f2" })));
    await assertFails(setDoc(doc(db("admin"), "sito/config"), config({ updatedBy: "admin" })));
    await assertFails(updateDoc(doc(db("admin"), "sito/config"), { chiSiamo: "x", ...upd("admin") }));
  });

  it("rifiuta una festa in evidenza che non esiste, campi in più e link non validi", async () => {
    const d = db("super");
    await assertFails(setDoc(doc(d, "sito/config"), config({ festaInEvidenzaId: "nessuna" })));
    await assertFails(setDoc(doc(d, "sito/config"), config({ budget: 1 })));
    await assertFails(setDoc(doc(d, "sito/config"), config({ linkMappe: "javascript:alert(1)" })));
    await assertFails(setDoc(doc(d, "sito/altro"), config()));
    await assertSucceeds(setDoc(doc(d, "sito/config"), config({ linkMappe: "" })));
  });

  it("nessun client scrive in sitoFeste, nemmeno il superadmin", async () => {
    await assertFails(updateDoc(doc(db("super"), "sitoFeste/f1"), { nome: "x" }));
    await assertFails(updateDoc(doc(db("admin"), "sitoFeste/f1"), { modalitaFesta: true }));
  });
});

describe("pagina pubblica della festa", () => {
  const pagina = { testo: "La festa del paese.", copertina: "https://example.com/c.webp", galleria: ["https://example.com/1.webp"] };

  it("l'admin cura pagina e modalità festa, ma non mette in archivio", async () => {
    const d = db("admin");
    await assertSucceeds(updateDoc(doc(d, "feste/f1"), { paginaPubblica: pagina, ...upd("admin") }));
    await assertSucceeds(updateDoc(doc(d, "feste/f1"), { modalitaFesta: true, ...upd("admin") }));
    await assertFails(updateDoc(doc(d, "feste/f1"), { inArchivioPubblico: true, ...upd("admin") }));
    await assertFails(updateDoc(doc(d, "feste/f1"), { paginaPubblica: pagina, budgetTotaleCents: 1, ...upd("admin") }));
    await assertFails(updateDoc(doc(db("ref"), "feste/f1"), { paginaPubblica: pagina, ...upd("ref") }));
  });

  it("rifiuta pagine non valide", async () => {
    const d = db("admin");
    await assertFails(updateDoc(doc(d, "feste/f1"), { paginaPubblica: { ...pagina, extra: 1 }, ...upd("admin") }));
    await assertFails(updateDoc(doc(d, "feste/f1"), { paginaPubblica: { testo: "x" }, ...upd("admin") }));
    await assertFails(updateDoc(doc(d, "feste/f1"), { paginaPubblica: { ...pagina, copertina: "ftp://x" }, ...upd("admin") }));
    await assertFails(updateDoc(doc(d, "feste/f1"), { modalitaFesta: "sì", ...upd("admin") }));
  });

  it("il superadmin mette in archivio anche una festa archiviata", async () => {
    await assertSucceeds(updateDoc(doc(db("super"), "feste/f3"), { inArchivioPubblico: true, paginaPubblica: pagina, ...upd("super") }));
  });
});

describe("programma", () => {
  it("il visitatore legge il programma delle feste in evidenza o in archivio, non delle altre", async () => {
    const d = db(null);
    await assertSucceeds(getDocs(collection(d, "feste/f1/programma")));
    await assertSucceeds(getDocs(collection(d, "feste/f2/programma")));
    await assertFails(getDocs(collection(d, "feste/f3/programma")));
    await assertFails(addDoc(collection(d, "feste/f1/programma"), evento("x")));
  });

  it("lo curano gli admin; i membri lo leggono soltanto", async () => {
    await assertSucceeds(addDoc(collection(db("admin"), "feste/f1/programma"), evento("admin")));
    await assertSucceeds(updateDoc(doc(db("admin"), "feste/f1/programma/e1"), { titolo: "Santa Messa", ...upd("admin") }));
    await assertFails(addDoc(collection(db("ref"), "feste/f1/programma"), evento("ref")));
    await assertFails(updateDoc(doc(db("ref"), "feste/f1/programma/e1"), { titolo: "x", ...upd("ref") }));
    await assertSucceeds(getDocs(collection(db("ref"), "feste/f1/programma")));
    await assertFails(deleteDoc(doc(db("ref"), "feste/f1/programma/e1")));
    await assertSucceeds(deleteDoc(doc(db("admin"), "feste/f1/programma/e1")));
  });

  it("rifiuta eventi non validi", async () => {
    const d = db("admin");
    await assertFails(addDoc(collection(d, "feste/f1/programma"), evento("admin", { titolo: "" })));
    await assertFails(addDoc(collection(d, "feste/f1/programma"), evento("admin", { fine: Timestamp.fromMillis(0) })));
    await assertFails(addDoc(collection(d, "feste/f1/programma"), evento("admin", { prezzo: 10 })));
  });
});

describe("mappa", () => {
  const punto = (uid: string, extra: Record<string, unknown> = {}) => ({
    nome: "Stand", categoria: "mangiare", x: 0.25, y: 1, accessibile: false,
    createdAt: serverTimestamp(), createdBy: uid, ...upd(uid), ...extra,
  });

  it("il visitatore vede immagine e punti delle feste pubbliche, non delle altre", async () => {
    const d = db(null);
    await assertSucceeds(getDoc(doc(d, "feste/f1/mappa/config")));
    await assertSucceeds(getDocs(collection(d, "feste/f2/mappa/config/punti")));
    await assertFails(getDoc(doc(d, "feste/f3/mappa/config")));
    await assertFails(getDocs(collection(d, "feste/f3/mappa/config/punti")));
    await assertFails(addDoc(collection(d, "feste/f1/mappa/config/punti"), punto("x")));
  });

  it("la curano gli admin: immagine e punti trascinati", async () => {
    const a = db("admin");
    await assertSucceeds(setDoc(doc(a, "feste/f1/mappa/config"), {
      immagine: { url: "https://example.com/n.webp", larghezza: 2560, altezza: 1440 }, ...upd("admin"),
    }));
    await assertSucceeds(addDoc(collection(a, "feste/f1/mappa/config/punti"), punto("admin")));
    await assertSucceeds(updateDoc(doc(a, "feste/f1/mappa/config/punti/p1"), { x: 0.1, y: 0.9, ...upd("admin") }));
    await assertSucceeds(deleteDoc(doc(a, "feste/f1/mappa/config/punti/p1")));
    await assertFails(addDoc(collection(db("ref"), "feste/f1/mappa/config/punti"), punto("ref")));
    await assertFails(setDoc(doc(db("ref"), "feste/f1/mappa/config"), { immagine: { url: "https://x.it/a", larghezza: 1, altezza: 1 }, ...upd("ref") }));
  });

  it("rifiuta punti fuori dall'immagine, categorie inventate e altri documenti", async () => {
    const a = db("admin");
    await assertFails(addDoc(collection(a, "feste/f1/mappa/config/punti"), punto("admin", { x: 1.2 })));
    await assertFails(addDoc(collection(a, "feste/f1/mappa/config/punti"), punto("admin", { categoria: "museo" })));
    await assertFails(addDoc(collection(a, "feste/f1/mappa/config/punti"), punto("admin", { foto: "ftp://x" })));
    await assertFails(setDoc(doc(a, "feste/f1/mappa/altro"), { immagine: { url: "https://x.it/a", larghezza: 1, altezza: 1 }, ...upd("admin") }));
  });
});

describe("immagini del sito (Storage)", () => {
  it("chiunque le vede; le caricano gli admin della festa o il superadmin", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.storage().ref("sito/feste/f1/a").put(new Uint8Array([1]), { contentType: "image/png" }).then(() => undefined),
    );
    await assertSucceeds(contesto(null).storage().ref("sito/feste/f1/a").getMetadata());
    await assertSucceeds(carica("admin", "sito/feste/f1/b", "image/webp"));
    await assertFails(carica("admin", "sito/feste/f1/c", "application/pdf"));
    await assertFails(carica("ref", "sito/feste/f1/c"));
    await assertFails(carica(null, "sito/feste/f1/c"));
    await assertFails(contesto("ref").storage().ref("sito/feste/f1/a").delete());
    await assertSucceeds(contesto("admin").storage().ref("sito/feste/f1/a").delete());
    await assertFails(carica("admin", "sito/generale/x"));
    await assertSucceeds(carica("super", "sito/generale/x"));
  });

  it("festa archiviata: solo il superadmin carica", async () => {
    await seed("archiviata");
    await assertFails(carica("admin", "sito/feste/f1/b"));
    await assertSucceeds(carica("super", "sito/feste/f1/b"));
  });
});

// lib/permissions.ts deve dare gli stessi risultati delle regole (SPEC 3).
describe("permissions.ts coincide con le regole", () => {
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
      for (const uid of ["admin", "ref", "altro", "super"]) {
        const m = membri[uid];
        const chi: perm.Io = { uid, superadmin: uid === "super", membro: m ? ({ uid, attivo: true, ...m } as Membro) : undefined };
        const d = db(uid);
        const casi: [string, boolean, () => Promise<unknown>][] = [
          ["pagina della festa", perm.puoModificarePaginaFesta(chi, { stato }),
            () => updateDoc(doc(d, "feste/f1"), { paginaPubblica: { testo: uid, galleria: [] }, ...upd(uid) })],
          ["testi del sito", perm.puoModificareSito(chi), () => setDoc(doc(d, "sito/config"), config({ updatedBy: uid }))],
          ["archivio", perm.puoModificareSito(chi), () => updateDoc(doc(d, "feste/f1"), { inArchivioPubblico: true, ...upd(uid) })],
          ["programma", perm.puoModificareProgramma(chi, { stato }), () => addDoc(collection(d, "feste/f1/programma"), evento(uid))],
          ["punto della mappa", perm.puoModificareProgramma(chi, { stato }),
            () => updateDoc(doc(d, "feste/f1/mappa/config/punti/p1"), { x: 0.3, ...upd(uid) })],
        ];
        for (const [nome, atteso, op] of casi) {
          expect(await esito(op()), `${uid}: ${nome}`).toBe(atteso);
        }
      }
    });
  }
});
