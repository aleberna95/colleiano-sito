# Stato del lavoro

> Aggiornato: 20/10/2026. Specifica: `docs/SPEC.md`. Leggere anche `CLAUDE.md` (quando esiste).

## Setup del repo (SPEC 8.0)
- [x] 1. Ramo `sito-2026` creato da `fd221fd` e pushato.
- [x] 2. GitHub Pages pubblica da `sito-2026` (`/`), cname `colleiano.it`, HTTPS forzato.
  Configurazione precedente: `build_type: legacy`, source `main` `/`, cname `colleiano.it`.
- [x] 3. Build Pages da `sito-2026` ok, `https://colleiano.it` → 200. Alessio ha confermato dal telefono.
- [x] 4. Commit `chore: sposta il sito 2026 in legacy-site` (8e7131f).
- [x] 5. Specifica in `docs/SPEC.md`.
- [ ] 6. Alessio: progetto Firebase, piano Blaze + avviso budget, backend App Hosting su `main`.
  Istruzioni da dare a fine M0 (serve un'app Next.js su `main` per la prima build).

## Fase 1
| Milestone | Stato |
|---|---|
| M0 Fondamenta | piano proposto, in attesa di conferma |
| M1 Accesso | – |
| M2 Feste, persone, commissioni | – |
| M3 Task | – |
| M4 Spese e rimborsi | – |
| M5 Rifinitura e deploy | – |

## Decisioni prese durante lo sviluppo
- Al PUT di Pages è stato aggiunto `cname=colleiano.it` per non perdere il dominio.

## Problemi aperti
- `gh` è installato in `C:\Program Files\GitHub CLI\gh.exe` ma il terminale di VS Code non lo vede ancora nel PATH: usare il percorso completo o riavviare il PC.
- `pnpm` non è installato (Node 24.16, Java 21, firebase-tools 15.29 presenti).

## Comandi
(da compilare in M0)
