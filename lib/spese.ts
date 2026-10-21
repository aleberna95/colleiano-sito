import { chiaveBeneficiario, type Membro, type Movimento, type Rimborso, type StatoMovimento, type Storico } from "./schemas";

export type MovimentoConId = Movimento & { id: string };
export type RimborsoConId = Rimborso & { id: string };

export const NOMI_STATO_SPESA: Record<StatoMovimento, string> = {
  in_attesa: "In attesa",
  approvata: "Approvata",
  rifiutata: "Rifiutata",
  rimborsata: "Rimborsata",
  annullata: "Annullata",
};

export const CLASSI_STATO_SPESA: Record<StatoMovimento, string> = {
  in_attesa: "border-colleiano-warning/40 bg-colleiano-warning/10 text-colleiano-warning",
  approvata: "border-colleiano-success/40 bg-colleiano-success/10 text-colleiano-success",
  rifiutata: "border-colleiano-danger/40 bg-colleiano-danger/10 text-colleiano-danger",
  rimborsata: "border-blue-300 bg-blue-50 text-blue-900",
  annullata: "border-stone-300 bg-stone-100 text-stone-700",
};

const somma = (l: { importoCents: number }[]) => l.reduce((t, m) => t + m.importoCents, 0);
const valide = (l: MovimentoConId[]) => l.filter((m) => !m.eliminato);
/** Spese che contano come uscite: approvate, anche se già rimborsate. */
const uscita = (m: Movimento) => m.tipo === "spesa" && (m.stato === "approvata" || m.stato === "rimborsata");

export type Riepilogo = {
  budgetCents?: number;
  approvatoCents: number;
  inAttesaCents: number;
  entrateCents: number;
  /** Entrate meno spese approvate. */
  saldoCents: number;
  perCommissione: { commissioneId: string; budgetCents: number; approvatoCents: number }[];
};

/** Riepilogo della festa (SPEC 6.4): budget, approvato, in attesa, entrate, saldo; per commissione se c'è un budget. */
export function riepilogo(
  movimenti: MovimentoConId[],
  budgetTotaleCents: number | undefined,
  commissioni: { id: string; budgetCents?: number }[],
): Riepilogo {
  const l = valide(movimenti);
  const approvatoCents = somma(l.filter(uscita));
  const entrateCents = somma(l.filter((m) => m.tipo === "entrata" && m.stato === "approvata"));
  return {
    budgetCents: budgetTotaleCents,
    approvatoCents,
    inAttesaCents: somma(l.filter((m) => m.tipo === "spesa" && m.stato === "in_attesa")),
    entrateCents,
    saldoCents: entrateCents - approvatoCents,
    perCommissione: commissioni
      .filter((c) => c.budgetCents !== undefined)
      .map((c) => ({
        commissioneId: c.id,
        budgetCents: c.budgetCents!,
        approvatoCents: somma(l.filter((m) => uscita(m) && m.commissioneId === c.id)),
      })),
  };
}

export type Credito = {
  chiave: string;
  nome: string;
  beneficiarioUid?: string;
  anticipatoCents: number;
  rimborsatoCents: number;
  daRimborsareCents: number;
  /** Spese anticipate approvate o rimborsate, dalla più recente. */
  spese: MovimentoConId[];
};

/** "Chi deve ricevere quanto" (SPEC 6.4): una riga per persona, chi deve ricevere di più in cima. */
export function crediti(movimenti: MovimentoConId[], membri: Pick<Membro, "uid" | "nomeVisualizzato">[]): Credito[] {
  const nomi = new Map(membri.map((m) => [m.uid, m.nomeVisualizzato]));
  const perChiave = new Map<string, Credito>();
  for (const m of valide(movimenti)) {
    const chiave = chiaveBeneficiario(m);
    if (!chiave || !uscita(m)) continue;
    const uid = m.pagatoDa.beneficiarioUid;
    const c = perChiave.get(chiave) ?? {
      chiave,
      nome: uid ? (nomi.get(uid) ?? "Persona rimossa") : (m.pagatoDa.beneficiarioNome ?? "").trim(),
      ...(uid && { beneficiarioUid: uid }),
      anticipatoCents: 0,
      rimborsatoCents: 0,
      daRimborsareCents: 0,
      spese: [],
    };
    c.anticipatoCents += m.importoCents;
    if (m.stato === "rimborsata") c.rimborsatoCents += m.importoCents;
    else c.daRimborsareCents += m.importoCents;
    c.spese.push(m);
    perChiave.set(chiave, c);
  }
  for (const c of perChiave.values()) c.spese.sort((a, b) => b.dataSpesa.toMillis() - a.dataSpesa.toMillis());
  return [...perChiave.values()].sort((a, b) => b.daRimborsareCents - a.daRimborsareCents || a.nome.localeCompare(b.nome));
}

export const daRimborsare = (c: Credito) => c.spese.filter((m) => m.stato === "approvata");

/** Chiave sicura da mettere nell'URL di una persona dei rimborsi. */
export const chiaveUrl = (chiave: string) => encodeURIComponent(chiave);

