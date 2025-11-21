import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Zap, Database, Users, AlertCircle, CheckCircle2, TrendingUp, DollarSign } from "lucide-react";
import { calculateHybridCost, formatCost } from "@/utils/enrichment-cost-calculator";
import { useEnrichmentProgress } from "@/hooks/use-enrichment-progress";

interface DataQuality {
  totalAccounts: number;
  accountsWithEmployeeCount: number;
  accountsWithRevenue: number;
  accountsWithIndustry: number;
  totalContacts: number;
  contactsWithEmail: number;
  contactsWithTitle: number;
  overallCompleteness: number;
  accountCompleteness: number;
  contactCompleteness: number;
}

export function SmartEnrichmentPanel() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { data: jobProgress } = useEnrichmentProgress(activeJobId, enriching);

  useEffect(() => {
    loadDataQuality();
    checkActiveJob();
  }, [userProfile]);

  const loadDataQuality = async () => {
    if (!userProfile?.org_id) return;
    
    setLoading(true);
    try {
      // Get account data quality
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('employee_count, revenue_range, industry_raw')
        .eq('org_id', userProfile.org_id);

      if (accountsError) throw accountsError;

      // Get contact data quality
      const { data: contacts, error: contactsError } = await supabase
        .from('Leads')
        .select('email, title')
        .eq('org_id', userProfile.org_id);

      if (contactsError) throw contactsError;

      const totalAccounts = accounts?.length || 0;
      const accountsWithEmployeeCount = accounts?.filter(a => a.employee_count).length || 0;
      const accountsWithRevenue = accounts?.filter(a => a.revenue_range).length || 0;
      const accountsWithIndustry = accounts?.filter(a => a.industry_raw).length || 0;

      const totalContacts = contacts?.length || 0;
      const contactsWithEmail = contacts?.filter(c => c.email).length || 0;
      const contactsWithTitle = contacts?.filter(c => c.title).length || 0;

      const accountCompleteness = totalAccounts > 0
        ? ((accountsWithEmployeeCount + accountsWithRevenue + accountsWithIndustry) / (totalAccounts * 3)) * 100
        : 0;

      const contactCompleteness = totalContacts > 0
        ? ((contactsWithEmail + contactsWithTitle) / (totalContacts * 2)) * 100
        : 0;

      const overallCompleteness = (accountCompleteness + contactCompleteness) / 2;

      setQuality({
        totalAccounts,
        accountsWithEmployeeCount,
        accountsWithRevenue,
        accountsWithIndustry,
        totalContacts,
        contactsWithEmail,
        contactsWithTitle,
        overallCompleteness,
        accountCompleteness,
        contactCompleteness
      });
    } catch (error) {
      console.error('Error loading data quality:', error);
      toast({
        title: "Error",
        description: "Failed to load data quality metrics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkActiveJob = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('id, status')
        .eq('org_id', userProfile.org_id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setActiveJobId(data.id);
        setEnriching(true);
      }
    } catch (error) {
      console.error('Error checking active job:', error);
    }
  };

  const startSmartEnrich = async () => {
    if (!userProfile?.org_id || !quality) return;

    setEnriching(true);
    try {
      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          created_by: userProfile.user_id,
          job_type: 'smart_enrich',
          provider: 'smart',
          status: 'pending',
          total_records: quality.totalAccounts + quality.totalContacts,
          batch_size: 50
        })
        .select()
        .single();

      if (jobError) throw jobError;
      
      setActiveJobId(job.id);

      toast({
        title: "Enrichment Started",
        description: "Smart enrichment is now running. This may take a few minutes.",
      });

      // Call smart-enrich function
      const { error: functionError } = await supabase.functions.invoke('smart-enrich', {
        body: { 
          jobId: job.id,
          batchSize: 50
        }
      });

      if (functionError) {
        throw functionError;
      }

      // Reload data after completion
      setTimeout(() => {
        loadDataQuality();
        setEnriching(false);
        setActiveJobId(null);
      }, 5000);

    } catch (error: any) {
      console.error('Error starting enrichment:', error);
      setEnriching(false);
      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to start enrichment",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Smart Enrichment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quality) return null;

  const missingAccounts = quality.totalAccounts - Math.max(
    quality.accountsWithEmployeeCount,
    quality.accountsWithRevenue,
    quality.accountsWithIndustry
  );

  const missingContacts = quality.totalContacts - Math.min(
    quality.contactsWithEmail,
    quality.contactsWithTitle
  );

  const costEstimate = calculateHybridCost(missingAccounts);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Smart Enrichment
            </CardTitle>
            <CardDescription>
              AI-powered data enrichment with automatic provider selection
            </CardDescription>
          </div>
          {quality.overallCompleteness >= 90 ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Excellent
            </Badge>
          ) : quality.overallCompleteness >= 70 ? (
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              Good
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Needs Attention
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Data Completeness</span>
            <span className="text-muted-foreground">{quality.overallCompleteness.toFixed(1)}%</span>
          </div>
          <Progress value={quality.overallCompleteness} className="h-2" />
        </div>

        {/* Account vs Contact Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-primary" />
              Account Data
            </div>
            <Progress value={quality.accountCompleteness} className="h-1.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Employee Count</span>
                <span>{quality.accountsWithEmployeeCount}/{quality.totalAccounts}</span>
              </div>
              <div className="flex justify-between">
                <span>Revenue</span>
                <span>{quality.accountsWithRevenue}/{quality.totalAccounts}</span>
              </div>
              <div className="flex justify-between">
                <span>Industry</span>
                <span>{quality.accountsWithIndustry}/{quality.totalAccounts}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              Contact Data
            </div>
            <Progress value={quality.contactCompleteness} className="h-1.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Email</span>
                <span>{quality.contactsWithEmail}/{quality.totalContacts}</span>
              </div>
              <div className="flex justify-between">
                <span>Title</span>
                <span>{quality.contactsWithTitle}/{quality.totalContacts}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Estimate */}
        {missingAccounts > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4" />
                Estimated Cost
              </div>
              <span className="text-lg font-bold">{formatCost(costEstimate.totalCost)}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {costEstimate.breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.phase}</span>
                  <span>{formatCost(item.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Job Progress */}
        {enriching && jobProgress && (
          <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Enrichment in progress...</span>
              <Badge variant="secondary">
                {jobProgress.processed_records || 0}/{jobProgress.total_records || 0}
              </Badge>
            </div>
            <Progress value={jobProgress.progress_percentage || 0} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Enriched: {jobProgress.enriched_records || 0} • Failed: {jobProgress.failed_records || 0}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={startSmartEnrich}
          disabled={enriching || missingAccounts === 0}
          className="w-full"
          size="lg"
        >
          <Zap className="h-4 w-4 mr-2" />
          {enriching ? "Enriching..." : "Start Smart Enrichment"}
        </Button>

        {missingAccounts === 0 && (
          <p className="text-sm text-center text-muted-foreground">
            All data is complete! No enrichment needed.
          </p>
        )}

        {/* How it works */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p className="font-medium">How Smart Enrichment Works:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Automatically tries PDL first (most cost-effective)</li>
            <li>Falls back to Clearbit for remaining gaps</li>
            <li>Uses AI estimation for remaining accounts</li>
            <li>Flags high-value accounts for deep research</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
