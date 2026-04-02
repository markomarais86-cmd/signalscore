import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

function HealthBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 80 ? "bg-primary" : pct >= 50 ? "bg-status-warning" : "bg-destructive";
  return (
    <div className="group grid grid-cols-[1fr_auto] items-center gap-4 rounded-[0.95rem] px-4 py-3 transition-colors hover:bg-muted/10">
      <div>
        <span className="text-[14px] font-medium text-foreground transition-colors group-hover:text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-border/50">
          <div
            className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-9 text-right text-[13px] font-medium text-foreground tabular-nums">{pct}%</span>
      </div>
    </div>
  );
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
    return <div className="space-y-2 p-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-1.5 w-full" /></div>;
  }

  if (!metrics || metrics.totalAccounts === 0) {
    return (
      <div className="p-5 text-center">
        <p className="mb-2 text-sm text-muted-foreground">No accounts to analyze</p>
        <Button variant="outline" size="sm" className="h-7 text-[12px]" onClick={() => navigate("/upload")}>Upload</Button>
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
  const scoreColor = metrics.overallScore >= 80 ? "text-primary" : metrics.overallScore >= 50 ? "text-status-warning" : "text-destructive";

  return (
    <div className="space-y-4 px-5 pb-5 pt-2">
      <div className="metric-panel">
        <p className="metric-panel__label">Health score</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <p className={`font-heading text-[3rem] font-semibold tracking-[-0.08em] tabular-nums ${scoreColor}`}>{metrics.overallScore}%</p>
          <div className="text-right">
            <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Weakest field</p>
            <p className="mt-1 font-heading text-[1.15rem] font-semibold tracking-[-0.04em] text-foreground">{lowest.label}</p>
          </div>
        </div>
        <p className="metric-panel__hint">{metrics.totalAccounts.toLocaleString()} accounts profiled across core enrichment fields</p>
      </div>

      <div className="space-y-2">
        {fields.map((f) => (
          <HealthBar key={f.label} label={f.label} pct={f.pct} />
        ))}
      </div>

      {lowest.pct < 70 && (
        <div className="flex items-center justify-between rounded-[0.95rem] border border-border/70 bg-background/35 px-4 py-3">
          <span className="text-[12px] text-muted-foreground">{lowest.label} needs attention</span>
          <Button variant="ghost" size="sm" className="h-7 gap-0.5 rounded-full px-2 text-[12px] text-primary hover:text-primary" onClick={() => navigate("/enrichment")}>
            Enrich <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between px-1 text-[12px] text-muted-foreground">
        <span>{metrics.totalAccounts.toLocaleString()} accounts</span>
        <span className="tabular-nums">{metrics.accountsEnriched.toLocaleString()} enriched</span>
      </div>
    </div>
  );
}