export function pagatoDaTesto(m: Pick<Movimento, "pagatoDa">, nomeDi: (uid: string) => string): string {
  if (m.pagatoDa.tipo === "cassa") return "Cassa";
  return m.pagatoDa.beneficiarioUid ? nomeDi(m.pagatoDa.beneficiarioUid) : (m.pagatoDa.beneficiarioNome ?? "");
}

// ---- Export CSV (SPEC 6.4) ----

/** CSV per Excel italiano: separatore ";", virgola decimale, BOM per gli accenti. */
export function csv(righe: (string | number)[][]): string {
  const cella = (v: string | number) => {
    const t = String(v);
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + righe.map((r) => r.map(cella).join(";")).join("\r\n");
}

const importoCsv = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const dataCsv = (d: Date) => d.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });

export function movimentiCsv(
  movimenti: MovimentoConId[],
  nomeDi: (uid: string) => string,
  nomeCommissione: (id: string) => string,
): string {
  const ordinati = valide(movimenti).sort((a, b) => a.dataSpesa.toMillis() - b.dataSpesa.toMillis());
  return csv([
    ["Data", "Tipo", "Commissione", "Descrizione", "Categoria", "Importo (euro)", "Pagato da", "Stato", "Motivo", "Inserita da"],
    ...ordinati.map((m) => [
      dataCsv(m.dataSpesa.toDate()),
      m.tipo === "spesa" ? "Spesa" : "Entrata",
      nomeCommissione(m.commissioneId),
      m.descrizione,
      m.categoria,
      importoCsv(m.importoCents),
      pagatoDaTesto(m, nomeDi),
      NOMI_STATO_SPESA[m.stato],
      m.motivo ?? "",
      nomeDi(m.createdBy),
    ]),
  ]);
}

export const NOMI_MODALITA: Record<Rimborso["modalita"], string> = { contanti: "Contanti", bonifico: "Bonifico", altro: "Altro" };

export function rimborsiCsv(rimborsi: RimborsoConId[], nomeDi: (uid: string) => string): string {
  const ordinati = [...rimborsi].sort((a, b) => a.data.toMillis() - b.data.toMillis());
  return csv([
    ["Data", "A chi", "Importo (euro)", "Modalità", "Numero spese", "Nota", "Registrato da", "Annullato"],
    ...ordinati.map((r) => [
      dataCsv(r.data.toDate()),
      r.beneficiarioNome,
      importoCsv(r.totaleCents),
      NOMI_MODALITA[r.modalita],
      r.movimentiIds.length,
      r.nota ?? "",
      nomeDi(r.createdBy),
      r.annullato ? `Sì: ${r.motivoAnnullamento ?? ""}` : "",
    ]),
  ]);
}

/** Fa scaricare un file dal browser. */
export function scaricaFile(nome: string, contenuto: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


const NOMI_CAMPO_SPESA: Record<string, string> = {
  commissioneId: "commissione",
  descrizione: "descrizione",
  importoCents: "importo",
  categoria: "tipo di spesa",
  dataSpesa: "data",
  pagatoDa: "chi ha pagato",
  scontrini: "scontrini",
};

export function descriviStoricoMovimento(voce: Pick<Storico, "azione" | "diff">): string {
  const d = (voce.diff ?? {}) as Record<string, { prima?: unknown; dopo?: unknown }>;
  switch (voce.azione) {
    case "creato":
      return "ha segnato la spesa";
    case "ritirato":
      return "ha ritirato la spesa";
    case "stato": {
      const prima = d.stato?.prima as StatoMovimento;
      const dopo = d.stato?.dopo as StatoMovimento;
      const motivo = d.motivo?.dopo ? `: ${String(d.motivo.dopo)}` : "";
      if (dopo === "approvata" && prima === "rimborsata") return "ha annullato il rimborso";
      if (dopo === "approvata") return d.autoApprovata?.dopo ? "l'ha approvata da solo (unico admin)" : "l'ha approvata";
      if (dopo === "rifiutata") return `l'ha rifiutata${motivo}`;
      if (dopo === "in_attesa") return "l'ha corretta e rimandata in approvazione";
      if (dopo === "rimborsata") return "ha registrato il rimborso";
      if (dopo === "annullata") return `l'ha annullata${motivo}`;
      return `ha cambiato lo stato in ${NOMI_STATO_SPESA[dopo] ?? dopo}`;
    }
    default:
      return `ha modificato: ${Object.keys(d).map((k) => NOMI_CAMPO_SPESA[k] ?? k).join(", ")}`;
  }
}

/** A chi dare la notizia di una decisione: chi riceve i soldi, altrimenti chi l'ha segnata (SPEC 6.6). Mai a me stesso. */
export function destinatarioSpesa(m: Pick<Movimento, "pagatoDa" | "createdBy">, membri: Membro[], ioUid: string): Membro | undefined {
  const uid = m.pagatoDa.beneficiarioUid ?? m.createdBy;
  return membri.find((x) => x.uid === uid && x.attivo && x.uid !== ioUid);
}
