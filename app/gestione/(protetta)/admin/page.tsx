"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avviso, Caricamento } from "@/components/stato";
import { db } from "@/lib/firebase";
import { useUtente } from "@/lib/auth-context";
import type { Festa, User } from "@/lib/schemas";

type Dati = { feste: (Festa & { id: string })[]; utenti: (User & { id: string })[] };

// Area del superadmin: account e feste (SPEC 3, gestione/admin).
export default function AdminPage() {
  const { superadmin } = useUtente();
  const router = useRouter();
  const [dati, setDati] = useState<Dati | "errore">();

  useEffect(() => {
    if (!superadmin) {
      router.replace("/gestione");
      return;
    }
    Promise.all([
      getDocs(query(collection(db, "feste"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "users"), orderBy("nome"))),
    ])
      .then(([feste, utenti]) =>
        setDati({
          feste: feste.docs.map((d) => ({ id: d.id, ...(d.data() as Festa) })),
          utenti: utenti.docs.map((d) => ({ id: d.id, ...(d.data() as User) })),
        }),
      )
      .catch(() => setDati("errore"));
  }, [superadmin, router]);

  if (!superadmin || dati === undefined) return <Caricamento />;
  if (dati === "errore") return <Avviso tipo="errore">Non riesco a caricare i dati. Riprova.</Avviso>;

  return (
    <>
      <h1 className="text-3xl">Account e feste</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Feste</h2>
          </CardTitle>
          {dati.feste.length === 0 && (
            <CardDescription>
              Nessuna festa ancora. La creazione della festa arriva con il prossimo aggiornamento.
            </CardDescription>
          )}
        </CardHeader>
        {dati.feste.length > 0 && (
          <CardContent>
            <ul className="divide-y">
              {dati.feste.map((f) => (
                <li key={f.id} className="py-3">
                  {f.nome}
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Account</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {dati.utenti.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 py-3">
                <span className="font-medium">
                  {u.nome} {u.cognome}
                </span>
                <span className="text-muted-foreground">{u.email}</span>
                {u.superadmin && <span className="text-colleiano-rust">Superadmin</span>}
                {!u.attivo && <span className="text-colleiano-danger">Disattivato</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
