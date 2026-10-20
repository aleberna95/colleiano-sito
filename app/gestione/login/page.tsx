"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { KeyRound, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { Avviso, Caricamento } from "@/components/stato";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { messaggioErrore } from "@/lib/auth-errors";

const loginSchema = z.object({
  email: z.email("Scrivi un'email valida"),
  password: z.string().min(1, "Scrivi la password"),
});
const resetSchema = loginSchema.pick({ email: true });

export default function LoginPage() {
  const router = useRouter();
  const stato = useAuth();
  const [modo, setModo] = useState<"login" | "reset">("login");

  useEffect(() => {
    if (stato.status === "signedIn") router.replace("/gestione");
  }, [stato.status, router]);

  if (stato.status !== "signedOut") return <Caricamento />;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Image
        src="/icona-colleiano-scritte.png"
        alt="Colleiano"
        width={120}
        height={148}
        priority
        className="mx-auto"
      />
      {modo === "login" ? (
        <FormLogin onPasswordDimenticata={() => setModo("reset")} />
      ) : (
        <FormReset onIndietro={() => setModo("login")} />
      )}
    </main>
  );
}

function FormLogin({ onPasswordDimenticata }: { onPasswordDimenticata: () => void }) {
  const [errore, setErrore] = useState<string>();
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setErrore(undefined);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setErrore(messaggioErrore(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Entra nel gestionale</h1>
        </CardTitle>
        <CardDescription>Usa l&apos;email e la password che ti ha dato il comitato.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Campo
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            errore={errors.email?.message}
            {...form.register("email")}
          />
          <Campo
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            errore={errors.password?.message}
            {...form.register("password")}
          />
          {errore && <Avviso tipo="errore">{errore}</Avviso>}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <LogIn aria-hidden />
            {isSubmitting ? "Accesso in corso..." : "Entra"}
          </Button>
          <Button type="button" variant="ghost" onClick={onPasswordDimenticata}>
            <KeyRound aria-hidden />
            Password dimenticata?
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FormReset({ onIndietro }: { onIndietro: () => void }) {
  const [esito, setEsito] = useState<{ tipo: "errore" | "ok"; testo: string }>();
  const form = useForm({ resolver: zodResolver(resetSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setEsito(undefined);
    const ok = {
      tipo: "ok" as const,
      testo: "Fatto. Se l'email è registrata ti arriva un messaggio con il link per scegliere una nuova password. Controlla anche nello spam.",
    };
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEsito(ok);
    } catch (err) {
      // Non diciamo se l'account esiste o no
      if (err instanceof FirebaseError && err.code === "auth/user-not-found") setEsito(ok);
      else setEsito({ tipo: "errore", testo: messaggioErrore(err) });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Password dimenticata</h1>
        </CardTitle>
        <CardDescription>
          Scrivi la tua email: ti mandiamo un link per sceglierne una nuova. In alternativa chiedi a un
          admin una password temporanea.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Campo
            id="email-reset"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            errore={errors.email?.message}
            {...form.register("email")}
          />
          {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Mail aria-hidden />
            {isSubmitting ? "Invio in corso..." : "Mandami il link"}
          </Button>
          <Button type="button" variant="ghost" onClick={onIndietro}>
            Torna all&apos;accesso
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
