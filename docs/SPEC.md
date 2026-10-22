# Colleiano Hub: specifica tecnica v1.5

> Piattaforma per organizzare le feste del comitato di Colleiano e farle funzionare il giorno stesso.
> Documento da passare a Claude Code (VS Code) come base per lo sviluppo.
> Autore: Alessio Bernardini (alessiobernardini.dev). Ultimo aggiornamento: 20/10/2026.

---

## 0. Istruzioni per Claude Code (leggere prima di tutto)

1. **Il principio guida è la semplicità.** Se una funzione non è scritta qui, non si fa. Se esistono due modi, si sceglie quello con meno schermate, meno passaggi e meno pezzi in movimento. Niente funzionalità "già che ci siamo".
2. Si sviluppa **una fase alla volta** (sezione 10). Ora solo la **Fase 1**. La Fase 2 è descritta perché il modello dati non la ostacoli: non implementarla.
3. **I permessi sono il cuore della Fase 1** (sezione 4). Ogni funzione si consegna con Firestore Security Rules **e** test delle regole sull'emulatore.
4. **Il sistema nasce vuoto**: in produzione esiste solo il superadmin creato dallo script (sezione 8). Dati finti solo sull'emulatore.
5. **Nessun servizio email transazionale.** Le comunicazioni passano da **WhatsApp** tramite link `wa.me` precompilati (sezione 6.6). L'unica email che parte è il reset password nativo di Firebase Auth (usato anche per far scegliere la password alle persone nuove, 6.5).
6. Interfaccia in **italiano**. Codice in inglese, ma i nomi di dominio restano in italiano come in questo documento (`festa`, `commissione`, `referente`, `movimento`, `rimborso`, `punto`…).
7. Utenti non tecnici e non giovani: ogni schermata deve superare il test "lo usa dal telefono senza chiedere aiuto" (sezione 9).
8. **Grafica**: palette, font, raggi e ombre sono quelli del sito attuale, già riportati nella sezione 9.2. Il sito attuale (HTML statico + Tailwind via CDN, ospitato su GitHub Pages) vive nel ramo `sito-2026` dello stesso repo e ne è copiata una parte in `legacy-site/` **solo come riferimento** grafico e di contenuti: non va modificato né pubblicato da questo progetto. Il setup del repo è nella sezione 8.0.
9. Mai password, chiavi o segreti nel codice, nel repo o nei log.
10. Crea un `CLAUDE.md` nella root con convenzioni, comandi e regole di questo documento, inclusa la regola 12.
11. **Stato del lavoro**: tieni aggiornato `docs/STATO.md` a fine di ogni milestone e prima di ogni pausa: milestone completate, milestone in corso con i passi fatti e quelli mancanti, decisioni prese durante lo sviluppo, problemi aperti, comandi per avviare il progetto. Deve bastare da solo per riprendere il lavoro in una chat nuova.
12. **Contesto pieno**: quando la conversazione si sta allungando molto (stai per riassumere/compattare il contesto, o noti che inizi a perdere dettagli), **non iniziare nuovi passi**. Chiudi il passo in corso, fai commit, aggiorna `docs/STATO.md`, poi fermati e scrivi ad Alessio un **prompt pronto da incollare in una chat nuova**, in un blocco di codice, che contenga: cosa leggere per primo (`CLAUDE.md`, `docs/STATO.md`, `docs/SPEC.md`), milestone e passo da cui ripartire, eventuali decisioni o problemi aperti da tenere presenti.

---

## 1. Lo scenario

- Un gruppo di **5-6 ragazzi** organizza una festa in un paesino (Colleiano, AP) per renderlo vivo: eventi durante la giornata e si mangia insieme. Circa **200 persone**.
- La festa è tra circa un anno. **Adesso** serve tenere in ordine **chi fa cosa** e **chi ha speso cosa**. Più avanti questo progetto diventa anche **il sito pubblico colleiano.it**: vive tutto l'anno e, il giorno della festa, mostra programma, avvisi e **mappa** del paese, raggiungibili dai QR. La parte cibo (ordini, pagamenti, comande) è rimandata (sezione 7.4).
- In futuro le feste potrebbero diventare più d'una: ogni dato appartiene a una **festa**, scelta da un menu a tendina.

### 1.1 Le parti
| Parte | Per chi | Quando | Cosa fa |
|---|---|---|---|
| **A. Gestionale** | il comitato | **Fase 1, da subito** | task, spese, rimborsi, persone e ruoli |
| **B. Sito pubblico colleiano.it** | tutti, e i visitatori via QR | Fase 2 | home, edizioni passate, info; durante la festa programma, avvisi, mappa |
| *C. Cibo* | *visitatori e comitato* | *rimandata* | *ordini e pagamento dal tavolo, comande stampate (sezione 7.4)* |

### 1.2 Cosa NON c'è (di proposito)
Chat interna, email automatiche, calendario, verbali, rubrica, turni volontari, inventario, gestione fiscale, app negli store. Per ora anche tutta la parte cibo. Se servirà qualcosa di questo, si aggiunge dopo.

### 1.3 Numeri (guidano le scelte tecniche)
5-6 utenti del gestionale (max ~20), 1 festa attiva, 3-8 commissioni, qualche centinaio di task e spese, ~200 visitatori. Liste caricate intere e filtrate lato client. Niente ottimizzazioni premature.

