import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface WeeklyReportMetrics {
  total_accounts: number;
  accounts_scored_this_week: number;
  high_fit_scored: number;
  low_fit_scored: number;
  high_fit_change: number;
  new_leads_this_week: number;
  activities_this_week: number;
  signals_detected: number;
  critical_signals: number;
  high_signals: number;
  medium_signals: number;
}

export interface TopOpportunity {
  account_external_id: string;
  account_name: string;
  industry: string;
  employee_count?: number;
  score: number;
  band: string;
}

export interface AccountNeedingAttention {
  account_external_id: string;
  account_name: string;
  reason: string;
  signal_type: string;
  priority: string;
}

export interface WeeklyReport {
  generated_at: string;
  period_start: string;
  period_end: string;
  metrics: WeeklyReportMetrics;
  ai_summary: string;
  top_opportunities: TopOpportunity[];
  accounts_needing_attention: AccountNeedingAttention[];
  signal_breakdown: {
    critical: number;
    high: number;
    medium: number;
    total: number;
  };
}

export function useWeeklyReport() {
  const { userProfile } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    if (!userProfile?.org_id) {
      toast.error('Organization not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-weekly-report', {
        body: { org_id: userProfile.org_id }
      });

      if (fnError) throw fnError;

      setReport(data);
      toast.success('Weekly report generated');
    } catch (err: any) {
      console.error('Error generating weekly report:', err);
      setError(err.message || 'Failed to generate report');
      toast.error('Failed to generate weekly report');
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.org_id]);

  return {
    report,
    isLoading,
    error,
    generateReport,
    lastGenerated: report?.generated_at
  };
}