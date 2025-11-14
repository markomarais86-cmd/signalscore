import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Users, DollarSign, CheckCircle2, Target, AlertCircle, Loader2, ArrowRight, ArrowLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/utils/format-numbers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CampaignBuilderV2Props {
  isOpen: boolean;
  onClose: () => void;
  icpId?: string;
  source: 'icp-manager' | 'executive-dashboard';
}

interface ICPProfile {
  id: string;
  name: string;
  description?: string;
  industries?: string[];
  geographies?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
  persona_job_titles?: string[];
  persona_seniority_levels?: string[];
  persona_departments?: string[];
}

interface FilterCriteria {
  employeeMin?: number;
  employeeMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  marketSegment?: string;
  managementLevels: string[];
  fitScoreMin: number;
}

interface SequenceStep {
  day: number;
  action: string;
  description: string;
}

const EMPLOYEE_RANGES = [
  { label: "1-50", min: 1, max: 50 },
  { label: "51-200", min: 51, max: 200 },
  { label: "201-500", min: 201, max: 500 },
  { label: "501-1000", min: 501, max: 1000 },
  { label: "1000+", min: 1000, max: null }
];

const REVENUE_RANGES = [
  { label: "<$1M", min: 0, max: 1000000 },
  { label: "$1M-$10M", min: 1000000, max: 10000000 },
  { label: "$10M-$50M", min: 10000000, max: 50000000 },
  { label: "$50M-$100M", min: 50000000, max: 100000000 },
  { label: "$100M+", min: 100000000, max: null }
];

const MARKET_SEGMENTS = ["Enterprise", "Mid-Market", "SMB"];
const MANAGEMENT_LEVELS = ["C-Level", "VP", "Director", "Manager"];

const SEQUENCE_TEMPLATES = {
  'enterprise': [
    { day: 1, action: 'Email', description: 'Research-based personalized introduction' },
    { day: 3, action: 'LinkedIn', description: 'Connection request with note' },
    { day: 7, action: 'Email', description: 'Value-focused follow-up' },
    { day: 10, action: 'Phone', description: 'Executive briefing offer' },
    { day: 14, action: 'Email', description: 'Case study share' }
  ],
  'smb': [
    { day: 1, action: 'Email', description: 'Quick value proposition' },
    { day: 3, action: 'Email', description: 'Follow-up with demo offer' },
    { day: 7, action: 'Phone', description: 'Direct call' },
    { day: 14, action: 'Email', description: 'Last attempt with offer' }
  ],
  'partner': [
    { day: 1, action: 'Email', description: 'Partnership introduction' },
    { day: 5, action: 'LinkedIn', description: 'Connect and engage' },
    { day: 10, action: 'Email', description: 'Collaboration proposal' },
    { day: 14, action: 'Meeting', description: 'Strategy session' }
  ]
};

