// AI Guardrails - Content safety, budget enforcement, and response validation

export interface GuardrailConfig {
  maxTokensPerRequest: number;
  maxRequestsPerMinute: number;
  maxCostPerDay: number;
  blockedPatterns: RegExp[];
  sensitiveDataPatterns: RegExp[];
  allowedActions: string[];
  requireConfirmationActions: string[];
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  sanitizedContent?: string;
}

// Default guardrail configuration
export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxTokensPerRequest: 4000,
  maxRequestsPerMinute: 30,
  maxCostPerDay: 50.0, // $50 daily limit
  blockedPatterns: [
    /password\s*[:=]\s*["'][^"']+["']/gi,
    /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
    /secret\s*[:=]\s*["'][^"']+["']/gi,
    /bearer\s+[a-zA-Z0-9\-_.]+/gi,
  ],
  sensitiveDataPatterns: [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{16}\b/g, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email (flag only)
  ],
  allowedActions: [
    'search_accounts',
    'search_contacts',
    'analyze_pipeline',
    'analyze_personas',
    'compare_segments',
    'get_recommendations',
    'build_target_list',
    'audit_data_quality',
    'prepare_campaign',
    'enrich_accounts',
    'enrich_contacts',
    'export_list',
    'create_campaign',
    'trigger_scoring',
    'update_icp',
    'sync_to_crm',
    'schedule_enrichment',
  ],
  requireConfirmationActions: [
    'enrich_accounts',
    'enrich_contacts',
    'export_list',
    'create_campaign',
    'trigger_scoring',
    'update_icp',
    'sync_to_crm',
    'schedule_enrichment',
  ],
};

// Validate input content for safety
export function validateInput(content: string, config: GuardrailConfig = DEFAULT_GUARDRAILS): GuardrailResult {
  const warnings: string[] = [];
  let sanitizedContent = content;

  // Check for blocked patterns (credentials, secrets)
  for (const pattern of config.blockedPatterns) {
    if (pattern.test(content)) {
      return {
        allowed: false,
        reason: 'Input contains potentially sensitive credentials or secrets',
        warnings: ['Blocked pattern detected'],
      };
    }
  }

  // Check for sensitive data patterns and warn
  for (const pattern of config.sensitiveDataPatterns) {
    if (pattern.test(content)) {
      warnings.push('Input may contain sensitive personal data');
      // Optionally redact
      sanitizedContent = sanitizedContent.replace(pattern, '[REDACTED]');
    }
  }

  return {
    allowed: true,
    warnings,
    sanitizedContent: warnings.length > 0 ? sanitizedContent : content,
  };
}

// Validate AI response for safety
export function validateResponse(response: string, config: GuardrailConfig = DEFAULT_GUARDRAILS): GuardrailResult {
  const warnings: string[] = [];
  let sanitizedContent = response;

  // Check for leaked credentials in response
  for (const pattern of config.blockedPatterns) {
    if (pattern.test(response)) {
      sanitizedContent = sanitizedContent.replace(pattern, '[CREDENTIALS_REMOVED]');
      warnings.push('Response contained potential credentials - removed');
    }
  }

  // Check response length
  if (response.length > 50000) {
    warnings.push('Response truncated due to length');
    sanitizedContent = sanitizedContent.substring(0, 50000) + '... [truncated]';
  }

  return {
    allowed: true,
    warnings,
    sanitizedContent,
  };
}

// Validate action is allowed
export function validateAction(
  actionName: string,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): { allowed: boolean; requiresConfirmation: boolean; reason?: string } {
  if (!config.allowedActions.includes(actionName)) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `Action '${actionName}' is not in the allowed actions list`,
    };
  }

  return {
    allowed: true,
    requiresConfirmation: config.requireConfirmationActions.includes(actionName),
  };
}

// Check rate limits
export async function checkRateLimit(
  supabaseClient: any,
  orgId: string,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): Promise<{ allowed: boolean; currentCount: number; resetAt: Date }> {
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  const { count } = await supabaseClient
    .from('ai_usage_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', oneMinuteAgo);

  const currentCount = count || 0;
  const allowed = currentCount < config.maxRequestsPerMinute;

  return {
    allowed,
    currentCount,
    resetAt: new Date(Date.now() + 60000),
  };
}

// Check daily cost budget
export async function checkBudget(
  supabaseClient: any,
  orgId: string,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): Promise<{ allowed: boolean; currentCost: number; limit: number; remaining: number }> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabaseClient
    .from('ai_usage_tracking')
    .select('cost_estimate')
    .eq('org_id', orgId)
    .gte('created_at', todayStart.toISOString());

  const currentCost = (data || []).reduce((sum: number, row: any) => sum + (parseFloat(row.cost_estimate) || 0), 0);
  const remaining = config.maxCostPerDay - currentCost;

  return {
    allowed: remaining > 0,
    currentCost,
    limit: config.maxCostPerDay,
    remaining: Math.max(0, remaining),
  };
}

// Comprehensive pre-request validation
export async function validateRequest(
  supabaseClient: any,
  orgId: string,
  content: string,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): Promise<{
  allowed: boolean;
  reason?: string;
  warnings: string[];
  sanitizedContent?: string;
}> {
  const allWarnings: string[] = [];

  // Validate input content
  const inputValidation = validateInput(content, config);
  if (!inputValidation.allowed) {
    return inputValidation;
  }
  allWarnings.push(...inputValidation.warnings);

  // Check rate limit
  const rateLimit = await checkRateLimit(supabaseClient, orgId, config);
  if (!rateLimit.allowed) {
    return {
      allowed: false,
      reason: `Rate limit exceeded (${rateLimit.currentCount}/${config.maxRequestsPerMinute} requests/min)`,
      warnings: allWarnings,
    };
  }

  // Check budget
  const budget = await checkBudget(supabaseClient, orgId, config);
  if (!budget.allowed) {
    return {
      allowed: false,
      reason: `Daily AI budget exceeded ($${budget.currentCost.toFixed(2)}/$${budget.limit.toFixed(2)})`,
      warnings: allWarnings,
    };
  }

  if (budget.remaining < 5) {
    allWarnings.push(`Low AI budget remaining: $${budget.remaining.toFixed(2)}`);
  }

  return {
    allowed: true,
    warnings: allWarnings,
    sanitizedContent: inputValidation.sanitizedContent,
  };
}

// Estimate cost based on tokens
export function estimateCost(provider: string, model: string, tokensInput: number, tokensOutput: number): number {
  // Cost per 1K tokens (approximate)
  const costs: Record<string, Record<string, { input: number; output: number }>> = {
    openai: {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
    },
    anthropic: {
      'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
      default: { input: 0.002, output: 0.01 },
    },
    lovable: {
      default: { input: 0.001, output: 0.005 },
    },
    perplexity: {
      default: { input: 0.001, output: 0.005 },
    },
    xai: {
      default: { input: 0.002, output: 0.008 },
    },
  };

  const providerCosts = costs[provider] || costs.lovable;
  const modelCosts = providerCosts[model] || providerCosts.default || { input: 0.001, output: 0.005 };

  return (tokensInput / 1000) * modelCosts.input + (tokensOutput / 1000) * modelCosts.output;
}
