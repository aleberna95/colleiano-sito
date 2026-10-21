"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Registra il service worker del gestionale (solo in produzione: in sviluppo darebbe pagine vecchie). */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/gestione/sw.js", { scope: "/gestione/" }).catch(() => {});
  }, []);
  return null;
}

function iscrivi(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** "Sei offline" (SPEC 9.1): le modifiche restano sul telefono e partono quando torna la rete. */
export function AvvisoOffline() {
  const online = useSyncExternalStore(iscrivi, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="sticky top-16 z-10 flex items-center gap-3 bg-amber-900 px-4 py-3 text-white">
      <WifiOff className="size-5 shrink-0" aria-hidden />
      <p>Sei offline. Quello che fai resta salvato sul telefono e parte appena torna la connessione.</p>
    </div>
  );
}

const CHIAVE_INSTALLA = "colleiano-installa-chiuso";
type EventoInstalla = Event & { prompt: () => Promise<void> };

function giaInstallata() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Istruzioni per mettere il gestionale sul telefono come un'app, al primo accesso (SPEC 9.1). */
export function IstruzioniInstallazione() {
  const [visibile, setVisibile] = useState(false);
  const [evento, setEvento] = useState<EventoInstalla>();
  const [iphone, setIphone] = useState(false);

  useEffect(() => {
    let chiuso = false;
    try {
      chiuso = localStorage.getItem(CHIAVE_INSTALLA) === "1";
    } catch {}
    if (chiuso || giaInstallata()) return;
    // Lettura del browser una volta sola, dopo il primo render (non esiste sul server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIphone(/iPhone|iPad|iPod/.test(navigator.userAgent));
    setVisibile(true);
    const prendi = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalla);
    };
    window.addEventListener("beforeinstallprompt", prendi);
    return () => window.removeEventListener("beforeinstallprompt", prendi);
  }, []);

  function chiudi() {
    try {
      localStorage.setItem(CHIAVE_INSTALLA, "1");
    } catch {}
    setVisibile(false);
  }

  if (!visibile) return null;
  return (
    <section aria-labelledby="installa" className="flex flex-col gap-3 rounded-lg border-2 border-colleiano-forest/20 bg-colleiano-forest/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id="installa" className="text-xl">Mettilo sul telefono come un&apos;app</h2>
        <Button variant="ghost" size="icon" aria-label="Chiudi" onClick={chiudi}>
          <X aria-hidden />
        </Button>
      </div>
      {evento ? (
        <Button
          size="lg"
          onClick={async () => {
            await evento.prompt();
            chiudi();
          }}
        >
          <Download aria-hidden />
          Installa
        </Button>
      ) : iphone ? (
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>
            Apri questa pagina con <strong>Safari</strong>.
          </li>
          <li>
            Tocca <Share className="inline size-5 align-text-bottom" aria-label="Condividi" /> <strong>Condividi</strong> (in basso).
          </li>
          <li>
            Scegli <SquarePlus className="inline size-5 align-text-bottom" aria-hidden /> <strong>Aggiungi alla schermata Home</strong>.
          </li>
        </ol>
      ) : (
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>
            Apri questa pagina con <strong>Chrome</strong>.
          </li>
          <li>
            Tocca i <strong>tre puntini ⋮</strong> in alto a destra.
          </li>
          <li>
            Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.
          </li>
        </ol>
      )}
      <Button variant="outline" size="lg" onClick={chiudi}>
        Ho capito
      </Button>
    </section>
  );
}
