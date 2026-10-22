# Stato del lavoro

> Aggiornato: 22/10/2026. Specifica: `docs/SPEC.md`. Convenzioni e comandi: `CLAUDE.md`.

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

## Fase 2: sito pubblico (avviata il 22/10/2026)
Decisione di Alessio: partire subito, senza mesi di prova; il sito 2026 su GitHub Pages non ha visitatori. Ordine della SPEC 10, diviso in milestone:
| Milestone | Cosa | Stato |
|---|---|---|
| F2.1 | Voce **"Sito"** nel gestionale: `sito/config` (testi, festa in evidenza, archivio; solo superadmin), dati pubblici della festa (`paginaPubblica`, `modalitaFesta`, `inArchivioPubblico`) copiati da una Function in `sitoFeste/{festaId}`; regole + test (pubblico legge solo `sito/config` e `sitoFeste` + i contenuti della festa in evidenza/archiviata) | ✅ pubblicata il 22/10/2026 |
| F2.2 | Sito pubblico: home (stato normale), `/info`, `/edizioni`, `/edizioni/[slug]`; inserire l'**edizione 2026** riprendendo testi, programma, artisti e foto da `legacy-site/`; stile del sito attuale (SPEC 9.2) | ✅ pubblicata il 22/10/2026; manca lo script in produzione (lo lancia Alessio) |
| F2.3 | **colleiano.it su App Hosting**: dominio personalizzato (record DNS li mette Alessio), domini autorizzati di Auth, testo dell'email con il nuovo indirizzo, disattivare GitHub Pages (il ramo `sito-2026` resta come archivio). Il gestionale passa a `colleiano.it/gestione` | – |
| F2.4 | **Mappa**: editor nel gestionale (immagine + punti trascinabili, coordinate 0..1) e mappa pubblica con bottoni filtro enormi (Leaflet `CRS.Simple`); immagine segnaposto finché non c'è il disegno | – |
| F2.5 | **Programma, avvisi, modalità festa, Wi-Fi** (`/programma`, `/wifi`, home in modalità festa) | – |
| F2.6 | **PWA pubblica** con cache offline completa (SPEC 7.2), "Aggiornato alle…", prova in piazza | – |

### F2.1
- Dati (`lib/schemas/sito.ts`, `festa.ts`): `sito/config` { festaInEvidenzaId?, chiSiamo, comeArrivare, indirizzo, linkMappe, faq[], immagineCopertina? }; sulla festa `modalitaFesta`, `inArchivioPubblico`, `paginaPubblica` { testo?, copertina?, galleria[] } (immagini = download URL di Storage); `feste/{f}/programma/{id}` { titolo, inizio, fine?, puntoId?, descrizione?, ordine } (regole già pronte, editor in F2.5).
- Trigger `sitoFesta` (`functions/src/sito.ts`): a ogni scrittura di `feste/{f}` riscrive `sitoFeste/{f}` con `datiPubbliciFesta` (niente budget, categorie, stato); la cancella se la festa sparisce. Le feste nate prima del deploy hanno la copia solo dopo una modifica: scegliendo la festa in evidenza la pagina la "tocca" apposta.
- Regole: `sito/config` lettura libera, scrittura superadmin (festa in evidenza deve esistere, link http/https); `sitoFeste` letto da chiunque se in archivio o in evidenza, dai membri sempre (anteprima), scritto solo dalla Function; sulla festa l'admin cambia `paginaPubblica`/`modalitaFesta` (non se archiviata), solo il superadmin `inArchivioPubblico`; `programma` letto da chiunque se la festa è pubblica (`pubblica()` = in evidenza o in archivio), scritto dagli admin. Storage: `sito/feste/{f}/*` (admin della festa) e `sito/generale/*` (superadmin), solo immagini < 10 MB, lettura libera. Test `tests/rules/sito.test.ts` con parità (`puoModificareSito`, `puoModificarePaginaFesta`, `puoModificareProgramma`).
- UI: Altro → **Sito** (per admin e superadmin): dove compare la festa, "Apri il sito"; **Pagina di questa festa** (testo, copertina, galleria fino a 30; le foto si riducono a 1600 px WebP nel browser, `lib/data/sito.ts`); per il superadmin **Festa in evidenza e archivio** e **Testi del sito** (foto della home, chi siamo, come arrivare, FAQ).

