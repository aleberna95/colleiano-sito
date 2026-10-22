import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { CalendarClock, CalendarDays, Info, Map as IconaMappa, MapPin, TriangleAlert, Wifi, type LucideIcon } from "lucide-react";
import { AdessoDopo } from "@/components/programma-pubblico";
import { CaricamentoPubblico, Copertina, dataFesta, LinkGrande, luoghiDellaMappa, Sezione, Testo } from "@/components/pubblico";
import { giorniAlla } from "@/lib/format";
import { oraDelServer } from "@/lib/programma";
import { avvisi, configSito, festaInEvidenza, mappa, programma, type SitoFestaPubblica } from "@/lib/sito-pubblico";
import { cn } from "@/lib/utils";

// Home del sito (SPEC 7.1): cos'è Colleiano, la prossima edizione, i link.
// In modalità festa, sopra: adesso/dopo, avvisi e tre bottoni enormi.
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
  const conMappa = festa ? (await mappa(festa.id)) !== null : false;
  const giorni = festa?.dataFesta ? giorniAlla(new Date(festa.dataFesta)) : undefined;
  const inFesta = festa?.modalitaFesta === true;
  // In modalità festa il titolo della pagina è il nome della festa.
  const TitoloCopertina = inFesta ? "p" : "h1";

  return (
    <>
      {festa && inFesta && <ModalitaFesta festa={festa} />}

      <Copertina immagine={config.immagineCopertina}>
        <TitoloCopertina className="font-heading text-5xl font-bold text-colleiano-linen">Colleiano</TitoloCopertina>
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
          {conMappa && <LinkGrande href="/mappa">Mappa del paese</LinkGrande>}
          <LinkGrande href="/info">Come arrivare e domande frequenti</LinkGrande>
          <LinkGrande href="/edizioni" chiaro>
            Edizioni passate
          </LinkGrande>
        </div>
      </Sezione>
    </>
  );
}

async function ModalitaFesta({ festa }: { festa: SitoFestaPubblica }) {
  const [eventi, dati, elenco] = await Promise.all([programma(festa.id), mappa(festa.id), avvisi(festa.id)]);
  return (
    <>
      <section className="bg-colleiano-forest text-colleiano-linen">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-8 pb-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold tracking-widest text-colleiano-linen/90 uppercase">Oggi è festa</p>
            <h1 className="text-4xl font-bold text-colleiano-linen">{festa.nome}</h1>
          </div>
          <AdessoDopo eventi={eventi} luoghi={luoghiDellaMappa(dati)} ora={oraDelServer()} />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        {elenco.length > 0 && (
          <section aria-label="Avvisi" className="flex flex-col gap-3">
            {elenco.map((a) => (
              <p
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-4 text-lg font-medium whitespace-pre-line shadow-sm",
                  a.tipo === "importante" ? "bg-colleiano-danger text-white" : "bg-white ring-1 ring-colleiano-forest/15",
                )}
              >
                {a.tipo === "importante" ? (
                  <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-label="Importante" />
                ) : (
                  <Info className="mt-0.5 size-6 shrink-0 text-colleiano-forest" aria-hidden />
                )}
                {a.testo}
              </p>
            ))}
          </section>
        )}

        <nav aria-label="La festa" className="grid grid-cols-3 gap-3">
          <BottoneEnorme href="/programma" icona={CalendarClock} nome="Programma" />
          <BottoneEnorme href="/mappa" icona={IconaMappa} nome="Mappa" />
          <BottoneEnorme href="/wifi" icona={Wifi} nome="Wi-Fi" />
        </nav>
      </div>
    </>
  );
}

function BottoneEnorme({ href, icona: Icona, nome }: { href: string; icona: LucideIcon; nome: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg bg-colleiano-rust px-2 text-lg font-bold text-white shadow-md"
    >
      <Icona className="size-10" aria-hidden />
      {nome}
    </Link>
  );
}
