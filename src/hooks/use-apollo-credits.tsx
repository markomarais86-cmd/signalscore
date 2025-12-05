import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

interface ApolloCredits {
  configured: boolean;
  apiAccessible: boolean;
  creditsRemaining: number | null;
  creditsUsedToday: number | null;
  dailyLimit: number | null;
  hourlyRemaining: number | null;
  hourlyLimit: number | null;
  lastChecked: string | null;
  isLoading: boolean;
  error: string | null;
  message: string | null;
}

export function useApolloCredits() {
  const { userProfile } = useAuth();
  const [credits, setCredits] = useState<ApolloCredits>({
    configured: false,
    apiAccessible: true,
    creditsRemaining: null,
    creditsUsedToday: null,
    dailyLimit: null,
    hourlyRemaining: null,
    hourlyLimit: null,
    lastChecked: null,
    isLoading: true,
    error: null,
    message: null,
  });

  const fetchCredits = useCallback(async () => {
    if (!userProfile?.org_id) return;

    setCredits(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // First check if we have cached credits
      const { data: cached } = await supabase
        .from('external_data_sources')
        .select('credits_remaining, credits_used_total, monthly_credit_limit, credits_last_checked, api_key_configured')
        .eq('org_id', userProfile.org_id)
        .eq('provider', 'apollo')
        .single();

      // If we have recent cached data (within 5 minutes), use it
      if (cached?.credits_last_checked) {
        const lastChecked = new Date(cached.credits_last_checked);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (lastChecked > fiveMinutesAgo && cached.credits_remaining !== null) {
          setCredits({
            configured: cached.api_key_configured || false,
            apiAccessible: true,
            creditsRemaining: cached.credits_remaining,
            creditsUsedToday: cached.credits_used_total,
            dailyLimit: cached.monthly_credit_limit,
            hourlyRemaining: null,
            hourlyLimit: null,
            lastChecked: cached.credits_last_checked,
            isLoading: false,
            error: null,
            message: null,
          });
          return;
        }
      }

      // Fetch fresh credits from Apollo
      const { data, error } = await supabase.functions.invoke('get-apollo-credits', {
        body: { org_id: userProfile.org_id },
      });

      if (error) throw error;

      if (data.error && !data.configured) {
        setCredits({
          configured: false,
          apiAccessible: false,
          creditsRemaining: null,
          creditsUsedToday: null,
          dailyLimit: null,
          hourlyRemaining: null,
          hourlyLimit: null,
          lastChecked: null,
          isLoading: false,
          error: null,
          message: null,
        });
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Handle case where API is configured but credit stats aren't accessible
      const apiAccessible = data.api_accessible !== false;

      setCredits({
        configured: data.configured,
        apiAccessible,
        creditsRemaining: data.credits_remaining,
        creditsUsedToday: data.credits_used_today,
        dailyLimit: data.daily_limit,
        hourlyRemaining: data.hourly_remaining,
        hourlyLimit: data.hourly_limit,
        lastChecked: data.last_checked,
        isLoading: false,
        error: null,
        message: data.message || null,
      });
    } catch (err: any) {
      console.error('[useApolloCredits] Error:', err);
      setCredits(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to fetch Apollo credits',
      }));
    }
  }, [userProfile?.org_id]);

  const refreshCredits = useCallback(async () => {
    // Force a fresh fetch by clearing cache first
    if (!userProfile?.org_id) return;

    await supabase
      .from('external_data_sources')
      .update({ credits_last_checked: null })
      .eq('org_id', userProfile.org_id)
      .eq('provider', 'apollo');

    await fetchCredits();
  }, [userProfile?.org_id, fetchCredits]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return {
    ...credits,
    refreshCredits,
  };
}