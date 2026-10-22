import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarDays, MapPin } from "lucide-react";
import { CaricamentoPubblico, Copertina, dataFesta, Galleria, LinkGrande, ListaProgramma, Sezione, Testo } from "@/components/pubblico";
import { edizione, programma } from "@/lib/sito-pubblico";

export async function generateMetadata({ params }: PageProps<"/edizioni/[slug]">): Promise<Metadata> {
  const festa = await edizione((await params).slug);
  return { title: festa ? `${festa.nome} · Colleiano` : "Edizione non trovata · Colleiano" };
}

// Pagina di un'edizione passata (SPEC 7.1): testo, foto, programma di quell'edizione.
export default function EdizionePage({ params }: PageProps<"/edizioni/[slug]">) {
  return (
    <Suspense fallback={<CaricamentoPubblico />}>
      <Contenuto params={params} />
    </Suspense>
  );
}

async function Contenuto({ params }: Pick<PageProps<"/edizioni/[slug]">, "params">) {
  await connection();
  const festa = await edizione((await params).slug);
  if (!festa) notFound();
  const eventi = await programma(festa.id);
  const { testo, copertina, galleria } = festa.paginaPubblica;

  return (
    <>
      <Copertina immagine={copertina}>
        <p className="text-sm font-bold tracking-widest text-colleiano-linen/90 uppercase">Edizione passata</p>
        <h1 className="text-4xl font-bold text-colleiano-linen">{festa.nome}</h1>
        {festa.dataFesta && (
          <p className="flex items-center gap-2 text-lg text-colleiano-linen/90">
            <CalendarDays className="size-5 shrink-0" aria-hidden />
            {dataFesta(festa)}
          </p>
        )}
        {festa.luogo && (
          <p className="flex items-center gap-2 text-lg text-colleiano-linen/90">
            <MapPin className="size-5 shrink-0" aria-hidden />
            {festa.luogo}
          </p>
        )}
      </Copertina>

      {testo && (
        <Sezione titolo="La festa">
          <Testo testo={testo} />
        </Sezione>
      )}

      {eventi.length > 0 && (
        <Sezione titolo="Il programma" sopratitolo="Com'è andata">
          <ListaProgramma eventi={eventi} />
        </Sezione>
      )}

      {galleria.length > 0 && (
        <Sezione titolo="Le foto">
          <Galleria foto={galleria} nome={festa.nome} />
        </Sezione>
      )}

      <Sezione titolo="Le altre edizioni" className="pb-14">
        <LinkGrande href="/edizioni" chiaro>
          Tutte le edizioni passate
        </LinkGrande>
      </Sezione>
    </>
  );
}
