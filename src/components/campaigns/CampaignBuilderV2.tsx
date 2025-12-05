import { useState, useEffect, useMemo } from "react";
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
import { Sparkles, Users, DollarSign, CheckCircle2, Target, AlertCircle, Loader2, ArrowRight, ArrowLeft, ChevronRight, AlertTriangle, TrendingUp, Zap, BarChart3 } from "lucide-react";
import { MarketIntelligencePreview } from "./MarketIntelligencePreview";
import { formatNumber } from "@/utils/format-numbers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCampaignDeduplication } from "@/hooks/use-campaign-deduplication";
import { AICampaignAssistant } from "./AICampaignAssistant";
import { ApolloCreditsDisplay } from "./ApolloCreditsDisplay";
import { ApolloRedemptionDialog, ICPCriteria } from "./ApolloRedemptionDialog";
import { useApolloCredits } from "@/hooks/use-apollo-credits";

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
  marketSegments: string[];
  managementLevels: string[];
  fitScoreMin: number;
  fitScoreMax: number;
}

interface SequenceStep {
  day: number;
  action: string;
  description: string;
}

const EMPLOYEE_RANGES = [
  { label: "1-200", min: 1, max: 200 },
  { label: "201-1000", min: 201, max: 1000 },
  { label: "1000+", min: 1000, max: null }
];

const REVENUE_RANGES = [
  { label: "< $100M", min: 0, max: 100000000 },
  { label: "$100M - $1B", min: 100000000, max: 1000000000 },
  { label: "$1B+", min: 1000000000, max: null }
];

const MARKET_SEGMENTS = [
  { value: "Enterprise", label: "Enterprise (1000+ employees, $1B+ revenue)" },
  { value: "Mid-Market", label: "Mid-Market (201-1000 employees, $100M-$1B revenue)" },
  { value: "SMB", label: "SMB (1-200 employees, <$100M revenue)" }
];

const MANAGEMENT_LEVELS = ["C-Level", "VP", "Director", "Manager", "Non-Manager"];

const SEQUENCE_TEMPLATES = {
  'enterprise': {
    name: 'Enterprise Sales',
    description: '5-touch, 14 days',
    steps: [
      { day: 1, action: 'Email', description: 'Research-based personalized introduction' },
      { day: 3, action: 'LinkedIn', description: 'Connection request with note' },
      { day: 7, action: 'Email', description: 'Value-focused follow-up' },
      { day: 10, action: 'Phone', description: 'Executive briefing offer' },
      { day: 14, action: 'Email', description: 'Case study share' }
    ]
  },
  'smb': {
    name: 'Velocity Sales',
    description: '4-touch, 10 days',
    steps: [
      { day: 1, action: 'Email', description: 'Quick value proposition' },
      { day: 3, action: 'Email', description: 'Follow-up with demo offer' },
      { day: 7, action: 'Phone', description: 'Direct call' },
      { day: 10, action: 'Email', description: 'Last attempt with offer' }
    ]
  },
  'partner': {
    name: 'Partnership',
    description: '4-touch, 14 days',
    steps: [
      { day: 1, action: 'Email', description: 'Partnership introduction' },
      { day: 5, action: 'LinkedIn', description: 'Connect and engage' },
      { day: 10, action: 'Email', description: 'Collaboration proposal' },
      { day: 14, action: 'Meeting', description: 'Strategy session' }
    ]
  }
};