export function CampaignBuilderV2({ isOpen, onClose, icpId, source }: CampaignBuilderV2Props) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [activeICP, setActiveICP] = useState<ICPProfile | null>(null);
  const [loadingICP, setLoadingICP] = useState(false);
  
  // Step 2: Filtering criteria
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    managementLevels: ["VP", "C-Level"],
    fitScoreMin: 70
  });
  
  // Step 3: Go-to-market sequences
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof SEQUENCE_TEMPLATES>('enterprise');
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>(SEQUENCE_TEMPLATES.enterprise);
  
  // Step 4: Persona refinement (from ICP)
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  
  // Step 5: Provider selection
  const [provider, setProvider] = useState<'apollo' | 'zoominfo' | 'clearbit'>('apollo');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [estimatedContacts, setEstimatedContacts] = useState(0);
  
  // Step 6: Preview (query on-demand)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  
  // Step 7: Push/Export
  const [isPushing, setIsPushing] = useState(false);
  const [pushComplete, setPushComplete] = useState(false);
  const [destination, setDestination] = useState<'salesforce' | 'csv'>('salesforce');

  // Load ICP on open
  useEffect(() => {
    if (isOpen && userProfile?.org_id) {
      loadICP();
    }
  }, [isOpen, userProfile?.org_id, icpId]);

  const loadICP = async () => {
    if (!userProfile?.org_id) return;
    
    setLoadingICP(true);
    try {
      let icpToLoad = icpId;
      
      // If no ICP specified, get the active one
      if (!icpToLoad) {
        const { data: activeICPs } = await supabase
          .from('icp_profiles')
          .select('id')
          .eq('org_id', userProfile.org_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!activeICPs || activeICPs.length === 0) {
          toast({
            title: "No Active ICP",
            description: "Please create and activate an ICP first",
            variant: "destructive"
          });
          onClose();
          return;
        }
        
        icpToLoad = activeICPs[0].id;
      }
      
      const { data: icp, error } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('id', icpToLoad)
        .single();
      
      if (error) throw error;
      
      setActiveICP(icp);
      
      // Pre-populate persona criteria from ICP
      if (icp.persona_job_titles) setSelectedTitles(icp.persona_job_titles);
      if (icp.persona_seniority_levels) setSelectedSeniority(icp.persona_seniority_levels);
      if (icp.persona_departments) setSelectedDepartments(icp.persona_departments);
      
    } catch (error: any) {
      console.error('Error loading ICP:', error);
      toast({
        title: "Error",
        description: "Failed to load ICP profile",
        variant: "destructive"
      });
    } finally {
      setLoadingICP(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !campaignName.trim()) {
      toast({ title: "Campaign name required", variant: "destructive" });
      return;
    }
    
    if (step < 7) setStep(step + 1);
    
    // Trigger preview load when entering step 6
    if (step === 5) {
      handleLoadPreview();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleLoadPreview = async () => {
    if (!userProfile?.org_id || !activeICP) return;
    
    setIsLoadingPreview(true);
    try {
      // Query accounts on-demand using filter criteria
      const { data, error } = await supabase.rpc('get_filtered_accounts', {
        p_org_id: userProfile.org_id,
        p_fit_min: filterCriteria.fitScoreMin,
        p_limit: 100, // Preview first 100
        p_campaign_ready: true
      });
      
      if (error) throw error;
      
      setPreviewData(data);
      setEstimatedContacts(data?.length || 0);
      
      // Calculate cost (example: $0.50 per contact)
      setEstimatedCost((data?.length || 0) * 0.50);
      
    } catch (error: any) {
      console.error('Error loading preview:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign preview",
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!userProfile?.org_id || !activeICP) return;
    
    setIsPushing(true);
    try {
      const campaignData = {
        org_id: userProfile.org_id,
        icp_id: activeICP.id,
        campaign_name: campaignName,
        filter_criteria: filterCriteria,
        sequence_steps: sequenceSteps,
        persona_criteria: {
          titles: selectedTitles,
          seniority: selectedSeniority,
          departments: selectedDepartments
        },
        provider,
        destination
      };
      
      if (destination === 'salesforce') {
        // Push to Salesforce
        const { data, error } = await supabase.functions.invoke('push-campaign-to-crm', {
          body: campaignData
        });
        
        if (error) throw error;
        
        toast({
          title: "Campaign Created",
          description: `Successfully pushed ${estimatedContacts} contacts to Salesforce`
        });
      } else {
        // Generate CSV
        const csvContent = generateCSV(previewData);
        downloadCSV(csvContent, `${campaignName}.csv`);
        
        toast({
          title: "Campaign Exported",
          description: `Downloaded ${estimatedContacts} contacts as CSV`
        });
      }
      
      setPushComplete(true);
      
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive"
      });
    } finally {
      setIsPushing(false);
    }
  };

  const generateCSV = (data: any[]) => {
    // Simple CSV generation
    const headers = ['Account Name', 'Domain', 'Industry', 'Country', 'Fit Score'];
    const rows = data.map(d => [d.name, d.domain, d.industry_norm, d.country, d.overall_score].join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleTemplateChange = (template: keyof typeof SEQUENCE_TEMPLATES) => {
    setSelectedTemplate(template);
    setSequenceSteps(SEQUENCE_TEMPLATES[template]);
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Q1 Enterprise Outreach"
                className="mt-2"
              />
            </div>
            
            {activeICP && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    ICP Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">ICP Name</div>
                    <div className="text-muted-foreground">{activeICP.name}</div>
                  </div>
                  {activeICP.description && (
                    <div>
                      <div className="text-sm font-medium">Description</div>
                      <div className="text-muted-foreground">{activeICP.description}</div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {activeICP.industries?.slice(0, 3).map(ind => (
                      <Badge key={ind} variant="secondary">{ind}</Badge>
                    ))}
                    {activeICP.geographies?.slice(0, 3).map(geo => (
                      <Badge key={geo} variant="outline">{geo}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Refine Targeting Criteria</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Add additional filters to narrow down your target accounts beyond the ICP baseline.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee Count</Label>
                <Select
                  value={filterCriteria.employeeMin ? `${filterCriteria.employeeMin}-${filterCriteria.employeeMax}` : undefined}
                  onValueChange={(value) => {
                    const range = EMPLOYEE_RANGES.find(r => `${r.min}-${r.max}` === value);
                    if (range) {
                      setFilterCriteria({
                        ...filterCriteria,
                        employeeMin: range.min,
                        employeeMax: range.max || undefined
                      });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_RANGES.map(range => (
                      <SelectItem key={range.label} value={`${range.min}-${range.max}`}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Revenue Range</Label>
                <Select
                  value={filterCriteria.revenueMin ? `${filterCriteria.revenueMin}-${filterCriteria.revenueMax}` : undefined}
                  onValueChange={(value) => {
                    const range = REVENUE_RANGES.find(r => `${r.min}-${r.max}` === value);
                    if (range) {
                      setFilterCriteria({
                        ...filterCriteria,
                        revenueMin: range.min,
                        revenueMax: range.max || undefined
                      });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    {REVENUE_RANGES.map(range => (
                      <SelectItem key={range.label} value={`${range.min}-${range.max}`}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Market Segment</Label>
              <Select
                value={filterCriteria.marketSegment}
                onValueChange={(value) => setFilterCriteria({ ...filterCriteria, marketSegment: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                <SelectContent>
                  {MARKET_SEGMENTS.map(segment => (
                    <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="mb-3 block">Management Levels</Label>
              <div className="space-y-2">
                {MANAGEMENT_LEVELS.map(level => (
                  <div key={level} className="flex items-center space-x-2">
                    <Checkbox
                      id={level}
                      checked={filterCriteria.managementLevels.includes(level)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterCriteria({
                            ...filterCriteria,
                            managementLevels: [...filterCriteria.managementLevels, level]
                          });
                        } else {
                          setFilterCriteria({
                            ...filterCriteria,
                            managementLevels: filterCriteria.managementLevels.filter(l => l !== level)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={level}>{level}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Minimum ICP Fit Score: {filterCriteria.fitScoreMin}</Label>
              <Slider
                value={[filterCriteria.fitScoreMin]}
                onValueChange={(value) => setFilterCriteria({ ...filterCriteria, fitScoreMin: value[0] })}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Define Go-to-Market Sequence</h3>
              <p className="text-sm text-muted-foreground">
                Choose a template or customize your outreach cadence
              </p>
            </div>
            
            <Tabs value={selectedTemplate} onValueChange={(v) => handleTemplateChange(v as keyof typeof SEQUENCE_TEMPLATES)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
                <TabsTrigger value="smb">SMB Velocity</TabsTrigger>
                <TabsTrigger value="partner">Partner</TabsTrigger>
              </TabsList>
              
              <TabsContent value={selectedTemplate} className="mt-4">
                <div className="space-y-3">
                  {sequenceSteps.map((step, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4 flex items-start gap-3">
                        <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold">D{step.day}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{step.action}</div>
                          <div className="text-sm text-muted-foreground">{step.description}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Persona Selection</h3>
              <p className="text-sm text-muted-foreground">
                Refine the personas based on your ICP (pre-populated)
              </p>
            </div>
            
            <div>
              <Label className="mb-3 block">Job Titles</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(activeICP?.persona_job_titles || []).map(title => (
                  <div key={title} className="flex items-center space-x-2">
                    <Checkbox
                      id={title}
                      checked={selectedTitles.includes(title)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTitles([...selectedTitles, title]);
                        } else {
                          setSelectedTitles(selectedTitles.filter(t => t !== title));
                        }
                      }}
                    />
                    <Label htmlFor={title}>{title}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <Label className="mb-3 block">Seniority Levels</Label>
              <div className="space-y-2">
                {(activeICP?.persona_seniority_levels || []).map(level => (
                  <div key={level} className="flex items-center space-x-2">
                    <Checkbox
                      id={level}
                      checked={selectedSeniority.includes(level)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSeniority([...selectedSeniority, level]);
                        } else {
                          setSelectedSeniority(selectedSeniority.filter(s => s !== level));
                        }
                      }}
                    />
                    <Label htmlFor={level}>{level}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <Label className="mb-3 block">Departments</Label>
              <div className="space-y-2">
                {(activeICP?.persona_departments || []).map(dept => (
                  <div key={dept} className="flex items-center space-x-2">
                    <Checkbox
                      id={dept}
                      checked={selectedDepartments.includes(dept)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDepartments([...selectedDepartments, dept]);
                        } else {
                          setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                        }
                      }}
                    />
                    <Label htmlFor={dept}>{dept}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Select Data Provider</h3>
              <p className="text-sm text-muted-foreground">
                Choose your contact data enrichment provider
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {['apollo', 'zoominfo', 'clearbit'].map((p) => (
                <Card
                  key={p}
                  className={`cursor-pointer transition-all ${provider === p ? 'border-primary ring-2 ring-primary' : ''}`}
                  onClick={() => setProvider(p as any)}
                >
                  <CardHeader>
                    <CardTitle className="text-base capitalize">{p}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {p === 'apollo' && '$0.50/contact'}
                      {p === 'zoominfo' && '$0.75/contact'}
                      {p === 'clearbit' && '$1.00/contact'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                Estimated cost will be calculated in the next step based on filtered accounts
              </AlertDescription>
            </Alert>
          </div>
        );
      
      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Campaign Preview</h3>
              <p className="text-sm text-muted-foreground">
                Review the accounts and contacts that will be included
              </p>
            </div>
            
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{estimatedContacts}</div>
                      <div className="text-sm text-muted-foreground">Contacts</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{previewData?.length || 0}</div>
                      <div className="text-sm text-muted-foreground">Accounts</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">${estimatedCost.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">Est. Cost</div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-sm font-medium">Account</th>
                        <th className="text-left p-2 text-sm font-medium">Industry</th>
                        <th className="text-left p-2 text-sm font-medium">Country</th>
                        <th className="text-right p-2 text-sm font-medium">Fit Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData?.slice(0, 10).map((account: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 text-sm">{account.name}</td>
                          <td className="p-2 text-sm">{account.industry_norm}</td>
                          <td className="p-2 text-sm">{account.country}</td>
                          <td className="p-2 text-sm text-right">{account.overall_score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      
      case 7:
        return (
          <div className="space-y-6">
            {pushComplete ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Campaign Created Successfully!</h3>
                <p className="text-muted-foreground">
                  {destination === 'salesforce' 
                    ? `${estimatedContacts} contacts pushed to Salesforce`
                    : `${estimatedContacts} contacts exported as CSV`
                  }
                </p>
                <Button onClick={onClose} className="mt-6">Close</Button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold mb-2">Select Destination</h3>
                  <p className="text-sm text-muted-foreground">
                    Where would you like to send your campaign contacts?
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    className={`cursor-pointer transition-all ${destination === 'salesforce' ? 'border-primary ring-2 ring-primary' : ''}`}
                    onClick={() => setDestination('salesforce')}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">Push to Salesforce</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Automatically create leads/contacts in your CRM
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card
                    className={`cursor-pointer transition-all ${destination === 'csv' ? 'border-primary ring-2 ring-primary' : ''}`}
                    onClick={() => setDestination('csv')}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">Export as CSV</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Download a CSV file for manual import
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <Button
                  onClick={handleCreateCampaign}
                  disabled={isPushing}
                  className="w-full"
                  size="lg"
                >
                  {isPushing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Campaign...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Create Campaign
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Campaign Builder
          </DialogTitle>
          <DialogDescription>
            Create targeted campaigns based on your ICP
          </DialogDescription>
        </DialogHeader>
        
        {loadingICP ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Progress Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                  <div key={s} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      s < step ? 'bg-primary text-primary-foreground' :
                      s === step ? 'bg-primary text-primary-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {s}
                    </div>
                    {s < 7 && (
                      <div className={`w-12 h-1 ${s < step ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Step {step} of 7
              </div>
            </div>
            
            {/* Step Content */}
            <div className="min-h-[400px]">
              {renderStepContent()}
            </div>
            
            {/* Navigation */}
            {!pushComplete && (
              <div className="flex justify-between pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={step === 1}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                
                {step < 7 ? (
                  <Button onClick={handleNext}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
