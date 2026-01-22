// Circuit Breaker Pattern for External API Resilience
// States: CLOSED (normal), OPEN (failing, reject calls), HALF_OPEN (testing recovery)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

// Circuit breaker states
export type CircuitState = 'closed' | 'open' | 'half_open';

// Configuration for each service
export interface CircuitBreakerConfig {
  serviceName: string;
  failureThreshold: number;     // Failures before opening circuit
  successThreshold: number;     // Successes in half-open to close circuit
  cooldownPeriodMs: number;     // Time before testing again after opening
  requestTimeoutMs?: number;    // Optional request timeout
}

// Service health record from database
export interface ServiceHealth {
  id: string;
  service_name: string;
  circuit_state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  last_error_message: string | null;
  state_changed_at: string;
  cooldown_until: string | null;
  avg_response_time_ms: number | null;
  total_requests: number;
  total_failures: number;
}

// Result of circuit breaker operation
export interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  circuitState: CircuitState;
  fromFallback: boolean;
}

// Default configurations for common services
export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  'pdl': { 
    serviceName: 'pdl', 
    failureThreshold: 5, 
    successThreshold: 2, 
    cooldownPeriodMs: 60000,
    requestTimeoutMs: 30000 
  },
  'clearbit': { 
    serviceName: 'clearbit', 
    failureThreshold: 5, 
    successThreshold: 2, 
    cooldownPeriodMs: 60000,
    requestTimeoutMs: 30000 
  },
  'openai': { 
    serviceName: 'openai', 
    failureThreshold: 3, 
    successThreshold: 2, 
    cooldownPeriodMs: 30000,
    requestTimeoutMs: 120000 
  },
  'anthropic': { 
    serviceName: 'anthropic', 
    failureThreshold: 3, 
    successThreshold: 2, 
    cooldownPeriodMs: 30000,
    requestTimeoutMs: 120000 
  },
  'salesforce': { 
    serviceName: 'salesforce', 
    failureThreshold: 5, 
    successThreshold: 3, 
    cooldownPeriodMs: 120000,
    requestTimeoutMs: 60000 
  },
  'hubspot': { 
    serviceName: 'hubspot', 
    failureThreshold: 5, 
    successThreshold: 3, 
    cooldownPeriodMs: 120000,
    requestTimeoutMs: 60000 
  },
  'apollo': { 
    serviceName: 'apollo', 
    failureThreshold: 5, 
    successThreshold: 2, 
    cooldownPeriodMs: 60000,
    requestTimeoutMs: 30000 
  },
  'lovable': { 
    serviceName: 'lovable', 
    failureThreshold: 3, 
    successThreshold: 2, 
    cooldownPeriodMs: 30000,
    requestTimeoutMs: 120000 
  },
  'perplexity': { 
    serviceName: 'perplexity', 
    failureThreshold: 3, 
    successThreshold: 2, 
    cooldownPeriodMs: 30000,
    requestTimeoutMs: 120000 
  },
  'xai': { 
    serviceName: 'xai', 
    failureThreshold: 3, 
    successThreshold: 2, 
    cooldownPeriodMs: 30000,
    requestTimeoutMs: 120000 
  },
};

/**
 * Get circuit breaker configuration for a service
 */
export function getCircuitConfig(serviceName: string): CircuitBreakerConfig {
  return CIRCUIT_BREAKER_CONFIGS[serviceName] || {
    serviceName,
    failureThreshold: 5,
    successThreshold: 2,
    cooldownPeriodMs: 60000,
    requestTimeoutMs: 30000
  };
}

/**
 * Create a Supabase client for circuit breaker operations
 */
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get current service health state from database
 */
export async function getServiceHealth(
  serviceName: string,
  supabase?: SupabaseClient
): Promise<ServiceHealth | null> {
  const client = supabase || getSupabaseClient();
  
  const { data, error } = await client
    .from('service_health')
    .select('*')
    .eq('service_name', serviceName)
    .single();
  
  if (error) {
    console.error(`[circuit-breaker] Error fetching health for ${serviceName}:`, error);
    return null;
  }
  
  return data;
}

/**
 * Get all service health statuses
 */
