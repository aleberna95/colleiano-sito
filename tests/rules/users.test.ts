import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { creaAmbiente } from "./setup";

let env: RulesTestEnvironment;

const ora = Timestamp.now();
function profilo(uid: string, extra: Record<string, unknown> = {}) {
  return {
    nome: uid, cognome: "Test", nomeVisualizzato: uid, email: `${uid}@test.it`, telefono: "3330000000",
    superadmin: false, attivo: true, devoCambiarePassword: true,
    createdAt: ora, createdBy: "script", updatedAt: ora, updatedBy: "script",
    ...extra,
  };
}

beforeAll(async () => {
  env = await creaAmbiente();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/super"), profilo("super", { superadmin: true }));
    await setDoc(doc(db, "users/mario"), profilo("mario"));
    await setDoc(doc(db, "users/spento"), profilo("spento", { attivo: false }));
  });
});

afterAll(async () => {
  await env.cleanup();
});

const mario = () => env.authenticatedContext("mario").firestore();
const superadmin = () => env.authenticatedContext("super", { superadmin: true }).firestore();

describe("users", () => {
  it("ognuno legge il proprio profilo e non quello degli altri", async () => {
    await assertSucceeds(getDoc(doc(mario(), "users/mario")));
    await assertFails(getDoc(doc(mario(), "users/super")));
    await assertFails(getDocs(collection(mario(), "users")));
  });

  it("il superadmin legge tutti i profili", async () => {
    await assertSucceeds(getDocs(collection(superadmin(), "users")));
  });

  it("nessun client crea profili, nemmeno il superadmin", async () => {
    await assertFails(setDoc(doc(mario(), "users/nuovo"), profilo("nuovo")));
    await assertFails(setDoc(doc(superadmin(), "users/nuovo"), profilo("nuovo")));
  });

  it("l'utente segna di aver cambiato la password", async () => {
    await assertSucceeds(
      updateDoc(doc(mario(), "users/mario"), {
        devoCambiarePassword: false, updatedAt: serverTimestamp(), updatedBy: "mario",
      }),
    );
  });

  it("l'utente ricorda l'ultima festa", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "users/mario"), { devoCambiarePassword: false }),
    );
    await assertSucceeds(
      updateDoc(doc(mario(), "users/mario"), {
        ultimaFestaId: "festa-1", updatedAt: serverTimestamp(), updatedBy: "mario",
      }),
    );
  });

  it("l'utente non si dà poteri né cambia altri campi", async () => {
    const ref = doc(mario(), "users/mario");
    const base = { devoCambiarePassword: false, updatedAt: serverTimestamp(), updatedBy: "mario" };
    await assertFails(updateDoc(ref, { ...base, superadmin: true }));
    await assertFails(updateDoc(ref, { ...base, attivo: false }));
    await assertFails(updateDoc(ref, { ...base, telefono: "000" }));
    await assertFails(updateDoc(ref, { devoCambiarePassword: true, updatedAt: serverTimestamp(), updatedBy: "mario" }));
  });

  it("nessuno modifica il profilo di un altro", async () => {
    await assertFails(
      updateDoc(doc(superadmin(), "users/mario"), {
        devoCambiarePassword: false, updatedAt: serverTimestamp(), updatedBy: "super",
      }),
    );
  });

  it("un utente disattivato non modifica il proprio profilo", async () => {
    const db = env.authenticatedContext("spento").firestore();
    await assertFails(
      updateDoc(doc(db, "users/spento"), {
        devoCambiarePassword: false, updatedAt: serverTimestamp(), updatedBy: "spento",
      }),
    );
  });
});

describe("feste (M1)", () => {
  it("il superadmin elenca le feste, gli altri no", async () => {
    await assertSucceeds(getDocs(collection(superadmin(), "feste")));
    await assertFails(getDocs(collection(mario(), "feste")));
  });
});
