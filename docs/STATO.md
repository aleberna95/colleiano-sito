# Stato del lavoro

> Aggiornato: 20/10/2026. Specifica: `docs/SPEC.md`. Convenzioni e comandi: `CLAUDE.md`.

## Setup del repo (SPEC 8.0)
- [x] 1. Ramo `sito-2026` creato da `fd221fd` e pushato.
- [x] 2. GitHub Pages pubblica da `sito-2026` (`/`), cname `colleiano.it`, HTTPS forzato.
  Configurazione precedente: `build_type: legacy`, source `main` `/`, cname `colleiano.it`.
- [x] 3. Build Pages da `sito-2026` ok, `https://colleiano.it` → 200. Alessio ha confermato dal telefono.
- [x] 4. Commit `chore: sposta il sito 2026 in legacy-site` (8e7131f).
- [x] 5. Specifica in `docs/SPEC.md`.
- [ ] 6. Progetto Firebase `colleiano` creato da Alessio (vuoto: niente Firestore, App Hosting, app web).
  Mancano: piano Blaze + avviso budget, Firestore `eur3`, Auth email/password, backend App Hosting su `main`.

## Fase 1
| Milestone | Stato |
|---|---|
| M0 Fondamenta | ✅ fatta |
| M1 Accesso | – |
| M2 Feste, persone, commissioni | – |
| M3 Task | – |
| M4 Spese e rimborsi | – |
| M5 Rifinitura e deploy | – |

### M0 (fatta)
Next.js 16.4 nella root, Tailwind 4 + shadcn/ui con palette Colleiano, font Inter/Playfair, pulsanti 48px; Firebase con emulatori (auth, firestore, storage, functions); regole chiuse con gli helper della SPEC 4.7; `functions/` (Node 24, `europe-west1`, bundle esbuild); schemi Zod Fase 1 in `lib/schemas/`; Vitest (unit + rules); CI GitHub Actions; `CLAUDE.md`.

## Decisioni prese durante lo sviluppo
- Al PUT di Pages è stato aggiunto `cname=colleiano.it` per non perdere il dominio.
- Tailwind 4: i token stanno in `app/globals.css` (`@theme`), non in `tailwind.config`. Classi `colleiano-*`; trasparenze con il modificatore `/10`, `/60`...
- I token di shadcn (`primary`, `secondary`...) sono mappati sulla palette: primary = forest, secondary = rust.
- Functions: pacchetto del workspace pnpm, bundle con esbuild che include `lib/schemas` (niente pacchetto condiviso separato). Runtime Node 24 (GA).
- Timestamp negli schemi Zod: `timestampSchema` accetta qualsiasi oggetto con `toDate()` (client e Admin SDK hanno classi diverse).
- `lib/firebase.ts`: in sviluppo usa gli emulatori con progetto `demo-colleiano`; in produzione `initializeApp()` senza argomenti (configurazione fornita da App Hosting).
- `.firebaserc`: predefinito `demo-colleiano`, alias `prod` = `colleiano`.
- Playwright si aggiunge con il primo test e2e.
- pnpm 10 installato globalmente con npm.

## Problemi aperti
- `gh` è in `C:\Program Files\GitHub CLI\gh.exe` ma il terminale di VS Code non lo vede nel PATH finché il PC non si riavvia: usare il percorso completo.

## Comandi
Vedi la tabella in `CLAUDE.md`. In breve: `pnpm install`, `pnpm emulators` (terminale 1), `pnpm dev` (terminale 2), `pnpm test`, `pnpm test:rules`.
