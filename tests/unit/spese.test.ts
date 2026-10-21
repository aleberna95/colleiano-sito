import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { vocePerMovimento } from "@/lib/schemas";
import { crediti, csv, descriviStoricoMovimento, destinatarioSpesa, movimentiCsv, riepilogo, type MovimentoConId } from "@/lib/spese";
import type { Membro } from "@/lib/schemas";

let n = 0;
function mov(extra: Partial<MovimentoConId>): MovimentoConId {
  const t = Timestamp.fromMillis(Date.UTC(2027, 4, 1 + n));
  return {
    id: `m${n++}`, tipo: "spesa", commissioneId: "c1", descrizione: "x", importoCents: 1000, categoria: "Altro",
    dataSpesa: t, pagatoDa: { tipo: "cassa" }, stato: "approvata", scontrini: [], eliminato: false,
    createdAt: t, createdBy: "anna", updatedAt: t, updatedBy: "anna", ...extra,
  };
}
const anticipata = (uid: string) => ({ tipo: "anticipata" as const, beneficiarioUid: uid });

describe("riepilogo (SPEC 6.4)", () => {
  it("budget, approvato, in attesa, entrate e saldo", () => {
    const r = riepilogo(
      [
        mov({ importoCents: 1000 }),
        mov({ importoCents: 500, stato: "rimborsata", pagatoDa: anticipata("luca") }),
        mov({ importoCents: 300, stato: "in_attesa" }),
        mov({ importoCents: 999, stato: "rifiutata" }),
        mov({ importoCents: 999, stato: "annullata" }),
        mov({ importoCents: 999, eliminato: true }),
        mov({ tipo: "entrata", importoCents: 5000 }),
        mov({ importoCents: 2000, commissioneId: "c2" }),
      ],
      10000,
      [{ id: "c1", budgetCents: 1200 }, { id: "c2" }],
    );
    expect(r).toEqual({
      budgetCents: 10000,
      approvatoCents: 3500,
      inAttesaCents: 300,
      entrateCents: 5000,
      saldoCents: 1500,
      perCommissione: [{ commissioneId: "c1", budgetCents: 1200, approvatoCents: 1500 }],
    });
  });
});

describe("chi deve ricevere quanto (SPEC 6.4)", () => {
  const membri = [{ uid: "luca", nomeVisualizzato: "Luca" }, { uid: "gina", nomeVisualizzato: "Gina" }];

  it("una riga per persona con anticipato, rimborsato e da rimborsare", () => {
    const c = crediti(
      [
        mov({ importoCents: 1000, pagatoDa: anticipata("luca") }),
        mov({ importoCents: 400, pagatoDa: anticipata("luca"), stato: "rimborsata" }),
        mov({ importoCents: 300, pagatoDa: anticipata("luca"), stato: "in_attesa" }),
        mov({ importoCents: 700, pagatoDa: anticipata("gina"), stato: "rimborsata" }),
        mov({ importoCents: 250, pagatoDa: { tipo: "anticipata", beneficiarioNome: " Zio Peppe " } }),
        mov({ importoCents: 150, pagatoDa: { tipo: "anticipata", beneficiarioNome: "zio peppe" } }),
        mov({ importoCents: 9999 }),
      ],
      membri,
    );
    expect(c.map(({ nome, anticipatoCents, rimborsatoCents, daRimborsareCents }) => ({ nome, anticipatoCents, rimborsatoCents, daRimborsareCents }))).toEqual([
      { nome: "Luca", anticipatoCents: 1400, rimborsatoCents: 400, daRimborsareCents: 1000 },
      { nome: "Zio Peppe", anticipatoCents: 400, rimborsatoCents: 0, daRimborsareCents: 400 },
      { nome: "Gina", anticipatoCents: 700, rimborsatoCents: 700, daRimborsareCents: 0 },
    ]);
  });
});

describe("CSV", () => {
  it("separatore punto e virgola, virgolette quando servono, BOM", () => {
    expect(csv([["a", 'di "Mario"; ok'], [1, 2]])).toBe('﻿a;"di ""Mario""; ok"\r\n1;2');
  });

  it("movimenti con importi in euro e virgola decimale", () => {
    const testo = movimentiCsv([mov({ importoCents: 2550, descrizione: "Corde", pagatoDa: anticipata("luca") })], (u) => u.toUpperCase(), () => "Musica");
    expect(testo.split("\r\n")[1]).toMatch(/^\d{1,2}\/\d{1,2}\/2027;Spesa;Musica;Corde;Altro;25,50;LUCA;Approvata;;ANNA$/);
  });
});

describe("storico e avvisi delle spese", () => {
  it("registra creazione, stato e ritiro", () => {
    expect(vocePerMovimento(undefined, { stato: "in_attesa" })).toEqual({ azione: "creato" });
    expect(vocePerMovimento({ stato: "in_attesa" }, { stato: "approvata", autoApprovata: true })?.azione).toBe("stato");
    expect(vocePerMovimento({ eliminato: false }, { eliminato: true })?.azione).toBe("ritirato");
    expect(vocePerMovimento({ importoCents: 1 }, { importoCents: 1 })).toBeNull();
  });

  it("descrive lo storico in parole semplici", () => {
    const voce = (prima: string, dopo: string, extra = {}) => ({ azione: "stato", diff: { stato: { prima, dopo }, ...extra } });
    expect(descriviStoricoMovimento(voce("in_attesa", "approvata"))).toBe("l'ha approvata");
    expect(descriviStoricoMovimento(voce("in_attesa", "approvata", { autoApprovata: { dopo: true } }))).toBe("l'ha approvata da solo (unico admin)");
    expect(descriviStoricoMovimento(voce("in_attesa", "rifiutata", { motivo: { dopo: "Doppia" } }))).toBe("l'ha rifiutata: Doppia");
    expect(descriviStoricoMovimento(voce("rimborsata", "approvata"))).toBe("ha annullato il rimborso");
    expect(descriviStoricoMovimento({ azione: "modificato", diff: { importoCents: {} } })).toBe("ha modificato: importo");
  });

  it("la decisione si annuncia a chi riceve i soldi, altrimenti a chi l'ha segnata, mai a me", () => {
    const m = (uid: string) => ({ uid, attivo: true, nomeVisualizzato: uid }) as Membro;
    const membri = [m("anna"), m("luca")];
    expect(destinatarioSpesa(mov({ pagatoDa: anticipata("luca") }), membri, "boss")?.uid).toBe("luca");
    expect(destinatarioSpesa(mov({}), membri, "boss")?.uid).toBe("anna");
    expect(destinatarioSpesa(mov({}), membri, "anna")).toBeUndefined();
  });
});
