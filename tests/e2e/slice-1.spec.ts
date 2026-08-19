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
  return response.json();
}

test("continuous priorities-to-Blueprint handoff saves, clarifies, corrects, and isolates", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const syntheticUser = testInfo.project.name === "mobile-chromium" ? "B" : "A";
  const signInButton = `Use synthetic student ${syntheticUser}`;
  const otherSignInButton =
    syntheticUser === "A" ? "Use synthetic student B" : "Use synthetic student A";
  const userId =
    syntheticUser === "A"
      ? "11111111-1111-4111-8111-111111111111"
      : "22222222-2222-4222-8222-222222222222";

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
  const sessionPayload = await page.evaluate(async () =>
    (await fetch("/api/session")).json(),
  );
  if (!sessionPayload.betaAcknowledged) {
    expect(
      await page.evaluate(async () => (await fetch("/api/beta", { method: "POST" })).status),
    ).toBe(200);
  }

  await page.goto("/home");
  const created = await page.evaluate(async () => {
    const response = await fetch("/api/matters", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
  expect(created.status).toBe(201);
  await page.goto(`/matter/${created.body.id}`);
  await page.getByRole("button", { name: "Begin interview" }).click();

  const clarification = await answer(page, "I need help framing this.");
  expect(clarification.matter.workflowState.step).toBe("MO01_OUTCOMES");
  expect(clarification.matter.workflowState.clarification.question).toContain(
    "three most important results",
  );
  await expect(
    page.getByText(
      "In ordinary language, what are the three most important results you want from your estate plan?",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".error-text")).toHaveText("");

  const accepted = await answer(
    page,
    "My top priorities are intended transfer, incapacity readiness, and tax minimization; keep things practical and simple.",
  );
  expect(accepted.matter.workflowState.step).toBe("MO01_GOAL_FOLLOWUP");
  expect(accepted.matter.workflowState.clarification).toBeNull();

  await page.reload();
  await expect(
    page.getByText(
      "Who or what do you most want to benefit, and what transfer outcome do you most want to prevent?",
      { exact: true },
    ),
  ).toBeVisible();

  await answer(page, "My adult children should inherit through a practical plan.");
  await answer(page, "Household and investment decisions should continue if I am incapacitated.");
  await answer(page, "Avoid unnecessary tax complexity and cost.");
  await answer(page, "My spouse and two adult children should benefit and be protected.");
  await answer(
    page,
    "I have an existing living trust and will from 2018 that need review.",
  );
  await answer(page, "The living trust and will were completed in 2018.");
  await answer(page, "Renovated estate plan documents in 2022.");

  await page.reload();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: signInButton }).click();
  await page.getByRole("link", { name: "Resume conversation" }).click();
  await expect(page.getByLabel("Your response")).toBeVisible();

  await answer(page, "I want to get organized. There is no specific deadline.");
  await answer(page, "My primary home is Florida and I own a rental in Georgia.");
  await answer(page, "A family business and digital assets should be considered.");
  await answer(
    page,
    "Jordan Lee at Harbor Counsel should serve as planning counsel, and my spouse should participate now and in future reviews.",
  );
  await answer(page, "None identified.");

  await expect(page.getByRole("heading", { name: "Planning Summary" })).toBeVisible();
  const priorityItems = page
    .getByLabel("Planning Summary")
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Top three priorities" }) })
    .locator("ol > li");
  await expect(priorityItems).toHaveText([
    "Intended transfer",
    "Incapacity readiness",
    "Tax minimization",
  ]);
  await expect(page.getByText("Jordan Lee").first()).toBeVisible();
  await expect(page.getByText("Known planning changes")).toBeVisible();
  await expect(
    page
      .getByLabel("Planning Summary")
      .getByText("Renovated estate plan documents in 2022.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Timing and material complexity")).toBeVisible();
  await expect(page.getByText("Recommended next step")).toBeVisible();
  await expect(page.getByText(/discovery/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /download.*summary/i })).toHaveCount(0);

  await page.getByRole("button", { name: "I need to correct something" }).click();
  await page
    .getByLabel("Describe the correction")
    .fill("The rental property is in Alabama, not Georgia.");
  const correctionResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/corrections") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save correction" }).click();
  expect((await correctionResponse).ok()).toBe(true);
  await expect(
    page
      .getByLabel("Planning Summary")
      .getByText(/Rental property in Alabama/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Confirm planning summary" }).click();
  await expect(
    page.getByRole("heading", { name: "Planning summary confirmed" }),
  ).toBeVisible();
  await expect(page.getByText(/serves as Stage 1/)).toBeVisible();
  await expect(page.getByRole("link", { name: /download.*summary/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: otherSignInButton }).click();
  expect(await page.request.get(`/api/matters/${created.body.id}`)).not.toBeOK();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: signInButton }).click();
  await page.goto(`/matter/${created.body.id}`);
  await expect(
    page.getByRole("heading", { name: "Planning summary confirmed" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveText("");
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
