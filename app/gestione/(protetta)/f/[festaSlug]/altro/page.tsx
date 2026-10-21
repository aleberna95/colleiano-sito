"use client";

import Link from "next/link";
import { ChevronRight, HandCoins, KeyRound, Layers, Settings, ShieldCheck, Users } from "lucide-react";
import { TitoloPagina } from "@/components/comuni";
import { useFesta } from "@/lib/festa-context";

export default function AltroPage() {
  const { festa, io } = useFesta();
  const base = `/gestione/f/${festa.slug}`;
  const voci = [
    { href: `${base}/rimborsi`, label: "Rimborsi", icona: HandCoins },
    { href: `${base}/commissioni`, label: "Commissioni", icona: Layers },
    { href: `${base}/persone`, label: "Persone", icona: Users },
    { href: `${base}/impostazioni`, label: "Impostazioni della festa", icona: Settings },
    { href: "/gestione/cambia-password", label: "Cambia la mia password", icona: KeyRound },
    ...(io.superadmin ? [{ href: "/gestione/admin", label: "Account e feste", icona: ShieldCheck }] : []),
  ];

  return (
    <>
      <TitoloPagina titolo="Altro" />
      <ul className="flex flex-col divide-y rounded-lg bg-card shadow-sm ring-1 ring-foreground/10">
        {voci.map(({ href, label, icona: Icona }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-4 px-5">
              <Icona className="size-6 text-colleiano-forest" aria-hidden />
              <span className="flex-1 text-lg">{label}</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
