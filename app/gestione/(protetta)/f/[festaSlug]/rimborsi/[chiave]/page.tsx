"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { CircleSlash, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, BottoneWhatsApp, Selezione, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { Scontrino } from "@/components/scontrino";
import { SpesaRiga } from "@/components/spesa-riga";
import { Avviso, Caricamento } from "@/components/stato";
import { annullaRimborso, erroreCallable, registraRimborso } from "@/lib/callable";
import { useMovimenti, useRimborsi } from "@/lib/data/spese";
import { useFesta } from "@/lib/festa-context";
import { formatEuro, formatGiorno, oggiPerInput } from "@/lib/format";
import { puoAnnullareRimborso, puoGestireCassa } from "@/lib/permissions";
import { modalitaRimborsoSchema, type Rimborso } from "@/lib/schemas";
import { crediti, daRimborsare, NOMI_MODALITA, type Credito, type RimborsoConId } from "@/lib/spese";
import { testi } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export default function RimborsoPersonaPage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <RimborsoPersona />
    </Suspense>
  );
}

function RimborsoPersona() {
  const { chiave } = useParams<{ chiave: string }>();
  const { festa, festaId, membri } = useFesta();
  const movimenti = useMovimenti(festaId);
  const rimborsi = useRimborsi(festaId);
  const indietro = `/gestione/f/${festa.slug}/rimborsi`;

  if (movimenti.stato === "caricamento" || rimborsi.stato === "caricamento") return <Caricamento />;
  if (movimenti.stato === "errore" || rimborsi.stato === "errore") {
    return <Avviso tipo="errore">Non riesco a caricare i rimborsi. Controlla la connessione e riprova.</Avviso>;
  }
  const c = crediti(movimenti.dati, membri).find((x) => x.chiave === decodeURIComponent(chiave));
  if (!c) {
    return (
      <>
        <TitoloPagina titolo="Rimborsi" indietro={indietro} />
        <StatoVuoto titolo="Niente da rimborsare">Questa persona non ha spese anticipate approvate.</StatoVuoto>
      </>
    );
  }
  const suoi = rimborsi.dati
    .filter((r) => (c.beneficiarioUid ? r.beneficiarioUid === c.beneficiarioUid : !r.beneficiarioUid && r.movimentiIds.some((id) => c.spese.some((m) => m.id === id))))
    .sort((a, b) => b.data.toMillis() - a.data.toMillis());

  return (
    <>
      <TitoloPagina titolo={c.nome} indietro={indietro} />
      <Card>
        <CardContent className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-muted-foreground">Anticipato</p>
            <p className="text-lg font-semibold tabular-nums">{formatEuro(c.anticipatoCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Rimborsato</p>
            <p className="text-lg font-semibold tabular-nums">{formatEuro(c.rimborsatoCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Da ricevere</p>
            <p className={cn("text-2xl font-semibold tabular-nums", c.daRimborsareCents ? "text-colleiano-rust" : "text-colleiano-success")}>
              {formatEuro(c.daRimborsareCents)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Rimborsa c={c} />

      <section className="flex flex-col gap-3" aria-labelledby="spese-persona">
        <h2 id="spese-persona" className="text-2xl">Le sue spese</h2>
        <div className="flex flex-col gap-3">
          {c.spese.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <ul>
                <SpesaRiga m={m} />
              </ul>
              {m.scontrini.length > 0 && (
                <div className="flex gap-2 pl-4">
                  {m.scontrini.map((s) => (
                    <Scontrino key={s.path} {...s} piccolo />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {suoi.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="rimborsi-persona">
          <h2 id="rimborsi-persona" className="text-2xl">Rimborsi ricevuti</h2>
          <ul className="flex flex-col gap-3">
            {suoi.map((r) => (
              <RigaRimborso key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** L'admin sceglie le spese, la modalità e la data, e il rimborso è registrato (SPEC 6.4). */
function Rimborsa({ c }: { c: Credito }) {
  const { festa, festaId, membri, io } = useFesta();
  const aperte = daRimborsare(c);
  const [aperto, setAperto] = useState(false);
  const [scelte, setScelte] = useState<Set<string>>(() => new Set(aperte.map((m) => m.id)));
  const [modalita, setModalita] = useState<Rimborso["modalita"]>("contanti");
  const [data, setData] = useState(oggiPerInput());
  const [nota, setNota] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [fatto, setFatto] = useState<{ totale: number; quante: number }>();
  const persona = membri.find((m) => m.uid === c.beneficiarioUid && m.attivo && m.uid !== io.uid);

  if (!puoGestireCassa(io, festa)) return null;

  if (fatto) {
    return (
      <div className="flex flex-col gap-3">
        <Avviso tipo="ok">Rimborso di {formatEuro(fatto.totale)} registrato.</Avviso>
        {persona && (
          <BottoneWhatsApp
            telefono={persona.telefono}
            testo={testi.rimborsoFatto({ nome: persona.nomeVisualizzato, importo: formatEuro(fatto.totale), modalita: NOMI_MODALITA[modalita].toLowerCase(), spese: fatto.quante })}
          >
            Avvisa {persona.nomeVisualizzato} su WhatsApp
          </BottoneWhatsApp>
        )}
      </div>
    );
  }
  if (!aperte.length) return null;
  if (!aperto) {
    return (
      <Button size="lg" onClick={() => setAperto(true)}>
        <HandCoins aria-hidden />
        Rimborsa
      </Button>
    );
  }

  const selezionate = aperte.filter((m) => scelte.has(m.id));
  const totale = selezionate.reduce((t, m) => t + m.importoCents, 0);

  async function registra() {
    setInCorso(true);
    setErrore(undefined);
    try {
      const testoNota = nota.trim();
      // Le callable trasformano undefined in null: il campo vuoto non si manda proprio.
      const r = await registraRimborso({ festaId, movimentiIds: selezionate.map((m) => m.id), modalita, data, ...(testoNota && { nota: testoNota }) });
      setFatto({ totale: r.totaleCents, quante: selezionate.length });
    } catch (err) {
      setErrore(erroreCallable(err));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Quali spese rimborsi?</legend>
          {aperte.map((m) => (
            <label key={m.id} className="flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                className="size-6 shrink-0 accent-colleiano-forest"
                checked={scelte.has(m.id)}
                onChange={() =>
                  setScelte((s) => {
                    const n = new Set(s);
                    if (n.has(m.id)) n.delete(m.id);
                    else n.add(m.id);
                    return n;
                  })
                }
              />
              <span className="flex-1">{m.descrizione}</span>
              <span className="tabular-nums">{formatEuro(m.importoCents)}</span>
            </label>
          ))}
        </fieldset>
        <Selezione id="modalita" label="Come" value={modalita} onChange={(e) => setModalita(e.target.value as Rimborso["modalita"])}>
          {modalitaRimborsoSchema.options.map((x) => (
            <option key={x} value={x}>
              {NOMI_MODALITA[x]}
            </option>
          ))}
        </Selezione>
        <Campo id="data-rimborso" label="Quando" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Campo id="nota-rimborso" label="Nota (facoltativa)" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={!selezionate.length || !data || inCorso} onClick={registra}>
            <HandCoins aria-hidden />
            {inCorso ? "Registrazione..." : `Registra il rimborso di ${formatEuro(totale)}`}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setAperto(false)} disabled={inCorso}>
            Annulla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RigaRimborso({ r }: { r: RimborsoConId }) {
  const { festa, festaId, io, nomeDi } = useFesta();
  const [motivo, setMotivo] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-colleiano-surface p-4">
      <div className={cn("flex items-start justify-between gap-3", r.annullato && "text-muted-foreground")}>
        <span>
          <span className="font-medium first-letter:uppercase">{formatGiorno(r.data)}</span>
          <span className="block text-[0.95rem] text-muted-foreground">
            {NOMI_MODALITA[r.modalita]} · {r.movimentiIds.length === 1 ? "1 spesa" : `${r.movimentiIds.length} spese`} · registrato da {nomeDi(r.createdBy)}
          </span>
          {r.nota && <span className="block">{r.nota}</span>}
        </span>
        <span className={cn("text-lg font-semibold tabular-nums", r.annullato && "line-through")}>{formatEuro(r.totaleCents)}</span>
      </div>
      {r.annullato && <p className="text-colleiano-danger">Annullato: {r.motivoAnnullamento}</p>}
      {!r.annullato && puoAnnullareRimborso(io, festa) && (
        motivo === undefined ? (
          <Button variant="outline" size="lg" className="self-start" onClick={() => setMotivo("")}>
            <CircleSlash aria-hidden />
            Annulla il rimborso
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-colleiano-danger/30 bg-colleiano-danger/5 p-4">
            <AreaTesto id={`motivo-${r.id}`} label="Perché lo annulli?" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                className="bg-colleiano-danger text-white hover:bg-colleiano-danger/90"
                disabled={inCorso || motivo.trim().length < 3}
                onClick={async () => {
                  setInCorso(true);
                  setErrore(undefined);
                  try {
                    await annullaRimborso({ festaId, rimborsoId: r.id, motivo: motivo.trim() });
                    setMotivo(undefined);
                  } catch (err) {
                    setErrore(erroreCallable(err));
                  } finally {
                    setInCorso(false);
                  }
                }}
              >
                <CircleSlash aria-hidden />
                Annulla il rimborso
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setMotivo(undefined)}>
                Indietro
              </Button>
            </div>
            {errore && <Avviso tipo="errore">{errore}</Avviso>}
          </div>
        )
      )}
    </li>
  );
}
