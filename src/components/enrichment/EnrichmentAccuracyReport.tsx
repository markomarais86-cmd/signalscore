import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Database,
  Zap,
  Users,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface AccuracyMetric {
  provider: string;
  field: string;
  total_validations: number;
  accurate_count: number;
  accuracy_rate: number;
}

interface ProviderSummary {
  provider: string;
  total: number;
  accurate: number;
  accuracy: number;
  icon: React.ReactNode;
  color: string;
}

export function EnrichmentAccuracyReport() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("providers");

  const { data: validations, isLoading, refetch } = useQuery({
    queryKey: ['enrichment-validations', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      
      const { data, error } = await supabase
        .from('enrichment_validations')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .not('is_accurate', 'is', null)
        .order('validated_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userProfile?.org_id
  });

  // Calculate provider summaries
  const providerSummaries: ProviderSummary[] = (() => {
    if (!validations || validations.length === 0) return [];

    const byProvider: Record<string, { total: number; accurate: number }> = {};
    
    for (const v of validations) {
      if (!byProvider[v.provider]) {
        byProvider[v.provider] = { total: 0, accurate: 0 };
      }
      byProvider[v.provider].total++;
      if (v.is_accurate) byProvider[v.provider].accurate++;
    }

    const getProviderMeta = (provider: string) => {
      switch (provider) {
        case 'apollo': return { icon: <Zap className="h-4 w-4" />, color: 'text-blue-500' };
        case 'pdl': return { icon: <Users className="h-4 w-4" />, color: 'text-purple-500' };
        case 'launch_pulse': 
        case 'ai': return { icon: <Sparkles className="h-4 w-4" />, color: 'text-orange-500' };
        case 'internal': return { icon: <Database className="h-4 w-4" />, color: 'text-green-500' };
        default: return { icon: <BarChart3 className="h-4 w-4" />, color: 'text-muted-foreground' };
      }
    };

    return Object.entries(byProvider).map(([provider, stats]) => ({
      provider,
      total: stats.total,
      accurate: stats.accurate,
      accuracy: stats.total > 0 ? (stats.accurate / stats.total) * 100 : 0,
      ...getProviderMeta(provider)
    })).sort((a, b) => b.accuracy - a.accuracy);
  })();

  // Calculate field summaries
  const fieldSummaries = (() => {
    if (!validations || validations.length === 0) return [];

    const byField: Record<string, { total: number; accurate: number }> = {};
    
    for (const v of validations) {
      if (!byField[v.field_name]) {
        byField[v.field_name] = { total: 0, accurate: 0 };
      }
      byField[v.field_name].total++;
      if (v.is_accurate) byField[v.field_name].accurate++;
    }

    return Object.entries(byField).map(([field, stats]) => ({
      field,
      total: stats.total,
      accurate: stats.accurate,
      accuracy: stats.total > 0 ? (stats.accurate / stats.total) * 100 : 0
    })).sort((a, b) => b.accuracy - a.accuracy);
  })();

  // Overall accuracy
  const overallAccuracy = validations && validations.length > 0
    ? (validations.filter(v => v.is_accurate).length / validations.length) * 100
    : 0;

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-500';
    if (accuracy >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 90) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Excellent</Badge>;
    if (accuracy >= 70) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Good</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Needs Review</Badge>;
  };

  const fieldDisplayNames: Record<string, string> = {
    employee_count: 'Employee Count',
    revenue_range: 'Revenue Range',
    industry_norm: 'Industry',
    country: 'Country',
    linkedin_url: 'LinkedIn URL',
    founded_year: 'Founded Year',
    domain: 'Domain'
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Enrichment Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading accuracy data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!validations || validations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Enrichment Accuracy
          </CardTitle>
          <CardDescription>
            Track and validate the accuracy of your enrichment data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No validation data yet</p>
            <p className="text-xs mt-1">
              Start validating enriched data to track accuracy metrics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Enrichment Accuracy
            </CardTitle>
            <CardDescription>
              Based on {validations.length} validated records
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Accuracy */}
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Accuracy</span>
            {getAccuracyBadge(overallAccuracy)}
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-3xl font-bold ${getAccuracyColor(overallAccuracy)}`}>
              {overallAccuracy.toFixed(1)}%
            </span>
            <Progress value={overallAccuracy} className="flex-1 h-3" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              {validations.filter(v => v.is_accurate).length} accurate
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              {validations.filter(v => !v.is_accurate).length} inaccurate
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="providers">By Provider</TabsTrigger>
            <TabsTrigger value="fields">By Field</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-3 mt-4">
            {providerSummaries.map(summary => (
              <div key={summary.provider} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className={summary.color}>{summary.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{summary.provider}</span>
                    <span className={`text-sm font-bold ${getAccuracyColor(summary.accuracy)}`}>
                      {summary.accuracy.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={summary.accuracy} className="h-2" />
                  <div className="text-xs text-muted-foreground mt-1">
                    {summary.accurate} / {summary.total} validations
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="fields" className="space-y-3 mt-4">
            {fieldSummaries.map(summary => (
              <div key={summary.field} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {fieldDisplayNames[summary.field] || summary.field}
                    </span>
                    <span className={`text-sm font-bold ${getAccuracyColor(summary.accuracy)}`}>
                      {summary.accuracy.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={summary.accuracy} className="h-2" />
                  <div className="text-xs text-muted-foreground mt-1">
                    {summary.accurate} / {summary.total} validations
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {/* Insights */}
        {providerSummaries.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Insights</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {providerSummaries[0] && (
                <li>
                  • <span className="font-medium capitalize">{providerSummaries[0].provider}</span> has the highest accuracy at {providerSummaries[0].accuracy.toFixed(0)}%
                </li>
              )}
              {fieldSummaries.find(f => f.accuracy < 70) && (
                <li>
                  • <span className="font-medium">{fieldDisplayNames[fieldSummaries.find(f => f.accuracy < 70)!.field] || fieldSummaries.find(f => f.accuracy < 70)!.field}</span> field may need manual verification
                </li>
              )}
              {overallAccuracy >= 85 && (
                <li>• Your enrichment pipeline is performing well overall</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
