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
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const generateInsights = async (icpId?: string) => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "User profile not found",
        variant: "destructive",
      });
      return;
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
    generateInsights,
  };
}
