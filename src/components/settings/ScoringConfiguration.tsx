import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Save,
  RotateCcw,
  Eye,
  TrendingUp,
  Target,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ScoringWeight {
  id: string;
  name: string;
  description: string;
  weight: number;
  category: 'fit' | 'intent' | 'reachability';
  icon: any;
}

interface ScoringModel {
  id: string;
  name: string;
  description: string;
  weights: ScoringWeight[];
  isDefault: boolean;
  version: string;
}

const DEFAULT_WEIGHTS: ScoringWeight[] = [
  // Fit Score Components
  { id: 'company_size', name: 'Company Size Match', description: 'How well company size matches ICP', weight: 25, category: 'fit', icon: Users },
  { id: 'industry_match', name: 'Industry Match', description: 'Industry alignment with target segments', weight: 20, category: 'fit', icon: Target },
  { id: 'revenue_range', name: 'Revenue Range', description: 'Revenue alignment with ICP criteria', weight: 15, category: 'fit', icon: TrendingUp },
  { id: 'geography', name: 'Geographic Fit', description: 'Location-based targeting match', weight: 10, category: 'fit', icon: Target },
  
  // Intent Score Components
  { id: 'engagement_signals', name: 'Engagement Signals', description: 'Website visits, content downloads, email opens', weight: 15, category: 'intent', icon: Zap },
  { id: 'product_interest', name: 'Product Interest', description: 'Interaction with product pages and demos', weight: 10, category: 'intent', icon: Eye },
  { id: 'buying_stage', name: 'Buying Stage Indicators', description: 'Signals indicating purchase readiness', weight: 5, category: 'intent', icon: TrendingUp },
  
  // Reachability Score Components
  { id: 'contact_quality', name: 'Contact Quality', description: 'Availability and accuracy of contact information', weight: 0, category: 'reachability', icon: Users }
];

const SAMPLE_ACCOUNTS = [
  { name: 'Acme Corp', fit: 85, intent: 45, reachability: 90, overall: 0 },
  { name: 'TechStart Inc', fit: 70, intent: 80, reachability: 85, overall: 0 },
  { name: 'Enterprise Solutions', fit: 90, intent: 30, reachability: 75, overall: 0 }
];

