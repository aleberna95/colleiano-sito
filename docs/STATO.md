# Stato del lavoro

> Aggiornato: 21/10/2026. Specifica: `docs/SPEC.md`. Convenzioni e comandi: `CLAUDE.md`.

## Setup del repo (SPEC 8.0)
- [x] 1-5. Ramo `sito-2026` (Pages pubblica da lì, colleiano.it ok, confermato da Alessio), `main` ripulito in `legacy-site/`, spec in `docs/SPEC.md`.
- [ ] 6. Produzione, progetto Firebase `colleiano` (alias `prod`). Fatto da Claude: app web "Colleiano Hub" (appId `1:337081871782:web:829ff8d0f4e94854fe7367`), regole Firestore pubblicate (versione M1), `apphosting.yaml`. Firestore `eur3` creato da Alessio.
  **Da fare da Alessio** (istruzioni già date in chat, ripeterle se serve):
  A. piano Blaze + avviso budget 5 €; B. Auth email/password + lingua modelli italiano; C. Storage (eur3/europe-west1, modalità produzione);
  D. backend App Hosting `colleiano-hub` su `aleberna95/colleiano-sito`, ramo `main`, root `/`, regione europe-west1 (o europe-west4), app web "Colleiano Hub" → comunicare l'URL `*.hosted.app`;
  E. superadmin: `winget install Google.CloudSDK`, `gcloud auth application-default login`, `gcloud auth application-default set-quota-project colleiano`, poi `pnpm bootstrap:superadmin --project colleiano --email alebernardini95@gmail.com --nome Alessio --cognome Bernardini --telefono <numero>` (lo lancia Alessio: la password la deve vedere solo lui).
  Dopo A-D: deploy di regole/indici aggiornati e Functions (`firebase deploy --only firestore,functions --project prod`).

## Fase 1
| Milestone | Stato |
|---|---|
| M0 Fondamenta | ✅ |
| M1 Accesso | ✅ in codice e test (manca la prova in produzione, dopo il punto 6) |
| M2 Feste, persone, commissioni | ✅ in codice e test (prova in produzione dopo il punto 6) |
| M3 Task | – |
| M4 Spese e rimborsi | – |
| M5 Rifinitura e deploy | – |

### M1
Login, "Password dimenticata?" (reset nativo, non rivela se l'email esiste), cambio password obbligato al primo accesso, area superadmin `/gestione/admin`, `scripts/bootstrap-superadmin.ts` (idempotente, provato sull'emulatore). e2e Playwright in `tests/e2e/accesso.spec.ts`.

### M2
- Functions (`functions/src/`): `creaFesta` (+ Generale + creatore admin), `creaPersona` (password temporanea `xxxx-xxxx-xxxx`; email già esistente → aggiunge alla festa / riattiva), `aggiornaRuoli` (superadmin tutto; admin non tocca admin; referente solo sue commissioni), `disattivaPersona` (festa o account intero; libera i task aperti), `nuovaPasswordTemporanea`, `impostaSuperadmin` (mai zero superadmin). Test: `tests/functions/persone.test.ts` (14 verdi).
- Regole: membri leggono tutto della festa; collection group `membri` per "le mie feste"; commissioni create/modificate da admin, referente solo descrizione; festa archiviata sola lettura. Test `tests/rules/feste.test.ts` incl. parità con `lib/permissions.ts` (26 test regole verdi).
- UI: home con scelta festa / "Crea la prima festa"; `/gestione/f/[slug]` con selettore festa e barra in basso (Le mie cose · Task · Spese · Altro); Persone (elenco, nuova persona con credenziali su WhatsApp, scheda con ruoli, nuova password, togli dalla festa); Commissioni (card, nuova, scheda con modifica e persone); Impostazioni (dati festa, archivia/riapri per superadmin); admin (feste, account, superadmin, disattiva).
- e2e `tests/e2e/persone.spec.ts`: superadmin crea festa e admin, l'admin crea un membro (senza opzione admin) e lo mette referente di una commissione. Verde.

### Prossimo passo: M3 (Task e richieste, "Le mie cose", pulsanti WhatsApp)
SPEC 4.4, 4.7 n.2-7, 6.2, 6.3, 6.6. Partire dal piano: regole task + test, trigger storico, form corto, lista con filtri, dettaglio (checklist, link, commenti, storico; allegati con Storage), "Le mie cose" completa, testi WhatsApp in `lib/whatsapp.ts`.

## Decisioni prese durante lo sviluppo
- Pages: al PUT aggiunto `cname=colleiano.it`.
- Tailwind 4: token in `app/globals.css`, classi `colleiano-*`. shadcn: primary = forest, secondary = rust; pulsanti/campi 48px, testo 17px.
- Functions: pacchetto pnpm del workspace, bundle esbuild con `lib/schemas`; runtime Node 24; opzioni globali in `functions/src/setup.ts` importato per primo (altrimenti la regione resta us-central1).
- `lib/firebase.ts`: emulatori in sviluppo o con `NEXT_PUBLIC_USE_EMULATORS=true`; in produzione config da `NEXT_PUBLIC_FIREBASE_*` (in `apphosting.yaml`, è pubblica); senza config usa il progetto finto (build in CI).
- Next 16 + Cache Components: `useParams`/`usePathname` su rotte dinamiche sempre dentro `<Suspense>`.
- Profilo utente: il client può solo mettere `devoCambiarePassword=false` e `ultimaFestaId`; tutto il resto via Functions.
- "Nuova persona" chiede solo nome, cognome, telefono, email (+ ruolo admin se superadmin); i ruoli nelle commissioni si danno dalla scheda persona o dalla commissione.
- Disattivare in una festa = `membri.attivo=false` (ruoli conservati, tolta dalle card); riaggiungerla con "Nuova persona" la riattiva. Disattivare l'account (solo superadmin) blocca Auth.
- Conferme delle azioni importanti in due passi visibili (`ConfermaAzione`), niente popup.
- e2e: build di produzione collegata agli emulatori fatta PRIMA di avviarli (con 8 GB di RAM `next dev`/build insieme agli emulatori va in crash); attese a 20 s.

## Problemi aperti
- PC con 8 GB di RAM (spesso <1 GB liberi): test lenti, a volte crash della build. Chiudere programmi pesanti prima di `pnpm test:e2e`.
- `gh` in `C:\Program Files\GitHub CLI\gh.exe`, non ancora nel PATH del terminale di VS Code (riavviare il PC).
- Le sessioni lunghe di Claude si sono interrotte durante comandi lunghi: lanciare e2e/functions test in background.

## Comandi
Vedi `CLAUDE.md`. Test: `pnpm test` (unit), `pnpm test:rules`, `pnpm test:functions`, `pnpm test:e2e`. Sviluppo: `pnpm emulators` + `pnpm dev`; superadmin locale: `pnpm bootstrap:superadmin --emulator --email ... --nome ... --cognome ... --telefono ...`.
