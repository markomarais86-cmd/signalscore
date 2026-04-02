import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
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
      if (total === 0) return { totalAccounts: 0, accountsWithIndustry: 0, accountsWithRevenue: 0, accountsWithEmployees: 0, accountsWithContacts: 0, accountsEnriched: 0, overallScore: 0 };
      const withIndustry = accounts.filter(a => a.industry_norm).length;
      const withRevenue = accounts.filter(a => a.revenue_range).length;
      const withEmployees = accounts.filter(a => a.employee_count).length;
      const enriched = accounts.filter(a => a.enriched_at).length;
      const { count: contactsOnAccounts } = await supabase.from("Leads").select("id", { count: 'exact', head: true }).eq("org_id", orgId).not("account_external_id", "is", null);
      const withContacts = Math.min(contactsOnAccounts || 0, total);
      const scores = [withIndustry / total, withRevenue / total, withEmployees / total, withContacts / total, enriched / total];
      return { totalAccounts: total, accountsWithIndustry: withIndustry, accountsWithRevenue: withRevenue, accountsWithEmployees: withEmployees, accountsWithContacts: withContacts, accountsEnriched: enriched, overallScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="rounded-lg border bg-card p-4 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-1.5 w-full" /></div>;
  }

  if (!metrics || metrics.totalAccounts === 0) {
    return (
      <div className="rounded-lg border bg-card p-5 text-center">
        <p className="text-xs text-muted-foreground mb-2">No accounts to analyze</p>
        <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => navigate("/upload")}>Upload</Button>
      </div>
    );
  }

  const fields = [
    { label: "Industry", pct: Math.round((metrics.accountsWithIndustry / metrics.totalAccounts) * 100) },
    { label: "Revenue", pct: Math.round((metrics.accountsWithRevenue / metrics.totalAccounts) * 100) },
    { label: "Employees", pct: Math.round((metrics.accountsWithEmployees / metrics.totalAccounts) * 100) },
    { label: "Leads", pct: Math.round((metrics.accountsWithContacts / metrics.totalAccounts) * 100) },
  ];

  const lowest = fields.reduce((prev, curr) => curr.pct < prev.pct ? curr : prev);

  return (
    <div className="rounded-lg border bg-card">
      {/* Overall */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-xs text-muted-foreground">Overall</span>
        <span className="text-sm font-semibold font-mono tabular-nums text-foreground">{metrics.overallScore}%</span>
      </div>
      <div className="px-4 pt-1 pb-3">
        <Progress value={metrics.overallScore} className="h-1" />
      </div>

      {/* Fields */}
      <div className="divide-y divide-border">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-4 py-2">
            <span className="text-[11px] text-muted-foreground">{f.label}</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${f.pct}%` }} />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-foreground w-7 text-right">{f.pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      {lowest.pct < 70 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t">
          <span className="text-[11px] text-muted-foreground">{lowest.label} needs work</span>
          <Button variant="ghost" size="sm" className="h-5 text-[11px] gap-0.5 px-1.5" onClick={() => navigate("/enrichment")}>
            Enrich <ArrowRight className="h-2.5 w-2.5" />
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t text-[11px] text-muted-foreground">
        <span>{metrics.totalAccounts.toLocaleString()} accounts</span>
        <span className="font-mono tabular-nums">{metrics.accountsEnriched.toLocaleString()} enriched</span>
      </div>
    </div>
  );
}
