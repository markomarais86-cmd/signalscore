import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  orgId: string;
  config: Record<string, unknown> | null;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onActivate?: () => void;
}

export function OnboardingStepRouting({ orgId }: Props) {
  const navigate = useNavigate();

  const { data: rules, isLoading } = useQuery({
    queryKey: ["routing-rules", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_routing_rules")
        .select("*")
        .eq("org_id", orgId)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Routing Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure how leads are assigned to reps based on geography, company size, and industry.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading routing rules...</p>
      ) : rules && rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-sm text-muted-foreground">
                  Priority {rule.priority}
                </p>
              </div>
              <Badge variant={rule.is_active ? "default" : "secondary"}>
                {rule.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center border rounded-lg border-dashed">
          <p className="text-muted-foreground mb-4">No routing rules configured yet.</p>
        </div>
      )}

      <Button variant="outline" onClick={() => navigate("/settings")}>
        <ExternalLink className="h-4 w-4 mr-2" />
        Open Lead Routing Settings
      </Button>
    </div>
  );
}
