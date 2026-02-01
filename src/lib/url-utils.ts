/**
 * URL utilities for consistent redirect URLs across the application.
 * 
 * For emails and external links, we always use the production domain
 * to ensure deliverability and proper user experience.
 */

export const PRODUCTION_URL = 'https://launchpulse.io';

/**
 * Get the production URL for external-facing links (emails, invitations, etc.)
 */
export function getProductionUrl(): string {
  return PRODUCTION_URL;
}

/**
 * Build an invitation URL for email links.
 * Always uses production domain for email deliverability.
 */
export function getInviteUrl(token: string): string {
  return `${PRODUCTION_URL}/auth?invite=${token}`;
}

/**
 * Build the password reset URL.
 * Always uses production domain.
 */
export function getPasswordResetUrl(): string {
  return `${PRODUCTION_URL}/reset-password`;
}

/**
 * Build OAuth redirect URL.
 * Uses window.location.origin so users return to their current environment.
 */
export function getOAuthRedirectUrl(path: string = '/settings?tab=integrations'): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return `${PRODUCTION_URL}${path}`;
}
