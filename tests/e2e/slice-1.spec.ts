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

test("controlled access, planning summary workflow, correction, and save/resume", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });
  const syntheticUser = testInfo.project.name === "mobile-chromium" ? "B" : "A";
  const signInButton = `Use synthetic student ${syntheticUser}`;
  const otherSignInButton =
    syntheticUser === "A" ? "Use synthetic student B" : "Use synthetic student A";

  await page.goto("/");
  const resetStatus = await page.evaluate(async () => {
    const response = await fetch("/api/test/reset", {
      method: "POST",
      headers: { origin: window.location.origin },
    });
    return response.status;
  });
  expect(resetStatus).toBe(200);

  const userId =
    syntheticUser === "A"
      ? "11111111-1111-4111-8111-111111111111"
      : "22222222-2222-4222-8222-222222222222";
  const signInResponse = await page.evaluate(async (syntheticUserId) => {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: syntheticUserId }),
    });
    return response.status;
  }, userId);
  expect(signInResponse).toBe(200);
  const sessionPayload = await page.evaluate(async () => {
    const response = await fetch("/api/session");
    return response.json();
  });
  expect(sessionPayload.user).not.toBeNull();
  if (!sessionPayload.betaAcknowledged) {
    const betaResponse = await page.evaluate(async () => {
      const response = await fetch("/api/beta", { method: "POST" });
      return response.status;
    });
    expect(betaResponse).toBe(200);
  }
  await page.goto("/home");
  const createMatterPayload = await page.evaluate(async () => {
    const response = await fetch("/api/matters", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
  expect(createMatterPayload.status).toBe(201);
  const createMatterBody = createMatterPayload.body;
  await page.goto(`/matter/${createMatterBody.id}`);
  const beginInterviewButton = page.getByRole("button", { name: "Begin interview" });
  if (await beginInterviewButton.isVisible()) {
    await beginInterviewButton.click();
  }
  await expect(page.getByLabel("Your response")).toBeVisible();
  await answer(
    page,
    "My top priorities are intended transfer, incapacity readiness, and tax minimization; keep things practical and simple.",
  );
  await answer(page, "My two adult children should inherit and protect the family legacy.");
  await answer(page, "Keep spending and tax complexity low for easy administration.");
  await answer(page, "I need continuity and practical family management if I am incapacitated.");
  await answer(page, "Household bills, property, and investment oversight must continue.");
  await answer(page, "Favor simplicity and flexibility over an aggressive tax result.");
  await answer(page, "My spouse and two adult children should benefit and be protected.");
  await answer(
    page,
    "I have an existing living trust and a will from 2018, but it has not been updated since then.",
  );
  await answer(
    page,
    "Living trust and will were completed in 2018 and are now out of date.",
  );
  await answer(page, "Renovated estate plan documents in 2022.");

  await page.reload();
  await expect(page.getByLabel("Your response")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: signInButton }).click();
  await page.getByRole("link", { name: "Resume conversation" }).click();
  await expect(page.getByLabel("Your response")).toBeVisible();

  await answer(page, "I want to get organized. There is no specific deadline.");
  if (await page.getByText("Who should be involved or available to help with your estate plan now or in the future?").isVisible()) {
    await answer(
      page,
      "Jordan Lee | Harbor Counsel | estate planning | planning counsel | contact@harborcounsel.com | 555-555-1111 | planning update | primary; Spouse should participate now and in future plan reviews.",
    );
  } else {
    await answer(page, "My primary home is Florida; I own a rental property in Georgia.");
    await answer(page, "A family business and digital assets should be considered.");
    await answer(
      page,
      "Jordan Lee | Harbor Counsel | estate planning | planning counsel | contact@harborcounsel.com | 555-555-1111 | planning update | primary; Spouse should participate now and in future plan reviews.",
    );
  }
  await answer(page, "None identified.");

  await expect(page.getByRole("heading", { name: "Planning Summary" })).toBeVisible();
  await expect(page.getByText("Jordan Lee").first()).toBeVisible();
  await expect(page.getByText("Current planning context")).toBeVisible();
  await expect(page.getByText("Known planning changes")).toBeVisible();
  await expect(
    page.getByText("Renovated estate plan documents in 2022.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Open your Estate Blueprint and move into planning recommendations and profile review.")).toHaveCount(0);
  await expect(page.getByText("Timing and material complexity")).toBeVisible();
  await expect(page.getByText("Recommended next step")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download draft summary (PDF)" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "I need to correct something" }).click();
  await page.getByLabel("Describe the correction").fill("My primary home is Florida, not Georgia.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Primary home: Florida")).toBeVisible();
  await page.getByRole("button", { name: "Confirm planning summary" }).click();
  await expect(page.getByRole("heading", { name: "Planning summary confirmed" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download planning summary (PDF)" }),
  ).toBeVisible();
  const appOrigin = new URL(page.url()).origin;
  const cookieHeader = (await page.context().cookies())
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const summaryPdf = await page.request.get(
    `/api/matters/${createMatterBody.id}/summary-pdf`,
    {
      headers: {
        origin: appOrigin,
        cookie: cookieHeader,
      },
    },
  );
  expect(summaryPdf.status()).toBe(200);
  expect(summaryPdf.headers()["content-type"]).toContain("application/pdf");

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: otherSignInButton }).click();
  const crossUserCookieHeader = (await page.context().cookies())
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const crossUserPdf = await page.request.get(
    `/api/matters/${createMatterBody.id}/summary-pdf`,
    {
      headers: {
        origin: appOrigin,
        cookie: crossUserCookieHeader,
      },
    },
  );
  expect(crossUserPdf.status()).not.toBe(200);

  await expect(
    page.getByRole("link", { name: "Continue to Estate Blueprint" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: signInButton }).click();
  await page.goto(`/matter/${createMatterBody.id}`);
  await expect(page.getByRole("heading", { name: "Planning summary confirmed" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveText("");
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
