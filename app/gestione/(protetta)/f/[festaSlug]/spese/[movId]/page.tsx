"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Ban, Check, CircleSlash, FileText, HandCoins, Pencil, Receipt, RotateCcw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, BottoneWhatsApp, ConfermaAzione, Etichetta, Selezione, TitoloPagina } from "@/components/comuni";
import { BadgeStatoSpesa } from "@/components/spesa-riga";
import { Scontrino } from "@/components/scontrino";
import { Avviso, Caricamento } from "@/components/stato";
import { Sezione } from "@/components/task-sezioni";
import { annullaMovimento, decidiSpese, erroreCallable, ripresentaSpesa } from "@/lib/callable";
import { aggiornaSpesa, useMovimenti, useStoricoMovimento } from "@/lib/data/spese";
import { useFesta } from "@/lib/festa-context";
import { centsInEuroTesto, dataDaInput, dataPerInput, formatEuro, formatGiorno, formatQuando, parseEuro } from "@/lib/format";
import {
  commissioniPerSpesa,
  puoAnnullareMovimento,
  puoDecidereSpesa,
  puoModificareSpesa,
  puoRipresentareSpesa,
} from "@/lib/permissions";
import { chiaveBeneficiario, importoEuroSchema, type Membro } from "@/lib/schemas";
import { chiaveUrl, descriviStoricoMovimento, destinatarioSpesa, NOMI_STATO_SPESA, pagatoDaTesto, type MovimentoConId } from "@/lib/spese";
import { linkPagina, testi } from "@/lib/whatsapp";

export default function SpesaDettaglioPage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <SpesaDettaglio />
    </Suspense>
  );
}

function SpesaDettaglio() {
  const { movId } = useParams<{ movId: string }>();
  const { festa, festaId } = useFesta();
  const stato = useMovimenti(festaId);
  const indietro = `/gestione/f/${festa.slug}/spese`;

  if (stato.stato === "caricamento") return <Caricamento />;
  if (stato.stato === "errore") return <Avviso tipo="errore">Non riesco a caricare la spesa. Controlla la connessione e riprova.</Avviso>;
  const m = stato.dati.find((x) => x.id === movId);
  if (!m) {
    return (
      <>
        <TitoloPagina titolo="Spesa" indietro={indietro} />
        <Avviso tipo="errore">Questa spesa non esiste più o è stata ritirata.</Avviso>
      </>
    );
  }

  return (
    <>
      <TitoloPagina titolo={m.descrizione} indietro={indietro} />
      <Riepilogo m={m} />
      <Azioni m={m} />
      <Scontrini m={m} />
      <StoricoSpesa m={m} />
    </>
  );
}

