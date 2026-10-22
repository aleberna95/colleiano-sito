import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ProgrammaVivo } from "@/components/programma-pubblico";
import { CaricamentoPubblico, luoghiDellaMappa } from "@/components/pubblico";
import { oraDelServer } from "@/lib/programma";
import { festaInEvidenza, mappa, programma } from "@/lib/sito-pubblico";

export const metadata: Metadata = { title: "Programma · Colleiano" };

// Programma della festa in evidenza (SPEC 7.1): lista per orario, il luogo si apre sulla mappa.
export default function ProgrammaPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-6 pb-14">
      <h1 className="text-4xl font-bold">Programma</h1>
      <Suspense fallback={<CaricamentoPubblico />}>
        <Contenuto />
      </Suspense>
    </div>
  );
}

async function Contenuto() {
  await connection();
  const festa = await festaInEvidenza();
  const [eventi, dati] = festa ? await Promise.all([programma(festa.id), mappa(festa.id)]) : [[], null];
  if (!festa || eventi.length === 0) return <p className="text-lg">Il programma arriva con la prossima festa.</p>;
  return (
    <>
      <p className="font-heading text-2xl text-colleiano-rust">{festa.nome}</p>
      <ProgrammaVivo eventi={eventi} luoghi={luoghiDellaMappa(dati)} ora={oraDelServer()} />
    </>
  );
}
