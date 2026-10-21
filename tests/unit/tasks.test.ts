import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { vocePerTask } from "@/lib/schemas";
import { descriviStorico } from "@/components/task-sezioni";
import { destinatariRichiesta, filtraTask, ordinaPerScadenza, testoScadenza, type TaskConId } from "@/lib/tasks";
import { linkWhatsApp, testi } from "@/lib/whatsapp";
import type { Membro } from "@/lib/schemas";

const giorno = 24 * 3600_000;
const tra = (giorni: number) => Timestamp.fromMillis(Date.now() + giorni * giorno);

function task(id: string, extra: Partial<TaskConId> = {}): TaskConId {
  const t = Timestamp.now();
  return {
    id, titolo: id, commissioneId: "c1", responsabileUid: "anna", stato: "da_fare", priorita: "normale",
    checklist: [], link: [], eliminato: false, createdAt: t, createdBy: "anna", updatedAt: t, updatedBy: "anna",
    ...extra,
  };
}

describe("storico dei task", () => {
  it("registra creazione e richiesta", () => {
    expect(vocePerTask(undefined, { stato: "da_fare" })).toEqual({ azione: "creato" });
    expect(vocePerTask(undefined, { stato: "richiesta" })).toEqual({ azione: "richiesta" });
  });

  it("riconosce cambi di stato, assegnazioni, spostamenti e modifiche", () => {
    expect(vocePerTask({ stato: "da_fare" }, { stato: "in_corso" })).toEqual({
      azione: "stato", diff: { stato: { prima: "da_fare", dopo: "in_corso" } },
    });
    expect(vocePerTask({ responsabileUid: "a" }, { responsabileUid: "b" })?.azione).toBe("assegnato");
    expect(vocePerTask({ commissioneId: "a" }, { commissioneId: "b" })?.azione).toBe("spostato");
    const v = vocePerTask(
      { titolo: "a", checklist: [{ fatto: false }] },
      { titolo: "b", checklist: [{ fatto: true }] },
    );
    expect(v).toEqual({ azione: "modificato", diff: { titolo: { prima: "a", dopo: "b" }, checklist: { prima: "0/1", dopo: "1/1" } } });
  });

  it("ignora le scritture che non cambiano nulla di visibile", () => {
    const s = Timestamp.fromMillis(1000);
    expect(vocePerTask({ titolo: "a", scadenza: s }, { titolo: "a", scadenza: Timestamp.fromMillis(1000) })).toBeNull();
  });

  it("descrive lo storico in parole semplici", () => {
    const nome = (uid: string | null | undefined) => (uid === "b" ? "Bruno" : "?");
    const comm = () => "Cucina";
    expect(descriviStorico({ azione: "stato", diff: { stato: { prima: "richiesta", dopo: "da_fare" } } }, nome, comm)).toBe("ha accettato la richiesta");
    expect(descriviStorico({ azione: "stato", diff: { stato: { prima: "da_fare", dopo: "fatto" } } }, nome, comm)).toBe(
      "ha cambiato lo stato: Da fare → Fatto",
    );
    expect(descriviStorico({ azione: "assegnato", diff: { responsabileUid: { prima: null, dopo: "b" } } }, nome, comm)).toBe(
      "ha assegnato il task a Bruno",
    );
    expect(descriviStorico({ azione: "spostato", diff: { commissioneId: { dopo: "c2" } } }, nome, comm)).toBe("ha spostato il task in Cucina");
  });
});

describe("liste di task", () => {
  const tasks = [
    task("scaduto", { scadenza: tra(-2) }),
    task("oggi", { scadenza: tra(0) }),
    task("dopo", { scadenza: tra(10) }),
    task("senza"),
    task("urgente", { priorita: "urgente" }),
    task("libero", { responsabileUid: null }),
    task("richiesta", { stato: "richiesta", responsabileUid: null }),
    task("fatto", { stato: "fatto", scadenza: tra(-5) }),
    task("eliminato", { eliminato: true }),
  ];
  const ids = (l: TaskConId[]) => l.map((t) => t.id);

  it("filtri: scaduti, da assegnare, richieste, chiusi", () => {
    expect(ids(filtraTask(tasks, { filtro: "scaduti" }))).toEqual(["scaduto"]);
    expect(ids(filtraTask(tasks, { filtro: "da_assegnare" }))).toEqual(["libero"]);
    expect(ids(filtraTask(tasks, { filtro: "richieste" }))).toEqual(["richiesta"]);
    expect(ids(filtraTask(tasks, { filtro: "chiusi" }))).toEqual(["fatto"]);
    expect(filtraTask(tasks, { filtro: "aperti" })).toHaveLength(6);
    expect(filtraTask(tasks, { filtro: "aperti", persona: "nessuno" })).toHaveLength(0);
  });

  it("prima gli scaduti, poi quelli di oggi, poi gli urgenti", () => {
    expect(ids(ordinaPerScadenza(filtraTask(tasks, { filtro: "aperti" }))).slice(0, 4)).toEqual(["scaduto", "oggi", "dopo", "urgente"]);
  });

  it("testo della scadenza", () => {
    expect(testoScadenza(-3)).toBe("Scaduto da 3 giorni");
    expect(testoScadenza(0)).toBe("Scade oggi");
    expect(testoScadenza(1)).toBe("Scade domani");
  });

  it("una richiesta si annuncia ai referenti, se non ci sono agli admin", () => {
    const m = (uid: string, extra: Partial<Membro>) => ({ uid, attivo: true, ruoloFesta: "membro", commissioni: {}, ...extra }) as Membro;
    const membri = [m("ref", { commissioni: { c1: "referente" } }), m("adm", { ruoloFesta: "admin" }), m("spento", { attivo: false, commissioni: { c1: "referente" } })];
    expect(destinatariRichiesta(membri, "c1").map((x) => x.uid)).toEqual(["ref"]);
    expect(destinatariRichiesta(membri, "c2").map((x) => x.uid)).toEqual(["adm"]);
  });
});

describe("messaggi WhatsApp dei task", () => {
  it("contengono titolo e link", () => {
    const t = testi.taskAssegnato({ nome: "Anna", titolo: "Palco", scadenza: "ven 14 ago", link: "https://x/t/1" });
    expect(t).toContain('"Palco"');
    expect(t).toContain("Entro: ven 14 ago");
    expect(t).toContain("https://x/t/1");
    expect(testi.richiestaRifiutata({ nome: "A", titolo: "T", motivo: "No", link: "L" })).toContain("Motivo: No");
    expect(linkWhatsApp(testi.condividiTask({ titolo: "T", commissione: "C", stato: "Da fare", responsabile: "A", link: "L" }))).toMatch(
      /^https:\/\/wa\.me\/\?text=T%0ACommissione/,
    );
  });
});