---

## 2. Glossario

| Termine | Significato |
|---|---|
| **Festa** | Contenitore di tutto. Si sceglie dal menu a tendina in alto. |
| **Commissione** | Gruppo di lavoro di una festa (es. Cucina, Musica, Logistica). Ha uno o più referenti e dei componenti. |
| **Referente** / **Componente** | Ruoli dentro una commissione. Una persona può stare in più commissioni con ruoli diversi. |
| **Responsabile** | L'unica persona assegnata a un task. |
| **Admin** | Gestisce una festa: persone (non admin), commissioni, approvazione spese, rimborsi. |
| **Superadmin** | Gestisce tutto, è l'unico che crea admin. |
| **Movimento** | Spesa o entrata. |
| **Rimborso** | Soldi restituiti a chi ha anticipato una spesa. |
| **Punto** | Un luogo sulla mappa (bagni, stand, parcheggio…). |

---

## 3. Stack

| Area | Scelta |
|---|---|
| Framework | **Next.js** (App Router) + **TypeScript** strict |
| UI | **Tailwind CSS** + **shadcn/ui**, icone **lucide-react** |
| Validazione | **Zod** + React Hook Form (schemi condivisi con le Functions) |
| Backend | **Firebase**: Auth (email + password), Firestore, Storage, Cloud Functions v2. Regione `europe-west1`, Firestore `eur3` |
| Hosting | **Firebase App Hosting** (supporto nativo a Next.js, deploy automatico a ogni push sul ramo `main` di GitHub). **Tutto su Firebase**, nessun altro servizio esterno |
| PWA | manifest + service worker (**Serwist**) |
| Date | `date-fns`, fuso **Europe/Rome** |
| Test | **Vitest**, `@firebase/rules-unit-testing`, **Playwright** solo sui flussi principali |
| Pacchetti | pnpm |
| Dominio | **uno solo** a regime: `colleiano.it`. Sito pubblico su `/`, gestionale su `/gestione`. Un solo progetto, un solo backend App Hosting, un solo deploy. **In Fase 1** `colleiano.it` resta sul sito attuale (GitHub Pages) e il gestionale si usa dall'indirizzo di App Hosting (`*.hosted.app`). In Fase 2 si sposta il DNS di `colleiano.it` da GitHub Pages ad App Hosting |

**Architettura**: client Next.js che legge e scrive su Firestore protetto dalle Security Rules (fonte di verità dei permessi). Le **callable Functions** servono solo per ciò che il client non deve poter fare da solo: creare account e assegnare ruoli, approvare/rifiutare spese, registrare rimborsi, creare una festa. Un trigger scrive lo **storico** di task e spese.

**Struttura del repo**
```
app/
  gestione/login, gestione/cambia-password
  gestione/f/[festaSlug]/            → "Le mie cose", task, spese, rimborsi, commissioni, persone, impostazioni
  gestione/admin/                    → superadmin: account e feste
  (pubblico)/                        → sito colleiano.it, RISERVATO Fase 2. In Fase 1 la `/` è solo una pagina segnaposto con link a /gestione
components/  lib/ (data/, permissions.ts, schemas/, format.ts, whatsapp.ts)
functions/   firestore.rules  storage.rules  firestore.indexes.json
tests/ (rules/, unit/, e2e/)   scripts/ (bootstrap-superadmin.ts, seed-emulator.ts)
```
`lib/permissions.ts` replica le regole di `firestore.rules` per la UI; una suite di test verifica che diano gli stessi risultati.

---

## 4. Ruoli e permessi

### 4.1 Livelli
| Livello | Ambito | Dove vive |
|---|---|---|
| **Superadmin** (4) | tutto | custom claim `superadmin: true` + `users/{uid}.superadmin` |
| *Proprietario* | tra i superadmin, quello che ha il controllo | custom claim `proprietario: true` + `users/{uid}.proprietario`, dato dallo script di bootstrap con `--proprietario` |
| **Admin** (3) | una festa | `feste/{f}/membri/{uid}.ruoloFesta = "admin"` |
| **Referente** (2) | una commissione | `membri/{uid}.commissioni[commId] = "referente"` |
| **Componente** (1) | una commissione | `membri/{uid}.commissioni[commId] = "componente"` |

### 4.2 Le tre regole
1. **Vedere**: ogni membro di una festa vede **tutto** di quella festa. Nessuno vede feste di cui non è membro (tranne i superadmin).
2. **Toccare**: si interviene solo su ciò che compete. Su un task o una spesa intervengono solo il responsabile/autore (nei limiti sotto), i referenti della commissione, gli admin, i superadmin.
3. **Pari o sotto**: si assegna lavoro solo a persone di livello pari o inferiore, dentro il proprio ambito.

### 4.3 Persone
| Chi | Crea account | Assegna ruoli | Disattiva |
|---|---|---|---|
| Superadmin | chiunque | tutti, ed è **l'unico che crea o nomina admin** | chiunque (non l'ultimo superadmin) |
| Proprietario | come superadmin | in più è **l'unico che nomina o toglie i superadmin**; nessuno può togliergli il ruolo, disattivarlo, toglierlo da una festa o cambiargli la password. Solo lui cambia la password di un altro superadmin. *(Decisione di Alessio del 22/10/2026.)* | |
| Admin | persone non admin nella sua festa | referenti e componenti nella sua festa | membri non admin della sua festa |
| Referente | – | aggiunge alla sua commissione persone già nella festa, come componenti o co-referenti; può toglierle | – |
| Componente | – | – | – |

