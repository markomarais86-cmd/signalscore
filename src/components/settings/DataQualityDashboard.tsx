import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, TrendingUp, Database, Sparkles, Users, Loader2 } from 'lucide-react';

interface DataQualityMetrics {
  totalAccounts: number;
  withPrimaryIndustry: number;
  withSubIndustry: number;
  withEmployeeCount: number;
  withRevenue: number;
  withCountry: number;
  standardizedIndustries: number;
  overallCompleteness: number;
}

export function DataQualityDashboard() {
  const { userProfile } = useAuth();
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStandardizing, setIsStandardizing] = useState(false);
  const [isEnrichingPersonas, setIsEnrichingPersonas] = useState(false);
  const [isEnrichingContacts, setIsEnrichingContacts] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, [userProfile?.org_id]);

  const loadMetrics = async () => {
    if (!userProfile?.org_id) return;

    try {
      setIsLoading(true);

      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('industry_norm, industry_raw, employee_count, revenue_range, country')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      const total = accounts?.length || 0;
      const withPrimary = accounts?.filter(a => a.industry_norm).length || 0;
      const withSub = accounts?.filter(a => a.industry_raw).length || 0;
      const withEmp = accounts?.filter(a => a.employee_count).length || 0;
      const withRev = accounts?.filter(a => a.revenue_range).length || 0;
      const withCountry = accounts?.filter(a => a.country).length || 0;

      // Check how many are using ZoomInfo taxonomy (this is a placeholder - would need actual check)
      const standardized = withPrimary; // For now, assume normalized = standardized

      const completeness = total > 0 
        ? ((withPrimary + withSub + withEmp + withRev + withCountry) / (total * 5)) * 100 
        : 0;

      setMetrics({
        totalAccounts: total,
        withPrimaryIndustry: withPrimary,
        withSubIndustry: withSub,
        withEmployeeCount: withEmp,
        withRevenue: withRev,
        withCountry: withCountry,
        standardizedIndustries: standardized,
        overallCompleteness: Math.round(completeness)
      });
    } catch (error) {
      console.error('Error loading data quality metrics:', error);
      toast.error('Failed to load data quality metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStandardizeAll = async () => {
    if (!userProfile?.org_id) return;

    setIsStandardizing(true);
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('external_id, industry_raw')
        .eq('org_id', userProfile.org_id)
        .not('industry_raw', 'is', null)
        .is('industry_norm', null);

      if (!accounts || accounts.length === 0) {
        toast.success('All industries are already standardized!');
        return;
      }

      let standardized = 0;
      for (const account of accounts) {
        const { data, error } = await supabase.functions.invoke('map-industry-to-zoominfo', {
          body: { industry: account.industry_raw }
        });

        if (!error && data?.primary_industry) {
          await supabase
            .from('accounts')
            .update({ 
              industry_norm: data.primary_industry,
              sub_industry: data.sub_industry 
            })
            .eq('external_id', account.external_id);
          
          standardized++;
        }
      }

      toast.success(`Standardized ${standardized} industries using ZoomInfo taxonomy`);
      await loadMetrics();
    } catch (error: any) {
      console.error('Error standardizing industries:', error);
      toast.error(error.message || 'Failed to start standardization');
    } finally {
      setIsStandardizing(false);
    }
  };

  const handleEnrichPersonas = async () => {
    if (!userProfile?.org_id) return;

    setIsEnrichingPersonas(true);
    try {
      toast.loading('Mapping personas for all contacts...', { id: 'persona-enrichment' });

      const { data, error } = await supabase.functions.invoke('enrich-contacts-persona', {
        body: { orgId: userProfile.org_id, batchSize: 1000 }
      });

      if (error) throw error;

      toast.success(`Enriched ${data.enriched} contacts with persona data`, { id: 'persona-enrichment' });
      await loadMetrics();
    } catch (error: any) {
      console.error('Error enriching personas:', error);
      toast.error(error.message || 'Failed to enrich personas', { id: 'persona-enrichment' });
    } finally {
      setIsEnrichingPersonas(false);
    }
  };

  const handleEnrichContacts = async () => {
    if (!userProfile?.org_id) return;

    setIsEnrichingContacts(true);
    try {
      toast.loading('Finding contacts for high-fit accounts...', { id: 'contact-enrichment' });

      const { data, error } = await supabase.functions.invoke('enrich-contacts-bulk', {
        body: { orgId: userProfile.org_id, batchSize: 100 }
      });

      if (error) throw error;

      toast.success(`Created ${data.enriched} contacts for ${data.total} accounts`, { id: 'contact-enrichment' });
      await loadMetrics();
    } catch (error: any) {
      console.error('Error enriching contacts:', error);
      toast.error(error.message || 'Failed to enrich contacts', { id: 'contact-enrichment' });
    } finally {
      setIsEnrichingContacts(false);
    }
  };

  if (isLoading || !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
          <CardDescription>Loading metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const standardizationPercent = metrics.totalAccounts > 0
    ? Math.round((metrics.standardizedIndustries / metrics.totalAccounts) * 100)
    : 0;

  const fieldCompleteness = [
    { label: 'Primary Industry', value: metrics.withPrimaryIndustry, total: metrics.totalAccounts },
    { label: 'Sub-Industry', value: metrics.withSubIndustry, total: metrics.totalAccounts },
    { label: 'Employee Count', value: metrics.withEmployeeCount, total: metrics.totalAccounts },
    { label: 'Revenue Range', value: metrics.withRevenue, total: metrics.totalAccounts },
    { label: 'Geography', value: metrics.withCountry, total: metrics.totalAccounts }
  ];

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Quality Overview
          </CardTitle>
          <CardDescription>
            {metrics.totalAccounts.toLocaleString()} total accounts tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{metrics.overallCompleteness}%</div>
                <div className="text-sm text-muted-foreground">Overall Completeness</div>
              </div>
              <div className="text-right">
                {metrics.overallCompleteness >= 80 ? (
                  <Badge className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Excellent
                  </Badge>
                ) : metrics.overallCompleteness >= 60 ? (
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Good
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Needs Work
                  </Badge>
                )}
              </div>
            </div>
            <Progress value={metrics.overallCompleteness} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Industry Standardization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Industry Standardization
          </CardTitle>
          <CardDescription>
            Using ZoomInfo taxonomy for consistent classification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Standardized Accounts</span>
              <span className="font-medium">
                {metrics.standardizedIndustries.toLocaleString()} / {metrics.totalAccounts.toLocaleString()}
              </span>
            </div>
            <Progress value={standardizationPercent} className="h-2" />
          </div>

          <div className="space-y-2">
            {standardizationPercent < 100 && (
              <Button 
                onClick={handleStandardizeAll} 
                disabled={isStandardizing}
                className="w-full"
              >
                {isStandardizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Standardizing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Standardize All Industries
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <div className="font-medium mb-1">What does this do?</div>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Maps existing industries to ZoomInfo taxonomy</li>
              <li>• Improves ICP scoring accuracy</li>
              <li>• Enables better filtering and segmentation</li>
              <li>• Makes data consistent across all sources</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Field-by-Field Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Field Completeness</CardTitle>
          <CardDescription>Breakdown by data field</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fieldCompleteness.map(field => {
              const percent = field.total > 0 ? Math.round((field.value / field.total) * 100) : 0;
              return (
                <div key={field.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{field.label}</span>
                    <span className="font-medium">{percent}%</span>
                  </div>
                  <Progress value={percent} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {metrics.overallCompleteness < 80 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>How to improve data quality</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {metrics.withPrimaryIndustry < metrics.totalAccounts * 0.8 && (
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Enrich industry data</div>
                    <div className="text-muted-foreground">
                      {(metrics.totalAccounts - metrics.withPrimaryIndustry).toLocaleString()} accounts missing industry classification
                    </div>
                  </div>
                </div>
              )}
              {metrics.withEmployeeCount < metrics.totalAccounts * 0.7 && (
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Add company size data</div>
                    <div className="text-muted-foreground">
                      Employee counts improve ICP scoring by 15 points
                    </div>
                  </div>
                </div>
              )}
              {standardizationPercent < 90 && (
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Standardize industry taxonomy</div>
                    <div className="text-muted-foreground">
                      Use the "Standardize All Industries" button above
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
