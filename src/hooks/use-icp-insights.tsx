import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

export interface ICPInsight {
  type: 'revenue' | 'persona' | 'firmographic' | 'signal';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  relatedSegments?: string[];
}

export interface InsightsStatistics {
  total_accounts: number;
  high_score_accounts: number;
  total_contacts: number;
  total_deals: number;
  avg_deal_value: number;
}

export function useICPInsights() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<ICPInsight[]>([]);
  const [statistics, setStatistics] = useState<InsightsStatistics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const generateInsights = async (icpId?: string, forceRefresh = false) => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "User profile not found",
        variant: "destructive",
      });
      return;
    }

    // Check cache first
    const cacheKey = `icp_insights_${userProfile.org_id}`;
    const timestampKey = `icp_insights_timestamp_${userProfile.org_id}`;
    
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        const timestamp = localStorage.getItem(timestampKey);
        
        if (cached && timestamp) {
          const age = Date.now() - parseInt(timestamp);
          const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
          
          if (age < CACHE_TTL) {
            const cachedData = JSON.parse(cached);
            setInsights(cachedData.insights);
            setStatistics(cachedData.statistics);
            setLastUpdated(new Date(parseInt(timestamp)));
            return;
          }
        }
      } catch (err) {
        console.warn('Cache read error:', err);
      }
    }

    setLoading(true);
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
        
        // Cache the results
        try {
          const cacheData = {
            insights: data.insights,
            statistics: data.statistics
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          localStorage.setItem(timestampKey, Date.now().toString());
          setLastUpdated(new Date());
        } catch (err) {
          console.warn('Cache write error:', err);
        }
        
        toast({
          title: "Success",
          description: `Generated ${data.insights.length} actionable insights`,
        });
      }
    } catch (error: any) {
      console.error('Error generating insights:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    insights,
    statistics,
    lastUpdated,
    generateInsights,
  };
}
