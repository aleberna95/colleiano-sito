import { expect, test, type Page } from "@playwright/test";
import { creaUtente, esci, scegliPasswordDaEmail, svuotaEmulatori } from "./helpers";

test.beforeEach(async () => {
  await svuotaEmulatori();
});

async function entra(page: Page, email: string, password: string) {
  await page.goto("/gestione/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entra" }).click();
}

async function nuovaPersona(page: Page, dati: { nome: string; email: string; admin?: boolean }) {
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await page.getByRole("link", { name: "Persone", exact: true }).click();
  await page.getByRole("link", { name: "Nuova persona", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill(dati.nome);
  await page.getByLabel("Cognome").fill("Test");
  await page.getByLabel("Telefono (per WhatsApp)").fill("333 123 4567");
  await page.getByLabel("Email (per entrare)").fill(dati.email);
  if (dati.admin) await page.getByLabel("Ruolo nella festa").selectOption("admin");
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.getByRole("heading", { name: `${dati.nome} è nella festa` })).toBeVisible();
  // Niente password sullo schermo: arriva un'email per sceglierla, e si avvisa su WhatsApp.
  await expect(page.getByText(`Email inviata a ${dati.email}.`)).toBeVisible();
  const whatsapp = page.getByRole("link", { name: "Avvisa su WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/393331234567\?text=.*email/);
}

test("il superadmin crea festa e admin; l'admin crea un membro, non un admin", async ({ page }) => {
  await creaUtente({ email: "alessio@test.it", password: "password-alessio", nome: "Alessio", superadmin: true, devoCambiarePassword: false });

  // Prima festa
  await entra(page, "alessio@test.it", "password-alessio");
  await page.getByLabel("Nome della festa").fill("Festa di prova");
  await page.getByRole("button", { name: "Crea la festa" }).click();
  await expect(page).toHaveURL(/\/gestione\/f\/festa-di-prova$/);
  await expect(page.getByRole("heading", { name: "Ciao Alessio!" })).toBeVisible();

  // Il superadmin crea un admin
  await nuovaPersona(page, { nome: "Anna", email: "anna@test.it", admin: true });
  await esci(page);

  // L'admin sceglie la password dal link dell'email, entra e arriva direttamente nella festa
  await scegliPasswordDaEmail("anna@test.it", "password-anna");
  await entra(page, "anna@test.it", "password-anna");
  await expect(page).toHaveURL(/\/gestione\/f\/festa-di-prova$/);

  // L'admin non può scegliere il ruolo Admin: crea solo membri
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await page.getByRole("link", { name: "Persone", exact: true }).click();
  await page.getByRole("link", { name: "Nuova persona", exact: true }).click();
  await expect(page.getByLabel("Ruolo nella festa")).toHaveCount(0);
  await page.goBack();
  await nuovaPersona(page, { nome: "Mario", email: "mario@test.it" });

  // Crea una commissione e ci mette Mario come referente
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await page.getByRole("link", { name: "Commissioni", exact: true }).click();
  await page.getByRole("link", { name: "Nuova commissione", exact: true }).click();
  await page.getByLabel("Nome").fill("Musica");
  await page.getByRole("button", { name: "Crea la commissione" }).click();
  await expect(page.getByRole("heading", { name: "Musica" })).toBeVisible();
  await page.getByLabel("Aggiungi una persona").selectOption({ label: "Mario" });
  await page.getByLabel("Come").selectOption("referente");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(page.getByRole("button", { name: "Togli Mario" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Mario" }).filter({ hasText: "referente" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Indietro", exact: true }).click();
  await expect(page.getByText("Referenti: Mario")).toBeVisible();
});
