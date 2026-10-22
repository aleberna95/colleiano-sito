import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { account, admin, chiudiClient, client, svuota } from "./setup";

let festaId: string;

beforeEach(async () => {
  await svuota();
  const s = await account("alessio", { superadmin: true });
  const sa = await client(s.email);
  ({ festaId } = await sa<{ festaId: string }>("creaFesta", { nome: "Festa di Colleiano 2027", luogo: "Piazza" }));
});

afterEach(() => chiudiClient());

/** Il trigger è asincrono: aspetta che sitoFeste/{festaId} soddisfi la condizione. */
async function copia(ok: (d: FirebaseFirestore.DocumentData | undefined) => boolean) {
  const ref = admin().db.doc(`sitoFeste/${festaId}`);
  for (let i = 0; i < 40; i++) {
    const d = (await ref.get()).data();
    if (ok(d)) return d;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("sitoFeste non aggiornato");
}

describe("copia pubblica della festa (trigger sitoFesta)", () => {
  it("copia solo i dati pubblici e segue le modifiche", async () => {
    const d = await copia((d) => d !== undefined);
    expect(d).toEqual({
      nome: "Festa di Colleiano 2027",
      slug: "festa-di-colleiano-2027",
      luogo: "Piazza",
      modalitaFesta: false,
      inArchivioPubblico: false,
      paginaPubblica: { galleria: [] },
    });

    await admin().db.doc(`feste/${festaId}`).update({
      inArchivioPubblico: true,
      paginaPubblica: { testo: "Che festa!", galleria: ["https://example.com/a.webp"] },
      budgetTotaleCents: 500000,
    });
    const dopo = await copia((d) => d?.inArchivioPubblico === true);
    expect(dopo?.paginaPubblica).toEqual({ testo: "Che festa!", galleria: ["https://example.com/a.webp"] });
    expect(dopo).not.toHaveProperty("budgetTotaleCents");
    expect(dopo).not.toHaveProperty("categorieSpesa");
    expect(dopo).not.toHaveProperty("stato");
  });

  it("toglie la copia se la festa viene eliminata", async () => {
    await copia((d) => d !== undefined);
    await admin().db.recursiveDelete(admin().db.doc(`feste/${festaId}`));
    await copia((d) => d === undefined);
  });
});
