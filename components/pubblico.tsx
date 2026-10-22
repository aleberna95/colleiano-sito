import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Clock, LoaderCircle } from "lucide-react";
import { formatData, formatOra } from "@/lib/format";
import type { EventoPubblico, MappaPubblica, SitoFestaPubblica } from "@/lib/sito-pubblico";
import { cn } from "@/lib/utils";

// Pezzi del sito pubblico, senza stato: li usano le pagine e l'anteprima del gestionale.

/** Testo scritto nel gestionale: le righe vuote separano i paragrafi. */
export function Testo({ testo, className }: { testo?: string; className?: string }) {
  const paragrafi = (testo ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={cn("flex flex-col gap-4 text-lg leading-relaxed", className)}>
      {paragrafi.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

/** Foto grande in cima con il titolo sopra; senza foto, il verde del sito. */
export function Copertina({ immagine, children }: { immagine?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "relative isolate flex items-end overflow-hidden bg-colleiano-forest text-colleiano-linen",
        immagine ? "min-h-[60svh]" : "min-h-56",
      )}
    >
      {immagine && (
        // eslint-disable-next-line @next/next/no-img-element -- immagine pubblica da Storage, già ridotta al caricamento
        <img src={immagine} alt="" className="absolute inset-0 -z-10 size-full object-cover" fetchPriority="high" />
      )}
      <div
        className="absolute inset-0 -z-10"
        style={{ background: "linear-gradient(to bottom, rgb(27 48 34 / 0.15) 0%, rgb(27 48 34 / 0.6) 55%, #1B3022 100%)" }}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-24 pb-10">{children}</div>
    </section>
  );
}

export function Sezione({
  titolo,
  sopratitolo,
  children,
  className,
}: {
  titolo: string;
  sopratitolo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10", className)}>
      <div className="flex flex-col gap-1">
        {sopratitolo && <p className="text-sm font-bold tracking-widest text-colleiano-rust uppercase">{sopratitolo}</p>}
        <h2 className="text-3xl font-bold">{titolo}</h2>
      </div>
      {children}
    </section>
  );
}

/** Pulsante-link grande con testo e freccia. */
export function LinkGrande({ href, children, chiaro = false }: { href: string; children: ReactNode; chiaro?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 rounded-lg px-5 text-lg font-medium shadow-sm",
        chiaro ? "bg-white text-colleiano-forest ring-1 ring-colleiano-forest/15" : "bg-colleiano-rust text-white",
      )}
    >
      {children}
      <ArrowRight className="size-5 shrink-0" aria-hidden />
    </Link>
  );
}

/** "Sabato 18 luglio 2026". */
export function dataFesta(festa: Pick<SitoFestaPubblica, "dataFesta">): string | undefined {
  const d = festa.dataFesta ? formatData(new Date(festa.dataFesta)) : undefined;
  return d && d[0].toUpperCase() + d.slice(1);
}

/** Card di un'edizione passata. */
export function CardEdizione({ festa }: { festa: SitoFestaPubblica }) {
  const copertina = festa.paginaPubblica.copertina ?? festa.paginaPubblica.galleria[0];
  return (
    <Link
      href={`/edizioni/${festa.slug}`}
      className="flex flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-colleiano-forest/10"
    >
      {copertina ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagine pubblica da Storage
        <img src={copertina} alt="" className="aspect-video w-full object-cover" loading="lazy" />
      ) : (
        <div className="aspect-video w-full bg-colleiano-forest/10" />
      )}
      <div className="flex items-center gap-3 p-5">
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-heading text-2xl font-bold text-colleiano-forest">{festa.nome}</span>
          {festa.dataFesta && <span className="text-colleiano-slate/80">{dataFesta(festa)}</span>}
        </div>
        <ArrowRight className="size-6 shrink-0 text-colleiano-rust" aria-hidden />
      </div>
    </Link>
  );
}

/** Programma per orario (SPEC 7.1). */
export function ListaProgramma({ eventi }: { eventi: EventoPubblico[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {eventi.map((e) => (
        <li key={e.id} className="flex flex-col gap-2 rounded-lg bg-white p-5 shadow-sm ring-1 ring-colleiano-forest/10">
          <p className="flex items-center gap-2 font-bold tracking-wide text-colleiano-rust">
            <Clock className="size-5" aria-hidden />
            {formatOra(new Date(e.inizio))}
            {e.fine && ` – ${formatOra(new Date(e.fine))}`}
          </p>
          <h3 className="text-2xl font-bold">{e.titolo}</h3>
          {e.descrizione && <Testo testo={e.descrizione} className="gap-2 text-base" />}
        </li>
      ))}
    </ol>
  );
}

export function Galleria({ foto, nome }: { foto: string[]; nome: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {foto.map((url, i) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- immagine pubblica da Storage */}
            <img src={url} alt={`${nome}, foto ${i + 1}`} className="aspect-square w-full rounded-md object-cover" loading="lazy" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function CaricamentoPubblico() {
  return (
    <div className="flex flex-1 items-center justify-center gap-3 p-16 text-colleiano-slate/80" role="status">
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      Un attimo...
    </div>
  );
}

/** Id → nome dei punti, per aprire sulla mappa il luogo di un evento. Senza disegno non c'è niente da aprire. */
export function luoghiDellaMappa(mappa: MappaPubblica | null): Record<string, string> {
  return Object.fromEntries((mappa?.punti ?? []).map((p) => [p.id, p.nome]));
}
