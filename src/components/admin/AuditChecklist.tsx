import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Database, Trophy, Target, Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditChecklistProps {
  orgId: string;
}

interface ChecklistItem {
  label: string;
  icon: React.ElementType;
  done: boolean;
  count?: number;
  link?: string;
}

export function AuditChecklist({ orgId }: AuditChecklistProps) {
  // Resolve parent org for account queries
  const { data: orgInfo } = useQuery({
    queryKey: ["audit-org-info", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("parent_org_id, name")
        .eq("id", orgId)
        .single();
      return data;
    },
    enabled: !!orgId,
  });

  const dataOrgId = (orgInfo as any)?.parent_org_id || orgId;

  const { data: accountCount } = useQuery({
    queryKey: ["audit-accounts", dataOrgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", dataOrgId);
      return count || 0;
    },
    enabled: !!dataOrgId,
  });

  const { data: closedWonCount } = useQuery({
    queryKey: ["audit-closed-won", orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("closed_won_deals")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);
      return count || 0;
    },
    enabled: !!orgId,
  });

  const { data: icpCount } = useQuery({
    queryKey: ["audit-icps", orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("icp_profiles")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "active");
      return count || 0;
    },
    enabled: !!orgId,
  });

  const { data: scoreCount } = useQuery({
    queryKey: ["audit-scores", orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);
      return count || 0;
    },
    enabled: !!orgId,
  });

  const { data: reportExists } = useQuery({
    queryKey: ["audit-report", orgId],
    queryFn: async () => {
      // Check audit_logs for board report generation
      const { data } = await supabase
        .from("audit_logs")
        .select("id")
        .eq("org_id", orgId)
        .eq("action", "board_report_generated")
        .order("created_at", { ascending: false })
        .limit(1);
      return (data?.length || 0) > 0;
    },
    enabled: !!orgId,
  });

  const items: ChecklistItem[] = [
    {
      label: "Account Data Loaded",
      icon: Database,
      done: (accountCount || 0) > 0,
      count: accountCount || 0,
    },
    {
      label: "Closed-Won Deals Uploaded",
      icon: Trophy,
      done: (closedWonCount || 0) > 0,
      count: closedWonCount || 0,
    },
    {
      label: "ICP Defined",
      icon: Target,
      done: (icpCount || 0) > 0,
      count: icpCount || 0,
    },
    {
      label: "Accounts Scored",
      icon: Zap,
      done: (scoreCount || 0) > 0,
      count: scoreCount || 0,
    },
    {
      label: "Strategic Brief Generated",
      icon: FileText,
      done: !!reportExists,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Audit Readiness</CardTitle>
          <Badge variant={completedCount === totalCount ? "default" : "secondary"}>
            {completedCount}/{totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-3 text-sm",
                item.done ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{item.label}</span>
              {item.count !== undefined && (
                <span className="text-xs tabular-nums">
                  {item.count.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
