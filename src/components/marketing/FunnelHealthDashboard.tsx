import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, CheckCircle, XCircle, Phone, Send, Calendar, AlertTriangle } from "lucide-react";

interface FunnelMetric {
  event_type: string;
  total: number;
  successes: number;
  failures: number;
  rate: number;
}

export function FunnelHealthDashboard() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["funnel-health", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      // Get events from last 7 days
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("funnel_events" as any)
        .select("event_type, event_status, event_source")
        .eq("org_id", orgId)
        .gte("created_at", since);

      if (error) {
        console.error("Error fetching funnel events:", error);
        return [];
      }

      // Aggregate by event_type
      const byType = new Map<string, { total: number; successes: number; failures: number }>();
      for (const row of (data || []) as any[]) {
        const key = row.event_type;
        if (!byType.has(key)) byType.set(key, { total: 0, successes: 0, failures: 0 });
        const m = byType.get(key)!;
        m.total++;
        if (row.event_status === "success") m.successes++;
        if (row.event_status === "failure") m.failures++;
      }

      const result: FunnelMetric[] = [];
      for (const [event_type, counts] of byType) {
        result.push({
          event_type,
          ...counts,
          rate: counts.total > 0 ? Math.round((counts.successes / counts.total) * 100) : 0,
        });
      }

      return result;
    },
    enabled: !!orgId,
    refetchInterval: 60000,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "phone_verification": return Phone;
      case "conversion_push": return Send;
      case "calendly_booking": return Calendar;
      case "webhook_failure": return AlertTriangle;
      default: return Activity;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case "phone_verification": return "Phone Verification";
      case "conversion_push": return "Conversion Events";
      case "calendly_booking": return "Calendly Bookings";
      case "enrichment": return "Enrichment";
      case "webhook_failure": return "Webhook Failures";
      default: return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 90) return "text-green-500";
    if (rate >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return "[&>div]:bg-green-500";
    if (rate >= 70) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-red-500";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Funnel Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading metrics...</div>
        </CardContent>
      </Card>
    );
  }

  const allMetrics = metrics || [];
  const overallSuccesses = allMetrics.reduce((s, m) => s + m.successes, 0);
  const overallTotal = allMetrics.reduce((s, m) => s + m.total, 0);
  const overallRate = overallTotal > 0 ? Math.round((overallSuccesses / overallTotal) * 100) : 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Funnel Health
          </CardTitle>
          <Badge variant={overallRate >= 90 ? "default" : overallRate >= 70 ? "secondary" : "destructive"}>
            {overallRate}% healthy
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Last 7 days</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {allMetrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No funnel events recorded yet. Events will appear once phone verifications, conversion pushes, or Calendly bookings start flowing.</p>
        ) : (
          allMetrics.map((m) => {
            const Icon = getIcon(m.event_type);
            return (
              <div key={m.event_type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{getLabel(m.event_type)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      {m.successes}
                    </span>
                    {m.failures > 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <XCircle className="h-3 w-3 text-red-500" />
                        {m.failures}
                      </span>
                    )}
                    <span className={`font-semibold ${getStatusColor(m.rate)}`}>
                      {m.rate}%
                    </span>
                  </div>
                </div>
                <Progress value={m.rate} className={`h-1.5 ${getProgressColor(m.rate)}`} />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
