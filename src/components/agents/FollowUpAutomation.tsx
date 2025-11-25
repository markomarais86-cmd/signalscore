import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function FollowUpAutomation() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [delayDays, setDelayDays] = useState(3);

  const { data: agent } = useQuery({
    queryKey: ["follow-up-agent", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("agent_type", "follow_up")
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.org_id,
  });

  const { data: followUpLeads } = useQuery({
    queryKey: ["follow-up-leads", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("Leads")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("status", "contacted")
        .order("updated_at", { ascending: true })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.org_id,
  });

  const updateAgentConfig = useMutation({
    mutationFn: async (params: any) => {
      if (!agent) throw new Error("Agent not found");

      const { error } = await supabase
        .from("ai_agents")
        .update({ parameters: { ...(agent.parameters as any), ...params } })
        .eq("id", agent.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-agent"] });
      toast.success("Follow-up settings updated");
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  const runFollowUp = useMutation({
    mutationFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");
      if (!agent) throw new Error("Agent not found");

      const { error } = await supabase.functions.invoke("agent-follow-up", {
        body: { agent_id: agent.id, org_id: userProfile.org_id },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-leads"] });
      toast.success("Follow-up sequence triggered");
    },
    onError: (error) => {
      toast.error(`Failed to trigger follow-up: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Follow-Up Automation Settings</CardTitle>
          <CardDescription>
            Configure automatic follow-up timing and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Follow-up Delay (Days)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={delayDays}
              onChange={(e) => setDelayDays(parseInt(e.target.value))}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Automatically follow up with leads after this many days of no response
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Automatic Follow-ups</Label>
              <p className="text-xs text-muted-foreground">
                Agent will run on schedule and trigger follow-ups
              </p>
            </div>
            <Switch
              checked={agent?.status === "active"}
              onCheckedChange={(enabled) =>
                updateAgentConfig.mutate({ status: enabled ? "active" : "paused" })
              }
            />
          </div>

          <Button
            onClick={() => updateAgentConfig.mutate({ sequence_delay_days: delayDays })}
            disabled={updateAgentConfig.isPending}
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Follow-Up Queue</CardTitle>
              <CardDescription>
                Leads ready for automated follow-up
              </CardDescription>
            </div>
            <Button
              onClick={() => runFollowUp.mutate()}
              disabled={runFollowUp.isPending || !followUpLeads?.length}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Trigger Follow-Ups Now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {followUpLeads?.slice(0, 10).map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lead.title} at {lead.company}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Contacted</Badge>
              </div>
            ))}
            {!followUpLeads?.length && (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No leads ready for follow-up</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
