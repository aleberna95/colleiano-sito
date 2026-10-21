"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Archive, CheckSquare, Home, Menu, Wallet } from "lucide-react";
import { Avviso, Caricamento } from "@/components/stato";
import { useFeste } from "@/lib/feste-context";
import { FestaProvider, useFesta } from "@/lib/festa-context";
import { cn } from "@/lib/utils";

// Con Cache Components i parametri dinamici vanno letti dentro un <Suspense>.
export default function FestaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Caricamento />}>
      <FestaShell>{children}</FestaShell>
    </Suspense>
  );
}

function FestaShell({ children }: { children: ReactNode }) {
  const { festaSlug } = useParams<{ festaSlug: string }>();
  const stato = useFeste();

  if (stato.status === "loading") return <Caricamento />;
  if (stato.status === "errore") return <Avviso tipo="errore">Non riesco a caricare le feste. Riprova.</Avviso>;
  const festa = stato.feste.find((f) => f.slug === festaSlug);
  if (!festa) {
    return (
      <Avviso tipo="errore">
        Questa festa non esiste o non ne fai parte. <Link href="/gestione" className="underline">Torna all&apos;inizio</Link>
      </Avviso>
    );
  }

  return (
    <FestaProvider
      key={festa.id}
      festaId={festa.id}
      caricamento={<Caricamento />}
      errore={<Avviso tipo="errore">Non riesco a caricare la festa. Controlla la connessione e riprova.</Avviso>}
    >
      <SelettoreFesta />
      <div className="flex flex-col gap-6 pb-24">{children}</div>
      <BarraInBasso base={`/gestione/f/${festa.slug}`} />
    </FestaProvider>
  );
}

function SelettoreFesta() {
  const stato = useFeste();
  const { festa, festaId } = useFesta();
  const router = useRouter();
  const feste = stato.status === "ok" ? stato.feste : [];

  return (
    <div className="flex flex-col gap-2">
      {feste.length > 1 ? (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Festa</span>
          <select
            value={festaId}
            onChange={(e) => {
              const scelta = feste.find((f) => f.id === e.target.value);
              if (scelta) router.push(`/gestione/f/${scelta.slug}`);
            }}
            className="h-12 rounded-md border border-input bg-white px-3 font-heading text-lg text-colleiano-forest"
          >
            {feste.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="font-heading text-lg text-colleiano-forest">{festa.nome}</p>
      )}
      {festa.stato === "archiviata" && (
        <p className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <Archive className="size-5" aria-hidden />
          Festa archiviata: si può solo consultare.
        </p>
      )}
    </div>
  );
}

const VOCI = [
  { href: "", label: "Le mie cose", icona: Home },
  { href: "/task", label: "Task", icona: CheckSquare },
  { href: "/spese", label: "Spese", icona: Wallet },
  { href: "/altro", label: "Altro", icona: Menu },
];
const SOTTO_ALTRO = ["/altro", "/persone", "/commissioni", "/impostazioni", "/rimborsi"];

function BarraInBasso({ base }: { base: string }) {
  const pathname = usePathname();
  const resto = pathname.slice(base.length);
  const attiva = (href: string) =>
    href === "" ? resto === "" : href === "/altro" ? SOTTO_ALTRO.some((s) => resto.startsWith(s)) : resto.startsWith(href);

  return (
    <nav aria-label="Sezioni" className="fixed inset-x-0 bottom-0 z-10 border-t bg-colleiano-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-5xl grid-cols-4">
        {VOCI.map(({ href, label, icona: Icona }) => (
          <li key={href}>
            <Link
              href={`${base}${href}`}
              aria-current={attiva(href) ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[0.95rem]",
                attiva(href) ? "font-semibold text-colleiano-forest" : "text-muted-foreground",
              )}
            >
              <Icona className="size-6" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
