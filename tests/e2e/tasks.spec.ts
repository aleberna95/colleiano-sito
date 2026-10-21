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

test("task, richiesta tra commissioni e 'Le mie cose'", async ({ page }) => {
  const mario = await utente("Mario");
  const luca = await utente("Luca");
  const gina = await utente("Gina");
  await creaFesta("prova", [
    { uid: mario, nome: "Mario", commissioni: { m: "referente" } },
    { uid: luca, nome: "Luca", commissioni: { m: "componente" } },
    { uid: gina, nome: "Gina", commissioni: { c: "componente" } },
  ]);

  // Il referente di Musica dà un task a un componente
  await entra(page, "mario@test.it");
  await expect(page.getByText("Nessun task per te")).toBeVisible();
  await page.getByRole("link", { name: "Nuovo task" }).click();
  await page.getByLabel("Cosa c'è da fare").fill("Montare il palco");
  await page.getByRole("combobox", { name: "Chi se ne occupa", exact: true }).selectOption({ label: "Luca" });
  await page.getByRole("button", { name: "Crea il task" }).click();
  await expect(page.getByRole("heading", { name: "Task creato" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Avvisa Luca su WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/393331234567\?text=.*Montare/);
  await esci(page);

  // Una componente di Cucina chiede qualcosa a Musica
  await entra(page, "gina@test.it");
  await page.getByRole("link", { name: "Task", exact: true }).click();
  await page.getByRole("link", { name: "Nuovo task" }).click();
  await page.getByLabel("Cosa c'è da fare").fill("Servono le casse");
  await page.getByRole("combobox", { name: "Commissione", exact: true }).selectOption({ label: "Musica (richiesta)" });
  await expect(page.getByRole("combobox", { name: "Chi se ne occupa", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Invia la richiesta" }).click();
  await expect(page.getByRole("heading", { name: "Richiesta inviata" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Avvisa Mario su WhatsApp" })).toBeVisible();
  await esci(page);

  // Il componente trova il task in "Le mie cose", lo inizia e lo chiude
  await entra(page, "luca@test.it");
  const riga = page.getByRole("listitem").filter({ hasText: "Montare il palco" });
  await riga.getByRole("button", { name: "Inizio" }).click();
  await expect(riga.getByText("Ci sto lavorando")).toBeVisible();
  await riga.getByRole("link").click();
  await page.getByLabel("Scrivi un commento").fill("Mi servono due persone");
  await page.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByText("Mi servono due persone")).toBeVisible();
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page.getByText("Ottimo, task fatto!")).toBeVisible();
  await expect(page.getByText("ha cambiato lo stato: Ci sto lavorando → Fatto")).toBeVisible();
  await esci(page);

  // Il referente trova la richiesta "Da gestire" e la accetta
  await entra(page, "mario@test.it");
  await expect(page.getByRole("heading", { name: /Da gestire/ })).toBeVisible();
  await page.getByRole("link", { name: /Servono le casse/ }).click();
  await page.getByRole("combobox", { name: "Chi se ne occupa", exact: true }).selectOption({ label: "Luca" });
  await page.getByRole("button", { name: "Accetta" }).click();
  await expect(page.getByText("Richiesta accettata.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Avvisa Gina su WhatsApp" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Avvisa Luca su WhatsApp" })).toBeVisible();
});
