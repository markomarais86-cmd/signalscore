import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, Database, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataOrgId } from "@/hooks/use-data-org";

interface DataHealthMetrics {
  totalAccounts: number;
  accountsWithIndustry: number;
  accountsWithRevenue: number;
  accountsWithEmployees: number;
  accountsWithContacts: number;
  accountsEnriched: number;
  overallScore: number;
}

export function DataHealthWidget() {
  const { dataOrgId } = useDataOrgId();
  const navigate = useNavigate();
  const orgId = dataOrgId;

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["data-health-metrics", orgId],
    queryFn: async (): Promise<DataHealthMetrics> => {
      if (!orgId) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("accounts")
        .select("id, industry_norm, revenue_range, employee_count, enriched_at")
        .eq("org_id", orgId);

      if (error) throw error;

      const accounts = data || [];
      const total = accounts.length;

      if (total === 0) {
        return {
          totalAccounts: 0,
          accountsWithIndustry: 0,
          accountsWithRevenue: 0,
          accountsWithEmployees: 0,
          accountsWithContacts: 0,
          accountsEnriched: 0,
          overallScore: 0,
        };
      }

      const withIndustry = accounts.filter(a => a.industry_norm).length;
      const withRevenue = accounts.filter(a => a.revenue_range).length;
      const withEmployees = accounts.filter(a => a.employee_count).length;
      const enriched = accounts.filter(a => a.enriched_at).length;

      const { count: contactsOnAccounts } = await supabase
        .from("Leads")
        .select("id", { count: 'exact', head: true })
        .eq("org_id", orgId)
        .not("account_external_id", "is", null);

      const withContacts = Math.min(contactsOnAccounts || 0, total);

      const scores = [
        withIndustry / total,
        withRevenue / total,
        withEmployees / total,
        withContacts / total,
        enriched / total,
      ];
      const overallScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);

      return {
        totalAccounts: total,
        accountsWithIndustry: withIndustry,
        accountsWithRevenue: withRevenue,
        accountsWithEmployees: withEmployees,
        accountsWithContacts: withContacts,
        accountsEnriched: enriched,
        overallScore,
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border bg-card">
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalAccounts === 0) {
    return (
      <Card className="border bg-card">
        <CardContent className="text-center py-8 px-5">
          <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-3">No accounts to analyze</p>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/upload")}>
            Upload Data
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dataFields = [
    { label: "Industry", value: metrics.accountsWithIndustry, total: metrics.totalAccounts },
    { label: "Revenue", value: metrics.accountsWithRevenue, total: metrics.totalAccounts },
    { label: "Employees", value: metrics.accountsWithEmployees, total: metrics.totalAccounts },
    { label: "Leads", value: metrics.accountsWithContacts, total: metrics.totalAccounts },
  ];

  const lowestField = dataFields.reduce((prev, curr) =>
    (curr.value / curr.total) < (prev.value / prev.total) ? curr : prev
  );
  const lowestPercent = Math.round((lowestField.value / lowestField.total) * 100);

  return (
    <Card className="border bg-card">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Data Health</span>
          </div>
          <span className="text-lg font-semibold font-mono text-foreground tabular-nums">{metrics.overallScore}%</span>
        </div>
        <Progress value={metrics.overallScore} className="h-1.5" />

        {/* Field Breakdown */}
        <div className="grid grid-cols-2 gap-2.5">
          {dataFields.map((field) => {
            const percent = Math.round((field.value / field.total) * 100);
            return (
              <div key={field.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="font-mono text-foreground tabular-nums">{percent}%</span>
                </div>
                <Progress value={percent} className="h-1" />
              </div>
            );
          })}
        </div>

        {/* Quick Action */}
        {lowestPercent < 70 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>{lowestField.label} needs enrichment</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] gap-1 px-2"
              onClick={() => navigate("/enrichment")}
            >
              Enrich
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{metrics.totalAccounts.toLocaleString()} accounts</span>
          </div>
          <span className="font-mono tabular-nums">{metrics.accountsEnriched.toLocaleString()} enriched</span>
        </div>
      </CardContent>
    </Card>
  );
}
