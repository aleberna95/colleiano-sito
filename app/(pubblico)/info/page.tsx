import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ChevronDown, MapPin, Navigation } from "lucide-react";
import { CaricamentoPubblico, Sezione, Testo } from "@/components/pubblico";
import { configSito } from "@/lib/sito-pubblico";

export const metadata: Metadata = { title: "Come arrivare · Colleiano" };

// Come arrivare e domande frequenti (SPEC 7.1).
export default function InfoPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-10">
        <h1 className="text-4xl font-bold">Come arrivare</h1>
      </div>
      <Suspense fallback={<CaricamentoPubblico />}>
        <Contenuto />
      </Suspense>
    </>
  );
}

async function Contenuto() {
  await connection();
  const config = await configSito();
  const vuoto = !config.indirizzo && !config.comeArrivare && !config.linkMappe && config.faq.length === 0;

  if (vuoto) {
    return (
      <Sezione titolo="Informazioni in arrivo">
        <p className="text-lg">Stiamo preparando indicazioni e risposte alle domande più frequenti.</p>
      </Sezione>
    );
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
        {config.indirizzo && (
          <p className="flex items-start gap-3 text-lg">
            <MapPin className="mt-1 size-6 shrink-0 text-colleiano-rust" aria-hidden />
            <span className="whitespace-pre-line">{config.indirizzo}</span>
          </p>
        )}
        {config.linkMappe && (
          <a
            href={config.linkMappe}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center justify-center gap-3 rounded-lg bg-colleiano-rust px-5 text-lg font-medium text-white shadow-sm"
          >
            <Navigation className="size-5" aria-hidden />
            Apri in Google Maps
          </a>
        )}
        {config.comeArrivare && <Testo testo={config.comeArrivare} />}
      </section>

      {config.faq.length > 0 && (
        <Sezione titolo="Domande frequenti" sopratitolo="Hai dei dubbi?" className="pb-14">
          <div className="flex flex-col gap-3">
            {config.faq.map((f) => (
              <details key={f.domanda} className="group rounded-lg bg-white shadow-sm ring-1 ring-colleiano-forest/10">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-5 font-heading text-lg font-bold text-colleiano-forest [&::-webkit-details-marker]:hidden">
                  {f.domanda}
                  <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <Testo testo={f.risposta} className="px-5 pb-5 text-base" />
              </details>
            ))}
          </div>
        </Sezione>
      )}
    </>
  );
}
