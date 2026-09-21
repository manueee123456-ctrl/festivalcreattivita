import { expect, test, type Page } from "@playwright/test";
import { level1Questions, sortItems, CARL_INSIGHT } from "../src/data";

async function settled(page: Page) {
  await expect(page.locator(".journey-screen")).toHaveAttribute("data-phase", "idle");
  await expect(page.locator(".journey-flight")).toHaveCount(0);
  await expect(page.locator(".journey-screen")).not.toHaveAttribute("inert", "");
}

async function start(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Il tuo nome").fill("Giulia");
  // The original start button pulses continuously; keyboard activation is stable.
  await page.getByRole("button", { name: "Allacciate i vostri palloncini!" }).press("Enter");
  await expect(page.locator("h3")).toHaveText(level1Questions[0].question);
  await settled(page);
}

async function finishQuiz(page: Page) {
  for (const [index, question] of level1Questions.entries()) {
    await expect(page.locator("h3")).toHaveText(question.question);
    const answer = question.options.find((option) => option.correct)!;
    await page.locator("button").filter({ hasText: answer.text }).click();
    if (index < level1Questions.length - 1) {
      await expect(page.locator("h3")).toHaveText(level1Questions[index + 1].question);
    } else {
      await expect(page.locator("h2")).toHaveText("La casa si alza in volo");
    }
    await settled(page);
  }
}

test.beforeEach(async ({ page }) => {
  // External fonts are cosmetic: don't let an unavailable font CDN slow tests.
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
});

test("wrong answers stay put; a correct answer flies forward only once", async ({ page }) => {
  await start(page);
  const wrong = page.locator("button").filter({ hasText: "Un giovane inventore sognatore." });
  await wrong.click();
  await expect(wrong).toBeDisabled();
  await expect(page.locator(".journey-flight")).toHaveCount(0);
  await expect(page.locator("h3")).toHaveText(level1Questions[0].question);
  await expect(page.getByLabel("0 palloncini su 5")).toBeVisible();
  await expect(wrong).toBeEnabled();

  const correct = page.locator("button").filter({ hasText: level1Questions[0].options[1].text });
  await correct.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(correct).toBeDisabled();
  await expect(page.locator(".journey-flight")).toBeVisible();
  await expect(page.locator(".journey-screen")).toHaveAttribute("inert", "");
  await expect(page.locator(".journey-ticket-title")).toHaveText("Domanda 2 di 5");
  await expect(page.locator("h3")).toHaveText(level1Questions[1].question);
  await settled(page);
  await expect(page.getByLabel("1 palloncini su 5")).toBeVisible();
  await expect(page.locator("h3")).toBeFocused();
  await expect(page.locator("button").first()).toBeEnabled();
});

test("the whole original adventure still works, including saved answers and restart", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await finishQuiz(page);
  await page.getByRole("button", { name: "Voliamo!" }).click();
  await expect(page.locator("h2")).toHaveText("La Prova dei Pesi");
  await settled(page);

  for (const item of sortItems) {
    await page.locator("button").filter({ hasText: item.text }).click();
    const title = item.zone === "sack" ? "Sacco — cose da lasciare" : "Palloncini — cose da tenere";
    await page.locator('[role="button"]').filter({ hasText: title }).click({ position: { x: 22, y: 22 } });
  }
  await expect(page.locator("h2")).toHaveText("Dove voliamo?");
  await settled(page);
  await page.locator("textarea").fill("Le Cascate Paradiso sono un posto meraviglioso.");
  await page.getByRole("button", { name: "Ho scritto, avanti!" }).click();
  await expect(page.locator("h2")).toHaveText("Che cosa capisce Carl?");
  await settled(page);
  await expect(page.locator("textarea")).toHaveValue("");
  await page.locator("textarea").fill("Carl capisce che l’avventura è stare insieme.");
  await page.getByRole("button", { name: "Ho scritto, avanti!" }).click();
  await expect(page.getByText(CARL_INSIGHT, { exact: true })).toBeVisible();
  await expect(page.locator(".journey-flight")).toHaveCount(0);
  await page.getByRole("button", { name: "Ho capito, andiamo!" }).click();
  await expect(page.locator("h2")).toHaveText("Le Cime dell’Avventura");
  await settled(page);
  await page.getByRole("button", { name: "Siamo pronti!" }).click();
  await expect(page.locator("h2")).toHaveText("La scena più bella");
  await settled(page);
  await page.locator("textarea").fill("Mi è piaciuto quando la casa si alza in volo.");
  await page.getByRole("button", { name: "Ho scritto, avanti!" }).click();
  await expect(page.locator("h2")).toHaveText("La scena più emozionante");
  await settled(page);
  await expect(page.locator("textarea")).toHaveValue("");
  await page.locator("textarea").fill("Mi ha emozionato l’amicizia con Russell.");
  await page.getByRole("button", { name: "Ho scritto, avanti!" }).click();
  await expect(page.locator("h2")).toHaveText("Il mio voto al film");
  await settled(page);
  await page.getByRole("radio", { name: "4 stelline" }).click();
  await page.getByRole("button", { name: "Confermo il mio voto" }).click();
  await expect(page.locator("h2")).toHaveText("La Promessa e il Distintivo");
  await settled(page);
  await page.locator("textarea").fill("Prometto di aiutare i miei compagni.");
  await page.getByRole("button", { name: "Consegnami il distintivo!" }).click();
  await expect(page.locator("h2")).toHaveText("Congratulazioni, Giulia!");
  await settled(page);
  await expect(page.getByText("Il tuo voto: ★★★★☆", { exact: true })).toBeVisible();
  await expect(page.getByText("La tua promessa: «Prometto di aiutare i miei compagni.»")).toBeVisible();
  await page.getByRole("button", { name: "Ricomincia l’avventura" }).click();
  await expect(page.locator("h1")).toHaveText("In Viaggio verso la Quarta");
  await settled(page);
  await expect(page.getByPlaceholder("Il tuo nome")).toHaveValue("");
  await page.getByRole("button", { name: "Allacciate i vostri palloncini!" }).press("Enter");
  await expect(page.locator("h3")).toHaveText(level1Questions[0].question);
  await settled(page);
  await expect(page.getByLabel("0 palloncini su 5")).toBeVisible();
  expect(errors).toEqual([]);
});

test("reduced motion skips the flight and its long wait", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await expect(page.locator(".balloon-journey")).toHaveClass(/journey-reduced/);
  await page.locator("button").filter({ hasText: level1Questions[0].options[1].text }).click();
  await expect(page.locator("h3")).toHaveText(level1Questions[1].question, { timeout: 1800 });
  await settled(page);
  await expect(page.locator(".journey-screen")).toHaveCSS("transform", "none");
  await expect(page.locator("h3")).toBeFocused();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`flight stays within the viewport and resets scrolling at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await start(page);
    await page.locator("button").filter({ hasText: level1Questions[0].options[1].text }).click();
    await expect(page.locator(".journey-flight")).toBeVisible();
    const bounds = await page.locator(".journey-flight").boundingBox();
    expect(bounds?.x).toBe(0);
    expect(bounds?.y).toBe(0);
    expect(bounds?.width).toBe(viewport.width);
    expect(bounds?.height).toBe(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator("h3")).toHaveText(level1Questions[1].question);
    await settled(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
