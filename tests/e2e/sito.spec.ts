import { expect, test, type Page } from "@playwright/test";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { admin, controlla, creaFesta, creaUtente, svuotaEmulatori } from "./helpers";

test.beforeEach(async () => {
  await svuotaEmulatori();
});

/** La copia pubblica la scrive un trigger: si ricarica finché il sito non la mostra. */
async function finche(page: Page, url: string, controllo: () => Promise<void>) {
  await expect(async () => {
    await page.goto(url);
    await controllo();
  }).toPass({ timeout: 30_000 });
}

test("il superadmin cura il sito dal gestionale e il visitatore lo vede", async ({ page }) => {
  test.setTimeout(180_000);
  const sara = await creaUtente({ email: "sara@test.it", password: "password-test", nome: "Sara", superadmin: true, devoCambiarePassword: false });
  const festaId = await creaFesta("prova", [{ uid: sara, nome: "Sara", admin: true }]);
  await admin().db.collection(`feste/${festaId}/programma`).add({
    titolo: "Festa a ballo", inizio: Timestamp.fromDate(new Date("2026-07-18T15:00:00Z")), ordine: 0,
    descrizione: "Piano Folk Trio.",
    createdAt: FieldValue.serverTimestamp(), createdBy: sara, updatedAt: FieldValue.serverTimestamp(), updatedBy: sara,
  });

  // Prima di tutto il sito è vuoto ma non rotto.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Colleiano", level: 1 })).toBeVisible();
  await expect(page.getByText("la prossima edizione sarà annunciata presto")).toBeVisible();
  await page.goto("/edizioni");
  await expect(page.getByText("La prima arriva presto")).toBeVisible();

  await page.goto("/gestione/login");
  await page.getByLabel("Email").fill("sara@test.it");
  await page.getByLabel("Password").fill("password-test");
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page).not.toHaveURL(/login/);

  // Testi del sito
  await page.goto("/gestione/f/prova/altro");
  await page.getByRole("link", { name: "Sito", exact: true }).click();
  await page.getByRole("link", { name: "Testi del sito", exact: true }).click();
  await page.getByRole("textbox", { name: "Cos'è Colleiano e cos'è la festa" }).fill("Un paese piccolo che fa una grande festa.");
  await page.getByRole("textbox", { name: "Indirizzo" }).fill("Colleiano, 63093 AP");
  await page.getByRole("textbox", { name: "Link di Google Maps" }).fill("https://maps.app.goo.gl/etLLkKWMANxE5Vrq5");
  await page.getByRole("button", { name: "Aggiungi una domanda" }).click();
  await page.getByRole("textbox", { name: "Domanda", exact: true }).fill("Posso portare il cane?");
  await page.getByRole("textbox", { name: "Risposta" }).fill("Sì, al guinzaglio.");
  await page.getByRole("button", { name: "Salva i testi" }).click();
  await expect(page.getByText("Testi salvati")).toBeVisible();

  // Pagina della festa
  await page.goto("/gestione/f/prova/sito/pagina");
  await page.getByRole("textbox", { name: "Testo della pagina" }).fill("Una giornata di musica e giochi.");
  await page.getByRole("button", { name: "Salva il testo" }).click();
  await expect(page.getByText("Testo salvato.")).toBeVisible();

  // In evidenza e tra le edizioni
  await page.goto("/gestione/f/prova/sito/feste");
  await page.getByRole("combobox", { name: "Quale festa" }).selectOption({ label: "Festa di prova" });
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Festa in evidenza salvata.")).toBeVisible();
  await page.getByRole("button", { name: "Metti tra le edizioni" }).click();
  await expect(page.getByText("Festa di prova aggiunta alle edizioni passate.")).toBeVisible();

  // Il visitatore (senza login: le pagine pubbliche non usano l'account)
  await finche(page, "/", async () => {
    await expect(page.getByRole("heading", { name: "Festa di prova" })).toBeVisible({ timeout: 2000 });
  });
  await expect(page.getByText("Un paese piccolo che fa una grande festa.")).toBeVisible();
  await expect(page.getByText("Una giornata di musica e giochi.")).toBeVisible();
  await controlla(page, "pubblico-home-piena");

  await page.getByRole("link", { name: "Come arrivare e domande frequenti" }).first().click();
  await expect(page.getByText("Colleiano, 63093 AP")).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri in Google Maps" })).toHaveAttribute("href", "https://maps.app.goo.gl/etLLkKWMANxE5Vrq5");
  await page.getByText("Posso portare il cane?").click();
  await expect(page.getByText("Sì, al guinzaglio.")).toBeVisible();
  await controlla(page, "pubblico-info-piena");

  await page.goto("/edizioni");
  await page.getByRole("link", { name: /Festa di prova/ }).click();
  await expect(page).toHaveURL(/\/edizioni\/prova$/);
  await expect(page.getByRole("heading", { name: "Festa di prova", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Festa a ballo" })).toBeVisible();
  await expect(page.getByText("17:00")).toBeVisible();
  await controlla(page, "pubblico-edizione");

  await page.goto("/edizioni/non-esiste");
  await expect(page.getByRole("heading", { name: "Pagina non trovata" })).toBeVisible();
});

test("l'admin mette i punti sulla mappa e il visitatore li filtra", async ({ page }) => {
  test.setTimeout(180_000);
  const sara = await creaUtente({ email: "sara@test.it", password: "password-test", nome: "Sara", superadmin: true, devoCambiarePassword: false });
  const festaId = await creaFesta("prova", [{ uid: sara, nome: "Sara", admin: true }]);
  const { db } = admin();
  const audit = { createdAt: FieldValue.serverTimestamp(), createdBy: sara, updatedAt: FieldValue.serverTimestamp(), updatedBy: sara };
  // Lo Storage non c'è negli e2e: il disegno è un'immagine già pubblicata dal sito.
  await db.doc(`feste/${festaId}/mappa/config`).set({
    immagine: { url: "/icona-colleiano.png", larghezza: 1000, altezza: 600 }, updatedAt: FieldValue.serverTimestamp(), updatedBy: sara,
  });
  await db.collection(`feste/${festaId}/mappa/config/punti`).add({ nome: "Stand della porchetta", categoria: "mangiare", x: 0.3, y: 0.4, accessibile: false, ...audit });
  await db.doc("sito/config").set({
    festaInEvidenzaId: festaId, chiSiamo: "", comeArrivare: "", indirizzo: "", linkMappe: "", faq: [],
    updatedAt: FieldValue.serverTimestamp(), updatedBy: sara,
  });

  // Editor: un punto nuovo con la sua scheda.
  await page.goto("/gestione/login");
  await page.getByLabel("Email").fill("sara@test.it");
  await page.getByLabel("Password").fill("password-test");
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto("/gestione/f/prova/sito/mappa");
  await expect(page.getByRole("button", { name: "Stand della porchetta (Mangiare)" })).toBeVisible();
  await controlla(page, "sito-mappa");
  await page.getByRole("button", { name: "Aggiungi un punto" }).click();
  await expect(page.getByRole("heading", { name: "Scheda del punto" })).toBeVisible();
  await page.getByRole("textbox", { name: "Nome" }).fill("Bagni della piazza");
  await page.getByRole("combobox", { name: "Cosa c'è" }).selectOption("bagni");
  await page.getByRole("checkbox", { name: "Accessibile in carrozzina" }).check();
  await page.getByRole("button", { name: "Salva il punto" }).click();
  await expect(page.getByText("Punto salvato.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bagni della piazza (Bagni)" })).toBeVisible();

  // Il visitatore: la sua copia pubblica deve esistere (trigger), poi filtra e apre la scheda.
  await finche(page, "/mappa", async () => {
    await expect(page.getByRole("button", { name: "Bagni della piazza (Bagni)" })).toBeVisible({ timeout: 3000 });
  });
  await controlla(page, "pubblico-mappa");
  await page.getByRole("button", { name: "Bagni", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bagni", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Stand della porchetta (Mangiare)" })).toHaveCount(0);
  await page.getByRole("button", { name: "Accessibile", exact: true }).click();
  await page.getByRole("button", { name: /^Bagni della piazza Bagni$/ }).click();
  await expect(page.getByRole("heading", { name: "Bagni della piazza", level: 2 })).toBeVisible();
  await expect(page.getByText("Accessibile in carrozzina")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi" }).click();
  await page.getByRole("button", { name: "Tutto", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stand della porchetta (Mangiare)" })).toBeVisible();
});
