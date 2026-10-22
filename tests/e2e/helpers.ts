import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

const PROJECT_ID = "demo-colleiano";

export function admin() {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return { auth: getAuth(), db: getFirestore() };
}

/**
 * Fa quello che fa la persona con il link dell'email "scegli la password": legge il codice
 * dall'emulatore Auth e imposta la password.
 */
export async function scegliPasswordDaEmail(email: string, password: string) {
  const r = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await r.json()) as { oobCodes: { email: string; requestType: string; oobCode: string }[] };
  const codice = oobCodes.filter((c) => c.email === email && c.requestType === "PASSWORD_RESET").at(-1);
  if (!codice) throw new Error(`Nessuna email per scegliere la password inviata a ${email}`);
  const ok = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oobCode: codice.oobCode, newPassword: password }),
  });
  if (!ok.ok) throw new Error(`Password non impostata: ${await ok.text()}`);
}

/** Svuota Auth e Firestore dell'emulatore. */
export async function svuotaEmulatori() {
  const base = { method: "DELETE", headers: { Authorization: "Bearer owner" } };
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, base);
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, base);
}

/** Crea un utente come farebbe lo script di bootstrap o la Function. */
export async function creaUtente(opz: {
  email: string;
  password: string;
  nome: string;
  superadmin?: boolean;
  devoCambiarePassword?: boolean;
}) {
  const { auth, db } = admin();
  const { uid } = await auth.createUser({ email: opz.email, password: opz.password });
  if (opz.superadmin) await auth.setCustomUserClaims(uid, { superadmin: true });
  await db.doc(`users/${uid}`).set({
    nome: opz.nome,
    cognome: "Test",
    nomeVisualizzato: opz.nome,
    email: opz.email,
    telefono: "3330000000",
    superadmin: opz.superadmin ?? false,
    attivo: true,
    devoCambiarePassword: opz.devoCambiarePassword ?? true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "test",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "test",
  });
  return uid;
}

/** Festa con commissioni Musica (m) e Cucina (c) e i membri indicati, scritta direttamente sull'emulatore. */
export async function creaFesta(slug: string, membri: { uid: string; nome: string; admin?: boolean; commissioni?: Record<string, "referente" | "componente"> }[]) {
  const { db } = admin();
  const audit = { createdAt: FieldValue.serverTimestamp(), createdBy: "test", updatedAt: FieldValue.serverTimestamp(), updatedBy: "test" };
  const festaId = "festa-e2e";
  await db.doc(`feste/${festaId}`).set({ nome: "Festa di prova", slug, stato: "preparazione", categorieSpesa: ["Altro"], ...audit });
  const comm = (nome: string, ordine: number, generale = false) => ({
    nome, icona: "music", colore: "blu", ordine, generale, referentiUids: [], componentiUids: [], ...audit,
  });
  await db.doc(`feste/${festaId}/commissioni/generale`).set(comm("Generale", 0, true));
  await db.doc(`feste/${festaId}/commissioni/m`).set(comm("Musica", 1));
  await db.doc(`feste/${festaId}/commissioni/c`).set(comm("Cucina", 2));
  for (const m of membri) {
    await db.doc(`feste/${festaId}/membri/${m.uid}`).set({
      uid: m.uid, nomeVisualizzato: m.nome, telefono: "333 123 4567", ruoloFesta: m.admin ? "admin" : "membro",
      commissioni: m.commissioni ?? {}, attivo: true, ...audit,
    });
  }
  return festaId;
}

/** "Esci" cancella la copia locale dei dati e ricarica la pagina di login: si aspetta il ricaricamento completo. */
export async function esci(page: Page) {
  const ricaricata = page.waitForEvent("load");
  await page.getByRole("button", { name: "Esci" }).click();
  await ricaricata;
  await expect(page).toHaveURL(/\/gestione\/login$/);
}

// Definition of done: ogni pagina a 375px, contrasto e struttura accessibili (WCAG A/AA), niente scorrimento orizzontale.
export async function controlla(page: Page, nome: string) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Lascia arrivare i dati (liste, riepiloghi) prima di controllare.
  await expect(page.getByText("Caricamento...")).toHaveCount(0);
  await expect(page.getByText("Un attimo...")).toHaveCount(0);
  await page.screenshot({ path: `test-results/schermate/${nome}.png`, fullPage: true });

  const larghezza = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(larghezza, `${nome}: scorrimento orizzontale`).toBeLessThanOrEqual(375);

  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const gravi = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(gravi, `${nome}: problemi di accessibilità`).toEqual([]);
}
