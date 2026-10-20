import { FirebaseError } from "firebase/app";

const MESSAGGI: Record<string, string> = {
  "auth/invalid-credential": "Email o password non corrette.",
  "auth/wrong-password": "Email o password non corrette.",
  "auth/user-not-found": "Email o password non corrette.",
  "auth/invalid-email": "L'email non è scritta bene.",
  "auth/user-disabled": "Questo account è stato disattivato. Chiedi a un admin.",
  "auth/too-many-requests": "Troppi tentativi. Aspetta qualche minuto e riprova.",
  "auth/network-request-failed": "Sei offline o la connessione è debole. Riprova.",
  "auth/weak-password": "La password è troppo debole.",
  "auth/requires-recent-login": "Per sicurezza esci, rientra e riprova.",
};

export function messaggioErrore(err: unknown): string {
  if (err instanceof FirebaseError && MESSAGGI[err.code]) return MESSAGGI[err.code];
  return "Qualcosa è andato storto. Riprova.";
}
