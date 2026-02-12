import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  orgId: string;
  config: Record<string, unknown> | null;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onActivate?: () => void;
}

const PLATFORMS = ["google", "meta", "linkedin", "tiktok"] as const;

export function OnboardingStepCampaigns({ orgId }: Props) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ campaign_name: "", platform: "google", monthly_budget_cents: 0 });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaign-configs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_campaign_config")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("org_campaign_config").insert({
        org_id: orgId,
        campaign_name: newCampaign.campaign_name,
        platform: newCampaign.platform,
        monthly_budget_cents: newCampaign.monthly_budget_cents,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-configs", orgId] });
      setShowAdd(false);
      setNewCampaign({ campaign_name: "", platform: "google", monthly_budget_cents: 0 });
      toast.success("Campaign added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_campaign_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-configs", orgId] });
      toast.success("Campaign removed");
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Campaign Setup</h2>
        <p className="text-sm text-muted-foreground">Manage ad campaigns you run on behalf of this customer</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-3">
          {campaigns?.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div>
                <p className="font-medium">{c.campaign_name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.platform} · ${((c.monthly_budget_cents || 0) / 100).toLocaleString()}/mo
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                <Button variant="ghost" size="icon" onClick={() => deleteCampaign.mutate(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="p-4 border rounded-lg space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Campaign Name</Label>
              <Input value={newCampaign.campaign_name} onChange={(e) => setNewCampaign({ ...newCampaign, campaign_name: e.target.value })} placeholder="Q1 Search" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select value={newCampaign.platform} onValueChange={(v) => setNewCampaign({ ...newCampaign, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monthly Budget ($)</Label>
              <Input type="number" value={newCampaign.monthly_budget_cents / 100} onChange={(e) => setNewCampaign({ ...newCampaign, monthly_budget_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addCampaign.mutate()}>Add Campaign</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Campaign
        </Button>
      )}
    </div>
  );
}
