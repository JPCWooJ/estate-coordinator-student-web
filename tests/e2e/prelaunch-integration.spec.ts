import { expect, test, type Page } from "@playwright/test";

const USER_A = "11111111-1111-4111-8111-111111111111";

async function resetSyntheticState(page: Page) {
  await page.goto("/");
  expect(
    await page.evaluate(async () =>
      (
        await fetch("/api/test/reset", {
          method: "POST",
          headers: { origin: window.location.origin },
        })
      ).status,
    ),
  ).toBe(200);
}

async function seedBlueprintScenario(
  page: Page,
  scenario: "zero_turn" | "incomplete" | "triggered",
) {
  await resetSyntheticState(page);
  expect(
    await page.evaluate(async (userId) =>
      (
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        })
      ).status,
    USER_A),
  ).toBe(200);
  const result = await page.evaluate(async (selectedScenario) => {
    const response = await fetch("/api/test/blueprint-scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: selectedScenario }),
    });
    return { status: response.status, body: await response.json() };
  }, scenario);
  expect(result.status).toBe(201);
  return result.body.id as string;
}

async function answer(page: Page, value: string) {
  await page.getByLabel("Your response").fill(value);
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/turns") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(await response.text());
  await expect(page.locator(".save-state")).toContainText("Saved");
  return response.json();
}

