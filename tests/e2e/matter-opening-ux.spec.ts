import { expect, test, type Page } from "@playwright/test";

async function openMatterOpening(page: Page) {
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
  await page.getByRole("button", { name: "Use synthetic student A" }).click();
  await page.getByRole("checkbox", { name: /I understand the process/ }).check();
  await page.getByRole("button", { name: "Start my Estate Blueprint" }).click();
}

async function saveGoals(page: Page) {
  await page.getByLabel("1. Priority").selectOption("intended_transfer");
  await page.getByLabel("2. Priority").selectOption("asset_protection");
  await page.getByLabel("3. Priority").selectOption("incapacity_readiness");
  await page
    .getByLabel("What would a successful plan accomplish?")
    .fill("Protect my spouse and provide for our children.");
  await page.getByLabel("Name or group").first().fill("Spouse");
  await page.getByLabel("Relationship").first().fill("spouse");
  await page.getByRole("button", { name: "Save and continue" }).click();
  const heading = page.getByRole("heading", {
    name: "Current plan and planning context",
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
}

async function savePlanningContext(page: Page) {
  await page.getByLabel("Current plan status").selectOption("update_needed");
  await page.getByLabel("Approximate plan date").fill("2018");
  await page.getByLabel("Why are you planning now?").fill("Routine update");
  await page.getByLabel("Deadline or event").fill("none");
  await page.getByLabel("Primary residence").fill("Florida");
  await page.getByLabel("Material changes").fill("Moved to Florida");
  await page.getByLabel("will", { exact: true }).check();
  await page.getByLabel("none", { exact: true }).first().check();
  await page.getByLabel("none identified", { exact: true }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Provide contact details for the key people involved in your estate planning.",
    }),
  ).toBeInViewport();
}

test("keeps the active intake oriented, dominant, and free of transcript chrome", async ({
  page,
}) => {
  await openMatterOpening(page);

  const activeIntake = page.locator(".structured-intake");
  await expect(activeIntake.getByText("Next Question", { exact: true })).toBeVisible();
  await expect(activeIntake.locator(".intake-orientation")).toContainText(
    "About 10–15 minutes",
  );
  await expect(activeIntake.locator(".intake-orientation")).toContainText(
    "Planning Summary and Estate Blueprint",
  );
  await expect(
    activeIntake.getByRole("heading", {
      level: 2,
      name: "Goals, family, and beneficiary intent",
    }),
  ).toBeVisible();
  await expect(page.locator(".workspace-aside, .conversation-history, .message")).toHaveCount(0);
  await expect(page.getByRole("complementary")).toHaveCount(0);

  const progress = page.locator(".rescue-progress");
  await expect(progress).toBeVisible();
  expect(await progress.evaluate((element) => getComputedStyle(element).position)).toBe(
    "sticky",
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(progress).toBeInViewport();
});

test("reconciles an ambiguous first save without creating a second operation", async ({
  page,
}) => {
  await openMatterOpening(page);
  await page.getByLabel("1. Priority").selectOption("intended_transfer");
  await page.getByLabel("2. Priority").selectOption("asset_protection");
  await page.getByLabel("3. Priority").selectOption("incapacity_readiness");
  await page
    .getByLabel("What would a successful plan accomplish?")
    .fill("Protect my spouse and provide for our children.");
  await page.getByLabel("Name or group").first().fill("Spouse");
  await page.getByLabel("Relationship").first().fill("spouse");

  const operationIds: string[] = [];
  let firstAttempt = true;
  await page.route(/\/api\/matters\/[^/]+\/intake$/, async (route) => {
    operationIds.push(route.request().postDataJSON().operationId);
    if (firstAttempt) {
      firstAttempt = false;
      const committed = await route.fetch();
      expect(committed.ok(), await committed.text()).toBe(true);
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "The save receipt could not be returned." }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.locator(".save-state")).toContainText(
    "Not saved — entries retained",
  );
  await expect(page.getByLabel("What would a successful plan accomplish?")).toHaveValue(
    "Protect my spouse and provide for our children.",
  );
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Current plan and planning context" }),
  ).toBeVisible();
  expect(operationIds).toHaveLength(2);
  expect(operationIds[1]).toBe(operationIds[0]);
});

test("groups current-plan facts and suppresses the redundant Page 9 through 16 questions", async ({
  page,
}) => {
  await openMatterOpening(page);
  await saveGoals(page);

  await expect(page.getByText("Next Question", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Current plan status")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Known documents or arrangements" }),
  ).toBeVisible();
  await expect(page.getByLabel("Material changes")).toBeVisible();
  await expect(page.getByLabel("Why are you planning now?")).toBeVisible();
  await expect(page.getByLabel("Primary residence")).toBeVisible();
  await expect(page.getByRole("group", { name: "Material complexity" })).toBeVisible();
  await expect(
    page.getByText(
      "At a high level, who do you expect should benefit from or be protected by your estate plan?",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Are there any trusts, businesses, foreign connections, digital assets, major charitable plans, or other complexities you already know should be considered?",
      { exact: true },
    ),
  ).toHaveCount(0);

  await savePlanningContext(page);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Provide contact details for the key people involved in your estate planning.",
    }),
  ).toBeVisible();
});

test("saves repeatable contact details on the first attempt and skips the deleted confidence question", async ({
  page,
}) => {
  await openMatterOpening(page);
  await saveGoals(page);
  await savePlanningContext(page);

  const firstContact = page.getByRole("group", { name: "Person 1" });
  await firstContact.getByLabel("Name").fill("Jordan Lee");
  await firstContact.getByLabel("Address").fill("100 Main Street, Miami, FL");
  await firstContact.getByLabel("Email").fill("jordan@example.com");
  await firstContact.getByLabel("Phone").fill("555-0100");
  await firstContact.getByLabel("Role in the process").fill("Estate attorney");

  await page.getByRole("button", { name: "Add another person" }).click();
  const secondContact = page.getByRole("group", { name: "Person 2" });
  await secondContact.getByLabel("Name").fill("Casey Lee");
  await secondContact.getByLabel("Address").fill("200 Bay Avenue, Miami, FL");
  await secondContact.getByLabel("Email").fill("casey@example.com");
  await secondContact.getByLabel("Phone").fill("555-0101");
  await secondContact.getByLabel("Role in the process").fill("Trusted family member");

  await page.getByLabel("none", { exact: true }).first().check();
  await page.getByLabel("none", { exact: true }).last().check();
  await page.route(/\/api\/matters\/[^/]+\/intake$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  const responsePromise = page.waitForResponse(
    (response) =>
      /\/api\/matters\/[^/]+\/intake$/.test(response.url()) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.locator(".save-state")).toContainText("Syncing…");
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  const submission = response.request().postDataJSON();
  expect(submission.values.contacts).toMatchObject([
    {
      name: "Jordan Lee",
      address: "100 Main Street, Miami, FL",
      role: "Estate attorney",
    },
    {
      name: "Casey Lee",
      address: "200 Bay Avenue, Miami, FL",
      role: "Trusted family member",
    },
  ]);
  await expect(page.locator(".save-state")).toContainText("Saved");
  await expect(page.getByRole("heading", { name: "Estate Balance Sheet" })).toBeVisible();
  await expect(
    page.getByText(
      "What would you need to see, understand, or have confirmed to feel confident that your estate plan is complete, current, and working the way you intend?",
      { exact: true },
    ),
  ).toHaveCount(0);
});