export function CampaignBuilderV2({ isOpen, onClose, icpId, source }: CampaignBuilderV2Props) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [loadingICP, setLoadingICP] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [useICP, setUseICP] = useState(true);
  const [activeICP, setActiveICP] = useState<ICPProfile | null>(null);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    marketSegments: [],
    managementLevels: ["VP", "C-Level"],
    fitScoreMin: 70, // Default to high-fit accounts
    fitScoreMax: 100
  });
  
  // Apollo TAM data state for 'database' source
  const [apolloTamData, setApolloTamData] = useState<any>(null);
  const [apolloTamDomains, setApolloTamDomains] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof SEQUENCE_TEMPLATES>('enterprise');
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>(SEQUENCE_TEMPLATES.enterprise.steps);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<'all' | 'crm' | 'database'>('all');
  const [provider, setProvider] = useState<'apollo' | 'zoominfo' | 'clearbit'>('apollo');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [estimatedLeads, setEstimatedLeads] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [pushComplete, setPushComplete] = useState(false);
  const [destination, setDestination] = useState<'salesforce' | 'hubspot' | 'csv' | 'apollo'>('salesforce');
  const [excludeDuplicates, setExcludeDuplicates] = useState(true);
  const [showApolloRedemption, setShowApolloRedemption] = useState(false);
  
  // Real-time lead count preview state
  const [realtimeLeadCount, setRealtimeLeadCount] = useState<number | null>(null);
  const [isCountingLeads, setIsCountingLeads] = useState(false);
  
  // CRM sync status
  const [crmSyncStatus, setCrmSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [crmFieldMapping, setCrmFieldMapping] = useState<Record<string, string>>({});
  
  // AI features state
  const [aiGeneratedNames, setAiGeneratedNames] = useState<string[]>([]);
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);
  const [sequenceRecommendations, setSequenceRecommendations] = useState<any>(null);
  const [isOptimizingSequence, setIsOptimizingSequence] = useState(false);
  const [roiEstimate, setRoiEstimate] = useState<any>(null);
  const [isEstimatingROI, setIsEstimatingROI] = useState(false);

  // Get preview contact emails for deduplication check (memoized to prevent infinite loops)
  const previewEmails = useMemo(() => 
    previewData?.map((contact: any) => contact.email).filter(Boolean) || []
  , [previewData]);
  const { duplicateEmails, recentExports, isLoading: isCheckingDuplicates } = useCampaignDeduplication(previewEmails);

  // Real-time lead count as filters change
  useEffect(() => {
    const countLeadsRealtime = async () => {
      if (!userProfile?.org_id || step < 2) return;
      
      setIsCountingLeads(true);
      try {
        // Quick count query for leads matching current filters
        let query = supabase
          .from('Leads')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id)
          .not('email', 'is', null);
        
        const { count } = await query;
        setRealtimeLeadCount(count || 0);
      } catch (error) {
        console.error('[Campaign Builder] Error counting leads:', error);
      } finally {
        setIsCountingLeads(false);
      }
    };
    
    const debounce = setTimeout(countLeadsRealtime, 500);
    return () => clearTimeout(debounce);
  }, [userProfile?.org_id, filterCriteria, step]);

  // Update cost calculation when data source or provider changes
  useEffect(() => {
    if (previewData || apolloTamData) {
      if (dataSource === 'database') {
        const costPerLead = provider === 'apollo' ? 0.50 : provider === 'zoominfo' ? 0.75 : 1.00;
        const accountCount = apolloTamData?.total_accounts || previewData?.length || 0;
        const leadsEstimate = accountCount * 3;
        setEstimatedCost(leadsEstimate * costPerLead);
      } else {
        setEstimatedCost(0);
      }
    }
  }, [dataSource, provider, previewData, apolloTamData]);

  // Load Apollo TAM data when 'database' source is selected
  useEffect(() => {
    const loadApolloTamData = async () => {
      if (!userProfile?.org_id || dataSource !== 'database') {
        setApolloTamData(null);
        setApolloTamDomains([]);
        return;
      }
      
      console.log('[Campaign Builder] Loading Apollo TAM data...');
      try {
        // Fetch from external_data_sources
        const { data: externalSource, error } = await supabase
          .from('external_data_sources')
          .select('*')
          .eq('org_id', userProfile.org_id)
          .eq('provider', 'apollo')
          .single();
        
        if (error) {
          console.error('[Campaign Builder] Error loading Apollo TAM:', error);
          return;
        }
        
        if (externalSource) {
          console.log('[Campaign Builder] Apollo TAM data loaded:', {
            total_accounts: externalSource.total_accounts,
            total_contacts: externalSource.total_contacts
          });
          setApolloTamData(externalSource);
          
          // For Apollo redemption, we'll generate placeholder domains based on industry/geo
          // The redemption function will search Apollo directly using filters
          // Generate a marker to indicate Apollo TAM is available
          setApolloTamDomains(['__apollo_tam__']); // Marker indicating TAM data is available
        }
      } catch (err) {
        console.error('[Campaign Builder] Error loading Apollo TAM:', err);
      }
    };
    
    loadApolloTamData();
  }, [userProfile?.org_id, dataSource]);

  useEffect(() => {
    console.log('[Campaign Builder] Opening with:', { icpId, source, useICP, org_id: userProfile?.org_id });
    if (isOpen && userProfile?.org_id) {
      loadICP();
    }
  }, [isOpen, userProfile?.org_id, icpId]);

  const loadICP = async () => {
    if (!userProfile?.org_id) return;
    console.log('[Campaign Builder] Loading ICP...', { icpId, org_id: userProfile.org_id });
    setLoadingICP(true);
    try {
      let icpToLoad = icpId;
      if (!icpToLoad) {
        const { data: activeICPs } = await supabase.from('icp_profiles').select('id').eq('org_id', userProfile.org_id).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
        if (!activeICPs || activeICPs.length === 0) {
          console.log('[Campaign Builder] No active ICP found');
          toast({ title: "No Active ICP", description: "You can still create a campaign without an ICP" });
          setUseICP(false);
          setLoadingICP(false);
          return;
        }
        icpToLoad = activeICPs[0].id;
      }
      const { data: icp, error } = await supabase.from('icp_profiles').select('*').eq('id', icpToLoad).single();
      if (error) throw error;
      console.log('[Campaign Builder] ICP loaded:', icp);
      setActiveICP(icp);
      if (icp.persona_job_titles) setSelectedTitles(icp.persona_job_titles);
      if (icp.persona_seniority_levels) setSelectedSeniority(icp.persona_seniority_levels);
      if (icp.persona_departments) setSelectedDepartments(icp.persona_departments);
    } catch (error: any) {
      console.error('[Campaign Builder] Error loading ICP:', error);
      toast({ title: "Error", description: "Failed to load ICP profile", variant: "destructive" });
    } finally {
      setLoadingICP(false);
    }
  };

  const handleNext = () => {
    // Step 1 validation
    if (step === 1 && !campaignName.trim()) {
      toast({ title: "Campaign name required", variant: "destructive" });
      return;
    }
    
    // Step 2 validation - if not using ICP, require at least employee OR revenue range
    if (step === 2 && !useICP) {
      if (!filterCriteria.employeeMin && !filterCriteria.revenueMin) {
        toast({ 
          title: "Filter criteria required", 
          description: "Please select at least employee count or revenue range",
          variant: "destructive" 
        });
        return;
      }
    }
    
    console.log(`[Campaign Builder] Moving from step ${step} to ${step + 1}`, {
      useICP,
      campaignName,
      filterCriteria,
      dataSource,
      provider
    });
    
    if (step < 7) {
      const nextStep = step + 1;
      setStep(nextStep);
      // Load preview when entering step 6
      if (nextStep === 6) handleLoadPreview();
    }
  };

  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleLoadPreview = async () => {
    if (!userProfile?.org_id) return;
    setIsLoadingPreview(true);
    
    try {
      console.log('[Campaign Builder] Loading preview with params:', {
        useICP,
        filterCriteria,
        dataSource,
        provider
      });
      
      // Step 1: Load ALL accounts using pagination (Supabase default limit is 1000)
      const pageSize = 1000;
      let allAccounts: any[] = [];
      let page = 0;
      let hasMore = true;
      
      setLoadingProgress('Loading accounts...');
      console.log('[Campaign Builder] Loading all accounts in batches...');
      
      while (hasMore) {
        let query = supabase
          .from('accounts')
          .select('external_id, name, domain, industry_norm, employee_count, revenue_range, country, state_province, city')
          .eq('org_id', userProfile.org_id)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        // Apply data source filter (skip filter if 'all' selected)
        if (dataSource === 'crm') {
          query = query.in('data_source', ['crm', 'both']);
        } else if (dataSource === 'database') {
          query = query.in('data_source', ['database', 'both']);
        }
        // When dataSource === 'all', no filter is applied
        
        // Apply employee filters if not using ICP
        if (!useICP && filterCriteria.employeeMin) {
          query = query.gte('employee_count', filterCriteria.employeeMin);
        }
        if (!useICP && filterCriteria.employeeMax) {
          query = query.lte('employee_count', filterCriteria.employeeMax);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allAccounts = [...allAccounts, ...data];
          setLoadingProgress(`Loading accounts... ${allAccounts.length.toLocaleString()} loaded`);
          console.log(`[Campaign Builder] Loaded batch ${page + 1}: ${data.length} accounts (total: ${allAccounts.length})`);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      const accountsData = allAccounts;
      const totalAccounts = allAccounts.length;
      
      if (!accountsData || accountsData.length === 0) {
        console.log('[Campaign Builder] No accounts found');
        setPreviewData([]);
        setEstimatedLeads(0);
        setLoadingProgress('');
        toast({ title: "No Accounts", description: "No accounts match your criteria", variant: "destructive" });
        return;
      }
      
      console.log('[Campaign Builder] Total accounts loaded:', totalAccounts);
      
      // Step 2: Fetch scores in batches to avoid large IN clause issues
      const accountIds = accountsData.map((a: any) => a.external_id);
      const scoreBatchSize = 100;
      let allScores: any[] = [];
      
      setLoadingProgress(`Loading scores for ${accountIds.length.toLocaleString()} accounts...`);
      console.log(`[Campaign Builder] Loading scores for ${accountIds.length} accounts in batches of ${scoreBatchSize}`);
      
      for (let i = 0; i < accountIds.length; i += scoreBatchSize) {
        const batch = accountIds.slice(i, i + scoreBatchSize);
        const { data: scoresData, error: scoresError } = await supabase
          .from('scores')
          .select('account_external_id, overall, fit, intent')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', batch);
        
        if (scoresError) {
          console.error('[Campaign Builder] Error loading scores batch:', scoresError);
        } else if (scoresData) {
          allScores = [...allScores, ...scoresData];
        }
        setLoadingProgress(`Loading scores... ${allScores.length.toLocaleString()} of ${accountIds.length.toLocaleString()}`);
      }
      
      console.log(`[Campaign Builder] Loaded ${allScores.length} scores for ${accountIds.length} accounts`);
      
      // Create score map for quick lookup
      const scoreMap = new Map(
        allScores.map((s: any) => [s.account_external_id, s])
      );
      
      // Merge accounts with scores
      const accountsWithScores = accountsData.map((acc: any) => {
        const score = scoreMap.get(acc.external_id);
        return {
          ...acc,
          overall_score: score?.overall || 0,
          fit_score: score?.fit || 0,
          intent_score: score?.intent || 0
        };
      });
      
      // Filter by fit score range if specified
      const filteredAccounts = accountsWithScores.filter((acc: any) => 
        acc.overall_score >= filterCriteria.fitScoreMin && 
        acc.overall_score <= filterCriteria.fitScoreMax
      );
      
      console.log('[Campaign Builder] Accounts after score filter:', filteredAccounts.length);
      setPreviewData(filteredAccounts);
      
      // Step 3: Count leads using batched queries to avoid large IN clause issues
      setLoadingProgress(`Counting leads for ${filteredAccounts.length.toLocaleString()} accounts...`);
      if (filteredAccounts.length > 0) {
        const filteredAccountIds = filteredAccounts.map((a: any) => a.external_id);
        let totalLeads = 0;
        const batchSize = 100;
        
        for (let i = 0; i < filteredAccountIds.length; i += batchSize) {
          const batch = filteredAccountIds.slice(i, i + batchSize);
          const { count, error: leadsError } = await supabase
            .from('Leads')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', userProfile.org_id)
            .in('account_external_id', batch)
            .not('email', 'is', null);
          
          if (leadsError) {
            console.error('[Campaign Builder] Error counting leads batch:', leadsError);
          } else {
            totalLeads += count || 0;
          }
          setLoadingProgress(`Counting leads... ${totalLeads.toLocaleString()} found`);
        }
        
        console.log(`[Campaign Builder] Total leads across ${filteredAccounts.length} accounts: ${totalLeads}`);
        setEstimatedLeads(totalLeads);
      } else {
        setEstimatedLeads(0);
      }
      setLoadingProgress('');
      
      // Calculate cost
      if (dataSource === 'database') {
        const costPerContact = provider === 'apollo' ? 0.50 : provider === 'zoominfo' ? 0.75 : 1.00;
        setEstimatedCost((filteredAccounts.length || 0) * costPerContact);
      } else {
        setEstimatedCost(0);
      }
    } catch (error: any) {
      console.error('[Campaign Builder] Error loading preview:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to load campaign preview", 
        variant: "destructive" 
      });
      setPreviewData([]);
      setEstimatedLeads(0);
    } finally {
      setIsLoadingPreview(false);
      setLoadingProgress('');
    }
  };

  const handleCreateCampaign = async () => {
    if (!userProfile?.org_id) return;
    
    if (!previewData || previewData.length === 0) {
      toast({ title: "No Data", description: "Please load preview data first", variant: "destructive" });
      return;
    }
    
    setIsPushing(true);
    try {
      // Filter out duplicates if enabled
      let finalAccounts = previewData || [];
      if (excludeDuplicates && duplicateEmails.size > 0) {
        finalAccounts = finalAccounts.filter((account: any) => 
          !duplicateEmails.has(account.email)
        );
      }

      const campaignData = {
        org_id: userProfile.org_id,
        icp_id: activeICP?.id,
        campaign_name: campaignName,
        filter_criteria: filterCriteria,
        sequence_steps: sequenceSteps,
        persona_criteria: {
          titles: selectedTitles,
          seniority: selectedSeniority,
          departments: selectedDepartments
        },
        provider,
        destination,
        data_source: dataSource,
        contacts: finalAccounts,
        batch_metadata: {
          source_accounts: previewData?.length || 0,
          icp_id: activeICP?.id,
          icp_name: activeICP?.name || 'Custom Campaign',
          icp_criteria: filterCriteria,
          persona_criteria: {
            titles: selectedTitles,
            seniority: selectedSeniority,
            departments: selectedDepartments
          }
        }
      };

      if (destination === 'salesforce') {
        setCrmSyncStatus('syncing');
        const { data, error } = await supabase.functions.invoke('push-campaign-to-crm', {
          body: campaignData
        });
        if (error) {
          setCrmSyncStatus('error');
          throw error;
        }
        setCrmSyncStatus('success');
        toast({ title: "Campaign Created", description: `Successfully pushed ${formatNumber(estimatedLeads)} leads to Salesforce` });
        setPushComplete(true);
      } else if (destination === 'hubspot') {
        setCrmSyncStatus('syncing');
        const { data, error } = await supabase.functions.invoke('hubspot-sync', {
          body: { ...campaignData, action: 'push_campaign' }
        });
        if (error) {
          setCrmSyncStatus('error');
          throw error;
        }
        setCrmSyncStatus('success');
        toast({ title: "Campaign Created", description: `Successfully pushed ${formatNumber(estimatedLeads)} contacts to HubSpot` });
        setPushComplete(true);
      } else {
        // CSV Export with better error handling
        console.log('[Campaign Builder] Starting CSV export...');
        try {
          const csvContent = await generateCSV(previewData);
          if (!csvContent || csvContent.split('\n').length <= 1) {
            throw new Error('No leads found to export. Make sure accounts have contacts with emails.');
          }
          downloadCSV(csvContent, `${campaignName || 'campaign'}.csv`);
          const rowCount = csvContent.split('\n').length - 1;
          toast({ title: "Campaign Exported", description: `Downloaded ${rowCount} leads as CSV` });
          setPushComplete(true);
        } catch (csvError: any) {
          console.error('[Campaign Builder] CSV generation error:', csvError);
          toast({ 
            title: "Export Failed", 
            description: csvError.message || "Failed to generate CSV file",
            variant: "destructive" 
          });
        }
      }
    } catch (error: any) {
      console.error('[Campaign Builder] Error creating campaign:', error);
      toast({ title: "Error", description: error.message || "Failed to create campaign", variant: "destructive" });
    } finally {
      setIsPushing(false);
    }
  };

  const generateCSV = async (accountData: any[] | null) => {
    if (!accountData || accountData.length === 0 || !userProfile?.org_id) {
      throw new Error('No preview data available. Please load the preview first.');
    }
    
    // Fetch actual leads with emails for the accounts using batched queries
    const accountIds = accountData.map((a: any) => a.external_id);
    const allLeads: any[] = [];
    const batchSize = 100;
    
    console.log(`[Campaign Builder] Fetching leads for ${accountIds.length} accounts in batches...`);
    
    for (let i = 0; i < accountIds.length; i += batchSize) {
      const batch = accountIds.slice(i, i + batchSize);
      const { data: leads, error } = await supabase
        .from('Leads')
        .select('email, first_name, last_name, title, persona, level, phone, direct_phone, cell_phone, mobile, linkedin_url, account_external_id')
        .eq('org_id', userProfile.org_id)
        .in('account_external_id', batch)
        .not('email', 'is', null);
      
      if (error) {
        console.error(`[Campaign Builder] Error fetching leads batch ${i}:`, error);
        continue;
      }
      
      if (leads) {
        allLeads.push(...leads);
      }
    }
    
    console.log(`[Campaign Builder] Total leads fetched: ${allLeads.length}`);
    
    if (allLeads.length === 0) {
      throw new Error('No contacts with email found for selected accounts.');
    }
    
    // Create maps for account data lookup
    const accountMap = new Map(accountData.map((a: any) => [a.external_id, a]));
    
    // Enhanced CSV with full contact intelligence
    const headers = [
      'Email', 'First Name', 'Last Name', 'Title', 'Phone', 'LinkedIn URL',
      'Company', 'Domain', 'Industry', 'Employee Count', 'Revenue Range',
      'Country', 'State', 'City', 'Persona', 'Seniority',
      'Overall Score', 'Fit Score', 'Score Band', 'Account ID'
    ];
    
    const rows = allLeads.map(lead => {
      const account = accountMap.get(lead.account_external_id) || {};
      const phone = lead.direct_phone || lead.cell_phone || lead.mobile || lead.phone || '';
      const overallScore = account.overall_score || 0;
      const scoreBand = overallScore >= 70 ? 'A' : overallScore >= 40 ? 'B' : 'C';
      
      return [
        lead.email || '',
        lead.first_name || '',
        lead.last_name || '',
        lead.title || '',
        phone,
        lead.linkedin_url || '',
        account.name || '',
        account.domain || '',
        account.industry_norm || '',
        account.employee_count || '',
        account.revenue_range || '',
        account.country || '',
        account.state_province || '',
        account.city || '',
        lead.persona || '',
        lead.level || '',
        overallScore,
        account.fit_score || 0,
        scoreBand,
        lead.account_external_id || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    
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
    setSequenceSteps(SEQUENCE_TEMPLATES[template].steps);
  };

  // AI Functions
  const generateCampaignNames = async () => {
    if (!userProfile?.org_id) return;
    setIsGeneratingNames(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-name', {
        body: {
          icpName: activeICP?.name || 'General',
          targetSegment: filterCriteria.marketSegments.join(', '),
          campaignGoals: 'Lead generation',
          industries: activeICP?.industries,
          geographies: activeICP?.geographies
        }
      });
      if (error) throw error;
      setAiGeneratedNames(data.suggestions);
      toast({ title: "AI Names Generated", description: "Choose from AI-suggested campaign names" });
    } catch (error: any) {
      console.error('Error generating names:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingNames(false);
    }
  };

  const optimizeSequence = async () => {
    if (!userProfile?.org_id) return;
    setIsOptimizingSequence(true);
    try {
      const avgDealSize = 50000; // Could pull from historical data
      const { data, error } = await supabase.functions.invoke('optimize-sequence', {
        body: {
          targetPersona: selectedSeniority.join(', '),
          marketSegment: filterCriteria.marketSegments[0] || 'General',
          avgDealSize,
          accountCount: previewData?.length || 0
        }
      });
      if (error) throw error;
      setSequenceRecommendations(data);
      toast({ title: "Sequence Optimized", description: "AI recommendations available" });
    } catch (error: any) {
      console.error('Error optimizing sequence:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsOptimizingSequence(false);
    }
  };

  const estimateROI = async () => {
    if (!userProfile?.org_id || !previewData) return;
    setIsEstimatingROI(true);
    try {
      // Calculate average fit score
      const scores = previewData.map((acc: any) => acc.overall_score || 0);
      const avgFitScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

      const { data, error } = await supabase.functions.invoke('estimate-campaign-roi', {
        body: {
          accountCount: previewData.length,
          avgFitScore,
          dataSource,
          provider,
          orgId: userProfile.org_id,
          leadCount: estimatedLeads // Pass actual lead count for smarter projections
        }
      });
      if (error) throw error;
      setRoiEstimate(data);
      toast({ title: "ROI Calculated", description: "Budget projection ready" });
    } catch (error: any) {
      console.error('Error estimating ROI:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsEstimatingROI(false);
    }
  };

  // Calculate score band breakdown for real-time preview
  const scoreBandBreakdown = useMemo(() => {
    if (!previewData) return { A: 0, B: 0, C: 0 };
    const breakdown = { A: 0, B: 0, C: 0 };
    previewData.forEach((acc: any) => {
      const score = acc.overall_score || 0;
      if (score >= 70) breakdown.A++;
      else if (score >= 40) breakdown.B++;
      else breakdown.C++;
    });
    return breakdown;
  }, [previewData]);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={generateCampaignNames}
                  disabled={isGeneratingNames}
                  className="gap-2"
                >
                  <Sparkles className="h-3 w-3" />
                  {isGeneratingNames ? "Generating..." : "AI Generate"}
                </Button>
              </div>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Q1 Enterprise Outreach"
                className="mt-2"
              />
              {aiGeneratedNames.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">AI Suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {aiGeneratedNames.map((name, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                        onClick={() => setCampaignName(name)}
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-icp"
                  checked={useICP}
                  onCheckedChange={(checked) => setUseICP(checked === true)}
                  disabled={!activeICP}
                />
                <Label htmlFor="use-icp" className="flex items-center gap-2">
                  Use Ideal Customer Profile (ICP)
                  {!activeICP && <span className="text-muted-foreground ml-2">(No ICP configured)</span>}
                  <span className="text-xs text-muted-foreground">
                    (Pre-filters accounts by your ICP scoring criteria)
                  </span>
                </Label>
              </div>
              
              {/* Cost Preview */}
              <Alert className="bg-primary/5 border-primary/20">
                <DollarSign className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Estimated Cost Preview</div>
                  <div className="text-sm">
                    • CRM Source: <strong>$0</strong> (use existing contacts, no enrichment needed)
                  </div>
                  <div className="text-sm">
                    • Database Source: <strong>$0.50-$1.00/contact</strong> (requires enrichment credits)
                  </div>
                </AlertDescription>
              </Alert>
            </div>
            
            {/* Show alert if ICP checked but no ICP exists */}
            {useICP && !activeICP && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No ICP profile found. Please create an ICP first or uncheck "Use ICP" to target all accounts.
                </AlertDescription>
              </Alert>
            )}
            
            {activeICP && useICP && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle>ICP Context</CardTitle>
                  <CardDescription>{activeICP.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Industries:</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {activeICP.industries?.join(', ') || 'All'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeICP.industries?.map(ind => <Badge key={ind} variant="secondary">{ind}</Badge>)}
                    {activeICP.geographies?.map(geo => <Badge key={geo} variant="outline">{geo}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Show what happens when NOT using ICP */}
            {!useICP && (
              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>
                  Will target all available accounts. You can refine criteria in the next step.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Targeting Filters</h3>
              <p className="text-sm text-muted-foreground">Define who you want to target by company size, revenue, market segment, and management level</p>
            </div>
            
            {/* Real-time preview at top of Step 2 */}
            <Card className="bg-gradient-to-r from-primary/5 to-muted border-primary/20">
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Available Leads</div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      {isCountingLeads ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        formatNumber(realtimeLeadCount || 0)
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Estimated Cost</div>
                    <div className="text-2xl font-bold">${estimatedCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Data Source</div>
                    <div className="text-lg font-semibold">
                      {dataSource === 'all' ? 'All Sources' : dataSource === 'crm' ? 'CRM (Free)' : provider}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {!useICP && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Employee Count</Label>
                  <Select
                    onValueChange={(value) => {
                      const range = EMPLOYEE_RANGES.find(r => r.label === value);
                      setFilterCriteria({
                        ...filterCriteria,
                        employeeMin: range?.min,
                        employeeMax: range?.max
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_RANGES.map(range => (
                        <SelectItem key={range.label} value={range.label}>{range.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Revenue Range</Label>
                  <Select
                    onValueChange={(value) => {
                      const range = REVENUE_RANGES.find(r => r.label === value);
                      setFilterCriteria({
                        ...filterCriteria,
                        revenueMin: range?.min,
                        revenueMax: range?.max
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map(range => (
                        <SelectItem key={range.label} value={range.label}>{range.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div>
              <Label className="mb-3 block">
                Market Segment (Select all that apply)
                <span className="text-xs text-muted-foreground block mt-1">
                  These segments combine employee count and revenue filters
                </span>
              </Label>
              <div className="space-y-2">
                {MARKET_SEGMENTS.map(segment => (
                  <div key={segment.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={segment.value}
                      checked={filterCriteria.marketSegments.includes(segment.value)}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          setFilterCriteria({
                            ...filterCriteria,
                            marketSegments: [...filterCriteria.marketSegments, segment.value]
                          });
                        } else {
                          setFilterCriteria({
                            ...filterCriteria,
                            marketSegments: filterCriteria.marketSegments.filter(s => s !== segment.value)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={segment.value} className="cursor-pointer">{segment.label}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">
                Fit Score Range: <span className="font-semibold text-primary">{filterCriteria.fitScoreMin} - {filterCriteria.fitScoreMax}</span>
              </Label>
              <Slider
                value={[filterCriteria.fitScoreMin, filterCriteria.fitScoreMax]}
                onValueChange={(value) => setFilterCriteria({
                  ...filterCriteria,
                  fitScoreMin: value[0],
                  fitScoreMax: value[1]
                })}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Filter accounts by their fit score range (0-100)
              </p>
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-2">Define Go-to-Market Sequence</h3>
                <p className="text-sm text-muted-foreground">Choose a template or customize your outreach cadence</p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={optimizeSequence}
                disabled={isOptimizingSequence}
                className="gap-2"
              >
                <Sparkles className="h-3 w-3" />
                {isOptimizingSequence ? "Optimizing..." : "AI Optimize"}
              </Button>
            </div>
            {sequenceRecommendations && (
              <Alert className="bg-primary/5 border-primary/20">
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">AI Recommendation: {sequenceRecommendations.recommendedTemplate.toUpperCase()}</div>
                  <p className="text-xs">{sequenceRecommendations.reasoning}</p>
                  {sequenceRecommendations.personalizationTips && (
                    <ul className="mt-2 text-xs space-y-1">
                      {sequenceRecommendations.personalizationTips.map((tip: string, idx: number) => (
                        <li key={idx}>• {tip}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Tabs value={selectedTemplate} onValueChange={(v) => handleTemplateChange(v as keyof typeof SEQUENCE_TEMPLATES)}>
              <TabsList className="grid w-full grid-cols-3">
                {Object.keys(SEQUENCE_TEMPLATES).map(templateKey => (
                  <TabsTrigger key={templateKey} value={templateKey}>{SEQUENCE_TEMPLATES[templateKey as keyof typeof SEQUENCE_TEMPLATES].name}</TabsTrigger>
                ))}
              </TabsList>
              {Object.keys(SEQUENCE_TEMPLATES).map(templateKey => (
                <TabsContent key={templateKey} value={templateKey} className="mt-4">
                  <div className="space-y-3">
                    {SEQUENCE_TEMPLATES[templateKey as keyof typeof SEQUENCE_TEMPLATES].steps.map((step, idx) => (
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
              ))}
            </Tabs>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Persona Selection</h3>
              <p className="text-sm text-muted-foreground">Refine the personas based on your ICP (pre-populated)</p>
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
              <p className="text-sm text-muted-foreground">Choose your contact data enrichment provider</p>
            </div>
            <Alert className="bg-muted/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Data Source Explained</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>CRM:</strong> Use your existing contacts (free, no enrichment cost). Campaign-ready contacts have email, title, and persona already identified.
                  </div>
                  <div>
                    <strong>Database:</strong> Enrich from external providers like Apollo (requires credits, typically $0.50-$1.00 per contact).
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center space-x-4">
              <Label>Data Source:</Label>
              <Select value={dataSource} onValueChange={(value) => setDataSource(value as 'all' | 'crm' | 'database')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources (CRM + Apollo TAM)</SelectItem>
                  <SelectItem value="crm">CRM Accounts Only (Free)</SelectItem>
                  <SelectItem value="database">Apollo Available Market (Requires Credits)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dataSource === 'database' && (
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
            )}
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>Estimated cost will be calculated in the next step based on filtered accounts</AlertDescription>
            </Alert>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Market Intelligence Preview
                </h3>
                <p className="text-sm text-muted-foreground">
                  Comprehensive view of your available market data (no contact PII shown)
                </p>
              </div>
              {previewData && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={estimateROI}
                  disabled={isEstimatingROI}
                  className="gap-2"
                >
                  <Sparkles className="h-3 w-3" />
                  {isEstimatingROI ? "Calculating..." : "Calculate ROI"}
                </Button>
              )}
            </div>

            {/* ROI Estimate Card */}
            {roiEstimate && (
              <Card className="bg-gradient-to-br from-primary/5 to-green-500/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    ROI Projection
                    <Badge variant="outline">{roiEstimate.confidence} confidence</Badge>
                    {roiEstimate.dataQuality?.hasEnoughData && (
                      <Badge variant="secondary" className="text-xs">Based on your data</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-2xl font-bold text-green-500">{roiEstimate.roi.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Expected ROI</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{roiEstimate.estimatedMeetings}</div>
                      <div className="text-xs text-muted-foreground">Est. Meetings</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{roiEstimate.estimatedDeals}</div>
                      <div className="text-xs text-muted-foreground">Est. Deals</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">${formatNumber(roiEstimate.estimatedRevenue)}</div>
                      <div className="text-xs text-muted-foreground">Projected Revenue</div>
                    </div>
                  </div>
                  {roiEstimate.dataQuality && (
                    <div className="text-xs text-muted-foreground border-t pt-3 mt-2">
                      <span className="font-medium">Data Quality:</span> {roiEstimate.dataQuality.closedWonDeals} closed-won deals analyzed
                      {roiEstimate.dataQuality.conversionByBand && (
                        <span className="ml-3">
                          Conversion rates: A-Band {roiEstimate.dataQuality.conversionByBand.A}, 
                          B-Band {roiEstimate.dataQuality.conversionByBand.B}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isLoadingPreview ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                {loadingProgress && (
                  <p className="text-sm text-muted-foreground">{loadingProgress}</p>
                )}
              </div>
            ) : (
              <>
                {/* Market Intelligence Preview Component */}
                <MarketIntelligencePreview 
                  dataSource={dataSource}
                  fitScoreMin={filterCriteria.fitScoreMin}
                  fitScoreMax={filterCriteria.fitScoreMax}
                />

                {/* Deduplication Warning */}
                {duplicateEmails.size > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-1">
                        {duplicateEmails.size} contacts were exported in the last 90 days
                      </div>
                      <div className="text-sm mb-2">
                        These contacts have been exported in {recentExports.length} recent campaign(s).
                      </div>
                      <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                          id="exclude-duplicates"
                          checked={excludeDuplicates}
                          onCheckedChange={(checked) => setExcludeDuplicates(checked === true)}
                        />
                        <Label htmlFor="exclude-duplicates" className="text-sm cursor-pointer">
                          Exclude duplicate contacts from this export
                        </Label>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {isCheckingDuplicates && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for duplicate emails...
                  </div>
                )}

                {/* Apollo TAM Summary - shown for 'database' source */}
                {dataSource === 'database' && apolloTamData && (
                  <Card className="bg-amber-500/5 border-amber-500/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Apollo Available Market
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-2xl font-bold">{formatNumber(apolloTamData.total_accounts || 0)}</div>
                          <div className="text-xs text-muted-foreground">Total Accounts</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{formatNumber(apolloTamData.total_contacts || 0)}</div>
                          <div className="text-xs text-muted-foreground">Total Contacts</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-amber-500">{formatNumber(apolloTamData.credits_remaining || 0)}</div>
                          <div className="text-xs text-muted-foreground">Credits Available</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-500">{Object.keys(apolloTamData.industry_breakdown || {}).length}</div>
                          <div className="text-xs text-muted-foreground">Industries</div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This data represents your Apollo available market. Select "Apollo" as destination in the next step to redeem contacts.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Account Preview Table (no PII) - shown for CRM sources */}
                {dataSource !== 'database' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Sample Accounts ({formatNumber(previewData?.length || 0)} total)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
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
                                <td className="p-2 text-sm text-right">
                                  <Badge variant={account.overall_score >= 70 ? "default" : account.overall_score >= 40 ? "secondary" : "outline"} 
                                         className={account.overall_score >= 70 ? "bg-green-500" : ""}>
                                    {account.overall_score}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
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
                  {destination === 'salesforce' && `${formatNumber(estimatedLeads)} leads pushed to Salesforce`}
                  {destination === 'hubspot' && `${formatNumber(estimatedLeads)} contacts pushed to HubSpot`}
                  {destination === 'csv' && `${formatNumber(estimatedLeads)} leads exported as CSV`}
                  {destination === 'apollo' && `Contacts redeemed from Apollo`}
                </p>
                <Button onClick={onClose} className="mt-6">Close</Button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold mb-2">Select Destination</h3>
                  <p className="text-sm text-muted-foreground">Where would you like to send your campaign contacts?</p>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <Card
                    className={`cursor-pointer transition-all ${destination === 'salesforce' ? 'border-primary ring-2 ring-primary' : ''}`}
                    onClick={() => setDestination('salesforce')}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Salesforce</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Create leads in Salesforce CRM</p>
                      {destination === 'salesforce' && (
                        <div className="mt-3 pt-3 border-t text-xs space-y-1">
                          <div className="flex justify-between"><span>Email →</span><span className="text-muted-foreground">Lead.Email</span></div>
                          <div className="flex justify-between"><span>Company →</span><span className="text-muted-foreground">Lead.Company</span></div>
                          <div className="flex justify-between"><span>Title →</span><span className="text-muted-foreground">Lead.Title</span></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer transition-all ${destination === 'hubspot' ? 'border-primary ring-2 ring-primary' : ''}`}
                    onClick={() => setDestination('hubspot')}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">HubSpot</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Create contacts in HubSpot CRM</p>
                      {destination === 'hubspot' && (
                        <div className="mt-3 pt-3 border-t text-xs space-y-1">
                          <div className="flex justify-between"><span>Email →</span><span className="text-muted-foreground">email</span></div>
                          <div className="flex justify-between"><span>Company →</span><span className="text-muted-foreground">company</span></div>
                          <div className="flex justify-between"><span>Title →</span><span className="text-muted-foreground">jobtitle</span></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer transition-all ${destination === 'csv' ? 'border-primary ring-2 ring-primary' : ''}`}
                    onClick={() => setDestination('csv')}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Export CSV</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Download file for manual import</p>
                      {destination === 'csv' && (
                        <div className="mt-3 pt-3 border-t text-xs">
                          <span className="text-muted-foreground">20 fields including scores, firmographics, and contact intel</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer transition-all ${destination === 'apollo' ? 'border-primary ring-2 ring-primary' : 'border-amber-500/50'}`}
                    onClick={() => setDestination('apollo')}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Apollo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Redeem contacts from Apollo (uses credits)</p>
                      {destination === 'apollo' && (
                        <div className="mt-3 pt-3 border-t text-xs">
                          <ApolloCreditsDisplay compact />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                {/* CRM Sync Status */}
                {(destination === 'salesforce' || destination === 'hubspot') && (
                  <Alert className="bg-muted/50">
                    <Target className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        {estimatedLeads} contacts will be created in {destination === 'salesforce' ? 'Salesforce' : 'HubSpot'}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {crmSyncStatus === 'idle' && 'Ready to sync'}
                        {crmSyncStatus === 'syncing' && 'Syncing...'}
                        {crmSyncStatus === 'success' && 'Synced'}
                        {crmSyncStatus === 'error' && 'Sync failed'}
                      </Badge>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Apollo Info */}
                {destination === 'apollo' && (
                  <Alert className="bg-amber-500/10 border-amber-500/50">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <AlertDescription>
                      <div className="font-medium mb-1">Redeem contacts from Apollo</div>
                      <p className="text-sm text-muted-foreground">
                        {dataSource === 'database' ? (
                          <>
                            Contacts will be imported from Apollo Available Market ({formatNumber(apolloTamData?.total_accounts || 0)} accounts available). 
                            Use persona filters in the next step to narrow down contacts.
                          </>
                        ) : (
                          <>
                            Contacts will be imported from Apollo for the {formatNumber(previewData?.length || 0)} selected accounts. 
                            Duplicates (existing leads, CRM contacts, previous exports) will be automatically skipped.
                          </>
                        )}
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {destination === 'apollo' ? (
                  <Button
                    onClick={() => setShowApolloRedemption(true)}
                    disabled={
                      dataSource === 'database' 
                        ? apolloTamDomains.length === 0 
                        : (!previewData || previewData.length === 0)
                    }
                    className="w-full"
                    size="lg"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Redeem Apollo Contacts ({dataSource === 'database' ? formatNumber(apolloTamData?.total_accounts || 0) : formatNumber(previewData?.length || 0)} accounts)
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateCampaign}
                    disabled={isPushing || !previewData || previewData.length === 0}
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
                )}
              </>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Campaign Builder</DialogTitle>
              <DialogDescription>Create a targeted campaign in 7 steps</DialogDescription>
            </div>
            <ApolloCreditsDisplay compact />
          </div>
        </DialogHeader>
        {loadingICP ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_320px] gap-6">
            {/* Main Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
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
              <div className="min-h-[400px]">
                {renderStepContent()}
              </div>
              {!pushComplete && (
                <div className="flex justify-between pt-6 border-t mt-6">
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
            </div>
            
            {/* AI Assistant Sidebar */}
            <div className="border-l pl-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <AICampaignAssistant 
                step={step}
                icpName={activeICP?.name}
                targetSegment={filterCriteria.marketSegments[0]}
                accountCount={previewData?.length}
                avgFitScore={previewData ? 
                  previewData.reduce((sum: number, acc: any) => sum + (acc.overall_score || 0), 0) / previewData.length 
                  : undefined
                }
                dataQuality={previewData ? {
                  hasEmails: previewData.filter((acc: any) => acc.email).length,
                  hasPhones: previewData.filter((acc: any) => acc.phone).length,
                  hasVerifiedEmails: previewData.filter((acc: any) => acc.email_verified).length
                } : undefined}
              />
            </div>
          </div>
        )}
      </DialogContent>
      
      {/* Apollo Redemption Dialog */}
      <ApolloRedemptionDialog
        open={showApolloRedemption}
        onOpenChange={setShowApolloRedemption}
        accountDomains={
          dataSource === 'database' 
            ? apolloTamDomains 
            : (previewData?.map((a: any) => a.domain).filter(Boolean) || [])
        }
        icpCriteria={dataSource === 'database' && activeICP ? {
          industries: activeICP.industries,
          geographies: activeICP.geographies,
          company_sizes: activeICP.company_sizes,
          revenue_ranges: activeICP.revenue_ranges
        } : undefined}
        campaignName={campaignName}
        onRedemptionComplete={(result) => {
          setPushComplete(true);
          setEstimatedLeads(result.contactsRedeemed);
        }}
      />
    </Dialog>
  );
}
