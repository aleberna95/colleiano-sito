import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { MappaPubblicaVista } from "@/components/mappa-pubblica";
import { CaricamentoPubblico } from "@/components/pubblico";
import { festaInEvidenza, mappa, programma } from "@/lib/sito-pubblico";

export const metadata: Metadata = { title: "Mappa · Colleiano" };

// Mappa della festa in evidenza (SPEC 7.1), con un QR dedicato.
export default function MappaPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-6 pb-14">
      <h1 className="text-4xl font-bold">Mappa</h1>
      <Suspense fallback={<CaricamentoPubblico />}>
        <Contenuto />
      </Suspense>
    </div>
  );
}

async function Contenuto() {
  await connection();
  const festa = await festaInEvidenza();
  const [dati, eventi] = festa ? await Promise.all([mappa(festa.id), programma(festa.id)]) : [null, []];
  if (!dati) return <p className="text-lg">La mappa del paese arriva con la prossima festa.</p>;
  return <MappaPubblicaVista mappa={dati} eventi={eventi} />;
}
