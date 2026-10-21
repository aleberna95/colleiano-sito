"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUtente } from "@/lib/auth-context";
import type { Io } from "@/lib/permissions";
import type { Commissione, Festa, Membro } from "@/lib/schemas";

export type CommissioneConId = Commissione & { id: string };

export type FestaCtx = {
  festaId: string;
  festa: Festa;
  /** Tutti i membri, anche disattivati: le liste filtrano su `attivo`. */
  membri: Membro[];
  commissioni: CommissioneConId[];
  io: Io;
  nomeDi: (uid: string | null | undefined) => string;
};

const Ctx = createContext<FestaCtx | null>(null);

type Dati = { festa?: Festa; membri?: Membro[]; commissioni?: CommissioneConId[]; errore?: boolean };

/** Dati della festa aperta, in tempo reale. */
export function FestaProvider({
  festaId,
  children,
  caricamento,
  errore,
}: {
  festaId: string;
  children: ReactNode;
  caricamento: ReactNode;
  errore: ReactNode;
}) {
  const { user, superadmin, profilo } = useUtente();
  const [dati, setDati] = useState<Dati>({});

  // Il layout monta un provider nuovo per ogni festa (key), quindi lo stato parte vuoto.
  useEffect(() => {
    const ko = () => setDati((d) => ({ ...d, errore: true }));
    const stop = [
      onSnapshot(doc(db, "feste", festaId), (s) => setDati((d) => ({ ...d, festa: s.data() as Festa })), ko),
      onSnapshot(
        collection(db, "feste", festaId, "membri"),
        (s) => setDati((d) => ({ ...d, membri: s.docs.map((m) => m.data() as Membro) })),
        ko,
      ),
      onSnapshot(
        collection(db, "feste", festaId, "commissioni"),
        (s) =>
          setDati((d) => ({
            ...d,
            commissioni: s.docs
              .map((c) => ({ id: c.id, ...(c.data() as Commissione) }))
              .sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome)),
          })),
        ko,
      ),
    ];
    return () => stop.forEach((s) => s());
  }, [festaId]);

  // La festa aperta viene ricordata (SPEC 6.1).
  useEffect(() => {
    if (profilo && profilo.ultimaFestaId !== festaId && !profilo.devoCambiarePassword) {
      updateDoc(doc(db, "users", user.uid), {
        ultimaFestaId: festaId,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      }).catch(() => {});
    }
  }, [festaId, profilo, user.uid]);

  const valore = useMemo<FestaCtx | null>(() => {
    if (!dati.festa || !dati.membri || !dati.commissioni) return null;
    const membri = dati.membri;
    const perUid = new Map(membri.map((m) => [m.uid, m]));
    return {
      festaId,
      festa: dati.festa,
      membri,
      commissioni: dati.commissioni,
      io: { uid: user.uid, superadmin, membro: perUid.get(user.uid) },
      nomeDi: (uid) => (uid ? (perUid.get(uid)?.nomeVisualizzato ?? "Persona rimossa") : "Nessuno"),
    };
  }, [dati, festaId, user.uid, superadmin]);

  if (dati.errore) return <>{errore}</>;
  if (!valore) return <>{caricamento}</>;
  return <Ctx.Provider value={valore}>{children}</Ctx.Provider>;
}

export function useFesta(): FestaCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFesta fuori da FestaProvider");
  return v;
}
