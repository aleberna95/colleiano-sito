"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Caricamento } from "@/components/stato";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const CAMBIA_PASSWORD = "/gestione/cambia-password";

export default function ProtettaLayout({ children }: { children: React.ReactNode }) {
  const stato = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const devoCambiare = stato.status === "signedIn" && stato.profilo?.devoCambiarePassword === true;

  useEffect(() => {
    if (stato.status === "signedOut") router.replace("/gestione/login");
    else if (devoCambiare && pathname !== CAMBIA_PASSWORD) router.replace(CAMBIA_PASSWORD);
  }, [stato.status, devoCambiare, pathname, router]);

  if (stato.status !== "signedIn" || (devoCambiare && pathname !== CAMBIA_PASSWORD)) {
    return <Caricamento />;
  }

  const nome = stato.profilo?.nomeVisualizzato ?? stato.user.email;

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-colleiano-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
          <Link href="/gestione" className="flex items-center gap-2" aria-label="Home del gestionale">
            <Image src="/icona-colleiano.png" alt="" width={40} height={35} />
            <span className="font-heading text-xl font-semibold text-colleiano-forest">Colleiano</span>
          </Link>
          <span className="ml-auto hidden truncate text-muted-foreground sm:inline">{nome}</span>
          <Button variant="ghost" onClick={() => signOut(auth)} className="ml-auto sm:ml-0">
            <LogOut aria-hidden />
            Esci
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </>
  );
}
