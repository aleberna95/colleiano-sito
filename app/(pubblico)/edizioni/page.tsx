import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { CaricamentoPubblico, CardEdizione } from "@/components/pubblico";
import { edizioni } from "@/lib/sito-pubblico";

export const metadata: Metadata = { title: "Edizioni passate · Colleiano" };

// Edizioni passate (SPEC 7.1): una card per ogni festa messa in archivio.
export default function EdizioniPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-4xl font-bold">Edizioni passate</h1>
      <Suspense fallback={<CaricamentoPubblico />}>
        <Elenco />
      </Suspense>
    </div>
  );
}

async function Elenco() {
  await connection();
  const feste = await edizioni();
  if (feste.length === 0) return <p className="text-lg">Qui troverai i ricordi delle feste passate. La prima arriva presto.</p>;
  return (
    <ul className="flex flex-col gap-5">
      {feste.map((f) => (
        <li key={f.id}>
          <CardEdizione festa={f} />
        </li>
      ))}
    </ul>
  );
}
