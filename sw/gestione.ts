/// <reference lib="webworker" />
// Service worker del gestionale (SPEC 7.3 "PWA"): solo l'app shell.
// I dati li tiene offline la persistenza di Firestore, qui non si toccano.
// Si compila con `pnpm build:sw` in public/gestione/sw.js (scope /gestione/).
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";

declare const self: ServiceWorkerGlobalScope;

const stessoSito = (url: URL) => url.origin === self.location.origin;

const serwist = new Serwist({
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Pagine e dati delle navigazioni del gestionale: rete se c'è, altrimenti l'ultima copia.
      matcher: ({ request, url }) =>
        stessoSito(url) && url.pathname.startsWith("/gestione") && (request.mode === "navigate" || request.headers.get("RSC") === "1"),
      handler: new NetworkFirst({
        cacheName: "gestione-pagine",
        networkTimeoutSeconds: 5,
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 })],
      }),
    },
    {
      // JavaScript e CSS di Next: hanno l'impronta nel nome, non cambiano mai.
      matcher: ({ url }) => stessoSito(url) && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 24 * 3600 })],
      }),
    },
    {
      matcher: ({ request, url }) => stessoSito(url) && ["image", "font", "style", "manifest"].includes(request.destination),
      handler: new StaleWhileRevalidate({ cacheName: "risorse" }),
    },
  ],
});

serwist.addEventListeners();
