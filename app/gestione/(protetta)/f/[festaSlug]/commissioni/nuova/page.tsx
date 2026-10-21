"use client";

import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { TitoloPagina } from "@/components/comuni";
import { CommissioneForm } from "@/components/commissione-form";
import { Avviso } from "@/components/stato";
import { db } from "@/lib/firebase";
import { useFesta } from "@/lib/festa-context";
import { puoCreareCommissione } from "@/lib/permissions";

export default function NuovaCommissionePage() {
  const { festa, festaId, commissioni, io } = useFesta();
  const router = useRouter();
  const base = `/gestione/f/${festa.slug}/commissioni`;

  if (!puoCreareCommissione(io, festa)) return <Avviso tipo="errore">Solo un admin può creare commissioni.</Avviso>;

  return (
    <>
      <TitoloPagina titolo="Nuova commissione" indietro={base} />
      <Card>
        <CardContent>
          <CommissioneForm
            etichetta="Crea la commissione"
            onSalva={async (d) => {
              const ref = await addDoc(collection(db, "feste", festaId, "commissioni"), {
                nome: d.nome,
                ...(d.descrizione ? { descrizione: d.descrizione } : {}),
                ...(d.budgetCents !== undefined ? { budgetCents: d.budgetCents } : {}),
                colore: d.colore,
                icona: "users",
                ordine: Math.max(0, ...commissioni.map((c) => c.ordine)) + 1,
                generale: false,
                referentiUids: [],
                componentiUids: [],
                createdAt: serverTimestamp(),
                createdBy: io.uid,
                updatedAt: serverTimestamp(),
                updatedBy: io.uid,
              });
              router.push(`${base}/${ref.id}`);
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
