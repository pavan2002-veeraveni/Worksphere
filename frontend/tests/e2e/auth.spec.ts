import { expect, test } from '@playwright/test';

test.describe('Authentication & Protected Routes', () => {
  test('redirects unauthenticated visitors to /login and pre-fills Platform Admin defaults', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    const roleSelect = page.getByLabel('Role');
    await expect(roleSelect.locator('option')).toHaveText([
      'Organization Owner',
      'Project Manager',
      'Platform Admin',
    ]);

    await roleSelect.selectOption('platform_admin');
    await expect(page.getByLabel('Email')).toHaveValue('admin@worksphere.io');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Password123!');
  });

  test('navigates between login and role-based signup forms and validates inputs', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/register/, { timeout: 10000 });

    await expect(page.getByLabel(/first name/i)).toHaveCount(0);
    await expect(page.getByLabel(/last name/i)).toHaveCount(0);

    const signupRoleSelect = page.getByLabel('Role');
    await expect(signupRoleSelect.locator('option')).toHaveText([
      'Organization Owner',
      'Project Manager',
    ]);

    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/valid email is required/i)).toBeVisible();
  });
});
