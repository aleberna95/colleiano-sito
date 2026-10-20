import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

// Segnaposto della Fase 1: il sito pubblico arriva in Fase 2 (SPEC 7.1).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="text-4xl">Colleiano</h1>
      <p>Il sito nuovo è in preparazione.</p>
      <Button asChild size="lg">
        <Link href="/gestione">
          <LogIn aria-hidden />
          Entra nel gestionale
        </Link>
      </Button>
    </main>
  );
}
