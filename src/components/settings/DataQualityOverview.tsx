import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";

export function DataQualityOverview() {
  const { userProfile } = useAuth();

  const { data: qualityMetrics, isLoading } = useQuery({
    queryKey: ["data-quality", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("industry_norm, employee_count, revenue_range, country, tech_stack, total_raised_usd, domain")
        .eq("org_id", userProfile.org_id);

      if (error) throw error;

      const total = accounts.length;
      const withIndustry = accounts.filter(a => a.industry_norm).length;
      const withEmployeeCount = accounts.filter(a => a.employee_count).length;
      const withRevenue = accounts.filter(a => a.revenue_range).length;
      const withCountry = accounts.filter(a => a.country).length;
      const withTechStack = accounts.filter(a => a.tech_stack && a.tech_stack.length > 0).length;
      const withFunding = accounts.filter(a => a.total_raised_usd).length;
      const withDomain = accounts.filter(a => a.domain).length;

      return {
        total,
        coverage: {
          industry: (withIndustry / total) * 100,
          employeeCount: (withEmployeeCount / total) * 100,
          revenue: (withRevenue / total) * 100,
          country: (withCountry / total) * 100,
          techStack: (withTechStack / total) * 100,
          funding: (withFunding / total) * 100,
          domain: (withDomain / total) * 100,
        },
        overall: ((withIndustry + withEmployeeCount + withRevenue + withCountry) / (total * 4)) * 100
      };
    },
    enabled: !!userProfile?.org_id,
  });

  if (isLoading) {
    return <div>Loading data quality metrics...</div>;
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 80) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (percentage >= 50) return <TrendingUp className="h-4 w-4 text-yellow-600" />;
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  const lowCoverageFields = Object.entries(qualityMetrics?.coverage || {})
    .filter(([_, value]) => value < 50)
    .map(([key]) => key);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Overview</CardTitle>
          <CardDescription>
            Coverage metrics for critical account fields across {qualityMetrics?.total} accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Overall Completeness</span>
                {getStatusIcon(qualityMetrics?.overall || 0)}
              </div>
              <span className={`text-2xl font-bold ${getStatusColor(qualityMetrics?.overall || 0)}`}>
                {qualityMetrics?.overall.toFixed(1)}%
              </span>
            </div>
            <Progress value={qualityMetrics?.overall} className="h-3" />
          </div>

          <div className="mt-6 space-y-3">
            {Object.entries(qualityMetrics?.coverage || {}).map(([field, percentage]) => (
              <div key={field} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(percentage)}
                    <span className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                  <span className={`font-medium ${getStatusColor(percentage)}`}>
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {lowCoverageFields.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Low coverage detected:</strong> {lowCoverageFields.join(", ")} fields have less than 50% coverage.
            Enable the Data Enrichment Agent to automatically improve data quality.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
