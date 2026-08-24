import { expect, test, type Page } from "@playwright/test";

const USERS = {
  A: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "student-a@example.test",
  },
  B: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "student-b@example.test",
  },
} as const;

type UserKey = keyof typeof USERS;

async function getSession(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/session", { cache: "no-store" });
    return response.json();
  });
}

async function expectIdentity(page: Page, userKey: UserKey) {
  const user = USERS[userKey];
  await expect.poll(async () => (await getSession(page)).user).toEqual(user);
  await expect(page.locator(".header-account span")).toHaveText(user.email);
}

async function signIn(page: Page, userKey: UserKey) {
  await page.getByRole("button", { name: `Use synthetic student ${userKey}` }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expectIdentity(page, userKey);
}

async function acknowledgeBeta(page: Page) {
  expect(
    await page.evaluate(async () => (await fetch("/api/beta", { method: "POST" })).status),
  ).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Build the foundation for your Estate Blueprint" })).toBeVisible();
}

async function createMatter(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/matters", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
}

async function listMatterIds(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/matters", { cache: "no-store" });
    const body = await response.json();
    return {
      status: response.status,
      ids: (body.matters ?? []).map((matter: { id: string }) => matter.id),
    };
  });
}

async function getMatterStatus(page: Page, matterId: string) {
  return page.evaluate(async (id) => (await fetch(`/api/matters/${id}`)).status, matterId);
}

test("identity, saved state, and direct-object access remain isolated across account changes", async ({
  page,
}) => {
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

  await signIn(page, "A");
  await acknowledgeBeta(page);
  await expectIdentity(page, "A");
  const createdA = await createMatter(page);
  expect(createdA.status).toBe(201);
  const matterA = createdA.body.id as string;
  expect(await listMatterIds(page)).toEqual({ status: 200, ids: [matterA] });

  await page.reload();
  await expectIdentity(page, "A");
  expect(await listMatterIds(page)).toEqual({ status: 200, ids: [matterA] });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);
  await signIn(page, "B");
  await expectIdentity(page, "B");
  expect(await listMatterIds(page)).toEqual({ status: 200, ids: [] });

  expect(await getMatterStatus(page, matterA)).toBe(404);
  const crossUserMutation = await page.evaluate(async (matterId) => {
    const response = await fetch(`/api/matters/${matterId}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turnKey: crypto.randomUUID(),
        answer: "This must not reach another user's saved matter.",
      }),
    });
    return response.status;
  }, matterA);
  expect(crossUserMutation).toBe(404);

  await acknowledgeBeta(page);
  const createdB = await createMatter(page);
  expect(createdB.status).toBe(201);
  const matterB = createdB.body.id as string;
  expect(matterB).not.toBe(matterA);

  await page.reload();
  await expectIdentity(page, "B");
  expect(await listMatterIds(page)).toEqual({ status: 200, ids: [matterB] });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);
  await signIn(page, "A");
  await expectIdentity(page, "A");
  expect(await listMatterIds(page)).toEqual({ status: 200, ids: [matterA] });
  expect(await getMatterStatus(page, matterB)).toBe(404);
});
