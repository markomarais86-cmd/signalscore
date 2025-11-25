import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Building2, Users, Target, DollarSign, Database } from "lucide-react";
import { formatCurrency, formatAbbreviated } from "@/utils/format-numbers";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { calculateExternalTAMMetrics } from "@/utils/external-tam-calculator";

interface ICPProfile {
  industries?: string[];
  geographies?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
}

interface UnifiedTAMCardProps {
  // Internal CRM data
  crmAccounts: number;
  crmContacts: number;
  scoredAccounts: number;
  highFitAccounts: number;
  averageDealSize?: number;
  
  // External TAM data (Apollo, ZoomInfo, etc.)
  externalAccounts?: number;
  externalContacts?: number;
  externalProvider?: string;
  externalGeography?: Record<string, { percentage: number; accounts: number }>;
  externalIndustry?: Record<string, { percentage: number; accounts: number }>;
  externalCompanySize?: Record<string, { percentage: number; accounts: number }>;
  externalRevenue?: Record<string, { percentage: number; accounts: number }>;
  
  // ICP Profile for SAM calculation
  icpProfile?: ICPProfile | null;
}

export function UnifiedTAMCard({
  crmAccounts,
  crmContacts,
  scoredAccounts,
  highFitAccounts,
  averageDealSize = 75000,
  externalAccounts = 0,
  externalContacts = 0,
  externalProvider = 'Apollo',
  externalGeography = {},
  externalIndustry = {},
  externalCompanySize = {},
  externalRevenue = {},
  icpProfile = null
}: UnifiedTAMCardProps) {
  // Calculate Internal TAM (from CRM scored accounts)
  const internalTAM = scoredAccounts * averageDealSize;
  
  // Calculate External TAM (from external database)
  const externalTAM = externalAccounts * averageDealSize;
  
  // Calculate SAM and SOM using ICP-based filtering
  let samAccounts = 0;
  let somAccounts = 0;
  
  if (icpProfile && externalAccounts > 0) {
    // Transform the data to match the calculator's expected format
    const transformBreakdown = (
      breakdown: Record<string, { percentage: number; accounts: number }>
    ): Record<string, { accounts: number; contacts: number }> => {
      const transformed: Record<string, { accounts: number; contacts: number }> = {};
      Object.entries(breakdown).forEach(([key, value]) => {
        // Estimate contacts based on average of 5 contacts per account
        transformed[key] = {
          accounts: value.accounts,
          contacts: Math.round(value.accounts * 5)
        };
      });
      return transformed;
    };
    
    const tamData = {
      totalAccounts: externalAccounts,
      totalLeads: externalContacts,
      provider: externalProvider,
      industry_breakdown: transformBreakdown(externalIndustry),
      geography_breakdown: transformBreakdown(externalGeography),
      company_size_breakdown: transformBreakdown(externalCompanySize || {}),
      revenue_breakdown: transformBreakdown(externalRevenue || {})
    };
    
    const { sam, som } = calculateExternalTAMMetrics(tamData, icpProfile, 0.15, 12);
    samAccounts = sam;
    somAccounts = som;
  } else {
    // Fallback to conservative estimates if no ICP or external data
    samAccounts = Math.round(externalAccounts * 0.30);
    somAccounts = Math.round(samAccounts * 0.05);
  }
  
  const samValue = samAccounts * averageDealSize;
  const somValue = somAccounts * averageDealSize;
  
  // Market penetration %
  const penetration = externalAccounts > 0 ? (crmAccounts / externalAccounts) * 100 : 0;
  
  // Top geographies and industries
  const topCountries = Object.entries(externalGeography)
    .sort((a, b) => b[1].percentage - a[1].percentage)
    .slice(0, 3);
  
  const topIndustries = Object.entries(externalIndustry)
    .sort((a, b) => b[1].percentage - a[1].percentage)
    .slice(0, 3);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-2 p-3 lg:p-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base lg:text-lg font-medium text-muted-foreground leading-tight">
              Total Addressable Market
            </CardTitle>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl 2xl:text-4xl font-bold text-primary leading-tight">
                {formatCurrency(externalTAM || internalTAM)}
              </span>
              {externalProvider && (
                <Badge variant="outline" className="text-xs">
                  via {externalProvider}
                </Badge>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 lg:p-3">
            <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 lg:space-y-4 p-3 lg:p-4 pt-0">
        {/* TAM/SAM/SOM Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2 bg-muted/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">TAM (Total)</span>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">{formatCurrency(externalTAM || internalTAM)}</div>
            <div className="text-xs text-muted-foreground">
              {formatAbbreviated(externalAccounts || scoredAccounts)} accounts
            </div>
          </div>

          <div className="space-y-2 bg-primary/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">SAM (Addressable)</span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl font-bold text-primary">{formatCurrency(samValue)}</div>
            <div className="text-xs text-muted-foreground">
              {formatAbbreviated(samAccounts)} ICP-matching
            </div>
          </div>

          <div className="space-y-2 bg-executive-green/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">SOM (12mo Target)</span>
              <DollarSign className="h-4 w-4 text-executive-green" />
            </div>
            <div className="text-xl font-bold text-executive-green">{formatCurrency(somValue)}</div>
            <div className="text-xs text-muted-foreground">
              {formatAbbreviated(somAccounts)} accounts
            </div>
          </div>
        </div>

        {/* CRM vs External Data Comparison */}
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <h4 className="text-sm font-semibold">Market Coverage</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your CRM Database</span>
              <span className="font-medium">{formatAbbreviated(crmAccounts)} accounts</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Market ({externalProvider})</span>
              <span className="font-medium">{formatAbbreviated(externalAccounts)} accounts</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Market Penetration</span>
              <span className="font-medium">{penetration.toFixed(1)}%</span>
            </div>
            <Progress value={penetration} className="h-2" />
          </div>
        </div>

        {/* Top Geographies */}
        {topCountries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Markets</h4>
            <div className="grid grid-cols-3 gap-2">
              {topCountries.map(([country, data]) => (
                <div key={country} className="rounded-lg border bg-card p-2 space-y-1">
                  <div className="text-xs text-muted-foreground truncate">{country}</div>
                  <div className="text-lg font-bold">{data.percentage}%</div>
                  <div className="text-xs text-muted-foreground">
                    {formatAbbreviated(data.accounts)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Industries */}
        {topIndustries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Industries</h4>
            <div className="space-y-1">
              {topIndustries.map(([industry, data]) => (
                <div key={industry} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[200px]">{industry}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={data.percentage} className="h-2 w-20" />
                    <span className="font-medium w-12 text-right">{data.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intelligence Summary */}
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <h4 className="text-sm font-semibold">Market Intelligence</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• TAM: {formatCurrency(externalTAM)} at {formatCurrency(averageDealSize)} ACV</li>
            <li>• SAM: {formatAbbreviated(samAccounts)} ICP-matching accounts {icpProfile ? '(based on ICP criteria)' : '(~30% estimate)'}</li>
            <li>• SOM: Target {formatAbbreviated(somAccounts)} accounts in next 12 months (15% conversion rate)</li>
            <li>• Current penetration: {penetration.toFixed(1)}% of total market</li>
            {highFitAccounts > 0 && (
              <li>• {formatAbbreviated(highFitAccounts)} high-fit accounts identified in your CRM</li>
            )}
            {!icpProfile && externalAccounts > 0 && (
              <li className="text-amber-600">⚠ Create an ICP profile for accurate SAM/SOM calculations</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
