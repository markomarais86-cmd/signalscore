import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { useCampaignDeduplication } from "@/hooks/use-campaign-deduplication";
import { AICampaignAssistant } from "./AICampaignAssistant";
import { ApolloCreditsDisplay } from "./ApolloCreditsDisplay";
import { ApolloRedemptionDialog } from "./ApolloRedemptionDialog";
import { campaignsLogger } from "@/lib/logger";
import { useEffectiveOrg } from "@/hooks/use-effective-org";

// Hooks
import { useCampaignState, InsightContext, ICPProfile } from "./hooks/useCampaignState";
import { useCampaignData } from "./hooks/useCampaignData";
import { useCampaignExport } from "./hooks/useCampaignExport";

// Step Components
import { SetupStep } from "./steps/SetupStep";
import { TargetingStep } from "./steps/TargetingStep";
import { SequenceStep } from "./steps/SequenceStep";
import { PersonaStep } from "./steps/PersonaStep";
import { DataSourceStep } from "./steps/DataSourceStep";
import { PreviewStep } from "./steps/PreviewStep";
import { ExportStep } from "./steps/ExportStep";

export type { InsightContext } from "./hooks/useCampaignState";

interface CampaignBuilderV2Props {
  isOpen: boolean;
  onClose: () => void;
  icpId?: string;
  source: 'icp-manager' | 'executive-dashboard' | 'insight';
  insightContext?: InsightContext;
}

