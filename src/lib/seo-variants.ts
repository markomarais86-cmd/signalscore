/**
 * SEO A/B Testing Variants Configuration
 * Centralized configuration for meta description experiments
 */

export interface SEOExperiment {
  experimentId: string;
  variants: Record<string, string>;
}

/**
 * Meta description variants for A/B testing
 * 
 * Variant naming convention:
 * - control: The original/baseline description
 * - power_words: Uses action-oriented, compelling language
 * - social_proof: Emphasizes results, numbers, and credibility
 */
export const SEO_EXPERIMENTS: Record<string, SEOExperiment> = {
  landing: {
    experimentId: 'landing_meta_v1',
    variants: {
      control: "LaunchPulse pinpoints your highest-converting customer profile, validates ICP alignment inside your CRM, and exposes where pipeline yield is being constrained.",
      power_words: "14,000+ accounts scored with 99% accuracy. LaunchPulse AI reveals which prospects convert—and why. Get insights in under 24 hours.",
      social_proof: "RevOps teams close 2x faster with AI-powered ICP intelligence. See exactly which accounts match your best customers. Free demo available.",
    },
  },
  
  product: {
    experimentId: 'product_meta_v1',
    variants: {
      control: "See exactly why deals close and where pipeline leaks. LaunchPulse reveals ICP patterns, persona conversion rates, and data gaps your CRM is hiding.",
      power_words: "AI reveals your hidden ICP patterns in hours, not months. Uncover persona conversion rates, pipeline leaks, and the data gaps costing you revenue.",
      social_proof: "Join GTM teams who increased win rates 40% with ICP intelligence. See exactly why deals close and where your pipeline is leaking.",
    },
  },
  
  pricing: {
    experimentId: 'pricing_meta_v1',
    variants: {
      control: "No per-seat pricing. LaunchPulse plans start with a 90-day Pilot to prove ROI. Includes AI enrichment credits up to 85% cheaper than competitors.",
      power_words: "Start free. Scale when ready. LaunchPulse offers 90-day pilots with no per-seat costs. AI enrichment at 85% less than enterprise providers.",
      social_proof: "Most popular: Professional plan with 1,000 credits/month. Join 100+ revenue teams saving 85% on enrichment. 14-day money-back guarantee.",
    },
  },
};

/**
 * Get the default (control) description for a page
 * Used as fallback when A/B testing is disabled
 */
export const getDefaultDescription = (page: keyof typeof SEO_EXPERIMENTS): string => {
  return SEO_EXPERIMENTS[page]?.variants.control ?? '';
};
