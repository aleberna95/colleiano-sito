"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { User } from "@/lib/schemas";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: FirebaseUser; profilo: User | null; superadmin: boolean };

const AuthContext = createContext<AuthState>({ status: "loading" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    auth.languageCode = "it";
    let stopProfilo: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopProfilo?.();
      if (!user) {
        setState({ status: "signedOut" });
        return;
      }
      const token = await user.getIdTokenResult();
      const superadmin = token.claims.superadmin === true;
      stopProfilo = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          const profilo = snap.exists() ? (snap.data() as User) : null;
          if (profilo && !profilo.attivo) {
            void signOut(auth);
            return;
          }
          setState({ status: "signedIn", user, profilo, superadmin });
        },
        () => setState({ status: "signedIn", user, profilo: null, superadmin }),
      );
    });

    return () => {
      stopProfilo?.();
      stopAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Da usare solo dentro le pagine protette, dove l'utente c'è sicuramente. */
export function useUtente() {
  const state = useAuth();
  if (state.status !== "signedIn") throw new Error("useUtente fuori da una pagina protetta");
  return state;
}
