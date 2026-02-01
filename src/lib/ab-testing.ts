/**
 * A/B Testing Utility for LaunchPulse
 * Provides deterministic variant assignment based on persistent user IDs
 */

const USER_ID_KEY = 'lp_ab_user_id';

/**
 * Generate a random UUID v4
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Get or create a persistent user ID for A/B testing
 * Stored in localStorage to ensure consistent variant assignment across sessions
 */
export const getUserId = (): string => {
  if (typeof window === 'undefined') {
    return 'server-side';
  }

  let userId = localStorage.getItem(USER_ID_KEY);
  
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  
  return userId;
};

/**
 * Simple hash function to convert a string to a number
 * Used for deterministic variant assignment
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Get a deterministic variant for a given experiment
 * The same user will always see the same variant for a given experiment
 * 
 * @param experimentId - Unique identifier for the experiment
 * @param variantKeys - Array of variant keys (e.g., ['control', 'variant_a', 'variant_b'])
 * @returns The selected variant key
 */
export const getVariant = (experimentId: string, variantKeys: string[]): string => {
  if (variantKeys.length === 0) {
    throw new Error('At least one variant must be provided');
  }
  
  if (variantKeys.length === 1) {
    return variantKeys[0];
  }

  const userId = getUserId();
  const combinedKey = `${userId}:${experimentId}`;
  const hash = hashString(combinedKey);
  const variantIndex = hash % variantKeys.length;
  
  return variantKeys[variantIndex];
};

/**
 * Get variant from an experiment configuration object
 * 
 * @param experimentId - Unique identifier for the experiment
 * @param variants - Object mapping variant keys to their values
 * @returns Object with the selected variant key and its value
 */
export const getVariantFromConfig = <T>(
  experimentId: string,
  variants: Record<string, T>
): { variantKey: string; value: T } => {
  const variantKeys = Object.keys(variants);
  const selectedKey = getVariant(experimentId, variantKeys);
  
  return {
    variantKey: selectedKey,
    value: variants[selectedKey],
  };
};
