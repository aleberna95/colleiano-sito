"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { deleteField, doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { Archive, ArchiveRestore, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { AreaTesto, ConfermaAzione, Selezione, TitoloPagina } from "@/components/comuni";
import { Avviso } from "@/components/stato";
import { db } from "@/lib/firebase";
import { useFesta } from "@/lib/festa-context";
import { centsInEuroTesto, dataDaInput, dataPerInput, formatData, formatEuro, parseEuro } from "@/lib/format";
import { puoArchiviareFesta, puoModificareFesta } from "@/lib/permissions";
import { dataGiornoSchema, statoFestaSchema } from "@/lib/schemas";

const formSchema = z.object({
  nome: z.string().trim().min(3, "Almeno 3 caratteri").max(80),
  dataFesta: dataGiornoSchema.or(z.literal("")),
  luogo: z.string().trim().max(120),
  budgetEuro: z.string().trim().regex(/^(\d+([.,]\d{1,2})?)?$/, "Scrivi un importo, es. 5000"),
  categorie: z.string(),
  stato: statoFestaSchema.exclude(["archiviata"]),
});
type Form = z.infer<typeof formSchema>;

const NOMI_STATO = { preparazione: "In preparazione", in_corso: "In corso", conclusa: "Conclusa", archiviata: "Archiviata" };

export default function ImpostazioniPage() {
  const { festa, festaId, io } = useFesta();
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string }>();
  const modificabile = puoModificareFesta(io, festa) && festa.stato !== "archiviata";
  const audit = () => ({ updatedAt: serverTimestamp(), updatedBy: io.uid });

  const form = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: festa.nome,
      dataFesta: dataPerInput(festa.dataFesta),
      luogo: festa.luogo ?? "",
      budgetEuro: centsInEuroTesto(festa.budgetTotaleCents),
      categorie: festa.categorieSpesa.join("\n"),
      stato: festa.stato === "archiviata" ? "conclusa" : festa.stato,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    setEsito(undefined);
    const budget = parseEuro(v.budgetEuro);
    const categorie = [...new Set(v.categorie.split("\n").map((s) => s.trim()).filter(Boolean))];
    try {
      await updateDoc(doc(db, "feste", festaId), {
        nome: v.nome,
        dataFesta: v.dataFesta ? Timestamp.fromDate(dataDaInput(v.dataFesta)) : deleteField(),
        luogo: v.luogo || deleteField(),
        budgetTotaleCents: budget ?? deleteField(),
        categorieSpesa: categorie.length ? categorie : ["Altro"],
        stato: v.stato,
        ...audit(),
      });
      setEsito({ tipo: "ok", testo: "Impostazioni salvate." });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  });

  return (
    <>
      <TitoloPagina titolo="Impostazioni" indietro={`/gestione/f/${festa.slug}/altro`} />

      {modificabile ? (
        <Card>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
              <Campo id="nome" label="Nome della festa" errore={errors.nome?.message} {...form.register("nome")} />
              <Campo id="data" label="Data" type="date" errore={errors.dataFesta?.message} {...form.register("dataFesta")} />
              <Campo id="luogo" label="Luogo" errore={errors.luogo?.message} {...form.register("luogo")} />
              <Campo
                id="budget"
                label="Budget totale in euro (facoltativo)"
                inputMode="decimal"
                errore={errors.budgetEuro?.message}
                {...form.register("budgetEuro")}
              />
              <AreaTesto id="categorie" label="Categorie di spesa (una per riga)" rows={6} {...form.register("categorie")} />
              <Selezione id="stato" label="A che punto siamo" {...form.register("stato")}>
                <option value="preparazione">{NOMI_STATO.preparazione}</option>
                <option value="in_corso">{NOMI_STATO.in_corso}</option>
                <option value="conclusa">{NOMI_STATO.conclusa}</option>
              </Selezione>
              {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
              <Button type="submit" size="lg" disabled={isSubmitting}>
                <Check aria-hidden />
                {isSubmitting ? "Salvataggio..." : "Salva"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="font-heading text-xl text-colleiano-forest">{festa.nome}</p>
            {festa.dataFesta && <p className="first-letter:uppercase">{formatData(festa.dataFesta)}</p>}
            {festa.luogo && <p>{festa.luogo}</p>}
            {festa.budgetTotaleCents !== undefined && <p>Budget: {formatEuro(festa.budgetTotaleCents)}</p>}
            <p>Stato: {NOMI_STATO[festa.stato]}</p>
            {!puoModificareFesta(io, festa) && <p className="text-muted-foreground">Solo gli admin possono modificare questi dati.</p>}
          </CardContent>
        </Card>
      )}

      {puoArchiviareFesta(io) && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Archivio</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {festa.stato === "archiviata" ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => updateDoc(doc(db, "feste", festaId), { stato: "conclusa", ...audit() })}
              >
                <ArchiveRestore aria-hidden />
                Riapri la festa
              </Button>
            ) : (
              <ConfermaAzione
                etichetta="Archivia la festa"
                domanda="Archiviare la festa? Resterà consultabile ma nessuno potrà più modificarla (tranne i superadmin)."
                conferma="Sì, archivia"
                icona={<Archive aria-hidden />}
                onConferma={() => updateDoc(doc(db, "feste", festaId), { stato: "archiviata", ...audit() })}
              />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
