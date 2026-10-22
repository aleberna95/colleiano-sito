"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, TitoloPagina } from "@/components/comuni";
import { FotoSito, ScegliFoto } from "@/components/foto-sito";
import { Avviso, Caricamento } from "@/components/stato";
import { salvaSitoConfig, togliImmagineSito, useSitoConfig, type DatiSitoConfig } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { puoModificareSito } from "@/lib/permissions";
import { testiSitoFormSchema, type TestiSitoForm } from "@/lib/schemas";

type Esito = { tipo: "ok" | "errore"; testo: string };

// "Testi del sito" (SPEC 7.1): chi siamo, come arrivare, domande frequenti. Solo superadmin.
export default function TestiSitoPage() {
  const { festa, io } = useFesta();
  const config = useSitoConfig();
  const indietro = `/gestione/f/${festa.slug}/sito`;

  if (!puoModificareSito(io)) {
    return (
      <>
        <TitoloPagina titolo="Testi del sito" indietro={indietro} />
        <Avviso tipo="errore">Solo i superadmin possono cambiare i testi del sito.</Avviso>
      </>
    );
  }
  if (config.stato === "caricamento") return <Caricamento />;
  if (config.stato === "errore") return <Avviso tipo="errore">Non riesco a caricare i testi. Riprova.</Avviso>;

  return (
    <>
      <TitoloPagina titolo="Testi del sito" indietro={indietro} />
      <p className="text-muted-foreground">Valgono per tutto il sito, tutto l&apos;anno.</p>
      <Copertina config={config.dati} uid={io.uid} />
      <FormTesti config={config.dati} uid={io.uid} />
    </>
  );
}

function Copertina({ config, uid }: { config: DatiSitoConfig; uid: string }) {
  const [esito, setEsito] = useState<Esito>();
  async function salva(immagineCopertina: string | undefined) {
    setEsito(undefined);
    try {
      await salvaSitoConfig(uid, { ...config, immagineCopertina });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Foto della home</h2>
        </CardTitle>
        <CardDescription>La foto grande in cima al sito: il paese, la piazza, la festa.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {config.immagineCopertina ? (
          <FotoSito
            url={config.immagineCopertina}
            alt="Foto della home"
            onTogli={async () => {
              const vecchia = config.immagineCopertina!;
              await salva(undefined);
              await togliImmagineSito(vecchia);
            }}
          />
        ) : (
          <ScegliFoto etichetta="Scegli la foto" cartella="sito/generale" onCaricate={([url]) => salva(url)} />
        )}
        {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
      </CardContent>
    </Card>
  );
}

function FormTesti({ config, uid }: { config: DatiSitoConfig; uid: string }) {
  const [esito, setEsito] = useState<Esito>();
  const form = useForm<TestiSitoForm>({
    resolver: zodResolver(testiSitoFormSchema),
    defaultValues: {
      chiSiamo: config.chiSiamo,
      comeArrivare: config.comeArrivare,
      indirizzo: config.indirizzo,
      linkMappe: config.linkMappe,
      faq: config.faq,
    },
  });
  const faq = useFieldArray({ control: form.control, name: "faq" });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    setEsito(undefined);
    try {
      await salvaSitoConfig(uid, { ...config, ...v });
      setEsito({ tipo: "ok", testo: "Testi salvati: sono già sul sito." });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Chi siamo</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AreaTesto id="chi-siamo" label="Cos'è Colleiano e cos'è la festa" rows={8} errore={errors.chiSiamo?.message} {...form.register("chiSiamo")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Come arrivare</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Campo id="indirizzo" label="Indirizzo" errore={errors.indirizzo?.message} {...form.register("indirizzo")} />
          <Campo
            id="link-mappe"
            label="Link di Google Maps"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/..."
            errore={errors.linkMappe?.message}
            {...form.register("linkMappe")}
          />
          <AreaTesto
            id="come-arrivare"
            label="Indicazioni e parcheggi"
            rows={6}
            errore={errors.comeArrivare?.message}
            {...form.register("comeArrivare")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Domande frequenti</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {faq.fields.length === 0 && <p className="text-muted-foreground">Nessuna domanda. Aggiungi quelle che vi fanno più spesso.</p>}
          {faq.fields.map((campo, i) => (
            <fieldset key={campo.id} className="flex flex-col gap-3 rounded-md border p-4">
              <legend className="px-1 font-medium">Domanda {i + 1}</legend>
              <Campo id={`faq-${i}-domanda`} label="Domanda" errore={errors.faq?.[i]?.domanda?.message} {...form.register(`faq.${i}.domanda`)} />
              <AreaTesto id={`faq-${i}-risposta`} label="Risposta" errore={errors.faq?.[i]?.risposta?.message} {...form.register(`faq.${i}.risposta`)} />
              <Button type="button" variant="outline" size="lg" onClick={() => faq.remove(i)}>
                <Trash2 aria-hidden />
                Togli la domanda
              </Button>
            </fieldset>
          ))}
          {faq.fields.length < 30 && (
            <Button type="button" variant="outline" size="lg" onClick={() => faq.append({ domanda: "", risposta: "" })}>
              <Plus aria-hidden />
              Aggiungi una domanda
            </Button>
          )}
        </CardContent>
      </Card>

      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        <Check aria-hidden />
        {isSubmitting ? "Salvataggio..." : "Salva i testi"}
      </Button>
    </form>
  );
}
