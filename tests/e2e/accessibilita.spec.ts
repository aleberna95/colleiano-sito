import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { admin, creaFesta, creaUtente, svuotaEmulatori } from "./helpers";

// Definition of done: ogni pagina a 375px, contrasto e struttura accessibili (WCAG A/AA), niente scorrimento orizzontale.

test.beforeEach(async () => {
  await svuotaEmulatori();
});

async function controlla(page: Page, nome: string) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Lascia arrivare i dati (liste, riepiloghi) prima di controllare.
  await expect(page.getByText("Caricamento...")).toHaveCount(0);
  await page.screenshot({ path: `test-results/schermate/${nome}.png`, fullPage: true });

  const larghezza = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(larghezza, `${nome}: scorrimento orizzontale`).toBeLessThanOrEqual(375);

  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const gravi = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(gravi, `${nome}: problemi di accessibilità`).toEqual([]);
}

test("tutte le pagine principali a 375px sono accessibili", async ({ page }) => {
  test.setTimeout(240_000);
  const anna = await creaUtente({ email: "anna@test.it", password: "password-test", nome: "Anna", devoCambiarePassword: false });
  const luca = await creaUtente({ email: "luca@test.it", password: "password-test", nome: "Luca", devoCambiarePassword: false });
  const festaId = await creaFesta("prova", [
    { uid: anna, nome: "Anna", admin: true },
    { uid: luca, nome: "Luca", commissioni: { m: "componente" } },
  ]);
  const { db } = admin();
  const audit = { createdAt: FieldValue.serverTimestamp(), createdBy: luca, updatedAt: FieldValue.serverTimestamp(), updatedBy: luca };
  const task = await db.collection(`feste/${festaId}/tasks`).add({
    titolo: "Montare il palco", commissioneId: "m", responsabileUid: anna, stato: "in_corso", priorita: "urgente",
    scadenza: Timestamp.fromMillis(Date.now() - 86_400_000), checklist: [{ id: "1", testo: "Pedane", fatto: true }], link: [], eliminato: false, ...audit,
  });
  await db.collection(`feste/${festaId}/tasks`).add({
    titolo: "Servono le casse", commissioneId: "m", responsabileUid: null, stato: "richiesta", richiestoDa: anna,
    priorita: "normale", checklist: [], link: [], eliminato: false, ...audit, createdBy: anna,
  });
  const spesa = await db.collection(`feste/${festaId}/movimenti`).add({
    tipo: "spesa", commissioneId: "m", descrizione: "Corde per il palco", importoCents: 2550, categoria: "Altro",
    dataSpesa: Timestamp.now(), pagatoDa: { tipo: "anticipata", beneficiarioUid: luca }, stato: "in_attesa", scontrini: [], eliminato: false, ...audit,
  });
  await db.collection(`feste/${festaId}/movimenti`).add({
    tipo: "spesa", commissioneId: "m", descrizione: "Prolunghe", importoCents: 1800, categoria: "Altro",
    dataSpesa: Timestamp.now(), pagatoDa: { tipo: "anticipata", beneficiarioUid: luca }, stato: "approvata", approvatoDa: anna, scontrini: [], eliminato: false, ...audit,
  });

  await page.goto("/gestione/login");
  await controlla(page, "login");
  await page.getByLabel("Email").fill("anna@test.it");
  await page.getByLabel("Password").fill("password-test");
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page).toHaveURL(/\/gestione\/f\/prova$/);

  const base = "/gestione/f/prova";
  const pagine: [string, string][] = [
    ["le-mie-cose", base],
    ["task", `${base}/task`],
    ["task-nuovo", `${base}/task/nuovo`],
    ["task-dettaglio", `${base}/task/${task.id}`],
    ["spese", `${base}/spese`],
    ["spesa-nuova", `${base}/spese/nuova`],
    ["spesa-dettaglio", `${base}/spese/${spesa.id}`],
    ["da-approvare", `${base}/spese/da-approvare`],
    ["entrata", `${base}/spese/entrata`],
    ["rimborsi", `${base}/rimborsi`],
    ["rimborsi-persona", `${base}/rimborsi/${encodeURIComponent(`u:${luca}`)}`],
    ["altro", `${base}/altro`],
    ["persone", `${base}/persone`],
    ["persona", `${base}/persone/${luca}`],
    ["persona-nuova", `${base}/persone/nuova`],
    ["commissioni", `${base}/commissioni`],
    ["commissione", `${base}/commissioni/m`],
    ["impostazioni", `${base}/impostazioni`],
    ["cambia-password", "/gestione/cambia-password"],
  ];
  for (const [nome, url] of pagine) {
    await page.goto(url);
    await controlla(page, nome);
  }
});
