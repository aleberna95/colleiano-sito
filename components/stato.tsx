import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Schermata di caricamento a tutta pagina. */
export function Caricamento({ testo = "Caricamento..." }: { testo?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-3 p-8 text-muted-foreground" role="status">
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      {testo}
    </div>
  );
}

/** Messaggio di esito sotto un form: errore o conferma. */
export function Avviso({ tipo, children }: { tipo: "errore" | "ok"; children: ReactNode }) {
  const Icona = tipo === "errore" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tipo === "errore" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border p-3",
        tipo === "errore"
          ? "border-colleiano-danger/30 bg-white text-colleiano-danger"
          : "border-colleiano-success/40 bg-white text-colleiano-success",
      )}
    >
      <Icona className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
