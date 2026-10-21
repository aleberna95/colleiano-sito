import { expect, test } from "@playwright/test";
import { creaUtente, svuotaEmulatori } from "./helpers";

test.beforeEach(async () => {
  await svuotaEmulatori();
});

test("primo accesso del superadmin: cambia password e vede 'Crea la prima festa'", async ({ page }) => {
  await creaUtente({ email: "alessio@test.it", password: "temporanea-123", nome: "Alessio", superadmin: true });

  await page.goto("/gestione");
  await expect(page).toHaveURL(/\/gestione\/login$/);

  await page.getByLabel("Email").fill("alessio@test.it");
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page.getByText("Email o password non corrette")).toBeVisible();

  await page.getByLabel("Password").fill("temporanea-123");
  await page.getByRole("button", { name: "Entra" }).click();

  await expect(page).toHaveURL(/\/gestione\/cambia-password$/);
  await page.getByLabel("Password temporanea").fill("temporanea-123");
  await page.getByLabel("Nuova password (almeno 8 caratteri)").fill("la-mia-password");
  await page.getByLabel("Riscrivi la nuova password").fill("la-mia-password");
  await page.getByRole("button", { name: "Salva la password" }).click();

  await expect(page).toHaveURL(/\/gestione$/);
  await expect(page.getByRole("heading", { name: "Crea la prima festa" })).toBeVisible();

  // Esce e rientra con la nuova password: niente più cambio obbligato
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/gestione\/login$/);
  await page.getByLabel("Email").fill("alessio@test.it");
  await page.getByLabel("Password").fill("la-mia-password");
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page.getByRole("heading", { name: "Crea la prima festa" })).toBeVisible();

  await page.getByRole("link", { name: "Account e feste" }).click();
  await expect(page.getByRole("heading", { name: "Account e feste" })).toBeVisible();
  await expect(page.getByText("alessio@test.it")).toBeVisible();
});

test("un utente normale non entra nell'area superadmin", async ({ page }) => {
  await creaUtente({ email: "mario@test.it", password: "password-mario", nome: "Mario", devoCambiarePassword: false });

  await page.goto("/gestione/login");
  await page.getByLabel("Email").fill("mario@test.it");
  await page.getByLabel("Password").fill("password-mario");
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page.getByText("Non fai ancora parte di nessuna festa")).toBeVisible();

  await page.goto("/gestione/admin");
  await expect(page).toHaveURL(/\/gestione$/);
});

test("password dimenticata: conferma l'invio del link", async ({ page }) => {
  await page.goto("/gestione/login");
  await page.getByRole("button", { name: "Password dimenticata?" }).click();
  await page.getByLabel("Email").fill("chiunque@test.it");
  await page.getByRole("button", { name: "Mandami il link" }).click();
  await expect(page.getByText("Se l'email è registrata")).toBeVisible();
});