Quando si disattiva una persona, i suoi task aperti tornano "da assegnare" nella stessa commissione. Spese, rimborsi e storico restano a suo nome.

### 4.4 Task
**Chi crea e a chi assegna**
| Chi crea | Dove | A chi può assegnare |
|---|---|---|
| Admin/Superadmin | qualsiasi commissione | chiunque della festa |
| Referente di X | X | sé, altri referenti di X, componenti di X |
| Componente di X | X | sé, altri componenti di X (non ai referenti) |

Solo referenti e admin possono lasciare un task "da assegnare".

**Richieste tra commissioni**: chiunque può chiedere qualcosa a una commissione di cui non fa parte. È un task con `stato: "richiesta"`. Il richiedente lo modifica o lo ritira finché è in richiesta. I referenti della commissione (o gli admin) lo **accettano** assegnandolo oppure lo **rifiutano** con un motivo.

**Chi modifica dopo**
| Chi | Cosa |
|---|---|
| Responsabile | stato, checklist, allegati, note. Se il task l'ha creato lui per sé, anche titolo, descrizione, scadenza e priorità. Mai commissione o responsabile. |
| Creatore (se diverso dal responsabile) | modifica o annulla **solo finché il task è "Da fare"** |
| Referente della commissione | tutto sui task della sua commissione |
| Admin/Superadmin | tutto, anche spostarlo di commissione |
| Tutti gli altri | lettura e commenti |

**Stati**: `richiesta` → `da_fare` → `in_corso` → `fatto`. Più `bloccato` (con motivo) e `annullato`. Un task fatto si può riaprire (responsabile, referente, admin). Nessuna revisione del referente.

### 4.5 Spese e rimborsi
| Azione | Chi |
|---|---|
| Inserire una spesa | qualsiasi membro, sulle commissioni di cui fa parte o su "Generale" (admin: ovunque) |
| Modificare/ritirare prima dell'approvazione | l'autore, i referenti della commissione, gli admin |
| Approvare/rifiutare | admin e superadmin, **mai la propria spesa**. Eccezione: se c'è un solo superadmin e nessun altro admin, può approvare le proprie e lo storico lo mostra |
| Annullare una spesa approvata non ancora rimborsata | admin, con motivo |
| Registrare entrate, budget, rimborsi | admin |
| Annullare un rimborso sbagliato | superadmin, con motivo |

### 4.6 Altro
- Commissioni: le crea e modifica l'admin. I referenti possono modificare la descrizione.
- Festa: la crea e archivia il superadmin, l'admin ne modifica i dati. Una festa archiviata è in sola lettura.
- Commenti: li scrive chiunque nella festa. Li modificano l'autore (entro 15 minuti) e referenti/admin.
- Il documento `membri` e i campi `stato`/`approvatoDa`/`rimborsoId` dei movimenti li scrivono **solo** le Functions.
- Utente disattivato: nessun accesso.

### 4.7 Test delle regole obbligatori
1. Un membro legge tutto della sua festa e nulla delle altre.
2. Un componente di A assegna a un altro componente di A ✅, a un referente di A ❌, in B ❌.
3. Un referente di A assegna a co-referenti e componenti di A ✅, fuori da A ❌.
4. Nessuno modifica un task di altri senza esserne referente o admin.
5. Il responsabile cambia lo stato, ma non il responsabile né la commissione.
6. Il creatore modifica un task "Da fare" ✅ ma non uno "In corso" ❌.
7. Richiesta: la invia chiunque, la accetta solo un referente o un admin della commissione destinataria.
8. Un admin non crea admin e non disattiva admin; un superadmin sì.
9. Un admin non approva le proprie spese.
10. Nessun client scrive su `membri` o sullo stato dei movimenti.
11. Un componente non inserisce spese fuori dalle sue commissioni (tranne "Generale").
12. Utente disattivato: zero accessi. Festa archiviata: zero scritture (tranne superadmin).

Helper di partenza per le regole:
```
function signedIn() { return request.auth != null; }
function isSuperadmin() { return signedIn() && request.auth.token.superadmin == true; }
function m(f) { return get(/databases/$(database)/documents/feste/$(f)/membri/$(request.auth.uid)).data; }
function isMembro(f) { return signedIn() && exists(/databases/$(database)/documents/feste/$(f)/membri/$(request.auth.uid)) && m(f).attivo == true; }
function isAdmin(f) { return isSuperadmin() || (isMembro(f) && m(f).ruoloFesta == "admin"); }
function ruolo(f, c) { return m(f).commissioni.get(c, null); }
function isReferente(f, c) { return isMembro(f) && ruolo(f, c) == "referente"; }
function canManage(f, c) { return isAdmin(f) || isReferente(f, c); }
```

---

## 5. Modello dati Fase 1 (Firestore)

Convenzioni: importi in **centesimi interi**; `Timestamp` per le date; ogni documento ha `createdAt`, `createdBy`, `updatedAt`, `updatedBy`; eliminazione logica con `eliminato: boolean`; schemi Zod in `lib/schemas/`.

