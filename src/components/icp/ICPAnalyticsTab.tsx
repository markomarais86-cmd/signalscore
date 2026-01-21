import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useICPAnalytics } from '@/hooks/use-icp-analytics';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Target, 
  Users, 
  CheckCircle2,
  XCircle,
  BarChart3,
  Zap
} from 'lucide-react';
import { formatNumber } from '@/utils/format-numbers';

interface ICPAnalyticsTabProps {
  icpId: string;
  icpName: string;
}

export function ICPAnalyticsTab({ icpId, icpName }: ICPAnalyticsTabProps) {
  const { analytics, isLoading, error } = useICPAnalytics({ icpId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error loading analytics: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {analytics.winRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.wonDeals} won / {analytics.wonDeals + analytics.lostDeals} closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(analytics.avgDealSize)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {analytics.wonDeals} closed-won deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sales Cycle</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.avgSalesCycleDays)} days
            </div>
            <p className="text-xs text-muted-foreground">
              Average time to close
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(analytics.totalPipeline)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalDeals - analytics.wonDeals - analytics.lostDeals} open deals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deal Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Deal Performance
          </CardTitle>
          <CardDescription>Win/Loss breakdown for {icpName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 min-w-[120px]">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Won</span>
              </div>
              <Progress 
                value={(analytics.wonDeals / Math.max(analytics.totalDeals, 1)) * 100} 
                className="flex-1 [&>div]:bg-green-500" 
              />
              <Badge variant="secondary">{analytics.wonDeals}</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 min-w-[120px]">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Lost</span>
              </div>
              <Progress 
                value={(analytics.lostDeals / Math.max(analytics.totalDeals, 1)) * 100} 
                className="flex-1 [&>div]:bg-destructive" 
              />
              <Badge variant="secondary">{analytics.lostDeals}</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 min-w-[120px]">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Open</span>
              </div>
              <Progress 
                value={((analytics.totalDeals - analytics.wonDeals - analytics.lostDeals) / Math.max(analytics.totalDeals, 1)) * 100} 
                className="flex-1 [&>div]:bg-yellow-500" 
              />
              <Badge variant="secondary">
                {analytics.totalDeals - analytics.wonDeals - analytics.lostDeals}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coverage Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Enrichment Coverage
            </CardTitle>
            <CardDescription>Data completeness for matched accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Accounts Enriched</span>
                <span className="font-medium">{analytics.enrichmentCoverage.toFixed(1)}%</span>
              </div>
              <Progress value={analytics.enrichmentCoverage} />
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.enrichedAccounts} of {analytics.totalMatchedAccounts} accounts
              </p>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Has Contacts</span>
                <span className="font-medium">{analytics.contactCoverage.toFixed(1)}%</span>
              </div>
              <Progress value={analytics.contactCoverage} />
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.accountsWithContacts} of {analytics.totalMatchedAccounts} accounts
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Activity Summary
            </CardTitle>
            <CardDescription>Engagement with matched accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Matched Accounts</span>
                <Badge variant="outline">{formatNumber(analytics.totalMatchedAccounts)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Accounts Contacted</span>
                <Badge variant="outline">{formatNumber(analytics.accountsContacted)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Pipeline Velocity</span>
                <Badge variant="outline">
                  ${formatNumber(analytics.pipelineVelocity)}/day
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
