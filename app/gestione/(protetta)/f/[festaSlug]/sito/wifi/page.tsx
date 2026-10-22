"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso, Caricamento } from "@/components/stato";
import { salvaWifi, useMappa, usePunti } from "@/lib/data/sito";
import { useFesta } from "@/lib/festa-context";
import { puoModificareProgramma } from "@/lib/permissions";
import { wifiFormSchema, type Punto, type Wifi, type WifiForm } from "@/lib/schemas";

/** Il nome della rete in piazza (SPEC 7.2): resta sempre lo stesso. */
const RETE_PREDEFINITA = "colleiano-wifi";

// Wi-Fi della festa (SPEC 7.1): nome della rete, password, dove si trova. Sul sito diventa un QR.
export default function WifiPage() {
  const { festa, festaId, io } = useFesta();
  const mappa = useMappa(festaId);
  const punti = usePunti(festaId);
  const indietro = `/gestione/f/${festa.slug}/sito`;

  if (!puoModificareProgramma(io, festa)) {
    return (
      <>
        <TitoloPagina titolo="Wi-Fi" indietro={indietro} />
        <Avviso tipo="errore">Solo gli admin della festa possono cambiare il Wi-Fi.</Avviso>
      </>
    );
  }
  if (mappa.stato === "caricamento" || punti.stato === "caricamento") return <Caricamento />;
  if (mappa.stato === "errore" || punti.stato === "errore") return <Avviso tipo="errore">Non riesco a caricare il Wi-Fi. Riprova.</Avviso>;

  return (
    <>
      <TitoloPagina titolo="Wi-Fi" indietro={indietro} />
      <p className="text-muted-foreground">
        Sul sito, nella pagina Wi-Fi, compaiono il nome della rete, la password e un QR: chi lo inquadra si collega senza scrivere nulla.
      </p>
      <FormWifi wifi={mappa.dati?.wifi} punti={punti.dati} onSalva={(v) => salvaWifi(festaId, io.uid, v)} />
    </>
  );
}

function FormWifi({ wifi, punti, onSalva }: { wifi?: Wifi; punti: (Punto & { id: string })[]; onSalva: (v: WifiForm) => Promise<void> }) {
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string }>();
  const form = useForm<WifiForm>({
    resolver: zodResolver(wifiFormSchema),
    defaultValues: { nomeRete: wifi?.nomeRete ?? RETE_PREDEFINITA, password: wifi?.password ?? "", puntoId: wifi?.puntoId ?? "" },
  });
  const { errors, isSubmitting } = form.formState;
  // I punti Wi-Fi della mappa per primi.
  const ordinati = [...punti].sort((a, b) => Number(b.categoria === "wifi") - Number(a.categoria === "wifi"));

  return (
    <Card>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(async (v) => {
            setEsito(undefined);
            try {
              await onSalva(v);
              setEsito({ tipo: "ok", testo: "Wi-Fi salvato." });
            } catch {
              setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
            }
          })}
        >
          <Campo id="wifi-rete" label="Nome della rete" autoCapitalize="none" errore={errors.nomeRete?.message} {...form.register("nomeRete")} />
          <Campo
            id="wifi-password"
            label="Password (vuota se la rete è aperta)"
            autoCapitalize="none"
            autoComplete="off"
            errore={errors.password?.message}
            {...form.register("password")}
          />
          <Selezione id="wifi-punto" label="Dove si trova (punto della mappa)" {...form.register("puntoId")}>
            <option value="">Nessun punto</option>
            {ordinati.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selezione>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Check aria-hidden />
            {isSubmitting ? "Salvataggio..." : "Salva il Wi-Fi"}
          </Button>
          {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
        </form>
      </CardContent>
    </Card>
  );
}
