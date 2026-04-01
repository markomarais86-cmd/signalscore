import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MapPin, Building, TrendingUp, Loader2, ChevronRight, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'react-router-dom';

interface WhitespaceMetrics {
  tamAccounts: number;
  crmAccounts: number;
  whitespaceAccounts: number;
  whitespacePercentage: number;
  whitespaceValue: number;
  topWhitespaceIndustries: Array<{ industry: string; count: number }>;
}

interface WhitespaceMappingCardProps {
  icpId?: string;
  icpName?: string;
  tamEstimate?: number;
  compact?: boolean;
}

const AVG_DEAL_SIZE = 75000;

export function WhitespaceMappingCard({ icpId, icpName, tamEstimate, compact = false }: WhitespaceMappingCardProps) {
  const { userProfile: profile } = useAuth();
  const [metrics, setMetrics] = useState<WhitespaceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.org_id) {
      loadWhitespaceMetrics();
    }
  }, [profile?.org_id, icpId, tamEstimate]);

  async function loadWhitespaceMetrics() {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      // Get CRM accounts count (accounts in our database)
      const crmQuery = supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id);

      const { count: crmCount } = await crmQuery;
      const crmAccounts = crmCount || 0;

      // If we have a TAM estimate (from discovery), calculate whitespace
      // Otherwise, estimate based on industry data
      let tamAccounts = tamEstimate || 0;
      
      if (!tamEstimate) {
        // Fallback: estimate TAM as 3x CRM accounts (industry benchmark)
        tamAccounts = crmAccounts * 3;
      }

      const whitespaceAccounts = Math.max(0, tamAccounts - crmAccounts);
      const whitespacePercentage = tamAccounts > 0 ? (whitespaceAccounts / tamAccounts) * 100 : 0;
      const whitespaceValue = whitespaceAccounts * AVG_DEAL_SIZE;

      // Get top industries for whitespace analysis
      const { data: industryData } = await supabase
        .from('accounts')
        .select('industry_norm')
        .eq('org_id', profile.org_id)
        .not('industry_norm', 'is', null)
        .limit(1000);

      const industryCounts = new Map<string, number>();
      industryData?.forEach(a => {
        if (a.industry_norm) {
          industryCounts.set(a.industry_norm, (industryCounts.get(a.industry_norm) || 0) + 1);
        }
      });

      const topIndustries = Array.from(industryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([industry, count]) => ({ industry, count }));

      setMetrics({
        tamAccounts,
        crmAccounts,
        whitespaceAccounts,
        whitespacePercentage,
        whitespaceValue,
        topWhitespaceIndustries: topIndustries
      });
    } catch (error) {
      console.error('Error loading whitespace metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  if (compact) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-purple-500" />
            Whitespace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {metrics.whitespaceAccounts.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                accounts not in your CRM
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Opportunity</span>
              <span className="font-medium text-purple-600 dark:text-purple-400">
                {formatCurrency(metrics.whitespaceValue)}
              </span>
            </div>
            <Progress 
              value={100 - metrics.whitespacePercentage} 
              className="h-2 [&>div]:bg-purple-500" 
            />
            <div className="text-xs text-muted-foreground">
              {(100 - metrics.whitespacePercentage).toFixed(0)}% market coverage
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Whitespace Mapping
          {icpName && <Badge variant="outline" className="ml-2">{icpName}</Badge>}
        </CardTitle>
        <CardDescription>
          Identify untapped market opportunities in your TAM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="text-2xl font-bold">{metrics.tamAccounts.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">TAM Accounts</div>
            <div className="text-xs text-muted-foreground mt-1">
              {tamEstimate ? 'From discovery' : 'Estimated'}
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-[hsl(var(--signal-high))]">
              {metrics.crmAccounts.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">In Your CRM</div>
            <div className="text-xs text-muted-foreground mt-1">
              {(100 - metrics.whitespacePercentage).toFixed(0)}% coverage
            </div>
          </div>
          <div className="p-4 bg-purple-500/10 rounded-lg text-center border border-purple-500/20">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {metrics.whitespaceAccounts.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Whitespace</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.whitespacePercentage.toFixed(0)}% untapped
            </div>
          </div>
        </div>

        {/* Whitespace Value */}
        <div className="p-4 bg-gradient-to-r from-purple-500/10 to-purple-500/5 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-sm text-muted-foreground">Whitespace Opportunity</div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(metrics.whitespaceValue)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Based on</div>
              <div className="text-sm font-medium">${AVG_DEAL_SIZE.toLocaleString()} avg deal</div>
            </div>
          </div>
        </div>

        {/* Coverage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Market Coverage</span>
            <span className="font-medium">{(100 - metrics.whitespacePercentage).toFixed(0)}%</span>
          </div>
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-[hsl(var(--signal-high))] transition-all"
              style={{ width: `${100 - metrics.whitespacePercentage}%` }}
            />
            <div 
              className="absolute right-0 top-0 h-full bg-purple-500 transition-all"
              style={{ width: `${metrics.whitespacePercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--signal-high))]"/>
              In CRM ({metrics.crmAccounts.toLocaleString()})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Whitespace ({metrics.whitespaceAccounts.toLocaleString()})
            </span>
          </div>
        </div>

        {/* Top Industries */}
        {metrics.topWhitespaceIndustries.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Top Industries in Your CRM</div>
            <div className="space-y-2">
              {metrics.topWhitespaceIndustries.map((ind, i) => (
                <div key={ind.industry} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{ind.industry}</span>
                  </div>
                  <Badge variant="outline">{ind.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        <div className="pt-2 border-t">
          <Button variant="outline" className="w-full" asChild>
            <Link to={icpId ? `/icp/${icpId}?tab=discover` : '/discovery'}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Discover New Accounts
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