```ts
// users/{uid}
{ nome, cognome, nomeVisualizzato, email, telefono /* obbligatorio: serve per WhatsApp */,
  superadmin: boolean, attivo: boolean, devoCambiarePassword: boolean, ultimaFestaId?: string }

// feste/{festaId}
{ nome, slug, dataFesta?: Timestamp, luogo?: string,
  stato: "preparazione"|"in_corso"|"conclusa"|"archiviata",
  budgetTotaleCents?: number, categorieSpesa: string[] }

// feste/{f}/membri/{uid}            (scrittura solo Functions)
{ uid, nomeVisualizzato, telefono, ruoloFesta: "admin"|"membro",
  commissioni: Record<string, "referente"|"componente">, attivo: boolean }

// feste/{f}/commissioni/{commId}
{ nome, descrizione?, icona, colore, ordine, generale: boolean, budgetCents?: number,
  referentiUids: string[], componentiUids: string[] /* denormalizzati da membri, via Function */ }

// feste/{f}/tasks/{taskId}
{ titolo, descrizione?, commissioneId, responsabileUid: string|null,
  stato: "richiesta"|"da_fare"|"in_corso"|"bloccato"|"fatto"|"annullato",
  richiestoDa?: string, motivoBlocco?: string, motivoRifiuto?: string,
  priorita: "normale"|"urgente", scadenza?: Timestamp,
  checklist: { id, testo, fatto }[], link: { titolo, url }[], eliminato: boolean }
// sottocollezioni: commenti/{id} { testo, autoreUid, createdAt }, allegati/{id} { nome, mime, path }

// feste/{f}/movimenti/{movId}
{ tipo: "spesa"|"entrata", commissioneId, descrizione, importoCents, categoria, dataSpesa,
  pagatoDa: { tipo: "cassa"|"anticipata", beneficiarioUid?: string, beneficiarioNome?: string },
  stato: "in_attesa"|"approvata"|"rifiutata"|"rimborsata"|"annullata",
  motivo?: string, approvatoDa?: string, approvatoAt?: Timestamp, rimborsoId?: string,
  scontrini: { path, nome, mime }[], eliminato: boolean }

// feste/{f}/rimborsi/{id}
{ beneficiarioUid?: string, beneficiarioNome: string, movimentiIds: string[],
  totaleCents: number /* calcolato dalla Function */, modalita: "contanti"|"bonifico"|"altro",
  data: Timestamp, nota?: string }

// feste/{f}/storico/{id}            (solo Functions, append-only)
{ entita: "task"|"movimento"|"membro", entitaId, azione, attoreUid, diff?, at }
```

**Flusso spese** (transizioni solo via callable):
```
in_attesa ──approva──▶ approvata ──(se anticipata) rimborso──▶ rimborsata
    └──rifiuta (motivo)──▶ rifiutata ──l'autore corregge──▶ in_attesa
approvata ──annulla (admin, motivo)──▶ annullata
```

**Riservato alla Fase 2** (non creare ora): `programma`, `avvisi`, `mappa`, `sito/config`, `sitoFeste`. Riservati alla parte cibo, rimandata: `menu`, `tavoli`, `ordini`, `comande`, `pagamenti`, `prenotazioni`.

---

## 6. Gestionale: funzioni della Fase 1

### 6.1 Navigazione
- In alto: **selettore festa** e profilo.
- Mobile, barra in basso con 4 voci: **Le mie cose · Task · Spese · Altro** (rimborsi, commissioni, persone, impostazioni).
- La festa attiva è nell'URL (`/gestione/f/[slug]`) e viene ricordata.

### 6.2 "Le mie cose" (home)
In ordine:
1. **Da gestire** (badge): richieste arrivate alle mie commissioni (referenti), spese da approvare (admin).
2. **I miei task**: scaduti e di oggi in evidenza, poi gli altri. Pulsanti diretti **"Inizio"** e **"Fatto"** su ogni riga.
3. **Task che ho dato ad altri**, con il loro stato.
4. **I miei soldi**: le mie spese e **quanto devo ricevere**.
5. Countdown alla festa, se la data è impostata.

