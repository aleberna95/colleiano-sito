import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = ComponentProps<typeof Input> & { label: string; errore?: string };

/** Etichetta + campo + messaggio d'errore, collegati per l'accessibilità. */
export function Campo({ label, errore, id, ...props }: Props) {
  const idErrore = errore ? `${id}-errore` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!errore} aria-describedby={idErrore} {...props} />
      {errore && (
        <p id={idErrore} className="text-colleiano-danger">
          {errore}
        </p>
      )}
    </div>
  );
}
