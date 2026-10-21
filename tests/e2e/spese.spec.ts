import { expect, test, type Page } from "@playwright/test";
import { creaFesta, creaUtente, svuotaEmulatori } from "./helpers";

test.beforeEach(async () => {
  await svuotaEmulatori();
});

async function entra(page: Page, email: string) {
  await page.goto("/gestione/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-test");
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page).toHaveURL(/\/gestione\/f\/prova$/);
}

async function esci(page: Page) {
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/gestione\/login$/);
}

const utente = (nome: string) =>
  creaUtente({ email: `${nome.toLowerCase()}@test.it`, password: "password-test", nome, devoCambiarePassword: false });

/** Valore di una voce del riepilogo (etichetta e importo stanno nello stesso riquadro). */
const voce = (page: Page, etichetta: string) =>
  page.locator("div", { has: page.getByText(etichetta, { exact: true }) }).last();

test("spesa anticipata → approvata → rimborsata, saldo giusto", async ({ page }) => {
  const anna = await utente("Anna");
  const luca = await utente("Luca");
  await creaFesta("prova", [
    { uid: anna, nome: "Anna", admin: true },
    { uid: luca, nome: "Luca", commissioni: { m: "componente" } },
  ]);

  // Il componente segna una spesa pagata di tasca sua
  await entra(page, "luca@test.it");
  await page.getByRole("link", { name: "Nuova spesa" }).click();
  await page.getByRole("textbox", { name: "Quanto hai speso (euro)" }).fill("25,50");
  await page.getByRole("textbox", { name: "Cosa hai comprato" }).fill("Corde per il palco");
  await expect(page.getByRole("radio", { name: "Io" })).toBeChecked();
  await page.getByRole("button", { name: "Invia la spesa" }).click();
  await expect(page.getByRole("heading", { name: "Spesa inviata" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Avvisa Anna su WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/393331234567\?text=.*Corde/);
  await esci(page);

  // L'admin la approva da "Le mie cose"
  await entra(page, "anna@test.it");
  await page.getByRole("link", { name: "1 spesa da approvare" }).click();
  await page.getByRole("checkbox", { name: "Scegli Corde per il palco" }).check();
  await page.getByRole("button", { name: "Approva" }).click();
  await expect(page.getByText("Spesa approvata.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Avvisa Luca su WhatsApp" })).toBeVisible();

  // Un'entrata, poi il riepilogo
  await page.getByRole("link", { name: "Spese", exact: true }).click();
  await page.getByRole("link", { name: "Registra un'entrata" }).click();
  await page.getByRole("textbox", { name: "Quanto (euro)" }).fill("100");
  await page.getByRole("textbox", { name: /Da dove arrivano/ }).fill("Sponsor Bar Centrale");
  await page.getByRole("button", { name: "Registra l'entrata" }).click();
  await expect(page.getByRole("heading", { name: "Entrata registrata" })).toBeVisible();
  await page.getByRole("link", { name: "Spese", exact: true }).click();
  await expect(voce(page, "Spese approvate")).toContainText("25,50");
  await expect(voce(page, "Entrate")).toContainText("100,00");
  await expect(voce(page, "Saldo (entrate − spese)")).toContainText("74,50");

  // Rimborso: chi deve ricevere quanto
  await page.getByRole("link", { name: "Rimborsi", exact: true }).click();
  await page.getByRole("link", { name: /Luca/ }).click();
  await expect(voce(page, "Da ricevere")).toContainText("25,50");
  await page.getByRole("button", { name: "Rimborsa" }).click();
  await page.getByRole("button", { name: /Registra il rimborso di 25,50/ }).click();
  await expect(page.getByText(/Rimborso di 25,50.* registrato/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Avvisa Luca su WhatsApp" })).toBeVisible();
  await expect(voce(page, "Da ricevere")).toContainText("0,00");
  await expect(voce(page, "Rimborsato")).toContainText("25,50");

  // Il saldo non cambia: la spesa era già contata come approvata
  await page.getByRole("link", { name: "Spese", exact: true }).click();
  await expect(voce(page, "Saldo (entrate − spese)")).toContainText("74,50");
  await esci(page);

  // Luca non deve più ricevere nulla
  await entra(page, "luca@test.it");
  await expect(page.getByText("Devi ricevere")).toHaveCount(0);
});
