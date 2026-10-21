"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { collection, collectionGroup, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUtente } from "@/lib/auth-context";
import type { Festa } from "@/lib/schemas";

export type FestaConId = Festa & { id: string };
type Stato = { status: "loading" } | { status: "errore" } | { status: "ok"; feste: FestaConId[] };

const FesteContext = createContext<Stato>({ status: "loading" });

/** Le feste che posso aprire: tutte per il superadmin, quelle di cui sono membro attivo per gli altri. */
export function FesteProvider({ children }: { children: ReactNode }) {
  const { user, superadmin } = useUtente();
  const [stato, setStato] = useState<Stato>({ status: "loading" });

  useEffect(() => {
    const errore = () => setStato({ status: "errore" });
    if (superadmin) {
      return onSnapshot(
        collection(db, "feste"),
        (snap) => setStato({ status: "ok", feste: ordina(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Festa) }))) }),
        errore,
      );
    }
    const q = query(collectionGroup(db, "membri"), where("uid", "==", user.uid));
    return onSnapshot(
      q,
      async (snap) => {
        try {
          const ids = snap.docs.filter((d) => d.get("attivo") === true).map((d) => d.ref.parent.parent!.id);
          const feste = await Promise.all(ids.map((id) => getDoc(doc(db, "feste", id))));
          setStato({
            status: "ok",
            feste: ordina(feste.filter((f) => f.exists()).map((f) => ({ id: f.id, ...(f.data() as Festa) }))),
          });
        } catch {
          errore();
        }
      },
      errore,
    );
  }, [user.uid, superadmin]);

  return <FesteContext.Provider value={stato}>{children}</FesteContext.Provider>;
}

function ordina(feste: FestaConId[]) {
  return feste.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export function useFeste() {
  return useContext(FesteContext);
}
