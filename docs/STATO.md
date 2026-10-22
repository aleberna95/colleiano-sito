# Stato del lavoro

> Aggiornato: 21/10/2026. Specifica: `docs/SPEC.md`. Convenzioni e comandi: `CLAUDE.md`.

## Setup del repo (SPEC 8.0)
- [x] 1-5. Ramo `sito-2026` (Pages pubblica da lì, colleiano.it ok, confermato da Alessio), `main` ripulito in `legacy-site/`, spec in `docs/SPEC.md`.
- [x] 6. Produzione, progetto Firebase `colleiano` (alias `prod`): app web "Colleiano Hub" (appId `1:337081871782:web:829ff8d0f4e94854fe7367`), Firestore `eur3`, Blaze, Auth email/password, Storage, backend App Hosting (passi A-D fatti da Alessio il 21/10/2026). Passo E fatto il 21/10/2026: account creato da Alessio in console, claim e profilo aggiunti con `pnpm bootstrap:superadmin --project colleiano` (Cloud SDK portatile in `%LOCALAPPDATA%\gcloud-zip`, credenziali ADC di Alessio).
  Deploy del 21/10/2026: regole/indici + 6 Functions M2 in europe-west1.
  Indirizzo del gestionale: https://colleiano-hub--colleiano.europe-west4.hosted.app/gestione (backend in europe-west4).
  **Da fare da Alessio**: (1) prova di M1/M2/M3 in produzione con la checklist data in chat (Claude non ha la password del superadmin);
  (2) fatto il 21/10/2026: policy di pulizia delle immagini delle Functions:
  `pnpm exec firebase functions:artifacts:setpolicy --location europe-west1 --days 1 --project prod`.
  M4 pubblicata il 21/10/2026 (regole, Storage, 14 Functions). Regola: deploy di regole e Functions PRIMA del push su `main` (App Hosting pubblica la UI a ogni push).
  M3 pubblicata il 21/10/2026 (regole Firestore e Storage, Functions + trigger `storicoTask`). Permesso IAM per le regole di Storage che leggono Firestore aggiunto da Alessio il 22/10/2026 (`roles/firebaserules.firestoreServiceAgent` a `service-337081871782@gcp-sa-firebasestorage.iam.gserviceaccount.com`): senza, allegati e scontrini vengono rifiutati. La CLI non lo chiede nel deploy non interattivo.

## Fase 1
| Milestone | Stato |
|---|---|
| M0 Fondamenta | ✅ |
| M1 Accesso | ✅ in codice e test (manca la prova in produzione, dopo il punto 6) |
| M2 Feste, persone, commissioni | ✅ in codice e test (prova in produzione dopo il punto 6) |
| M3 Task | ✅ in codice e test, pubblicata (prova in produzione da fare) |
| M4 Spese e rimborsi | ✅ in codice e test, pubblicata (prova in produzione da fare) |
| M5 Rifinitura e deploy | ✅ in codice e test (manca la prova in produzione di Alessio) |

### M1
Login, "Password dimenticata?" (reset nativo, non rivela se l'email esiste), cambio password obbligato al primo accesso, area superadmin `/gestione/admin`, `scripts/bootstrap-superadmin.ts` (idempotente, provato sull'emulatore). e2e Playwright in `tests/e2e/accesso.spec.ts`.

### M2
- Functions (`functions/src/`): `creaFesta` (+ Generale + creatore admin), `creaPersona` (password temporanea `xxxx-xxxx-xxxx`; email già esistente → aggiunge alla festa / riattiva), `aggiornaRuoli` (superadmin tutto; admin non tocca admin; referente solo sue commissioni), `disattivaPersona` (festa o account intero; libera i task aperti), `nuovaPasswordTemporanea`, `impostaSuperadmin` (mai zero superadmin). Test: `tests/functions/persone.test.ts` (14 verdi).
- Regole: membri leggono tutto della festa; collection group `membri` per "le mie feste"; commissioni create/modificate da admin, referente solo descrizione; festa archiviata sola lettura. Test `tests/rules/feste.test.ts` incl. parità con `lib/permissions.ts` (26 test regole verdi).
- UI: home con scelta festa / "Crea la prima festa"; `/gestione/f/[slug]` con selettore festa e barra in basso (Le mie cose · Task · Spese · Altro); Persone (elenco, nuova persona con credenziali su WhatsApp, scheda con ruoli, nuova password, togli dalla festa); Commissioni (card, nuova, scheda con modifica e persone); Impostazioni (dati festa, archivia/riapri per superadmin); admin (feste, account, superadmin, disattiva).
- e2e `tests/e2e/persone.spec.ts`: superadmin crea festa e admin, l'admin crea un membro (senza opzione admin) e lo mette referente di una commissione. Verde.

