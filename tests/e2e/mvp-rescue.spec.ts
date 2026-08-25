import { expect, test, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";

async function resetAndSignIn(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await fetch("/api/test/reset", {
      method: "POST",
      headers: { origin: window.location.origin },
    });
  });
  await page.getByRole("button", { name: "Continue as Profile A" }).click();
}

async function saveSection(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/intake") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "Save and continue" }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page.locator(".save-state")).toContainText("Saved");
}

test("audited ten-state rescue journey saves once, reuses answers, and generates the Blueprint", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const intakeRequests: string[] = [];
  const financialSaveBodies: string[] = [];
  let simulatedCommittedResponseLoss = false;
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/intake") && request.method() === "POST") {
      intakeRequests.push(request.postData() ?? "");
    }
  });
  await page.route("**/api/matters/*/intake", async (route) => {
    const body = route.request().postDataJSON() as {
      section?: string;
    };
    if (body.section !== "financial_range") {
      await route.continue();
      return;
    }
    financialSaveBodies.push(route.request().postData() ?? "");
    if (!simulatedCommittedResponseLoss) {
      simulatedCommittedResponseLoss = true;
      const committed = await route.fetch();
      expect(committed.ok(), await committed.text()).toBe(true);
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Response lost after commit." }),
      });
      return;
    }
    await route.continue();
  });

  await resetAndSignIn(page);
  await expect(page.getByRole("heading", { name: "Build your estate plan around what matters most" })).toBeVisible();
  await expect(page.getByText("10–15 minutes")).toBeVisible();
  await page.getByRole("checkbox", { name: /I understand the process/ }).check();
  await page.getByRole("button", { name: "Start my estate plan" }).click();

  await expect(page.getByRole("heading", { name: "Goals, family, and beneficiary intent" })).toBeVisible();
  await expect(page.getByText("1 of 7", { exact: true })).toBeVisible();
  await page.getByLabel("1. Priority").selectOption("intended_transfer");
  await page.getByLabel("2. Priority").selectOption("asset_protection");
  await page.getByLabel("3. Priority").selectOption("incapacity_readiness");
  await page.getByLabel("What would a successful plan accomplish?").fill("Protect my spouse and benefit our children fairly.");
  await page.getByLabel("Name or group").first().fill("Spouse");
  await page.getByLabel("Relationship").first().fill("spouse");
  await page.getByLabel("Name or group").nth(1).fill("Children");
  await page.getByLabel("Relationship").nth(1).fill("children");
  await saveSection(page);

  await expect(page.getByRole("heading", { name: "Current plan and planning context" })).toBeVisible();
  await page.getByLabel("Current plan status").selectOption("update_needed");
  await page.getByLabel("Approximate plan date").fill("2018");
  await page.getByLabel("Why are you planning now?").fill("Routine update after relocation");
  await page.getByLabel("Deadline or event").fill("none");
  await page.getByLabel("Primary residence").fill("Florida");
  await page.getByLabel("Material changes").fill("Moved to Florida");
  await page.getByLabel("will", { exact: true }).check();
  await page.getByLabel("revocable trust", { exact: true }).check();
  await page.getByLabel("none", { exact: true }).first().check();
  await page.getByLabel("none identified", { exact: true }).check();
  await saveSection(page);

  await expect(page.getByRole("heading", { name: "Team and continuity" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).first().fill("Jordan Lee");
  await page.getByLabel("Firm or relationship").fill("Harbor Counsel");
  await page.getByLabel("Role", { exact: true }).first().fill("estate attorney");
  await page.getByLabel("Email", { exact: true }).first().fill("jordan@example.com");
  await page.getByLabel("Phone", { exact: true }).first().fill("555-0100");
  await page.getByLabel("Responsibilities", { exact: true }).first().fill("document review and implementation");
  await page.getByLabel("none", { exact: true }).first().check();
  await page.getByLabel("none", { exact: true }).last().check();
  await saveSection(page);

  await expect(page.getByRole("heading", { name: "Estate Balance Sheet" })).toBeVisible();
  await expect(page.locator(".matter-topbar")).toContainText("Financial foundation");
  await expect(page.locator(".progress-copy")).toContainText("Financial foundation");
  await expect(page.getByLabel("Material assets")).toHaveValue("not_decided");
  await expect(page.getByLabel(/^Liabilities/)).toHaveValue("not_decided");
  await page.getByRole("button", { name: "Add asset" }).click();
  const brokerage = page.getByRole("group", { name: "Asset 1" });
  await brokerage.getByLabel("Asset category").selectOption("brokerage_accounts");
  await brokerage.getByLabel("Approximate value").fill("8000000");
  await brokerage.getByLabel("Description or name").fill("Taxable portfolio");
  await brokerage.getByLabel("Ownership / control").selectOption("direct_control");

  await page.getByRole("button", { name: "Add asset" }).click();
  const residence = page.getByRole("group", { name: "Asset 2" });
  await residence.getByLabel("Asset category").selectOption("primary_residence");
  await residence.getByLabel("Approximate value").fill("2000000");
  await residence.getByLabel("Description or name").fill("Miami home");
  await residence.getByLabel("Ownership / control").selectOption("shared_control");

  await page.getByRole("button", { name: "Add liability" }).click();
  const mortgage = page.getByRole("group", { name: "Liability 1" });
  await mortgage.getByLabel("Liability category").selectOption("mortgages");
  await mortgage.getByLabel("Approximate value").fill("500000");
  await mortgage.getByLabel("Description or name").fill("Home mortgage");
  await expect(page.getByTestId("total-assets")).toHaveText("$10,000,000");
  await expect(page.getByTestId("total-liabilities")).toHaveText("$500,000");
  await expect(page.getByTestId("net-estate")).toHaveText("$9,500,000");

  await expect(page.getByRole("heading", { name: "Lifestyle P&L / Security Analysis" })).toBeVisible();
  await page.getByLabel("Recurring monthly expenses").fill("20000");
  await page.getByRole("button", { name: "Add income source" }).click();
  const portfolioIncome = page.getByRole("group", { name: "Income source 1" });
  await portfolioIncome.getByLabel("Income source").fill("Portfolio distributions");
  await portfolioIncome.getByLabel("Monthly amount").fill("10000");
  await portfolioIncome.getByLabel("Income-producing asset (optional)").selectOption({ label: "Taxable portfolio" });
  await page.getByRole("button", { name: "Add income source" }).click();
  const pension = page.getByRole("group", { name: "Income source 2" });
  await pension.getByLabel("Income source").fill("Pension");
  await pension.getByLabel("Monthly amount").fill("5000");
  await expect(page.getByLabel("Federal effective income-tax rate")).toHaveValue("25");
  await expect(page.getByLabel("Safety buffer")).toHaveValue("30");
  await expect(page.getByTestId("recommended-estate-floor")).toHaveText("$10,600,000");
  await page.getByLabel("Federal effective income-tax rate").fill("20");
  await expect(page.getByTestId("recommended-estate-floor")).toHaveText("$10,437,500");
  await page.getByLabel("Federal effective income-tax rate").fill("25");
  await page.getByLabel("Safety buffer").fill("20");
  await expect(page.getByTestId("recommended-estate-floor")).toHaveText("$10,400,000");
  await expect(page.getByRole("heading", { name: "Planning boundaries" })).toBeVisible();
  await expect(page.getByLabel("Material assets")).toHaveValue("provided");
  await expect(page.getByLabel(/^Liabilities/)).toHaveValue("provided");
  await page.getByLabel("Expected inheritance").selectOption("none");
  await expect(page.getByLabel("Lifetime-security floor")).toHaveValue("calculated");
  await expect(page.getByLabel("Assets counted toward the security floor")).toHaveValue("linked_income_producing_assets");
  await page.getByLabel("Retained-control requirement").selectOption("provided");
  await page.getByLabel("What should remain under your control?").fill("Retain the Miami home and taxable portfolio.");
  await page.getByLabel("Extraordinary future obligations").selectOption("none");
  await saveSection(page);

  expect(financialSaveBodies).toHaveLength(2);
  expect(financialSaveBodies[0]).toBe(financialSaveBodies[1]);
  expect(intakeRequests).toHaveLength(5);
  expect(
    new Set(
      intakeRequests.map((request) =>
        String((JSON.parse(request) as { operationId: string }).operationId),
      ),
    ).size,
  ).toBe(4);
  await expect(page.getByRole("heading", { name: "Your Planning Summary" })).toBeVisible();
  await expect(page.locator(".workspace-aside, .conversation-history")).toHaveCount(0);
  await expect(page.locator("[data-summary-section='family']")).toContainText("Spouse");
  await expect(page.locator("[data-summary-section='family']")).toContainText("Children");
  await expect(page.locator("[data-summary-section='planning_range']")).toContainText("Taxable portfolio");
  await expect(page.locator("[data-summary-section='planning_range']")).toContainText("$10,400,000");
  await expect(page.getByText("$10,400,000", { exact: false })).toHaveCount(1);

  await page.getByRole("button", { name: "Confirm Planning Summary" }).click();
  await expect(page.getByRole("heading", { name: "Choose the direction for your Estate Blueprint" })).toBeVisible();
  await expect(page.getByText(/To establish the planning range/)).toHaveCount(0);
  await expect(page.getByText(/approximate range of liabilities/)).toHaveCount(0);
  await page.getByRole("button", { name: "Save decisions and continue" }).click();

  await expect(page.getByRole("heading", { name: "Review your target-state design" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm and generate Estate Blueprint" }).click();
  await expect(page.getByRole("heading", { name: "Estate Blueprint", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Download PDF/i })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("canonical intake remains populated after reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async (userId) => {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  }, USER_ID);
  await page.goto("/home");
  const resume = page.getByRole("link", { name: "Resume my estate plan" });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByRole("heading", { name: "Estate Blueprint", exact: true })).toBeVisible();
  await expect(page.locator(".workspace-aside, .conversation-history")).toHaveCount(0);
});
