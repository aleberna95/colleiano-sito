"use client";

import { RotateCw } from "lucide-react";

// Se Firestore non risponde: un messaggio semplice e un pulsante per riprovare.
export default function ErrorePubblico({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-5 px-4 py-16">
      <h1 className="text-3xl font-bold">Qualcosa non va</h1>
      <p className="text-lg">Non riesco a caricare la pagina. Controlla la connessione e riprova.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="flex min-h-14 items-center gap-3 rounded-lg bg-colleiano-rust px-5 text-lg font-medium text-white"
      >
        <RotateCw className="size-5" aria-hidden />
        Riprova
      </button>
    </div>
  );
}
