"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, KeyRound, Phone, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BottoneWhatsApp, ConfermaAzione, Etichetta, Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { aggiornaRuoli, disattivaPersona, erroreCallable, nuovaPasswordTemporanea } from "@/lib/callable";
import { useFesta } from "@/lib/festa-context";
import { NOMI_RUOLO_COMMISSIONE, NOMI_RUOLO_FESTA } from "@/lib/format";
import { puoGestireMembriCommissione, puoGestirePersona } from "@/lib/permissions";
import type { Membro, RuoloCommissione, RuoloFesta } from "@/lib/schemas";
import { senza } from "@/lib/utils";
import { testi } from "@/lib/whatsapp";

export default function PersonaPage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <Persona />
    </Suspense>
  );
}

function Persona() {
  const { uid } = useParams<{ uid: string }>();
  const { festa, membri } = useFesta();
  const membro = membri.find((m) => m.uid === uid);
  const indietro = `/gestione/f/${festa.slug}/persone`;

  if (!membro) return <Avviso tipo="errore">Persona non trovata in questa festa.</Avviso>;
  return (
    <>
      <TitoloPagina titolo={membro.nomeVisualizzato} indietro={indietro} />
      {!membro.attivo && <Avviso tipo="errore">Questa persona non fa più parte della festa.</Avviso>}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <a href={`tel:${membro.telefono.replace(/\s/g, "")}`} className="flex min-h-12 items-center gap-3 text-lg text-colleiano-forest underline-offset-4 hover:underline">
            <Phone className="size-5" aria-hidden />
            {membro.telefono}
          </a>
          <div className="flex flex-wrap gap-2">
            <Etichetta>{NOMI_RUOLO_FESTA[membro.ruoloFesta]}</Etichetta>
          </div>
        </CardContent>
      </Card>
      {membro.attivo && <Ruoli key={JSON.stringify([membro.ruoloFesta, membro.commissioni])} membro={membro} />}
      {membro.attivo && <Azioni membro={membro} />}
    </>
  );
}

function Ruoli({ membro }: { membro: Membro }) {
  const { festa, festaId, commissioni, io } = useFesta();
  const [ruoloFesta, setRuoloFesta] = useState<RuoloFesta>(membro.ruoloFesta);
  const [ruoli, setRuoli] = useState<Record<string, RuoloCommissione>>(membro.commissioni);
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string }>();
  const [salvando, setSalvando] = useState(false);

  const gestibili = commissioni.filter((c) => !c.generale);
  const puoRuoloFesta = io.superadmin && membro.uid !== io.uid;
  const qualcosaModificabile = puoRuoloFesta || gestibili.some((c) => puoGestireMembriCommissione(io, festa, c.id));
  const cambiato =
    ruoloFesta !== membro.ruoloFesta || JSON.stringify(ordina(ruoli)) !== JSON.stringify(ordina(membro.commissioni));

  if (!qualcosaModificabile) {
    return Object.keys(membro.commissioni).length ? (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Commissioni</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {gestibili
            .filter((c) => membro.commissioni[c.id])
            .map((c) => (
              <Etichetta key={c.id} colore={c.colore}>
                {c.nome} · {NOMI_RUOLO_COMMISSIONE[membro.commissioni[c.id]].toLowerCase()}
              </Etichetta>
            ))}
        </CardContent>
      </Card>
    ) : null;
  }

  async function salva() {
    setSalvando(true);
    setEsito(undefined);
    try {
      await aggiornaRuoli({ festaId, uid: membro.uid, commissioni: ruoli, ...(puoRuoloFesta ? { ruoloFesta } : {}) });
      setEsito({ tipo: "ok", testo: "Ruoli salvati." });
    } catch (err) {
      setEsito({ tipo: "errore", testo: erroreCallable(err) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Ruoli</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {puoRuoloFesta && (
          <Selezione id="ruolo-festa" label="Ruolo nella festa" value={ruoloFesta} onChange={(e) => setRuoloFesta(e.target.value as RuoloFesta)}>
            <option value="membro">Membro</option>
            <option value="admin">Admin</option>
          </Selezione>
        )}
        {gestibili.length === 0 && <p className="text-muted-foreground">Non ci sono ancora commissioni.</p>}
        {gestibili.map((c) => (
          <Selezione
            key={c.id}
            id={`comm-${c.id}`}
            label={c.nome}
            value={ruoli[c.id] ?? ""}
            disabled={!puoGestireMembriCommissione(io, festa, c.id)}
            onChange={(e) => {
              const v = e.target.value as RuoloCommissione | "";
              setRuoli((r) => (v ? { ...senza(r, c.id), [c.id]: v } : senza(r, c.id)));
            }}
          >
            <option value="">Non ne fa parte</option>
            <option value="componente">Componente</option>
            <option value="referente">Referente</option>
          </Selezione>
        ))}
        {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
        <Button size="lg" onClick={salva} disabled={!cambiato || salvando}>
          <Check aria-hidden />
          {salvando ? "Salvataggio..." : "Salva i ruoli"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ordina(r: Record<string, string>) {
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));
}

function Azioni({ membro }: { membro: Membro }) {
  const { festa, festaId, io } = useFesta();
  const router = useRouter();
  const [errore, setErrore] = useState<string>();
  const [credenziali, setCredenziali] = useState<Awaited<ReturnType<typeof nuovaPasswordTemporanea>>>();
  const [generando, setGenerando] = useState(false);

  if (!puoGestirePersona(io, festa, membro)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Azioni</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {credenziali ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-md bg-muted p-3">
              Nuova password temporanea: <strong className="font-mono text-lg">{credenziali.password}</strong>
            </p>
            <BottoneWhatsApp
              telefono={credenziali.telefono}
              testo={testi.nuovaPassword({ nome: credenziali.nome, email: credenziali.email, password: credenziali.password })}
            >
              Manda la password su WhatsApp
            </BottoneWhatsApp>
          </div>
        ) : (
          <Button
            variant="outline"
            size="lg"
            disabled={generando}
            onClick={async () => {
              setErrore(undefined);
              setGenerando(true);
              try {
                setCredenziali(await nuovaPasswordTemporanea({ festaId, uid: membro.uid }));
              } catch (err) {
                setErrore(erroreCallable(err));
              } finally {
                setGenerando(false);
              }
            }}
          >
            <KeyRound aria-hidden />
            {generando ? "Attendi..." : "Nuova password temporanea"}
          </Button>
        )}
        <ConfermaAzione
          etichetta="Togli dalla festa"
          domanda={`Togliere ${membro.nomeVisualizzato} dalla festa? I suoi task aperti torneranno "da assegnare". Spese e storico restano.`}
          conferma="Sì, togli"
          icona={<UserMinus aria-hidden />}
          onConferma={async () => {
            setErrore(undefined);
            try {
              await disattivaPersona({ festaId, uid: membro.uid });
              router.push(`/gestione/f/${festa.slug}/persone`);
            } catch (err) {
              setErrore(erroreCallable(err));
            }
          }}
        />
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
      </CardContent>
    </Card>
  );
}
