import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Rocket } from "lucide-react";

interface Props {
  orgId: string;
  config: Record<string, unknown> | null;
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onActivate: () => void;
}

export function OnboardingStepReview({ orgId, config, onActivate }: Props) {
  const { data: icpCount } = useQuery({
    queryKey: ["icp-count", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("icp_profiles")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: repCount } = useQuery({
    queryKey: ["rep-count", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: campaignCount } = useQuery({
    queryKey: ["campaign-count", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("org_campaign_config")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: routingCount } = useQuery({
    queryKey: ["routing-count", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lead_routing_rules")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) throw error;
      return count || 0;
    },
  });

  const checks = [
    { label: "Company profile", ok: !!(config?.company_name && config?.value_proposition) },
    { label: "ICP configured", ok: (icpCount || 0) > 0 },
    { label: "Sales reps added", ok: (repCount || 0) > 0 },
    { label: "Routing rules set", ok: (routingCount || 0) > 0 },
    { label: "Campaigns configured", ok: (campaignCount || 0) > 0 },
  ];

  const allReady = checks.every((c) => c.ok);
  const isAlreadyActive = config?.onboarding_status === "active";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Review & Launch</h2>
        <p className="text-sm text-muted-foreground">Verify everything is configured before activating the demand engine</p>
      </div>

      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            {check.ok ? (
              <Check className="h-5 w-5 text-primary" />
            ) : (
              <X className="h-5 w-5 text-destructive" />
            )}
            <span className="font-medium">{check.label}</span>
            <Badge variant={check.ok ? "default" : "destructive"} className="ml-auto">
              {check.ok ? "Ready" : "Missing"}
            </Badge>
          </div>
        ))}
      </div>

      {isAlreadyActive ? (
        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 text-center">
          <p className="text-primary font-semibold">✅ This customer is already active</p>
          <p className="text-sm text-muted-foreground">Launched {config?.launched_at ? new Date(config.launched_at as string).toLocaleDateString() : ""}</p>
        </div>
      ) : (
        <Button
          size="lg"
          onClick={onActivate}
          disabled={!allReady}
          className="w-full"
        >
          <Rocket className="h-5 w-5 mr-2" />
          {allReady ? "Activate Demand Engine" : "Complete all steps first"}
        </Button>
      )}
    </div>
  );
}
