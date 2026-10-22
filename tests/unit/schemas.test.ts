import { describe, expect, it } from "vitest";
import { centsSchema, datiPubbliciFesta, festaSchema, sitoFestaSchema, taskSchema } from "@/lib/schemas";

const ts = { toDate: () => new Date(), toMillis: () => Date.now() };
const audit = { createdAt: ts, createdBy: "u1", updatedAt: ts, updatedBy: "u1" };

describe("schemi Zod", () => {
  it("gli importi sono centesimi interi non negativi", () => {
    expect(centsSchema.safeParse(1250).success).toBe(true);
    expect(centsSchema.safeParse(12.5).success).toBe(false);
    expect(centsSchema.safeParse(-1).success).toBe(false);
  });

  it("valida una festa e rifiuta uno slug non valido", () => {
    const festa = {
      ...audit,
      nome: "Festa di Colleiano 2027",
      slug: "festa-2027",
      stato: "preparazione",
      categorieSpesa: ["Cibo", "Musica"],
    };
    expect(festaSchema.safeParse(festa).success).toBe(true);
    expect(festaSchema.safeParse({ ...festa, slug: "Festa 2027" }).success).toBe(false);
  });

  it("un task può essere da assegnare ma non avere uno stato inventato", () => {
    const task = {
      ...audit,
      titolo: "Prenotare il palco",
      commissioneId: "musica",
      responsabileUid: null,
      stato: "da_fare",
      priorita: "normale",
      checklist: [],
      link: [],
      eliminato: false,
    };
    expect(taskSchema.safeParse(task).success).toBe(true);
    expect(taskSchema.safeParse({ ...task, stato: "in_revisione" }).success).toBe(false);
  });

  it("la copia pubblica della festa non porta con sé dati interni", () => {
    const festa = {
      ...audit,
      nome: "Festa 2026",
      slug: "festa-2026",
      stato: "archiviata",
      budgetTotaleCents: 100000,
      categorieSpesa: ["Cibo"],
      inArchivioPubblico: true,
      paginaPubblica: { testo: "", galleria: ["https://example.com/a.webp"] },
    };
    const pubblici = datiPubbliciFesta(festa);
    expect(pubblici).toEqual({
      nome: "Festa 2026",
      slug: "festa-2026",
      modalitaFesta: false,
      inArchivioPubblico: true,
      paginaPubblica: { galleria: ["https://example.com/a.webp"] },
    });
    expect(sitoFestaSchema.safeParse(pubblici).success).toBe(true);
  });
});
