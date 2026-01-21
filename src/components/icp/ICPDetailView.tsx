import { useState } from 'react';
import { ICPProfile } from '@/types/icp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LaunchPulseDiscovery } from '@/components/discovery/LaunchPulseDiscovery';
import { ICPMatchedAccountsTab } from './ICPMatchedAccountsTab';
import { ICPTAMAnalysisTab } from './ICPTAMAnalysisTab';
import { ICPAnalyticsTab } from './ICPAnalyticsTab';
import { WhitespaceMappingCard } from './WhitespaceMappingCard';
import { useUnifiedEnrichment } from '@/hooks/use-unified-enrichment';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Building, 
  Users, 
  MapPin, 
  Target, 
  Rocket, 
  BarChart3, 
  Edit,
  ArrowLeft,
  Briefcase,
  DollarSign,
  Zap,
  TrendingUp,
  Loader2
} from 'lucide-react';

interface ICPDetailViewProps {
  icp: ICPProfile;
  onBack: () => void;
  onEdit: (icp: ICPProfile) => void;
  defaultTab?: string;
}

export function ICPDetailView({ icp, onBack, onEdit, defaultTab = 'overview' }: ICPDetailViewProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { userProfile } = useAuth();
  const [enrichmentCost, setEnrichmentCost] = useState<number | null>(null);
  const [matchedAccountsCount, setMatchedAccountsCount] = useState<number | null>(null);
  
  const { isEnriching, progress, enrichAccounts } = useUnifiedEnrichment({
    onComplete: (result) => {
      toast.success(`Enriched ${result.summary.enriched} accounts`, {
        description: `Total cost: $${result.summary.totalCost.toFixed(2)}`
      });
    }
  });

  const handleEnrichMatchedAccounts = async () => {
    if (!userProfile?.org_id) return;

    try {
      // First get matched account IDs
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('account_external_id')
        .eq('org_id', userProfile.org_id)
        .eq('icp_id', icp.id)
        .gte('fit', 70);

      if (scoresError) throw scoresError;
      if (!scores || scores.length === 0) {
        toast.error('No high-fit accounts found');
        return;
      }

      const accountIds = scores.map(s => s.account_external_id);

      // Fetch accounts that need enrichment
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('external_id, name, domain, industry_norm, industry_raw, employee_count, revenue_range, country, state_province, city')
        .eq('org_id', userProfile.org_id)
        .in('external_id', accountIds)
        .or('employee_count.is.null,revenue_range.is.null,industry_norm.is.null')
        .not('domain', 'is', null)
        .limit(100);

      if (accountsError) throw accountsError;
      if (!accounts || accounts.length === 0) {
        toast.info('All high-fit accounts are already enriched');
        return;
      }

      // Enrich the accounts
      await enrichAccounts(userProfile.org_id, accounts, { skipPaidProviders: false });
    } catch (error) {
      console.error('Error enriching matched accounts:', error);
      toast.error('Failed to enrich accounts');
    }
  };

  // Fetch matched accounts count for cost estimate
  useState(() => {
    if (userProfile?.org_id && icp.id) {
      supabase
        .from('scores')
        .select('account_external_id', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('icp_id', icp.id)
        .gte('fit', 70)
        .then(({ count }) => {
          setMatchedAccountsCount(count || 0);
          setEnrichmentCost((count || 0) * 0.25); // ~$0.25 per account
        });
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to ICPs
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{icp.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{icp.status || 'draft'}</Badge>
              {icp.confidence_score && (
                <Badge variant="outline">{icp.confidence_score}% confidence</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            onClick={handleEnrichMatchedAccounts}
            disabled={isEnriching}
          >
            {isEnriching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enriching... {progress?.processed || 0}/{progress?.total || 0}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Enrich High-Fit Accounts
                {enrichmentCost !== null && (
                  <Badge variant="secondary" className="ml-2">
                    ~${enrichmentCost.toFixed(0)}
                  </Badge>
                )}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onEdit(icp)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit ICP
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Matched Accounts
          </TabsTrigger>
          <TabsTrigger value="discover" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Discover New
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="tam" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            TAM Analysis
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Description */}
            {icp.description && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{icp.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Industries */}
            {icp.industries && icp.industries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Target Industries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.industries.map((industry, i) => (
                      <Badge key={i} variant="secondary">{industry}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Geographies */}
            {icp.geographies && icp.geographies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Target Geographies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.geographies.map((geo, i) => (
                      <Badge key={i} variant="secondary">{geo}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Sizes */}
            {icp.company_sizes && icp.company_sizes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Company Sizes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.company_sizes.map((size, i) => (
                      <Badge key={i} variant="secondary">{size}+ employees</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Ranges */}
            {icp.revenue_ranges && icp.revenue_ranges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Revenue Ranges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.revenue_ranges.map((range, i) => (
                      <Badge key={i} variant="secondary">{range}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Titles */}
            {icp.persona_job_titles && icp.persona_job_titles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Target Personas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.persona_job_titles.map((title, i) => (
                      <Badge key={i} variant="secondary">{title}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tech Stack */}
            {icp.tech_stack && icp.tech_stack.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tech Stack</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.tech_stack.map((tech, i) => (
                      <Badge key={i} variant="outline">{tech}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Matched Accounts Tab */}
        <TabsContent value="accounts">
          <ICPMatchedAccountsTab icpId={icp.id} icpName={icp.name} />
        </TabsContent>

        {/* Discover Tab */}
        <TabsContent value="discover">
          <LaunchPulseDiscovery icp={icp} compact />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <ICPAnalyticsTab icpId={icp.id} icpName={icp.name} />
        </TabsContent>

        {/* TAM Analysis Tab */}
        <TabsContent value="tam">
          <div className="space-y-6">
            <ICPTAMAnalysisTab icp={icp} />
            <WhitespaceMappingCard 
              icpId={icp.id} 
              icpName={icp.name} 
              tamEstimate={icp.tam_estimate} 
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
