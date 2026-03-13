import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ScoreSnapshot } from "@/types/supabase-rpc";

interface ScoreChange {
  id: string;
  account_external_id: string;
  old_score: ScoreSnapshot | null;
  new_score: ScoreSnapshot;
  computed_at: string;
  change_reason: string | null;
}

export function useScoreHistory(accountExternalId: string | null) {
  const [history, setHistory] = useState<ScoreChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (userProfile?.org_id && accountExternalId) {
      loadHistory();
    }
  }, [userProfile?.org_id, accountExternalId]);

  const loadHistory = async () => {
    if (!userProfile?.org_id || !accountExternalId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('score_history')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('account_external_id', accountExternalId)
        .order('computed_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      setHistory((data || []).map(item => ({
        id: item.id,
        account_external_id: item.account_external_id,
        old_score: item.old_score as unknown as ScoreSnapshot | null,
        new_score: item.new_score as unknown as ScoreSnapshot,
        computed_at: item.computed_at,
        change_reason: item.change_reason
      })));
    } catch (err) {
      console.error('Error loading score history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load score history');
    } finally {
      setLoading(false);
    }
  };

  return {
    history,
    loading,
    error,
    refresh: loadHistory
  };
}