test("intended entry runs uninterrupted through Matter Opening and the Stage 5 endpoint", async ({
  page,
}) => {
  await resetSyntheticState(page);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build an estate plan that protects the people you love.",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Use synthetic student A" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Acknowledge and continue" })
    .click();
  const start = page.getByRole("button", { name: "Start planning priorities" });
  await expect(start).toBeVisible();
  await start.click();
  await expect(page).toHaveURL(/\/matter\//);
  await page.getByRole("button", { name: "Begin", exact: true }).click();

  const progress: number[] = [];
  const answerAndTrack = async (value: string) => {
    const body = await answer(page, value);
    progress.push(body.matter.progress as number);
    return body;
  };

  await answerAndTrack(
    "My top priorities are intended transfer, incapacity readiness, and tax minimization; keep things practical and simple.",
  );
  await answerAndTrack("My spouse and children should benefit through a protected plan.");
  await answerAndTrack("Household and investment decisions must continue if I am incapacitated.");
  await answerAndTrack("Avoid unnecessary tax complexity and cost.");
  await answerAndTrack("My spouse and two adult children should benefit and be protected.");
  await answerAndTrack("I have a living trust and will that need updating.");
  await answerAndTrack("The living trust and will were completed in 2018.");
  await answerAndTrack("The family business and digital assets are now more important.");
  await answerAndTrack("I want to get organized, and there is no fixed deadline.");
  await answerAndTrack("My primary home is in Florida, with a rental property in Georgia.");
  await answerAndTrack("A family business and digital assets should be considered.");
  await answerAndTrack(
    "Jordan Lee at Harbor Counsel should serve as planning counsel, and my spouse should participate.",
  );
  await answerAndTrack("A clear plan, named backups, and professional confirmation.");

  await expect(
    page.getByRole("heading", { name: "Your Planning Summary" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm planning summary" })
    .click();
  await expect(page.getByText(/To establish the planning range/)).toBeVisible();
  await expect(
    page.getByText("Planning Foundation", { exact: true }).first(),
  ).toBeVisible();

  await answerAndTrack(
    "Our planning ranges, liabilities, lifetime-security floor, retained-control needs, and future obligations are ready.",
  );
  await expect(page.getByText(/Before recommending a beneficiary structure/)).toBeVisible();
  await answerAndTrack(
    "My spouse and two adult children should benefit equally, with descendants as substitutes, continuing protection, readiness-based participation, and coordinated treatment for the family business.",
  );
  await expect(
    page.getByRole("heading", {
      name: "Protect beneficiaries while preserving useful access",
    }),
  ).toBeVisible();
  await answerAndTrack("I accept this recommendation.");
  await expect(page.getByText(/In one answer, tell us what matters about/)).toBeVisible();
  await answerAndTrack(
    "My spouse and Jordan Lee can serve, with an independent trust company as backup. Household, investment, and business responsibilities must continue. The family business and digital assets need separate instructions, and beneficiaries should gain authority after financial education and demonstrated judgment.",
  );
  await answerAndTrack("I accept this starting structure.");
  await answerAndTrack("I accept this separate treatment.");
  const completed = await answerAndTrack("I accept this readiness progression.");

  await expect(
    page.getByRole("heading", { name: "Your Blueprint decisions are saved" }),
  ).toBeVisible();
  expect(completed.matter.blueprintState.completed_gates).toContain(5);
  expect(completed.matter.decisions.map((decision: { decision_id: string }) => decision.decision_id)).toEqual([
    "BR-004-BENEFICIARY",
    "BR-005-FIDUCIARY-CONTINUITY",
    "BR-005-SPECIAL-ASSET",
    "BR-005-READINESS",
  ]);
  expect(
    progress.every(
      (value, index) => index === 0 || value >= progress[index - 1]!,
    ),
  ).toBe(true);
  await expect(page.locator("body")).not.toContainText("Final Review");
  await expect(page.locator("body")).not.toContainText("Stage 6");
});

test("transport failure preserves an answer and restores retry controls", async ({
  page,
}) => {
  const matterId = await seedBlueprintScenario(page, "incomplete");
  await page.goto(`/matter/${matterId}`);
  const endpoint = `**/api/matters/${matterId}/blueprint/turns`;
  await page.route(endpoint, (route) => route.abort("failed"));

  const answerField = page.getByLabel("Your response");
  const value = "Our planning ranges and lifetime-security requirements are ready.";
  await answerField.fill(value);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator(".save-state")).toContainText("Not saved - retry");
  await expect(page.locator(".error-text")).toContainText(
    "Your response could not be saved. Please retry.",
  );
  await expect(answerField).toBeEnabled();
  await expect(answerField).toHaveValue(value);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

  await page.unroute(endpoint);
  await answer(page, value);
  await expect(
    page.getByRole("heading", {
      name: "Protect beneficiaries while preserving useful access",
    }),
  ).toBeVisible();
});

test("malformed evidence response restores evidence controls", async ({ page }) => {
  const matterId = await seedBlueprintScenario(page, "triggered");
  await page.goto(`/matter/${matterId}`);
  const endpoint = `**/api/matters/${matterId}/blueprint/evidence`;
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{malformed",
    }),
  );

  await page.getByRole("button", { name: "I do not have this now" }).click();
  await expect(page.locator(".save-state")).toContainText("Not saved - retry");
  await expect(page.locator(".error-text")).toContainText(
    "The evidence could not be processed. Please retry.",
  );
  await expect(
    page.getByRole("button", { name: "I do not have this now" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Relevant PDF")).toBeEnabled();

  await page.unroute(endpoint);
  await page.getByRole("button", { name: "I do not have this now" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Protect beneficiaries while preserving useful access",
    }),
  ).toBeVisible();
});

test("Blueprint clarification appears once as the active question", async ({
  page,
}) => {
  const matterId = await seedBlueprintScenario(page, "zero_turn");
  await page.goto(`/matter/${matterId}`);
  await answer(page, "Please explain the tradeoff.");

  const clarification =
    "Which outcome or tradeoff would you like the recommendation to handle differently?";
  await expect(page.getByText(clarification, { exact: true })).toHaveCount(1);
  await expect(page.locator(".active-question")).toContainText(clarification);
  await expect(page.getByLabel("Your response")).toBeEnabled();
});

test("an expired session returns a matter route cleanly to sign-in", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: null, betaAcknowledged: false }),
    }),
  );
  await page.route("**/api/matters/expired-session", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized." }),
    }),
  );

  await page.goto("/matter/expired-session");
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build an estate plan that protects the people you love.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Unauthorized.", { exact: true })).toHaveCount(0);
});
