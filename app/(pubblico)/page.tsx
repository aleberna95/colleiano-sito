import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarDays, MapPin } from "lucide-react";
import { CaricamentoPubblico, Copertina, dataFesta, LinkGrande, Sezione, Testo } from "@/components/pubblico";
import { giorniAlla } from "@/lib/format";
import { configSito, festaInEvidenza } from "@/lib/sito-pubblico";

// Home del sito, stato normale (SPEC 7.1): cos'è Colleiano, la prossima edizione, i link.
export default function Home() {
  return (
    <Suspense fallback={<CaricamentoPubblico />}>
      <Contenuto />
    </Suspense>
  );
}

async function Contenuto() {
  await connection();
  const [config, festa] = await Promise.all([configSito(), festaInEvidenza()]);
  const giorni = festa?.dataFesta ? giorniAlla(new Date(festa.dataFesta)) : undefined;

  return (
    <>
      <Copertina immagine={config.immagineCopertina}>
        <h1 className="text-5xl font-bold text-colleiano-linen">Colleiano</h1>
        <p className="font-heading text-2xl text-colleiano-linen/90 italic">Festa del Paese</p>
      </Copertina>

      <Sezione titolo={festa?.nome ?? "La prossima festa"} sopratitolo="Prossima edizione">
        {festa ? (
          <div className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-sm ring-1 ring-colleiano-forest/10">
            {festa.dataFesta ? (
              <p className="flex items-center gap-2 text-lg">
                <CalendarDays className="size-5 shrink-0 text-colleiano-rust" aria-hidden />
                {dataFesta(festa)}
              </p>
            ) : (
              <p className="text-lg">In preparazione: la data arriva presto.</p>
            )}
            {festa.luogo && (
              <p className="flex items-center gap-2 text-lg">
                <MapPin className="size-5 shrink-0 text-colleiano-rust" aria-hidden />
                {festa.luogo}
              </p>
            )}
            {giorni !== undefined && giorni > 0 && (
              <p className="font-heading text-3xl font-bold text-colleiano-rust">
                {giorni === 1 ? "Manca 1 giorno" : `Mancano ${giorni} giorni`}
              </p>
            )}
            {giorni === 0 && <p className="font-heading text-3xl font-bold text-colleiano-rust">È oggi!</p>}
            {festa.paginaPubblica.testo && <Testo testo={festa.paginaPubblica.testo} />}
          </div>
        ) : (
          <p className="text-lg">In preparazione: la prossima edizione sarà annunciata presto.</p>
        )}
      </Sezione>

      {config.chiSiamo && (
        <Sezione titolo="Chi siamo" sopratitolo="Colleiano">
          <Testo testo={config.chiSiamo} />
        </Sezione>
      )}

      <Sezione titolo="Scopri di più" className="pb-14">
        <div className="flex flex-col gap-3">
          <LinkGrande href="/info">Come arrivare e domande frequenti</LinkGrande>
          <LinkGrande href="/edizioni" chiaro>
            Edizioni passate
          </LinkGrande>
        </div>
      </Sezione>
    </>
  );
}
