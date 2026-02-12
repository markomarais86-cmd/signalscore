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

export function OnboardingStepICP({ orgId }: Props) {
  const navigate = useNavigate();

  const { data: icpProfiles, isLoading } = useQuery({
    queryKey: ["icp-profiles", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("icp_profiles")
        .select("*")
        .eq("org_id", orgId);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">ICP Setup</h2>
        <p className="text-sm text-muted-foreground">
          Define the Ideal Customer Profile for ad targeting and lead scoring. This uses the existing ICP Manager.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading ICP profiles...</p>
      ) : icpProfiles && icpProfiles.length > 0 ? (
        <div className="space-y-3">
          {icpProfiles.map((icp) => (
            <div key={icp.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div>
                <p className="font-medium">{icp.name}</p>
                <p className="text-sm text-muted-foreground">{icp.description || "No description"}</p>
              </div>
              <Badge variant="default">
                v{icp.version}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center border rounded-lg border-dashed">
          <p className="text-muted-foreground mb-4">No ICP profiles configured for this organization yet.</p>
        </div>
      )}

      <Button variant="outline" onClick={() => navigate("/icp-manager")}>
        <ExternalLink className="h-4 w-4 mr-2" />
        Open ICP Manager
      </Button>
    </div>
  );
}
