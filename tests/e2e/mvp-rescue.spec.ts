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
  await page.getByRole("button", { name: "Use synthetic student A" }).click();
}

async function saveSection(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/intake") &&
      response.request().method() === "POST",
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
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/intake") && request.method() === "POST") {
      intakeRequests.push(request.postData() ?? "");
    }
  });

  await resetAndSignIn(page);
  await expect(page.getByRole("heading", { name: "Build the foundation for your Estate Blueprint" })).toBeVisible();
  await expect(page.getByText("10–15 minutes")).toBeVisible();
  await page.getByRole("checkbox", { name: /I understand the process/ }).check();
  await page.getByRole("button", { name: "Start my Estate Blueprint" }).click();

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

  await expect(page.getByRole("heading", { name: "Financial planning range" })).toBeVisible();
  await page.locator("select[name='materialAssetsRange']").selectOption({ label: "$5 million to $10 million" });
  await page.locator("select[name='liabilitiesRange']").selectOption({ label: "$1 million to $3 million" });
  await page.locator("select[name='expectedInheritanceRange']").selectOption({ label: "none" });
  await page.locator("select[name='lifetimeSecurityFloor']").selectOption({ label: "$3 million to $5 million" });
  await saveSection(page);

  expect(intakeRequests).toHaveLength(4);
  await expect(page.getByRole("heading", { name: "Your Planning Summary" })).toBeVisible();
  await expect(page.locator(".workspace-aside, .conversation-history")).toHaveCount(0);
  await expect(page.locator("[data-summary-section='family']")).toContainText("Spouse");
  await expect(page.locator("[data-summary-section='family']")).toContainText("Children");
  await expect(page.locator("[data-summary-section='planning_range']")).toContainText("$5 million to $10 million");
  await expect(page.getByText("$5 million to $10 million", { exact: false })).toHaveCount(1);

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
  const resume = page.getByRole("link", { name: /Resume planning/ });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByRole("heading", { name: "Estate Blueprint", exact: true })).toBeVisible();
  await expect(page.locator(".workspace-aside, .conversation-history")).toHaveCount(0);
});
