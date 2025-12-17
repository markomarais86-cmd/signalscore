import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  BarChart3, 
  RefreshCw,
  Building,
  TrendingUp,
  Save,
  RotateCcw,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBenchmarks } from "@/hooks/use-benchmarks";
import { Skeleton } from "@/components/ui/skeleton";

const PIPELINE_STAGES = [
  { key: 'dial', label: 'Dial', description: 'Initial outreach baseline' },
  { key: 'connect', label: 'Connect', description: 'Dial to connect rate' },
  { key: 'meeting', label: 'Meeting', description: 'Connect to meeting rate' },
  { key: 'opportunity', label: 'Opportunity', description: 'Meeting to opportunity rate' },
  { key: 'closed_won', label: 'Closed Won', description: 'Opportunity to close rate' },
];

const CAPITAL_METRICS = [
  { key: 'pipeline_multiplier', label: 'Pipeline Multiplier', description: 'Target: 3x+ investment', unit: 'x' },
  { key: 'revenue_multiplier', label: 'Revenue Multiplier', description: 'Target: 2x+ investment', unit: 'x' },
  { key: 'cac_payback_months', label: 'CAC Payback', description: 'Months to recover CAC', unit: 'months' },
];

export default function BenchmarkSettings() {
  const { toast } = useToast();
  const { 
    benchmarks, 
    pipelineBenchmarks, 
    capitalBenchmarks,
    isLoading, 
    isPending,
    hasCustomBenchmarks,
    updateBenchmark,
    seedDefaults,
    refetch 
  } = useBenchmarks();

  const [editingPipeline, setEditingPipeline] = useState<Record<string, string>>({});
  const [editingCapital, setEditingCapital] = useState<Record<string, string>>({});

  const handlePipelineChange = (stage: string, value: string) => {
    setEditingPipeline(prev => ({ ...prev, [stage]: value }));
  };

  const handleCapitalChange = (metric: string, value: string) => {
    setEditingCapital(prev => ({ ...prev, [metric]: value }));
  };

  const savePipelineBenchmark = async (stage: string) => {
    const value = parseFloat(editingPipeline[stage]);
    if (isNaN(value) || value < 0 || value > 100) {
      toast({ title: 'Invalid value', description: 'Please enter a number between 0 and 100', variant: 'destructive' });
      return;
    }

    try {
      await updateBenchmark.mutateAsync({ stage, value, metricType: 'pipeline_conversion' });
      setEditingPipeline(prev => {
        const { [stage]: _, ...rest } = prev;
        return rest;
      });
      toast({ title: 'Benchmark updated', description: `${stage} benchmark set to ${value}%` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update benchmark', variant: 'destructive' });
    }
  };

  const saveCapitalBenchmark = async (metric: string) => {
    const value = parseFloat(editingCapital[metric]);
    if (isNaN(value) || value < 0) {
      toast({ title: 'Invalid value', description: 'Please enter a valid positive number', variant: 'destructive' });
      return;
    }

    try {
      await updateBenchmark.mutateAsync({ stage: metric, value, metricType: 'capital_efficiency' });
      setEditingCapital(prev => {
        const { [metric]: _, ...rest } = prev;
        return rest;
      });
      toast({ title: 'Benchmark updated', description: `${metric} benchmark updated` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update benchmark', variant: 'destructive' });
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedDefaults.mutateAsync();
      toast({ title: 'Defaults loaded', description: 'Industry-standard benchmarks have been set' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load default benchmarks', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Benchmark Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure benchmark targets for performance comparison
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {!hasCustomBenchmarks && (
            <Button onClick={handleSeedDefaults} disabled={seedDefaults.isPending}>
              {seedDefaults.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Load Defaults
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge variant={hasCustomBenchmarks ? "default" : "secondary"}>
          {hasCustomBenchmarks ? 'Custom Benchmarks Active' : 'Using Default Benchmarks'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {benchmarks.length} benchmark{benchmarks.length !== 1 ? 's' : ''} configured
        </span>
      </div>

      {/* Pipeline Conversion Benchmarks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Pipeline Conversion Benchmarks</CardTitle>
              <CardDescription>Target conversion rates for each pipeline stage</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PIPELINE_STAGES.map((stage) => {
              const currentValue = pipelineBenchmarks[stage.key] || 0;
              const isEditing = stage.key in editingPipeline;
              const editValue = editingPipeline[stage.key] ?? currentValue.toString();

              return (
                <div key={stage.key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stage.label}</span>
                      <Badge variant="outline" className="text-xs">{currentValue}%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={editValue}
                        onChange={(e) => handlePipelineChange(stage.key, e.target.value)}
                        className="text-right"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">%</span>
                    {isEditing && editValue !== currentValue.toString() && (
                      <Button 
                        size="sm" 
                        onClick={() => savePipelineBenchmark(stage.key)}
                        disabled={updateBenchmark.isPending}
                      >
                        {updateBenchmark.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Capital Efficiency Benchmarks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Capital Efficiency Benchmarks</CardTitle>
              <CardDescription>Target metrics for investment ROI</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {CAPITAL_METRICS.map((metric) => {
              const currentValue = capitalBenchmarks[metric.key] || 0;
              const isEditing = metric.key in editingCapital;
              const editValue = editingCapital[metric.key] ?? currentValue.toString();

              return (
                <div key={metric.key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{metric.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {currentValue}{metric.unit === 'x' ? 'x' : ` ${metric.unit}`}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => handleCapitalChange(metric.key, e.target.value)}
                        className="text-right"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-16">{metric.unit}</span>
                    {isEditing && editValue !== currentValue.toString() && (
                      <Button 
                        size="sm" 
                        onClick={() => saveCapitalBenchmark(metric.key)}
                        disabled={updateBenchmark.isPending}
                      >
                        {updateBenchmark.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Benchmark Preview</CardTitle>
              <CardDescription>How your targets compare to industry standards</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Pipeline Conversion</h4>
              <div className="space-y-2 text-sm">
                {PIPELINE_STAGES.slice(1).map((stage) => (
                  <div key={stage.key} className="flex justify-between">
                    <span className="text-muted-foreground">{stage.label}</span>
                    <span className="font-medium">{pipelineBenchmarks[stage.key] || 0}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Capital Efficiency</h4>
              <div className="space-y-2 text-sm">
                {CAPITAL_METRICS.map((metric) => (
                  <div key={metric.key} className="flex justify-between">
                    <span className="text-muted-foreground">{metric.label}</span>
                    <span className="font-medium">
                      {capitalBenchmarks[metric.key] || 0}{metric.unit === 'x' ? 'x' : ` ${metric.unit}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
