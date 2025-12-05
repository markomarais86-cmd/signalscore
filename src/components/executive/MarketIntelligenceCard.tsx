import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Database, Building2, Users, TrendingUp, Zap, Globe, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface MarketIntelligenceCardProps {
  totalAccounts: number;
  totalContacts: number;
  provider: string;
  industryBreakdown?: Record<string, number>;
  companySizeBreakdown?: Record<string, number>;
  revenueBreakdown?: Record<string, number>;
  geographyBreakdown?: Record<string, number>;
}

export function MarketIntelligenceCard({
  totalAccounts,
  totalContacts,
  provider,
  industryBreakdown,
  companySizeBreakdown,
  revenueBreakdown,
  geographyBreakdown,
}: MarketIntelligenceCardProps) {
  const navigate = useNavigate();

  // Process breakdowns into sorted arrays
  const topIndustries = industryBreakdown 
    ? Object.entries(industryBreakdown)
        .map(([name, count]) => ({ name, count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    : [];

  const topSizes = companySizeBreakdown
    ? Object.entries(companySizeBreakdown)
        .map(([name, count]) => ({ name, count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
    : [];

  const topCountries = geographyBreakdown
    ? Object.entries(geographyBreakdown)
        .map(([name, count]) => ({ name, count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
    : [];

  const industryTotal = topIndustries.reduce((sum, i) => sum + i.count, 0);
  const sizeTotal = topSizes.reduce((sum, s) => sum + s.count, 0);

  const getIndustryColor = (index: number) => {
    const colors = [
      "bg-primary",
      "bg-primary/80",
      "bg-primary/60",
      "bg-primary/40",
      "bg-primary/20",
    ];
    return colors[index] || "bg-muted";
  };

  const getSizeColor = (index: number) => {
    const colors = [
      "bg-chart-1",
      "bg-chart-2",
      "bg-chart-3",
      "bg-chart-4",
    ];
    return colors[index] || "bg-muted";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Market Intelligence
          <Badge variant="outline" className="ml-auto text-xs">
            via {provider}
          </Badge>
        </CardTitle>
        <CardDescription>
          Industry and company size distribution of your addressable market
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              Available Accounts
            </div>
            <div className="text-2xl font-bold text-primary">
              {totalAccounts.toLocaleString()}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Available Contacts
            </div>
            <div className="text-2xl font-bold">
              {totalContacts.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Industry Breakdown */}
        {topIndustries.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Top Industries
            </h4>
            <div className="space-y-2">
              {topIndustries.map((industry, index) => {
                const percentage = industryTotal > 0 
                  ? Math.round((industry.count / industryTotal) * 100) 
                  : 0;
                return (
                  <div key={industry.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[180px]">{industry.name}</span>
                      <span className="text-muted-foreground font-mono">
                        {industry.count.toLocaleString()} ({percentage}%)
                      </span>
                    </div>
                    <Progress 
                      value={percentage} 
                      className={cn("h-2", getIndustryColor(index))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Company Size Breakdown */}
        {topSizes.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Company Size Distribution
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {topSizes.map((size, index) => {
                const percentage = sizeTotal > 0 
                  ? Math.round((size.count / sizeTotal) * 100) 
                  : 0;
                return (
                  <div 
                    key={size.name} 
                    className={cn(
                      "p-3 rounded-lg border text-center",
                      index === 0 && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="text-xs text-muted-foreground truncate mb-1">
                      {size.name}
                    </div>
                    <div className="text-lg font-bold">
                      {size.count.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Countries */}
        {topCountries.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Top Markets
            </h4>
            <div className="flex flex-wrap gap-2">
              {topCountries.map((country) => (
                <Badge key={country.name} variant="secondary" className="font-normal">
                  {country.name}: {country.count.toLocaleString()}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="pt-2">
          <Button 
            onClick={() => navigate('/icp-manager?action=campaign')} 
            className="w-full"
            size="sm"
          >
            <Zap className="h-4 w-4 mr-2" />
            Build Campaign from Market Data
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Redeem contacts to score and add to your CRM
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
