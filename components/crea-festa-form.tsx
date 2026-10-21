"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/campo";
import { Avviso } from "@/components/stato";
import { creaFesta, erroreCallable } from "@/lib/callable";
import { creaFestaInput, type CreaFestaInput } from "@/lib/schemas";

/** Solo superadmin. Crea anche la commissione Generale (SPEC 6.5). */
export function CreaFestaForm() {
  const router = useRouter();
  const [errore, setErrore] = useState<string>();
  const form = useForm<CreaFestaInput>({
    resolver: zodResolver(creaFestaInput),
    defaultValues: { nome: "", dataFesta: undefined, luogo: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    setErrore(undefined);
    try {
      const { slug } = await creaFesta({
        nome: v.nome,
        ...(v.dataFesta ? { dataFesta: v.dataFesta } : {}),
        ...(v.luogo ? { luogo: v.luogo } : {}),
      });
      router.push(`/gestione/f/${slug}`);
    } catch (err) {
      setErrore(erroreCallable(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Campo id="nome-festa" label="Nome della festa" placeholder="Festa di Colleiano 2027" errore={errors.nome?.message} {...form.register("nome")} />
      <Campo
        id="data-festa"
        label="Data (se la sapete già)"
        type="date"
        errore={errors.dataFesta?.message}
        {...form.register("dataFesta", { setValueAs: (v: string) => v || undefined })}
      />
      <Campo id="luogo-festa" label="Luogo (facoltativo)" placeholder="Colleiano" errore={errors.luogo?.message} {...form.register("luogo")} />
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        <PartyPopper aria-hidden />
        {isSubmitting ? "Creazione in corso..." : "Crea la festa"}
      </Button>
    </form>
  );
}