export function CampaignBuilderV2({ isOpen, onClose, icpId, source, insightContext }: CampaignBuilderV2Props) {
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const { toast } = useToast();
  
  // Core state management
  const campaignState = useCampaignState(insightContext);
  const { state, setStep, setCampaignName, setFuelLineType, setUseICP, setActiveICP,
          setFilterCriteria, setSelectedTemplate,
          setSelectedTitles, setSelectedSeniority,
          setSelectedDepartments, setDataSource, setProvider,
          setDestination, setExcludeDuplicates, reset } = campaignState;
  
  // Destructure state for easier access
  const { step, campaignName, fuelLineType, useICP, activeICP, filterCriteria, selectedTemplate,
          sequenceSteps, selectedTitles, selectedSeniority, selectedDepartments,
          dataSource, provider, destination, excludeDuplicates } = state;

  // Suppression toggle
  const [applySuppression, setApplySuppression] = useState(true);

  // Data fetching
  const campaignData = useCampaignData(filterCriteria, dataSource, useICP, applySuppression);
  const { previewData, suppressedCount, suppressionRuleCount, estimatedLeads, estimatedCost, setEstimatedCost, isLoadingPreview,
          loadingProgress, realtimeLeadCount, isCountingLeads, apolloTamData, apolloTamDomains,
          loadPreview, scoreBandBreakdown } = campaignData;

  // Export functionality
  const exportHook = useCampaignExport();
  const { isPushing, pushComplete, crmSyncStatus, createCampaign, reset: resetExport } = exportHook;

  // Local state
  const [loadingICP, setLoadingICP] = useState(false);
  const [showApolloRedemption, setShowApolloRedemption] = useState(false);
  
  // AI features state
  const [aiGeneratedNames, setAiGeneratedNames] = useState<string[]>([]);
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);
  const [sequenceRecommendations, setSequenceRecommendations] = useState<any>(null);
  const [isOptimizingSequence, setIsOptimizingSequence] = useState(false);
  const [roiEstimate, setRoiEstimate] = useState<any>(null);
  const [isEstimatingROI, setIsEstimatingROI] = useState(false);

  // Deduplication check
  const previewEmails = useMemo(() => 
    previewData?.map((contact: any) => contact.email).filter(Boolean) || []
  , [previewData]);
  const { duplicateEmails } = useCampaignDeduplication(previewEmails);

  // Load ICP on open
  useEffect(() => {
    if (isOpen && effectiveOrgId) {
      loadICP();
    }
  }, [isOpen, effectiveOrgId, icpId]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      reset();
      resetExport();
      setRoiEstimate(null);
      setAiGeneratedNames([]);
      setSequenceRecommendations(null);
    }
  }, [isOpen]);

  const loadICP = async () => {
    if (!effectiveOrgId) return;
    setLoadingICP(true);
    try {
      let icpToLoad = icpId;
      if (!icpToLoad) {
        const { data: activeICPs } = await supabase.from('icp_profiles').select('id').eq('org_id', effectiveOrgId).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
        if (!activeICPs || activeICPs.length === 0) {
          toast({ title: "No Active ICP", description: "You can still create a campaign without an ICP" });
          setUseICP(false);
          setLoadingICP(false);
          return;
        }
        icpToLoad = activeICPs[0].id;
      }
      const { data: icp, error } = await supabase.from('icp_profiles').select('*').eq('id', icpToLoad).single();
      if (error) throw error;
      setActiveICP(icp);
    } catch (error: any) {
      campaignsLogger.error('Error loading ICP:', error);
      toast({ title: "Error", description: "Failed to load ICP profile", variant: "destructive" });
    } finally {
      setLoadingICP(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !campaignName.trim()) {
      toast({ title: "Campaign name required", variant: "destructive" });
      return;
    }
    if (step === 2 && !useICP && !filterCriteria.employeeMin && !filterCriteria.revenueMin) {
      toast({ title: "Filter criteria required", description: "Please select at least employee count or revenue range", variant: "destructive" });
      return;
    }
    if (step < 7) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep === 6) loadPreview(provider);
    }
  };

  const handleBack = () => { if (step > 1) setStep(step - 1); };

  // AI Functions
  const generateCampaignNames = async () => {
    if (!effectiveOrgId) return;
    setIsGeneratingNames(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-name', {
        body: { icpName: activeICP?.name || 'General', targetSegment: filterCriteria.marketSegments.join(', '), campaignGoals: 'Lead generation', industries: activeICP?.industries, geographies: activeICP?.geographies }
      });
      if (error) throw error;
      setAiGeneratedNames(data.suggestions);
      toast({ title: "AI Names Generated", description: "Choose from AI-suggested campaign names" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingNames(false);
    }
  };

  const optimizeSequence = async () => {
    if (!effectiveOrgId) return;
    setIsOptimizingSequence(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-sequence', {
        body: { targetPersona: selectedSeniority.join(', '), marketSegment: filterCriteria.marketSegments[0] || 'General', avgDealSize: 50000, accountCount: previewData?.length || 0 }
      });
      if (error) throw error;
      setSequenceRecommendations(data);
      toast({ title: "Sequence Optimized", description: "AI recommendations available" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsOptimizingSequence(false);
    }
  };

  const estimateROI = async () => {
    if (!effectiveOrgId || !previewData) return;
    setIsEstimatingROI(true);
    try {
      const scores = previewData.map((acc: any) => acc.overall_score || 0);
      const avgFitScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      const { data, error } = await supabase.functions.invoke('estimate-campaign-roi', {
        body: { accountCount: previewData.length, avgFitScore, dataSource, provider, orgId: effectiveOrgId, leadCount: estimatedLeads }
      });
      if (error) throw error;
      setRoiEstimate(data);
      toast({ title: "ROI Calculated", description: "Budget projection ready" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsEstimatingROI(false);
    }
  };

  const handleCreateCampaign = () => {
    createCampaign({
      campaignName, filterCriteria, sequenceSteps, selectedTitles, selectedSeniority,
      selectedDepartments, provider, destination, dataSource, excludeDuplicates,
      activeICP, previewData, estimatedLeads, duplicateEmails
    });
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <SetupStep
            campaignName={campaignName}
            setCampaignName={setCampaignName}
            fuelLineType={fuelLineType}
            setFuelLineType={setFuelLineType}
            useICP={useICP}
            setUseICP={setUseICP}
            activeICP={activeICP}
            aiGeneratedNames={aiGeneratedNames}
            isGeneratingNames={isGeneratingNames}
            onGenerateNames={generateCampaignNames}
          />
        );
      case 2:
        return (
          <TargetingStep
            useICP={useICP}
            filterCriteria={filterCriteria}
            setFilterCriteria={setFilterCriteria}
            realtimeLeadCount={realtimeLeadCount}
            isCountingLeads={isCountingLeads}
            estimatedCost={estimatedCost}
            dataSource={dataSource}
            provider={provider}
          />
        );
      case 3:
        return (
          <SequenceStep
            selectedTemplate={selectedTemplate}
            onTemplateChange={setSelectedTemplate}
            sequenceRecommendations={sequenceRecommendations}
            isOptimizingSequence={isOptimizingSequence}
            onOptimizeSequence={optimizeSequence}
          />
        );
      case 4:
        return (
          <PersonaStep
            activeICP={activeICP}
            selectedTitles={selectedTitles}
            setSelectedTitles={setSelectedTitles}
            selectedSeniority={selectedSeniority}
            setSelectedSeniority={setSelectedSeniority}
            selectedDepartments={selectedDepartments}
            setSelectedDepartments={setSelectedDepartments}
          />
        );
      case 5:
        return (
          <DataSourceStep
            dataSource={dataSource}
            setDataSource={setDataSource}
            provider={provider}
            setProvider={setProvider}
            estimatedCost={estimatedCost}
            apolloTamData={apolloTamData}
            applySuppression={applySuppression}
            setApplySuppression={setApplySuppression}
            suppressionRuleCount={suppressionRuleCount}
          />
        );
      case 6:
        return (
          <PreviewStep
            dataSource={dataSource}
            fitScoreMin={filterCriteria.fitScoreMin}
            fitScoreMax={filterCriteria.fitScoreMax}
            previewData={previewData}
            apolloTamData={apolloTamData}
            isLoadingPreview={isLoadingPreview}
            loadingProgress={loadingProgress}
            estimatedLeads={estimatedLeads}
            roiEstimate={roiEstimate}
            isEstimatingROI={isEstimatingROI}
            duplicateEmails={duplicateEmails}
            excludeDuplicates={excludeDuplicates}
            setExcludeDuplicates={setExcludeDuplicates}
            onEstimateROI={estimateROI}
            scoreBandBreakdown={scoreBandBreakdown}
            suppressedCount={suppressedCount}
            applySuppression={applySuppression}
          />
        );
      case 7:
        return (
          <ExportStep
            destination={destination}
            setDestination={setDestination}
            estimatedLeads={estimatedLeads}
            previewData={previewData}
            apolloTamData={apolloTamData}
            apolloTamDomains={apolloTamDomains}
            dataSource={dataSource}
            crmSyncStatus={crmSyncStatus}
            isPushing={isPushing}
            pushComplete={pushComplete}
            onCreateCampaign={handleCreateCampaign}
            onOpenApolloRedemption={() => setShowApolloRedemption(true)}
            onClose={onClose}
          />
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
              {/* Step Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                    <div key={s} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                        s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {s}
                      </div>
                      {s < 7 && <div className={`w-12 h-1 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground text-center">Step {step} of 7</div>
              </div>
              
              <div className="min-h-[400px]">{renderStepContent()}</div>
              
              {!pushComplete && (
                <div className="flex justify-between pt-6 border-t mt-6">
                  <Button variant="outline" onClick={handleBack} disabled={step === 1}>
                    <ArrowLeft className="mr-2 h-4 w-4" />Back
                  </Button>
                  {step < 7 && (
                    <Button onClick={handleNext}>
                      Next<ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
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
                avgFitScore={previewData ? previewData.reduce((sum: number, acc: any) => sum + (acc.overall_score || 0), 0) / previewData.length : undefined}
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
        accountDomains={dataSource === 'database' ? apolloTamDomains : (previewData?.map((a: any) => a.domain).filter(Boolean) || [])}
        icpCriteria={dataSource === 'database' && activeICP ? {
          industries: activeICP.industries,
          geographies: activeICP.geographies,
          company_sizes: activeICP.company_sizes,
          revenue_ranges: activeICP.revenue_ranges
        } : undefined}
        campaignName={campaignName}
        onRedemptionComplete={() => {
          resetExport();
          toast({ title: "Campaign Created", description: "Contacts redeemed from Apollo" });
        }}
      />
    </Dialog>
  );
}
