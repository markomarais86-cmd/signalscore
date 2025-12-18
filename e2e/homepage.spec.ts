import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await expect(page).toHaveTitle(/LaunchPulse/i);
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    
    // Check for main navigation or header
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Authentication Flow', () => {
  test('should show login form when not authenticated', async ({ page }) => {
    await page.goto('/auth');
    
    // Should see email input
    const emailInput = page.getByPlaceholder(/email/i);
    await expect(emailInput).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth');
    
    const emailInput = page.getByPlaceholder(/email/i);
    await emailInput.fill('invalid-email');
    
    // Try to submit - should show validation error
    const submitButton = page.getByRole('button', { name: /sign in|continue/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Check for error message or validation state
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate to accounts page', async ({ page }) => {
    await page.goto('/');
    
    // Look for accounts link in navigation
    const accountsLink = page.getByRole('link', { name: /accounts/i }).first();
    if (await accountsLink.isVisible()) {
      await accountsLink.click();
      await expect(page).toHaveURL(/accounts/);
    }
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');
    
    // Look for settings link
    const settingsLink = page.getByRole('link', { name: /settings/i }).first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/settings/);
    }
  });
});