function Riepilogo({ m }: { m: MovimentoConId }) {
  const { festa, commissioni, nomeDi } = useFesta();
  const comm = commissioni.find((c) => c.id === m.commissioneId);
  const entrata = m.tipo === "entrata";
  const chiave = chiaveBeneficiario(m);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="font-heading text-4xl text-colleiano-forest tabular-nums">
          {entrata ? "+" : ""}
          {formatEuro(m.importoCents)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeStatoSpesa stato={m.stato} />
          {comm && <Etichetta colore={comm.colore}>{comm.nome}</Etichetta>}
          <span className="text-muted-foreground">{entrata ? "Entrata" : m.categoria}</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Quando</dt>
          <dd className="first-letter:uppercase">{formatGiorno(m.dataSpesa)}</dd>
          {!entrata && (
            <>
              <dt className="text-muted-foreground">Chi ha pagato</dt>
              <dd>{m.pagatoDa.tipo === "cassa" ? "Cassa" : `${pagatoDaTesto(m, nomeDi)} (da rimborsare)`}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Segnata da</dt>
          <dd>{nomeDi(m.createdBy)}</dd>
          {m.approvatoDa && (
            <>
              <dt className="text-muted-foreground">Approvata da</dt>
              <dd>
                {nomeDi(m.approvatoDa)}
                {m.autoApprovata && " (unico admin)"}
              </dd>
            </>
          )}
        </dl>
        {m.motivo && (m.stato === "rifiutata" || m.stato === "annullata") && (
          <p className="rounded-md bg-colleiano-danger/5 p-3 text-colleiano-danger">
            <strong>{m.stato === "rifiutata" ? "Perché è stata rifiutata:" : "Perché è stata annullata:"}</strong> {m.motivo}
          </p>
        )}
        {m.stato === "rimborsata" && chiave && (
          <Button asChild variant="outline" size="lg">
            <Link href={`/gestione/f/${festa.slug}/rimborsi/${chiaveUrl(chiave)}`}>
              <HandCoins aria-hidden />
              Vedi i rimborsi di {pagatoDaTesto(m, nomeDi)}
            </Link>
          </Button>
        )}
        <BottoneWhatsApp
          testo={testi.condividiSpesa({
            descrizione: m.descrizione,
            importo: formatEuro(m.importoCents),
            commissione: comm?.nome ?? "",
            stato: NOMI_STATO_SPESA[m.stato],
            link: linkPagina(`/gestione/f/${festa.slug}/spese/${m.id}`),
          })}
        />
      </CardContent>
    </Card>
  );
}

type Esito = { testo: string; avvisi: { persona: Membro; testo: string }[] };

function Azioni({ m }: { m: MovimentoConId }) {
  const { festa, festaId, membri, io } = useFesta();
  const router = useRouter();
  const [esito, setEsito] = useState<Esito>();
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const [motivo, setMotivo] = useState<{ per: "rifiuta" | "annulla"; testo: string }>();
  const [modifica, setModifica] = useState(false);
  const unicoAdmin = io.superadmin && !membri.some((x) => x.attivo && x.ruoloFesta === "admin" && x.uid !== io.uid);
  const link = linkPagina(`/gestione/f/${festa.slug}/spese/${m.id}`);
  const importo = formatEuro(m.importoCents);
  const dest = destinatarioSpesa(m, membri, io.uid);

  async function esegui(azione: () => Promise<unknown>, nuovoEsito: Esito) {
    setInCorso(true);
    setErrore(undefined);
    setEsito(undefined);
    try {
      await azione();
      setEsito(nuovoEsito);
      setMotivo(undefined);
    } catch (err) {
      setErrore(erroreCallable(err));
    } finally {
      setInCorso(false);
    }
  }

  const decidi = puoDecidereSpesa(io, festa, m, unicoAdmin);
  const contenuto = [];

  if (decidi) {
    contenuto.push(
      <div key="decidi" className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={inCorso}
          onClick={() =>
            esegui(() => decidiSpese({ festaId, movimentiIds: [m.id], azione: "approva" }), {
              testo: "Spesa approvata.",
              avvisi: dest
                ? [{ persona: dest, testo: testi.spesaApprovata({ nome: dest.nomeVisualizzato, descrizione: m.descrizione, importo, anticipata: m.pagatoDa.tipo === "anticipata", link }) }]
                : [],
            })
          }
        >
          <Check aria-hidden />
          Approva
        </Button>
        {motivo?.per !== "rifiuta" && (
          <Button variant="outline" size="lg" disabled={inCorso} onClick={() => setMotivo({ per: "rifiuta", testo: "" })}>
            <X aria-hidden />
            Rifiuta
          </Button>
        )}
      </div>,
    );
  } else if (m.stato === "in_attesa") {
    contenuto.push(
      <p key="attesa" className="text-muted-foreground">
        In attesa che un admin la approvi.
      </p>,
    );
  }

  if (motivo) {
    const rifiuto = motivo.per === "rifiuta";
    contenuto.push(
      <div key="motivo" className="flex flex-col gap-3 rounded-md border border-colleiano-danger/30 bg-colleiano-danger/5 p-4">
        <AreaTesto
          id="motivo-spesa"
          label={rifiuto ? "Perché la rifiuti?" : "Perché la annulli?"}
          value={motivo.testo}
          maxLength={500}
          onChange={(e) => setMotivo({ ...motivo, testo: e.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            className="bg-colleiano-danger text-white hover:bg-colleiano-danger/90"
            disabled={inCorso || motivo.testo.trim().length < 3}
            onClick={() => {
              const testo = motivo.testo.trim();
              void esegui(
                () =>
                  rifiuto
                    ? decidiSpese({ festaId, movimentiIds: [m.id], azione: "rifiuta", motivo: testo })
                    : annullaMovimento({ festaId, movimentoId: m.id, motivo: testo }),
                {
                  testo: rifiuto ? "Spesa rifiutata." : "Spesa annullata.",
                  avvisi:
                    rifiuto && dest
                      ? [{ persona: dest, testo: testi.spesaRifiutata({ nome: dest.nomeVisualizzato, descrizione: m.descrizione, importo, motivo: testo, link }) }]
                      : [],
                },
              );
            }}
          >
            <Ban aria-hidden />
            {rifiuto ? "Rifiuta la spesa" : "Annulla la spesa"}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setMotivo(undefined)}>
            Indietro
          </Button>
        </div>
      </div>,
    );
  }

  if (puoRipresentareSpesa(io, festa, m)) {
    contenuto.push(
      <Button
        key="ripresenta"
        size="lg"
        disabled={inCorso}
        onClick={() => esegui(() => ripresentaSpesa({ festaId, movimentoId: m.id }), { testo: "Spesa rimandata in approvazione.", avvisi: [] })}
      >
        <RotateCcw aria-hidden />
        Ho corretto: rimandala in approvazione
      </Button>,
    );
  }

  if (puoModificareSpesa(io, festa, m)) {
    contenuto.push(
      modifica ? (
        <ModificaSpesa key="modifica" m={m} onFine={() => setModifica(false)} />
      ) : (
        <Button key="modifica" variant="outline" size="lg" onClick={() => setModifica(true)}>
          <Pencil aria-hidden />
          Modifica
        </Button>
      ),
      <ConfermaAzione
        key="ritira"
        etichetta="Ritira la spesa"
        domanda="Vuoi davvero ritirare questa spesa? Sparirà dall'elenco."
        conferma="Sì, ritira"
        icona={<Undo2 aria-hidden />}
        onConferma={async () => {
          try {
            await aggiornaSpesa(festaId, m.id, io.uid, { eliminato: true });
            router.push(`/gestione/f/${festa.slug}/spese`);
          } catch {
            setErrore("Non sono riuscito a ritirare la spesa. Riprova.");
          }
        }}
      />,
    );
  }

  if (puoAnnullareMovimento(io, festa, m) && !motivo) {
    contenuto.push(
      <Button key="annulla" variant="outline" size="lg" disabled={inCorso} onClick={() => setMotivo({ per: "annulla", testo: "" })}>
        <CircleSlash aria-hidden />
        Annulla {m.tipo === "entrata" ? "l'entrata" : "la spesa"}
      </Button>,
    );
  }

  if (!contenuto.length && !esito && !errore) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {esito && (
          <div className="flex flex-col gap-3">
            <Avviso tipo="ok">{esito.testo}</Avviso>
            {esito.avvisi.map((a) => (
              <BottoneWhatsApp key={a.persona.uid} telefono={a.persona.telefono} testo={a.testo}>
                Avvisa {a.persona.nomeVisualizzato} su WhatsApp
              </BottoneWhatsApp>
            ))}
          </div>
        )}
        {contenuto}
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
      </CardContent>
    </Card>
  );
}

function ModificaSpesa({ m, onFine }: { m: MovimentoConId; onFine: () => void }) {
  const { festa, festaId, commissioni, io } = useFesta();
  const sceglibili = commissioniPerSpesa(io, festa, commissioni);
  const [v, setV] = useState({
    importo: centsInEuroTesto(m.importoCents),
    descrizione: m.descrizione,
    commissioneId: m.commissioneId,
    categoria: m.categoria,
    data: dataPerInput(m.dataSpesa),
  });
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);

  async function salva() {
    const importo = importoEuroSchema.safeParse(v.importo);
    if (!importo.success) return setErrore(importo.error.issues[0]?.message);
    if (!v.descrizione.trim()) return setErrore("Scrivi cosa hai comprato.");
    setInCorso(true);
    setErrore(undefined);
    try {
      await aggiornaSpesa(festaId, m.id, io.uid, {
        importoCents: parseEuro(importo.data)!,
        descrizione: v.descrizione.trim(),
        commissioneId: v.commissioneId,
        categoria: v.categoria,
        dataSpesa: dataDaInput(v.data),
      });
      onFine();
    } catch {
      setErrore("Non sono riuscito a salvare. Riprova.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md bg-muted/60 p-4">
      <Campo id="mod-importo" label="Importo (euro)" inputMode="decimal" value={v.importo} onChange={(e) => setV({ ...v, importo: e.target.value })} />
      <Campo id="mod-descrizione" label="Cosa è" value={v.descrizione} maxLength={200} onChange={(e) => setV({ ...v, descrizione: e.target.value })} />
      <Selezione id="mod-commissione" label="Commissione" value={v.commissioneId} onChange={(e) => setV({ ...v, commissioneId: e.target.value })}>
        {[...sceglibili, ...commissioni.filter((c) => c.id === m.commissioneId && !sceglibili.includes(c))].map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Selezione>
      {festa.categorieSpesa.length > 1 && (
        <Selezione id="mod-categoria" label="Tipo di spesa" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })}>
          {festa.categorieSpesa.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Selezione>
      )}
      <Campo id="mod-data" label="Quando" type="date" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={salva} disabled={inCorso}>
          <Check aria-hidden />
          {inCorso ? "Salvataggio..." : "Salva"}
        </Button>
        <Button size="lg" variant="ghost" onClick={onFine} disabled={inCorso}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

function Scontrini({ m }: { m: MovimentoConId }) {
  if (m.tipo === "entrata") return null;
  return (
    <Sezione titolo="Scontrino" icona={<Receipt className="size-5" aria-hidden />}>
      {m.scontrini.length ? m.scontrini.map((s) => <Scontrino key={s.path} {...s} />) : <p className="text-muted-foreground">Nessuno scontrino.</p>}
    </Sezione>
  );
}

function StoricoSpesa({ m }: { m: MovimentoConId }) {
  const { festaId, nomeDi } = useFesta();
  const storico = useStoricoMovimento(festaId, m.id);
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
              <strong>{nomeDi(v.attoreUid)}</strong> {descriviStoricoMovimento(v)}
            </li>
          ))}
        </ol>
      )}
    </Sezione>
  );
}
