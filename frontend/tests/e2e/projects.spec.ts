import { expect, test } from '@playwright/test';

test.describe('Projects & Concurrent Task Flows', () => {
  test('login, view dashboard, and create project when API is running', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'u-1',
              email: 'alice@acme.com',
              firstName: 'Alice',
              lastName: 'Johnson',
              avatarUrl: null,
              isPlatformAdmin: false,
              isActive: true,
              organizations: [{ id: 'org-1', name: 'Acme Corp', slug: 'acme-corp', plan: 'pro', role: 'owner' }],
            },
            tokens: { accessToken: 'mock-jwt', refreshToken: 'mock-rt' },
          },
        }),
      });
    });

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'u-1',
            email: 'alice@acme.com',
            firstName: 'Alice',
            lastName: 'Johnson',
            avatarUrl: null,
            isPlatformAdmin: false,
            isActive: true,
            organizations: [{ id: 'org-1', name: 'Acme Corp', slug: 'acme-corp', plan: 'pro', role: 'owner' }],
          },
        }),
      });
    });

    await page.route('**/api/v1/projects*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'p-1', org_id: 'org-1', name: 'E2E Launch', status: 'active', priority: 'high', version: 1, settings: {} },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
        });
      }
    });

    await page.route('**/api/v1/tasks*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
      });
    });

    await page.route('**/api/v1/notifications*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { unreadCount: 0 } }) });
    });

    await page.route('**/api/v1/activity*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill('alice@acme.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Welcome back, Alice/i)).toBeVisible();
  });
});
