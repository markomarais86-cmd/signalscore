import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, Building2, Users, DollarSign, MapPin } from "lucide-react";

interface DataCompletenessCardProps {
  orgId: string;
}

interface CompletenessMetrics {
  totalAccounts: number;
  enrichedAccounts: number;
  withEmployeeCount: number;
  withRevenue: number;
  withIndustry: number;
  withGeography: number;
  overallCompleteness: number;
}

export function DataCompletenessCard({ orgId }: DataCompletenessCardProps) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["data-completeness", orgId],
    queryFn: async (): Promise<CompletenessMetrics> => {
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("employee_count, revenue_range, industry_norm, country, enriched_at")
        .eq("org_id", orgId);

      if (error) throw error;

      const total = accounts?.length || 0;
      const enriched = accounts?.filter(a => a.enriched_at).length || 0;
      const withEmployeeCount = accounts?.filter(a => a.employee_count).length || 0;
      const withRevenue = accounts?.filter(a => a.revenue_range).length || 0;
      const withIndustry = accounts?.filter(a => a.industry_norm).length || 0;
      const withGeography = accounts?.filter(a => a.country).length || 0;

      // Calculate overall completeness as average of key fields
      const completeness = total > 0 
        ? Math.round(((withEmployeeCount + withRevenue + withIndustry + withGeography) / (total * 4)) * 100)
        : 0;

      return {
        totalAccounts: total,
        enrichedAccounts: enriched,
        withEmployeeCount,
        withRevenue,
        withIndustry,
        withGeography,
        overallCompleteness: completeness,
      };
    },
    enabled: !!orgId,
    staleTime: 30000,
  });

  if (isLoading || !metrics) {
    return null;
  }

  const fields = [
    { 
      icon: Users, 
      label: "Company Size", 
      count: metrics.withEmployeeCount, 
      total: metrics.totalAccounts 
    },
    { 
      icon: DollarSign, 
      label: "Revenue", 
      count: metrics.withRevenue, 
      total: metrics.totalAccounts 
    },
    { 
      icon: Building2, 
      label: "Industry", 
      count: metrics.withIndustry, 
      total: metrics.totalAccounts 
    },
    { 
      icon: MapPin, 
      label: "Geography", 
      count: metrics.withGeography, 
      total: metrics.totalAccounts 
    },
  ];

  const enrichedPercent = metrics.totalAccounts > 0 
    ? Math.round((metrics.enrichedAccounts / metrics.totalAccounts) * 100) 
    : 0;

  return (
    <div className="p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Data Completeness</span>
        </div>
        <Badge variant="secondary">
          {metrics.overallCompleteness}% complete
        </Badge>
      </div>
      
      {/* Overall Enrichment Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{metrics.enrichedAccounts.toLocaleString()} of {metrics.totalAccounts.toLocaleString()} accounts enriched</span>
          <span>{enrichedPercent}%</span>
        </div>
        <Progress value={enrichedPercent} className="h-2" />
      </div>

      {/* Field Breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {fields.map((field) => {
          const percent = field.total > 0 ? Math.round((field.count / field.total) * 100) : 0;
          return (
            <div key={field.label} className="flex items-center gap-2 text-xs">
              <field.icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{field.label}</span>
              <span className="ml-auto font-medium">{percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
