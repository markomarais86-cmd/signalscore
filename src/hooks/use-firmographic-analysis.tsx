import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FirmographicPattern {
  name: string;
  count: number;
  percentage: number;
}

export interface CompanySizePattern {
  size: string;
  count: number;
  percentage: number;
}

export interface FirmographicAnalysis {
  total_accounts: number;
  industries: FirmographicPattern[];
  sub_industries: FirmographicPattern[];
  company_sizes: CompanySizePattern[];
  revenue_ranges: FirmographicPattern[];
  geographies: FirmographicPattern[];
}

export interface AnalysisResult {
  success: boolean;
  message?: string;
  analysis?: FirmographicAnalysis;
}

export function useFirmographicAnalysis() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const analyzeFirmographics = async (): Promise<AnalysisResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-firmographics');

      if (error) throw error;

      setAnalysis(data);

      if (data.success) {
        toast({
          title: "Analysis Complete",
          description: `Analyzed ${data.analysis.total_accounts} accounts to identify firmographic patterns`
        });
      } else {
        toast({
          title: "No Data Available",
          description: data.message || "Upload account data first",
          variant: "destructive"
        });
      }

      return data;
    } catch (error) {
      console.error('Error analyzing firmographics:', error);
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

  const createICPFromAnalysis = async (
    name: string,
    selectedIndustries: string[],
    selectedSizes: string[],
    selectedRevenues: string[],
    selectedGeographies: string[],
    selectedSubIndustries: string[]
  ) => {
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
          name,
          description: `ICP created from firmographic analysis of ${analysis?.analysis?.total_accounts || 0} accounts`,
          industries: selectedIndustries,
          sub_industries: selectedSubIndustries,
          company_sizes: selectedSizes.map(convertSizeToNumber),
          revenue_ranges: selectedRevenues,
          geographies: selectedGeographies,
          status: 'active',
          confidence_score: 75,
          match_count: analysis?.analysis?.total_accounts || 0
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "ICP Created",
        description: `Created "${name}" from your firmographic data`
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
    analyzeFirmographics,
    createICPFromAnalysis
  };
}

function convertSizeToNumber(sizeRange: string): number {
  const sizeMap: Record<string, number> = {
    '1-49': 25,
    '50-199': 125,
    '200-499': 350,
    '500-999': 750,
    '1000-4999': 2500,
    '5000+': 7500
  };
  return sizeMap[sizeRange] || 100;
}
