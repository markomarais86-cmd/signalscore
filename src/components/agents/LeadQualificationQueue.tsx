import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot } from "lucide-react";
import { LaunchPulseMark } from '@/components/BrandLogo';
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function LeadQualificationQueue() {
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["unqualified-leads", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error} = await supabase
        .from("Leads")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.org_id,
  });

  const qualifyLeads = useMutation({
    mutationFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      // Find the lead qualification agent
      const { data: agent } = await supabase
        .from("ai_agents")
        .select("id")
        .eq("org_id", userProfile.org_id)
        .eq("agent_type", "lead_qualification")
        .single();

      if (!agent) throw new Error("Lead qualification agent not found");

      // Invoke the agent
      const { error } = await supabase.functions.invoke("agent-lead-qualification", {
        body: { agent_id: agent.id, org_id: userProfile.org_id },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unqualified-leads"] });
      toast.success("Lead qualification started");
      setSelectedLeads([]);
    },
    onError: (error) => {
      toast.error(`Failed to qualify leads: ${error.message}`);
    },
  });

  const toggleLead = (leadId: number) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const selectAll = () => {
    if (selectedLeads.length === leads?.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads?.map((l) => l.id) || []);
    }
  };

  if (isLoading) {
    return <div>Loading leads...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lead Qualification Queue</CardTitle>
            <CardDescription>
              {leads?.length || 0} unqualified leads waiting for AI review
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={selectAll} size="sm">
              {selectedLeads.length === leads?.length ? "Deselect All" : "Select All"}
            </Button>
            <Button
              onClick={() => qualifyLeads.mutate()}
              disabled={qualifyLeads.isPending || !leads?.length}
              className="gap-2"
            >
              <Bot className="h-4 w-4" />
              AI Qualify Leads
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leads?.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-4 border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={selectedLeads.includes(lead.id)}
                onCheckedChange={() => toggleLead(lead.id)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">
                    {lead.first_name} {lead.last_name}
                  </p>
                  {!lead.account_external_id && (
                    <Badge variant="outline" className="text-xs">
                      No Account
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{lead.title} at {lead.company}</p>
                <p className="text-xs text-muted-foreground">{lead.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Added {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
          {!leads?.length && (
            <div className="text-center py-12">
              <LaunchPulseMark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">All leads have been qualified!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
