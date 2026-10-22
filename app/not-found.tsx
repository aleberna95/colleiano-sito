import Link from "next/link";
import { Home } from "lucide-react";

export default function NonTrovata() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-5 px-4 py-16">
      <h1 className="text-4xl font-bold">Pagina non trovata</h1>
      <p className="text-lg">Questa pagina non c&apos;è, o non c&apos;è più.</p>
      <Link href="/" className="flex min-h-14 items-center gap-3 rounded-lg bg-colleiano-rust px-5 text-lg font-medium text-white">
        <Home className="size-5" aria-hidden />
        Torna alla home
      </Link>
    </main>
  );
}
