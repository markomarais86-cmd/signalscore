// Plan tier constants and helper functions

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface PlanTierConfig {
  id: PlanTier;
  name: string;
  displayName: string;
  
  // Pricing
  monthlyPrice: number | null; // null = custom/contact sales
  annualPrice: number | null;
  
  // Platform Limits
  limits: {
    maxAccounts: number | null; // null = unlimited
    maxLeads: number | null;
    maxUsers: number | null;
    maxCrmIntegrations: number | null;
  };
  
  // Included Enrichment Credits (per month)
  monthlyEnrichmentCredits: number;
  
  // Feature Flags
  features: {
    basicTam: boolean;
    advancedTam: boolean;
    personaInsights: boolean;
    aiAgents: boolean;
    crmSync: boolean;
    apiAccess: boolean;
    sso: boolean;
    customReporting: boolean;
  };
  
  // Legacy fields for backward compatibility
  creditsPerMonth: number | null;
  maxAccounts: number | null;
  maxLeads: number | null;
  maxUsers: number | null;
}

export const PLAN_TIERS: Record<PlanTier, PlanTierConfig> = {
  free: {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    limits: {
      maxAccounts: 100,
      maxLeads: 500,
      maxUsers: 2,
      maxCrmIntegrations: 0,
    },
    monthlyEnrichmentCredits: 10,
    features: {
      basicTam: true,
      advancedTam: false,
      personaInsights: false,
      aiAgents: false,
      crmSync: false,
      apiAccess: false,
      sso: false,
      customReporting: false,
    },
    // Legacy
    creditsPerMonth: 10,
    maxAccounts: 100,
    maxLeads: 500,
    maxUsers: 2,
  },
  starter: {
    id: 'starter',
    name: 'starter',
    displayName: 'Starter',
    monthlyPrice: 299,
    annualPrice: 2990, // ~2 months free
    limits: {
      maxAccounts: 2500,
      maxLeads: 12500,
      maxUsers: 5,
      maxCrmIntegrations: 1,
    },
    monthlyEnrichmentCredits: 50,
    features: {
      basicTam: true,
      advancedTam: false,
      personaInsights: false,
      aiAgents: false,
      crmSync: true,
      apiAccess: false,
      sso: false,
      customReporting: false,
    },
    // Legacy
    creditsPerMonth: 50,
    maxAccounts: 2500,
    maxLeads: 12500,
    maxUsers: 5,
  },
  professional: {
    id: 'professional',
    name: 'professional',
    displayName: 'Professional',
    monthlyPrice: 699,
    annualPrice: 6990, // ~2 months free
    limits: {
      maxAccounts: 10000,
      maxLeads: 50000,
      maxUsers: 15,
      maxCrmIntegrations: null, // unlimited
    },
    monthlyEnrichmentCredits: 250,
    features: {
      basicTam: true,
      advancedTam: true,
      personaInsights: true,
      aiAgents: true,
      crmSync: true,
      apiAccess: false,
      sso: false,
      customReporting: true,
    },
    // Legacy
    creditsPerMonth: 250,
    maxAccounts: 10000,
    maxLeads: 50000,
    maxUsers: 15,
  },
  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    monthlyPrice: null, // custom
    annualPrice: null,
    limits: {
      maxAccounts: null, // unlimited
      maxLeads: null,
      maxUsers: null,
      maxCrmIntegrations: null,
    },
    monthlyEnrichmentCredits: 1000, // base, can be customized
    features: {
      basicTam: true,
      advancedTam: true,
      personaInsights: true,
      aiAgents: true,
      crmSync: true,
      apiAccess: true,
      sso: true,
      customReporting: true,
    },
    // Legacy
    creditsPerMonth: null, // unlimited
    maxAccounts: null,
    maxLeads: null,
    maxUsers: null,
  },
};

// Enrichment Credit Packs (one-time purchases)
export interface EnrichmentCreditPack {
  id: string;
  name: string;
  credits: number;
  price: number; // USD
  perCredit: number;
  popular?: boolean;
  stripePriceId?: string; // To be populated after Stripe setup
}

