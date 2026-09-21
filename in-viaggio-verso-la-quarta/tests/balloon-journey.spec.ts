import { expect, test, type Page } from "@playwright/test";
import { level1Questions, sortItems, CARL_INSIGHT } from "../src/data";

async function settled(page: Page) {
  await expect(page.locator(".journey-screen")).toHaveAttribute("data-phase", "idle");
  await expect(page.locator(".journey-flight")).toHaveCount(0);
  await expect(page.locator(".journey-screen")).not.toHaveAttribute("inert", "");
}

const entryURL = process.env.QUIZ_ENTRY_URL || "/";
const diagnostics = new WeakMap<Page, string[]>();

test.use({ reducedMotion: "no-preference" });

async function start(page: Page) {
  await page.goto(entryURL);
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

test.beforeEach(async ({ page, context }) => {
  const errors: string[] = [];
  diagnostics.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  if (entryURL.startsWith("file:")) {
    // Exercise the actual downloaded HTML, without a server or Internet access.
    await context.setOffline(true);
    page.on("request", (request) => {
      if (request.resourceType() !== "document" && /^(https?:|file:)/.test(request.url())) {
        errors.push(`Non-embedded resource: ${request.url().slice(0, 200)}`);
      }
    });
  }
});

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page), "No JavaScript, security-origin or missing-resource errors").toEqual([]);
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


test("the user can explicitly enable moving balloons even with the system reduced-motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(entryURL);
  const motion = page.getByRole("switch", { name: "Animazioni con palloncini" });
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await expect(motion).toContainText("Attiva i palloncini");
  await motion.click();
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".balloon-journey")).toHaveAttribute("data-motion", "full");
  await page.getByRole("button", { name: "Allacciate i vostri palloncini!" }).press("Enter");
  const carrier = page.locator(".journey-carrier-flight");
  await expect(carrier).toBeVisible();
  await expect(carrier).toHaveCSS("animation-name", "journey-carry");
  await expect(carrier).toHaveCSS("animation-duration", "1.7s");
  const firstPosition = await carrier.evaluate((element) => getComputedStyle(element).transform);
  await expect.poll(() => carrier.evaluate((element) => getComputedStyle(element).transform)).not.toBe(firstPosition);
  await expect(page.locator("h3")).toHaveText(level1Questions[0].question);
  await settled(page);
  await page.locator("button").filter({ hasText: level1Questions[0].options[1].text }).click();
  await expect(page.locator(".journey-flight")).toBeVisible();
  await expect(page.locator("h3")).toHaveText(level1Questions[1].question);
  await settled(page);
});

test("motion follows system changes unless the user overrides it and can be disabled again", async ({ page }) => {
  await page.goto(entryURL);
  const motion = page.getByRole("switch", { name: "Animazioni con palloncini" });
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await motion.click();
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await motion.click();
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Usa impostazioni del dispositivo" }).click();
  await expect(motion).toHaveAttribute("aria-checked", "true");
});

test("the motion switch still works when file-origin storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Storage unavailable for this origin", "SecurityError"); },
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(entryURL);
  const motion = page.getByRole("switch", { name: "Animazioni con palloncini" });
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await motion.click();
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Allacciate i vostri palloncini!" }).press("Enter");
  await expect(page.locator(".journey-flight")).toBeVisible();
  await expect(page.locator("h3")).toHaveText(level1Questions[0].question);
  await settled(page);
});

test("downloaded file uses a classic inline script, embedded fonts and no URL-based SVG filters", async ({ page }) => {
  test.skip(!entryURL.startsWith("file:"), "Standalone file only");
  await page.goto(entryURL);
  await expect(page.locator('meta[name="quiz-version"]')).toHaveAttribute("content", "2-offline");
  expect(await page.locator('script[type="module"], script[src], link[href]').count()).toBe(0);
  expect(await page.locator("script").count()).toBe(1);
  expect(page.frames()).toHaveLength(1);
  const resources = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      fonts: document.fonts.check('600 24px Fredoka') && document.fonts.check('800 24px Nunito'),
      pictures: Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0 && image.src.startsWith("data:")),
      fragments: document.documentElement.outerHTML.includes("url(#"),
    };
  });
  expect(resources).toEqual({ fonts: true, pictures: true, fragments: false });
});
