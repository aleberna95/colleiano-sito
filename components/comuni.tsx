"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { linkWhatsApp } from "@/lib/whatsapp";
import { COLORI_COMMISSIONE } from "@/lib/format";
import type { ColoreCommissione } from "@/lib/schemas";

/** Apre WhatsApp con il testo pronto (SPEC 6.6). Senza telefono è "Condividi". */
export function BottoneWhatsApp({
  testo,
  telefono,
  children,
  className,
}: {
  testo: string;
  telefono?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icona = telefono ? MessageCircle : Share2;
  return (
    <Button asChild size="lg" className={cn("bg-[#1f7a4d] text-white hover:bg-[#1f7a4d]/90", className)}>
      <a href={linkWhatsApp(testo, telefono)} target="_blank" rel="noopener noreferrer">
        <Icona aria-hidden />
        {children ?? (telefono ? "Avvisa su WhatsApp" : "Condividi")}
      </a>
    </Button>
  );
}

/** Azione importante in due passi visibili: niente popup nascosti. */
export function ConfermaAzione({
  etichetta,
  domanda,
  conferma,
  icona,
  onConferma,
  disabled,
}: {
  etichetta: string;
  domanda: string;
  conferma: string;
  icona?: ReactNode;
  onConferma: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [aperta, setAperta] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  if (!aperta) {
    return (
      <Button variant="outline" size="lg" onClick={() => setAperta(true)} disabled={disabled}>
        {icona}
        {etichetta}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-colleiano-danger/30 bg-colleiano-danger/5 p-4">
      <p className="font-medium">{domanda}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="destructive"
          size="lg"
          disabled={inCorso}
          className="bg-colleiano-danger text-white hover:bg-colleiano-danger/90"
          onClick={async () => {
            setInCorso(true);
            try {
              await onConferma();
            } finally {
              setInCorso(false);
              setAperta(false);
            }
          }}
        >
          {icona}
          {inCorso ? "Attendi..." : conferma}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setAperta(false)} disabled={inCorso}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

/** Menu a tendina nativo: il più semplice da usare dal telefono. */
export function Selezione({
  label,
  id,
  errore,
  children,
  className,
  ...props
}: ComponentProps<"select"> & { label: string; errore?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        aria-invalid={!!errore}
        className={cn(
          "h-12 w-full rounded-md border border-input bg-white px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {errore && <p className="text-colleiano-danger">{errore}</p>}
    </div>
  );
}

export function AreaTesto({
  label,
  id,
  errore,
  className,
  ...props
}: ComponentProps<"textarea"> & { label: string; errore?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={!!errore}
        className={cn(
          "w-full rounded-md border border-input bg-white px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
        {...props}
      />
      {errore && <p className="text-colleiano-danger">{errore}</p>}
    </div>
  );
}

export function TitoloPagina({ titolo, indietro, children }: { titolo: string; indietro?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {indietro && (
        <Link href={indietro} className="inline-flex min-h-12 items-center gap-2 self-start text-colleiano-forest underline-offset-4 hover:underline">
          <ArrowLeft className="size-5" aria-hidden />
          Indietro
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{titolo}</h1>
        {children}
      </div>
    </div>
  );
}

export function Etichetta({ colore, children }: { colore?: ColoreCommissione; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.95rem]",
        colore ? COLORI_COMMISSIONE[colore].classi : "border-colleiano-forest/20 bg-colleiano-forest/5 text-colleiano-forest",
      )}
    >
      {children}
    </span>
  );
}

export function StatoVuoto({ titolo, children }: { titolo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-colleiano-forest/25 p-8 text-center">
      <p className="font-heading text-xl text-colleiano-forest">{titolo}</p>
      {children && <div className="text-muted-foreground">{children}</div>}
    </div>
  );
}