export const ENRICHMENT_CREDIT_PACKS: EnrichmentCreditPack[] = [
  { id: 'starter', name: 'Starter Pack', credits: 250, price: 49, perCredit: 0.20 },
  { id: 'growth', name: 'Growth Pack', credits: 1000, price: 149, perCredit: 0.15, popular: true },
  { id: 'scale', name: 'Scale Pack', credits: 5000, price: 499, perCredit: 0.10 },
  { id: 'enterprise', name: 'Enterprise Pack', credits: 25000, price: 1999, perCredit: 0.08 },
];

export const PLAN_TIER_LIST = Object.values(PLAN_TIERS);

export function getPlanCredits(planId: string | null): number | null {
  if (!planId) return PLAN_TIERS.free.monthlyEnrichmentCredits;
  const tier = PLAN_TIERS[planId as PlanTier];
  return tier?.monthlyEnrichmentCredits ?? PLAN_TIERS.free.monthlyEnrichmentCredits;
}

export function isUnlimited(planId: string | null): boolean {
  if (!planId) return false;
  return PLAN_TIERS[planId as PlanTier]?.creditsPerMonth === null;
}

export function getPlanDisplayName(planId: string | null): string {
  if (!planId) return 'Free';
  return PLAN_TIERS[planId as PlanTier]?.displayName ?? 'Free';
}

export function getPlanTierFromId(planId: string | null): PlanTierConfig {
  if (!planId) return PLAN_TIERS.free;
  return PLAN_TIERS[planId as PlanTier] ?? PLAN_TIERS.free;
}

export function calculateAvailableCredits(
  planTotal: number | null,
  planUsed: number,
  bonusCredits: number
): { available: number; isUnlimited: boolean } {
  if (planTotal === null) {
    return { available: Infinity, isUnlimited: true };
  }
  const planRemaining = Math.max(0, planTotal - planUsed);
  return { 
    available: planRemaining + bonusCredits, 
    isUnlimited: false 
  };
}

export function consumeCredits(
  currentBonusCredits: number,
  currentPlanUsed: number,
  planTotal: number | null,
  creditsToConsume: number
): { newBonusCredits: number; newPlanUsed: number; success: boolean } {
  // Unlimited plan - just increment used counter, never fail
  if (planTotal === null) {
    return {
      newBonusCredits: currentBonusCredits,
      newPlanUsed: currentPlanUsed + creditsToConsume,
      success: true,
    };
  }

  const { available } = calculateAvailableCredits(planTotal, currentPlanUsed, currentBonusCredits);
  
  if (creditsToConsume > available) {
    return {
      newBonusCredits: currentBonusCredits,
      newPlanUsed: currentPlanUsed,
      success: false,
    };
  }

  let remaining = creditsToConsume;
  let newBonusCredits = currentBonusCredits;
  let newPlanUsed = currentPlanUsed;

  // Consume from bonus credits first
  if (newBonusCredits > 0) {
    const fromBonus = Math.min(newBonusCredits, remaining);
    newBonusCredits -= fromBonus;
    remaining -= fromBonus;
  }

  // Then consume from plan credits
  if (remaining > 0) {
    newPlanUsed += remaining;
  }

  return { newBonusCredits, newPlanUsed, success: true };
}

// Helper to get credit pack by ID
export function getCreditPackById(packId: string): EnrichmentCreditPack | undefined {
  return ENRICHMENT_CREDIT_PACKS.find(pack => pack.id === packId);
}

// Helper to check if a feature is available for a plan
export function hasFeature(planId: string | null, feature: keyof PlanTierConfig['features']): boolean {
  const tier = getPlanTierFromId(planId);
  return tier.features[feature] ?? false;
}

// Helper to get plan limits
export function getPlanLimit(planId: string | null, limit: keyof PlanTierConfig['limits']): number | null {
  const tier = getPlanTierFromId(planId);
  return tier.limits[limit];
}
