// Plan tier constants and helper functions

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface PlanTierConfig {
  id: PlanTier;
  name: string;
  displayName: string;
  creditsPerMonth: number | null; // null = unlimited
  maxAccounts: number | null;
  maxLeads: number | null;
  maxUsers: number | null;
}

export const PLAN_TIERS: Record<PlanTier, PlanTierConfig> = {
  free: {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    creditsPerMonth: 50,
    maxAccounts: 100,
    maxLeads: 500,
    maxUsers: 2,
  },
  starter: {
    id: 'starter',
    name: 'starter',
    displayName: 'Starter',
    creditsPerMonth: 500,
    maxAccounts: 1000,
    maxLeads: 5000,
    maxUsers: 5,
  },
  professional: {
    id: 'professional',
    name: 'professional',
    displayName: 'Professional',
    creditsPerMonth: 5000,
    maxAccounts: 10000,
    maxLeads: 50000,
    maxUsers: 20,
  },
  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    creditsPerMonth: null, // unlimited
    maxAccounts: null,
    maxLeads: null,
    maxUsers: null,
  },
};

export const PLAN_TIER_LIST = Object.values(PLAN_TIERS);

export function getPlanCredits(planId: string | null): number | null {
  if (!planId) return PLAN_TIERS.free.creditsPerMonth;
  const tier = PLAN_TIERS[planId as PlanTier];
  return tier?.creditsPerMonth ?? PLAN_TIERS.free.creditsPerMonth;
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
