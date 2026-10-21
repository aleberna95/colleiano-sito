"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, FileText, Link2, MessageSquare, Paperclip, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import {
  aggiornaTask,
  aggiungiCommento,
  caricaAllegato,
  indirizzoAllegato,
  MAX_ALLEGATO_MB,
  modificaCommento,
  togliAllegato,
  useAllegati,
  useCommenti,
  useStoricoTask,
} from "@/lib/data/tasks";
import { useFesta } from "@/lib/festa-context";
import { formatQuando } from "@/lib/format";
import { puoCommentare, puoModificareCommento } from "@/lib/permissions";
import { commentoFormSchema, linkFormSchema, type Allegato, type Storico } from "@/lib/schemas";
import { NOMI_STATO, type TaskConId } from "@/lib/tasks";

function Sezione({ titolo, icona, children }: { titolo: string; icona: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icona}
          <h2>{titolo}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

const Errore = ({ visibile }: { visibile: boolean }) =>
  visibile ? <Avviso tipo="errore">Non sono riuscito a salvare. Riprova.</Avviso> : null;

export function Checklist({ task, puo }: { task: TaskConId; puo: boolean }) {
  const { festaId, io } = useFesta();
  const [nuova, setNuova] = useState("");
  const [errore, setErrore] = useState(false);
  if (!puo && !task.checklist.length) return null;

  async function salva(checklist: TaskConId["checklist"]) {
    setErrore(false);
    try {
      await aggiornaTask(festaId, task.id, io.uid, { checklist });
      return true;
    } catch {
      setErrore(true);
      return false;
    }
  }

  const fatti = task.checklist.filter((c) => c.fatto).length;
  return (
    <Sezione titolo={task.checklist.length ? `Checklist (${fatti} su ${task.checklist.length})` : "Checklist"} icona={<FileText className="size-5" aria-hidden />}>
      {task.checklist.length > 0 && (
        <ul className="flex flex-col divide-y">
          {task.checklist.map((voce) => (
            <li key={voce.id} className="flex min-h-12 items-center gap-3">
              <label className="flex flex-1 items-center gap-3 py-2">
                <input
                  type="checkbox"
                  className="size-6 shrink-0 accent-colleiano-forest"
                  checked={voce.fatto}
                  disabled={!puo}
                  onChange={() => salva(task.checklist.map((c) => (c.id === voce.id ? { ...c, fatto: !c.fatto } : c)))}
                />
                <span className={voce.fatto ? "text-muted-foreground line-through" : ""}>{voce.testo}</span>
              </label>
              {puo && (
                <Button variant="ghost" size="icon-lg" aria-label={`Togli "${voce.testo}"`} onClick={() => salva(task.checklist.filter((c) => c.id !== voce.id))}>
                  <X aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puo && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const testo = nuova.trim();
            if (!testo) return;
            if (await salva([...task.checklist, { id: crypto.randomUUID().slice(0, 8), testo, fatto: false }])) setNuova("");
          }}
        >
          <input
            aria-label="Nuova voce della checklist"
            placeholder="Aggiungi una voce"
            value={nuova}
            maxLength={200}
            onChange={(e) => setNuova(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-md border border-input bg-white px-3 text-base"
          />
          <Button type="submit" size="lg" variant="outline" disabled={!nuova.trim()}>
            <Plus aria-hidden />
            Aggiungi
          </Button>
        </form>
      )}
      <Errore visibile={errore} />
    </Sezione>
  );
}

export function LinkEAllegati({ task, puoLink, puoAllegati }: { task: TaskConId; puoLink: boolean; puoAllegati: boolean }) {
  const { festaId, io } = useFesta();
  const allegati = useAllegati(festaId, task.id);
  const [nuovoLink, setNuovoLink] = useState({ titolo: "", url: "" });
  const [errore, setErrore] = useState<string>();
  const [carico, setCarico] = useState(false);
  const nessuno = !task.link.length && allegati.stato === "ok" && !allegati.dati.length;
  if (!puoLink && !puoAllegati && nessuno) return null;

  async function aggiungiLink() {
    setErrore(undefined);
    const r = linkFormSchema.safeParse(nuovoLink);
    if (!r.success) return setErrore(r.error.issues[0]?.message);
    try {
      await aggiornaTask(festaId, task.id, io.uid, { link: [...task.link, r.data] });
      setNuovoLink({ titolo: "", url: "" });
    } catch {
      setErrore("Non sono riuscito a salvare. Riprova.");
    }
  }

  async function carica(file: File) {
    setErrore(undefined);
    if (!/^image\/|^application\/pdf$/.test(file.type)) return setErrore("Si possono allegare solo foto e PDF.");
    if (file.size >= MAX_ALLEGATO_MB * 1024 * 1024) return setErrore(`Il file è troppo grande: massimo ${MAX_ALLEGATO_MB} MB.`);
    setCarico(true);
    try {
      await caricaAllegato(festaId, task.id, io.uid, file);
    } catch {
      setErrore("Non sono riuscito a caricare il file. Riprova.");
    } finally {
      setCarico(false);
    }
  }

  return (
    <Sezione titolo="Link e allegati" icona={<Paperclip className="size-5" aria-hidden />}>
      {nessuno && <p className="text-muted-foreground">Nessun link o allegato.</p>}
      <ul className="flex flex-col divide-y">
        {task.link.map((l, i) => (
          <li key={`${l.url}-${i}`} className="flex min-h-12 items-center gap-3">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center gap-2 py-2 text-colleiano-forest underline underline-offset-4">
              <Link2 className="size-5 shrink-0" aria-hidden />
              {l.titolo}
            </a>
            {puoLink && (
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={`Togli il link ${l.titolo}`}
                onClick={() => aggiornaTask(festaId, task.id, io.uid, { link: task.link.filter((_, j) => j !== i) }).catch(() => setErrore("Non sono riuscito a salvare. Riprova."))}
              >
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
        {allegati.stato === "ok" &&
          allegati.dati.map((a) => (
            <RigaAllegato key={a.id} allegato={a} puo={puoAllegati} onTogli={() => togliAllegato(festaId, task.id, a).catch(() => setErrore("Non sono riuscito a togliere il file. Riprova."))} />
          ))}
      </ul>
      {allegati.stato === "caricamento" && <Caricamento />}

      {puoAllegati && (
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-colleiano-forest/30 bg-white px-4 font-medium text-colleiano-forest has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
          <Paperclip className="size-5" aria-hidden />
          {carico ? "Caricamento..." : "Allega una foto o un PDF"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={carico}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void carica(file);
            }}
          />
        </label>
      )}

      {puoLink && (
        <div className="flex flex-col gap-3 rounded-md bg-muted/60 p-4">
          <Campo id="link-titolo" label="Nome del link" value={nuovoLink.titolo} onChange={(e) => setNuovoLink((l) => ({ ...l, titolo: e.target.value }))} />
          <Campo
            id="link-url"
            label="Indirizzo"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={nuovoLink.url}
            onChange={(e) => setNuovoLink((l) => ({ ...l, url: e.target.value }))}
          />
          <Button variant="outline" size="lg" onClick={aggiungiLink} disabled={!nuovoLink.titolo.trim() || !nuovoLink.url.trim()}>
            <Plus aria-hidden />
            Aggiungi il link
          </Button>
        </div>
      )}
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
    </Sezione>
  );
}

function RigaAllegato({ allegato, puo, onTogli }: { allegato: Allegato & { id: string }; puo: boolean; onTogli: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let attivo = true;
    indirizzoAllegato(allegato.path).then((u) => attivo && setUrl(u)).catch(() => {});
    return () => {
      attivo = false;
    };
  }, [allegato.path]);

  return (
    <li className="flex min-h-12 items-center gap-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!url}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-colleiano-forest underline underline-offset-4"
      >
        <ExternalLink className="size-5 shrink-0" aria-hidden />
        <span className="truncate">{allegato.nome}</span>
      </a>
      {puo && (
        <Button variant="ghost" size="icon-lg" aria-label={`Togli ${allegato.nome}`} onClick={onTogli}>
          <Trash2 aria-hidden />
        </Button>
      )}
    </li>
  );
}

export function Commenti({ task }: { task: TaskConId }) {
  const { festa, festaId, io, nomeDi } = useFesta();
  const commenti = useCommenti(festaId, task.id);
  const [testo, setTesto] = useState("");
  const [inModifica, setInModifica] = useState<{ id: string; testo: string }>();
  const [errore, setErrore] = useState<string>();
  const [invio, setInvio] = useState(false);
  const puo = puoCommentare(io, festa);

  async function invia() {
    const r = commentoFormSchema.safeParse({ testo });
    if (!r.success) return;
    setInvio(true);
    setErrore(undefined);
    try {
      await aggiungiCommento(festaId, task.id, io.uid, r.data.testo);
      setTesto("");
    } catch {
      setErrore("Non sono riuscito a inviare il commento. Riprova.");
    } finally {
      setInvio(false);
    }
  }

  async function salvaModifica() {
    if (!inModifica) return;
    const r = commentoFormSchema.safeParse({ testo: inModifica.testo });
    if (!r.success) return;
    try {
      await modificaCommento(festaId, task.id, inModifica.id, r.data.testo);
      setInModifica(undefined);
    } catch {
      setErrore("Non sono riuscito a salvare: dopo 15 minuti il commento non si può più cambiare.");
    }
  }

  return (
    <Sezione titolo="Commenti" icona={<MessageSquare className="size-5" aria-hidden />}>
      {commenti.stato === "caricamento" && <Caricamento />}
      {commenti.stato === "errore" && <Avviso tipo="errore">Non riesco a caricare i commenti.</Avviso>}
      {commenti.stato === "ok" && !commenti.dati.length && <p className="text-muted-foreground">Ancora nessun commento.</p>}
      {commenti.stato === "ok" && commenti.dati.length > 0 && (
        <ul className="flex flex-col gap-3">
          {commenti.dati.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 rounded-md bg-muted/60 p-3">
              <p className="text-[0.95rem] text-muted-foreground">
                <strong className="text-colleiano-slate">{nomeDi(c.autoreUid)}</strong>
                {c.createdAt && ` · ${formatQuando(c.createdAt)}`}
                {c.modificatoAt && " · modificato"}
              </p>
              {inModifica?.id === c.id ? (
                <div className="flex flex-col gap-2">
                  <AreaTesto id={`modifica-${c.id}`} label="Modifica il commento" value={inModifica.testo} onChange={(e) => setInModifica({ id: c.id, testo: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="lg" onClick={salvaModifica}>Salva</Button>
                    <Button size="lg" variant="ghost" onClick={() => setInModifica(undefined)}>Annulla</Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{c.testo}</p>
              )}
              {c.createdAt && inModifica?.id !== c.id && puoModificareCommento(io, festa, task, c) && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setInModifica({ id: c.id, testo: c.testo })}>
                  <Pencil aria-hidden />
                  Modifica
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puo && (
        <div className="flex flex-col gap-2">
          <AreaTesto id="nuovo-commento" label="Scrivi un commento" value={testo} maxLength={2000} onChange={(e) => setTesto(e.target.value)} />
          <Button size="lg" variant="outline" onClick={invia} disabled={!testo.trim() || invio}>
            <Send aria-hidden />
            {invio ? "Invio..." : "Invia"}
          </Button>
        </div>
      )}
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
    </Sezione>
  );
}

const NOMI_CAMPO: Record<string, string> = {
  titolo: "titolo",
  descrizione: "dettagli",
  scadenza: "scadenza",
  priorita: "urgenza",
  checklist: "checklist",
  link: "link",
  motivoBlocco: "motivo del blocco",
  motivoRifiuto: "motivo del rifiuto",
  eliminato: "eliminazione",
};

export function descriviStorico(
  voce: Pick<Storico, "azione" | "diff">,
  nomeDi: (uid: string | null | undefined) => string,
  nomeCommissione: (id: string) => string,
): string {
  const d = (voce.diff ?? {}) as Record<string, { prima?: unknown; dopo?: unknown }>;
  switch (voce.azione) {
    case "creato":
      return "ha creato il task";
    case "richiesta":
      return "ha inviato la richiesta";
    case "stato": {
      const { prima, dopo } = d.stato as { prima: keyof typeof NOMI_STATO; dopo: keyof typeof NOMI_STATO };
      if (prima === "richiesta" && dopo === "da_fare") return "ha accettato la richiesta";
      if (prima === "richiesta" && dopo === "annullato") return d.motivoRifiuto ? "ha rifiutato la richiesta" : "ha ritirato la richiesta";
      return `ha cambiato lo stato: ${NOMI_STATO[prima] ?? prima} → ${NOMI_STATO[dopo] ?? dopo}`;
    }
    case "assegnato":
      return d.responsabileUid?.dopo ? `ha assegnato il task a ${nomeDi(String(d.responsabileUid.dopo))}` : "ha lasciato il task da assegnare";
    case "spostato":
      return `ha spostato il task in ${nomeCommissione(String(d.commissioneId?.dopo))}`;
    default:
      return `ha modificato: ${Object.keys(d).map((k) => NOMI_CAMPO[k] ?? k).join(", ")}`;
  }
}

export function StoricoTask({ task }: { task: TaskConId }) {
  const { festaId, nomeDi, commissioni } = useFesta();
  const storico = useStoricoTask(festaId, task.id);
  const nomeCommissione = (id: string) => commissioni.find((c) => c.id === id)?.nome ?? "un'altra commissione";

  return (
    <Sezione titolo="Storico" icona={<FileText className="size-5" aria-hidden />}>
      {storico.stato === "caricamento" && <Caricamento />}
      {storico.stato === "errore" && <Avviso tipo="errore">Non riesco a caricare lo storico.</Avviso>}
      {storico.stato === "ok" && !storico.dati.length && <p className="text-muted-foreground">Lo storico compare tra qualche secondo.</p>}
      {storico.stato === "ok" && storico.dati.length > 0 && (
        <ol className="flex flex-col gap-2">
          {storico.dati.map((v) => (
            <li key={v.id}>
              <span className="text-muted-foreground">{v.at ? formatQuando(v.at) : "adesso"} · </span>
              <strong>{nomeDi(v.attoreUid)}</strong> {descriviStorico(v, nomeDi, nomeCommissione)}
            </li>
          ))}
        </ol>
      )}
    </Sezione>
  );
}
