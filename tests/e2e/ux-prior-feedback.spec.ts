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
      name: "Build an estate plan that protects the people you love.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Clarify what matters most, make the key planning decisions, and leave with a clear Estate Blueprint designed around your family, priorities, and future.",
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

test("new priorities workspace orients the user and gives Begin visual priority", async ({
  page,
}, testInfo) => {
  await openNewPrioritiesStart(page, testInfo.project.name);

  const start = page.locator(".start-card");
  await expect(
    start.getByRole("heading", { level: 2, name: "Estate Planning Priorities" }),
  ).toBeVisible();
  await expect(start).toContainText("In approximately 10 minutes");
  await expect(start).toContainText("There are no right or wrong answers.");
  await expect(start).toContainText("Answer in ordinary language");
  await expect(start).toContainText(
    "Your answers become the foundation for your Estate Blueprint",
  );
  await expect(page.getByRole("complementary")).toHaveCount(0);

  const begin = page.getByRole("button", { name: "Begin", exact: true });
  await expect(begin).toBeVisible();
  const [startBox, beginBox] = await Promise.all([
    start.boundingBox(),
    begin.boundingBox(),
  ]);
  expect(startBox).not.toBeNull();
  expect(beginBox).not.toBeNull();
  expect(beginBox!.height).toBeGreaterThanOrEqual(54);
  expect(
    Math.abs(
      beginBox!.x + beginBox!.width / 2 - (startBox!.x + startBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
  await expectViewportFit(page);

  await begin.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".active-question")).toBeVisible();
  await expect(page.locator(".active-question")).toBeFocused();
});
