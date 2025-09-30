import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ClosedWonAnalysis {
  total_deals: number;
  valid_deals: number;
  total_value: number;
  avg_deal_value: number;
  avg_sales_cycle: number;
  confidence_score: number;
}

export interface ICPRecommendation {
  name: string;
  description: string;
  industries: string[];
  company_sizes: number[];
  revenue_ranges: string[];
  geographies: string[];
  confidence_score: number;
  match_count: number;
  avg_deal_value: number;
  avg_sales_cycle: number;
  tam_estimate: number;
}

export interface PatternInsight {
  name: string;
  count: number;
  avg_value: number;
  avg_cycle: number;
}

export interface AnalysisResult {
  success: boolean;
  message?: string;
  analysis?: ClosedWonAnalysis;
  recommendations?: ICPRecommendation[];
  patterns?: {
    industries: PatternInsight[];
    sizes: { size: number; count: number; avg_value: number; avg_cycle: number }[];
    geographies: PatternInsight[];
  };
}

export function useClosedWonAnalysis() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const analyzeClosedWon = async (): Promise<AnalysisResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-closed-won');

      if (error) throw error;

      setAnalysis(data);

      if (data.success) {
        toast({
          title: "Analysis Complete",
          description: `Analyzed ${data.analysis.valid_deals} closed won deals to generate ICP recommendations`
        });
      } else {
        toast({
          title: "No Data Available",
          description: data.message || "Upload closed won deals first",
          variant: "destructive"
        });
      }

      return data;
    } catch (error) {
      console.error('Error analyzing closed won:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createICPFromRecommendation = async (recommendation: ICPRecommendation) => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('icp_profiles')
        .insert({
          org_id: profile.org_id,
          name: recommendation.name,
          description: recommendation.description,
          industries: recommendation.industries,
          company_sizes: recommendation.company_sizes,
          revenue_ranges: recommendation.revenue_ranges,
          geographies: recommendation.geographies,
          confidence_score: recommendation.confidence_score,
          match_count: recommendation.match_count,
          tam_estimate: recommendation.tam_estimate,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "ICP Created",
        description: `Created "${recommendation.name}" based on closed won analysis`
      });

      return data;
    } catch (error) {
      console.error('Error creating ICP:', error);
      toast({
        title: "Failed to Create ICP",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  };

  return {
    loading,
    analysis,
    analyzeClosedWon,
    createICPFromRecommendation
  };
}
