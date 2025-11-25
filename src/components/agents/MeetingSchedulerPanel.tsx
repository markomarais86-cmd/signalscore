import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function MeetingSchedulerPanel() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [minScore, setMinScore] = useState(70);

  const { data: agent } = useQuery({
    queryKey: ["meeting-scheduler-agent", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("agent_type", "meeting_scheduler")
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.org_id,
  });

  const { data: qualifiedLeads } = useQuery({
    queryKey: ["qualified-leads-for-meetings", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("Leads")
        .select("*, accounts!inner(icp_fit_score)")
        .eq("org_id", userProfile.org_id)
        .eq("status", "qualified")
        .gte("accounts.icp_fit_score", 70)
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.org_id,
  });

  const updateMinScore = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error("Agent not found");

      const { error } = await supabase
        .from("ai_agents")
        .update({ parameters: { ...(agent.parameters as any), min_lead_score: minScore } })
        .eq("id", agent.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-scheduler-agent"] });
      toast.success("Meeting scheduler settings updated");
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  const scheduleMeetings = useMutation({
    mutationFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");
      if (!agent) throw new Error("Agent not found");

      const { error } = await supabase.functions.invoke("agent-meeting-scheduler", {
        body: { agent_id: agent.id, org_id: userProfile.org_id },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualified-leads-for-meetings"] });
      toast.success("Meeting requests sent");
    },
    onError: (error) => {
      toast.error(`Failed to schedule meetings: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Meeting Scheduler Settings</CardTitle>
          <CardDescription>
            Configure automatic meeting request criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Minimum Lead Score</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Only send meeting requests to leads with accounts scoring above this threshold
            </p>
          </div>

          <Button
            onClick={() => updateMinScore.mutate()}
            disabled={updateMinScore.isPending}
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Qualified Leads for Meetings</CardTitle>
              <CardDescription>
                High-scoring leads ready for meeting requests
              </CardDescription>
            </div>
            <Button
              onClick={() => scheduleMeetings.mutate()}
              disabled={scheduleMeetings.isPending || !qualifiedLeads?.length}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Send Meeting Requests
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {qualifiedLeads?.map((lead: any) => (
              <div
                key={lead.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lead.title} at {lead.company}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="default">
                    Score: {lead.accounts?.icp_fit_score || "N/A"}
                  </Badge>
                  <Badge variant="outline">Qualified</Badge>
                </div>
              </div>
            ))}
            {!qualifiedLeads?.length && (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No qualified leads ready for meetings</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
