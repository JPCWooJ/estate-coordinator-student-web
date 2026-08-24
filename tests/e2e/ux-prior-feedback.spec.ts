import { expect, test, type Page } from "@playwright/test";

async function expectViewportFit(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

async function openNewPrioritiesStart(page: Page, projectName: string) {
  await page.goto("/");
  expect(
    await page.evaluate(async () => {
      const response = await fetch("/api/test/reset", {
        method: "POST",
        headers: { origin: window.location.origin },
      });
      return response.status;
    }),
  ).toBe(200);

  const userId =
    projectName === "mobile-chromium"
      ? "22222222-2222-4222-8222-222222222222"
      : "11111111-1111-4111-8111-111111111111";
  expect(
    await page.evaluate(async (id) => {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      return response.status;
    }, userId),
  ).toBe(200);

  const session = await page.evaluate(async () =>
    (await fetch("/api/session")).json(),
  );
  if (!session.betaAcknowledged) {
    expect(
      await page.evaluate(async () =>
        (await fetch("/api/beta", { method: "POST" })).status,
      ),
    ).toBe(200);
  }

  const created = await page.evaluate(async () => {
    const response = await fetch("/api/matters", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
  expect(created.status).toBe(201);
  await page.goto(`/matter/${created.body.id}`);
}

test("landing presents the approved outcome, three steps, and professional boundary", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tell us what matters most to you and your family.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We will help you achieve your goals. Your Estate Blueprint is designed around your family, priorities, and future.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Estate Coordinator provides planning guidance, not legal or tax advice.",
      { exact: true },
    ),
  ).toBeVisible();

  const overview = page.getByRole("complementary", {
    name: "Your Estate Plan in 3 Simple Steps",
  });
  await expect(overview).toBeVisible();
  await expect(
    overview.getByRole("heading", {
      level: 3,
      name: "Tell us what matters.",
    }),
  ).toBeVisible();
  await expect(overview).toContainText(
    "Focused questions about goals, family, and current planning.",
  );
  await expect(
    overview.getByRole("heading", {
      level: 3,
      name: "Make your key decisions.",
    }),
  ).toBeVisible();
  await expect(overview).toContainText(
    "Clear recommendations and decisions shaped around what matters.",
  );
  await expect(
    overview.getByRole("heading", {
      level: 3,
      name: "Get your Estate Blueprint.",
    }),
  ).toBeVisible();
  await expect(overview).toContainText(
    "A clear planning blueprint to use with your attorney and advisors.",
  );
  await expect(page.getByText("Invited email address", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Private student experience", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Controlled student beta", { exact: true })).toHaveCount(0);

  const [panelBox, overviewBox, signInBox] = await Promise.all([
    page.locator(".auth-panel").boundingBox(),
    overview.boundingBox(),
    page.getByRole("button", { name: "Email me a sign-in link" }).boundingBox(),
  ]);
  expect(panelBox).not.toBeNull();
  expect(overviewBox).not.toBeNull();
  expect(signInBox).not.toBeNull();
  expect(signInBox!.height).toBeGreaterThanOrEqual(46);
  if (testInfo.project.name === "mobile-chromium") {
    expect(overviewBox!.y).toBeGreaterThanOrEqual(panelBox!.y + panelBox!.height - 1);
  } else {
    expect(overviewBox!.x).toBeGreaterThanOrEqual(panelBox!.x + panelBox!.width - 1);
  }
  await expectViewportFit(page);
});

test("new priorities workspace opens directly into grouped intake with persistent progress", async ({
  page,
}, testInfo) => {
  await openNewPrioritiesStart(page, testInfo.project.name);

  const start = page.locator(".structured-intake");
  await expect(
    start.getByRole("heading", { level: 2, name: "Goals, family, and beneficiary intent" }),
  ).toBeVisible();
  await expect(start).toContainText("Rank the outcomes that matter most");
  await expect(page.getByText("1 of 7", { exact: true })).toBeVisible();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.locator(".workspace-aside, .conversation-history")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save and continue" })).toBeVisible();
  await expectViewportFit(page);
});
