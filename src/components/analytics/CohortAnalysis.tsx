import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCohortData } from '@/hooks/use-cohort-data';
import { Users, TrendingUp, DollarSign, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function CohortAnalysis() {
  const { metrics, isLoading } = useCohortData();

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!metrics || metrics.cohorts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No cohort data available</h3>
          <p className="text-muted-foreground text-center">
            Cohort analysis requires historical account and deal data
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg LTV</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.avgLtv.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime value per account
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Retention</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.avgRetention.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Conversion to closed-won
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Cohort</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(metrics.topCohort).toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric' 
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Highest performing cohort
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cohorts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cohorts.length}</div>
            <p className="text-xs text-muted-foreground">
              Monthly cohorts tracked
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cohort Performance</CardTitle>
          <CardDescription>Monthly cohorts sorted by most recent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.cohorts.slice(0, 12).map((cohort) => (
              <div
                key={cohort.cohortMonth}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {new Date(cohort.cohortMonth).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {cohort.accountCount} accounts
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant={cohort.conversionRate > 10 ? 'default' : 'secondary'}>
                    {cohort.conversionRate.toFixed(1)}% conversion
                  </Badge>
                  <p className="text-sm font-medium">
                    ${cohort.ltv.toLocaleString()} LTV
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
