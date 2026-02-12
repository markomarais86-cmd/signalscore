import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export interface RoutingRule {
  id: string;
  org_id: string;
  name: string;
  priority: number;
  conditions: Record<string, any>;
  assigned_to: string | null;
  sla_minutes: number;
  auto_tasks: Array<{ type: string; title: string; due_offset_minutes: number; description?: string }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useRoutingRules() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["routing_rules", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      const { data, error } = await supabase
        .from("lead_routing_rules")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data || []) as RoutingRule[];
    },
    enabled: !!userProfile?.org_id,
  });

  const createRule = useMutation({
    mutationFn: async (rule: Omit<RoutingRule, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("lead_routing_rules").insert(rule);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
      toast({ title: "Routing rule created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RoutingRule> }) => {
      const { error } = await supabase
        .from("lead_routing_rules")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
      toast({ title: "Rule updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_routing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("lead_routing_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return {
    rules: rulesQuery.data || [],
    isLoading: rulesQuery.isLoading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}
