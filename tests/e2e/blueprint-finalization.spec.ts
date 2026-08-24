import { expect, test, type Page } from "@playwright/test";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await fetch("/api/test/reset", {
      method: "POST",
      headers: { origin: window.location.origin },
    });
  });
  await page.evaluate(async (userId) => {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  }, USER_A);
  return page.evaluate(async () => {
    const response = await fetch("/api/test/blueprint-scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: "zero_turn" }),
    });
    const body = await response.json();
    return body.id as string;
  });
}

async function answer(page: Page, value: string) {
  await page.getByLabel("Your response").fill(value);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".save-state")).toContainText("Saved");
}

async function reachFinalReview(page: Page, matterId: string) {
  await page.goto(`/matter/${matterId}`);
  await answer(page, "I accept this recommendation.");
  await answer(
    page,
    "My spouse and Jordan Lee can serve, with an independent trust company as backup. Household, investment, and business responsibilities must continue. The family business and digital assets need separate instructions, and beneficiaries should gain authority after financial education and demonstrated judgment.",
  );
  await answer(page, "I accept this fiduciary structure.");
  await answer(page, "I accept this special-asset treatment.");
  await answer(page, "I accept this readiness progression.");
  await answer(page, "I accept this tax and transfer direction.");
  await answer(page, "I accept this administration and liquidity direction.");
  await expect(
    page.getByRole("heading", { name: "Review your target-state design" }),
  ).toBeVisible();
}

test("Final Review correction, immutable generation, preview, PDF, reload, and ownership complete the approved endpoint", async ({
  page,
}, testInfo) => {
  const matterId = await seed(page);
  await reachFinalReview(page, matterId);

  const beneficiaryBefore = await page
    .getByTestId("final-review-beneficiary-architecture")
    .textContent();
  await page.getByRole("button", { name: "Correct one section" }).click();
  await page
    .getByLabel("Describe the one section and replacement direction")
    .fill("Change the lifetime-security floor to $6 million.");
  await page
    .getByRole("button", { name: "Save correction" })
    .click();
  await expect(page.getByTestId("final-review-planning-baseline")).toContainText(
    "Preserve $6 million.",
  );
  await expect(
    page.getByTestId("final-review-beneficiary-architecture"),
  ).toHaveText(beneficiaryBefore ?? "");

  await page.reload();
  await expect(page.getByTestId("final-review-planning-baseline")).toContainText(
    "Preserve $6 million.",
  );
  await page
    .getByRole("button", { name: "Confirm and generate Estate Blueprint" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Estate Blueprint", exact: true }),
  ).toBeVisible();
  for (const heading of [
    "Your Estate Blueprint - At a Glance",
    "How Your Plan Works",
    "What Still Needs to Be Confirmed",
    "What Happens Next",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(
    page.locator(".blueprint-baseline").getByText("Preserve $6 million."),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "7",
  );
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
    "href",
    `/api/matters/${matterId}/blueprint/pdf`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Estate-Blueprint.pdf");
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("The Estate Blueprint download was not retained.");
  await testInfo.attach("estate-blueprint.pdf", {
    path: downloadPath,
    contentType: "application/pdf",
  });

  const ownedPdf = await page.evaluate(async (id) => {
    const response = await fetch(`/api/matters/${id}/blueprint/pdf`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      prefix: new TextDecoder().decode(bytes.slice(0, 5)),
      disposition: response.headers.get("content-disposition"),
    };
  }, matterId);
  expect(ownedPdf).toEqual({
    status: 200,
    prefix: "%PDF-",
    disposition: 'attachment; filename="Estate-Blueprint.pdf"',
  });

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Estate Blueprint", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".blueprint-baseline").getByText("Preserve $6 million."),
  ).toBeVisible();

  await page.evaluate(async (userId) => {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  }, USER_B);
  expect(
    await page.evaluate(async (id) =>
      (await fetch(`/api/matters/${id}/blueprint/pdf`)).status,
    matterId),
  ).toBe(404);
});
