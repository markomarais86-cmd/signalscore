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
  const color = pct >= 80 ? "bg-primary" : pct >= 50 ? "bg-executive-amber" : "bg-destructive";
  return (
    <div className="flex items-center justify-between px-4 py-2.5 group hover:bg-muted/5 transition-colors rounded-sm">
      <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      <div className="flex items-center gap-2.5">
        <div className="w-20 h-1.5 rounded-full bg-border/50 overflow-hidden">
          <div
            className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-mono tabular-nums text-foreground w-8 text-right font-medium">{pct}%</span>
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
    return <div className="p-4 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-1.5 w-full" /></div>;
  }

  if (!metrics || metrics.totalAccounts === 0) {
    return (
      <div className="p-5 text-center">
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
  const scoreColor = metrics.overallScore >= 80 ? "text-primary" : metrics.overallScore >= 50 ? "text-executive-amber" : "text-destructive";

  return (
    <div>
      {/* Overall score — hero style */}
      <div className="px-4 py-4 text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Health Score</p>
        <p className={`text-3xl font-bold font-mono tabular-nums ${scoreColor}`}>{metrics.overallScore}%</p>
      </div>

      {/* Fields */}
      <div className="space-y-0">
        {fields.map((f) => (
          <HealthBar key={f.label} label={f.label} pct={f.pct} />
        ))}
      </div>

      {/* Action */}
      {lowest.pct < 70 && (
        <div className="flex items-center justify-between px-4 py-2.5 mt-1">
          <span className="text-[11px] text-muted-foreground">{lowest.label} needs attention</span>
          <Button variant="ghost" size="sm" className="h-5 text-[11px] gap-0.5 px-1.5 text-primary hover:text-primary" onClick={() => navigate("/enrichment")}>
            Enrich <ArrowRight className="h-2.5 w-2.5" />
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t text-[11px] text-muted-foreground">
        <span>{metrics.totalAccounts.toLocaleString()} accounts</span>
        <span className="font-mono tabular-nums">{metrics.accountsEnriched.toLocaleString()} enriched</span>
      </div>
    </div>
  );
}
