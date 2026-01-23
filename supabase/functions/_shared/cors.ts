// Dynamic CORS configuration with origin validation
// Prevents cross-origin attacks by only allowing known origins

/**
 * Get allowed origins from environment or use defaults
 * In production, set ALLOWED_ORIGINS env var with comma-separated origins
 */
export const getAllowedOrigins = (): string[] => {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(Boolean);
  }
  
  // Default allowed origins - Lovable preview and published URLs
  // These patterns match Lovable's URL structure
  return [
    // Lovable preview URLs (pattern: id-preview--{project-id}.lovable.app)
    'https://id-preview--f6080332-94e1-4aef-bfee-6cc8143489f0.lovable.app',
    // Add localhost for development
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
  ];
};

/**
 * Check if an origin matches Lovable's URL pattern
 * Lovable URLs follow: https://{something}.lovable.app
 */
const isLovableOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    // Support both .lovable.app AND .lovableproject.com domains
    return (
      (url.hostname.endsWith('.lovable.app') || 
       url.hostname.endsWith('.lovableproject.com')) && 
      url.protocol === 'https:'
    );
  } catch {
    return false;
  }
};

/**
 * Get CORS headers with origin validation
 * @param origin - The request origin header
 * @returns CORS headers with validated origin
 */
export const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is in allowed list or matches Lovable pattern
  let allowOrigin: string;
  
  if (origin && (allowedOrigins.includes(origin) || isLovableOrigin(origin))) {
    allowOrigin = origin;
  } else {
    // Default to first allowed origin for non-matching requests
    // This prevents the API from being called from unknown origins
    allowOrigin = allowedOrigins[0] || 'https://lovable.app';
  }
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};

/**
 * Legacy export for backward compatibility
 * @deprecated Use getCorsHeaders(origin) instead for proper origin validation
 * This is kept for gradual migration - edge functions should be updated to use getCorsHeaders
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
