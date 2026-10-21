# Stato del lavoro

> Aggiornato: 21/10/2026. Specifica: `docs/SPEC.md`. Convenzioni e comandi: `CLAUDE.md`.

## Setup del repo (SPEC 8.0)
- [x] 1-5. Ramo `sito-2026` (Pages pubblica da lì, colleiano.it ok, confermato da Alessio), `main` ripulito in `legacy-site/`, spec in `docs/SPEC.md`.
- [x] 6. Produzione, progetto Firebase `colleiano` (alias `prod`): app web "Colleiano Hub" (appId `1:337081871782:web:829ff8d0f4e94854fe7367`), Firestore `eur3`, Blaze, Auth email/password, Storage, backend App Hosting, superadmin (passi A-E fatti da Alessio il 21/10/2026).
  Deploy del 21/10/2026: regole/indici + 6 Functions M2 in europe-west1.
  **Da fare da Alessio**: (1) mandare a Claude l'URL `*.hosted.app` per la prova di M1/M2/M3 in produzione;
  (2) policy di pulizia delle immagini delle Functions (Claude non ha il permesso):
  `pnpm exec firebase functions:artifacts:setpolicy --location europe-west1 --days 1 --project prod`.
  Dopo M3: `pnpm exec firebase deploy --only firestore,storage,functions --project prod` (al primo deploy di `storage.rules` la CLI chiede di dare a Storage il permesso di leggere Firestore: rispondere sì).

## Fase 1
| Milestone | Stato |
|---|---|
| M0 Fondamenta | ✅ |
| M1 Accesso | ✅ in codice e test (manca la prova in produzione, dopo il punto 6) |
| M2 Feste, persone, commissioni | ✅ in codice e test (prova in produzione dopo il punto 6) |
| M3 Task | ✅ in codice e test (prova in produzione da fare) |
| M4 Spese e rimborsi | – |
| M5 Rifinitura e deploy | – |

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

### Prossimo passo: M4 (Spese, approvazioni, rimborsi, CSV)
SPEC 4.5, 4.7 n.9-11, 5 (movimenti, rimborsi), 6.2 n.4 ("I miei soldi" e "spese da approvare" in Da gestire), 6.4, 6.6 (WhatsApp spese). Callable per approva/rifiuta/annulla/rimborsa, scontrini in Storage, trigger storico movimenti, e2e: spesa anticipata → approvata → rimborsata, saldo giusto.

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

- Next 16 tiene montata (nascosta) la pagina precedente: negli e2e usare selettori per ruolo (`getByRole`), che ignorano gli elementi nascosti, invece di `getByLabel`.
- Regole: `request.auth.token.get("superadmin", false)` invece di `.superadmin`, per non avere errori nei log quando il claim manca.

## Problemi aperti
- PC con 8 GB di RAM (spesso <1 GB liberi): test lenti, a volte crash della build. Chiudere programmi pesanti prima di `pnpm test:e2e`.
- `gh` in `C:\Program Files\GitHub CLI\gh.exe`, non ancora nel PATH del terminale di VS Code (riavviare il PC).
- Le sessioni lunghe di Claude si sono interrotte durante comandi lunghi: lanciare e2e/functions test in background, uno alla volta (due `test:rules` insieme si pestano le porte).
- `pnpm test:rules` ora avvia due JVM (Firestore + Storage): con <1 GB libero l'emulatore a volte muore per memoria (`hs_err_pid*.log` nella root, da cancellare). Basta rilanciare. `JAVA_TOOL_OPTIONS` non si può usare: il messaggio "Picked up..." manda in errore le regole di Storage.

## Comandi
Vedi `CLAUDE.md`. Test: `pnpm test` (unit), `pnpm test:rules`, `pnpm test:functions`, `pnpm test:e2e`. Sviluppo: `pnpm emulators` + `pnpm dev`; superadmin locale: `pnpm bootstrap:superadmin --emulator --email ... --nome ... --cognome ... --telefono ...`.
