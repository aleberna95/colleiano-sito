import { cacheLife } from "next/cache";
import { CONFIG_SITO_VUOTA, type EventoProgramma, type SitoConfig, type SitoFesta } from "@/lib/schemas";

// Il sito pubblico legge Firestore dal server con l'API REST e senza login:
// valgono le stesse Security Rules di un visitatore (SPEC 7.3) e al telefono non arriva l'SDK di Firebase.

const emulatori =
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
  (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_USE_EMULATORS !== "false") ||
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const progetto = emulatori ? "demo-colleiano" : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const radice = `projects/${progetto}/databases/(default)/documents`;
const host = emulatori ? "http://127.0.0.1:8080/v1" : "https://firestore.googleapis.com/v1";
const chiave = emulatori ? "" : `?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`;

/** Le date diventano millisecondi: i dati passano dalla cache e ai componenti client. */
type Valore =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, Valore> } }
  | { arrayValue: { values?: Valore[] } };

function decodifica(v: Valore): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("mapValue" in v) return campi(v.mapValue.fields);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodifica);
  return undefined;
}

function campi(fields: Record<string, Valore> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodifica(v)]));
}

type DocRest = { name: string; fields?: Record<string, Valore> };
const conId = (d: DocRest) => ({ id: d.name.split("/").pop()!, ...campi(d.fields) });

/** Un documento, o null se non esiste o non è pubblico. */
async function leggi(percorso: string) {
  const r = await fetch(`${host}/${radice}/${percorso}${chiave}`);
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error(`Firestore ${r.status} su ${percorso}`);
  return conId((await r.json()) as DocRest);
}

/** Documenti di `collezione` (sotto `genitore`) con i campi uguali ai valori dati. */
async function cerca(collezione: string, uguali: Record<string, string | boolean>, genitore = "") {
  const filtri = Object.entries(uguali).map(([campo, valore]) => ({
    fieldFilter: {
      field: { fieldPath: campo },
      op: "EQUAL",
      value: typeof valore === "boolean" ? { booleanValue: valore } : { stringValue: valore },
    },
  }));
  const where = filtri.length === 0 ? undefined : filtri.length === 1 ? filtri[0] : { compositeFilter: { op: "AND", filters: filtri } };
  const r = await fetch(`${host}/${radice}${genitore ? `/${genitore}` : ""}:runQuery${chiave}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collezione }], ...(where && { where }) } }),
  });
  if (r.status === 403) return [];
  if (!r.ok) throw new Error(`Firestore ${r.status} su ${collezione}`);
  const righe = (await r.json()) as { document?: DocRest }[];
  return righe.flatMap((x) => (x.document ? [conId(x.document)] : []));
}

export type SitoFestaPubblica = Omit<SitoFesta, "dataFesta"> & { id: string; dataFesta?: number };
export type EventoPubblico = Omit<EventoProgramma, "inizio" | "fine" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> & {
  id: string;
  inizio: number;
  fine?: number;
};
export type ConfigPubblica = Omit<SitoConfig, "updatedAt" | "updatedBy">;

// Le modifiche dal gestionale arrivano sul sito entro un minuto (sugli emulatori subito, per i test).
const profilo = emulatori ? { stale: 0, revalidate: 1, expire: 1 } : { stale: 30, revalidate: 60, expire: 600 };

export async function configSito(): Promise<ConfigPubblica> {
  "use cache";
  cacheLife(profilo);
  const d = await leggi("sito/config");
  return { ...CONFIG_SITO_VUOTA, ...(d as Partial<ConfigPubblica> | null) };
}

export async function festaInEvidenza(): Promise<SitoFestaPubblica | null> {
  "use cache";
  cacheLife(profilo);
  const { festaInEvidenzaId } = await configSito();
  return festaInEvidenzaId ? ((await leggi(`sitoFeste/${festaInEvidenzaId}`)) as SitoFestaPubblica | null) : null;
}

/** Edizioni passate, dalla più recente. */
export async function edizioni(): Promise<SitoFestaPubblica[]> {
  "use cache";
  cacheLife(profilo);
  const feste = (await cerca("sitoFeste", { inArchivioPubblico: true })) as SitoFestaPubblica[];
  return feste.sort((a, b) => (b.dataFesta ?? 0) - (a.dataFesta ?? 0) || a.nome.localeCompare(b.nome));
}

export async function edizione(slug: string): Promise<SitoFestaPubblica | null> {
  "use cache";
  cacheLife(profilo);
  const [festa] = (await cerca("sitoFeste", { inArchivioPubblico: true, slug })) as SitoFestaPubblica[];
  return festa ?? null;
}

/** Programma di una festa pubblica, in ordine di orario. */
export async function programma(festaId: string): Promise<EventoPubblico[]> {
  "use cache";
  cacheLife(profilo);
  const eventi = (await cerca("programma", {}, `feste/${festaId}`)) as EventoPubblico[];
  return eventi.sort((a, b) => a.inizio - b.inizio || a.ordine - b.ordine);
}