export async function getAllServiceHealth(
  supabase?: SupabaseClient
): Promise<ServiceHealth[]> {
  const client = supabase || getSupabaseClient();
  
  const { data, error } = await client
    .from('service_health')
    .select('*')
    .order('service_name');
  
  if (error) {
    console.error('[circuit-breaker] Error fetching all service health:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Check if circuit is open (should reject request)
 */
export async function isCircuitOpen(
  serviceName: string,
  supabase?: SupabaseClient
): Promise<{ isOpen: boolean; state: CircuitState; cooldownRemaining?: number }> {
  const health = await getServiceHealth(serviceName, supabase);
  
  if (!health) {
    // No health record, create one and allow request
    await initializeServiceHealth(serviceName, supabase);
    return { isOpen: false, state: 'closed' };
  }
  
  const config = getCircuitConfig(serviceName);
  
  // Circuit is closed - allow request
  if (health.circuit_state === 'closed') {
    return { isOpen: false, state: 'closed' };
  }
  
  // Circuit is open - check if cooldown has expired
  if (health.circuit_state === 'open') {
    const cooldownUntil = health.cooldown_until ? new Date(health.cooldown_until) : null;
    
    if (cooldownUntil && cooldownUntil > new Date()) {
      // Still in cooldown
      const remaining = cooldownUntil.getTime() - Date.now();
      return { isOpen: true, state: 'open', cooldownRemaining: remaining };
    }
    
    // Cooldown expired - transition to half-open
    await transitionToHalfOpen(serviceName, supabase);
    return { isOpen: false, state: 'half_open' };
  }
  
  // Circuit is half-open - allow request (testing)
  return { isOpen: false, state: 'half_open' };
}

/**
 * Initialize service health record if it doesn't exist
 */
async function initializeServiceHealth(
  serviceName: string,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase || getSupabaseClient();
  
  await client
    .from('service_health')
    .upsert({
      service_name: serviceName,
      circuit_state: 'closed',
      failure_count: 0,
      success_count: 0,
      total_requests: 0,
      total_failures: 0
    }, { onConflict: 'service_name' });
}

/**
 * Record a successful request
 */
export async function recordSuccess(
  serviceName: string,
  responseTimeMs?: number,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase || getSupabaseClient();
  const config = getCircuitConfig(serviceName);
  const health = await getServiceHealth(serviceName, client);
  
  if (!health) {
    await initializeServiceHealth(serviceName, client);
    return;
  }
  
  const updates: Partial<ServiceHealth> = {
    last_success_at: new Date().toISOString(),
    failure_count: 0, // Reset failure count on success
    total_requests: health.total_requests + 1,
  };
  
  // Update average response time
  if (responseTimeMs !== undefined) {
    const currentAvg = health.avg_response_time_ms || responseTimeMs;
    updates.avg_response_time_ms = Math.round((currentAvg + responseTimeMs) / 2);
  }
  
  // Handle half-open state transition
  if (health.circuit_state === 'half_open') {
    const newSuccessCount = health.success_count + 1;
    updates.success_count = newSuccessCount;
    
    // Check if we've hit success threshold to close circuit
    if (newSuccessCount >= config.successThreshold) {
      updates.circuit_state = 'closed';
      updates.success_count = 0;
      updates.state_changed_at = new Date().toISOString();
      console.log(`[circuit-breaker] ${serviceName}: Circuit CLOSED (recovered)`);
    }
  }
  
  await client
    .from('service_health')
    .update(updates)
    .eq('service_name', serviceName);
}

/**
 * Record a failed request
 */
export async function recordFailure(
  serviceName: string,
  errorMessage?: string,
  supabase?: SupabaseClient
): Promise<{ circuitOpened: boolean }> {
  const client = supabase || getSupabaseClient();
  const config = getCircuitConfig(serviceName);
  const health = await getServiceHealth(serviceName, client);
  
  if (!health) {
    await initializeServiceHealth(serviceName, client);
    return { circuitOpened: false };
  }
  
  const newFailureCount = health.failure_count + 1;
  
  const updates: Partial<ServiceHealth> = {
    failure_count: newFailureCount,
    last_failure_at: new Date().toISOString(),
    last_error_message: errorMessage?.substring(0, 500) || null,
    total_requests: health.total_requests + 1,
    total_failures: health.total_failures + 1,
    success_count: 0, // Reset success count on failure
  };
  
  let circuitOpened = false;
  
  // Check if we should open the circuit
  if (health.circuit_state === 'closed' && newFailureCount >= config.failureThreshold) {
    updates.circuit_state = 'open';
    updates.state_changed_at = new Date().toISOString();
    updates.cooldown_until = new Date(Date.now() + config.cooldownPeriodMs).toISOString();
    circuitOpened = true;
    console.log(`[circuit-breaker] ${serviceName}: Circuit OPENED (${newFailureCount} failures)`);
  }
  
  // If in half-open and we fail, go back to open
  if (health.circuit_state === 'half_open') {
    updates.circuit_state = 'open';
    updates.state_changed_at = new Date().toISOString();
    updates.cooldown_until = new Date(Date.now() + config.cooldownPeriodMs).toISOString();
    circuitOpened = true;
    console.log(`[circuit-breaker] ${serviceName}: Circuit REOPENED (failed during half-open)`);
  }
  
  await client
    .from('service_health')
    .update(updates)
    .eq('service_name', serviceName);
  
  return { circuitOpened };
}

/**
 * Transition circuit from open to half-open
 */
async function transitionToHalfOpen(
  serviceName: string,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase || getSupabaseClient();
  
  await client
    .from('service_health')
    .update({
      circuit_state: 'half_open',
      state_changed_at: new Date().toISOString(),
      success_count: 0,
      failure_count: 0,
    })
    .eq('service_name', serviceName);
  
  console.log(`[circuit-breaker] ${serviceName}: Circuit HALF_OPEN (testing recovery)`);
}

/**
 * Manually reset a circuit breaker
 */
export async function resetCircuit(
  serviceName: string,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase || getSupabaseClient();
  
  await client
    .from('service_health')
    .update({
      circuit_state: 'closed',
      failure_count: 0,
      success_count: 0,
      state_changed_at: new Date().toISOString(),
      cooldown_until: null,
      last_error_message: null,
    })
    .eq('service_name', serviceName);
  
  console.log(`[circuit-breaker] ${serviceName}: Circuit manually RESET`);
}

/**
 * Execute an operation with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>,
  fallback?: () => T | Promise<T>,
  supabase?: SupabaseClient
): Promise<CircuitBreakerResult<T>> {
  const client = supabase || getSupabaseClient();
  const config = getCircuitConfig(serviceName);
  
  // Check circuit state
  const { isOpen, state, cooldownRemaining } = await isCircuitOpen(serviceName, client);
  
  if (isOpen) {
    console.log(`[circuit-breaker] ${serviceName}: Circuit is OPEN, rejecting request`);
    
    // Try fallback if available
    if (fallback) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true,
          data: fallbackResult,
          circuitState: state,
          fromFallback: true,
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: `Circuit open (cooldown: ${Math.round((cooldownRemaining || 0) / 1000)}s). Fallback failed: ${fallbackError}`,
          circuitState: state,
          fromFallback: true,
        };
      }
    }
    
    return {
      success: false,
      error: `Service ${serviceName} is temporarily unavailable (circuit open). Retry in ${Math.round((cooldownRemaining || 0) / 1000)}s`,
      circuitState: state,
      fromFallback: false,
    };
  }
  
  // Execute operation with timing
  const startTime = Date.now();
  
  try {
    // Add timeout if configured
    let result: T;
    
    if (config.requestTimeoutMs) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${config.requestTimeoutMs}ms`)), config.requestTimeoutMs);
      });
      
      result = await Promise.race([operation(), timeoutPromise]);
    } else {
      result = await operation();
    }
    
    const responseTime = Date.now() - startTime;
    await recordSuccess(serviceName, responseTime, client);
    
    return {
      success: true,
      data: result,
      circuitState: 'closed',
      fromFallback: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordFailure(serviceName, errorMessage, client);
    
    // Try fallback if available
    if (fallback) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true,
          data: fallbackResult,
          error: errorMessage,
          circuitState: state,
          fromFallback: true,
        };
      } catch (fallbackError) {
        // Fallback also failed
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      circuitState: state,
      fromFallback: false,
    };
  }
}

/**
 * Wrap a fetch call with circuit breaker protection
 */
export async function fetchWithCircuitBreaker(
  serviceName: string,
  url: string,
  options?: RequestInit,
  fallbackResponse?: Response | (() => Response | Promise<Response>),
  supabase?: SupabaseClient
): Promise<{ response: Response | null; circuitState: CircuitState; fromFallback: boolean; error?: string }> {
  const result = await withCircuitBreaker<Response>(
    serviceName,
    async () => {
      const response = await fetch(url, options);
      
      // Treat certain HTTP errors as failures for circuit breaker
      if (response.status === 429 || response.status === 503 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    },
    fallbackResponse ? (typeof fallbackResponse === 'function' ? fallbackResponse : () => fallbackResponse) : undefined,
    supabase
  );
  
  return {
    response: result.success ? result.data || null : null,
    circuitState: result.circuitState,
    fromFallback: result.fromFallback,
    error: result.error,
  };
}
