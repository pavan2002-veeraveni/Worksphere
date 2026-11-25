import { expect, test } from '@playwright/test';

test.describe('Authentication & Protected Routes', () => {
  test('redirects unauthenticated visitors to /login', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('navigates between login and registration forms and validates inputs', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/register/);

    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/first name is required/i)).toBeVisible();
  });
});
