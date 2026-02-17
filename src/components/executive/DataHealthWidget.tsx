import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, CheckCircle, Database, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffectiveOrg } from "@/hooks/use-effective-org";

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
  const { effectiveOrgId } = useEffectiveOrg();
  const navigate = useNavigate();

  const orgId = effectiveOrgId;

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["data-health-metrics", orgId],
    queryFn: async (): Promise<DataHealthMetrics> => {
      if (!orgId) throw new Error("No organization found");

      // Get account stats in a single query
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

      // Get contacts count
      const { count: contactsOnAccounts } = await supabase
        .from("Leads")
        .select("id", { count: 'exact', head: true })
        .eq("org_id", orgId)
        .not("account_external_id", "is", null);

      const withContacts = Math.min(contactsOnAccounts || 0, total);

      // Calculate overall score (weighted average)
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
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Data Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalAccounts === 0) {
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Data Health
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No accounts to analyze
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/upload")}>
            Upload Data
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { variant: "default" as const, label: "Excellent", icon: CheckCircle };
    if (score >= 60) return { variant: "secondary" as const, label: "Good", icon: Activity };
    return { variant: "destructive" as const, label: "Needs Attention", icon: AlertTriangle };
  };

  const scoreBadge = getScoreBadge(metrics.overallScore);
  const ScoreIcon = scoreBadge.icon;

  const dataFields = [
    { label: "Industry", value: metrics.accountsWithIndustry, total: metrics.totalAccounts },
    { label: "Revenue", value: metrics.accountsWithRevenue, total: metrics.totalAccounts },
    { label: "Employees", value: metrics.accountsWithEmployees, total: metrics.totalAccounts },
    { label: "Leads", value: metrics.accountsWithContacts, total: metrics.totalAccounts },
  ];

  // Find the field with lowest completion
  const lowestField = dataFields.reduce((prev, curr) => 
    (curr.value / curr.total) < (prev.value / prev.total) ? curr : prev
  );
  const lowestPercent = Math.round((lowestField.value / lowestField.total) * 100);

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Data Health
          </CardTitle>
          <Badge variant={scoreBadge.variant} className="gap-1">
            <ScoreIcon className="h-3 w-3" />
            {scoreBadge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Overall Completeness</span>
          <span className={`text-2xl font-bold ${getScoreColor(metrics.overallScore)}`}>
            {metrics.overallScore}%
          </span>
        </div>
        <Progress value={metrics.overallScore} className="h-2" />

        {/* Field Breakdown */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {dataFields.map((field) => {
            const percent = Math.round((field.value / field.total) * 100);
            return (
              <div key={field.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className={getScoreColor(percent)}>{percent}%</span>
                </div>
                <Progress value={percent} className="h-1" />
              </div>
            );
          })}
        </div>

        {/* Quick Action */}
        {lowestPercent < 70 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              <span>{lowestField.label} data needs enrichment</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => navigate("/enrichment")}
            >
              Enrich
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Total Accounts */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{metrics.totalAccounts.toLocaleString()} accounts</span>
          </div>
          <span>{metrics.accountsEnriched.toLocaleString()} enriched</span>
        </div>
      </CardContent>
    </Card>
  );
}
