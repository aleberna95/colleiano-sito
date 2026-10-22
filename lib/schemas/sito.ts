import { z } from "zod";
import { auditSchema, timestampSchema, uidSchema, urlImmagineSchema } from "./common";
import { paginaPubblicaSchema, slugSchema, type PaginaPubblica } from "./festa";

// Fase 2: dati del sito pubblico (SPEC 7.3).

export const faqSchema = z.object({
  domanda: z.string().trim().min(1, "Scrivi la domanda").max(200),
  risposta: z.string().trim().min(1, "Scrivi la risposta").max(2000),
});
export type Faq = z.infer<typeof faqSchema>;

// sito/config: lo scrive solo il superadmin, lo legge chiunque.
export const sitoConfigSchema = z.object({
  festaInEvidenzaId: z.string().min(1).optional(),
  chiSiamo: z.string().max(5000),
  comeArrivare: z.string().max(5000),
  indirizzo: z.string().max(200),
  linkMappe: z.union([z.url().max(1000), z.literal("")]),
  faq: z.array(faqSchema).max(30),
  immagineCopertina: urlImmagineSchema.optional(),
  updatedAt: timestampSchema,
  updatedBy: uidSchema,
});
export type SitoConfig = z.infer<typeof sitoConfigSchema>;

/** sito/config prima che il superadmin lo scriva. */
export const CONFIG_SITO_VUOTA: Omit<SitoConfig, "updatedAt" | "updatedBy"> = {
  chiSiamo: "",
  comeArrivare: "",
  indirizzo: "",
  linkMappe: "",
  faq: [],
};

// feste/{f}/programma/{id}: pubblico se la festa è in evidenza o nell'archivio.
export const eventoProgrammaSchema = auditSchema.extend({
  titolo: z.string().trim().min(1).max(120),
  inizio: timestampSchema,
  fine: timestampSchema.optional(),
  puntoId: z.string().optional(),
  descrizione: z.string().max(2000).optional(),
  ordine: z.number().int(),
});
export type EventoProgramma = z.infer<typeof eventoProgrammaSchema>;

const oraSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Scrivi l'ora, es. 17:30");

/** Form di un evento nel gestionale: giorno e ore in ora italiana. Se la fine è prima dell'inizio, è il giorno dopo. */
export const eventoFormSchema = z.object({
  titolo: z.string().trim().min(1, "Scrivi cosa succede").max(120),
  giorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Scegli il giorno"),
  inizio: oraSchema,
  fine: z.union([oraSchema, z.literal("")]),
  puntoId: z.string(),
  descrizione: z.string().trim().max(2000),
});
export type EventoForm = z.infer<typeof eventoFormSchema>;

// feste/{f}/avvisi/{id}: pubblico come il programma; in home solo quelli attivi.
export const tipoAvvisoSchema = z.enum(["info", "importante"]);
export const avvisoSchema = auditSchema.extend({
  testo: z.string().trim().min(1).max(500),
  tipo: tipoAvvisoSchema,
  attivo: z.boolean(),
});
export type AvvisoSito = z.infer<typeof avvisoSchema>;

export const avvisoFormSchema = z.object({
  testo: z.string().trim().min(1, "Scrivi l'avviso").max(500, "Al massimo 500 caratteri"),
  tipo: tipoAvvisoSchema,
});
export type AvvisoForm = z.infer<typeof avvisoFormSchema>;

// sitoFeste/{festaId}: copia pubblica dei dati della festa, scritta solo dalla Function.
export const sitoFestaSchema = z.object({
  nome: z.string(),
  slug: slugSchema,
  dataFesta: timestampSchema.optional(),
  luogo: z.string().optional(),
  modalitaFesta: z.boolean(),
  inArchivioPubblico: z.boolean(),
  paginaPubblica: paginaPubblicaSchema,
});
export type SitoFesta = z.infer<typeof sitoFestaSchema>;

type FestaConSito = {
  nome: string;
  slug: string;
  dataFesta?: unknown;
  luogo?: string;
  modalitaFesta?: boolean;
  inArchivioPubblico?: boolean;
  paginaPubblica?: Partial<PaginaPubblica>;
};