### F2.2
- Pagine in `app/(pubblico)/`: home (copertina con la foto di `sito/config`, prossima edizione = festa in evidenza con data, luogo, "Mancano N giorni" e testo della sua pagina; altrimenti "In preparazione"; chi siamo; link a info ed edizioni), `/info` (indirizzo, "Apri in Google Maps", come arrivare, FAQ a fisarmonica), `/edizioni` (card), `/edizioni/[slug]` (copertina, testo, programma, galleria). `error.tsx` con "Riprova", `app/not-found.tsx` in italiano. Pezzi condivisi in `components/pubblico.tsx` (servono anche per l'anteprima e la modalità festa).
- Dati: `lib/sito-pubblico.ts` legge Firestore **dal server con l'API REST, senza login** (valgono le regole del visitatore; al telefono non arriva l'SDK di Firebase). Funzioni con `"use cache"` + `cacheLife` (30 s stale, 60 s revalidate; sugli emulatori 1 s per i test), chiamate dopo `await connection()` dentro `<Suspense>`: niente lettura a build time. Date passate come millisecondi.
- Stile: utility `grana` e `vetro` in `app/globals.css`, Playfair per i titoli.
- `scripts/edizione-2026.ts` (`pnpm edizione-2026 --emulator` oppure `--project colleiano`): crea `feste/edizione-2026` "Festa del Paese 2026" (17/05/2026, archiviata, in archivio pubblico, slug `festa-2026`) con Generale, testo e citazione del Piano Folk Trio, i 7 eventi del programma con gli artisti; se `sito/config` non c'è lo crea con chi siamo, come arrivare, indirizzo, link Maps e le 4 FAQ del sito 2026. Idempotente. Nel sito 2026 non c'erano foto (solo i video del drone nel ramo `sito-2026`): copertina e galleria si caricano dal gestionale.
- e2e `tests/e2e/sito.spec.ts`: il superadmin scrive testi, pagina, evidenza e archivio; il visitatore vede home, info, edizione col programma; 404. `controlla()` (axe + 375px) spostato in `tests/e2e/helpers.ts`; pagine pubbliche vuote in `accessibilita.spec.ts`. Suite completa verde (8 test).
- Nota: `pnpm test:e2e -- <filtro>` non funziona (l'argomento va a firebase); per un solo file, dopo la build: `pnpm exec cross-env FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase emulators:exec --only auth,firestore,functions --project demo-colleiano "playwright test sito"`.

**Da fare da Alessio dopo la F2.2**: `pnpm edizione-2026 --project colleiano` (la sessione di Claude non ha il permesso di scrivere dati in produzione); poi controllare indirizzo ("Colleiano, 63093 Roccafluvione (AP)", ricavato dal CAP del sito 2026) e testi da Altro → Sito → Testi del sito; scegliere la festa in evidenza (Altro → Sito → Festa in evidenza e archivio); caricare qualche foto.

Da tenere a mente: il sito pubblico non legge mai task, spese o persone; il manifest pubblico ha scope `/` e quello del gestionale resta `/gestione/` (un solo service worker con strategie diverse, SPEC 7.3: oggi c'è solo `sw/gestione.ts`).

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
**F2.3** (colleiano.it su App Hosting): servono i passi di Alessio (dominio personalizzato in console e record DNS); poi Claude: domini autorizzati di Auth già fatti da Alessio, link nelle email/WhatsApp verso colleiano.it, disattivare GitHub Pages (`gh api -X DELETE repos/aleberna95/colleiano-sito/pages`, il ramo `sito-2026` resta). Poi F2.4 (mappa).

Storico (Fase 1): Fase 1 completa e provata in produzione da Alessio il 22/10/2026 (task, allegati, spese con scontrino). Commissioni del comitato inserite nella "Festa di Luglio 2027" (le persone le aggiunge Alessio). Ora: test con 2-3 admin (Antonio da nominare secondo superadmin da Altro → Account e feste); raccogliere le segnalazioni e correggere. Resta: prova in produzione di Alessio (checklist in chat) e correzioni che ne escono. Poi, quando Alessio lo decide, la Fase 2 (SPEC 10).

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
