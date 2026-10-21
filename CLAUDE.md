# Colleiano Hub

Gestionale (Fase 1) e futuro sito pubblico (Fase 2) delle feste del comitato di Colleiano.
Specifica completa: `docs/SPEC.md`. Stato del lavoro: `docs/STATO.md`. Leggili prima di iniziare.

@AGENTS.md

## Regole (SPEC 0)
1. **Semplicità.** Se una funzione non è nella spec non si fa. Tra due strade si sceglie quella con meno schermate, passaggi e pezzi in movimento.
2. **Una fase alla volta.** Ora solo la Fase 1. La Fase 2 non si implementa; le collezioni riservate (`programma`, `avvisi`, `mappa`, `sito/config`, `sitoFeste`, `menu`, `tavoli`, `ordini`, `comande`, `pagamenti`, `prenotazioni`) non si creano.
3. **Permessi = cuore della Fase 1.** Ogni funzione si consegna con Firestore Security Rules **e** test delle regole sull'emulatore (`tests/rules/`). `lib/permissions.ts` replica `firestore.rules` per la UI e un test verifica che coincidano.
4. **Il sistema nasce vuoto.** In produzione esiste solo il superadmin creato da `scripts/bootstrap-superadmin.ts`. Dati finti solo sull'emulatore.
5. **Niente email transazionali.** Le comunicazioni passano da WhatsApp con link `wa.me` precompilati; i testi stanno tutti in `lib/whatsapp.ts`. Unica email: il reset password nativo di Firebase Auth (usato anche per far scegliere la password alle persone nuove).
6. **Lingua.** Interfaccia in italiano semplice. Codice in inglese, ma i nomi di dominio restano in italiano (`festa`, `commissione`, `referente`, `movimento`, `rimborso`, `punto`...).
7. **Utenti non tecnici.** Mobile first, testo base 17px, pulsanti alti almeno 48px con testo e icona, contrasto AA, una cosa principale per schermata, stati vuoti che spiegano cosa fare.
8. **Grafica.** Palette e token in `app/globals.css` (classi `colleiano-*`, es. `bg-colleiano-forest`, `text-colleiano-rust/60`). `legacy-site/` è solo riferimento: non modificarlo. Il sito online vive nel ramo `sito-2026`: nessun commit lì salvo richiesta esplicita di Alessio.
9. **Mai** password, chiavi o segreti nel codice, nel repo o nei log.
10. **Stato del lavoro.** Aggiorna `docs/STATO.md` a fine milestone e prima di ogni pausa: deve bastare da solo per riprendere.
11. **Contesto pieno.** Quando la conversazione si allunga molto (stai per compattare o perdi dettagli) non iniziare nuovi passi: chiudi il passo, fai commit, aggiorna `docs/STATO.md`, poi scrivi ad Alessio in un blocco di codice il prompt per una chat nuova (cosa leggere: `CLAUDE.md`, `docs/STATO.md`, `docs/SPEC.md`; milestone e passo da cui ripartire; decisioni e problemi aperti).

**Definition of done:** tipi Zod condivisi, regole + test, UI provata a 375px, stati di caricamento/vuoto/errore gestiti, testi in italiano semplice.

## Stack
Next.js 16 (App Router, TS strict) · Tailwind 4 + shadcn/ui (radix) + lucide-react · Zod 4 + React Hook Form · Firebase (Auth, Firestore `eur3`, Storage, Functions v2 `europe-west1`, App Hosting) · date-fns con fuso Europe/Rome · Vitest, `@firebase/rules-unit-testing`, Playwright (dal primo e2e) · pnpm.

Next 16 ha API diverse da quelle note: leggere `node_modules/next/dist/docs/` prima di usare funzioni di Next.

## Struttura
- `app/` pagine: `/` segnaposto, `/gestione/...` gestionale.
- `components/ui/` componenti shadcn (pulsanti già portati a 48px).
- `lib/schemas/` schemi Zod condivisi con le Functions (niente alias `@/` qui dentro: li importa anche `functions/`).
- `lib/firebase.ts` client; in sviluppo si collega agli emulatori.
- `functions/` Cloud Functions (pacchetto pnpm del workspace, bundle con esbuild in `functions/lib/`).
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`.
- `tests/unit/`, `tests/rules/` (emulatore), `tests/e2e/`.
- `scripts/` bootstrap superadmin e seed dell'emulatore.

## Comandi
| Comando | Cosa fa |
|---|---|
| `pnpm install` | installa tutto (root + functions) |
| `pnpm dev` | Next.js su http://localhost:3000 (usa gli emulatori) |
| `pnpm emulators` | compila le Functions e avvia gli emulatori (UI su http://localhost:4000) |
| `pnpm test` | test unitari |
| `pnpm test:rules` | test delle regole (avvia da solo l'emulatore Firestore) |
| `pnpm test:functions` | test delle Functions (emulatori auth, firestore, functions) |
| `pnpm test:e2e` | Playwright a 375px sulla build collegata agli emulatori |
| `pnpm bootstrap:superadmin` | crea il superadmin (`--emulator` oppure `--project colleiano`) |
| `pnpm lint` / `pnpm typecheck` | controlli |
| `pnpm check` | lint + typecheck + test unitari |

Progetti Firebase: `demo-colleiano` (predefinito, solo emulatori) e alias `prod` = `colleiano`. Per la produzione serve sempre `--project prod` esplicito.

Requisiti locali: Node 24, Java 21 (emulatori), pnpm 10.
