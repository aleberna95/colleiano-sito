"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/campo";
import { AreaTesto, Selezione } from "@/components/comuni";
import { Avviso } from "@/components/stato";
import { centsInEuroTesto, COLORI_COMMISSIONE, parseEuro } from "@/lib/format";
import { coloreCommissioneSchema, commissioneFormSchema, type CommissioneForm as Valori, type Commissione } from "@/lib/schemas";

export type DatiCommissione = { nome: string; descrizione?: string; colore: Valori["colore"]; budgetCents?: number };

/** Form completo (admin). `soloDescrizione` per i referenti. */
export function CommissioneForm({
  iniziale,
  soloDescrizione = false,
  nomeBloccato = false,
  etichetta,
  onSalva,
}: {
  iniziale?: Pick<Commissione, "nome" | "descrizione" | "colore" | "budgetCents">;
  soloDescrizione?: boolean;
  nomeBloccato?: boolean;
  etichetta: string;
  onSalva: (dati: DatiCommissione) => Promise<void>;
}) {
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string }>();
  const form = useForm<Valori>({
    resolver: zodResolver(commissioneFormSchema),
    defaultValues: {
      nome: iniziale?.nome ?? "",
      descrizione: iniziale?.descrizione ?? "",
      colore: iniziale?.colore ?? "giallo",
      budgetEuro: centsInEuroTesto(iniziale?.budgetCents),
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    setEsito(undefined);
    try {
      await onSalva({
        nome: v.nome,
        descrizione: v.descrizione || undefined,
        colore: v.colore,
        budgetCents: parseEuro(v.budgetEuro),
      });
      setEsito({ tipo: "ok", testo: "Salvato." });
    } catch {
      setEsito({ tipo: "errore", testo: "Non sono riuscito a salvare. Riprova." });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {!soloDescrizione && (
        <Campo id="nome-comm" label="Nome" disabled={nomeBloccato} errore={errors.nome?.message} {...form.register("nome")} />
      )}
      <AreaTesto id="descr-comm" label="Di cosa si occupa (facoltativo)" errore={errors.descrizione?.message} {...form.register("descrizione")} />
      {!soloDescrizione && (
        <>
          <Selezione id="colore-comm" label="Colore" {...form.register("colore")}>
            {coloreCommissioneSchema.options.map((c) => (
              <option key={c} value={c}>
                {COLORI_COMMISSIONE[c].nome}
              </option>
            ))}
          </Selezione>
          <Campo
            id="budget-comm"
            label="Budget in euro (facoltativo)"
            inputMode="decimal"
            placeholder="es. 500"
            errore={errors.budgetEuro?.message}
            {...form.register("budgetEuro")}
          />
        </>
      )}
      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        <Check aria-hidden />
        {isSubmitting ? "Salvataggio..." : etichetta}
      </Button>
    </form>
  );
}
