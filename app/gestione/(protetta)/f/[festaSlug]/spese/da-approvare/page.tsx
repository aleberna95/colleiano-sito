"use client";

import { useState } from "react";
import { Ban, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaTesto, BottoneWhatsApp, StatoVuoto, TitoloPagina } from "@/components/comuni";
import { SpesaRiga } from "@/components/spesa-riga";
import { Avviso, Caricamento } from "@/components/stato";
import { decidiSpese, erroreCallable } from "@/lib/callable";
import { useMovimenti } from "@/lib/data/spese";
import { useFesta } from "@/lib/festa-context";
import { formatEuro } from "@/lib/format";
import { puoDecidereSpesa, puoGestireCassa, spesaPropria } from "@/lib/permissions";
import type { Membro } from "@/lib/schemas";
import { destinatarioSpesa, type MovimentoConId } from "@/lib/spese";
import { linkPagina, testi } from "@/lib/whatsapp";

type Esito = { testo: string; avvisi: { chiave: string; persona: Membro; testo: string }[] };

// Da approvare (SPEC 6.4): Approva / Rifiuta con motivo, anche più spese insieme.
export default function DaApprovarePage() {
  const { festa, festaId, membri, io } = useFesta();
  const stato = useMovimenti(festaId);
  const [scelte, setScelte] = useState<Set<string>>(new Set());
  const [rifiuto, setRifiuto] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [esito, setEsito] = useState<Esito>();
  const base = `/gestione/f/${festa.slug}`;
  const unicoAdmin = io.superadmin && !membri.some((x) => x.attivo && x.ruoloFesta === "admin" && x.uid !== io.uid);

  if (!puoGestireCassa(io, festa)) return <Avviso tipo="errore">Solo un admin approva le spese.</Avviso>;

  const inAttesa =
    stato.stato === "ok"
      ? stato.dati.filter((m) => m.tipo === "spesa" && m.stato === "in_attesa").sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
      : [];
  const decidibili = inAttesa.filter((m) => puoDecidereSpesa(io, festa, m, unicoAdmin));
  const mie = inAttesa.filter((m) => !puoDecidereSpesa(io, festa, m, unicoAdmin) && spesaPropria(io, m));
  const selezionate = decidibili.filter((m) => scelte.has(m.id));

  const alterna = (id: string) =>
    setScelte((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function decidi(azione: "approva" | "rifiuta") {
    const motivo = rifiuto?.trim();
    setInCorso(true);
    setErrore(undefined);
    setEsito(undefined);
    try {
      await decidiSpese({ festaId, movimentiIds: selezionate.map((m) => m.id), azione, ...(azione === "rifiuta" && { motivo }) });
      setEsito({
        testo: `${selezionate.length === 1 ? "Spesa" : `${selezionate.length} spese`} ${azione === "approva" ? "approvat" : "rifiutat"}${selezionate.length === 1 ? "a" : "e"}.`,
        avvisi: avvisi(selezionate, azione, motivo ?? ""),
      });
      setScelte(new Set());
      setRifiuto(undefined);
    } catch (err) {
      setErrore(erroreCallable(err));
    } finally {
      setInCorso(false);
    }
  }

  function avvisi(spese: MovimentoConId[], azione: "approva" | "rifiuta", motivo: string): Esito["avvisi"] {
    return spese.flatMap((m) => {
      const dest = destinatarioSpesa(m, membri, io.uid);
      if (!dest) return [];
      const comune = { nome: dest.nomeVisualizzato, descrizione: m.descrizione, importo: formatEuro(m.importoCents), link: linkPagina(`${base}/spese/${m.id}`) };
      return [{
        chiave: m.id,
        persona: dest,
        testo: azione === "approva" ? testi.spesaApprovata({ ...comune, anticipata: m.pagatoDa.tipo === "anticipata" }) : testi.spesaRifiutata({ ...comune, motivo }),
      }];
    });
  }

  return (
    <>
      <TitoloPagina titolo="Da approvare" indietro={`${base}/spese`} />

      {esito && (
        <div className="flex flex-col gap-3">
          <Avviso tipo="ok">{esito.testo}</Avviso>
          {esito.avvisi.map((a) => (
            <BottoneWhatsApp key={a.chiave} telefono={a.persona.telefono} testo={a.testo}>
              Avvisa {a.persona.nomeVisualizzato} su WhatsApp
            </BottoneWhatsApp>
          ))}
        </div>
      )}

      {stato.stato === "caricamento" && <Caricamento />}
      {stato.stato === "errore" && <Avviso tipo="errore">Non riesco a caricare le spese. Controlla la connessione e riprova.</Avviso>}
      {stato.stato === "ok" && !decidibili.length && (
        <StatoVuoto titolo="Niente da approvare">Quando qualcuno segnerà una spesa la troverai qui.</StatoVuoto>
      )}

      {decidibili.length > 0 && (
        <>
          <p className="text-muted-foreground">Tocca la casella delle spese da decidere, poi scegli Approva o Rifiuta.</p>
          <Button variant="ghost" size="lg" className="self-start" onClick={() => setScelte(new Set(selezionate.length === decidibili.length ? [] : decidibili.map((m) => m.id)))}>
            {selezionate.length === decidibili.length ? "Togli tutte" : "Scegli tutte"}
          </Button>
          <ul className="flex flex-col gap-3">
            {decidibili.map((m) => (
              <SpesaRiga
                key={m.id}
                m={m}
                prima={
                  <input
                    type="checkbox"
                    aria-label={`Scegli ${m.descrizione}`}
                    className="mt-1 size-7 shrink-0 accent-colleiano-forest"
                    checked={scelte.has(m.id)}
                    onChange={() => alterna(m.id)}
                  />
                }
              />
            ))}
          </ul>

          <div className="sticky bottom-20 flex flex-col gap-3 rounded-lg border bg-colleiano-surface p-4 shadow-md">
            <p className="font-medium">
              {selezionate.length
                ? `${selezionate.length} scelte · ${formatEuro(selezionate.reduce((t, m) => t + m.importoCents, 0))}`
                : "Nessuna spesa scelta"}
            </p>
            {rifiuto === undefined ? (
              <div className="flex flex-wrap gap-2">
                <Button size="lg" disabled={!selezionate.length || inCorso} onClick={() => decidi("approva")}>
                  <Check aria-hidden />
                  {inCorso ? "Attendi..." : "Approva"}
                </Button>
                <Button variant="outline" size="lg" disabled={!selezionate.length || inCorso} onClick={() => setRifiuto("")}>
                  <Ban aria-hidden />
                  Rifiuta
                </Button>
              </div>
            ) : (
              <>
                <AreaTesto id="motivo-rifiuto-spese" label="Perché le rifiuti?" value={rifiuto} maxLength={500} onChange={(e) => setRifiuto(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    className="bg-colleiano-danger text-white hover:bg-colleiano-danger/90"
                    disabled={inCorso || rifiuto.trim().length < 3}
                    onClick={() => decidi("rifiuta")}
                  >
                    <Ban aria-hidden />
                    Rifiuta
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => setRifiuto(undefined)}>
                    Indietro
                  </Button>
                </div>
              </>
            )}
            {errore && <Avviso tipo="errore">{errore}</Avviso>}
          </div>
        </>
      )}

      {mie.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="mie-in-attesa">
          <h2 id="mie-in-attesa" className="text-2xl">Le tue, in attesa</h2>
          <p className="text-muted-foreground">Le tue spese le approva un altro admin.</p>
          <ul className="flex flex-col gap-3">
            {mie.map((m) => (
              <SpesaRiga key={m.id} m={m} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
