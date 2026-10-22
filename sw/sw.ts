/// <reference lib="webworker" />
// Un solo service worker per tutto colleiano.it (SPEC 7.3), scope `/`, con strategie diverse:
// - sito pubblico: cache offline completa (SPEC 7.2). In piazza, sul Wi-Fi, la pagina chiede di salvare
//   le pagine della festa con le loro risorse e immagini; da lì funziona anche senza segnale.
// - gestionale: solo l'app shell. I dati li tiene offline la persistenza di Firestore, qui non si toccano.
// Si compila con `pnpm build:sw` in public/sw.js.
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate, type SerwistPlugin } from "serwist";

declare const self: ServiceWorkerGlobalScope;

const CACHE = {
  sito: "sito-pagine",
  gestione: "gestione-pagine",
  statiche: "next-static",
  risorse: "risorse",
  immagini: "sito-immagini",
} as const;

const stessoSito = (url: URL) => url.origin === self.location.origin;
const delGestionale = (url: URL) => url.pathname === "/gestione" || url.pathname.startsWith("/gestione/");
/** Foto e disegno della mappa: indirizzi di Firebase Storage, che non cambiano mai (nome con data). */
const daStorage = (url: URL) => url.hostname === "firebasestorage.googleapis.com";

/** /mappa?punto=x e /mappa sono la stessa pagina: una sola copia. */
const senzaParametri: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const url = new URL(request.url);
    return `${url.origin}${url.pathname}`;
  },
};

const serwist = new Serwist({
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Pagine e dati delle navigazioni del gestionale: rete se c'è, altrimenti l'ultima copia.
      matcher: ({ request, url }) => stessoSito(url) && delGestionale(url) && (request.mode === "navigate" || request.headers.get("RSC") === "1"),
      handler: new NetworkFirst({
        cacheName: CACHE.gestione,
        networkTimeoutSeconds: 5,
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 })],
      }),
    },
    {
      // Pagine del sito: sempre la più fresca se c'è rete (gli avvisi), altrimenti la copia salvata.
      // Le navigazioni interne (RSC) non si salvano: offline falliscono e Next ricarica la pagina, che arriva da qui.
      matcher: ({ request, url }) => stessoSito(url) && !delGestionale(url) && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: CACHE.sito,
        networkTimeoutSeconds: 4,
        matchOptions: { ignoreVary: true },
        plugins: [senzaParametri],
      }),
    },
    {
      // JavaScript, CSS e font di Next: hanno l'impronta nel nome, non cambiano mai.
      matcher: ({ url }) => stessoSito(url) && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: CACHE.statiche,
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 24 * 3600 })],
      }),
    },
    {
      matcher: ({ url }) => daStorage(url),
      handler: new CacheFirst({
        cacheName: CACHE.immagini,
        plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 24 * 3600 })],
      }),
    },
    {
      matcher: ({ request, url }) => stessoSito(url) && ["image", "font", "style", "manifest"].includes(request.destination),
      handler: new StaleWhileRevalidate({ cacheName: CACHE.risorse, matchOptions: { ignoreVary: true } }),
    },
  ],
});

serwist.addEventListeners();

// ---- Salvataggio per l'offline (SPEC 7.2) ----

export type RichiestaSalva = { tipo: "salva-sito"; pagine: string[]; immagini: string[] };

/** Risorse citate nell'HTML di una pagina: script, CSS, font, immagini ottimizzate di Next. */
function risorseDi(html: string): string[] {
  const testo = html.replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
  return [...new Set(testo.match(/\/_next\/(?:static\/[^"'\s()\\<>,]+|image\?[^"'\s\\<>,]+)/g) ?? [])];
}

async function salvaSeManca(cache: Cache, url: string, init?: RequestInit) {
  if (await cache.match(url, { ignoreVary: true })) return;
  try {
    const r = await fetch(url, init);
    // Le immagini di un altro sito senza CORS arrivano "opache" (status 0): vanno bene lo stesso per <img>.
    if (r.ok || r.type === "opaque") await cache.put(url, r);
  } catch {
    // Pazienza: ci riprova la prossima volta che si apre il sito con la rete.
  }
}

async function immagine(cache: Cache, url: string) {
  if (await cache.match(url)) return;
  try {
    const r = await fetch(url, { mode: "cors" });
    if (r.ok) return void (await cache.put(url, r));
  } catch {
    // Storage senza CORS: si riprova in modalità opaca.
  }
  await salvaSeManca(cache, url, { mode: "no-cors" });
}

async function salvaSito({ pagine, immagini }: RichiestaSalva): Promise<boolean> {
  const [sito, statiche, risorse, foto] = await Promise.all([
    caches.open(CACHE.sito),
    caches.open(CACHE.statiche),
    caches.open(CACHE.risorse),
    caches.open(CACHE.immagini),
  ]);
  let tutto = true;
  const daSalvare = new Set<string>();
  await Promise.all(
    pagine.map(async (pagina) => {
      const url = new URL(pagina, self.location.origin).href;
      try {
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) throw new Error(String(r.status));
        await sito.put(url, r.clone());
        for (const risorsa of risorseDi(await r.text())) daSalvare.add(risorsa);
      } catch {
        tutto = false;
      }
    }),
  );
  await Promise.all([
    ...[...daSalvare].map((r) => salvaSeManca(r.startsWith("/_next/static/") ? statiche : risorse, new URL(r, self.location.origin).href)),
    ...immagini.map((u) => {
      const url = new URL(u, self.location.origin);
      return daStorage(url) ? immagine(foto, url.href) : salvaSeManca(risorse, url.href);
    }),
  ]);
  return tutto;
}

self.addEventListener("message", (event) => {
  const dati = event.data as RichiestaSalva | undefined;
  if (dati?.tipo !== "salva-sito") return;
  event.waitUntil(
    salvaSito(dati)
      .catch(() => false)
      .then((ok) => event.ports[0]?.postMessage({ ok })),
  );
});
