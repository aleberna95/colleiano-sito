import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "@/public/icona-colleiano.png";

// Sito pubblico colleiano.it (SPEC 7.1): niente login, al massimo 2 tocchi per arrivare a tutto.
export default function PubblicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grana flex min-h-full flex-1 flex-col">
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-colleiano-rust focus:p-4 focus:text-white"
      >
        Salta al contenuto
      </a>
      <header className="vetro sticky top-0 z-40">
        <nav aria-label="Principale" className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4">
          <Link href="/" className="mr-auto flex min-h-14 items-center gap-2">
            <Image src={logo} alt="" width={40} height={40} className="size-10 object-contain" priority />
            <span className="font-heading text-xl font-bold tracking-wide text-colleiano-forest">Colleiano</span>
          </Link>
          <Link href="/edizioni" className="flex min-h-12 items-center px-3 font-medium text-colleiano-forest">
            Edizioni
          </Link>
          <Link href="/info" className="flex min-h-12 items-center px-3 font-medium text-colleiano-forest">
            Info
          </Link>
        </nav>
      </header>

      <main id="contenuto" className="flex flex-1 flex-col">
        {children}
      </main>

      <footer className="bg-colleiano-forest text-colleiano-linen">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
          <p className="font-heading text-2xl">Colleiano</p>
          <ul className="flex flex-col">
            <li>
              <Link href="/info" className="flex min-h-12 items-center underline-offset-4 hover:underline">
                Come arrivare e domande frequenti
              </Link>
            </li>
            <li>
              <Link href="/edizioni" className="flex min-h-12 items-center underline-offset-4 hover:underline">
                Edizioni passate
              </Link>
            </li>
            <li>
              <Link href="/gestione" className="flex min-h-12 items-center underline-offset-4 hover:underline">
                Area del comitato
              </Link>
            </li>
          </ul>
          <p className="text-colleiano-linen/80">
            Sito di{" "}
            <a href="https://alessiobernardini.dev/qr" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Alessio Bernardini
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
