import { expect, test, type Page } from "@playwright/test";

const USER_A = "11111111-1111-4111-8111-111111111111";

async function reset(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await fetch("/api/test/reset", { method: "POST", headers: { origin: location.origin } });
  });
}

async function signIn(page: Page) {
  await reset(page);
  await page.getByRole("button", { name: "Continue as Profile A" }).click();
}

async function seed(page: Page, scenario: "zero_turn" | "incomplete" | "triggered") {
  await reset(page);
  return page.evaluate(async ({ userId, selectedScenario }) => {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const response = await fetch("/api/test/blueprint-scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: selectedScenario }),
    });
    return (await response.json()).id as string;
  }, { userId: USER_A, selectedScenario: scenario });
}

async function fillGoals(page: Page) {
  await page.getByLabel("1. Priority").selectOption("intended_transfer");
  await page.getByLabel("2. Priority").selectOption("asset_protection");
  await page.getByLabel("3. Priority").selectOption("incapacity_readiness");
  await page.getByLabel("What would a successful plan accomplish?").fill("Protect my spouse and children.");
  await page.getByLabel("Name or group").first().fill("Spouse");
  await page.getByLabel("Relationship").first().fill("spouse");
}

test("authenticated start renders a principal-facing orientation without internal terminology", async ({ page }) => {
  await signIn(page);
  const orientation = page.locator(".orientation-card");
  await expect(orientation.getByRole("heading", { name: "Build your estate plan around what matters most" })).toBeVisible();
  await expect(orientation).toContainText("Estate Coordinator supports planning and organization.");
  await expect(orientation).toContainText("10–15 minutes");
  await expect(orientation).toContainText("What you will receive");
  await expect(orientation).not.toContainText(/controlled beta|cohort|internal test/i);
});

test("mandatory Blueprint stop retains non-complete progress across reload", async ({ page }) => {
  const id = await seed(page, "incomplete");
  await page.goto(`/matter/${id}`);
  await page.getByLabel("Your response").fill("My authority to act is disputed.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "A qualified professional should review this next" })).toBeVisible();
  await expect(page.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow", "7");
  await page.reload();
  await expect(page.getByRole("heading", { name: "A qualified professional should review this next" })).toBeVisible();
});

test("intended entry opens the grouped flow without an intermediate Begin page", async ({ page }) => {
  await signIn(page);
  await page.getByRole("checkbox", { name: /I understand the process/ }).check();
  await page.getByRole("button", { name: "Start my estate plan" }).click();
  await expect(page.getByRole("heading", { name: "Goals, family, and beneficiary intent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toHaveCount(0);
  await expect(page.locator(".workspace-aside, .conversation-history")).toHaveCount(0);
});

test("transport failure preserves structured entries and restores retry controls", async ({ page }) => {
  await signIn(page);
  await page.getByRole("checkbox", { name: /I understand the process/ }).check();
  await page.getByRole("button", { name: "Start my estate plan" }).click();
  await fillGoals(page);
  let intercepted = false;
  await page.route("**/api/matters/*/intake", async (route) => {
    if (!intercepted) {
      intercepted = true;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("This section could not be saved. Your entries remain here.")).toBeVisible();
  await expect(page.getByLabel("What would a successful plan accomplish?")).toHaveValue("Protect my spouse and children.");
  await expect(page.getByRole("button", { name: "Save and continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Current plan and planning context" })).toBeVisible();
});

test("malformed evidence response restores evidence controls", async ({ page }) => {
  const id = await seed(page, "triggered");
  await page.goto(`/matter/${id}`);
  await page.route("**/api/matters/*/blueprint/evidence", async (route) => {
    await route.fulfill({ status: 502, contentType: "text/plain", body: "upstream failure" });
  });
  await page.getByRole("button", { name: "I do not have this now" }).click();
  await expect(page.getByText("The evidence choice could not be saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "I do not have this now" })).toBeEnabled();
});

test("Blueprint clarification appears once as the active question", async ({ page }) => {
  const id = await seed(page, "incomplete");
  await page.goto(`/matter/${id}`);
  await page.getByLabel("Your response").fill("I need a little help with that.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("What part of this outcome is most important for your plan to preserve?", { exact: true })).toHaveCount(1);
  await expect(page.locator(".conversation-history")).toHaveCount(0);
});

test("an expired session returns a matter route cleanly to sign-in", async ({ page }) => {
  const id = await seed(page, "zero_turn");
  await page.context().clearCookies();
  await page.route("**/api/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: null, betaAcknowledged: false }) });
  });
  await page.goto(`/matter/${id}`);
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
});
