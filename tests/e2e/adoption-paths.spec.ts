import { expect, test } from "@playwright/test";

test.describe("Fify adoption paths", () => {
  test("browser chat presents the two supported entry paths", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Fify browser chat" }),
    ).toBeAttached();
    await expect(page.getByText("Browser chat", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Codex integration", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Catalog-constrained interface"),
    ).toBeAttached();
    await expect(page.getByText(/Trusted catalog/)).toHaveCount(0);
  });

  test("browser chat manages its API key in Settings", async ({ page }) => {
    await page.route("**/api/ui", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { configured: false } });
      } else {
        await route.continue();
      }
    });
    await page.goto("/");

    await expect(page.getByLabel("OpenAI API key")).toBeHidden();
    await expect(
      page.getByPlaceholder("Add an API key in Settings to start…"),
    ).toBeVisible();

    await page
      .locator(".gxchat-settings:visible, .gxchat-mobile-settings:visible")
      .click();
    const keyInput = page.getByLabel("OpenAI API key");
    await expect(
      page.getByRole("heading", { name: "API key settings" }),
    ).toBeVisible();
    await keyInput.fill("sk-test-browser-session");
    await page.getByRole("button", { name: "Save key" }).click();
    await expect(keyInput).toBeHidden();

    await page
      .locator(".gxchat-settings:visible, .gxchat-mobile-settings:visible")
      .click();
    await expect(keyInput).toHaveValue("sk-test-browser-session");
    await page.getByRole("button", { name: "Remove key" }).click();
    await expect(keyInput).toBeHidden();
  });

  test("ChatGPT launch page explains the trusted host experience", async ({
    page,
  }) => {
    await page.goto("/chatgpt");

    await expect(
      page.getByRole("heading", { name: "From answer to action." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "The answer stays authoritative." }),
    ).toBeVisible();
    await expect(page.getByText("No end-user API key or Fify account required."))
      .toBeVisible();
  });
});
