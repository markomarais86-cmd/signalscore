import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Wand2, Edit, Trash2, BarChart3, Users, MapPin, Building, TrendingUp, ArrowRight, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ICPWizard } from "@/components/icp/ICPWizard";
import { FirmographicAnalysis } from "@/components/icp/FirmographicAnalysis";
import { ICPProfile } from "@/types/icp";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { DEMO_ICP_PROFILES } from "@/data/mockData";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClosedWonInsights } from "@/components/icp/ClosedWonInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ICPManager() {
  const [icps, setIcps] = useState<ICPProfile[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [showFirmographicAnalysis, setShowFirmographicAnalysis] = useState(false);
  const [editingIcp, setEditingIcp] = useState<ICPProfile | null>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { completeStep } = useOnboarding();
  const { flags } = useFeatureFlags();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadICPs();
    }
  }, [userProfile?.org_id]);

  const loadICPs = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      // Use demo data if demo mode is enabled
      if (flags.demo_mode) {
        const demoICPs: ICPProfile[] = DEMO_ICP_PROFILES.map(profile => ({
          ...profile,
          org_id: userProfile.org_id,
          created_at: new Date().toISOString(),
          status: 'active' as const
        }));
        setIcps(demoICPs);
        return;
      }

      const { data, error } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast the data to match our interface types
      const typedData = (data || []).map(item => ({
        ...item,
        status: (item.status || 'draft') as 'draft' | 'active' | 'archived'
      })) as ICPProfile[];
      
      setIcps(typedData);
    } catch (error) {
      console.error('Error loading ICPs:', error);
      toast({
        title: "Error",
        description: "Failed to load ICP profiles",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (icp: ICPProfile) => {
    setEditingIcp(icp);
    setIsWizardOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ICP profile?")) return;

    try {
      const { error } = await supabase
        .from('icp_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "ICP profile deleted" });
      loadICPs();
    } catch (error) {
      console.error('Error deleting ICP:', error);
      toast({
        title: "Error",
        description: "Failed to delete ICP profile",
        variant: "destructive"
      });
    }
  };

  const handleCreateNew = () => {
    setEditingIcp(null);
    setIsWizardOpen(true);
  };

  const handleWizardComplete = async () => {
    await loadICPs();
    setIsWizardOpen(false);
    setEditingIcp(null);
    completeStep('create_icp');
    
    // Trigger re-scoring for all accounts with the new/updated ICP
    toast({
      title: "ICP saved successfully",
      description: "Account scoring will be updated based on the new ICP criteria"
    });
    
    // Optional: trigger background re-scoring job
    if (userProfile?.org_id) {
      triggerRescoring();
    }
  };

  const triggerRescoring = async () => {
    try {
      // This would call a background job to re-score all accounts
      // For now, just show a message
      console.log('Triggering account re-scoring...');
    } catch (error) {
      console.error('Error triggering re-scoring:', error);
    }
  };

  const handleWizardClose = () => {
    setIsWizardOpen(false);
    setEditingIcp(null);
  };

  const handleFirmographicComplete = async () => {
    setShowFirmographicAnalysis(false);
    await loadICPs();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const activeCount = icps.filter(icp => icp.status === 'active').length;
  
  return (
    <>
      <div className="space-y-6">
        <DemoModeBanner />
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">ICP Manager</h1>
            <p className="text-muted-foreground mt-2">Create, manage, and activate your Ideal Customer Profiles</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowFirmographicAnalysis(true)} variant="outline" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Create from Account Data
            </Button>
            <Button onClick={handleCreateNew} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create ICP Manually
            </Button>
          </div>
        </div>

        {/* Info Alert - What Happens Next */}
        {icps.length > 0 && activeCount > 0 && (
          <Alert className="border-primary/50 bg-primary/5">
            <Target className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                <strong>{activeCount} active ICP{activeCount > 1 ? 's' : ''}</strong> ready to analyze your accounts and generate TAM intelligence
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link to="/icp-tam" className="flex items-center gap-1">
                  View Intelligence <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Hero Metric */}
        {icps.length > 0 && (
          <HeroMetric
            label="Total ICPs Defined"
            value={icps.length}
            subtitle={`${activeCount} active, ${icps.filter(icp => icp.status === 'draft').length} in draft`}
            icon={Target}
            trend={{ value: 12, period: 'last month' }}
            status={activeCount > 0 ? 'success' : 'warning'}
          />
        )}

        {/* Supporting Metrics */}
        {icps.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-[hsl(var(--signal-high))]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[hsl(var(--signal-high))]" />
                    <span className="text-sm font-medium">Active ICPs</span>
                  </div>
                  <span className="text-3xl font-bold">{activeCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[hsl(var(--signal-medium))]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-[hsl(var(--signal-medium))]" />
                    <span className="text-sm font-medium">Draft ICPs</span>
                  </div>
                  <span className="text-3xl font-bold">
                    {icps.filter(icp => icp.status === 'draft').length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Avg Confidence</span>
                  </div>
                  <span className="text-3xl font-bold">
                    {Math.round(icps.reduce((sum, icp) => sum + (icp.confidence_score || 0), 0) / icps.length)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ICP Content */}
        {/* ICP Grid */}
        {icps.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {icps.map((icp) => (
                  <Card key={icp.id} className="relative group">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2">
                          <Target className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <CardTitle className="text-lg">{icp.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={getStatusBadgeColor(icp.status || 'draft')}>
                                {icp.status || 'draft'}
                              </Badge>
                              {icp.confidence_score && (
                                <Badge variant="outline" className="text-xs">
                                  {icp.confidence_score}% confidence
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(icp)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Edit className="h-4 w-4" />
                          </Button>
                          {userProfile?.role === 'admin' && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(icp.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {icp.status === 'active' && (
                            <Button variant="outline" size="sm" asChild>
                              <Link to="/icp-tam">
                                <BarChart3 className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                      <CardDescription>
                        {icp.description || `Created ${formatDate(icp.created_at)}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Industries */}
                      {icp.industries && icp.industries.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Industries</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {icp.industries.slice(0, 3).map((industry, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {industry}
                              </Badge>
                            ))}
                            {icp.industries.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{icp.industries.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Company Sizes */}
                      {icp.company_sizes && icp.company_sizes.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Company Sizes</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {icp.company_sizes.slice(0, 2).map((size, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {size}+ employees
                              </Badge>
                            ))}
                            {icp.company_sizes.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{icp.company_sizes.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Geographies */}
                      {icp.geographies && icp.geographies.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Geographies</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {icp.geographies.slice(0, 2).map((geo, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {geo}
                              </Badge>
                            ))}
                            {icp.geographies.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{icp.geographies.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Job Titles */}
                      {icp.persona_job_titles && icp.persona_job_titles.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Target Roles</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {icp.persona_job_titles.slice(0, 2).map((title, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {title}
                              </Badge>
                            ))}
                            {icp.persona_job_titles.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{icp.persona_job_titles.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Metrics */}
                      {(icp.match_count || icp.tam_estimate || icp.status === 'active') && (
                        <div className="pt-3 border-t space-y-3">
                          {icp.status === 'active' && (
                            <>
                              <div className="text-sm font-medium text-muted-foreground">Pipeline Impact</div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <div className="text-lg font-bold text-primary">{icp.match_count || 0}</div>
                                  <div className="text-xs text-muted-foreground">Accounts</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-primary">
                                    {icp.tam_estimate ? `$${(icp.tam_estimate / 1000000).toFixed(1)}M` : '$0'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">TAM</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-primary">{icp.confidence_score || 0}%</div>
                                  <div className="text-xs text-muted-foreground">Quality</div>
                                </div>
                              </div>
                              <Button variant="outline" size="sm" className="w-full" asChild>
                                <Link to="/icp-tam">
                                  View Full Analysis <ArrowRight className="h-4 w-4 ml-2" />
                                </Link>
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
          </div>
        )}

        {/* Empty State */}
        {icps.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Target className="h-16 w-16 text-muted-foreground mb-4" />
                  <CardTitle className="text-xl mb-2">No ICP Profiles Yet</CardTitle>
                  <CardDescription className="text-center mb-6 max-w-md">
                    Create your first Ideal Customer Profile using our guided wizard. 
                    Start with a template or build from scratch with advanced targeting criteria.
                  </CardDescription>
                  <Button onClick={handleCreateNew} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create Your First ICP
                  </Button>
                </CardContent>
          </Card>
        )}

        {/* Getting Started Tips */}
        {icps.length === 0 && (
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-primary" />
                    Getting Started with ICP Profiles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="font-medium">1. Choose a Template</div>
                      <div className="text-sm text-muted-foreground">
                        Start with pre-built templates for common industries and use cases
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium">2. Define Your Ideal Customer</div>
                      <div className="text-sm text-muted-foreground">
                        Add company characteristics, persona details, and advanced targeting criteria
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium">3. Score & Analyze</div>
                      <div className="text-sm text-muted-foreground">
                        Activate your ICP to score accounts, generate TAM intelligence, and identify qualified leads
                      </div>
                    </div>
                  </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ICP Wizard Dialog */}
      <ICPWizard
        isOpen={isWizardOpen}
        onClose={handleWizardClose}
        onComplete={handleWizardComplete}
        editingICP={editingIcp}
      />

      {showFirmographicAnalysis && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="container max-w-7xl mx-auto py-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Create ICP from Your Account Data</h2>
              <Button
                variant="outline"
                onClick={() => setShowFirmographicAnalysis(false)}
              >
                Close
              </Button>
            </div>
            <FirmographicAnalysis onCreateICP={handleFirmographicComplete} />
          </div>
        </div>
      )}
    </>
  );
}
