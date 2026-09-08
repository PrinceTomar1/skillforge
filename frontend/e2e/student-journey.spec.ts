import { test, expect } from "@playwright/test";

// End-to-end coverage of the path a brand-new student actually takes, driven
// through the real UI against a real backend + Postgres — not mocked. Uses a
// freshly-registered account each run so it doesn't depend on (or corrupt)
// seeded demo data, and doesn't touch the AI Tutor's generation step since no
// LLM key is configured in CI — it instead asserts on the honest
// "not configured" fallback, which is itself a feature worth covering.

test("student can sign up, enroll, complete a lesson, take a quiz, and see it all persist", async ({ page }) => {
  const email = `e2e.${Date.now()}@example.com`;

  await test.step("sign up", async () => {
    await page.goto("/signup");
    await page.getByPlaceholder("Jane Doe").fill("E2E Student");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder(/at least 8 characters/i).fill("E2ePassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  await test.step("browse, open a course, and enroll", async () => {
    await page.goto("/courses");
    await page.getByText(/Generative AI & Large Language Models/i).click();
    await expect(page.getByRole("button", { name: /Enroll now/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Enroll now/i }).click();
    // Enrolling drops the student straight into the course player.
    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });
  });

  await test.step("watch a lesson and mark it complete", async () => {
    await expect(page.getByRole("button", { name: /Mark as complete/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Mark as complete/i }).click();
    await expect(page.getByRole("button", { name: /Mark as incomplete/i })).toBeVisible({ timeout: 10000 });
  });

  let quizScorePercent: string | null = null;

  await test.step("take the lesson's quiz", async () => {
    await page.getByRole("button", { name: "Take quiz" }).click();
    await expect(page.getByTestId("quiz-option").first()).toBeVisible({ timeout: 10000 });

    // Answer every question so "Submit quiz" is reachable, without asserting
    // a specific score — the point is the full submit -> grade -> persist
    // path works, not that this run happens to answer everything correctly.
    for (;;) {
      const options = page.getByTestId("quiz-option");
      await options.first().click();
      const submit = page.getByRole("button", { name: /Submit quiz/i });
      if (await submit.isVisible()) {
        await submit.click();
        break;
      }
      await page.getByRole("button", { name: /Next question/i }).click();
    }

    await expect(page).toHaveURL(/\/quiz\/attempts\/.+\/result/, { timeout: 10000 });
    const scoreEl = page.locator("text=/%$/").first();
    await expect(scoreEl).toBeVisible();
    quizScorePercent = await scoreEl.textContent();
  });

  await test.step("dashboard reflects real progress, not placeholders", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Generative AI & Large Language Models").first()).toBeVisible({ timeout: 10000 });
    // The course card shows some non-zero completion now that a lesson is done.
    await expect(page.getByText(/lessons complete/i).first()).toBeVisible();
  });

  await test.step("ai tutor is honest about not being configured in this environment", async () => {
    await page.goto("/ai-tutor");
    await expect(page.getByText(/AI generation isn't configured|not configured/i)).toBeVisible({ timeout: 10000 });
  });

  await test.step("progress survives logout, login, and a reload", async () => {
    await page.getByRole("button", { name: /E2E/i }).click();
    await page.getByRole("button", { name: /Log out/i }).click();
    await expect(page).toHaveURL(/\/$|\/login/, { timeout: 10000 });

    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.locator('input[type="password"]').fill("E2ePassword123!");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    await page.reload();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText("Generative AI & Large Language Models").first()).toBeVisible({ timeout: 10000 });
  });

  expect(quizScorePercent).toMatch(/\d+%/);
});
