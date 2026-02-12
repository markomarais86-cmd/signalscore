import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Save } from "lucide-react";

interface Props {
  orgId: string;
  config: Record<string, unknown> | null;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onActivate?: () => void;
}

export function OnboardingStepTeam({ orgId }: Props) {
  const queryClient = useQueryClient();

  const { data: reps, isLoading } = useQuery({
    queryKey: ["org-reps", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("org_id", orgId);
      if (error) throw error;
      return data;
    },
  });

  const updateRep = useMutation({
    mutationFn: async (rep: { user_id: string; territory: string[]; max_leads_per_day: number; calendly_url: string }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          territory: rep.territory,
          max_leads_per_day: rep.max_leads_per_day,
          calendly_url: rep.calendly_url,
        })
        .eq("user_id", rep.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-reps", orgId] });
      toast.success("Rep updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading team...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Sales Team</h2>
        <p className="text-sm text-muted-foreground">Configure territories, capacity, and booking links for each rep</p>
      </div>

      {!reps || reps.length === 0 ? (
        <div className="p-6 text-center border rounded-lg border-dashed">
          <p className="text-muted-foreground">No team members found for this organization.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reps.map((rep) => (
            <RepEditor key={rep.user_id} rep={rep} onSave={(v) => updateRep.mutateAsync(v)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RepEditor({ rep, onSave }: { rep: Record<string, unknown>; onSave: (v: { user_id: string; territory: string[]; max_leads_per_day: number; calendly_url: string }) => Promise<void> }) {
  const [territory, setTerritory] = useState(((rep.territory as string[]) || []).join(", "));
  const [maxLeads, setMaxLeads] = useState((rep.max_leads_per_day as number) || 20);
  const [calendly, setCalendly] = useState((rep.calendly_url as string) || "");

  return (
    <div className="p-4 border rounded-lg bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{(rep.full_name as string) || (rep.email as string) || "Unknown"}</p>
          <p className="text-sm text-muted-foreground">{rep.email as string}</p>
        </div>
        <Badge variant="secondary">{(rep.role as string) || "user"}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Territories (comma-separated)</Label>
          <Input value={territory} onChange={(e) => setTerritory(e.target.value)} placeholder="US, EMEA" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max Leads/Day</Label>
          <Input type="number" value={maxLeads} onChange={(e) => setMaxLeads(parseInt(e.target.value) || 20)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Calendly URL</Label>
          <Input value={calendly} onChange={(e) => setCalendly(e.target.value)} placeholder="https://calendly.com/..." />
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onSave({
            user_id: rep.user_id as string,
            territory: territory.split(",").map((t) => t.trim()).filter(Boolean),
            max_leads_per_day: maxLeads,
            calendly_url: calendly,
          })
        }
      >
        <Save className="h-3 w-3 mr-1" />
        Save
      </Button>
    </div>
  );
}
