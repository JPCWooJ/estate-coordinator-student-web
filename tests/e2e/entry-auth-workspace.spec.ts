import { expect, test, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BASE_URL = "http://127.0.0.1:3100";

async function reset(page: Page) {
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

async function signIn(page: Page) {
  expect(
    await page.evaluate(async (userId) =>
      (
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        })
      ).status,
    USER_ID),
  ).toBe(200);
  await page.goto("/home");
}

async function startMatter(page: Page) {
  expect(
    await page.evaluate(async () =>
      (await fetch("/api/beta", { method: "POST" })).status,
    ),
  ).toBe(200);
  const created = await page.evaluate(async () => {
    const response = await fetch("/api/matters", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
  expect(created.status).toBe(201);
  return created.body.id as string;
}

test("sign-in feedback stays beside the email field and explains an unusable link", async ({
  page,
}) => {
  await page.route("**/api/auth/request-link", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText(
    /student beta|controlled beta|private student|synthetic student|synthetic test|local verification|cohort|internal test/i,
  );
  await page.getByLabel("Email address", { exact: true }).fill("principal@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();

  const success = page.getByText("Check your email for a one-time sign-in link.", {
    exact: true,
  });
  await expect(success).toBeVisible();
  const [successBox, emailBox] = await Promise.all([
    success.boundingBox(),
    page.getByLabel("Email address", { exact: true }).boundingBox(),
  ]);
  expect(successBox).not.toBeNull();
  expect(emailBox).not.toBeNull();
  expect(successBox!.y + successBox!.height).toBeLessThanOrEqual(emailBox!.y);

  await page.goto("/?auth=failed");
  await expect(page.locator(".auth-status-error")).toContainText(
    "That sign-in link could not be used. Request a new link below.",
  );
});

test("an authenticated return bypasses sign-in before client JavaScript runs", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    javaScriptEnabled: false,
  });
  await context.addCookies([
    {
      name: "ec-synthetic-session",
      value: USER_ID,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();

  await page.goto("/");

  await expect(page).toHaveURL(`${BASE_URL}/home`);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(0);
  await context.close();
});

test("first-time workspace merges orientation into one scannable estate-plan start", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);

  const orientation = page.locator(".orientation-card");
  await expect(
    orientation.getByRole("heading", {
      level: 1,
      name: "Build your estate plan around what matters most",
    }),
  ).toBeVisible();
  await expect(
    orientation.getByRole("heading", { level: 2, name: "What to expect" }),
  ).toBeVisible();
  await expect(orientation).toContainText("About 10–15 minutes");
  await expect(
    orientation.getByRole("heading", {
      level: 2,
      name: "Helpful information to have nearby",
    }),
  ).toBeVisible();
  await expect(
    orientation.getByRole("heading", { level: 2, name: "What you will receive" }),
  ).toBeVisible();
  await expect(orientation).toContainText(
    "A professional Planning Summary and an Estate Blueprint",
  );
  await expect(orientation).not.toContainText(
    /student beta|controlled beta|private student|cohort|internal test/i,
  );

  await page.getByRole("checkbox", { name: /I understand the process/ }).check();
  await page.getByRole("button", { name: "Start my estate plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Goals, family, and beneficiary intent" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toHaveCount(0);
  await expect(page.locator(".workspace-aside, .conversation-history")).toHaveCount(0);
});

test("returning workspace offers one truthful resume action without internal language", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);
  const matterId = await startMatter(page);
  await page.goto("/home");

  await expect(page.locator(".orientation-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Estate Planning Priorities" })).toBeVisible();
  await expect(page.getByText("Continue from your last saved step.", { exact: false })).toBeVisible();
  const resume = page.getByRole("link", { name: "Resume my estate plan" });
  await expect(resume).toHaveAttribute("href", `/matter/${matterId}`);
  await expect(page.locator("body")).not.toContainText(
    /student beta|controlled beta|private student|cohort|internal test|planning foundation/i,
  );
});

test("workspace failures do not expose the internal matter label", async ({ page }) => {
  await reset(page);
  await signIn(page);

  await page.route("**/api/matters", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole("checkbox", { name: /I understand the process/ }).check();
  await page.getByRole("button", { name: "Start my estate plan" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Your planning workspace could not be started.",
  );

  await page.unroute("**/api/matters");
  await page.goto("/matter/not-a-real-workspace");
  await expect(page.getByRole("status")).toHaveText("Planning workspace not found.");
});