### 6.3 Task
- Creazione in un solo form corto: titolo, commissione, responsabile (l'elenco mostra solo chi posso scegliere), scadenza. Tutto il resto è facoltativo.
- Lista unica con filtri a bottoni: commissione, persona, "scaduti", "da assegnare", "richieste".
- Dettaglio: descrizione, checklist, allegati/link, commenti, storico.
- Su desktop, vista a colonne per stato (facoltativa).

### 6.4 Spese e rimborsi
- **Nuova spesa in 30 secondi** dal telefono: foto scontrino → importo → cosa è → commissione → **chi ha pagato?** (Cassa / Io / Un'altra persona, scelta dall'elenco o scritta a mano) → invia.
- **Da approvare** (admin): Approva / Rifiuta con motivo, anche più spese insieme.
- **Riepilogo**: budget, approvato, in attesa, entrate, saldo; per commissione se c'è un budget.
- **Rimborsi, "chi deve ricevere quanto"**: una riga per persona con anticipato, già rimborsato e **da rimborsare** in grande. Tocchi una persona e vedi le sue spese con gli scontrini. L'admin preme **"Rimborsa"**, sceglie le spese, la modalità e la data, e il rimborso è registrato.
- Export CSV di movimenti e rimborsi.

### 6.5 Persone e commissioni
- **Persone**: elenco con ruoli. **Nuova persona**: nome, telefono, email. L'account nasce con una password casuale che nessuno vede e parte l'email nativa di Firebase Auth con il link per **scegliere la propria password** (stesso modello del reset password); poi si propone **"Avvisa su WhatsApp"** ("ti è arrivata un'email, guarda anche nello spam"). Se l'email non arriva: "Rimanda l'email", oppure l'admin genera una password temporanea dalla scheda persona (6.7), che al primo accesso va cambiata. *(Decisione di Alessio del 21/10/2026, al posto delle credenziali su WhatsApp.)*
- **Commissioni**: card con colore, referenti e componenti. All'interno: task e spese della commissione.
- Alla creazione di una festa viene creata in automatico la commissione **Generale**.

### 6.6 Comunicazione = WhatsApp
Nessuna email e nessuna notifica push. Dopo le azioni che riguardano un'altra persona compare un pulsante **"Avvisa su WhatsApp"**, che apre `https://wa.me/<telefono>?text=<messaggio>` con un testo precompilato e il link diretto:
- task assegnato o riassegnato → al responsabile
- richiesta inviata → al referente; richiesta accettata o rifiutata → al richiedente
- spesa inviata → agli admin; spesa approvata, rifiutata o rimborsata → all'autore o al beneficiario
- nuova persona → avviso che è arrivata l'email per scegliere la password

Su ogni task e spesa c'è anche **"Condividi"**, che apre WhatsApp senza destinatario per incollare nel gruppo. I testi stanno tutti in `lib/whatsapp.ts`.

### 6.7 Password dimenticata
Dalla pagina di login parte il reset nativo di Firebase Auth via email. In alternativa un admin o il superadmin genera una nuova password temporanea e la manda su WhatsApp.

---

## 7. Il giorno della festa (Fase 2, NON sviluppare ora)

### 7.1 Il sito pubblico colleiano.it
Questo progetto **sostituisce** il sito attuale di colleiano.it (fatto per l'edizione 2026, HTML statico su GitHub Pages dal ramo `sito-2026` di questo stesso repo), che resta online così com'è fino al rilascio della Fase 2. Il passaggio si fa spostando il DNS su App Hosting e disattivando GitHub Pages; il ramo `sito-2026` resta come archivio. Il sito nuovo è generico e vive tutto l'anno; i contenuti della festa compaiono da soli quando un admin la rende pubblica.

Si apre anche dalla fotocamera: nessun download, nessun login, funziona su qualsiasi telefono. Al massimo 2 tocchi per arrivare a qualsiasi cosa.

**Gestione dal gestionale**: voce **"Sito"**.
- Schede per festa (admin della festa): **Programma**, **Avvisi**, **Mappa** (immagine e punti), **Pagina della festa** (testo, foto di copertina, galleria), interruttore **"Modalità festa"**.
- Schede globali (superadmin): **Festa in evidenza** (quale festa mostra la home), **Testi del sito** (chi siamo, come arrivare, domande frequenti), **Archivio** (quali feste passate compaiono tra le edizioni).
- Pulsante **"Anteprima"** per vedere il sito come un visitatore.

**Home** (`/`), con due stati:
- **Normale (tutto l'anno)**:
  - Cos'è Colleiano e cos'è la festa, con testo e foto.
  - Prossima edizione: nome, data e countdown se impostati, altrimenti "In preparazione".
  - Link a **Edizioni passate** e **Come arrivare e domande frequenti**.
- **Modalità festa** (attivata da un admin per la festa in evidenza):
  - In cima: nome della festa, cosa sta succedendo **adesso** e cosa c'è dopo.
  - **Avvisi** in evidenza (es. "Spettacolo spostato in piazza", "Rinviata per pioggia").
  - Tre bottoni enormi: **Programma · Mappa · Wi-Fi**.
  - Sotto, il resto della home normale.

**Edizioni passate** (`/edizioni`, `/edizioni/[slug]`)
- Una pagina per ogni festa messa in archivio: testo, foto, programma di quell'edizione (dagli stessi dati del programma), eventuali citazioni e ringraziamenti.
- L'edizione 2026 sarà la prima: il comitato la crea dal gestionale come festa archiviata, riportando i contenuti del sito attuale (programma, artisti, foto).

**Come arrivare e domande frequenti** (`/info`)
- Indirizzo, link a Google Maps, parcheggi, domande frequenti modificabili dal gestionale.

**Programma** (`/programma`)
- Lista per orario: ora, titolo, luogo (tocchi il luogo e si apre sulla mappa), breve descrizione. Ciò che è in corso è evidenziato, ciò che è finito è attenuato.

**Mappa** (`/mappa`, con un QR dedicato)
- È il pezzo "figo": una **mappa illustrata del paese** (un disegno, non Google Maps) con icone grandi e colorate.
- In alto, **bottoni enormi per filtrare**, con icona e testo: **Bagni · Mangiare · Bere · Eventi · Parcheggio · Info · Primo soccorso · Accessibile · Wi-Fi**. Ne tocchi uno e restano solo quei punti, che pulsano. "Tutto" riporta la vista completa.
- Tocchi un punto e si apre una scheda grande dal basso: nome, foto, cosa c'è, orari, eventi del programma in quel punto, "Come arrivo" (apre Google Maps).
- Facoltativo: "Sei qui" con il GPS, se il visitatore lo consente.
- Zoom con due dita e pulsanti + e − ben visibili.
- **Editor nel gestionale** (admin): si carica l'immagine della mappa, si aggiungono i punti trascinandoli, si sceglie la categoria e si compila la scheda. Anteprima identica a quella pubblica.
- Tecnica: Leaflet con l'immagine come sfondo (`CRS.Simple`), punti in Firestore.
- **L'immagine della mappa** è un disegno stilizzato del paese visto dall'alto: piazza, chiesa, vie principali, prati, parcheggi, con i colori della festa. La prepara il comitato fuori dal codice (illustratore, disegno a mano scansionato, oppure ricalcato da OpenStreetMap). Requisiti: orizzontale, almeno 4000 px sul lato lungo, PNG o WebP. L'app ne genera da sola una versione leggera per il telefono.
- Le coordinate dei punti sono **relative all'immagine (0..1)**: si può sostituire il disegno (bozza → versione definitiva) senza rifare i punti, purché inquadri la stessa zona con le stesse proporzioni. Finché il disegno non c'è, l'editor accetta un'immagine qualsiasi come segnaposto (anche uno screenshot della mappa).

**Wi-Fi** (`/wifi`)
- Dove si trova il Wi-Fi (punto sulla mappa), nome della rete ed eventuale password, e un QR per collegarsi.

### 7.2 Funzionare con il segnale che non c'è
- In paese il telefono non prende. C'è **un solo punto Wi-Fi**, nella **piazza dove si mangia** (rete `colleiano-wifi`, Starlink o altra connessione: il nome resta sempre lo stesso). Sui fogli in giro per il paese: "Collegati a colleiano-wifi in piazza".
- Conseguenza: **chi scansiona un QR lontano dalla piazza non riesce ad aprire nulla**, a meno che non abbia già aperto l'app una volta. Quindi:
  - Il sito pubblico è una **PWA con cache offline completa**: alla prima apertura (in piazza, sul Wi-Fi) salva programma, mappa, immagini e icone. Da quel momento funziona ovunque, anche senza segnale.
  - Ogni pagina mostra "Aggiornato alle 15:32". Gli avvisi nuovi arrivano appena si torna in piazza.
  - Sui fogli fuori dalla piazza il messaggio è **"Apri la mappa in piazza col Wi-Fi: poi funziona ovunque"**, non solo il QR.
  - Pagina leggera: immagine della mappa ottimizzata (WebP, tile o versione ridotta), niente librerie pesanti, tempo di caricamento sul Wi-Fi sotto i 3 secondi.
  - Nessuna pagina pubblica deve richiedere internet dopo il primo caricamento, tranne gli avvisi aggiornati.

### 7.3 Dati della Fase 2 (bozza)
```ts
feste/{f}/programma/{id}  { titolo, inizio: Timestamp, fine?: Timestamp, puntoId?: string, descrizione?, ordine }
feste/{f}/avvisi/{id}     { testo, tipo: "info"|"importante", attivo: boolean, createdAt }
feste/{f}/mappa/config    { immagine: { path, larghezza, altezza }, wifi: { nomeRete, password?, puntoId } }
feste/{f}/mappa/config/punti/{id}
                          { nome, categoria: "bagni"|"mangiare"|"bere"|"eventi"|"parcheggio"|"info"|"soccorso"|"wifi"|"altro",
                            x, y /* coordinate relative 0..1 sull'immagine */, descrizione?, foto?, orari?, accessibile: boolean }
sito/config               { festaInEvidenzaId?: string, chiSiamo: string, comeArrivare: string, indirizzo: string, linkMappe: string,
                            faq: { domanda, risposta }[], immagineCopertina? }   // scrive solo il superadmin
// campi aggiunti a feste/{f}:
{ modalitaFesta: boolean, inArchivioPubblico: boolean,
  paginaPubblica: { testo?: string, copertina?: string, galleria: string[] } }
```
Regole: `sito/config` è leggibile da chiunque. I contenuti pubblici di una festa (programma, avvisi, mappa, pagina) sono leggibili da chiunque **solo** se la festa è quella in evidenza oppure ha `inArchivioPubblico: true`; altrimenti restano privati. Li scrivono gli admin della festa; `sito/config` solo il superadmin. Il sito pubblico legge solo questi documenti, mai task, spese o persone. Per non esporre dati interni, i dati pubblici della festa (`modalitaFesta`, `inArchivioPubblico`, `paginaPubblica`, nome, data) vanno copiati da una Function in `sitoFeste/{festaId}`, leggibile da tutti, invece di rendere pubblico il documento `feste/{f}`.

**PWA**: due manifest. Il sito pubblico ha scope `/` e start `/`, il gestionale ha scope `/gestione/` e start `/gestione`. Un solo service worker con strategie diverse: cache offline completa per le pagine pubbliche (7.2), solo l'app shell per il gestionale (i dati del gestionale li gestisce la persistenza offline di Firestore).

### 7.4 Rimandato: la parte cibo (NON progettare né sviluppare ora)
Decisioni già prese, da riprendere più avanti:
- Ordine dal **QR del tavolo**, oppure solo consultazione del menù.
- **Pagamento in app** (Stripe Checkout con Apple Pay e Google Pay, o un servizio simile). Solo a pagamento confermato l'ordine passa alla cucina.
- **Fogliettini stampati** per postazione, con il numero del tavolo enorme al centro, e servizio al tavolo.
- **Prenotazioni** online.
- Funziona solo in piazza, sul Wi-Fi.

## 8. Avvio

### 8.0 Setup del repo (si riusa `aleberna95/colleiano-sito`)
Il repo del sito attuale diventa il repo della piattaforma, **senza mai mettere offline colleiano.it**. Lo esegue Claude Code con `git` e la CLI `gh` (autenticata con permessi di amministrazione sul repo), in quest'ordine. **Se un passo fallisce, fermati e chiedi ad Alessio: non improvvisare.**

1. **Ramo per il sito attuale**
   ```bash
   git switch main && git pull
   git switch -c sito-2026 && git push -u origin sito-2026
   ```
2. **GitHub Pages pubblica dal nuovo ramo**
   ```bash
   gh api repos/aleberna95/colleiano-sito/pages            # annota la configurazione attuale (source, cname)
   gh api -X PUT repos/aleberna95/colleiano-sito/pages \
     -f "source[branch]=sito-2026" -f "source[path]=/"
   ```
   Se la configurazione attuale usa GitHub Actions invece di "deploy from a branch", fermati e chiedi.
3. **Verifica, prima di toccare `main`**
   ```bash
   gh api repos/aleberna95/colleiano-sito/pages/builds/latest --jq .status   # ripeti finché è "built"
   gh api repos/aleberna95/colleiano-sito/pages --jq '{source, cname}'      # deve dire sito-2026 e colleiano.it
   curl -sI https://colleiano.it | head -1                                  # deve rispondere 200
   ```
   Poi chiedi ad Alessio di aprire colleiano.it dal telefono e confermare. **Senza la sua conferma non si procede.**
4. **Pulizia di `main`**, in un unico commit `chore: sposta il sito 2026 in legacy-site`:
   - sposta `index.html`, `css/`, `js/`, `src/icons/` in `legacy-site/`;
   - elimina da `main` i video `src/assets/carosello/*.mp4` e il file `CNAME` (restano nel ramo `sito-2026`);
   - aggiunge `legacy-site/README.md`: "Copia di riferimento del sito 2026. Non modificare, non pubblicare. Il sito online è servito dal ramo `sito-2026`."
5. **Avvio del progetto**: `docs/SPEC.md` (questo documento), poi la M0 con Next.js nella root.
6. **Alessio (console Firebase, a mano perché serve la fatturazione)**: crea il progetto Firebase, attiva il piano Blaze con un avviso di budget, crea il backend App Hosting collegato al repo sul ramo `main`. Claude Code gli passa l'elenco esatto dei valori da inserire.

Regola permanente: **nessun commit sul ramo `sito-2026`** fino alla Fase 2, salvo correzioni urgenti al sito attuale chieste da Alessio.

### 8.1 Il superadmin

Script `scripts/bootstrap-superadmin.ts`, eseguito una volta in locale:
```
pnpm bootstrap:superadmin --email alebernardini95@gmail.com --nome Alessio --cognome Bernardini --telefono <numero>
```
- Crea l'utente se non esiste (idempotente).
- Genera una **password casuale robusta** (24 caratteri, `crypto.randomBytes`) e la stampa **una sola volta** nel terminale, senza salvarla da nessuna parte.
- Imposta il claim `superadmin: true` e crea `users/{uid}` con `devoCambiarePassword: true`.
- Non crea nient'altro.

Primo avvio: Alessio entra, cambia la password, vede "Crea la prima festa", la crea (insieme alla commissione Generale) e da **Persone** crea gli altri. Conviene nominare subito un **secondo superadmin**, per non dipendere da una sola persona.

`scripts/seed-emulator.ts`: dati finti solo per l'emulatore, con un blocco che ne impedisce l'esecuzione in produzione.

---

## 9. UX e design

### 9.1 A prova di chiunque
- **Mobile first.** Testo base 17-18 px, pulsanti alti almeno 48 px con **testo e icona**, contrasto almeno AA.
- **Una cosa principale per schermata.** Parole di tutti i giorni: "Da fare", "Ci sto lavorando", "Bloccato", "Fatto".
- Conferma chiara dopo ogni azione ("Spesa inviata. Avvisa Toto su WhatsApp?").
- Nessun gesto nascosto. Stati vuoti che spiegano cosa fare.
- Funziona con segnale scarso: persistenza offline di Firestore, indicatore "Sei offline".
- Installabile come app (PWA), con istruzioni per iPhone e Android al primo accesso.
- Sito pubblico (Fase 2): ancora più semplice. Niente login, bottoni enormi, al massimo 2 tocchi per arrivare a qualsiasi cosa, deve funzionare anche senza segnale.

### 9.2 Identità visiva (dal sito attuale di colleiano.it)
Token reali del design system del sito (`legacy-site/css/style.css`), da riportare in `tailwind.config` come colori `colleiano.*` e in `globals.css`:
```css
:root {
  /* Palette Colleiano */
  --color-forest: #1B3022;   /* verde bosco: titoli, barre, azioni principali */
  --color-linen:  #F9F7F2;   /* lino: sfondo */
  --color-rust:   #A0522D;   /* ruggine: accento, pulsanti secondari, evidenze */
  --color-slate:  #2F2F2F;   /* testo */
  --color-surface: #FFFFFF;  /* card */
  /* varianti trasparenti come nel sito: forest-10/20/40/60/80, linen-40/60/80, rust-10/20/80, slate-40/60 */

  /* Stati (aggiunti per il gestionale, da verificare a contrasto AA su linen e bianco) */
  --color-danger: #B3261E; --color-warning: #B26A00; --color-success: #2E7D32;

  /* Forme */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 16px; --radius-full: 9999px;
  --shadow-xs: 0 2px 8px -4px rgba(0,0,0,.08);
  --shadow-sm: 0 4px 16px -8px rgba(0,0,0,.10);
  --shadow-md: 0 10px 30px -15px rgba(0,0,0,.10);
  --shadow-lg: 0 20px 50px -20px rgba(0,0,0,.12);
  --shadow-rust: 0 8px 24px -8px rgba(160,82,45,.35);
}
```
- **Font**: *Playfair Display* per i titoli, *Inter* per l'interfaccia (via `next/font`). Nel gestionale la base resta 17-18 px per la leggibilità, più grande del sito attuale.
- **Logo e icone**: `legacy-site/src/icons/icona_colleiano.png`, `icona_colleiano_con_scritte.png`; firma `ba_logo.svg` nel footer del sito pubblico.
- **Il sito pubblico** (Fase 2) riprende lo stile attuale: grana leggera, navigazione "vetro", titoli in Playfair. **Il gestionale** usa gli stessi colori e font, ma in modo più sobrio: niente effetti, priorità alla leggibilità.
- **Colori delle commissioni**: lista chiusa di tinte pastello (giallo, arancio, viola, verde, rosso, blu, teal, grigio) con contrasto AA, coerenti con la palette.

---

## 10. Roadmap

### Fase 1: gestionale (ora)
| # | Milestone | Fatto quando |
|---|---|---|
| M0 | Fondamenta: repo, Next.js, Tailwind/shadcn, Firebase + emulatori, CI, `CLAUDE.md`, schemi Zod | `pnpm dev` + emulatori partono, CI verde |
| M1 | Accesso: bootstrap, login, cambio password obbligato, reset password, `/admin` | Alessio entra e vede "Crea la prima festa" |
| M2 | Feste, persone, commissioni, ruoli; credenziali su WhatsApp; disattivazione | Il superadmin crea un admin, l'admin crea un membro (non un admin); test ruoli verdi |
| M3 | Task e richieste, "Le mie cose", pulsanti WhatsApp | Test task verdi |
| M4 | Spese, approvazioni, rimborsi, CSV | e2e: spesa anticipata → approvata → rimborsata, saldo giusto |
| M5 | Rifinitura: PWA, offline, accessibilità, deploy | Prod online con il solo superadmin |

### Fase 2: sito pubblico (da ~3-4 mesi prima)
Ordine: **voce "Sito" nel gestionale → home, info ed edizioni passate (inserire l'edizione 2026) → pubblicazione su colleiano.it al posto del sito attuale → editor mappa → mappa pubblica con filtri → programma, avvisi, modalità festa → cache offline → prova sul posto**. La prova va fatta in paese, con il Wi-Fi in piazza, almeno un mese prima: apri l'app in piazza, spegni il Wi-Fi, gira il paese e controlla che tutto funzioni.

**Definition of done (sempre)**: tipi Zod condivisi, regole + test, UI provata a 375 px, stati di caricamento/vuoto/errore gestiti, testi in italiano semplice.

---

## 11. Decisioni

**Prese**
- Tutti vedono tutto, si tocca solo ciò che compete; si assegna a pari livello o sotto.
- Solo i superadmin creano admin; gli admin creano gli altri. Sistema che parte con il solo Alessio.
- Il creatore di un task lo modifica solo finché è "Da fare". Richieste tra commissioni attive.
- Chiunque inserisce spese (sulle sue commissioni o su Generale), approvano gli admin, sezione rimborsi "chi deve ricevere quanto".
- Comunicazioni solo via WhatsApp, niente email automatiche (tranne il reset password nativo).
- Un solo dominio, `colleiano.it`: il sito pubblico sostituisce quello attuale (che resta solo come riferimento grafico), il gestionale sta su `/gestione`.
- Sito pubblico generico, tutto l'anno: home, edizioni passate, info. In modalità festa compaiono programma, avvisi e mappa illustrata filtrabile con bottoni enormi, utilizzabili offline dopo la prima apertura.
- Un solo punto Wi-Fi, nella piazza dove si mangia, con la rete `colleiano-wifi`.
- Parte cibo rimandata (sezione 7.4); quando si riprende si paga in app.
- Niente aspetti fiscali.

**Da decidere prima della Fase 2**: nulla. Il disegno della mappa è un compito del comitato (sezione 7.1), non blocca lo sviluppo.
