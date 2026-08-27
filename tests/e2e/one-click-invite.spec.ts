import { expect, test } from "@playwright/test";

const INVITED_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "student-a@example.test",
};

test("one invitation link establishes a durable session and opens first-use orientation", async ({
  page,
}) => {
  await page.goto("http://localhost:3100/");
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
  await page.goto(
    "http://localhost:3100/auth/confirm?token_hash=synthetic-invite-profile-a&type=invite",
  );

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build your estate plan around what matters most",
    }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const response = await fetch("/api/session", { cache: "no-store" });
        return (await response.json()).user;
      }),
    )
    .toEqual(INVITED_USER);

  await page.reload();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator(".header-account span")).toHaveText(INVITED_USER.email);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(0);
});

test("an invalid or expired invitation fails safely with a clear recovery path", async ({
  page,
}) => {
  await page.goto(
    "http://localhost:3100/auth/confirm?token_hash=expired-invite&type=invite",
  );

  await expect(page).toHaveURL("http://localhost:3100/?auth=invite_failed");
  await expect(page.locator(".auth-status-error")).toHaveText(
    "That invitation link is invalid or has expired. Ask your administrator for a new invitation. If you already accepted an invitation, sign in below.",
  );
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email me a sign-in link", exact: true }),
  ).toBeVisible();
});

test("an uninvited browser cannot open the authenticated workspace", async ({ page }) => {
  await page.goto("http://localhost:3100/home");

  await expect(page).toHaveURL("http://localhost:3100/");
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build your estate plan around what matters most",
    }),
  ).toHaveCount(0);
});
