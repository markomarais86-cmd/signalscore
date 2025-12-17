import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

const CACHE_VERSION = 'v2'; // Bump this when edge function changes
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes between refreshes
const DEBOUNCE_DELAY = 30000; // 30 seconds to batch changes

export interface ICPInsight {
  type: 'revenue' | 'persona' | 'firmographic' | 'signal';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  relatedSegments?: string[];
  nextAction?: string;
}

export interface InsightsStatistics {
  total_accounts: number;
  high_score_accounts: number;
  total_leads: number;
  lead_coverage_percent: number;
  high_fit_with_leads: number;
  high_fit_missing_leads: number;
  data_completeness: number;
  total_deals: number;
  avg_deal_value: number;
}

export function useICPInsights() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<ICPInsight[]>([]);
  const [statistics, setStatistics] = useState<InsightsStatistics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const lastRefreshRef = useRef<number>(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Clear error on new generation
  const clearError = useCallback(() => setError(null), []);

  const generateInsights = useCallback(async (icpId?: string, forceRefresh = false, isAutoRefresh = false) => {
    if (!userProfile?.org_id) {
      if (!isAutoRefresh) {
        toast({
          title: "Error",
          description: "User profile not found",
          variant: "destructive",
        });
      }
      return;
    }

    // Rate limiting: prevent refreshes more frequent than MIN_REFRESH_INTERVAL
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;
    
    if (!forceRefresh && timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      console.log(`⏱️ Rate limited: Last refresh was ${Math.round(timeSinceLastRefresh / 1000)}s ago`);
      if (isAutoRefresh) {
        const waitTime = Math.round((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
        toast({
          title: "Insights refresh scheduled",
          description: `Next refresh available in ${waitTime}s to avoid rate limits`,
        });
      }
      return;
    }

    // Check cache first (versioned to invalidate when edge function changes)
    const cacheKey = `icp_insights_${CACHE_VERSION}_${userProfile.org_id}`;
    const timestampKey = `icp_insights_timestamp_${CACHE_VERSION}_${userProfile.org_id}`;
    
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        const timestamp = localStorage.getItem(timestampKey);
        
        if (cached && timestamp) {
          const age = Date.now() - parseInt(timestamp);
          
          if (age < CACHE_TTL) {
            const cachedData = JSON.parse(cached);
            setInsights(cachedData.insights);
            setStatistics(cachedData.statistics);
            setLastUpdated(new Date(parseInt(timestamp)));
            console.log('✅ Loaded insights from cache');
            return;
          }
        }
      } catch (err) {
        console.warn('Cache read error:', err);
      }
    }

    setLoading(true);
    clearError();
    setUsingFallback(false);
    console.log('🔄 Generating ICP insights', isAutoRefresh ? '(auto-refresh)' : '');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-icp-insights', {
        body: {
          org_id: userProfile.org_id,
          icp_id: icpId,
        },
      });

      if (error) throw error;

      if (data.success) {
        setInsights(data.insights);
        setStatistics(data.statistics);
        
        // Check if fallback was used
        if (data._debug?.fallback_used) {
          setUsingFallback(true);
          console.log('⚠️ AI parsing failed, using fallback insights');
        }
        if (data._debug?.ai_parse_error) {
          console.warn('AI parse error:', data._debug.ai_parse_error);
        }
        
        const timestamp = Date.now();
        lastRefreshRef.current = timestamp;
        
        // Cache the results
        try {
          const cacheData = {
            insights: data.insights,
            statistics: data.statistics
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          localStorage.setItem(timestampKey, timestamp.toString());
          setLastUpdated(new Date(timestamp));
        } catch (err) {
          console.warn('Cache write error:', err);
        }
        
        console.log('✅ Generated', data.insights.length, 'ICP insights');
        
        if (isAutoRefresh) {
          toast({
            title: "Insights refreshed",
            description: `${data.insights.length} insights updated`,
          });
        } else {
          toast({
            title: "Success",
            description: `Generated ${data.insights.length} actionable insights`,
          });
        }
      }
    } catch (error: any) {
      console.error('Error generating insights:', error);
      setError(error.message || "Failed to generate insights");
      if (!isAutoRefresh) {
        toast({
          title: "Error",
          description: error.message || "Failed to generate insights",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile, toast, clearError]);

  // Auto-refresh: Listen to database changes
  useEffect(() => {
    if (!userProfile?.org_id) return;

    console.log('🔄 Setting up ICP insights auto-refresh for org:', userProfile.org_id);

    // Debounced refresh function to batch multiple changes
    const scheduleRefresh = () => {
      // Clear any pending refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      // Schedule a refresh after debounce delay
      refreshTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Auto-refreshing ICP insights due to data changes');
        generateInsights(undefined, false, true);
      }, DEBOUNCE_DELAY);
    };

    // Subscribe to new leads
    const leadsChannel = supabase
      .channel('icp-insights-leads')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Leads',
          filter: `org_id=eq.${userProfile.org_id}`
        },
        (payload) => {
          console.log('📥 New lead detected, scheduling insights refresh');
          scheduleRefresh();
        }
      )
      .subscribe();

    // Subscribe to score changes
    const scoresChannel = supabase
      .channel('icp-insights-scores')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `org_id=eq.${userProfile.org_id}`
        },
        (payload) => {
          console.log('📊 Score updated, scheduling insights refresh');
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up ICP insights auto-refresh');
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(scoresChannel);
    };
  }, [userProfile?.org_id, generateInsights]);

  return {
    loading,
    insights,
    statistics,
    lastUpdated,
    error,
    usingFallback,
    generateInsights,
    clearError,
  };
}
