"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FirebaseError } from "firebase/app";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { Avviso } from "@/components/stato";
import { db } from "@/lib/firebase";
import { useUtente } from "@/lib/auth-context";
import { messaggioErrore } from "@/lib/auth-errors";

const schema = z
  .object({
    attuale: z.string().min(1, "Scrivi la password che stai usando adesso"),
    nuova: z.string().min(8, "Almeno 8 caratteri"),
    conferma: z.string(),
  })
  .refine((v) => v.nuova === v.conferma, {
    path: ["conferma"],
    message: "Le due password non sono uguali",
  })
  .refine((v) => v.nuova !== v.attuale, {
    path: ["nuova"],
    message: "Scegline una diversa da quella attuale",
  });

export default function CambiaPasswordPage() {
  const { user, profilo } = useUtente();
  const router = useRouter();
  const [errore, setErrore] = useState<string>();
  const obbligatorio = profilo?.devoCambiarePassword === true;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { attuale: "", nuova: "", conferma: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ attuale, nuova }) => {
    setErrore(undefined);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, attuale));
      await updatePassword(user, nuova);
      if (obbligatorio) {
        await updateDoc(doc(db, "users", user.uid), {
          devoCambiarePassword: false,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      }
      router.replace("/gestione");
    } catch (err) {
      const passwordSbagliata =
        err instanceof FirebaseError &&
        (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential");
      setErrore(passwordSbagliata ? "La password attuale non è corretta." : messaggioErrore(err));
    }
  });

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1>{obbligatorio ? "Scegli la tua password" : "Cambia password"}</h1>
        </CardTitle>
        <CardDescription>
          {obbligatorio
            ? "È il tuo primo accesso: sostituisci la password temporanea con una che conosci solo tu."
            : "Scrivi la password attuale e quella nuova."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Campo
            id="attuale"
            label={obbligatorio ? "Password temporanea" : "Password attuale"}
            type="password"
            autoComplete="current-password"
            errore={errors.attuale?.message}
            {...form.register("attuale")}
          />
          <Campo
            id="nuova"
            label="Nuova password (almeno 8 caratteri)"
            type="password"
            autoComplete="new-password"
            errore={errors.nuova?.message}
            {...form.register("nuova")}
          />
          <Campo
            id="conferma"
            label="Riscrivi la nuova password"
            type="password"
            autoComplete="new-password"
            errore={errors.conferma?.message}
            {...form.register("conferma")}
          />
          {errore && <Avviso tipo="errore">{errore}</Avviso>}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Check aria-hidden />
            {isSubmitting ? "Salvataggio..." : "Salva la password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
