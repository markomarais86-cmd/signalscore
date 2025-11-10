import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Database, TrendingUp, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MarketOpportunityCardProps {
  crmAccounts: number;
  tamAccounts: number;
  crmLeads: number;
  tamLeads: number;
  provider: string;
  lastSyncedAt: string | null;
}

export function MarketOpportunityCard({
  crmAccounts,
  tamAccounts,
  crmLeads,
  tamLeads,
  provider,
  lastSyncedAt
}: MarketOpportunityCardProps) {
  const whitespaceAccounts = Math.max(0, tamAccounts - crmAccounts);
  const whitespaceLeads = Math.max(0, tamLeads - crmLeads);
  const coveragePercentage = tamAccounts > 0 ? (crmAccounts / tamAccounts) * 100 : 0;
  const leadsCoveragePercentage = tamLeads > 0 ? (crmLeads / tamLeads) * 100 : 0;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getCoverageColor = (percentage: number) => {
    if (percentage >= 50) return "text-[hsl(var(--signal-high))]";
    if (percentage >= 20) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 50) return "hsl(var(--signal-high))";
    if (percentage >= 20) return "hsl(var(--signal-medium))";
    return "hsl(var(--signal-low))";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Market Opportunity Analysis
        </CardTitle>
        <CardDescription>
          Your CRM coverage vs. total available market from {provider}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Accounts Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              Accounts Coverage
            </h4>
            <Badge variant="outline" className={getCoverageColor(coveragePercentage)}>
              {coveragePercentage.toFixed(1)}% Coverage
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your CRM Accounts</span>
              <span className="font-mono font-semibold">{formatNumber(crmAccounts)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{provider} TAM</span>
              <span className="font-mono font-semibold text-primary">{formatNumber(tamAccounts)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Whitespace Opportunity</span>
              <span className="font-mono font-bold text-[hsl(var(--chart-3))]">{formatNumber(whitespaceAccounts)}</span>
            </div>
          </div>

          <Progress 
            value={coveragePercentage} 
            className="h-2"
            style={{
              // @ts-ignore
              '--progress-background': getProgressColor(coveragePercentage)
            }}
          />
        </div>

        {/* Leads Section */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Leads Coverage
            </h4>
            <Badge variant="outline" className={getCoverageColor(leadsCoveragePercentage)}>
              {leadsCoveragePercentage.toFixed(1)}% Coverage
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your CRM Leads</span>
              <span className="font-mono font-semibold">{formatNumber(crmLeads)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{provider} Leads Available</span>
              <span className="font-mono font-semibold text-primary">{formatNumber(tamLeads)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Whitespace Opportunity</span>
              <span className="font-mono font-bold text-[hsl(var(--chart-3))]">{formatNumber(whitespaceLeads)}</span>
            </div>
          </div>

          <Progress 
            value={leadsCoveragePercentage} 
            className="h-2"
            style={{
              // @ts-ignore
              '--progress-background': getProgressColor(leadsCoveragePercentage)
            }}
          />
        </div>

        {/* Insights */}
        {coveragePercentage < 20 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your CRM covers less than 20% of the available market. Consider expanding your prospecting efforts.
            </AlertDescription>
          </Alert>
        )}

        {lastSyncedAt && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t">
            Last synced: {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
