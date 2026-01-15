import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  error?: string;
  supabaseClient?: SupabaseClient;
}

/**
 * Validate JWT token and return authenticated user
 * Uses Supabase auth.getUser() for secure server-side validation
 * 
 * @param req - The incoming request
 * @returns AuthResult with user info or error
 */
export async function validateAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      success: false,
      error: 'Missing authorization header',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Invalid authorization format. Expected: Bearer <token>',
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth] Missing Supabase configuration');
    return {
      success: false,
      error: 'Server configuration error',
    };
  }

  // Create client with user's auth token for proper RLS
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  try {
    // Validate JWT token using getClaims (recommended approach)
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('[Auth] Token validation failed:', claimsError?.message);
      return {
        success: false,
        error: 'Invalid or expired token',
      };
    }

    const claims = claimsData.claims;
    
    return {
      success: true,
      user: {
        id: claims.sub as string,
        email: claims.email as string | undefined,
        role: claims.role as string | undefined,
      },
      supabaseClient,
    };
  } catch (error) {
    console.error('[Auth] Unexpected error during authentication:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Create an unauthorized response with proper CORS headers
 */
export function unauthorizedResponse(req: Request, message: string = 'Unauthorized'): Response {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create an error response with proper CORS headers
 */
export function errorResponse(req: Request, message: string, status: number = 400): Response {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create a success response with proper CORS headers
 */
export function successResponse(req: Request, data: unknown, status: number = 200): Response {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Handle CORS preflight OPTIONS request
 */
export function handleCorsOptions(req: Request): Response {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