/** Solo i dati della festa che il sito può mostrare: niente budget, categorie, stato interno. */
export function datiPubbliciFesta<T>(festa: FestaConSito & { dataFesta?: T }) {
  const p = festa.paginaPubblica ?? {};
  return {
    nome: festa.nome,
    slug: festa.slug,
    ...(festa.dataFesta ? { dataFesta: festa.dataFesta } : {}),
    ...(festa.luogo ? { luogo: festa.luogo } : {}),
    modalitaFesta: festa.modalitaFesta === true,
    inArchivioPubblico: festa.inArchivioPubblico === true,
    paginaPubblica: {
      ...(p.testo ? { testo: p.testo } : {}),
      ...(p.copertina ? { copertina: p.copertina } : {}),
      galleria: p.galleria ?? [],
    },
  };
}

/** Form "Testi del sito" nel gestionale. */
export const testiSitoFormSchema = z.object({
  chiSiamo: z.string().trim().max(5000),
  comeArrivare: z.string().trim().max(5000),
  indirizzo: z.string().trim().max(200),
  linkMappe: z.union([
    z.url({ protocol: /^https?$/, error: "Incolla il link completo di Google Maps, es. https://maps.app.goo.gl/..." }).max(1000),
    z.literal(""),
  ]),
  faq: z.array(faqSchema).max(30),
});
export type TestiSitoForm = z.infer<typeof testiSitoFormSchema>;

// ---- Mappa (SPEC 7.1, 7.3) ----

export const categoriaPuntoSchema = z.enum(["bagni", "mangiare", "bere", "eventi", "parcheggio", "info", "soccorso", "wifi", "altro"]);
export type CategoriaPunto = z.infer<typeof categoriaPuntoSchema>;

/** Il Wi-Fi della festa (SPEC 7.1): nome della rete, password se c'è, punto della mappa dove si trova. */
export const wifiSchema = z.object({
  nomeRete: z.string().trim().min(1).max(32),
  password: z.string().min(8).max(63).optional(),
  puntoId: z.string().min(1).optional(),
});
export type Wifi = z.infer<typeof wifiSchema>;

export const wifiFormSchema = z.object({
  nomeRete: z.string().trim().min(1, "Scrivi il nome della rete").max(32, "Al massimo 32 caratteri"),
  password: z.union([z.string().min(8, "La password del Wi-Fi ha almeno 8 caratteri").max(63), z.literal("")]),
  puntoId: z.string(),
});
export type WifiForm = z.infer<typeof wifiFormSchema>;

// feste/{f}/mappa/config: l'immagine è già ridotta per il telefono al caricamento. Il Wi-Fi sta qui (SPEC 7.3).
export const mappaConfigSchema = z.object({
  immagine: z.object({ url: urlImmagineSchema, larghezza: z.number().int().positive(), altezza: z.number().int().positive() }).optional(),
  wifi: wifiSchema.optional(),
  updatedAt: timestampSchema,
  updatedBy: uidSchema,
});
export type MappaConfig = z.infer<typeof mappaConfigSchema>;

/** Coordinata relativa all'immagine: 0 = bordo sinistro/alto, 1 = bordo destro/basso. */
const coordinataSchema = z.number().min(0).max(1);

// feste/{f}/mappa/config/punti/{id}
export const puntoSchema = auditSchema.extend({
  nome: z.string().trim().min(1, "Scrivi il nome").max(80),
  categoria: categoriaPuntoSchema,
  x: coordinataSchema,
  y: coordinataSchema,
  descrizione: z.string().max(1000).optional(),
  foto: urlImmagineSchema.optional(),
  orari: z.string().max(200).optional(),
  accessibile: z.boolean(),
});
export type Punto = z.infer<typeof puntoSchema>;

/** Form della scheda di un punto nel gestionale. */
export const puntoFormSchema = z.object({
  nome: z.string().trim().min(1, "Scrivi il nome").max(80),
  categoria: categoriaPuntoSchema,
  descrizione: z.string().trim().max(1000),
  orari: z.string().trim().max(200),
  accessibile: z.boolean(),
});
export type PuntoForm = z.infer<typeof puntoFormSchema>;