### M3
- Regole (`firestore.rules`): task creati e modificati direttamente dal client (niente callable). `puoAssegnare` = pari o sotto (admin chiunque attivo; referente referenti/componenti della commissione o "da assegnare"; componente solo componenti, mai "da assegnare"). Modifiche per ruolo: admin tutto (anche spostare), referente tutto tranne spostare, responsabile stato/checklist/link/motivo blocco (+ dati se il task se l'è dato da solo), creatore solo finché "Da fare", richiedente solo finché "Richiesta". Richieste: le manda chi non è nella commissione (non l'admin, che crea direttamente); accettare = `da_fare` + responsabile, rifiutare = `annullato` + `motivoRifiuto`, ritirare = `annullato`. Coerenza: richiesta senza responsabile, in corso/bloccato/fatto con responsabile.
- Commenti (autore entro 15 minuti, referenti/admin sempre) e allegati (`feste/{f}/tasks/{t}/allegati/{id}` + file in Storage allo stesso percorso, solo foto/PDF < 10 MB; responsabile, referenti, admin). `storage.rules` legge Firestore (`firestore.get`).
- Trigger `storicoTask` (`functions/src/tasks.ts`) con `vocePerTask` in `lib/schemas/storico.ts` (condiviso, test unitari).
- `lib/permissions.ts`: `assegnabili`, `creazioneTask`, `permessiTask`, `puoCommentare`, `puoModificareCommento`, `commissioniPerTask`; parità con le regole in `tests/rules/tasks.test.ts` (51 test regole verdi, anche Storage).
- UI: `/task` (filtri a bottoni Da chiudere/Scaduti/Da assegnare/Richieste/Fatti + commissione e persona), `/task/nuovo` (form corto; commissione non mia = richiesta), `/task/[taskId]` (azioni per stato: Inizio/Fatto/Sono bloccato/Riprendo/Riapri, assegna, accetta/rifiuta, annulla; modifica; checklist; link e allegati; commenti; storico; Condividi), "Le mie cose" (Da gestire, I miei task con Inizio/Fatto, Task dati ad altri, countdown), task aperti nella pagina della commissione. Testi WhatsApp in `lib/whatsapp.ts`.
- Dati: `lib/data/tasks.ts` (hook in tempo reale + scritture), `lib/tasks.ts` (stati, filtri, ordinamento, scadenze).
- e2e `tests/e2e/tasks.spec.ts` (festa scritta direttamente sull'emulatore da `creaFesta` in `tests/e2e/helpers.ts`). Verde.

### M4
- Regole (`firestore.rules`): il client crea solo spese `in_attesa` (mai `stato`, `motivo`, `approvatoDa`, `approvatoAt`, `autoApprovata`, `rimborsoId`), sulle sue commissioni o su Generale (admin ovunque); categoria tra `festa.categorieSpesa`; `pagatoDa` = cassa, oppure anticipata da un membro attivo (`beneficiarioUid`) o da un nome scritto a mano (`beneficiarioNome`). Modifica e ritiro (`eliminato`) solo in `in_attesa`/`rifiutata`, da autore, referenti della commissione, admin. `rimborsi` solo Functions. Scontrini in Storage `feste/{f}/movimenti/{id}/{file}` (carica chiunque della festa, solo foto/PDF < 10 MB; toglie autore o admin). Test `tests/rules/spese.test.ts` con parità (63 test regole verdi).
- Functions (`functions/src/spese.ts`): `decidiSpese` (approva/rifiuta anche più spese; mai la propria = autore o beneficiario; eccezione: un solo superadmin attivo e nessun altro admin nella festa → `autoApprovata: true`), `ripresentaSpesa` (rifiutata → in attesa), `annullaMovimento` (admin, motivo, approvata non rimborsata), `registraEntrata` (admin, già approvata), `registraRimborso` (admin, una persona, solo anticipate approvate, totale calcolato dal server), `annullaRimborso` (superadmin, motivo: le spese tornano approvate), trigger `storicoMovimento`. Test `tests/functions/spese.test.ts`.
- Calcoli in `lib/spese.ts`: riepilogo (saldo = entrate − spese approvate, comprese le rimborsate), `crediti` ("chi deve ricevere quanto", chiave `u:<uid>` o `n:<nome>` da `chiaveBeneficiario` in `lib/schemas/movimento.ts`), CSV (`;`, virgola decimale, BOM), storico in parole semplici. Test unitari.
- UI: `/spese` (riepilogo, filtri per stato e commissione, CSV; per l'admin Da approvare / Rimborsi / Registra un'entrata), `/spese/nuova` (foto → importo → cosa → commissione → chi ha pagato Cassa/Io/Un'altra persona → invia; poi "Avvisa" gli admin), `/spese/[movId]` (approva/rifiuta, modifica, ritira, ripresenta, annulla, scontrino, storico, Condividi), `/spese/da-approvare` (caselle + Approva/Rifiuta insieme), `/spese/entrata`, `/rimborsi` e `/rimborsi/[chiave]` (Rimborsa: spese, modalità, data; annulla rimborso per superadmin; CSV). "Le mie cose": spese da approvare in Da gestire, "I miei soldi" con "Devi ricevere". Pagina commissione: spese e totale approvato.
- e2e `tests/e2e/spese.spec.ts`: spesa anticipata → approvata → entrata → rimborsata, saldo giusto.
- Attenzione: le callable trasformano `undefined` in `null` e Zod lo rifiuta: i campi facoltativi vuoti non si mandano proprio.

### M5
- PWA del gestionale: `public/gestione/manifest.webmanifest` (scope `/gestione/`, icone in `public/gestione/` generate dal logo), metadata in `app/gestione/layout.tsx`. Service worker scritto con `serwist` in `sw/gestione.ts`, compilato da `pnpm build:sw` (lo fanno già `pnpm build` e `pnpm test:e2e`) in `public/gestione/sw.js` (ignorato da git): solo app shell (pagine `/gestione` NetworkFirst, `/_next/static` CacheFirst, risorse StaleWhileRevalidate); registrato solo in produzione da `RegistraServiceWorker`. Scartato `@serwist/turbopack`: la sua route usa `dynamic`/`revalidate`, non compatibili con Cache Components, e servirebbe da `/serwist/`, fuori scope.
- Offline: Firestore con `persistentLocalCache` (multi-tab) in `lib/firebase.ts`; avviso "Sei offline" (`AvvisoOffline`); "Esci" (`esci()` in `lib/firebase.ts`) cancella anche la copia locale.
- Istruzioni per installare (iPhone/Android, o pulsante "Installa" se il browser lo offre) in "Le mie cose" finché non si chiudono (`localStorage`).
- `scripts/seed-emulator.ts` (`pnpm seed`, con `pnpm emulators` acceso): svuota l'emulatore e crea festa, 6 persone (`<nome>@colleiano.test`, password `password-prova`), commissioni, task e spese. Funziona solo sugli emulatori.
- Accessibilità: `tests/e2e/accessibilita.spec.ts` apre 19 pagine a 375px, controlla axe (WCAG A/AA, nessun problema serio), niente scorrimento orizzontale, e salva le schermate in `test-results/schermate/`. Corretti i contrasti dei badge di stato e degli avvisi arancioni.

### Prossimo passo
Fase 1 completa e provata in produzione da Alessio il 22/10/2026 (task, allegati, spese con scontrino). Commissioni del comitato inserite nella "Festa di Luglio 2027" (le persone le aggiunge Alessio). Ora: test con 2-3 admin (Antonio da nominare secondo superadmin da Altro → Account e feste); raccogliere le segnalazioni e correggere. Resta: prova in produzione di Alessio (checklist in chat) e correzioni che ne escono. Poi, quando Alessio lo decide, la Fase 2 (SPEC 10).

## Decisioni prese durante lo sviluppo
- Proprietario (decisione di Alessio, 22/10/2026, SPEC 4.1/4.3 aggiornate): claim `proprietario` + `users.proprietario` dati da `pnpm bootstrap:superadmin --proprietario`. Solo il proprietario usa `impostaSuperadmin` e cambia la password di altri superadmin; il proprietario non si toglie da superadmin né dalla festa. In "Account e feste" i pulsanti superadmin compaiono solo a lui.
- Nuova persona (decisione di Alessio, 21/10/2026, SPEC 6.5 aggiornata): niente password temporanea; `creaPersona` crea l'account con password casuale invisibile e `devoCambiarePassword: false`, il client manda subito l'email nativa di Firebase (`sendPasswordResetEmail`) per scegliere la password, poi "Avvisa su WhatsApp" (`testi.invito`) e "Rimanda l'email". La password temporanea resta solo come aiuto dalla scheda persona (`nuovaPasswordTemporanea`). Negli e2e `scegliPasswordDaEmail` legge il codice dall'emulatore Auth.
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

- Next 16 tiene montata (nascosta) la pagina precedente: negli e2e usare selettori per ruolo (`getByRole`), che ignorano gli elementi nascosti, invece di `getByLabel`.
- Regole: `request.auth.token.get("superadmin", false)` invece di `.superadmin`, per non avere errori nei log quando il claim manca.

## Problemi aperti
- PC con 8 GB di RAM (spesso <1 GB liberi): test lenti, a volte crash della build. Chiudere programmi pesanti prima di `pnpm test:e2e`.
- `gh` in `C:\Program Files\GitHub CLI\gh.exe`, non ancora nel PATH del terminale di VS Code (riavviare il PC).
- Le sessioni lunghe di Claude si sono interrotte durante comandi lunghi: lanciare e2e/functions test in background, uno alla volta (due `test:rules` insieme si pestano le porte).
- `pnpm test:functions` con poca RAM: a volte l'emulatore non avvia il processo di una Function ("socket hang up", "Failed to load function") e un test va in timeout. Non è il codice: rilanciare (la CI su GitHub è il riferimento).
- `pnpm test:rules` ora avvia due JVM (Firestore + Storage): con <1 GB libero l'emulatore a volte muore per memoria (`hs_err_pid*.log` nella root, da cancellare). Basta rilanciare. `JAVA_TOOL_OPTIONS` non si può usare: il messaggio "Picked up..." manda in errore le regole di Storage.

## Comandi
Vedi `CLAUDE.md`. Test: `pnpm test` (unit), `pnpm test:rules`, `pnpm test:functions`, `pnpm test:e2e`. Sviluppo: `pnpm emulators` + `pnpm dev`; superadmin locale: `pnpm bootstrap:superadmin --emulator --email ... --nome ... --cognome ... --telefono ...`.
