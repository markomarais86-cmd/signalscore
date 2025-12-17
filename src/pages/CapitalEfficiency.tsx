import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCapitalData } from "@/hooks/use-capital-data";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { DollarSign, TrendingUp, Target, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function CapitalEfficiency() {
  const { metrics, isLoading, isPending, error } = useCapitalData();

  if (isLoading) return <LoadingState message="Loading capital efficiency data..." fullScreen />;

  if (error) {
    return (
      <Layout>
        <div className="p-8">
          <EmptyState
            title="Error Loading Capital Data"
            description={error}
          />
        </div>
      </Layout>
    );
  }

  if (!metrics || metrics.totalInvestment === 0) {
    return (
      <Layout>
        <div className="p-8">
          <EmptyState
            title="No Capital Tracking Data Yet"
            description="Add investment and pipeline data to see ROI metrics and capital efficiency analysis."
          />
        </div>
      </Layout>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMultiplierColor = (value: number) => {
    if (value >= 3) return "text-primary";
    if (value >= 2) return "text-chart-3";
    return "text-destructive";
  };

  const getMultiplierStatus = (value: number) => {
    if (value >= 3) return "Excellent";
    if (value >= 2) return "Good";
    if (value >= 1) return "Fair";
    return "Poor";
  };

  return (
    <Layout>
      <div className={cn("p-8 space-y-8", isPending && "opacity-70 transition-opacity")}>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Capital Efficiency</h1>
          <p className="text-muted-foreground mt-2">
            Track investment ROI and pipeline multipliers to optimize spend
          </p>
        </div>

        {/* Investment Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Investment</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalInvestment)}</div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Sales</span>
                  <span>{formatCurrency(metrics.salesInvestment)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Marketing</span>
                  <span>{formatCurrency(metrics.marketingInvestment)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.pipelineValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total opportunity value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue Generated</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.revenueGenerated)}</div>
              <p className="text-xs text-muted-foreground mt-1">Closed won revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Multiplier Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Multiplier</CardTitle>
              <CardDescription>
                Investment to pipeline value ratio (Target: 3x+)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold ${getMultiplierColor(metrics.pipelineMultiplier)}`}>
                  {metrics.pipelineMultiplier.toFixed(1)}x
                </span>
                <span className="text-muted-foreground text-lg">
                  {getMultiplierStatus(metrics.pipelineMultiplier)}
                </span>
              </div>
              <Progress 
                value={Math.min((metrics.pipelineMultiplier / 5) * 100, 100)} 
                className="h-3"
              />
              <div className="text-sm text-muted-foreground">
                For every $1 invested, you're generating ${metrics.pipelineMultiplier.toFixed(2)} in pipeline value
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Multiplier</CardTitle>
              <CardDescription>
                Investment to revenue ratio (Target: 2x+)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold ${getMultiplierColor(metrics.revenueMultiplier)}`}>
                  {metrics.revenueMultiplier.toFixed(1)}x
                </span>
                <span className="text-muted-foreground text-lg">
                  {getMultiplierStatus(metrics.revenueMultiplier)}
                </span>
              </div>
              <Progress 
                value={Math.min((metrics.revenueMultiplier / 5) * 100, 100)} 
                className="h-3"
              />
              <div className="text-sm text-muted-foreground">
                For every $1 invested, you're generating ${metrics.revenueMultiplier.toFixed(2)} in closed revenue
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer Acquisition Cost (CAC)</CardTitle>
              <CardDescription>Average cost to acquire a customer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-3xl font-bold">{formatCurrency(metrics.cac)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Per customer</p>
                </div>
                <Zap className="h-12 w-12 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Return on Ad Spend (ROAS)</CardTitle>
              <CardDescription>Revenue generated per dollar spent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-3xl font-bold">
                    {metrics.roas > 0 ? `${metrics.roas.toFixed(1)}x` : "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Revenue per $ spent</p>
                </div>
                <TrendingUp className="h-12 w-12 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Benchmarks */}
        <Card>
          <CardHeader>
            <CardTitle>Industry Benchmarks</CardTitle>
            <CardDescription>Compare your metrics against industry standards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">Pipeline Multiplier</div>
                  <div className="text-sm text-muted-foreground">Your: {metrics.pipelineMultiplier.toFixed(1)}x</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">3.0x - 5.0x</div>
                  <div className="text-sm text-muted-foreground">Industry Range</div>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">Revenue Multiplier</div>
                  <div className="text-sm text-muted-foreground">Your: {metrics.revenueMultiplier.toFixed(1)}x</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">2.0x - 4.0x</div>
                  <div className="text-sm text-muted-foreground">Industry Range</div>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">CAC Payback</div>
                  <div className="text-sm text-muted-foreground">Time to recover CAC</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">12-18 months</div>
                  <div className="text-sm text-muted-foreground">Target Range</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
