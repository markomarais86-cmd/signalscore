import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { toast } from "sonner";

export interface AutomationRule {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  signal_type: string;
  fuel_line_type: string;
  sequence_template: string;
  min_signals: number;
  min_accounts: number;
  priority_filter: string[];
  cooldown_hours: number;
  is_enabled: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationLogEntry {
  id: string;
  org_id: string;
  rule_id: string | null;
  rule_name: string;
  signal_type: string;
  fuel_line_type: string;
  signal_count: number;
  account_count: number;
  campaign_name: string | null;
  status: string;
  created_at: string;
}

export function useAutomationRules() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["automation-rules", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_automation_rules")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    },
    enabled: !!orgId,
  });

  const logQuery = useQuery({
    queryKey: ["automation-log", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_automation_log")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AutomationLogEntry[];
    },
    enabled: !!orgId,
  });

  const createRule = useMutation({
    mutationFn: async (rule: Partial<AutomationRule>) => {
      const { data, error } = await supabase
        .from("campaign_automation_rules")
        .insert({
          name: rule.name || "",
          signal_type: rule.signal_type || "intent",
          fuel_line_type: rule.fuel_line_type || "abm",
          sequence_template: rule.sequence_template || "enterprise",
          min_signals: rule.min_signals ?? 3,
          min_accounts: rule.min_accounts ?? 2,
          priority_filter: rule.priority_filter || ["high", "critical"],
          cooldown_hours: rule.cooldown_hours ?? 72,
          description: rule.description || null,
          org_id: orgId!,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Automation rule created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomationRule> & { id: string }) => {
      const { error } = await supabase
        .from("campaign_automation_rules")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Rule updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaign_automation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Rule deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("campaign_automation_rules")
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    rules: rulesQuery.data || [],
    log: logQuery.data || [],
    isLoading: rulesQuery.isLoading,
    isLogLoading: logQuery.isLoading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}
