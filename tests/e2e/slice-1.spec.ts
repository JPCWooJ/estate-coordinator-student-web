import { expect, test } from "@playwright/test";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

test("grouped intake saves, resumes at the next incomplete section, and remains owner-isolated", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await fetch("/api/test/reset", { method: "POST", headers: { origin: location.origin } });
  });
  const matterId = await page.evaluate(async (userId) => {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await fetch("/api/beta", { method: "POST" });
    const response = await fetch("/api/matters", { method: "POST" });
    return (await response.json()).id as string;
  }, USER_A);

  await page.goto(`/matter/${matterId}`);
  await page.getByLabel("1. Priority").selectOption("intended_transfer");
  await page.getByLabel("2. Priority").selectOption("asset_protection");
  await page.getByLabel("3. Priority").selectOption("incapacity_readiness");
  await page.getByLabel("What would a successful plan accomplish?").fill("Protect my spouse and children.");
  await page.getByLabel("Name or group").first().fill("Spouse");
  await page.getByLabel("Relationship").first().fill("spouse");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Current plan and planning context" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Current plan and planning context" })).toBeVisible();
  const saved = await page.evaluate(async (id) => (await fetch(`/api/matters/${id}`)).json(), matterId);
  expect(saved.matter.record.canonical_intake.goalsFamily.successDefinition).toBe("Protect my spouse and children.");
  expect(saved.matter.messages).toEqual([]);

  await page.evaluate(async (userId) => {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  }, USER_B);
  expect(await page.evaluate(async (id) => (await fetch(`/api/matters/${id}`)).status, matterId)).toBe(404);
});
