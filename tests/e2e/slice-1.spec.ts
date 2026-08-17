import { expect, test } from "@playwright/test";

async function answer(page: import("@playwright/test").Page, value: string) {
  const composer = page.getByLabel("Your response");
  await composer.fill(value);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/turns") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(`Turn was rejected: ${await response.text()}`);
  }
  await expect(page.locator(".save-state")).toContainText("Saved");
}

test("controlled access, canonical Matter Opening, correction, and save/resume", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const syntheticUser = testInfo.project.name === "mobile-chromium" ? "B" : "A";
  const signInButton = `Use synthetic student ${syntheticUser}`;

  await page.goto("/");
  const resetResponse = await page.evaluate(async () => {
    const response = await fetch("/api/test/reset", { method: "POST" });
    return { ok: response.ok, body: await response.text() };
  });
  expect(resetResponse.ok, resetResponse.body).toBe(true);
  await page.getByRole("button", { name: signInButton }).click();
  await expect(page.getByRole("heading", { name: "Controlled educational beta" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Acknowledge and continue" }).click();
  await page.getByRole("button", { name: "Start Matter Opening" }).click();

  await expect(page.getByText("If this estate-planning process works exactly as you hope")).toBeVisible();
  await answer(
    page,
    "I want my children to inherit as intended, my family to manage affairs if I am incapacitated, and taxes and expenses kept down.",
  );
  await answer(
    page,
    "1. Intended transfer; 2. Incapacity readiness; 3. Tax minimization",
  );
  await answer(page, "My two adult children equally; prevent an unintended transfer.");
  await answer(page, "Household bills, property, and investment oversight must continue.");
  await answer(page, "Favor simplicity and flexibility over an aggressive tax result.");
  await answer(page, "My spouse and two adult children should benefit and be protected.");
  await answer(page, "No existing plan.");

  await page.reload();
  await expect(page.getByText("Why are you addressing this now")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: signInButton }).click();
  await page.getByRole("link", { name: "Resume matter" }).click();
  await expect(page.getByText("Why are you addressing this now")).toBeVisible();

  await answer(page, "I want to get organized. There is no specific deadline.");
  await answer(page, "My primary home is Florida; I own a rental property in Georgia.");
  await answer(page, "A family business and digital assets should be considered.");
  await answer(page, "A contact is needed.");
  await answer(page, "My spouse should participate now; my adult children can join later.");
  await answer(page, "No additional concern.");

  await expect(page.getByRole("heading", { name: "Matter Opening record" })).toBeVisible();
  await page.getByRole("button", { name: "I need to correct something" }).click();
  await page.getByLabel("Describe the correction").fill("My primary home is Florida, not Georgia.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Primary home: Florida")).toBeVisible();
  await page.getByRole("button", { name: "Confirm Matter Opening" }).click();
  await expect(page.getByRole("heading", { name: "Matter Opening confirmed" })).toBeVisible();

  await page.getByRole("link", { name: "Return to matter home" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: signInButton }).click();
  await page.getByRole("link", { name: "View confirmed record" }).click();
  await expect(page.getByRole("heading", { name: "Matter Opening confirmed" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveText("");
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