export default function ScoringConfiguration() {
  const [activeModel, setActiveModel] = useState<ScoringModel | null>(null);
  const [weights, setWeights] = useState<ScoringWeight[]>(DEFAULT_WEIGHTS);
  const [previewAccounts, setPreviewAccounts] = useState(SAMPLE_ACCOUNTS);
  const [totalWeight, setTotalWeight] = useState(100);
  const [showPreview, setShowPreview] = useState(false);
  const [icpThreshold, setIcpThreshold] = useState(60);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current ICP threshold from organization settings
  const { data: orgData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['org-icp-threshold', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('icp_threshold')
        .eq('id', userProfile.org_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.org_id,
  });

  // Update local state when org data loads
  useEffect(() => {
    if (orgData?.icp_threshold !== undefined) {
      setIcpThreshold(orgData.icp_threshold);
    }
  }, [orgData]);

  // Mutation to save ICP threshold
  const saveThresholdMutation = useMutation({
    mutationFn: async (threshold: number) => {
      if (!userProfile?.org_id) throw new Error('No organization');
      const { error } = await supabase
        .from('organizations')
        .update({ icp_threshold: threshold })
        .eq('id', userProfile.org_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-icp-threshold'] });
      toast({ title: "Success", description: "ICP threshold saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const total = weights.reduce((sum, weight) => sum + weight.weight, 0);
    setTotalWeight(total);
    
    // Update preview scores
    const updatedAccounts = previewAccounts.map(account => ({
      ...account,
      overall: Math.round(
        (account.fit * getFitWeight() + 
         account.intent * getIntentWeight() + 
         account.reachability * getReachabilityWeight()) / 100
      )
    }));
    setPreviewAccounts(updatedAccounts);
  }, [weights]);

  const getFitWeight = () => weights.filter(w => w.category === 'fit').reduce((sum, w) => sum + w.weight, 0);
  const getIntentWeight = () => weights.filter(w => w.category === 'intent').reduce((sum, w) => sum + w.weight, 0);
  const getReachabilityWeight = () => weights.filter(w => w.category === 'reachability').reduce((sum, w) => sum + w.weight, 0);

  const updateWeight = (id: string, newWeight: number) => {
    setWeights(prev => prev.map(w => 
      w.id === id ? { ...w, weight: newWeight } : w
    ));
  };

  const resetToDefaults = () => {
    setWeights(DEFAULT_WEIGHTS);
    toast({ title: "Reset", description: "Scoring weights reset to default values" });
  };

  const saveConfiguration = () => {
    if (Math.abs(totalWeight - 100) > 0.1) {
      toast({
        title: "Invalid Configuration",
        description: "Total weights must equal 100%",
        variant: "destructive"
      });
      return;
    }

    // Here you would save to your backend
    toast({ title: "Success", description: "Scoring configuration saved successfully" });
  };

  const getCategoryWeights = () => ({
    fit: getFitWeight(),
    intent: getIntentWeight(),
    reachability: getReachabilityWeight()
  });

  const categoryWeights = getCategoryWeights();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Scoring Model Configuration</h3>
          <p className="text-sm text-muted-foreground">Adjust weights for different scoring components</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
          <Button onClick={saveConfiguration}>
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* ICP Qualification Threshold */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            ICP Qualification Threshold
          </CardTitle>
          <CardDescription>
            Accounts with scores at or above this threshold will be marked as ICP Qualified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Slider
                value={[icpThreshold]}
                onValueChange={(value) => setIcpThreshold(value[0])}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={icpThreshold}
                onChange={(e) => setIcpThreshold(parseInt(e.target.value) || 0)}
                className="w-20"
                min={0}
                max={100}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {icpThreshold === 60 ? (
                <span className="text-green-600">Using default threshold (60%)</span>
              ) : (
                <span>Custom threshold: {icpThreshold}%</span>
              )}
            </p>
            <Button
              size="sm"
              onClick={() => saveThresholdMutation.mutate(icpThreshold)}
              disabled={saveThresholdMutation.isPending || (orgData?.icp_threshold === icpThreshold)}
            >
              {saveThresholdMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Threshold
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weight Validation */}
      <Card className={totalWeight !== 100 ? "border-destructive" : "border-green-500"}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Math.abs(totalWeight - 100) < 0.1 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                Total Weight: {totalWeight.toFixed(1)}%
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {Math.abs(totalWeight - 100) < 0.1 ? (
                "Configuration is valid"
              ) : (
                `${totalWeight > 100 ? 'Decrease' : 'Increase'} by ${Math.abs(totalWeight - 100).toFixed(1)}%`
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="weights" className="w-full">
        <TabsList>
          <TabsTrigger value="weights">Weight Configuration</TabsTrigger>
          <TabsTrigger value="categories">Category Overview</TabsTrigger>
          <TabsTrigger value="models">Scoring Models</TabsTrigger>
        </TabsList>

        <TabsContent value="weights" className="space-y-6">
          {['fit', 'intent', 'reachability'].map(category => {
            const categoryWeights = weights.filter(w => w.category === category);
            const categoryTotal = categoryWeights.reduce((sum, w) => sum + w.weight, 0);
            
            return (
              <Card key={category}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="capitalize">{category} Score Components</CardTitle>
                    <Badge variant="outline">{categoryTotal}% of total</Badge>
                  </div>
                  <CardDescription>
                    {category === 'fit' && 'How well the account matches your ideal customer profile'}
                    {category === 'intent' && 'Signals indicating interest or buying readiness'}
                    {category === 'reachability' && 'How easy it is to connect with the account'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {categoryWeights.map(weight => {
                    const Icon = weight.icon;
                    return (
                      <div key={weight.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-medium">{weight.name}</div>
                              <div className="text-sm text-muted-foreground">{weight.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm w-12 text-right">{weight.weight}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[weight.weight]}
                            onValueChange={(value) => updateWeight(weight.id, value[0])}
                            max={50}
                            step={1}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={weight.weight}
                            onChange={(e) => updateWeight(weight.id, parseInt(e.target.value) || 0)}
                            className="w-20"
                            min={0}
                            max={50}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(categoryWeights).map(([category, weight]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize flex items-center gap-2">
                    {category === 'fit' && <Target className="h-5 w-5" />}
                    {category === 'intent' && <Zap className="h-5 w-5" />}
                    {category === 'reachability' && <Users className="h-5 w-5" />}
                    {category} Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{weight}%</div>
                  <div className="text-sm text-muted-foreground mt-2">
                    of total score weight
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(weight, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Models</CardTitle>
              <CardDescription>Manage different scoring configurations for various use cases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Default Model v1.0</div>
                    <div className="text-sm text-muted-foreground">Standard scoring configuration</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge>Active</Badge>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-dashed rounded-lg">
                  <div>
                    <div className="font-medium">Create New Model</div>
                    <div className="text-sm text-muted-foreground">Build a custom scoring configuration</div>
                  </div>
                  <Button>Create Model</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Section */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Preview</CardTitle>
            <CardDescription>See how your weight changes affect sample accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {previewAccounts.map((account, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">{account.name}</h4>
                    <Badge className="text-lg px-3 py-1">{account.overall}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Fit Score</div>
                      <div className="font-medium">{account.fit} ({categoryWeights.fit}% weight)</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Intent Score</div>
                      <div className="font-medium">{account.intent} ({categoryWeights.intent}% weight)</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Reachability Score</div>
                      <div className="font-medium">{account.reachability} ({categoryWeights.reachability}% weight)</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}