import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Wand2, Edit, Trash2, BarChart3, Users, MapPin, Building, TrendingUp, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ICPWizard } from "@/components/icp/ICPWizard";
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
            <Button onClick={handleCreateNew} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create ICP
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

        {/* Main Content Tabs */}
        <Tabs defaultValue="icps" className="space-y-6">
          <TabsList>
            <TabsTrigger value="icps">Active ICPs</TabsTrigger>
            <TabsTrigger value="insights">Win-Based Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="icps" className="space-y-6">
            {/* ICP Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {icps.map((icp) => (
                <Card key={icp.id} className="relative group">
...
                </CardContent>
              </Card>
              ))}

              {/* Empty State */}
              {icps.length === 0 && (
                <div className="col-span-full">
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Target className="h-16 w-16 text-muted-foreground mb-4" />
                      <CardTitle className="text-xl mb-2">No ICP Profiles Yet</CardTitle>
                      <CardDescription className="text-center mb-6 max-w-md">
                        Create your first Ideal Customer Profile using our guided wizard. 
                        Start with a template or build from scratch with advanced targeting criteria.
                      </CardDescription>
                      <div className="flex gap-2">
                        <Button onClick={handleCreateNew} className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Create Your First ICP
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

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

      {/* ICP Wizard */}
      <ICPWizard
        isOpen={isWizardOpen}
        onClose={handleWizardClose}
        onComplete={handleWizardComplete}
        editingICP={editingIcp}
      />
    </>
  );
}